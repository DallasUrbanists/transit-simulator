import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext from "./MapContext";
import { $, convert, DAY,  minValMax } from './utilities.mjs';
import Playback from './Playback';
import Simulation from './Simulation';

const map = new MapContext('map');
const simulation = new Simulation(map);
const playback = new Playback(simulation);

// TO-DO:
// - Find out what each of the Service IDs mean
// - Attach this to UI checkboxes
simulation.setTripCriteria(trip => {
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
    return [
        BUS_WEEKDAY_SERVICE,
        RAIL_WEEKDAY_SERVICE
    ].includes(trip.get('service_id'));
});

// Listen for non-UI events
window.addEventListener('playheadChanged', updateControlBar);
window.addEventListener('resize', updateControlBar);
window.addEventListener('loadProgress', (event) => $('#loading-progress').innerText = event.detail + '%');
window.addEventListener('loadFinished', () => {
    playback.scrub(playback.playhead);
    $('#loading').style.display = 'none';
    updateControlBar();
});

// Handle user interaction with UI for playback control
$('#speed-select').addEventListener('change', (e) => playback.setSpeed(e.target.value));
$('#style-select').addEventListener('change', (e) => map.setStyle(e.target.value));
$('#play-button').onclick = () => playback.toggle();
$('#enter-fullscreen').onclick = () => document.body.classList.add('fullscreen-mode');
$('#leave-fullscreen').onclick = () => document.body.classList.remove('fullscreen-mode');

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

// Alert the UI that loading is finished
window.dispatchEvent(new CustomEvent('loadFinished'));