import { absURL, convert, convertCSVToDictionary, saniKey, setIfNotHas as setIfNotHave } from './utilities.mjs';
import { getShape } from './shapes.js';
import { getTimepointsForTrip } from './stops.js';
import * as turf from '@turf/turf';
const source = absURL('gtfs/DART/trips.txt');
const primaryKey = 'trip_id';
const tripBlocks = new Map();
export const trips = await convertCSVToDictionary(source, primaryKey, (trip) => {
    if (trip === undefined) return undefined;
    const t = key => trip.get(key);
    if (t(primaryKey) === '') return undefined;
    const set = (key, value) => setIfNotHave(key, value, trip);
    const timepoints = getTimepointsForTrip(trip);
    set('shape', getShape(trip));
    set('timepoints', timepoints);
    const points = t('timepoints');
    set('startPosition', points[0]);
    set('startSeconds', t('startPosition').properties.arrival_seconds);
    set('endPosition', points[points.length - 1]);
    set('endSeconds', t('endPosition').properties.arrival_seconds);
    set('durationSeconds', t('endSeconds') - t('startSeconds'));
    set('isFinal', true);
    if (!tripBlocks.has(t('block_id'))) {
        tripBlocks.set(t('block_id'), new Set());
    }
    const tripBlock = tripBlocks.get(t('block_id'));
    tripBlock.values().forEach(otherTrip => otherTrip.set('isFinal', false));
    tripBlock.add(trip);
    return trip;
});

export function getTrip(search) {
    let trip;
    if (!search) return undefined;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        trip = trips.get(saniKey(search.get(primaryKey)));
    } else if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[saniKey(primaryKey)];
    }
    trip = trips.get(saniKey(search));
    return trip;
}

export function searchTrips(query) {
    return trips.values().filter(trip => query(trip));
}

export function getTripsInSameBlock(trip) {
    return tripBlocks.get(trip.get('block_id')) ?? new Set();
}

export function getTripSegments(trip) {
    const timeSegments = [];
    const timepoints = trip.get('timepoints');
    for (let i = 0; i < timepoints.length - 1; i++) {
        const thisPoint = timepoints[i];
        const nextPoint = timepoints[i + 1];
        const shape = turf.lineSlice(thisPoint, nextPoint, trip.get('shape'));
        const startSeconds = thisPoint.properties.arrival_seconds;
        const endSeconds = nextPoint.properties.arrival_seconds;
        const durationSeconds = endSeconds - startSeconds;
        const lengthInFeet = turf.length(shape, { units: 'feet' });
        timeSegments.push({
            startSeconds,
            endSeconds,
            durationSeconds,
            shape,
            lengthInFeet
        });
    }
    return timeSegments;
}
export function findActiveTrips(playhead, filters) {
    const results = new Set();
    trips.forEach(trip => {
        if (!trip) return;
        const t = key => trip.get(key);
        const isActive = t('startSeconds') <= playhead && t('endSeconds') >= playhead;
        const qualifies = typeof filters !== 'function' ? true : filters(trip);
        if (qualifies) {
            if (isActive) {
                results.add(trip);
                return;
            }
            // Accommodate the possibility of overnight trips
            const day = convert.daysToSeconds(1);
            const altPlayhead = playhead > day ? playhead - day : playhead + day;
            const altIsActive = t('startSeconds') <= altPlayhead && t('endSeconds') >= altPlayhead;
            if (altIsActive) {
                results.add(trip);
            }
        }
    });
    return results;
}
export function hasTrip(search) {
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return false;
        return trips.has(saniKey(search[primaryKey]));
    }
    return trips.has(saniKey(search));
}
