import Entity from "./Entity.js";

Entity.defineEntityTable('stops', 'stop_id');

export default class Stop extends Entity {
    static TABLE = 'stops';
    static PRIMARY_KEY = 'stop_id';
    constructor() {
        super();
    }
    onPreSave() {
        this.stop_lat = parseFloat(this.stop_lat);
        this.stop_lon = parseFloat(this.stop_lon);
    }
}
