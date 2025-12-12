import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import * as turf from '@turf/turf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { convert } from './js/utilities.mjs';
import tripsGroupedByHour from "./preload/trips-grouped-by-hour.json" with { type: "json" };
import { getTrip } from './scripts/trips';

const settings = {
    defaultCoords: [32.780694233921906, -96.79930204561467],
    maptilerApiKey: '4I9PqHwTZ9xDdwVnOp74',
    defaultZoomLevel: 13,
    defaultMapStyle: maptilersdk.MapStyle['STREETS']['DARK'],
    defaultPlaySpeed: 64,
};

function labelSubstitution(string) {
    if (['RED', 'BLUE', 'ORANGE', 'GREEN', 'SILVER'].includes(string)) {
        return string.charAt(0);
    }
    if (string === '620') {
        return 'DSC';
    }
    if (string === '425') {
        return 'M';
    }
    return string;
}

const map = L.map('map').setView(settings.defaultCoords, settings.defaultZoomLevel);

const busPane = map.createPane('busPane');
const busPathsPane = map.createPane('busPathsPane');
const lightRailPane = map.createPane('lightRailPane');
const lightRailPathsPane = map.createPane('lightRailPathsPane');
const commuterRailPane = map.createPane('commuterRailPane');
const commuterRailPathsPane = map.createPane('commuterRailPathsPane');
const streetcarPane = map.createPane('streetcarPane');
const streetcarPathsPane = map.createPane('streetcarPathsPane');
const tileLayer = new MaptilerLayer({ apiKey: settings.maptilerApiKey, style: settings.defaultMapStyle, opacity: 0.25 }).addTo(map);
const activeTrips = {};
const fadePile = [];
const allVehicles = L.layerGroup().addTo(map);
const dispatchUpdate = () => window.dispatchEvent(new CustomEvent('playheadChanged'));
const isPlaying = () => window.appIsPlaying === true;
const setPlayhead = (seconds) => {
    window.playhead = seconds;
    dispatchUpdate();
};
const setPlaySpeed = (speed) => {
    window.playSpeed = speed;
    if (isPlaying()) {
        window.cancelAnimationFrame(window.appAnimation);
        window.startTimestamp = performance.now();
        window.startPlayhead = window.playhead;
        window.appAnimation = requestAnimationFrame(pulse);
    } else {
        dispatchUpdate();
    }
};
const chooseStyle = (label) => {
    switch (label) {
        case 'B':
        case 'R':
        case 'O':
        case 'G':
            return { weight: 8, opacity: 1 };
        case 'S':
        case 'TRE':
            return { weight: 12, opacity: 1 };
        case 'M':
        case 'DSC':
            return { weight: 6, opacity: 0.75 };
        default:
            return { weight: 4, opacity: 0.75 };
    }
};
const choosePane = (label) => {
    switch (label) {
        case 'B':
        case 'R':
        case 'O':
        case 'G':
            return lightRailPane;
        case 'S':
        case 'TRE':
            return commuterRailPane;
        case 'M':
        case 'DSC':
            return streetcarPane;
        default:
            return busPane;
    }
};
const choosePathsPane = (label) => {
    switch (label) {
        case 'B':
        case 'R':
        case 'O':
        case 'G':
            return 'lightRailPathsPane';
        case 'S':
        case 'TRE':
            return 'commuterRailPathsPane';
        case 'M':
        case 'DSC':
            return 'streetcarPathsPane';
        default:
            return 'busPathsPane';
    }
};
const chooseMarkerClassName = (label) => {
    switch (label) {
        case 'B':
        case 'R':
        case 'O':
        case 'G':
            return 'light-rail train rail';
        case 'S':
        case 'TRE':
            return 'commuter-rail train rail';
        case 'M':
        case 'DSC':
            return 'streetcar rail';
        default:
            return 'bus';
    }
};
const measureDistanceFeet = (latLng1, latLng2) => {
    const lat = 0, lng = 1;
    return turf.distance(
        turf.point([latLng1[lng], latLng1[lat]]),
        turf.point([latLng2[lng], latLng2[lat]]),
        { units: 'feet' }
    );
};
const render = (targetPlayhead) => {
    if (!window.TRIPS || !window.ROUTES) {
        console.log('Not ready to render.');
        return;
    }

    tripsGroupedByHour[convert.secondsToHour(targetPlayhead)]
        .filter(trip => trip.startSeconds <= targetPlayhead && trip.endSeconds >= targetPlayhead)
        .map(t => {
            const trip = getTrip(t.trip_id);
            if (!trip.details) {
                trip.details = window.TRIPS.find(t => t.trip_id == trip.trip_id);
                if (!trip.details) {
                    return;
                }
            }
            // Ignore weekend service trips
            if (['3', '4'].includes(trip.details)) {
                return;
            }
            if (!activeTrips[trip.trip_id]) {
                activeTrips[trip.trip_id] = trip;
            }
            if (!trip.route) {
                trip.route = window.ROUTES.find(r => r.id == trip.details.route_id);
            }
        });
    for (let tripId in activeTrips) {
        const trip = activeTrips[tripId];
        if (!trip) {
            continue;
        }
        const segments = trip.details.trip_segments;
        const firstPosition = segments[0].geometry.coordinates[0];
        const latLng = latLngFromCoord(firstPosition);
        // const nearestParked = findNearestParked(trip.label, latLng);
        if (targetPlayhead < trip.startSeconds || targetPlayhead > trip.endSeconds) {
            if (isPlaying()) {
                // if (trip.marker && !nearestParked) {
                //     parkVehicle(trip.label, trip.marker);
                // } else {
                const marker = trip.marker;
                marker.setOpacity(0.5);
                trip.shadow = marker;
                setTimeout(() => {
                    marker.setOpacity(0);
                    setTimeout(() => {
                        trip.shadow = null;
                        allVehicles.removeLayer(marker);
                        map.removeLayer(marker);
                    }, 1000);
                }, 2000);
                // }
                trip.marker = null;
                if (trip.tail) {
                    fadePile.push(trip.tail);
                    trip.tail = null;
                }
            } else {
                if (trip.marker) {
                    map.removeLayer(trip.marker);
                    delete trip.marker;
                }
                if (trip.tail) {
                    map.removeLayer(trip.tail);
                    delete trip.tail;
                }
            }
            trip.history = [];
            activeTrips[tripId] = null;
            continue;
        }
        if (!trip.label) {
            trip.label = labelSubstitution(trip.route.short_name);
        }
        if (!trip.marker) {
            if (trip.shadow) {
                trip.shadow.setOpacity(0);
            }
            const className = `transit-icon vehicle-${trip.label} ${chooseMarkerClassName(trip.label)}`;
            const icon = L.divIcon({ className, html: trip.label, iconSize: [24, 24] });
            trip.marker = L.marker(latLng, { icon, pane: choosePane(trip.label) }).addTo(allVehicles);
            trip.marker.type = 'vehicle';
            trip.marker.label = trip.label;
        }
        trip.marker.setOpacity(1);
        if (!trip.history) {
            trip.history = [];
        }
        if (isPlaying()) {
            const minTailLength = 8;
            const maxTailLength = Math.round(8192 / window.playSpeed);
            const maxTailEndLength = convert.milesToFeet(1);
            if (trip.history.length > maxTailLength) {
                trip.history = trip.history.slice(maxTailLength * -1);
            }
            if (trip.history.length >= minTailLength) {
                try {
                    // If either end of tail is more than a few miles long, it's probably due to an awkward jump
                    // We want to prevent this by resetting history when either end becomes too long
                    const indexA = trip.history.length - 1;
                    const positionA = trip.history[indexA];
                    const positionB = trip.history[indexA - 1];
                    const tailLengthAB = measureDistanceFeet(positionA, positionB);
                    if (tailLengthAB > maxTailEndLength) {
                        trip.history = [];
                    } else {
                        const positionC = trip.history[1];
                        const positionD = trip.history[0];
                        const tailLengthCD = measureDistanceFeet(positionC, positionD);
                        if (tailLengthCD > maxTailEndLength) {
                            trip.history = [];
                        } else {
                            if (!trip.tail) {
                                const { weight, opacity } = chooseStyle(trip.label);
                                const pathPane = choosePathsPane(trip.label);
                                trip.tail = L.polyline(trip.history, {
                                    className: `tail-${trip.label} ${chooseMarkerClassName(trip.label)}`,
                                    color: `#${trip.route.color}`,
                                    weight,
                                    opacity,
                                    pane: pathPane
                                }).addTo(map);
                                trip.tail.type = 'tail';
                            } else {
                                trip.tail.setLatLngs(trip.history);
                            }
                        }
                    }
                } catch (e) {
                    console.error(e);
                    console.log(trip.history);
                }
            }
        } else {
            if (trip.tail) {
                fadePile.push(trip.tail);
                trip.tail = null;
            }
            trip.history = [];
        }

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const startSec = segment.properties.startSeconds;
            const endSec = segment.properties.endSeconds;
            const duration = segment.properties.durationSeconds;
            const distance = segment.properties.distanceFeet;
            if (targetPlayhead <= startSec) {
                const newPos = latLngFromCoord(firstCoord(segment));
                trip.marker.setLatLng(newPos);
                if (isPlaying()) {
                    if (
                        trip.history.length === 0 ||
                        trip.history[trip.history.length - 1] == newPos
                    ) {
                        trip.history.push(newPos);
                    }
                }
                break;
            }
            if (targetPlayhead <= endSec) {
                const elapsedSeconds = targetPlayhead - startSec;
                const elapsedRatio = elapsedSeconds / duration;
                const easedRatio = easeInOutCubic(elapsedRatio);
                const elapsedDistance = distance * easedRatio;
                const newPos = turf.flip(
                    turf.along(segment, elapsedDistance, { units: 'feet' })
                ).geometry.coordinates;
                trip.marker.setLatLng(newPos);
                if (isPlaying()) {
                    trip.history.push(newPos);
                }
                break;
            }
        }
    }

    fadePile.forEach((layer, index) => {
        if (!layer) {
            return;
        }
        if (!isPlaying()) {
            map.removeLayer(layer);
            fadePile.splice(index, 1);
            return;
        }
        switch (layer.type) {
            case 'tail':
                const latLngs = layer.getLatLngs();
                if (latLngs.length <= 5) {
                    map.removeLayer(layer);
                    fadePile.splice(index, 1);
                } else {
                    latLngs.shift();
                    layer.setLatLngs(latLngs);
                }
                break;
            case 'vehicle':
                const secondsInPile = targetPlayhead - layer.timeOfEnd;
                const secondsToFade = 2 * window.playSpeed;
                if (secondsInPile >= secondsToFade) {
                    map.removeLayer(layer);
                    fadePile.splice(index, 1);
                } else {
                    layer.setOpacity(easeOutQuad(1 - secondsInPile / secondsToFade));
                }
                break;
            default:
                fadePile.splice(index, 1);
                map.removeLayer(layer);
                break;
        }
    });

};
const emptyHours = new Set();
const pulse = (timestamp) => {
    const deltaMilliseconds = Math.max(0, timestamp - window.startTimestamp);
    const deltaSeconds = (deltaMilliseconds * window.playSpeed) / 1000;
    let newPlayhead = window.startPlayhead + deltaSeconds;
    const activeTripCount = Object.values(activeTrips).filter(t => t).length;
    const activeHour = convert.secondsToHour(newPlayhead);

    render(newPlayhead);

    // If last render resulted in zero empty trips and is past midnight
    // Then reset the clock to restart animation from the beginning on next pulse
    if (newPlayhead > convert.daysToSeconds(1) && activeTripCount === 0) {
        // clearParkedVehicles();
        allVehicles.clearLayers();
        if (!emptyHours.has(activeHour)) {
            emptyHours.add(activeHour);
        }
    }
    if (emptyHours.size > 1) {
        newPlayhead = newPlayhead - convert.daysToSeconds(1);
        window.startTimestamp = timestamp;
        window.startPlayhead = newPlayhead;
        setPlayhead(newPlayhead);
        emptyHours.clear();
    } else {
        setPlayhead(newPlayhead);
    }

    if (isPlaying()) {
        window.appAnimation = requestAnimationFrame(pulse);
    }
};
const startPlayback = () => {
    window.appIsPlaying = true;
    window.startTimestamp = performance.now();
    window.startPlayhead = window.playhead;
    window.appAnimation = requestAnimationFrame(pulse);
    dispatchUpdate();
};
const stopPlayback = () => {
    window.appIsPlaying = false;
    window.cancelAnimationFrame(window.appAnimation);
    dispatchUpdate();
};
const scrub = (newPlayhead) => {
    stopPlayback();
    setPlayhead(newPlayhead);
    render(newPlayhead);
};

