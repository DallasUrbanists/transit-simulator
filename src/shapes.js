import * as turf from '@turf/turf';
import { convert, fetchText, saniKey, sanitize } from './utilities.mjs';

const primaryKey = 'shape_id';
const shapesTxt = await fetchText('/gtfs/DART/shapes.txt');
const shapePoints = convert.csvToArray(shapesTxt);
const columns = convert.arrayToColumnIndex(shapePoints[0]);
export const shapes = shapePoints.slice(1).reduce((map, row) => {
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

shapes.forEach((shapePoints, shapeId, map) => {
    shapePoints.sort((a, b) => a.seq - b.seq);
    const shapeFeature = turf.lineString(shapePoints.map(({ lon, lat }) => [lon, lat]));
    shapeFeature.properties.lengthInFeet = turf.length(shapeFeature, { units: 'feet' });
    map.set(shapeId, shapeFeature);
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