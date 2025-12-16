import * as turf from '@turf/turf';
import L from 'leaflet';
import dictionary from './dictionary';
import { getSegmentsFor } from "./segments";
import { findActiveTrips } from './trips';
import { $, DAY, ease, isLight, minValMax } from './utilities.mjs';

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
                tripElapsed = playhead - startSeconds;
            } else if (startSeconds > DAY && endSeconds > DAY) {
                tripElapsed = (playhead + DAY) - startSeconds;
            } else if (startSeconds <= DAY && endSeconds >= DAY) {
                tripElapsed = (playhead >= startSeconds)
                    ? playhead - startSeconds
                    : (DAY - startSeconds) + playhead;
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
            for (let i = 0; i < timepoints.length - 1; i++) {
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
                } else break;
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
            const totalLengthTraveled = t('segments').slice(0, currentSegmentIndex).reduce(
                (total, { properties }) => total + properties.lengthInFeet, segmentTravel
            );

            // Convert from LngLat (what turf uses) to LatLng (what Leaflet uses)
            const latLng = L.GeoJSON.coordsToLatLng(turf.getCoord(headPosition));

            // Create marker for trip
            if (d('marker.visible')) {
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
                    const layer = L.marker(latLng, { icon });
                    this.map.addMarker(trip);
                    trip.set('marker', layer);
                    trip.set('markerLabel', $(`.tripId-${tripId} .marker-label`));
                } else {
                    this.map.addMarker(trip);
                    t('marker').setLatLng(latLng);
                }
            }

            if (d('tail.visible')) {
                const tailLength = minValMax(0, totalLengthTraveled, d('tail.length'));
                if (tailLength > 0) {
                    const className = `transit-tail tripId-${tripId} blockId-${blockId}`;
                    const shapeLength = t('shape')?.properties?.lengthInFeet;
                    if (shapeLength) {
                        const tailHead = Math.min(totalLengthTraveled, shapeLength - 50);
                        const tailEnd = Math.max(0, tailHead - tailLength);
                        const tailShape = turf.lineSliceAlong(t('shape'), tailEnd, tailHead, { units: 'feet' });
                        const tailLatLngs = turf.getCoords(turf.flip(tailShape));
                        if (!trip.has('tail')) {
                            trip.set('tail', L.polyline(tailLatLngs, { color: d('tail.color'), className }));
                            this.map.addTail(trip);
                        } else {
                            trip.get('tail').setLatLngs(tailLatLngs);
                        }
                    }
                }
            }

            // Rotate marker based on angle formed by head position and prior position
            if (d('marker.rotationEnabled')) {
                if (trip.has('priorPosition')) {
                    const priorPosition = trip.get('priorPosition');
                    const bearing = turf.bearing(headPosition, priorPosition);
                    $(`.tripId-${tripId}.transit-icon`).style.transform += 'rotate(' + bearing + 'deg)';
                }
                trip.set('priorPosition', headPosition);
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