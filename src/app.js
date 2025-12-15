import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import * as turf from '@turf/turf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import dictionary from './dictionary';
import { getSegmentsFor } from "./segments";
import { findActiveTrips, getTrip } from './trips';
import { $, $$, convert, DAY, ease, isLight, minValMax, randomColor } from './utilities.mjs';
import { getSpecialShape, sectionIndex } from "./special";
import "leaflet-polylineoffset";

const settings = {
    defaultCoords: [32.780694233921906, -96.79930204561467],
    maptilerApiKey: import.meta.env.VITE_MAPTILER_API_KEY,
    defaultZoomLevel: 13,
    defaultMapStyle: maptilersdk.MapStyle['STREETS']['DARK'],
    defaultPlaySpeed: 64,
};

const map = L.map('map').setView(settings.defaultCoords, settings.defaultZoomLevel);
const tileLayer = new MaptilerLayer({ apiKey: settings.maptilerApiKey, style: settings.defaultMapStyle, opacity: 0.25 }).addTo(map);
const activeTrips = new Set();
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
const render = (targetPlayhead) => {
    const newActiveTrips = findActiveTrips(targetPlayhead, (trip => {
        return !['3', '4'].includes(trip.get('service_id'));
    }));
    newActiveTrips.forEach(trip => {
        activeTrips.add(trip);
        const t = key => trip.get(key);
        const tripId = t('trip_id');
        const blockId = t('block_id');
        const d = prop => dictionary(trip).get(prop);

        // Just in time load the segments for this trip
        if (!trip.has('segments')) trip.set('segments', getSegmentsFor(trip));

        // Calculate how many seconds of the current trip has elapsed
        // taking into account possibility of overnight trips
        let tripElapsed = 0;
        const startSeconds = t('startSeconds');
        const endSeconds = t('endSeconds');
        if (startSeconds < DAY && endSeconds < DAY) {
            tripElapsed = targetPlayhead - startSeconds;
        } else if (startSeconds > DAY && endSeconds > DAY) {
            tripElapsed = (targetPlayhead + DAY) - startSeconds;
        } else if (startSeconds <= DAY && endSeconds >= DAY) {
            if (targetPlayhead >= startSeconds) {
                tripElapsed = targetPlayhead - startSeconds;
            } else {
                tripElapsed = (DAY - startSeconds) + targetPlayhead;
            }
        }
        // Calculate the "relative playhead" for this trip
        const relativePlayhead = startSeconds + tripElapsed;

        // A "trip segment" is a portion of the trip between two timepoints (e.g., the track between two rail stations)
        // Based on the relative playhead, figure out which trip segment is currently active.
        const timepoints = t('timepoints');
        const finalTimepoint = timepoints[timepoints.length - 1];
        // The "head position" is where we will place the marker
        // I use the term "head" here in contrast to the "tail" which we'll render later
        let headPosition = undefined;
        // We start by assuming the first segment is the current one
        let currentSegmentIndex = 0;
        for (let i = 0; i < timepoints.length-1; i++) {
            const timepoint = timepoints[i];
            const arrivalSeconds = timepoint.properties.arrival_seconds;
            // If the trip has already passed the final timepoint
            // then set final timepoint as our head position and end this calculation early
            if (timepoint === finalTimepoint) {
                currentSegmentIndex = i;
                headPosition = finalTimepoint;
                break;
                // If the playhead is already past this timepoint...
            } else if (relativePlayhead >= arrivalSeconds) {
                currentSegmentIndex = i;
            } else if (i === 0) {
                headPosition = timepoints[0];
                break;
            // If the playhead is not already past this timepoint
            // then the prior timepoint represents the start of the current segment
            } else {
                break;
            }
        }

        // It's possible we already found our head position while looking for the current segment
        // If not, then proceed with caculating the head position based on the current segment
        let segmentTravel = 0;
        if (!headPosition) {
            const segment = t('segments')[currentSegmentIndex];
            const seconds = index => timepoints[index].properties.arrival_seconds;
            const startSeconds = seconds(currentSegmentIndex);
            const endSeconds = seconds(currentSegmentIndex + 1);
            const duration = endSeconds - startSeconds;
            const segmentElapsed = relativePlayhead - startSeconds;
            const ratio = Math.min(1, Math.max(0, segmentElapsed / duration));
            const traveled = segment.properties.lengthInFeet * ease.inOutCubic(ratio);
            headPosition = turf.along(segment, traveled, { units: 'feet' });
            segmentTravel = traveled;
        }

        // Count the total trip distance traveled so far
        const priorSegmentsLength = t('segments').slice(0, currentSegmentIndex).reduce((total, { properties }) => {
            return total + properties.lengthInFeet;
        }, 0);
        const totalLengthTraveled = priorSegmentsLength + segmentTravel;

        // Convert from LngLat (what turf uses) to LatLng (what Leaflet uses)
        const latLng = L.GeoJSON.coordsToLatLng(turf.getCoord(headPosition));

        // Create marker for trip
        if (!trip.has('marker')) {
            const className = `transit-icon tripId-${tripId} blockId-${blockId}`;
            const size = parseInt(d('marker.size'));
            const html = document.createElement('div');
            const markerLabel = document.createElement('div');
            markerLabel.className = 'marker-label';
            markerLabel.innerText = d('marker.label');
            const markerBox = document.createElement('div');
            markerBox.className = 'marker-box';
            markerBox.style.backgroundColor = d('marker.bgColor');
            markerBox.style.borderWidth = d('marker.borderWidth');
            markerBox.style.borderRadius = d('borderRadius');
            if (isLight(d('marker.bgColor'))) {
                // markerBox.style.filter = 'drop-shadow(0 0 1px rgba(10, 10, 10, 0.5))';
                markerBox.style.borderColor = 'rgba(10, 10, 10, 1)';
                markerLabel.style.color = 'black';
                markerLabel.style.textshadow = '0px 0px 3px white';
            } else {
                // markerBox.style.filter = 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.5))';
                markerBox.style.borderColor = 'rgba(255, 255, 255, 1)';
                markerLabel.style.color = 'white';
                markerLabel.style.textshadow = '0px 0px 3px black';
            }
            html.append(markerLabel);
            html.append(markerBox);
            const icon = L.divIcon({
                className,
                html: html.innerHTML,
                iconSize: [size, size]
            });
            const layer = L.marker(latLng, { icon }).addTo(map);
            trip.set('marker', layer);
            trip.set('markerLabel', $(`.tripId-${tripId} .marker-label`));
        } else {
            if (!map.hasLayer(t('marker'))) {
                t('marker').addTo(map);
            }
            t('marker').setLatLng(latLng);
        }

        const tailMaxLength = 5280;
        const tailLength = minValMax(0, totalLengthTraveled, tailMaxLength);
        if (tailLength > 0) {
            const className = `transit-tail tripId-${tripId} blockId-${blockId}`;
            const shapeLength = t('shape').properties.lengthInFeet;
            const tailHead = Math.min(totalLengthTraveled, shapeLength - 50);
            const tailEnd = Math.max(0, tailHead - tailLength);
            const tailShape = turf.lineSliceAlong(t('shape'), tailEnd, tailHead, { units: 'feet' });
            const tailLatLngs = turf.getCoords(turf.flip(tailShape));
            if (!trip.has('tail')) {
                const tail = L.polyline(tailLatLngs, { color: d('tail.color'), className }).addTo(map);
                trip.set('tail', tail);
            } else {
                trip.get('tail').setLatLngs(tailLatLngs);
            }
        }

        // Rotate marker based on angle formed by head position and prior position
        if (trip.has('priorPosition')) {
            const priorPosition = trip.get('priorPosition');
            const bearing = turf.bearing(headPosition, priorPosition);
            rotate($(`.tripId-${tripId}.transit-icon`), bearing);
        }
        trip.set('priorPosition', headPosition);
    });

    // Delete expired trips from the map
    activeTrips.difference(newActiveTrips).forEach(oldTrip => {
        if (oldTrip.has('marker')) map.removeLayer(oldTrip.get('marker'));
        if (oldTrip.has('tail')) map.removeLayer(oldTrip.get('tail'));
        oldTrip.delete('tail');
        oldTrip.delete('priorPosition');
        activeTrips.delete(oldTrip);
    });
};