window.playhead = 0;
window.playSpeed = settings.defaultPlaySpeed;

const px = (n) => `${n}px`;

const handleZoomScaling = () => {
    const currentZoom = map.getZoom();
    const busIcons = document.querySelectorAll('.transit-icon.bus, .transit-icon.streetcar');
    const lightRailPathPane = document.querySelector('.leaflet-pane.leaflet-lightRailPaths-pane');
    const commuterRailPathPane = document.querySelector('.leaflet-pane.leaflet-commuterRailPaths-pane');
    if (currentZoom < 12) {
        lightRailPathPane.style.zIndex = 415;
        commuterRailPathPane.style.zIndex = 420;
    } else {
        lightRailPathPane.style.zIndex = 315;
        commuterRailPathPane.style.zIndex = 320;
    }
    busIcons.forEach(icon => {
        let iconSize, fontSize;
        if (currentZoom < 12) {
            iconSize = 12;
            fontSize = 7;
        } else {
            iconSize = 24;
            fontSize = 12;
        }
        icon.style.width = px(iconSize);
        icon.style.height = px(iconSize);
        icon.style.fontSize = px(fontSize);
        icon.style.lineHeight = px(iconSize);
        icon.style.marginLeft = px(iconSize / -2);
        icon.style.marginTop = px(iconSize / -2);
    });
};

