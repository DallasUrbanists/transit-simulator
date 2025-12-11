import { getRoute } from "./routes.js";
import { getTrip } from "./trips.js";
import overrides from "../config/overrides.json" with { type: "json" };

const fallback = {
    label: (route, trip) => trip
        ? `${trip.get('trip_headsign')}, ${route.get('route_long_name')}`
        : `${route.get('route_short_name')} ${route.get('route_long_name')}`
    ,
    marker: {
        size: 24,
        bgImage: 'none',
        bgColor: 'black',
        textColor: 'white',
        textSize: 12,
        borderColor: 'transparent',
        borderWeight: 0,
        shadowColor: 'transparent',
        cornerRadius: '50%',
        label: (route, trip) => trip
            ? trip.get('trip_headsign')
            : route.get('route_short_name'),
    },
    tail: {
        weight: 3,
        color: 'black',
        shadowColor: 'transparent'
    }
};

export default function dictionary(subject) {
    const trip = getTrip(subject);
    const route = getRoute(trip ?? subject);

    if (route === undefined) throw new Error(
        'Subject is not a valid route, nor is it a valid derivative of a route.'
    );

    return {
        trip,
        route,
        get: (pathString) => assess(pathString, route, trip)
    };
}

function callOrUse(outcome, route, trip) {
    if (typeof outcome === 'function') {
        return outcome(route, trip);
    }
    return outcome;
}

function assess(pathString, route, trip = undefined) {
    if (trip) {
        const overTripId = overrides.tripsById[trip.get('trip_id')] ?? {};
        const overTripValue = traverse(pathString, overTripId);
        if (overTripValue) return callOrUse(overTripValue, route, trip);

        const tripValue = traverse(pathString, trip);
        if (tripValue) return callOrUse(tripValue, route, trip);
    }

    const overRouteId = overrides.routesById[route.get('route_id')];
    const overRouteValue = traverse(pathString, overRouteId);
    if (overRouteValue) return callOrUse(overRouteValue, route, trip);

    const routeValue = traverse(pathString, route);
    if (routeValue) return callOrUse(routeValue, route);

    let finalAnswer = traverse(pathString, fallback);

    switch (pathString) {
        case 'marker.bgColor':
            finalAnswer = route.get('route_color') ?? defaultVal;
            break;
        case 'marker.textColor':
            finalAnswer = route.get('route_text_color') ?? defaultVal
            break;
    }

    return callOrUse(finalAnswer, route, trip);
}

function traverse(pathString, object) {
    if (object instanceof Map && object.has(pathString)) {
        return object.get(pathString);
    }

    if (Object.hasOwn(object, pathString)) {
        return object[pathString];
    }

    if (typeof object !== 'object') {
        return undefined;
    }

    return pathString.split('.').reduce((a, b) => {
        if (typeof a === 'object' && Object.hasOwn(a, b)) {
            return a[b];
        }
        return undefined;
    }, object);
}

//console.log(dictionary('26670'));
//console.log(dictionary(getTrip('8641525')));

//console.log(overrides.routesById['26670']);
const trip = getTrip(8641525);
const route = getRoute(trip);

console.log(dictionary(route).get('label'));
console.log(dictionary(route).get('route_type'));
// console.log(assess('marker.bgColor', route, trip));
// console.log(assess('label', route, trip));
// console.log(assess('marker.label', route, trip));
// console.log(assess('marker.label', route));