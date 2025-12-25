import { db } from "../db.js";

db.version(1).stores({ agencies: 'agency_id' });

// agency_id,agency_name,agency_phone,agency_url,agency_timezone,agency_lang,agency_fare_url

export default class Agency {
    constructor(
        agency_id,
        name,
        phone,
        url,
        timezone,
        language,
        fare_url,
    ) {
        this.agency_id = agency_id;
        this.name = name;
        this.phone = phone;
        this.url = url;
        this.timezone = timezone;
        this.language = language;
        this.fare_url = fare_url;
    }

    save() {
        db.agencies.put(this).then(() => console.log(`Successfully saved Agency ${this.name}`));
    }

    static bulkSave(agencies) {
        if (agencies instanceof Map) {
            agencies = Array.from(agencies.values());
        }
        db.agencies.bulkPut(agencies).then(() => console.log(`Successfully stored ${agencies.length} agencies in idb`));
    }
}