map.on('zoomend', handleZoomScaling);
map.on('layeradd', handleZoomScaling);

const app = {
    render,
    isPlaying,
    setPlayhead,
    setPlaySpeed,
    scrub,
    startPlayback,
    stopPlayback,
    togglePlay: () => isPlaying() ? stopPlayback() : startPlayback(),
    setMapStyle: (style) => {
        const style_code = style.split(".");
        style_code.length === 2
            ? tileLayer.setStyle(maptilersdk.MapStyle[style_code[0]][style_code[1]])
            : tileLayer.setStyle(maptilersdk.MapStyle[style_code[0]])
            ;
    },
};

function latLngFromCoord(lngLat) {
    return [lngLat[1], lngLat[0]];
}

function firstCoord(feature) {
    return feature.geometry.coordinates[0];
}

function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
}
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const loadingScreen = document.getElementById('loading');
const loadProgress = document.getElementById('loading-progress');
const progressTrack = document.getElementById('progress-track');
const progressBar = document.getElementById('progress-bar');
const timeIndicator = document.getElementById('time-indicator');
const playButton = document.getElementById('play-button');
const playImg = playButton.querySelector('img');
const speedSelector = document.getElementById('speed-select');
const styleSelector = document.getElementById('style-select');
const secondsInDay = 60 * 60 * 24;
let wasPlayingEarlier = false;
let scrubInterval = null;

