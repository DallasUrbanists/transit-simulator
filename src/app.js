import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext from "./MapContext";
import { debug } from './misc/debug.js';
import { $, closeFullscreen, convert, doThisNowThatLater, openFullscreen, when, show, hide } from './misc/utilities.mjs';
import { loadAgencies } from './models/sources.js';
import Playback from './Playback';
import Simulation from './Simulation';
import ClockWidget from "./widgets/ClockWidget.js";
import PlayPauseButton from "./widgets/PlayPauseButton.js";
import ProgressBarWidget from "./widgets/ProgressBarWidget.js";

const map = new MapContext('map');
const simulation = new Simulation(map);
const playback = new Playback(simulation);
const clock = new ClockWidget('clock', playback);
new ProgressBarWidget('progress-track', playback);
new PlayPauseButton('play-button', playback);

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
when('loadFinished', () => {
    $('#loading').style.display = 'none';
    $('#speed-select').value = playback.speed;
    $('#style-select').value = map.style;
    $('#clock-size-select').value = clock.size;
    $('#clock-color-select').value = clock.color;
    playback.scrub(playback.playhead); // This is just to trigger update in progress bar and any other elements listening for playhead changes
});
when(Playback.SPEED_CHANGED, speed => $('#speed-select').value = speed);
when(ClockWidget.COLOR_CHANGED, color => $('#clock-color-select').value = color);
when(ClockWidget.SIZE_CHANGED, color => $('#clock-size-select').value = color);
when(MapContext.STYLE_CHANGED, style => $('#style-select').value = style);

// Handle user interaction with UI
$('#speed-select').onchange = e => playback.setSpeed(e.target.value);
$('#style-select').onchange = e => map.setStyle(e.target.value);
$('#clock-size-select').onchange = e => clock.setSize(e.target.value);
$('#clock-color-select').onchange = e => clock.setColor(e.target.value);
$('#enter-fullscreen').onclick = () => openFullscreen($('body'));
$('#leave-fullscreen').onclick = closeFullscreen;
$('#reset-clock-pos').onclick = () => clock.resetPosition();
$('#reset-time').onclick = () => {
    if (playback.isPlaying) playback.pause();
    playback.setPlayhead(convert.nowInSeconds());
    playback.unpause();
};

// Press spacebar to toggle playback
when('keypress', e => e.key == " " || e.code == "Space" ? playback.toggle() : null);

// When mouse moves, briefly show the leave fullscreen button
when('mousemove', () => doThisNowThatLater(
    () => show($('#leave-fullscreen'), 0.5),
    () => hide($('#leave-fullscreen')),
    1 // seconds
));