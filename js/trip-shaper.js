import fs from 'fs';
import { parseCSV } from './utilities.js';
import * as turf from '@turf/turf';
import { convert } from './utilities.mjs';

const stopTimesText = await fs.readFileSync('./stop-times-output.json');
const stopTimes = JSON.parse(stopTimesText.toString());
const shapesText = await fs.readFileSync('../gtfs/DART/shapes.txt');
const shapes = parseCSV(shapesText.toString()).slice(1).map(row => ({
    // shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled
    id: parseInt(row[0]),
    lat: parseFloat(row[1]),
    lon: parseFloat(row[2]),
    seq: parseInt(row[3], 10),
}));

const skippedTrips = [];
const tripsText = await fs.readFileSync('../gtfs/DART/trips.txt');
const tripsData = parseCSV(tripsText.toString());
const trips = tripsData.slice(1).map((row, index) => {
    console.clear();
    console.log(`Processing trip ${index + 1} of ${tripsData.length}`);

    const trip_id = parseInt(row[2]);

    if (isNaN(trip_id)) {
        return null;
    }

    const shape_id = parseInt(row[6]);
    const trip_segments = [];
    let timepoints = [];
    let tripDistanceFeet = 0;
    let startSeconds = 0;
    let endSeconds = 0;

    try {
        const stops = stopTimes.filter(st => parseInt(st.trip_id) == trip_id);
        stops.sort((a, b) => a.stop_sequence - b.stop_sequence);
        timepoints = stops.filter(s => s.timepoint === 1);

        const shape = shapes.filter(s => s.id == shape_id);
        shape.sort((a, b) => a.shape_pt_sequence - b.seq);
        const trip_line = turf.lineString(shape.map(s => [s.lon, s.lat]));

        for (let i = 0; i < timepoints.length - 1; i++) {
            const stopA = timepoints[i];
            const stopB = timepoints[i + 1];
            const pointA = turf.point([stopA.stop_lon, stopA.stop_lat]);
            const pointB = turf.point([stopB.stop_lon, stopB.stop_lat]);
            const segment = turf.lineSlice(pointA, pointB, trip_line);
            const distance = turf.length(segment, { units: 'feet' });
            segment.properties.start_time = String(stopA.departure_time);
            segment.properties.end_time = String(stopB.arrival_time);
            segment.properties.distanceFeet = distance;
            segment.properties.startSeconds = convert.timeStringToSeconds(String(stopA.departure_time)),
            segment.properties.endSeconds = convert.timeStringToSeconds(String(stopB.arrival_time)),
            segment.properties.durationSeconds = segment.properties.endSeconds - segment.properties.startSeconds;
            tripDistanceFeet += distance;

            trip_segments.push(structuredClone(segment));
        }

        trip_segments.sort((a, b) => a.properties.start_time.localeCompare(b.properties.start_time));

        startSeconds = convert.timeStringToSeconds(trip_segments[0].properties.start_time);
        endSeconds = convert.timeStringToSeconds(trip_segments[trip_segments.length-1].properties.end_time);

    } catch (e) {
        skippedTrips.push(trip_id);
        console.log(`Error occurred processing Trip #${trip_id}`)
    }


    return {
        route_id: row[0],
        service_id: row[1],
        trip_id: row[2],
        trip_headsign: row[3],
        direction_id: row[4],
        startSeconds,
        endSeconds,
        durationSeconds: Math.abs(endSeconds - startSeconds),
        distanceFeet: tripDistanceFeet,
        trip_segments,
        timepoints
    };
}).filter(t => t !== null);

console.log(`Finished processing ${trips.length} trips`);
console.log(`Skipped ${skippedTrips.length} trips:`, skippedTrips);

const volumeSize = 500;
const volumeCount = Math.ceil(trips.length / volumeSize);

console.log(`Splitting results into ${volumeCount} files of ${volumeSize} trips each.`);

for (let f=0; f<volumeCount; f++) {
    const firstIndex = f * volumeSize;
    const lastIndex = firstIndex + volumeSize;
    const tripsJSON = JSON.stringify(trips.slice(firstIndex, lastIndex), null, 2);
    const filename = `./trips-output-${f}.json`;
    fs.writeFile(filename, tripsJSON, err => {
        if (err) {
            console.error(err);
        } else {
            console.log(`File ${filename} written successfully`);
        }
    });
}