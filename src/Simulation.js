import * as turf from '@turf/turf';
import L from 'leaflet';
import dictionary from './models/dictionary';
import { getSegmentsFor } from "./models/segments";
import { findActiveTrips } from './models/trips';
import { $, DAY, ease, isLight, minValMax } from './misc/utilities.mjs';

export default class Simulation {
    tripCriteria = (trip) => true;

    constructor(map) {
        this.map = map;
    }

    setTripCriteria(callableCriteria) {
        this.tripCriteria = callableCriteria;
    }

    render(playhead) {
        const newActiveTrips = findActiveTrips(playhead, this.tripCriteria);
        newActiveTrips.forEach(trip => {
            this.map.activate(trip);
            const t = key => trip.get(key);
            const tripId = t('trip_id');
            const tripDuration = parseInt(t('durationSeconds'));
            const d = prop => dictionary(trip).get(prop);
            if (!trip.has('segments')) trip.set('segments', getSegmentsFor(trip));
            // How we proceed further depends on whether this is a single day or multi-day trip
            // If it's a single day trip (under 24 hours)...
            if (tripDuration <= DAY) {
                const relativePlayhead = t('startSeconds') + countTripElapsedSeconds(playhead, t('startSeconds'), t('endSeconds'));
                const { headPosition, totalLengthTraveled } = calculateTravelProgressAndPosition(trip, relativePlayhead);
                const latLng = L.GeoJSON.coordsToLatLng(turf.getCoord(headPosition));
                if (d('marker.visible')) {
                    if (!trip.has('marker')) {
                        const { marker, labelSelector } = createTripMarker(trip, latLng);
                        trip.set('marker', marker);
                        trip.set('markerLabel', $(labelSelector));
                    }
                    t('marker').setLatLng(latLng);
                    this.map.addMarker(trip);
                    if (d('marker.rotationEnabled')) {
                        if (trip.has('priorPosition')) {
                            const priorPosition = trip.get('priorPosition');
                            const bearing = turf.bearing(headPosition, priorPosition);
                            $(`.tripId-${tripId}.transit-icon`).style.transform += 'rotate(' + bearing + 'deg)';
                        }
                        trip.set('priorPosition', headPosition);
                    }
                }
                if (d('tail.visible')) {
                    if (!trip.has('tail')) {
                        const tail = createTripTail(trip, totalLengthTraveled);
                        if (tail) {
                            trip.set('tail', tail);
                            this.map.addTail(trip);
                        }
                    } else {
                        const tailLatLngs = calculateTailLatLngs(trip, totalLengthTraveled);
                        trip.get('tail').setLatLngs(tailLatLngs);
                    }
                }
                // If trip takes place across multiple days (greater than 24 hours)...
            } else if (tripDuration > DAY) {
                if (!trip.has('subtrips')) trip.set('subtrips', new Map());
                const subtripCount = Math.ceil(tripDuration / DAY);
                for (let s = 0; s < subtripCount; s++) {
                    if (!t('subtrips').has(s)) {
                        const delta = DAY * s;
                        const startSeconds = t('startSeconds') + delta;
                        const endSeconds = Math.min(startSeconds + DAY, t('endSeconds'));
                        t('subtrips').set(s, {
                            startSeconds,
                            endSeconds,
                            playheadStart: startSeconds - delta,
                            playheadEnd: endSeconds - delta,
                            marker: undefined,
                            tail: undefined,
                            priorPosition: undefined
                        });
                        console.log(t('subtrips').get(s));
                    }
                    const subtrip = t('subtrips').get(s);
                    // Skip this subtrip if it's not currently in service
                    if (subtrip.playheadStart > playhead || subtrip.playheadEnd < playhead) {
                        if (subtrip.marker && this.map.hasLayer(subtrip.marker)) {
                            this.map.removeLayer(subtrip.marker);
                        }
                        continue;
                    }
                    const relativePlayhead = subtrip.startSeconds + countTripElapsedSeconds(playhead, subtrip.startSeconds, subtrip.endSeconds);
                    const { headPosition, totalLengthTraveled } = calculateTravelProgressAndPosition(trip, relativePlayhead);
                    if (d('marker.visible')) {
                        const latLng = L.GeoJSON.coordsToLatLng(turf.getCoord(headPosition));
                        if (!subtrip.marker) {
                            const { marker, labelSelector } = createTripMarker(trip, latLng, `subtrip-${s}`);
                            subtrip.marker = marker;
                            subtrip.markerLabel = $(labelSelector);
                        }
                        subtrip.marker.setLatLng(latLng);
                        subtrip.marker.addTo(this.map);
                        // Rotate marker based on angle formed by head position and prior position
                        if (d('marker.rotationEnabled')) {
                            if (subtrip.priorPosition !== undefined) {
                                const bearing = turf.bearing(headPosition, subtrip.priorPosition);
                                $(`.tripId-${tripId}.transit-icon.subtrip-${s}`).style.transform += 'rotate(' + bearing + 'deg)';
                            }
                            subtrip.priorPosition = headPosition;
                        }
                    }
                    if (d('tail.visible')) {
                        if (!subtrip.tail !== undefined) {
                            const tail = createTripTail(trip, totalLengthTraveled);
                            if (tail) subtrip.tail = tail.addTo(this.map);
                        } else {
                            const tailLatLngs = calculateTailLatLngs(trip, totalLengthTraveled);
                            subtrip.tail.setLatLngs(tailLatLngs);
                        }
                    }
                }
            }
        });

        // Delete expired trips from the this.map
        this.map.activeTrips.difference(newActiveTrips).forEach(oldTrip => {
            this.map.deactivate(oldTrip);
            oldTrip.delete('tail');
            oldTrip.delete('priorPosition');
        });
    };
}

