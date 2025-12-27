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
    static toMap(array) {
        return new Map(
            array.map(instance => [instance.primaryKey(), instance])
        );
    }
    static async get(id) {
        const query = {};
        if (typeof this.PRIMARY_KEY === 'string') {
            query[this.PRIMARY_KEY] = id;
        } else if (this.PRIMARY_KEY instanceof Array) {
            this.PRIMARY_KEY.forEach((key, index) => query[key] = id[index]);
        } else {
            console.log(this.PRIMARY_KEY, typeof this.PRIMARY_KEY, id);
            throw new Error('Unexpected PRIMARY_KEY type');
        }
        const data = await db[this.TABLE].where(query).first();
        if (!data) {
            return undefined;
        }
        const instance = new this();
        Object.assign(instance, data);
        return instance;
    }
    static async all() {
        const array = await db[this.TABLE].toArray();
        return array.map(data => this.fromObject(data));
    }
    static async find(query, returnAs = 'array') {
        const array = await db[this.TABLE].where(query).toArray();
        const entities = array.map(data => this.fromObject(data));
        if (returnAs === 'map') {
            return entities.reduce((map, entity) => map.set(entity.primaryKey(), entity), new Map());
        }
        return entities;
    }
    static where(param) {
        return db[this.TABLE].where(param);
    }
    primaryKey() {
        return this[this.constructor.PRIMARY_KEY];
    }
    onPreSave() {
        // optionally add functionality in child class
        return;
    }
    save() {
        this.onPreSave();
        db[this.constructor.TABLE].put(this);//.then(() => console.log(`Successfully saved ${this.constructor.name}`));
    }
    static bulkSave(entities) {
        if (entities instanceof Map) {
            entities = Array.from(entities.values());
        }
        entities.forEach(entity => entity.onPreSave());
        db[this.TABLE].bulkPut(entities).then(() => console.log(`Successfully stored ${entities.length} ${this.constructor.name}s in idb`));
    }
    static defineEntityTable(tableName, dexieIndexes) {
        const definition = {};
        definition[tableName] = dexieIndexes;
        db.version(1).stores(definition);
    }
}