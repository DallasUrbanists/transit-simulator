import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext from "./MapContext";
import { debug } from './misc/debug.js';
import { $, closeFullscreen, convert, displayNone, displayShow, doThisNowThatLater, hide, openFullscreen, show, when } from './misc/utilities.mjs';
import { loadAgencies } from './models/sources.js';
import Playback from './Playback';
import Simulation from './Simulation';
import ClockWidget from "./widgets/ClockWidget.js";
import PlayPauseButton from "./widgets/PlayPauseButton.js";
import ProgressBarWidget from "./widgets/ProgressBarWidget.js";
import UserPreferences from "./UserPreferences.js";
import MainMenuWidget from "./widgets/MainMenuWidget.js";

const preferences = new UserPreferences();
const map = new MapContext('map');
const simulation = new Simulation(map, preferences);
const playback = new Playback(simulation);
const clock = new ClockWidget('clock', playback);
const mainmenu = new MainMenuWidget('main-menu', preferences);
new ProgressBarWidget('progress-track', playback);
new PlayPauseButton('play-button', playback);

window.debug = debug(map);

function showMenu() {
    displayShow(mainmenu.element);
    displayNone($('#loading'));
}

function loadSimulation() {
    displayNone(mainmenu.element);
    displayShow($('#loading'));
    loadAgencies(preferences.enableAgencies).then(() => {
        map.redrawFixtures();
        window.dispatchEvent(new CustomEvent('loadFinished'));
    });
}

showMenu();

// Listen for non-UI events
when('loadFinished', () => {
    displayNone($('#loading'));
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
$('#show-menu-button').onclick = showMenu;
$('#load-simulation-button').onclick = loadSimulation;
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

// Detect when user exits fullscreen (by means other than by clicking the button) and exit full screen mode when they do
when('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        closeFullscreen();
    }
});