function countTripElapsedSeconds(playhead, tripStartSeconds, tripEndSeconds) {
    let tripElapsed = 0;
    if (tripStartSeconds < DAY && tripEndSeconds < DAY) {
        tripElapsed = playhead - tripStartSeconds;
    } else if (tripStartSeconds > DAY && tripEndSeconds > DAY) {
        tripElapsed = (playhead + DAY) - tripStartSeconds;
    } else if (tripStartSeconds <= DAY && tripEndSeconds >= DAY) {
        tripElapsed = (playhead >= tripStartSeconds)
            ? playhead - tripStartSeconds
            : (DAY - tripStartSeconds) + playhead;
    }
    return tripElapsed;
}

function calculateTravelProgressAndPosition(trip, playhead) {
    const timepoints = trip.get('timepoints');
    const segments = trip.get('segments');

    const finalTimepoint = timepoints[timepoints.length - 1];
    // The "head position" is where we will place the marker
    let headPosition = undefined;
    // We start by assuming the first segment is the current one
    let currentSegmentIndex = 0;
    for (let i = 0; i < timepoints.length - 1; i++) {
        const timepoint = timepoints[i];
        const arrivalSeconds = timepoint.properties.arrival_seconds;
        const departureSeconds = timepoint.properties.departure_seconds;
        // If the trip has already reached the final timepoint
        // then set final timepoint as our head position and end this calculation early
        if (timepoint === finalTimepoint) {
            currentSegmentIndex = i;
            headPosition = finalTimepoint;
            break;
            // If the playhead has arrived at this timepoint...
        } else if (playhead >= arrivalSeconds) {
            // ...then it's a candidate for representing the start of the current segment
            currentSegmentIndex = i;
            // If we have not yet left the station (i.e. the train is still sitting at the station)
            // then this is definitely the current segment AND the trip's current position
            if (playhead <= departureSeconds) {
                headPosition = timepoint;
                break;
            }
            // If we are looking at the first timepoint for this trip and we STILL haven't reached it
            // (despite the trip being active for whatever reason) then default to the first timepoint as our starting position
        } else if (i === 0) {
            headPosition = timepoints[0];
            break;
            // By this point, if we are looking at a timepoint that we haven't reached yet AND it's not the first AND it's not the last
            // then in this case, the prior timepoint definitely represents start of current segment and we can end loop here.
        } else break;
    }

    let segmentTravel = 0;
    if (!headPosition) {
        const segment = segments[currentSegmentIndex];
        const seconds = index => timepoints[index].properties.arrival_seconds;
        const startSeconds = seconds(currentSegmentIndex);
        const endSeconds = seconds(currentSegmentIndex + 1);
        const duration = endSeconds - startSeconds;
        const segmentElapsed = playhead - startSeconds;
        const ratio = Math.min(1, Math.max(0, segmentElapsed / duration));
        const traveled = segment.properties.lengthInFeet * ease.inOutCubic(ratio);
        headPosition = turf.along(segment, traveled, { units: 'feet' });
        segmentTravel = traveled;
    }

    const totalLengthTraveled = segments.slice(0, currentSegmentIndex).reduce(
        (total, { properties }) => total + properties.lengthInFeet, segmentTravel
    );

    return { headPosition, totalLengthTraveled };
}

function createTripMarker(trip, latLng, additionalClassName = '') {
    const d = prop => dictionary(trip).get(prop);
    const className = `transit-icon tripId-${trip.get('trip_id')} blockId-${trip.get('block_id')} ${additionalClassName}`;
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
    const marker = L.marker(latLng, { icon });

    return { marker, labelSelector: `${className} ${markerLabel.className}` };
}

function createTripTail(trip, totalLengthTraveled, additionalClassName) {
    const d = prop => dictionary(trip).get(prop);
    const tailLatLngs = calculateTailLatLngs(trip, totalLengthTraveled);
    if (!tailLatLngs) return undefined;
    const className = `transit-tail tripId-${trip.get('trip_id')} blockId-${trip.get('trip_id')} ${additionalClassName}`;
    return  L.polyline(tailLatLngs, { color: d('tail.color'), className });
}

function calculateTailLatLngs(trip, totalLengthTraveled) {
    const d = prop => dictionary(trip).get(prop);
    const t = key => trip.get(key);
    const tailLength = minValMax(0, totalLengthTraveled, d('tail.length'));
    if (tailLength <= 0) return undefined;
    const shapeLength = trip.get('shape')?.properties?.lengthInFeet;
    if (!shapeLength) return undefined;
    const tailHead = Math.min(totalLengthTraveled, shapeLength - 50);
    const tailEnd = Math.max(0, tailHead - tailLength);
    const tailShape = turf.lineSliceAlong(t('shape'), tailEnd, tailHead, { units: 'feet' });
    return turf.getCoords(turf.flip(tailShape));
}