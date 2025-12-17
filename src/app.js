import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext from "./MapContext";
import { $, convert, DAY, minValMax, when} from './utilities.mjs';
import Playback from './Playback';
import Simulation from './Simulation';
import { loadAgencies } from './sources.js';
import { debug } from './debug.js';
import ClockWidget from "./ClockWidget.js";

const map = new MapContext('map');
const simulation = new Simulation(map);
const playback = new Playback(simulation);
const clock = new ClockWidget('clock', playback);

window.debug = debug(map);

loadAgencies([/*'DART', 'TrinityMetro',*/ 'DCTA']).then(() => {
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
when('resize', updateControlBar);
when('loadFinished', () => {
    playback.scrub(playback.playhead);
    $('#loading').style.display = 'none';
    $('#speed-select').value = playback.speed;
    $('#style-select').value = map.style;
    $('#clock-size').value = clock.size;
    $('#clock-color').value = clock.color;
});
when(Playback.PLAYHEAD_CHANGED, updateControlBar);
when(Playback.SPEED_CHANGED, speed => $('#speed-select').value = speed);
when(ClockWidget.COLOR_CHANGED, color => $('#clock-color').value = color);
when(MapContext.STYLE_CHANGED, style => $('#style-select').value = style);

// Handle user interaction with UI
$('#speed-select').onchange = e => playback.setSpeed(e.target.value);
$('#style-select').onchange = e => map.setStyle(e.target.value);
$('#clock-size').onchange = e => clock.setSize(e.target.value);
$('#clock-color').onchange = e => clock.setColor(e.target.value);
$('#play-button').onclick = () => playback.toggle();
$('#enter-fullscreen').onclick = openFullscreen;
$('#leave-fullscreen').onclick = closeFullscreen;
$('#reset-clock-pos').onclick = () => clock.resetPosition();
$('#reset-time').onclick = () => {
    if (playback.isPlaying) playback.pause();
    playback.setPlayhead(convert.nowInSeconds());
    playback.unpause();
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