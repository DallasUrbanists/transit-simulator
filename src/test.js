import GTFS from "./models/GTFS";
import Route from "./models/Route";
import Trip from "./models/Trip";
import TransitLand from "./providers/TransitLand";


const remoteGTFS = 'https://www.dart.org/transitdata/latest/google_transit.zip';
const gtfs = new GTFS('http://localhost:3000/proxy?url=' + encodeURIComponent(remoteGTFS));
gtfs.download();

// o-9vg-dallasarearapidtransit

// function search() {
//     // Route.findByAgency('o-9vg-dallasarearapidtransit').then(routes => {
//     //     console.log(routes);
//     // //     //routes.forEach(route => Trip.search({ route_onestop_id: route.onestop_id }).then(console.log));
//     // });
//     //TransitLand.searchTrips({ route_onestop_id: 'r-9vg-308' }).then(console.log);
// }

// search();