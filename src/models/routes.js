import { absURL, convert, convertCSVToDictionary, fetchText, saniKey } from '../misc/utilities.mjs';

const primaryKey = 'route_id';
export const routes = new Map();

export async function processRoutesFromSource(source) {
    const routesTxt = await fetchText(absURL(`./gtfs/${source}/routes.txt`));
    const routesFromSource = await convertCSVToDictionary(routesTxt, primaryKey);
    routesFromSource.forEach((route, routeId) => routes.set(routeId, route));
    console.log(`Total routes from ${source}: ${routesFromSource.size}`);
    return routesFromSource;
}

export function getRoute(search) {
    if (!search) return undefined;
    if (isRouteObject(search)) return search;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        return routes.get(saniKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[saniKey(primaryKey)];
    }
    return routes.get(saniKey(search));
}

export function hasRoute(search) {
    if (typeof search === 'object') {
        if (isRouteObject(search)) return true;
        if (!Object.hasOwn(search, primaryKey)) return false;
        return routes.has(saniKey(search[primaryKey]));
    }
    return routes.has(saniKey(search));
}

export function isRouteObject(subject) {
    const sample = routes.values().next().value;
    if (!typeof subject === 'object') return false;
    if (subject instanceof Map) {
        for (let key of sample.keys()) {
            if (!subject.has(key)) return false;
        }
        return true; 
    }

    for (let key of sample.keys()) {
        if (!Object.hasOwn(subject, key)) return false;
    }
    return true;
}

/*console.assert(isRouteObject(getRoute('26677')));
console.assert(isRouteObject(getRoute(26677)));
console.assert(isRouteObject(getRoute({ route_id: 26677 })));

console.assert(hasRoute('26677'));
console.assert(hasRoute(26677));
console.assert(hasRoute({ route_id: 26677 }));

console.assert(!hasRoute('12341234'));
console.assert(!hasRoute(12341234));
console.assert(!hasRoute({ route_id: 12341234 }));

console.assert(!isRouteObject({ route_id: 26677 }), 'False positive on `isRouteObject`');
console.assert(isRouteObject(getRoute('26677')), 'False negative on `validRouteObject`');*/