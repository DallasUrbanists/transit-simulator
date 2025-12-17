import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext, { getStoredMapStyle } from "./MapContext";
import { $, convert, DAY, minValMax } from './utilities.mjs';
import Playback from './Playback';
import Simulation from './Simulation';
import { loadAgencies } from './sources.js';
import { debug } from './debug.js';

const map = new MapContext('map');
const simulation = new Simulation(map);
const playback = new Playback(simulation);

window.debug = debug(map);

loadAgencies(['DART', 'TrinityMetro', 'DCTA']).then(() => {
    console.log('Finished loading agency sources.');
    map.redrawFixtures();
    window.dispatchEvent(new CustomEvent('loadFinished'));
});

// TO-DO:
// - Verify what all the various Service IDs mean
// - Attach each service code to UI checkboxes
simulation.setTripCriteria(trip => {
    // DART SERVICE CODES
    const BUS_WEEKDAY_SERVICE = '2';
    const BUS_SATURDAY_SERVICE = '3';
    const BUS_SUNDAY_SERVICE = '4';
    const RAIL_WEEKDAY_SERVICE = '14';
    const RAIL_IDK1_SERVICE = '19'; // Probably Rail Saturday service?
    const RAIL_IDK2_SERVICE = '20'; // Probably Rail Sunday service?
    const RAIL_IDK3_SERVICE = '21'; // Probably Rail Special service?
    const MATA_IDK1_SERVICE = '402'; // M Line Trolley is covered by RAIL_WEEKDAY_SERVICE
    const MATA_IDK2_SERVICE = '502'; // M Line Trolley is covered by RAIL_WEEKDAY_SERVICE
    const UTD_IDK1_SERVICE = '902'; // UTD 883 Routes are covered by BUS_WEEKDAY_SERVICE
    const UTD_IDK2_SERVICE = '1002'; // UTD 883 Routes are covered by BUS_WEEKDAY_SERVICE
    const TRE_IDK1_SERVICE = '1621'; // Trinity Railray Express is covered by RAIL_WEEKDAY_SERVICE
    const TRE_IDK2_SERVICE = '1521'; // Trinity Railray Express is covered by RAIL_WEEKDAY_SERVICE

    // DENTON COUNTY TRANSITY AUTHORITY SERVICE CODES
    const DCTA_BUS_WEEKDAY = '2026_Spring_-Weekday';
    const DCTA_RAIL_WEEKDAY = 'A-Train-Mo-Th';

    // TRINITY METRO SERVICE CODES
    const TRINITY_MON_FRI = '140.0.1';
    const TRINITY_XMAS_CAPITAL_EXPRESS = '140.CCEX.1';
    const TRINITY_XMAS_PALACE_THEATRE = '140.CCPT.1';

    // Choose specific routes/trips to enable
    const enableTripsByServiceId = [
        BUS_WEEKDAY_SERVICE,
        RAIL_WEEKDAY_SERVICE,
        DCTA_BUS_WEEKDAY,
        DCTA_RAIL_WEEKDAY,
        TRINITY_MON_FRI,
        TRINITY_XMAS_CAPITAL_EXPRESS,
        TRINITY_XMAS_PALACE_THEATRE,
        '312753486348',
        '312753486348',
        '112760676348',
        '112760676348',
    ];
    const enableRoutesByAgencyAndRouteId = [
        ['51', '86'],
        ['51', '87'],
    ];

    if (enableTripsByServiceId.includes(trip.get('service_id'))) {
        return true;
    }
    return false;
});

// Listen for non-UI events
window.addEventListener('playheadChanged', updateControlBar);
window.addEventListener('resize', updateControlBar);
window.addEventListener('loadProgress', (event) => $('#loading-progress').innerText = event.detail + '%');
window.addEventListener('loadFinished', () => {
    playback.scrub(playback.playhead);
    $('#loading').style.display = 'none';
    $('#speed-select').value = localStorage.getItem('playback_speed') ?? 32;
    $('#style-select').value = localStorage.getItem('last_map_style') ?? 'STREETS.DARK';
    // updateControlBar();
});

// Handle user interaction with UI for playback control
$('#speed-select').addEventListener('change', (e) => playback.setSpeed(e.target.value));
$('#style-select').addEventListener('change', (e) => map.setStyle(e.target.value));
$('#play-button').onclick = () => playback.toggle();
$('#enter-fullscreen').onclick = openFullscreen;
$('#leave-fullscreen').onclick = closeFullscreen;
$('#reset-time').onclick = () => {
    if (playback.isPlaying) {
        playback.pause();
    }
    playback.setPlayhead(convert.nowInSeconds());
    playback.unpause();
};
$('#reset-clock-pos').onclick = () => {
    $('#time-indicator').style.left = '60px';
    $('#time-indicator').style.top = '60px';
    localStorage.setItem('clock-left', 60);
    localStorage.setItem('clock-top', 60);
};


