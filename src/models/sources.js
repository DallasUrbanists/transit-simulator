import { dispatch } from "../misc/utilities.mjs";
import Loader from "../widgets/LoaderWidget";
import { processRoutesFromSource } from "./routes";
import { processSegmentsFromShapes } from "./segments";
import { processShapesFromSource } from "./shapes";
import { processStopsFromSource } from "./stops";
import { processTripsFromSource } from "./trips";

export const agencies = new Map([
    ['DART', {
        agency_id: 'DART',
        name: 'Dallas Area Rapid Transit (DART)',
        folder: 'DART',
        logo: 'Dallas Area Rapid Transit.svg',
    }],
    ['Trinity Metro', {
        agency_id: 'Trinity Metro',
        name: 'Trinity Metro',
        folder: 'TrinityMetro',
        logo: 'Trinity Metro.svg',
    }],
    ['581', {
        agency_id: '581',
        name: 'Denton County Transit Authority (DCTA)',
        folder: 'DCTA',
        logo: 'DCTA.svg',
    }],
    ['556', {
        agency_id: '556',
        name: 'STAR Transit',
        folder: 'STAR',
        logo: 'star_transit.jfif',
    }]
]);
export const sources = new Map(agencies.keys().map(agency => [agency, {
    processedRoutes: false,
    processedStops: false,
    processedShapes: false,
    processedTrips: false,
    processedSegments: false
}]));
export async function processSource(agency) {
    const source = sources.get(agency);
    const folder = agencies.get(agency).folder;
    const inprogress = (key) => dispatch(Loader.PROGRESS, { agency_id: agency, key, status: 'inprogress' });
    const finished = (key, count) => dispatch(Loader.PROGRESS, { agency_id: agency, key, status: 'finished', count });
    let shapes, routes, stops, tripCount, segmentCount;

    if (isLoaded(agency)) {
        dispatch(Loader.FINISHED, { agency_id: agency })
    }

    inprogress('routes');
    processRoutesFromSource(folder).then(result => {
        routes = result;
        source.processedRoutes = true;
        finished('routes', routes.size);
        inprogress('stops');
        processStopsFromSource(folder).then(result => {
            stops = result;
            source.processedStops = true;
            finished('stops', stops.size);
            inprogress('shapes');
            processShapesFromSource(folder).then(result => {
                shapes = result;
                source.processedShapes = true;
                finished('shapes', shapes.size);
                inprogress('trips');
                processTripsFromSource(folder).then(result => {
                    tripCount = result;
                    source.processedTrips = true;
                    finished('trips', tripCount);
                    inprogress('segments');
                    processSegmentsFromShapes(shapes).then(result => {
                        segmentCount = result;
                        source.processedSegments = true;
                        finished('segments', segmentCount);
                        dispatch(Loader.FINISHED, { agency_id: agency })
                    });
                });
            });
        });
    });
}

export async function loadAgencies(agencies) {
    for (let agency of Array.from(agencies)) {
        if (isLoaded(agency)) {
            console.log(`Agency ${agency} already fully loaded.`);
        } else {
            await processSource(agency);
        }
    }
}

function isLoaded(agency) {
    const source = sources.get(agency);
    for (let x in source) {
        if (source[x] === false) {
            return false;
        }
    }
    return true;
}

export function isFullyLoaded(agenciesSet) {
    const agenciesAsArray = Array.from(agenciesSet);
    for (let agencyId of agenciesAsArray) {
        if (!isLoaded(agencyId)) {
            return false;
        }
    }
    return true;
}