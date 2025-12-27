import Entity from "./Entity.js";
import * as turf from "@turf/turf";

Entity.defineEntityTable('shapes', 'shape_id,agency_id');

export default class Shape extends Entity {
    static TABLE = 'shapes';
    static PRIMARY_KEY = 'shape_id';
    constructor(
        shape_id,
        points = [],
        length_in_feet = 0,
        geojson,
    ) {
        super();
        this.shape_id = shape_id;
        this.points = points;
        this.length_in_feet = length_in_feet;
        this.geojson = geojson;
    }
    asFeature() {
        //console.log(this.points);
        this.feature ??= turf.lineString(this.points.map(({lon, lat}) => [lon, lat]));
        return this.feature;
    }
}
