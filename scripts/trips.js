import { convertCSVToDictionary, sanitizeKey } from '../js/utilities.mjs';

const source = '../gtfs/DART/trips.txt';
const primaryKey = 'trip_id';

export const trips = await convertCSVToDictionary(source, primaryKey);
const sample = trips.values().next().value;

export function getTrip(search) {
    if (!search) return undefined;
    if (isTripObject(search)) return search;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) {
            return undefined;
        }
        return trips.get(sanitizeKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) {
            return undefined;
        }
        search = search[sanitizeKey(primaryKey)];
    }
    return trips.get(sanitizeKey(search));
}

export function hasTrip(search) {
    if (typeof search === 'object') {
        if (isTripObject(search)) {
            return true;
        }
        if (!Object.hasOwn(search, primaryKey)) {
            return false;
        }
        return trips.has(sanitizeKey(search[primaryKey]));
    }
    return trips.has(sanitizeKey(search));
}

export function isTripObject(subject) {
    if (!typeof subject === 'object') {
        console.log('not object: ' + typeof subject);
        return false;
    }

    if (subject instanceof Map) {
        for (let key of sample.keys()) {
            if (!subject.has(key)) {
                return false;
            }
        }
        return true; 
    }

    for (let key of sample.keys()) {
        if (!Object.hasOwn(subject, key)) {
            return false;
        }
    }
    return true;
}

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