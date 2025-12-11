import { getRoute } from "../scripts/routes";
import { getTrip } from "../scripts/trips";

export default function dictionary(subject) {
    const trip = getTrip(subject);
    const route = getRoute(trip ?? subject);

    if (!route) {
        console.log(trip, route);
        throw new Error('Subject is not a valid route, nor is it a valid derivative of a route.');
    }

    return {
        trip,
        route
    };
}

console.log(dictionary(8641525));