speedSelector.addEventListener('change', (e) => app.setPlaySpeed(e.target.value));
styleSelector.addEventListener('change', (e) => app.setMapStyle(e.target.value));
progressTrack.addEventListener('mousedown', (e) => {
    if (app.isPlaying()) { wasPlayingEarlier = true; }
    handleScrub(e);
    progressTrack.addEventListener('mousemove', handleScrubTimed, true);
});
window.addEventListener('mouseup', () => {
    if (scrubInterval) {
        clearInterval(scrubInterval);
    }
    if (wasPlayingEarlier === true && app.isPlaying() === false) {
        document.querySelectorAll('.transit-icon').forEach(marker => {
            marker.style.transition = "inherit";
        });
        wasPlayingEarlier = false;
        app.togglePlay();
    }
    progressTrack.removeEventListener('mousemove', handleScrubTimed, true);
});
playButton.addEventListener('click', () => {
    document.querySelectorAll('.transit-icon').forEach(marker => {
        marker.style.transition = "inherit";
    });
    app.togglePlay();
});
window.addEventListener('playheadChanged', () => updateControlBar());
window.addEventListener('resize', () => updateControlBar());
window.addEventListener('loadProgress', (event) => loadProgress.innerText = event.detail + '%');
window.addEventListener('loadFinished', (event) => {
    app.scrub(window.playhead);
    loadingScreen.style.display = 'none';
    updateControlBar();
});

app.setPlayhead(convert.nowInSeconds());
app.scrub(window.playhead);
updateControlBar();

function handleScrub(event) {
    const trackX = progressTrack.getBoundingClientRect().left;
    const ratio = Math.max(0, (event.clientX - trackX)) / progressTrack.offsetWidth;
    const newPlayhead = secondsInDay * ratio;
    document.querySelectorAll('.transit-icon').forEach(marker => {
        marker.style.transition = "all 2s";
    });
    app.scrub(newPlayhead);
    document.querySelectorAll('.transit-icon').forEach(marker => {
        marker.style.transition = "all 2s";
    });
    updateControlBar(newPlayhead);
}

function handleScrubTimed(event) {
    if (scrubInterval) {
        clearInterval(scrubInterval);
    }
    const trackX = progressTrack.getBoundingClientRect().left;
    const ratio = Math.max(0, (event.clientX - trackX)) / progressTrack.offsetWidth;
    const newPlayhead = secondsInDay * ratio;
    updateControlBar(newPlayhead);
    scrubInterval = setInterval(() => handleScrub(event), 100);
}

function updateControlBar(newPlayhead = null) {
    const targetPlayhead = newPlayhead === null ? window.playhead : newPlayhead;
    const trackWidth = progressTrack.offsetWidth;
    const progressRatio = Math.max(0, Math.min(targetPlayhead, secondsInDay) / secondsInDay);
    const barWidth = trackWidth * progressRatio;
    timeIndicator.innerText = convert.secondsToTimeString(targetPlayhead);
    progressBar.style.width = barWidth + 'px';
    if (app.isPlaying()) {
        document.body.classList.add('playing');
        progressBar.classList.add('pulsing-element');
        playImg.src = './icons/pause.svg';
    } else {
        document.body.classList.remove('playing');
        progressBar.classList.remove('pulsing-element');
        playImg.src = './icons/play.svg';
    }
}