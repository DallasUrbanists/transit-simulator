import * as turf from '@turf/turf';
import { convert, convertCSVToDictionary, fetchText, sanitize, saniKey, setIfNotHas, absURL } from '../js/utilities.mjs';

const source = absURL('gtfs/DART/stops.txt');
const primaryKey = 'stop_id';
export const stops = await convertCSVToDictionary(source, primaryKey);
stops.forEach((stop, stopId, map) => {
    const f = p => parseFloat(stop.get(p));
    map.set(stopId, turf.point(
        [f('stop_lon'), f('stop_lat')],
        { name: stop.get('stop_name'), description: stop.get('stop_desc') },
        { id: stopId }
    ));
});

const timingSource = absURL('gtfs/DART/stop_times.txt');
const timingArray = convert.csvToArray(await fetchText(timingSource));
const timingColumns = convert.arrayToColumnIndex(timingArray[0]);
const timepoints = timingArray
    .filter(r => sanitize(r[timingColumns.get('timepoint')]) === '1')
    .reduce((map, row) => {
        const c = prop => sanitize(row[timingColumns.get(prop)]);
        const f = prop => parseFloat(c(prop));
        const stop = turf.clone(getStop(c('stop_id')));
        stop.properties = {
            ...stop.properties,
            arrival_time: c('arrival_time'),
            arrival_seconds: convert.timeStringToSeconds(c('arrival_time')),
            departure_time: c('departure_time'),
            departure_seconds: convert.timeStringToSeconds(c('departure_time')),
            sequence: parseInt(c('stop_sequence')),
            distance_in_miles: f('shape_dist_traveled'),
        };
        setIfNotHas(c('trip_id'), turf.featureCollection([]), map).features.push(stop);
        return map;
    }, new Map());

export function getStop(search) {
    if (!search) return undefined;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        return stops.get(saniKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[saniKey(primaryKey)];
    }
    return stops.get(saniKey(search));
}

export function getTimepointsForTrip(search) {
    let found;
    if (!search) return undefined;
    if (search instanceof Map) {
        if (!search.has('trip_id')) return undefined;
        found = timepoints.get(saniKey(search.get('trip_id')));
    } else if (typeof search === 'object') {
        if (!Object.hasOwn(search, 'trip_id')) return undefined;
        found = search[saniKey('trip_id')];
    } else {
        found = timepoints.get(saniKey(search));
    }
    if (typeof found === 'object' && found?.type === 'FeatureCollection') {
        found.features.sort((a, b) => a.properties.arrival_seconds - b.properties.arrival_seconds);
    }
}

console.log(getTimepointsForTrip(8641527));

export function hasStop(search) {
    if (typeof search === 'object') {
        if (search instanceof Map) {
            return search.has(primaryKey) && stops.get(saniKey(search.get(primaryKey)));
        }
        if (!Object.hasOwn(search, primaryKey)) return false;
        return stops.has(saniKey(search[primaryKey]));
    }
    return stops.has(saniKey(search));
}

//console.log(getStop(12920));

console.assert(hasStop('12920'));
console.assert(hasStop(12920));
console.assert(hasStop({ stop_id: 12920 }));

console.assert(!hasStop('12341234'));
console.assert(!hasStop(12341234));
console.assert(!hasStop({ stop_id: 12341234 }));
