import { processRoutesFromSource } from "./routes";
import { processSegmentsFromShapes } from "./segments";
import { processShapesFromSource } from "./shapes";
import { processStopsFromSource } from "./stops";
import { processTripsFromSource } from "./trips";

export const agencies = ['DART', 'TrinityMetro', 'DCTA', 'Amtrak', 'AmtrakTexas'];
export const sources = new Map(agencies.map(agency => [agency, {
    processedRoutes: false,
    processedStops: false,
    processedShapes: false,
    processedTrips: false,
    processedSegments: false
}]));

export async function processSource(agency) {
    const source = sources.get(agency);
    console.log(`Processing routes from ${agency}`);
    await processRoutesFromSource(agency);
    source.processedRoutes = true;
    console.log(`Processing stops from ${agency}`);
    await processStopsFromSource(agency);
    source.processedStops = true;
    console.log(`Processing shapes from ${agency}`);
    const shapes = await processShapesFromSource(agency);
    source.processedShapes = true;
    console.log(`Processing trips from ${agency}`);
    await processTripsFromSource(agency);
    source.processedTrips = true;
    console.log(`Processing segments from ${agency}`);
    processSegmentsFromShapes(shapes);
    source.processedSegments = true;
    console.log(`Finished processing all GTFS data for ${agency}`);
}

export async function loadAgencies(agencies) {
    for (let agency of agencies) {
        await processSource(agency);
    }
}

function isLoaded(agency) {
    const source = sources.get('agency');
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