import { convert, DAY, getTimezoneDifference } from "../misc/utilities.mjs";
import Entity from "./Entity.js";

Entity.defineEntityTable('trips', '[route_id+trip_id]');

export default class Trip extends Entity {
    static TABLE = 'trips';
    static PRIMARY_KEY = ['route_id', 'trip_id'];
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
}