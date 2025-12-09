import fs from 'fs';
import { parseCSV } from './utilities.js';

const stopsText = await fs.readFileSync('../gtfs/DART/stops.txt');
const stops = parseCSV(stopsText.toString()).slice(1).map(row => ({
    //stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,zone_id,stop_url,wheelchair_boarding
    stop_id: row[0],
    stop_code: row[1],
    stop_name: row[2],
    stop_lat: row[4],
    stop_lon: row[5],
}));

const stopTimesText = await fs.readFileSync('../gtfs/DART/stop_times.txt');
const stopTimeData = parseCSV(stopTimesText.toString()).slice(1);
console.log(`Begin processing ${stopTimeData.length} stop times.`);
const stopTimes = stopTimeData.map((row, index) => {
    console.clear();
    console.log(`Processing stop times: ${Math.round(((index + 1) / stopTimeData.length) * 100)}%`);
    const stop_id = row[3];
    const stop = stops.find(s => s.stop_id === stop_id);
    if (!stop) {
        console.log(`Could not find Stop ID ${stop_id}. Skipping`);
        return null;
    }
    return {
        // trip_id,arrival_time,departure_time,stop_id,stop_sequence,stop_headsign,pickup_type,drop_off_type,shape_dist_traveled,timepoint
        trip_id: row[0],
        arrival_time: row[1],
        departure_time: row[2],
        stop_id,
        stop_sequence: row[4],
        stop_headsign: row[5],
        pickup_type: row[6],
        drop_off_type: row[7],
        shape_dist_traveled: row[8],
        timepoint: parseInt(row[9]),
        stop_lat: stop.stop_lat,
        stop_lon: stop.stop_lon
    };
}).filter(st => st !== null);

console.log(`Finished processing ${stopTimes.length} trips`);

const jsonString = JSON.stringify(stopTimes);
fs.writeFile('./stop-times-output.json', jsonString, err => {
    if (err) {
        console.error(err);
    } else {
        console.log('File `./stop-times-output.json` written successfully');
    }
});