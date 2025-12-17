import * as turf from '@turf/turf';
import { convert, convertCSVToDictionary, fetchText, sanitize, saniKey, absURL } from './utilities.mjs';

const primaryKey = 'stop_id';
export const stops = new Map();
export const timepoints = new Map();
export async function processStopsFromSource(source) {
    const stopsTxt = await fetchText(absURL(`./gtfs/${source}/stops.txt`));
    const stopsFromSource = await convertCSVToDictionary(stopsTxt, primaryKey);
    stopsFromSource.forEach((stop, stopId) => {
        const f = p => parseFloat(stop.get(p));
        const feature = turf.point(
            [f('stop_lon'), f('stop_lat')],
            { name: stop.get('stop_name'), description: stop.get('stop_desc') },
            { id: stopId }
        );
        stops.set(stopId, feature);
        stopsFromSource.set(stopId, feature);
    });

    const timingSource = absURL(`./gtfs/${source}/stop_times.txt`);
    const timingArray = convert.csvToArray(await fetchText(timingSource));
    const timingColumns = convert.arrayToColumnIndex(timingArray[0]);
    timingArray
        .slice(1)
        .sort((pointA, pointB) => {
            const A = prop => pointA[timingColumns.get(prop)];
            const B = prop => pointB[timingColumns.get(prop)];
            if (A('trip_id') !== B('trip_id')) {
                return A('trip_id').localeCompare(B('trip_id'));
            }
            return parseInt(A('stop_sequence')) - parseInt(B('stop_sequence'));
        })
        .filter(r => sanitize(r[timingColumns.get('timepoint')]) === '1')
        .forEach((row) => {
            let timepoint, tripId, stopObj;
                const c = prop => sanitize(row[timingColumns.get(prop)]);
                const f = prop => parseFloat(c(prop));
                if (!c('stop_id') || c('stop_id') === '') return;
                stopObj = stopsFromSource.get(c('stop_id'));
                timepoint = turf.clone(stopObj);
                if (!timepoint) return;
                tripId = c('trip_id');
                if (!tripId) return;
                timepoint.properties = {
                    ...timepoint.properties,
                    arrival_time: c('arrival_time'),
                    arrival_seconds: convert.timeStringToSeconds(c('arrival_time')),
                    departure_time: c('departure_time'),
                    departure_seconds: convert.timeStringToSeconds(c('departure_time')),
                    sequence: parseInt(c('stop_sequence')),
                    distance_in_miles: f('shape_dist_traveled'),
                };
                if (!timepoints.has(tripId)) {
                    timepoints.set(tripId, [timepoint]);
                } else {
                    const x = timepoints.get(tripId);
                    x.push(timepoint);
                    timepoints.set(tripId, x);
                }

        });
}

/**
 * Retrieve a stop feature from the `stops` dictionary.
 *
 * The `search` parameter may be:
 * - a `Map` (expected to contain `stop_id`),
 * - a plain object with a `stop_id` property, or
 * - a stop identifier (string or number).
 *
 * @param {Map|Object|string|number} search - Stop reference to look up.
 * @returns {Object|undefined} The GeoJSON Feature for the stop, or `undefined` if not found.
 */
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

/**
 * Find timepoint features for a trip and sort them by arrival time.
 *
 * `search` may be a `Map` containing `trip_id`, a plain object with
 * a `trip_id` property, or a trip id (string/number). If a matching
 * FeatureCollection is found it will be sorted in-place by
 * `properties.arrival_seconds`.
 *
 * NOTE: this function performs the sort as a side-effect.
 *
 * @param {Map|Object|string|number} search - Trip reference to look up.
 * @returns {Object|undefined} GeoJSON FeatureCollection of stops for given trip, or `undefined` if none found.
 */
export function getTimepointsForTrip(trip) {
    let tripId;
    if (trip instanceof Map) {
        if (!trip.has('trip_id')) return [];
        tripId = trip.get('trip_id');
    } else if (typeof trip === 'object') {
        if (!Object.hasOwn(trip, 'trip_id')) return [];
        tripId = trip['trip_id'];
    } else if (typeof trip === 'string' || typeof trip === 'number') {
        tripId = saniKey(trip);
    }
    const found = timepoints.get(tripId) ?? [];
    found.sort((a, b) => a.properties.arrival_seconds - b.properties.arrival_seconds);
    return found;
}

/**
 * Determine whether a given stop exists in the `stops` dictionary.
 *
 * Accepts a `Map` (with `stop_id`), a plain object containing
 * `stop_id`, or a stop id (string/number). The function will return
 * the stored stop feature (truthy) for matches or a boolean/undefined
 * value depending on the input form.
 *
 * @param {Map|Object|string|number} search - Stop reference to check.
 * @returns {boolean}
 */
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