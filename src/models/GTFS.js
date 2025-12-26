import * as turf from "@turf/turf";
import * as zip from "@zip.js/zip.js";
import axios from "axios";
import { db } from "../db";
import { convert, convertCSVToDictionary, sanitize } from "../misc/utilities.mjs";
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
        const response = await axios.get(this.url, {
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
                    try { await reader.close(); } catch (e) {}
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

    allFilesDownloaded() {
        return Object.values(this.files).reduce((prev, curr) => prev && curr.isDownloaded, true);
    }

    parseAgency(text) {
        console.log('parseAgency: start');
        convertCSVToDictionary(text, 'agency_id').forEach((data, agency_id) => {
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
                timepoint: c('timepoint'),
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
            const lastStop = trip.stop_times[trip.stop_times.length - 1];
            trip.start_seconds = convert.timeStringToSeconds(firstStop.arrival_time);
            trip.end_seconds = convert.timeStringToSeconds(lastStop.departure_time);

            // Match the trip timezone to the route timezone
            const route = this.routes.get(trip.route_id);
            trip.timezone = route.timezone;
            trip.agency_id = route.agency_id;
        });

        console.log('postDownloadParse: for each shape, derive segments using a sample trip');
        this.shapes.forEach(shape => {
            // If shape already has segments defined, then skip
            if (shape.segments instanceof Array && shape.segments.length > 0) return;

            // Begin with blank array of segments
            shape.segments = [];

            // Find one trip to use as a "sample" trip. We assume that all trips that follow the same shape have the same timepoints
            // TO-DO: It is unknown whether this assumption causes problems. If the processing of segments can be handled in advance (i.e. via a cron job)
            // that may justify the more time-consuming operation of analyzing every trip individually
            const sampleTrip = this.trips.values().find(trip => trip.shape_id === shape.shape_id);
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
                    const endpoint = timepoints[i+1];
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
        });

        Route.bulkSave(this.routes);
        Trip.bulkSave(this.trips);
        Shape.bulkSave(this.shapes);
        console.log(`postDownloadParse: saved ${this.trips.size} trips with stop times`);
    }
}

function fixHexValue(originalValue) {
    if (originalValue.length === 3 || originalValue.length === 6 && originalValue.indexOf("#") === -1) {
        return '#' + originalValue;
    }
}