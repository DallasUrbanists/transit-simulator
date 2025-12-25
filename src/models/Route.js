import Entity from "./Entity.js";

Entity.defineEntityTable('routes', '[agency_id+route_id]');

export default class Route extends Entity {
    static TABLE = 'routes';
    static PRIMARY_KEY = ['agency_id', 'route_id'];
    // constructor(
    //     agency_id,
    //     route_id,
    //     long_name,
    //     short_name,
    //     type,
    //     color = '#000000',
    // ) {
    //     super();
    //     this.agency_id = agency_id;
    //     this.route_id = route_id;
    //     this.long_name = long_name;
    //     this.short_name = short_name;
    //     this.type = type;
    //     this.color = color;
    // }
}