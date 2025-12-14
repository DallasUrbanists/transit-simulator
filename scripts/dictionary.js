import { getRoute } from "./routes.js";
import { getTrip } from "./trips.js";
import overrides from "../config/overrides.json" with { type: "json" };
import { convert } from "../js/utilities.mjs";

const defaults = {
    label: (route, trip) => trip
        ? `${trip.get('trip_headsign')}, ${route.get('route_long_name')}`
        : `${route.get('route_short_name')} ${route.get('route_long_name')}`
    ,
    marker: {
        size: 24,
        bgImage: 'none',
        bgColor: (route) => route.has('route_color') ? '#'+route.get('route_color') : '#000000',
        textColor: (route) => route.get('route_text_color') ?? '#FFFFFF',
        textSize: 12,
        borderColor: '#000000',
        borderWeight: 1,
        cornerRadius: '50%',
        label: (route, trip) => trip
            ? trip.get('trip_headsign')
            : route.get('route_short_name'),
    },
    tail: {
        weight: 3,
        color: (route) => route.has('route_color') ? '#'+route.get('route_color') : '#000000',
        shadowColor: 'transparent',
        length: convert.milesToFeet(0.5)
    }
};

export default function dictionary(subject) {
    const trip = getTrip(subject);
    const route = getRoute(trip ?? subject);
    if (route === undefined) throw new Error(
        'Subject is not a valid route, nor is it a valid derivative of a route.'
    );
    return { trip, route, get: (pathString) => assess(pathString, route, trip) };
}

function callOrUse(outcome, route, trip) {
    return typeof outcome === 'function' ? outcome(route, trip) : outcome;
}

function assess(pathString, route, trip = undefined) {
    const answer = value => callOrUse(value, route, trip);

    // If a trip has been provided, let's look for trip-specific overrides and details
    if (trip) {
        // Look for overrides targeting this particular trip id
        const overTripId = overrides.tripsById[trip.get('trip_id')] ?? {};
        const overTripValue = traverse(pathString, overTripId);
        if (overTripValue) return answer(overTripValue);

        // Look for matching properties on the trip object itself
        const tripValue = traverse(pathString, trip);
        if (tripValue) return answer(tripValue);
    }

    // Look for overrides this particular route id
    const overRouteId = overrides.routesById[route.get('route_id')];
    const overRouteValue = traverse(pathString, overRouteId);
    if (overRouteValue) return answer(overRouteValue);

    // Look for matching properties on the route object itself
    const routeValue = traverse(pathString, route);
    if (routeValue) return answer(routeValue);

    // Since we did not find any customizations, let's fall back to default values
    return answer(traverse(pathString, defaults));
}

function traverse(pathString, object) {
    if (!object) return object;
    if (object instanceof Map && object.has(pathString)) return object.get(pathString);
    if (Object.hasOwn(object, pathString)) return object[pathString];
    if (typeof object !== 'object') return undefined;
    return pathString.split('.').reduce((a, b) =>
        typeof a === 'object' && Object.hasOwn(a, b) ? a[b] : undefined
    , object);
}