// Handle when user clicks and drags on progress bar to "scrub" timeline.
let scrubTimer;
const progressTrack = $('#progress-track');
const getClickRatio = click => Math.max(0, (click.clientX - progressTrack.getBoundingClientRect().left)) / progressTrack.offsetWidth;
const scrubOnce = event => {
    const playhead = DAY * getClickRatio(event);
    playback.scrub(playhead);
    updateControlBar(playhead);
};
const keepScrubbing = event => {
    updateControlBar(DAY * getClickRatio(event));
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => scrubOnce(event), 10);
};
const startScrubbing = event => {
    if (playback.isPlaying) playback.pause();
    progressTrack.addEventListener('mousemove', keepScrubbing, true);
    scrubOnce(event);
};
const stopScrubbing = () => {
    playback.unpause();
    progressTrack.removeEventListener('mousemove', keepScrubbing, true);
};
progressTrack.addEventListener('mousedown', startScrubbing);
window.addEventListener('mouseup', stopScrubbing);

// Briefly show the "Exit Fullscreen" button when user moves mouse
let showTimeout;
window.addEventListener('mousemove', () => {
    $('#leave-fullscreen').classList.add('show');
    clearTimeout(showTimeout);
    showTimeout = setTimeout(() => $('#leave-fullscreen').classList.remove('show'), 1000);
});

// Press spacebar to toggle playback
window.addEventListener('keypress', e => e.key == " " || e.code == "Space" ? playback.toggle() : null);

// Update the control bar UI to show the current playhead time, adjust progress bar width, and toggle play button
function updateControlBar() {
    const targetPlayhead = playback.playhead;
    const barWidth = progressTrack.offsetWidth * minValMax(0, targetPlayhead / DAY, 1);
    $('#time-indicator').innerText = convert.secondsToTimeString(targetPlayhead);
    $('#progress-bar').style.width = barWidth + 'px';
    if (playback.isPlaying) {
        document.body.classList.add('playing');
        $('#progress-bar').classList.add('pulsing-element');
        $('#play-button img').src = './icons/pause.svg';
    } else {
        document.body.classList.remove('playing');
        $('#progress-bar').classList.remove('pulsing-element');
        $('#play-button img').src = './icons/play.svg';
    }
}

// Make the time indicator repositionable by click-and-dragging
const timer = $('#time-indicator');
const isTouch = e => e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel';
const isClick = e => e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave';
dragElement(timer);
function dragElement(draggable) {
    let ogTop, ogLeft, mouseX, mouseY;
    draggable.onmousedown = dragMouseDown;
    draggable.ontouchstart = dragMouseDown;    
    function dragMouseDown(e) {
        e.preventDefault();
        ogLeft = draggable.offsetLeft;
        ogTop = draggable.offsetTop;
        if (isClick(e)) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        } else if (isTouch(e)) {
            var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            mouseX = touch.pageX;
            mouseY = touch.pageY;
        }
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        document.ontouchcancel = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
        console.log('touch start');
    }
    function elementDrag(e) {
        e.preventDefault();
        let deltaX, deltaY;
        if (isClick(e)) {
            deltaX = mouseX - e.clientX;
            deltaY = mouseY - e.clientY;
        } else if (isTouch(e)) {
            var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            deltaX = mouseX - touch.pageX;
            deltaY = mouseY - touch.pageY;
        }
        // calculate new object position
        const newLeft = ogLeft - deltaX;
        const newTop = ogTop - deltaY;
        draggable.style.left = newLeft + "px";
        draggable.style.top = newTop + "px";
        // store in memory
        localStorage.setItem('clock-left', newLeft);
        localStorage.setItem('clock-top', newTop);
        console.log('touch move');
    }
    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.ontouchend = null;
        document.onmousemove = null;
        document.ontouchmove = null;
        console.log('touch end');
    }
}
const clockLeft = localStorage.getItem('clock-left');
if (clockLeft) timer.style.left = clockLeft + 'px';
const clockTop = localStorage.getItem('clock-top');
if (clockTop) timer.style.top = clockTop + 'px';

// Change size of clock text based on selection
const setClockSize = size => {
    timer.style.fontSize = size + 'vw';
    $('#clock-fontsize').value = size;
    localStorage.setItem('clock-size', size);
};
$('#clock-fontsize').addEventListener('change', e => setClockSize(e.target.value));
const storedClockSize = localStorage.getItem('clock-size');
if (storedClockSize) setClockSize(storedClockSize);

// Change color of clock based on selection
const lightClock = { color: 'white', shadow: 'black' };
const darkClock = { color: 'black', shadow: 'white' };
const setClockColor = (choice) => {
    const theme = choice === 'light' ? lightClock : darkClock;
    timer.style.color = theme.color;
    timer.style.textShadow = '0 0 4px ' + theme.shadow;
    $('#clock-color').value = choice;
    localStorage.setItem('clock-color', choice);
};
$('#clock-color').addEventListener('change', e => setClockColor(e.target.value));
const storedClockColor = localStorage.getItem('clock-color');
if (storedClockColor) setClockColor(storedClockColor);

/* Open fullscreen */
const elem = document.documentElement;
function openFullscreen() {
    document.body.classList.add('fullscreen-mode');
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

/* Close fullscreen */
function closeFullscreen() {
    document.body.classList.remove('fullscreen-mode');
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
    }
}