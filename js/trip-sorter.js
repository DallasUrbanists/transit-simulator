import fs from 'fs';

const serviceHours = 28;
const secondsInDay = 60 * 60 * 24;
const fileCount = 45;
const sortedTrips = Array.from({ length: 24 }, () => []);
let countOvernightTrips = 0;
for (let a = 0; a < fileCount; a++) {
    const filename = `./trips-output-${a}.json`;
    if (!fs.existsSync(filename)) {
        console.log(`Skipping ${filename} does not exist.`);
        continue;
    } else {
        console.log(`Sorting trips found in ${filename}`);
    }
    const tripsJSON = await fs.readFileSync(filename);
    JSON.parse(tripsJSON.toString()).map(trip => {
        const tripRunsOvernight = trip.endSeconds > secondsInDay;
        if (tripRunsOvernight) {
            countOvernightTrips++;
        }
        for (let hour = 0; hour < serviceHours; hour++) {
            const hourStartSeconds = hour * 60 * 60;
            const hourEndSeconds = hourStartSeconds + 60 * 60;
            const tripStartsAfterHourStarts = trip.startSeconds > hourStartSeconds;
            const tripStartsBeforeHourEnds = trip.startSeconds < hourEndSeconds;
            const tripEndsAfterHourStarts = trip.endSeconds > hourStartSeconds;
            const tripEndsBeforeHourEnds = trip.endSeconds < hourEndSeconds;
            const tripStartsBeforeHourStarts = trip.startSeconds < hourStartSeconds;
            const tripEndsAfterHourEnds = trip.endSeconds > hourEndSeconds;
            if (
                (tripStartsAfterHourStarts && tripStartsBeforeHourEnds) ||
                (tripEndsAfterHourStarts && tripEndsBeforeHourEnds) ||
                (tripStartsBeforeHourStarts && tripEndsAfterHourEnds)
            ) {
                let pushHour = hour < 24 ? hour : hour - 24;
                sortedTrips[pushHour].push({
                    trip_id: trip.trip_id,
                    startSeconds: trip.startSeconds,
                    endSeconds: trip.endSeconds
                });
            }
        }
    });
    console.log(`Finished sorting ${filename} trips`);
}
for (let hour = 0; hour < 24; hour++) {
    console.log(`Hour ${hour} has ${sortedTrips[hour].length} active trips.`);
}
console.log(`Found ${countOvernightTrips} overnight trips.`);
const sortedTripsJSON = JSON.stringify(sortedTrips, null, 2);
fs.writeFile('./trips-sorted-output.json', sortedTripsJSON, err => {
    if (err) {
        console.error(err);
    } else {
        console.log('File `./trips-sorted-output.json` written successfully');
    }
});