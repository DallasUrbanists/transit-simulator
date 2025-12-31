import * as turf from "@turf/turf";
import { convert, DAY, ease, getTimezoneDifference, minValMax } from "../misc/utilities.mjs";
import Entity from "./Entity.js";
import Stop from "./Stop.js";
import Shape from "./Shape.js";

Entity.defineEntityTable('trips', '[route_id+trip_id],route_id,agency_id,shape_id,service_id');

export default class Trip extends Entity {
    static TABLE = 'trips';
    static PRIMARY_KEY = ['route_id', 'trip_id'];
    static TRAVEL_INTERVAL = 10;

    cache = {};
    async onPostGet() {
        if (typeof this.shape_id === 'string') {
            this.shape = await Shape.get(this.shape_id);
        }
        return this;
    }
    onPreSave() {
        // To avoid ballooning storage, don't save joined entities
        this.cache.clear();
        delete this.shapeFeature;
        delete this.shape;
    }
    getDuration(units = 'seconds') {
        if (!this.start_seconds || !this.end_seconds) {
            return 0;
        }
        const durationSeconds = this.end_seconds - this.start_seconds;
        switch (units) {
            case 'timestring':
                return convert.secondsToTimeString(durationSeconds);
            case 'hours':
                return durationSeconds / 60 / 60;
            case 'minutes':
                return durationSeconds / 60;
            case 'seconds':
            default:
                return durationSeconds;
        }
    }
    isOvernight() {
        return this.start_seconds >= DAY || this.end_seconds > DAY;
    }
    isActiveAt(seconds, timezone) {
        if (this.getDuration() >= DAY) {
            return true;
        }
        if (timezone !== this.timezone) {
            seconds = seconds + getTimezoneDifference(timezone, this.timezone);
        }
        const simpleComparison = seconds >= this.start_seconds && seconds <= this.end_seconds;
        if (simpleComparison) {
            return true;
        } else {
            // If simple comparison failed, and trip runs past midnight, consider possibility that clock just wrapped around
            if (this.end_seconds >= DAY) {
                const altSeconds = seconds + DAY;
                return altSeconds >= this.start_seconds && altSeconds <= this.end_seconds;
            }
        }
        return false;
    }
    hasSegments() {
        return this.segments instanceof Array && this.segments.length > 0;
    }
    getElapsedSeconds(playhead, timezone) {
        if (timezone !== this.timezone) {
            playhead = playhead + getTimezoneDifference(timezone, this.timezone);
        }
        // 
        if (this.isOvernight()) {
            // Get the clock time in seconds that the trip starts
            const tripStartTime = this.start_seconds >= DAY
                ? this.start_seconds - DAY
                : this.start_seconds;
            const tripEndTime = this.end_seconds - DAY;

            // EXAMPLE: tripStartTime=23:45:00  playhead=23:50:00  tripEndTime=00:30:00
            if (tripStartTime <= playhead && playhead > tripEndTime) {
                return playhead - tripStartTime;
            }
            // EXAMPLE: tripStartTime=23:45:00  playhead=00:15:00  tripEndTime=00:30:00
            // EXAMPLE: tripStartTime=00:05:00  playhead=00:15:00  tripEndTime=00:30:00
            if (playhead <= tripEndTime) {
                const secondsRemaining = tripEndTime - playhead;
                return this.getDuration() - secondsRemaining;
            }
            // EXAMPLE: playhead=23:30:00  tripStartTime=23:45:00
            if (playhead < tripStartTime && tripStartTime < DAY) {
                return playhead - tripStartTime;
            }
            // EXAMPLE: tripStartTime=00:00:00  playhead=00:30:00
            throw new Error(
                `Logic error! Somehow Trip ${this.trip_id} was considered an "overnight trip" despite starting and ending before midnight (${convert.secondsToTimeString(this.start_seconds)} to ${convert.secondsToTimeString(this.end_seconds)}).`
            );
        }

        return playhead - this.start_seconds;
    }
    getBearing(currentCoords, playhead, timezone) {
        if (!this.cache.bearing) {
            let priorCoords = this.cache.priorCoords;
            if (!priorCoords) {
                priorCoords = this.getCoordsAt(playhead + Trip.TRAVEL_INTERVAL, timezone);
            }
            this.cache.bearing = turf.bearing(currentCoords, priorCoords);
        }
        return this.cache.bearing;
    }
    getCoordsAt(playhead, timezone) {
        this.shapeFeature ??= this.shape.asFeature();
        const elapsed = this.getElapsedSeconds(playhead, timezone);
        const traveled = this.getDistanceTraveledAfter(elapsed);
        const point = turf.along(this.shapeFeature, traveled, { units: 'feet' });
        const coords = point.geometry.coordinates;

        // Keep track of movement to help with rotation
        const priorTraveled = this.cache.priorTraveled;
        const priorCoords = this.cache.priorCoords;
        const traveledInterval = priorTraveled && priorCoords && (Math.abs(traveled - priorTraveled) > Trip.TRAVEL_INTERVAL);
        if (!priorTraveled || traveledInterval) {
            if (traveledInterval) {
               this.cache.bearing = turf.bearing(coords, priorCoords);
            }
            this.cache.priorCoords = coords;
            this.cache.priorTraveled = traveled;
        }

        return coords;
    }
    getDistanceTraveledAfter(elapsedSeconds) {
        if (!this.hasSegments()) return 0;
        let totalDistanceInFeet = 0;
        const { index, segment: activeSegment, segment_elapsed: activeSegmentElapsed } = this.getActiveSegmentAfter(elapsedSeconds);
        for (let i = 0; i < index; i++) {
            totalDistanceInFeet += this.segments[i].length_in_feet;
        }
        const dwellTime = activeSegment.depart_seconds - activeSegment.start_seconds;
        const segmentDuration = activeSegment.end_seconds - activeSegment.start_seconds;
        const travelTime = segmentDuration - dwellTime;
        const segmentRatio = activeSegmentElapsed > dwellTime
            ? Math.min(1, (activeSegmentElapsed - dwellTime) / travelTime)
            : 0;
        const segmentTraveled = activeSegment.length_in_feet * ease.inOutCubic(segmentRatio);
        totalDistanceInFeet += segmentTraveled;
        return totalDistanceInFeet;
    }
    getActiveSegmentAfter(elapsedSeconds) {
        // If there are no segments, return null
        if (!this.hasSegments()) return null;
        // If there is only one segment, it is always the active one
        // If elapsed seconds is less than or equal to 0, return first segment
        if (this.segments.length === 1 || elapsedSeconds <= 0) {
            const segment = this.segments[0];
            const segment_elapsed = minValMax(0, parseFloat(elapsedSeconds), segment.end_seconds);
            return { index: 0, segment, segment_elapsed };
        }
        const finalIndex = this.segments.length - 1;
        const finalSegment = this.segments[finalIndex];
        const finalDuration = parseFloat(finalSegment.end_seconds - finalSegment.start_seconds);
        const finale = { index: finalIndex, segment: finalSegment, segment_elapsed: finalDuration };
        // If elapsed seconds has passed the duration of this trip, return final segment
        if (elapsedSeconds >= this.getDuration()) return finale;
        // Analyze each segment of trip to see if it's active
        for (let index = 0; index < this.segments.length; index++) {
            const segment = this.segments[index];
            if (elapsedSeconds < segment.end_seconds) {
                const segment_elapsed = elapsedSeconds - segment.start_seconds;
                return { index, segment, segment_elapsed };
            }
        }
        // If after analyzing all segments and none were active, return final segment as default
        return finale;
    }
    getTimepoints() {
        return this.stop_times.filter(stop_time => stop_time.timepoint === '1');
    }
    stpKey(timepoints) {
        return this.shape_id + '-' + timepoints.map(t => t.stop_id).join('-');
    }
    getStopTimesById(stop_id) {
        return this.stop_times.filter(s => s.stop_id === stop_id);
    }
    async addTimepointAtStopId(stop_id) {
        // Keep track of how many timepoints there currently are before changing anything
        const ogTimepointCount = this.getTimepoints().length;
        // Convert all matching stop times to timepoints
        this.getStopTimesById(stop_id).forEach(stopTime => stopTime.timepoint = '1');
        // If the total number of timepoints changed, then recalculate segments
        // Or, recalculate segments if they weren't already calculated to begin with
        return (this.getTimepoints().length !== ogTimepointCount || !this.hasSegments())
            ? await this.segmentize({ replaceSegments: true })
            : this.segments;
    }
    async removeTimepointAtStopId(stop_id) {
        // Keep track of how many timepoints there currently are before changing anything
        const ogTimepointCount = this.getTimepoints().length;
        // Convert all matching stop times to timepoints
        this.getStopTimesById(stop_id).forEach(stopTime => stopTime.timepoint = '0');
        // If the total number of timepoints changed, then recalculate segments
        // Or, recalculate segments if they weren't already calculated to begin with
        return (this.getTimepoints().length !== ogTimepointCount || !this.hasSegments())
            ? await this.segmentize({ replaceSegments: true })
            : this.segments;
    }
    async segmentize({
        replaceSegments = false,        // if true, replaces currently defined trip segments
        segmentCacheMap = undefined,    // if provided, allows for more efficient segmentation of several trips
    } = {}) {
        if (replaceSegments === false && this.hasSegments()) return this.segments;

        // Get details about first and final stops of trip. Make sure they are set as timepoints
        const firstStop = this.stop_times[0];
        const startSeconds = convert.timeStringToSeconds(firstStop.arrival_time);
        const finalStop = this.stop_times[this.stop_times.length - 1];
        firstStop.timepoint = '1';
        finalStop.timepoint = '1';
        const timepoints = this.getTimepoints();

        // Check if we already calculated segments for a near identical trip
        if (segmentCacheMap instanceof Map && segmentCacheMap.has(this.stpKey(timepoints))) {
            this.segments = segmentCacheMap.get(this.stpKey(timepoints));
            return this.segments;
        }

        // At this point, we're sure we're going to recalculate segments. So start with fresh segments array
        this.segments = [];

        // We can't proceed without the shape, so make sure we have it
        this.shape ??= await Shape.get(this.shape_id);

        // If there are less than 3 timepoints, then treat the entire trip as one long segment
        if (timepoints.length < 3) {
            const departSeconds = convert.timeStringToSeconds(firstStop.departure_time);
            const endSeconds = convert.timeStringToSeconds(finalStop.arrival_time);
            this.segments.push({
                length_in_feet: this.shape.length_in_feet,
                // The segment timing will be relative to the start of the trip. So the start time of the first segment will always be 0 seconds.
                start_seconds: 0,
                // The time between `start_seconds` and `depart_seconds` is the dwell time at the stop/station when the vehicle is not moving
                // Usually, these two values are the same (i.e. there's no planned dwell time at the station)
                // Dwell time is more common with major stops of intercity routes, e.g. when Amtrak Texas Eagle pauses at EBJ Union Station for 20 minutes
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
                const startstop = await Stop.get(startpoint.stop_id);
                const endpoint = timepoints[i + 1];
                const endstop = await Stop.get(endpoint.stop_id);
                const subFeature = this.shape.subFeature(i === 0 ? 'front' : 'back');
                const segmentLine = turf.lineSlice(
                    turf.point([startstop.stop_lon, startstop.stop_lat]),
                    turf.point([endstop.stop_lon, endstop.stop_lat]),
                    subFeature
                );
                const segmentStartSeconds = convert.timeStringToSeconds(startpoint.arrival_time);
                const segmentDepartSeconds = convert.timeStringToSeconds(startpoint.departure_time);
                const segmentEndSeconds = convert.timeStringToSeconds(endpoint.arrival_time);
                this.segments.push({
                    length_in_feet: turf.length(segmentLine, { units: 'feet' }),
                    start_seconds: segmentStartSeconds - startSeconds,
                    depart_seconds: segmentDepartSeconds - startSeconds,
                    end_seconds: segmentEndSeconds - startSeconds,
                });
            }
        }

        // Now that we've calculated the segments for this trip, save and return results
        if (segmentCacheMap instanceof Map) {
            segmentCacheMap.set(this.stpKey(timepoints), this.segments);
        }
        return this.segments;
    }
    static findActiveAmong(seconds, timezone, trips) {
        return trips.filter(trip => trip.isActiveAt(seconds, timezone));
    }
    getVehicleId() {
        return `${this.agency_id}_${this.block_id}`;
    }
}