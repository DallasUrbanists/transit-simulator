import { db } from "../db.js";

db.version(1).stores({ trips: '[route_id+trip_id]' });

export default class Trip {
    constructor(
        route_id,
        trip_id,
        service_id,
        headsign,
        direction_id,
        block_id,
        shape_id,
    ) {
        this.route_id = route_id;
        this.trip_id = trip_id;
        this.service_id = service_id;
        this.headsign = headsign;
        this.direction_id = direction_id;
        this.block_id = block_id;
        this.shape_id = shape_id;
    }

    save() {
        db.trips.put(this).then(() => console.log(`Successfully saved Trip ${this.headsign}`));
    }

    static bulkSave(trips) {
        if (trips instanceof Map) {
            trips = Array.from(trips.values());
        }
        db.trips.bulkPut(trips).then(() => console.log(`Successfully stored ${trips.length} trips in idb`));
    }
}
