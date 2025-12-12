import { absURL, convert, convertCSVToDictionary, saniKey, setIfNotHas } from '../js/utilities.mjs';
import { getShape } from './shapes.js';
import { getTimepointsForTrip } from './stops.js';

console.time('Round 1');

const source = absURL('gtfs/DART/trips.txt');
const primaryKey = 'trip_id';
const trips = await convertCSVToDictionary(source, primaryKey);

export function getTrip(search) {
    if (!search) return undefined;
    if (isTripObject(search)) return search;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        return trips.get(saniKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[saniKey(primaryKey)];
    }
    const trip = trips.get(saniKey(search));
    if (trip === undefined) return undefined;
    setIfNotHas('shape', getShape(trip), trip);
    setIfNotHas('timepoints', getTimepointsForTrip(trip), trip);
    return trip;
}

export function findActiveTrips(playhead, additionalFilters) {
    return Array.from(trips.values().filter(trip => {
        const isActive = trip.get('startSeconds') >= playhead && trip.get('endSeconds') <= playhead;
        return typeof additionalFilters === 'function'
            ? isActive && additionalFilters(trip)
            : isActive;
    }));
}

console.log(
    'active trips',
    findActiveTrips(convert.timeStringToSeconds('12:12:12'))
);
///console.log(findActiveTrips(convert.timeStringToSeconds('12:12:12')));

export function hasTrip(search) {
    if (typeof search === 'object') {
        if (isTripObject(search)) return true;
        if (!Object.hasOwn(search, primaryKey)) return false;
        return trips.has(saniKey(search[primaryKey]));
    }
    return trips.has(saniKey(search));
}

export function isTripObject(subject) {
    if (!typeof subject === 'object')return false;
    const sample = trips.values().next().value;
    if (subject instanceof Map) {
        for (let key of sample.keys()) {
            if (!subject.has(key)) return false;
        }
        return true; 
    }
    for (let key of sample.keys()) {
        if (!Object.hasOwn(subject, key)) return false;
    }
    return true;
}

console.log('Total Trips', trips.size);
console.timeEnd('Round 1');

console.time('Round 2');
trips.forEach(trip => getTrip(trip));
console.timeEnd('Round 2');

console.log(getTrip('8641525'));

console.assert(isTripObject(getTrip('8641525')));
console.assert(isTripObject(getTrip(8641525)));
console.assert(isTripObject(getTrip({ trip_id: 8641525 })));

console.assert(hasTrip('8641525'));
console.assert(hasTrip(8641525));
console.assert(hasTrip({ trip_id: 8641525 }));

console.assert(!hasTrip('12341234'));
console.assert(!hasTrip(12341234));
console.assert(!hasTrip({ trip_id: 12341234 }));

console.assert(!isTripObject({ trip_id: 8641525 }), 'False positive on `isTripObject`');
console.assert(isTripObject(getTrip('8641525')), 'False negative on `validTripObject`');