import { DAY } from "./misc/utilities.mjs";
import Route from "./models/Route";
import Trip from "./models/Trip";

// Trip.get(['26670', '8641281']).then(trip => {
//     console.log(trip);
//     console.log(trip.isActiveAt(14759));
//     console.log(trip.isActiveAt(14760)); // right at start
//     console.log(trip.isActiveAt(14761));
//     console.log(trip.isActiveAt(16979));
//     console.log(trip.isActiveAt(16980)); // right at end
//     console.log(trip.isActiveAt(16981));
// });

async function main() {
    console.time('DB fetch time');
    const trips = await Trip.all();
    console.timeEnd('DB fetch time');
    console.time('Find active 1');
    Trip.findActiveAmong(14761, 'America/Chicago', trips)
    console.timeEnd('Find active 1');
    console.time('Find active 2');
    Trip.findActiveAmong(0, 'America/Chicago', trips)
    console.timeEnd('Find active 2');
    console.time('Find active 3');
    Trip.findActiveAmong(1, 'America/Chicago', trips)
    console.timeEnd('Find active 3');
    console.time('Find active 4');
    Trip.findActiveAmong(DAY, 'America/Chicago', trips)
    console.timeEnd('Find active 4');
    console.time('Find active 5');
    Trip.findActiveAmong(DAY + 1, 'America/Chicago', trips)
    console.timeEnd('Find active 5');
}

//main();

//Route.get(['DART', '26670']).then(console.log);
import GTFS from "./models/GTFS";

const gtfs = new GTFS('https://www.dart.org/transitdata/latest/google_transit.zip');
//gtfs.download();
gtfs.processSegments();
//gtfs.importFromDatabase();

// console.log(getTimezoneDifference('America/Chicago', 'America/New_York'));
// console.log(getTimezoneDifference('America/Chicago', 'America/New_York'));
// console.log(getTimezoneDifference('America/Chicago', 'America/Chicago'));
// console.log(getTimezoneDifference('America/Chicago', 'America/Chicago'));
// console.log(getTimezoneDifference('America/New_York', 'America/Los_Angeles'));
// console.log(getTimezoneDifference('America/New_York', 'America/Los_Angeles'));

/*
// Determine proxy prefix in a deploy-friendly way:
// - If `VITE_PROXY_URL` is set at build time (Vite), use it.
// - Otherwise use a relative `/proxy` path so the same host will be used in production.
const viteProxy = (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROXY_URL) ? import.meta.env.VITE_PROXY_URL : '';
const PROXY_PREFIX = viteProxy ? viteProxy.replace(/\/$/, '') + '/proxy?url=' : '/proxy?url=';

const gtfs = new GTFS(PROXY_PREFIX + encodeURIComponent(remoteGTFS));
gtfs.download();
*/

// o-9vg-dallasarearapidtransit

// function search() {
//     // Route.findByAgency('o-9vg-dallasarearapidtransit').then(routes => {
//     //     console.log(routes);
//     // //     //routes.forEach(route => Trip.search({ route_onestop_id: route.onestop_id }).then(console.log));
//     // });
//     //TransitLand.searchTrips({ route_onestop_id: 'r-9vg-308' }).then(console.log);
// }

// search();