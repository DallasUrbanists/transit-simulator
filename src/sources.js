import { processRoutesFromSource } from "./routes";
import { processSegmentsFromShapes } from "./segments";
import { processShapesFromSource } from "./shapes";
import { processStopsFromSource } from "./stops";
import { processTripsFromSource } from "./trips";

export const agencies = ['DART', 'TrinityMetro', 'DCTA']
export const sources = new Map(agencies.map(agency => [agency, {
    processedRoutes: false,
    processedStops: false,
    processedShapes: false,
    processedTrips: false,
    processedSegments: false
}]));

export async function processSource(agency) {
    const source = sources.get(agency);
    await processRoutesFromSource(agency);
    source.processedRoutes = true;
    await processStopsFromSource(agency);
    source.processedStops = true;
    const shapes = await processShapesFromSource(agency);
    source.processedShapes = true;
    await processTripsFromSource(agency);
    source.processedTrips = true;
    processSegmentsFromShapes(shapes);
    source.processedSegments = true;
    console.log(`Finished processing all GTFS data for ${agency}`);
}