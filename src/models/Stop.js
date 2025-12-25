import { db } from "../db.js";

db.version(1).stores({ stops: 'stop_id' });

// stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,zone_id,stop_url,wheelchair_boarding

export default class Stop {
    constructor(
        stop_id,
        code,
        name,
        lat,
        lon,
    ) {
        this.stop_id = stop_id;
        this.code = code;
        this.name = name;
        this.lat = parseFloat(lat);
        this.lon = parseFloat(lon);
    }

    save() {
        db.stops.put(this).then(() => console.log(`Successfully saved Stop ${this.stop_id}`));
    }

    static bulkSave(stops) {
        if (stops instanceof Map) {
            stops = Array.from(stops.values());
        }
        db.stops.bulkPut(stops).then(() => console.log(`Successfully stored ${stops.length} stops in idb`));
    }
}
