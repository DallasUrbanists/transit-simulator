import { shapes } from './shapes.js';
import { getTrip, trips } from './trips.js';
import * as turf from '@turf/turf';

export const segments = new Map();
shapes.forEach((value, shapeId) => {
    const shape = turf.clone(value);
    const sampleTrip = trips.values().find(trip => trip.get('shape_id') == shapeId);
    const timepoints = sampleTrip.get('timepoints');
    const shapeSegments = [];

    let subShape1 = shape;
    let subShape2 = shape;
    if (timepoints.length > 2) {
        subShape1 = turf.lineString(turf.getCoords(shape).slice(0, -4));
        subShape2 = turf.lineString(turf.getCoords(shape).slice(4));
    }

    for (let i=0; i<timepoints.length-1; i++) {
        const startPoint = timepoints[i];
        const startSeconds = startPoint.properties.arrival_seconds;
        const endPoint = timepoints[i+1];
        const endSeconds = endPoint.properties.arrival_seconds;
        const segmentShape = turf.lineSlice(
            endPoint,
            startPoint,
            i < 2 ? subShape1 : subShape2
        );
                
        const segmentProperties = {
            sequence: i,
            lengthInFeet: turf.length(segmentShape, { units: 'feet' }),
            startSeconds: startSeconds,
            endSeconds: endSeconds,
            duration: endSeconds - startSeconds,
            startStopName: startPoint.properties.name,
            endStopName: endPoint.properties.name,
        };
        segmentShape.properties = segmentProperties;
        shapeSegments.push(turf.clone(segmentShape));
    }
    segments.set(shapeId, shapeSegments);
});

export function getSegmentsFor(trip) {
    const shapeId = trip.get('shape_id');
    return segments.get(shapeId) ?? [];
}

console.log(getTrip('8666240').get('timepoints').map(({ properties }) => properties));
console.log(segments.get('146079').map(({properties}) => properties));
//console.log(shapes.get('146079'));