import Route from "./models/Route";
import Trip from "./models/Trip";

Trip.get(['26670', '8641281']).then(console.log);
Route.get(['DART', '26670']).then(console.log);
/*import GTFS from "./models/GTFS";

const proxyBase = import.meta.env.VITE_BASE_URL + 'proxy?url=';
const remoteGTFS = 'https://www.dart.org/transitdata/latest/google_transit.zip';

const gtfs = new GTFS(proxyBase + encodeURIComponent(remoteGTFS));
gtfs.download(true);*/

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