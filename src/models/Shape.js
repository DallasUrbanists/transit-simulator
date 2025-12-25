import { db } from "../db.js";

db.version(1).stores({ shapes: 'shape_id' });

// shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled

export default class Shape {
    constructor(
        shape_id,
        points = [],
        length_in_feet = 0,
    ) {
        this.shape_id = shape_id;
        this.points = points;
        this.length_in_feet = length_in_feet;
    }

    save() {
        db.shapes.put(this).then(() => console.log(`Successfully saved Shape ${this.shape_id}`));
    }

    static bulkSave(shapes) {
        if (shapes instanceof Map) {
            shapes = Array.from(shapes.values());
        }
        db.shapes.bulkPut(shapes).then(() => console.log(`Successfully stored ${shapes.length} shapes in idb`));
    }
}
