import Entity from "./Entity.js";

Entity.defineEntityTable('agencies', 'agency_id,gtfs_feed_url');

export default class Agency extends Entity {
    static TABLE = 'agencies';
    static PRIMARY_KEY = 'agency_id';
    // constructor(
    //     agency_id,
    //     name,
    //     phone,
    //     url,
    //     timezone,
    //     language,
    //     fare_url,
    // ) {
    //     super();
    //     this.agency_id = agency_id;
    //     this.name = name;
    //     this.phone = phone;
    //     this.url = url;
    //     this.timezone = timezone;
    //     this.language = language;
    //     this.fare_url = fare_url;
    // }
}