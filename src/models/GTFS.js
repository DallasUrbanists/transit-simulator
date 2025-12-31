import * as turf from "@turf/turf";
import * as zip from "@zip.js/zip.js";
import axios from "axios";
import { db } from "../db";
import { convert, convertCSVToDictionary, proxyURL, sanitize } from "../misc/utilities.mjs";
import Route from "./Route";
import Shape from "./Shape";
import Trip from "./Trip";
import Stop from "./Stop";
import Agency from "./Agency";

// Add a table to store feed metadata so we can detect unchanged feeds
db.version(1).stores({ feedMetadata: '&url,hash,lastFetched' });

export default class GTFS {
    agencies = new Map();
    routes = new Map();
    shapes = new Map();
    trips = new Map();
    stops = new Map();
    stopTimes = [];
    files = {
        agency: { filename: 'agency.txt', parse: txt => this.parseAgency(txt), isDownloaded: false },
        routes: { filename: 'routes.txt', parse: txt => this.parseRoutes(txt), isDownloaded: false },
        trips: { filename: 'trips.txt', parse: txt => this.parseTrips(txt), isDownloaded: false },
        shapes: { filename: 'shapes.txt', parse: txt => this.parseShapes(txt), isDownloaded: false },
        stops: { filename: 'stops.txt', parse: txt => this.parseStops(txt), isDownloaded: false },
        stop_times: { filename: 'stop_times.txt', parse: txt => this.parseStopTimes(txt), isDownloaded: false },
    };

    constructor(url) {
        this.url = url;
    }

    async download(forceDownload = false) {
        console.log(`GTFS.download: starting fetch for ${this.url}`);
        const response = await axios.get(proxyURL(this.url), {
            responseType: 'blob',
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
            }
        }).catch(e => { console.error(e); return null; });
        if (!response || !response.data) {
            console.log(`GTFS.download: no response data for ${this.url}`);
            return;
        }

