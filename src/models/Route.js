import { db } from "../db.js";

db.version(1).stores({ routes: '[agency_id+route_id]' });

export default class Route {
    constructor(
        agency_id,
        route_id,
        long_name,
        short_name,
        type,
        color = '#000000',
    ) {
        this.agency_id = agency_id;
        this.route_id = route_id;
        this.long_name = long_name;
        this.short_name = short_name;
        this.type = type;
        this.color = color;
    }

    save() {
        db.routes.put(this).then(() => console.log(`Successfully saved Route ${this.short_name} ${this.long_name}`));
    }

    static bulkSave(routes) {
        if (routes instanceof Map) {
            routes = Array.from(routes.values());
        }
        db.routes.bulkPut(routes).then(() => console.log(`Successfully stored ${routes.length} routes in idb`));
    }
}