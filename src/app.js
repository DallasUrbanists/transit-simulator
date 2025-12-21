import "leaflet-polylineoffset";
import 'leaflet/dist/leaflet.css';
import MapContext from "./MapContext";
import { debug } from './misc/debug.js';
import { $, closeFullscreen, convert, create, dispatch, displayNone, displayShow, doThisNowThatLater, hide, openFullscreen, show, when } from './misc/utilities.mjs';
import { agencies, isFullyLoaded, loadAgencies } from './models/sources.js';
import Playback from './Playback';
import Simulation from './Simulation';
import ClockWidget from "./widgets/ClockWidget.js";
import PlayPauseButton from "./widgets/PlayPauseButton.js";
import ProgressBarWidget from "./widgets/ProgressBarWidget.js";
import UserPreferences from "./UserPreferences.js";
import MainMenuWidget from "./widgets/MainMenuWidget.js";
import Loader from "./widgets/LoaderWidget.js";

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

function lockBackground() {
    document.body.classList.add("is-loading");
}

function unlockBackground() {
    document.body.classList.remove("is-loading");
}


function loadSimulation() {
    displayNone(mainmenu.element);
    displayShow($('#loading'));
    lockBackground();

    if (!isFullyLoaded(preferences.enableAgencies)) {
        displayNone($('#enter-simulation-button'));
        displayShow($('#load-inprogress-text'));
        const format = (number) => new Intl.NumberFormat().format(number);
        // create a load list for each enabled agency
        preferences.enableAgencies.forEach(enabledAgency => {
            const loadListDivId = 'agency-load-list-'+enabledAgency.replace(/\W/g, '');
            let agencyLoadListDiv = $('#'+loadListDivId);
            console.log(agencyLoadListDiv);
            const agency = agencies.get(enabledAgency);
                // If load list does not exist yet, create a new one
            if (!agencyLoadListDiv) {
                agencyLoadListDiv = create('div', 'agency-load-list', { id: loadListDivId });
                const h3 = create('h3', 'agency-load-list-header');
                h3.innerText = agency.name;
                $('#load-list').appendChild(h3);
                $('#load-list').appendChild(agencyLoadListDiv);
                // create a div for each load step
                Loader.STEPS.forEach(({ key, before, during, after }) => {
                    const stepDiv = create('div', 'load-list-item load-'+key);
                    const spinner = create('img', 'load-animation', { src: './icons/walking-animated-black.png' });
                    const checkmark = create('div', 'checkmark');
                    const span = create('span');
                    stepDiv.appendChild(spinner);
                    stepDiv.appendChild(checkmark);
                    stepDiv.appendChild(span);
                    stepDiv.dataset.agency = enabledAgency;
                    span.innerText = before;
                    agencyLoadListDiv.appendChild(stepDiv);
                    when(Loader.PROGRESS, detail => {
                        // console.log('PROGRESS DETECTED!', detail);
                        if (detail.key === key && detail.agency_id === agency.agency_id) {
                            // console.log('matched!', key, agency.agency_id);
                            stepDiv.classList.remove('inprogress');
                            stepDiv.classList.remove('finished');
                            stepDiv.classList.remove('error');
                            switch (detail.status) {
                                case 'reset':
                                    span.innerText = before;
                                    break;
                                case 'finished':
                                    span.innerText = after.replace(Loader.BLANK, format(detail.count));
                                    stepDiv.classList.add('finished');
                                    break;
                                case 'error':
                                    span.innerText = `Unexpected error ${during.toLowerCase()}`;
                                    stepDiv.classList.add('error');
                                    break;
                                case 'inprogress':
                                default:
                                    span.innerText = during;
                                    stepDiv.classList.add('inprogress');
                                    break;                            
                            }
                        }
                    });
                });
            }
        }); 
        loadAgencies(preferences.enableAgencies);
    } else {
        displayShow($('#enter-simulation-button'));
        displayNone($('#load-inprogress-text'));
    }
}

showMenu();

// Listen for non-UI events
when(Loader.FINISHED, () => {
    if (isFullyLoaded(preferences.enableAgencies)) {
        displayNone($('#load-inprogress-text'));
        displayShow($('#enter-simulation-button'));
        map.redrawFixtures();
        $('#speed-select').value = playback.speed;
        $('#style-select').value = map.style;
        $('#clock-size-select').value = clock.size;
        $('#clock-color-select').value = clock.color;
        playback.scrub(playback.playhead); // This is just to trigger update in progress bar and any other elements listening for playhead changes
    }
});
when(Playback.SPEED_CHANGED, speed => $('#speed-select').value = speed);
when(ClockWidget.COLOR_CHANGED, color => $('#clock-color-select').value = color);
when(ClockWidget.SIZE_CHANGED, color => $('#clock-size-select').value = color);
when(MapContext.STYLE_CHANGED, style => $('#style-select').value = style);

// Handle user interaction with UI
$('#enter-simulation-button').onclick = () => {
    displayNone($('#loading'));
    unlockBackground();
};
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
window.addEventListener('keypress', e => {
    if (e.key == " " || e.code == "Space") {
        playback.toggle();
    } else if (e.key == "q" || e.key == "Q") {
        map.zoomOut(0.5, { animate: true });
    } else if (e.key == "e" || e.key == "E") {
        map.zoomIn(0.5, { animate: true });
    } else if (e.key == "f" || e.key == "F") {
        openFullscreen($('body'));
    }
});

// When mouse moves, briefly show the leave fullscreen button
when('mousemove', () => doThisNowThatLater(
    () => show($('#leave-fullscreen'), 0.5),
    () => hide($('#leave-fullscreen')),
    1 // seconds
));