        // compute SHA-256 of the zip contents to detect changes
        const arrayBuffer = await response.data.arrayBuffer();
        console.log(`GTFS.download: fetched ${arrayBuffer.byteLength} bytes from ${this.url}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        console.log(`GTFS.download: computed hash ${hashHex}`);

        const existing = await db.feedMetadata.get(this.url);
        if (!forceDownload && existing && existing.hash === hashHex) {
            console.log(`GTFS: no changes for ${this.url} (hash ${hashHex}), skipping parse.`);
            await db.feedMetadata.put({ url: this.url, hash: hashHex, lastFetched: Date.now() });
            return;
        }

        // create a Blob from the arrayBuffer (useful if the original blob is mutable)
        const blob = new Blob([arrayBuffer]);
        const reader = new zip.ZipReader(new zip.BlobReader(blob));
        const entries = await reader.getEntries();
        console.log(`GTFS.download: zip contains ${entries.length} entries`);

        // reset downloaded flags
        Object.values(this.files).forEach(f => f.isDownloaded = false);

        // parse downloaded files from zip
        Object.values(this.files).forEach(({ filename, parse }) => {
            const entry = entries.find(entry => entry && entry.filename === filename);
            if (!entry) {
                console.log(`GTFS.download: missing ${filename} in zip`);
                // mark missing files so allFilesDownloaded can still progress
                const target = Object.values(this.files).find(f => f.filename === filename);
                if (target) target.isDownloaded = true;
                return;
            }
            console.log(`GTFS.download: found ${filename}, reading...`);
            entry.getData(new zip.TextWriter()).then(async text => {
                try {
                    parse(text);
                    console.log(`GTFS.download: parsed ${filename}`);
                } catch (err) {
                    console.error(`GTFS.download: parse error for ${filename}`, err);
                }
                if (this.allFilesDownloaded()) {
                    try { await reader.close(); } catch (e) { }
                    console.log('GTFS.download: all files downloaded, running postDownloadParse');
                    this.postDownloadParse();
                    // update metadata after successful parse/save
                    await db.feedMetadata.put({ url: this.url, hash: hashHex, lastFetched: Date.now() });
                    console.log(`GTFS.download: updated feedMetadata for ${this.url}`);
                }
            }).catch(err => {
                console.error('error reading entry', filename, err);
            });
        });
    }

    async importFromDatabase() {
        this.agencies = await Agency.find({ 'gtfs_feed_url': this.url }, 'map');
        for (let agency of this.agencies.values()) {
            this.routes = await Route.find({ 'agency_id': agency.agency_id }, 'map');
            this.trips = await Trip.find({ 'agency_id': agency.agency_id }, 'map');
            this.shapes = await Shape.find({ 'agency_id': agency.agency_id }, 'map');
            this.stops = await Stop.find({ 'agency_id': agency.agency_id }, 'map');
        }
        console.log('imported');
        //return Object.values(this.files).reduce((prev, curr) => prev && curr.isDownloaded, true);
    }

    allFilesDownloaded() {
        return Object.values(this.files).reduce((prev, curr) => prev && curr.isDownloaded, true);
    }

    parseAgency(text) {
        console.log('parseAgency: start');
        convertCSVToDictionary(text, 'agency_id').forEach((data, agency_id) => {
            data.set('gtfs_feed_url', this.url);
            this.agencies.set(agency_id, Agency.fromMap(data));
        });
        Agency.bulkSave(this.agencies);
        this.files.agency.isDownloaded = true;
        console.log(`parseAgency: saved ${this.agencies.length} agencies`);
    }

    parseRoutes(text) {
        console.log('parseRoutes: start');
        convertCSVToDictionary(text, 'route_id').forEach((data, route_id) => {
            this.routes.set(route_id, Route.fromMap(data));
        });
        Route.bulkSave(this.routes);
        this.files.routes.isDownloaded = true;
        console.log(`parseRoutes: saved ${this.routes.length} routes`);
    }

    parseTrips(text) {
        console.log('parseTrips: start');
        convertCSVToDictionary(text, 'trip_id').forEach((data, trip_id) => {
            this.trips.set(trip_id, Trip.fromMap(data));
        });
        console.log(`parseTrips: parsed ${this.trips.length} trips`);
        Trip.bulkSave(this.trips);
        this.files.trips.isDownloaded = true;
        console.log(`parseTrips: saved ${this.trips.length} trips`);
    }

    parseShapes(text) {
        console.log('parseShapes: start');
        const shapesMap = new Map();
        const shapePoints = convert.csvToArray(text);
        const columns = convert.arrayToColumnIndex(shapePoints[0]);
        const primaryKey = 'shape_id';
        shapePoints.slice(1).forEach(row => {
            const c = prop => sanitize(row[columns.get(prop)]);
            const f = prop => parseFloat(c(prop));
            const shapeId = c(primaryKey);
            if (!shapeId || shapeId === '') return;
            if (!shapesMap.has(shapeId)) shapesMap.set(shapeId, []);
            shapesMap.get(shapeId).push({
                lat: f('shape_pt_lat'),
                lon: f('shape_pt_lon'),
                seq: f('shape_pt_sequence')
            });
        });
        shapesMap.forEach((shapePoints, shape_id) => {
            if (!shapePoints || shapePoints.length === 0) return;
            shapePoints.sort((a, b) => a.seq - b.seq);
            const latLngs = shapePoints.map(({ lon, lat }) => [lon, lat]);
            const shapeFeature = turf.lineString(latLngs);
            const lengthInFeet = turf.length(shapeFeature, { units: 'feet' });
            this.shapes.set(shape_id, new Shape(shape_id, shapePoints, lengthInFeet, shapeFeature));
        });
        Shape.bulkSave(this.shapes);
        this.files.shapes.isDownloaded = true;
        console.log(`parseShapes: saved ${this.shapes.length} shapes`);
    }

    parseStops(text) {
        console.log('parseStops: start');
        convertCSVToDictionary(text, 'stop_id').forEach((data, stop_id) => {
            data.set('stop_lat', parseFloat(data.get('stop_lat')));
            data.set('stop_lon', parseFloat(data.get('stop_lon')));
            this.stops.set(stop_id, Stop.fromMap(data));
        });
        Stop.bulkSave(this.stops);
        this.files.stops.isDownloaded = true;
        console.log(`parseStops: saved ${this.stops.length} stops`);
    }

    parseStopTimes(text) {
        console.log('parseStopTimes: start');
        const timingArray = convert.csvToArray(text.trim());
        const timingColumns = convert.arrayToColumnIndex(timingArray[0]);
        this.stopTimes = timingArray.slice(1).map(row => {
            const c = prop => sanitize(row[timingColumns.get(prop)]);
            return {
                trip_id: c('trip_id'),
                stop_id: c('stop_id'),
                stop_sequence: c('stop_sequence'),
                arrival_time: c('arrival_time'),
                departure_time: c('departure_time'),
                timepoint: c('timepoint') ?? '0',
            };
        });
        this.files.stop_times.isDownloaded = true;
        console.log(`parseStopTimes: parsed ${this.stopTimes.length} stop times`);
    }

    postDownloadParse() {
        console.log('postDownloadParse: start');

        console.log('postDownloadParse: assign timezones to routes');
        this.agencies.forEach((agency, agency_id) => {
            this.routes.forEach((route, route_id, map) => {
                if (route.agency_id === agency_id) {
                    route.timezone = agency.agency_timezone;
                    map.set(route_id, route);
                }
            });
        });

        console.log('postDownloadParse: assign stop times to trips');
        let counter = 0;
        this.stopTimes.forEach(stopTime => {
            const trip = this.trips.get(stopTime.trip_id);
            if (trip) {
                counter++;
                trip.stop_times ??= [];
                trip.stop_times.push(stopTime);
            }
        });
        console.log(`postDownloadParse: assigned stops for ${counter} stops.`);
        console.log('postDownloadParse: for each trip, sort stop times');
        this.trips.forEach(trip => {
            // Sort the stop times
            trip.stop_times.sort(({ stop_sequence: a }, { stop_sequence: b }) => a - b);

            // Find the trip start and end times
            const firstStop = trip.stop_times[0];
            const finalStop = trip.stop_times[trip.stop_times.length - 1];
            trip.start_seconds = convert.timeStringToSeconds(firstStop.arrival_time);
            trip.end_seconds = convert.timeStringToSeconds(finalStop.departure_time);

            // Make sure the first and last stops are always considered timepoints
            firstStop.timepoint = '1';
            finalStop.timepoint = '1';

            // Match the trip timezone to the route timezone
            const route = this.routes.get(trip.route_id);
            trip.timezone = route.timezone;
            trip.agency_id = route.agency_id;
        });

        Route.bulkSave(this.routes);
        Trip.bulkSave(this.trips);
        console.log(`postDownloadParse: saved ${this.trips.size} trips with stop times`);

        //this.processSegmentsAlt();
    }

    processSegmentsAlt() {
        console.log('processSegments: for each shape, derive segments using a sample trip');
        console.time('Segment processing time');
        const totalShapes = this.shapes.size;
        console.log({ totalShapes });
        let shapesProcessed = 0;
        this.shapes.values().forEach(shape => {
            // If shape already has segments defined, then skip
            if (shape.segments instanceof Array && shape.segments.length > 0) {
                shapesProcessed += 1;
                if (shapesProcessed >= totalShapes) {
                    console.timeEnd('Segment processing time');
                }
                return;
            }

            // Begin with blank array of segments
            shape.segments = [];

            // Find one trip to use as a "sample" trip. We assume that all trips that follow the same shape have the same timepoints
            // TO-DO: It is unknown whether this assumption causes problems. If the processing of segments can be handled in advance (i.e. via a cron job)
            // that may justify the more time-consuming operation of analyzing every trip individually
            const sampleTrip = this.trips.values().find(trip => trip.shape_id === shape.shape_id);

            if (!sampleTrip) {
                console.log(`Failed to find sample trip for Shape ID ${shape.shape_id}`);
                return;
            }

            //console.log(`Found sample trip for Shape ID ${shape.shape_id}`);

            // Use sample trip to associate the agency with the shape
            shape.agency_id = sampleTrip.agency_id;

            const timepoints = sampleTrip.stop_times.filter(stop_time => stop_time?.timepoint === '1');
            const firstStop = sampleTrip.stop_times[0];
            const startSeconds = convert.timeStringToSeconds(firstStop.arrival_time);

            // Derive shape segments based on timepoints
            // If there are less than 3 timepoints, then treat the entire trip as one long segment
            if (timepoints.length < 3) {
                const lastStop = sampleTrip.stop_times[sampleTrip.stop_times.length - 1];
                const departSeconds = convert.timeStringToSeconds(firstStop.departure_time);
                const endSeconds = convert.timeStringToSeconds(lastStop.arrival_time);
                shape.segments.push({
                    length_in_feet: shape.length_in_feet,
                    // The segment timing will be relative to the start of the trip. So the start time of the first segment will always be 0 seconds.
                    start_seconds: 0,
                    // The time between `start_seconds` and `depart_seconds` is the dwell time at the stop/station when the vehicle is not moving
                    // For most stops on most transit trips, these two values are the same (i.e. there's no planned dwell time at the station)
                    // Dwell time is more common with major stops of intercity routes, such as Amtrak lines, when the train can sit 10-20 minutes at station
                    depart_seconds: departSeconds - startSeconds,
                    // Since dwell time is factored into the beginning of the segment, each segment "ends" as soon as it arrives at the next timepoint
                    // i.e. time spent sitting at the next timepoint is not considered part of the current segment
                    end_seconds: endSeconds - startSeconds,
                });
            } else {
                // All segments have two timepoints. The ending timepoint of one segment is the starting timepoint of the next segment.
                // Therefore, the quantity of segments equals the quantity of timepoints minus one
                const segmentCount = timepoints.length - 1;
                for (let i = 0; i < segmentCount; i++) {
                    const startpoint = timepoints[i];
                    const startstop = this.stops.get(startpoint.stop_id);
                    const endpoint = timepoints[i + 1];
                    const endstop = this.stops.get(endpoint.stop_id);
                    const segmentLine = turf.lineSlice(
                        turf.point([startstop.stop_lon, startstop.stop_lat]),
                        turf.point([endstop.stop_lon, endstop.stop_lat]),
                        shape.asFeature()
                    );
                    const segmentStartSeconds = convert.timeStringToSeconds(startpoint.arrival_time);
                    const segmentDepartSeconds = convert.timeStringToSeconds(startpoint.departure_time);
                    const segmentEndSeconds = convert.timeStringToSeconds(endpoint.arrival_time);
                    shape.segments.push({
                        length_in_feet: turf.length(segmentLine, { units: 'feet' }),
                        start_seconds: segmentStartSeconds - startSeconds,
                        depart_seconds: segmentDepartSeconds - startSeconds,
                        end_seconds: segmentEndSeconds - startSeconds,
                    });
                }
            }
            shapesProcessed += 1;
            //console.log(`${shapesProcessed} / ${totalShapes}`);
            if (shapesProcessed >= totalShapes) {
                console.timeEnd('Segment processing time');
            }
        });
    }

    processSegments() {
        console.log('processSegments: for each shape, derive segments using a sample trip');
        console.time('Segment processing time');
        const processedTrips = [];
        Shape.all().then(async (shapes) => {

            // Keep track of the total shapes processed so we know when we're finished
            const totalShapes = shapes.length;
            const finishedShapes = new Set();
            let shapesProcessed = 0;
            const isFinished = () => finishedShapes.size >= totalShapes;
            const finishShape = (shape) => {
                finishedShapes.add(shape);
                if (isFinished()) {
                    console.timeEnd('Segment processing time');
                    console.log(processedTrips);
                }
            };

            // Keep track of the unique combinations of shapes + timepoints
            // so that we can avoid duplicate effort when multiple trips have identical segments
            const shapeTimepointsMap = new Map();
            const getStpKey = ({ shape_id }, timepoints) => shape_id + '-' + timepoints.map(t => t.stop_id).join('-');

            // Process
            for (let shape of shapes) {
                // Find all trips that use this shape ID
                const trips = await Trip.find({ shape_id: shape.shape_id });

                shapesProcessed += 1;
                //console.log(`Processing shape ${shapesProcessed} / ${totalShapes}`);

                // For each trip, calculate segments
                for (let t = 0; t < trips.length; t++) {
                    const trip = trips[t];
                    //console.log(`Processing trip ${t+1} / ${trips.length}`);
                    // Skip if this trip already has segments defined
                    if (trip.hasSegments()) {
                        //console.log(`Trip ${trip.trip_id} already has segments. Skipping.`);
                        if (t >= trips.length - 1) finishShape(shape);
                        continue;
                    }

                    // Get timepoints for this trip
                    const timepoints = trip.stop_times.filter(stop_time => stop_time?.timepoint === '1');

                    // Check if we already calculated segments for a near identical trip
                    const stpKey = getStpKey(shape, timepoints);
                    if (shapeTimepointsMap.has(stpKey)) {
                        trip.segments = shapeTimepointsMap.get(stpKey);
                        processedTrips.push(trip);
                        //console.log(`Trip ${trip.trip_id} reuses past timepoints.`);
                        if (t >= trips.length - 1) finishShape(shape);
                        continue;
                    }

                    // Start with a blank array of segments
                    trip.segments = [];

                    // Get details about when this trip starts
                    const firstStop = trip.stop_times[0];
                    const startSeconds = convert.timeStringToSeconds(firstStop.arrival_time);

                    // If there are less than 3 timepoints, then treat the entire trip as one long segment
                    if (timepoints.length < 3) {
                        //console.log(`Trip ${trip.trip_id} is one large segment.`);
                        const lastStop = trip.stop_times[trip.stop_times.length - 1];
                        const departSeconds = convert.timeStringToSeconds(firstStop.departure_time);
                        const endSeconds = convert.timeStringToSeconds(lastStop.arrival_time);
                        trip.segments.push({
                            length_in_feet: shape.length_in_feet,
                            // The segment timing will be relative to the start of the trip. So the start time of the first segment will always be 0 seconds.
                            start_seconds: 0,
                            // The time between `start_seconds` and `depart_seconds` is the dwell time at the stop/station when the vehicle is not moving
                            // For most stops on most transit trips, these two values are the same (i.e. there's no planned dwell time at the station)
                            // Dwell time is more common with major stops of intercity routes, such as Amtrak lines, when the train can sit 10-20 minutes at station
                            depart_seconds: departSeconds - startSeconds,
                            // Since dwell time is factored into the beginning of the segment, each segment "ends" as soon as it arrives at the next timepoint
                            // i.e. time spent sitting at the next timepoint is not considered part of the current segment
                            end_seconds: endSeconds - startSeconds,
                        });
                    } else {
                        // All segments have two timepoints. The ending timepoint of one segment is the starting timepoint of the next segment.
                        // Therefore, the quantity of segments equals the quantity of timepoints minus one
                        const segmentCount = timepoints.length - 1;
                        //console.log(`Trip ${trip.trip_id} has ${segmentCount} segments.`);
                        for (let i = 0; i < segmentCount; i++) {
                            const startpoint = timepoints[i];
                            const startstop = await Stop.get(startpoint.stop_id);
                            const endpoint = timepoints[i + 1];
                            const endstop = await Stop.get(endpoint.stop_id);
                            const segmentLine = turf.lineSlice(
                                turf.point([startstop.stop_lon, startstop.stop_lat]),
                                turf.point([endstop.stop_lon, endstop.stop_lat]),
                                shape.asFeature()
                            );
                            const segmentStartSeconds = convert.timeStringToSeconds(startpoint.arrival_time);
                            const segmentDepartSeconds = convert.timeStringToSeconds(startpoint.departure_time);
                            const segmentEndSeconds = convert.timeStringToSeconds(endpoint.arrival_time);
                            trip.segments.push({
                                length_in_feet: turf.length(segmentLine, { units: 'feet' }),
                                start_seconds: segmentStartSeconds - startSeconds,
                                depart_seconds: segmentDepartSeconds - startSeconds,
                                end_seconds: segmentEndSeconds - startSeconds,
                            });
                        }
                    }
                    // Save segments for potential reuse
                    shapeTimepointsMap.set(stpKey, trip.segments);
                    processedTrips.push(trip);

                    //console.log(`Finished segmenting Trip ${trip.trip_id}`);
                    if (t >= trips.length - 1) finishShape(shape);
                }
            };
        });
    }
}

function fixHexValue(originalValue) {
    if (originalValue.length === 3 || originalValue.length === 6 && originalValue.indexOf("#") === -1) {
        return '#' + originalValue;
    }
}