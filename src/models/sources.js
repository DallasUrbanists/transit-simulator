import { processRoutesFromSource } from "./routes";
import { processSegmentsFromShapes } from "./segments";
import { processShapesFromSource } from "./shapes";
import { processStopsFromSource } from "./stops";
import { processTripsFromSource } from "./trips";

export const agencies = new Map([
    ['DART', { agency_id: 'DART', name: 'Dallas Area Rapid Transit (DART)', folder: 'DART' } ],
    ['Trinity Metro', { agency_id: 'Trinity Metro', name: 'Trinity Metro', folder: 'TrinityMetro' }],
    ['581', { agency_id: '581', name: 'Denton Country Transit Authority (DCTA)', folder: 'DCTA' } ],
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
    let shapes;
    if (!source.processedRoutes) {
        console.log(`Processing routes from ${agency}`);
        await processRoutesFromSource(folder);
        source.processedRoutes = true;
    }
    if (!source.processedStops) {
        console.log(`Processing stops from ${agency}`);
        await processStopsFromSource(folder);
        source.processedStops = true;
    }
    if (!source.processedShapes) {
        console.log(`Processing shapes from ${agency}`);
        shapes = await processShapesFromSource(folder);
        source.processedShapes = true;
    }
    if (!source.processedTrips) {
        console.log(`Processing trips from ${agency}`);
        await processTripsFromSource(folder);
        source.processedTrips = true;
    }
    if (!source.processedSegments) {
        console.log(`Processing segments from ${agency}`);
        processSegmentsFromShapes(shapes);
        source.processedSegments = true;
    }
    console.log(`Finished processing all GTFS data for ${agency}`);
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

export function isFullyLoaded() {
    const sourcesAsArray = Array.from(sources.values());
    for (let i = 0; i < sources.size; i++) {
        for (let x in sourcesAsArray[i]) {            
            if (sourcesAsArray[i][x] === false) {
                return false;
            }
        }
    }
    return true;
}