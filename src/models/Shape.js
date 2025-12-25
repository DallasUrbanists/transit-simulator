import Entity from "./Entity.js";

Entity.defineEntityTable('shapes', 'shape_id');

export default class Shape extends Entity {
    static TABLE = 'shapes';
    static PRIMARY_KEY = 'shape_id';
    constructor(
        shape_id,
        points = [],
        length_in_feet = 0,
    ) {
        super();
        this.shape_id = shape_id;
        this.points = points;
        this.length_in_feet = length_in_feet;
    }
}
