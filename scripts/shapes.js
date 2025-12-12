import * as turf from '@turf/turf';
import { convert, sanitize, saniKey, fetchText, absURL } from '../js/utilities.mjs';

const source = absURL('gtfs/DART/shapes.txt');
const primaryKey = 'shape_id';
const shapePoints = convert.csvToArray(await fetchText(source));
const columns = convert.arrayToColumnIndex(shapePoints[0]);
console.log(columns);
const shapes = shapePoints.slice(1).reduce((map, row) => {
    const c = prop => sanitize(row[columns.get(prop)]);
    const f = prop => parseFloat(c(prop));
    const shapeId = c(primaryKey);
    if (!map.has(shapeId)) map.set(shapeId, []);
    map.get(shapeId).push({
        lat: f('shape_pt_lat'),
        lon: f('shape_pt_lon'),
        seq: f('shape_pt_sequence'),
        dist: f('shape_dist_traveled')
    });
    return map;
}, new Map());

shapes.forEach((shape, shapeId, map) => {
    shape.sort((a, b) => a.seq - b.seq);
    map.set(shapeId, turf.lineString(
        shape.map(({lon, lat}) => [lon, lat]),
        { length_in_miles: shape.reduce((total, { dist }) => total += dist, 0) }
    ));
});

export function getShape(search) {
    if (!search) return undefined;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        return shapes.get(saniKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[saniKey(primaryKey)];
    }
    const shape = shapes.get(saniKey(search));
    return shape;
}

export function hasShape(search) {
    if (typeof search === 'object') {
        if (search instanceof Map) {
            return search.has(primaryKey) && shapes.has(saniKey(search.get(primaryKey)));
        }
        if (!Object.hasOwn(search, primaryKey)) return false;
        return shapes.has(saniKey(search[primaryKey]));
    }
    return shapes.has(saniKey(search));
}