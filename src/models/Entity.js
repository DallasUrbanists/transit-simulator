import { db } from "../db.js";

export default class Entity {
    static TABLE = undefined;
    static PRIMARY_KEY = undefined;
    static fromObject(sourceObj) {
        const instance = new this();
        Object.assign(instance, sourceObj);
        return instance;
    }
    static fromMap(map) {
        const instance = new this();
        Object.assign(instance, Object.fromEntries(map));
        return instance;
    }
    onPreSave() {
        // optionally add functionality in child class
        return;
    }
    save() {
        this.onPreSave();
        db[this.TABLE].put(this).then(() => console.log(`Successfully saved ${this.constructor.name} ${this[this.PRIMARY_KEY]}`));
    }
    static bulkSave(entities) {
        if (entities instanceof Map) {
            entities = Array.from(entities.values());
        }
        console.log(this.TABLE);
        entities.forEach(entity => entity.onPreSave());
        db[this.TABLE].bulkPut(entities).then(() => console.log(`Successfully stored ${entities.length} ${this.constructor.name}s in idb`));
    }
    static defineEntityTable(tableName, dexieIndexes) {
        const definition = {};
        definition[tableName] = dexieIndexes;
        db.version(1).stores(definition);
    }
}