function rotate(node, bearing) {
    node.style.transform += 'rotate(' + bearing + 'deg)';
    return node;
}

const pulse = (timestamp) => {
    const deltaMilliseconds = Math.max(0, timestamp - window.startTimestamp);
    const deltaSeconds = (deltaMilliseconds * window.playSpeed) / 1000;
    let newPlayhead = window.startPlayhead + deltaSeconds;
    if (newPlayhead > DAY) {
        newPlayhead = newPlayhead - DAY;
        window.startTimestamp = timestamp;
        window.startPlayhead = newPlayhead;
    }
    render(newPlayhead);
    setPlayhead(newPlayhead);
    if (isPlaying()) {
        window.appAnimation = requestAnimationFrame(pulse);
    }
};
const startPlayback = () => {
    window.appIsPlaying = true;
    window.isScrubbing = false;
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
window.playhead = 12 * 60 * 60;
window.playSpeed = settings.defaultPlaySpeed;
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
const loadingScreen = $('#loading');
const loadProgress = $('#loading-progress');
const progressTrack = $('#progress-track');
const progressBar = $('#progress-bar');
const timeIndicator = $('#time-indicator');
const playButton = $('#play-button');
const playImg = $('#play-button img');
const speedSelector = $('#speed-select');
const styleSelector = $('#style-select');
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
    window.isScrubbing = false;
    if (scrubInterval) {
        clearTimeout(scrubInterval);
    }
    if (wasPlayingEarlier === true && app.isPlaying() === false) {
        wasPlayingEarlier = false;
        app.togglePlay();
    }
    progressTrack.removeEventListener('mousemove', handleScrubTimed, true);
});
playButton.addEventListener('click', () => {
    // $$('.transit-icon').forEach(marker => {
    //     marker.classList.remove('hidden-initially');
    //     marker.style.transition = "none";
    // });
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
app.scrub(window.playhead);
loadingScreen.style.display = 'none';
updateControlBar();
app.setPlayhead(12 * 60 * 60);
app.scrub(window.playhead);
updateControlBar();
function handleScrub(event) {
    window.isScrubbing = true;
    const trackX = progressTrack.getBoundingClientRect().left;
    const ratio = Math.max(0, (event.clientX - trackX)) / progressTrack.offsetWidth;
    const newPlayhead = secondsInDay * ratio;
    app.scrub(newPlayhead);
    updateControlBar(newPlayhead);
}
function handleScrubTimed(event) {
    const trackX = progressTrack.getBoundingClientRect().left;
    const ratio = Math.max(0, (event.clientX - trackX)) / progressTrack.offsetWidth;
    const newPlayhead = secondsInDay * ratio;
    updateControlBar(newPlayhead);
    handleScrub(event);
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

map.on('zoomend', () => {
    console.log(map.getZoom());
    window.redrawAllSpecialLines();
});

let debugTripShape;

window.debugTrip = (tripId) => {
    const trip = getTrip(tripId);
    const shape = trip.get('shape');
    debugTripShape = L.geoJSON(shape, {
        style: () => ({ color: '#FFFFFF', weight: 10 })
    }).addTo(map).getLayers()[0];
    console.log(trip);
};

window.debugTripSlice = (tripId, index) => {
    const trip = getTrip(tripId);
    const shape = trip.get('shape');
    const coords = turf.getCoords(turf.flip(shape));
    const sliced = coords.slice(0, index);
    debugTripShape.setLatLngs(sliced);
    console.log(sliced);
};

const debugSegments = new Set();

window.debugSegment = (tripId, segmentIndex) => {
    const trip = getTrip(tripId);
    const segments = trip.get('segments');
    const currentSegment = segments[segmentIndex];

    const geoLayers = L.geoJSON(currentSegment, {
        style: () => ({ color: randomColor() })
    }).addTo(map);
    const lineLayer = geoLayers.getLayers()[0];

    debugSegments.add(lineLayer);

    console.log({
        trip,
        segments,
        currentSegment,
        geoLayers,
        lineLayer
    });
};

const testShapes = new Map();
const totalWidth = 12;

window.drawSpecialLines = (specialIndex) => {
    if (testShapes.has(specialIndex)) {
        const prior = testShapes.get(specialIndex);
        prior.forEach(layer => map.removeLayer(layer));
        testShapes.delete(specialIndex);
    }
//    if (tolerance === null) {
let tolerance = 1;
        switch (map.getZoom()) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9: tolerance = 1; break;
            case 10: tolerance = 0.01; break;
            case 11: tolerance = 0.001; break;
            case 12: tolerance = 0.0001; break;
            case 13: tolerance = 0.0001; break;
            case 14: tolerance = 0.00001; break;
            case 15: tolerance = 0.00001; break;
            case 16: tolerance = 0.00001; break;
            case 17: tolerance = 0.00001; break;
            case 18: tolerance = 0.00001; break;
            case 19: tolerance = 0.00001; break;
            case 20: tolerance = 0.00001; break;
        }
    //}
    const specialShape = turf.simplify(
        getSpecialShape(specialIndex),
        { tolerance }
    );
    const colors = specialShape.properties.colors;
    const widthPerLine = totalWidth / colors.length;
    const leftShift = (widthPerLine / colors.length) * (colors.length - 1);
    const newShapes = [];
    colors.forEach((color, index) => {
        newShapes.push(L.polyline(
            turf.getCoords(turf.flip(specialShape)),
            { color, weight: widthPerLine, offset: 0 - leftShift + (index * widthPerLine) }
        ).addTo(map));
    });
    testShapes.set(specialIndex, newShapes);
};

window.redrawAllSpecialLines = () => {
    Object.keys(sectionIndex).forEach(section => {
        window.drawSpecialLines(section);
    });
}

window.clearMap = () => {
    document.querySelectorAll('.transit-icon, .transit-tail').forEach(node => node.style.display = 'none');
};

// window.clearMap();
window.redrawAllSpecialLines();

window.dispatchEvent(new CustomEvent('loadFinished'));