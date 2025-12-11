import { convertCSVToDictionary, sanitizeKey } from '../js/utilities.mjs';

const source = '../gtfs/DART/routes.txt';
const primaryKey = 'route_id';

export const routes = await convertCSVToDictionary(source, primaryKey);
const sample = routes.values().next().value;

export function getRoute(search) {
    if (!search) return undefined;
    if (isRouteObject(search)) return search;
    if (search instanceof Map) {
        if (!search.has(primaryKey)) return undefined;
        return routes.get(sanitizeKey(search.get(primaryKey)));
    }
    if (typeof search === 'object') {
        if (!Object.hasOwn(search, primaryKey)) return undefined;
        search = search[sanitizeKey(primaryKey)];
    }
    return routes.get(sanitizeKey(search));
}

export function hasRoute(search) {
    if (typeof search === 'object') {
        if (isRouteObject(search)) return true;
        if (!Object.hasOwn(search, primaryKey)) return false;
        return routes.has(sanitizeKey(search[primaryKey]));
    }
    return routes.has(sanitizeKey(search));
}

export function isRouteObject(subject) {
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

console.assert(isRouteObject(getRoute('26677')));
console.assert(isRouteObject(getRoute(26677)));
console.assert(isRouteObject(getRoute({ route_id: 26677 })));

console.assert(hasRoute('26677'));
console.assert(hasRoute(26677));
console.assert(hasRoute({ route_id: 26677 }));

console.assert(!hasRoute('12341234'));
console.assert(!hasRoute(12341234));
console.assert(!hasRoute({ route_id: 12341234 }));

console.assert(!isRouteObject({ route_id: 26677 }), 'False positive on `isRouteObject`');
console.assert(isRouteObject(getRoute('26677')), 'False negative on `validRouteObject`');