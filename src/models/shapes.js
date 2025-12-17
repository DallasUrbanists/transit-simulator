import * as turf from '@turf/turf';
import { convert, fetchText, saniKey, sanitize, absURL } from '../misc/utilities.mjs';

const primaryKey = 'shape_id';
export const shapes = new Map();
export async function processShapesFromSource(source) {
    const shapesTxt = await fetchText(absURL(`./gtfs/${source}/shapes.txt`));
    const shapePoints = convert.csvToArray(shapesTxt);
    const columns = convert.arrayToColumnIndex(shapePoints[0]);
    const sourcedShapes = new Map();
    const sourcedShapePoints = shapePoints.slice(1).reduce((map, row) => {
        const c = prop => sanitize(row[columns.get(prop)]);
        const f = prop => parseFloat(c(prop));
        const shapeId = c(primaryKey);
        if (!shapeId || shapeId === '') return undefined;
        if (!map.has(shapeId)) map.set(shapeId, []);
        map.get(shapeId).push({
            lat: f('shape_pt_lat'),
            lon: f('shape_pt_lon'),
            seq: f('shape_pt_sequence'),
            dist: f('shape_dist_traveled')
        });
        return map;
    }, new Map());

    sourcedShapePoints.forEach((shapePoints, shapeId) => {
        if (!shapePoints) return;
        shapePoints.sort((a, b) => a.seq - b.seq);
        let latLngs, shapeFeature;
        latLngs = shapePoints.map(({ lon, lat }) => [lon, lat]);
        shapeFeature = turf.lineString(latLngs);
        shapeFeature.properties.lengthInFeet = turf.length(shapeFeature, { units: 'feet' });
        shapes.set(shapeId, shapeFeature);
        sourcedShapes.set(shapeId, shapeFeature);
    });

    return sourcedShapes;
}

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