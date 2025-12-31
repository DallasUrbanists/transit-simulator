import Trip from "../models/Trip";
import Program from "./Program";
import * as turf from "@turf/turf";

export default class SystemVisualization extends Program {
    vehicles = new Map();

    async prepare(options) {
        console.log('Begin preparation');
        this.timezone = options.timezone;
        this.map = options.map;
        const prepareMap = () => {
            console.log('map load start');
            this.map.map.addSource("vehicles", {
                type: "geojson",
                data: this.vehiclesAsFeatureCollection(),
            });
            this.map.map.addModel('bus', './public/3d/chatgpt_dart_bus_lowpoly_v3.glb');
            this.map.map.addLayer({
                id: "vehicles",
                type: "model",
                source: "vehicles",
                slot: "middle",
                layout: {
                    "model-id": "bus",
                },
                paint: {
                    'model-scale': [1, 1, 1],
                    'model-translation': [0, 0, 0],
                    'model-rotation': ["get", "rotation"]
                    //'model-type': 'location-indicator',
                }
                
            });
            console.log('map loaded');
        };
        if (this.map.map.loaded()) {
            prepareMap();
        } else {
            this.map.map.on("load", () => prepareMap());
        }
        console.time('Load trips from database');
        this.trips = options.trips;
        console.timeEnd('Load trips from database');
        console.time('Segmentize trips');
        const promises = this.trips.map(trip => trip.segmentize());
        await Promise.all(promises).then(() => {
            console.timeEnd('Segmentize trips');
        });
    }
    isReady() {
        return this.trips instanceof Array
            && this.trips.length > 0
            && this.map.map.isStyleLoaded()
            && this.map.map.loaded()
            && this.map.map.getSource('vehicles')
            && this.map.map.isSourceLoaded('vehicles');
    }
    render(playhead) {
        // Do nothing if program isn't ready
        if (!this.isReady()) return;

        // Get all trips active at given time
        const activeTrips = Trip.findActiveAmong(playhead, this.timezone, this.trips);

        // Keep track of vehicles moved this round. Later we'll hide inactive vehicles
        const activeVehicleIds = [];

        // For each active trip, set a marker at it's current position
        activeTrips.forEach(trip => {
            const vehicleId = trip.getVehicleId();
            const coords = trip.getCoordsAt(playhead, this.timezone);
            const bearing = 90 + trip.getBearing(coords, playhead, this.timezone);
            if (this.vehicles.has(vehicleId)) {
                const vehicle = this.vehicles.get(vehicleId);
                vehicle.coords = coords;
                vehicle.start_seconds = Math.min(trip.start_seconds, vehicle.start_seconds);
                vehicle.end_seconds = Math.min(trip.end_seconds, vehicle.end_seconds);
                vehicle.rotation = [0, 0, bearing];
            } else {
                this.vehicles.set(vehicleId, {
                    coords,
                    start_seconds: trip.start_seconds,
                    end_seconds: trip.end_seconds,
                    rotation: [0, 0, bearing ?? -90]
                });
            }
            activeVehicleIds.push(vehicleId);
        });

        const fc = this.vehiclesAsFeatureCollection(activeVehicleIds, playhead);

        this.map.getSource('vehicles').setData(fc);
    }
    vehiclesAsFeatureCollection(activeVehicleIds, playhead) {
        return turf.featureCollection(Array.from(this.vehicles.entries())
            .map(entry => {
                const id = entry[0];
                const vehicle = entry[1];
                const vehicleNotActive = !activeVehicleIds.includes(id);
                const vehicleOutOfService = playhead < vehicle.start_seconds || playhead > vehicle.end_seconds;
                if (vehicleNotActive && vehicleOutOfService) {
                    return null;
                }
                return turf.point(vehicle.coords, vehicle);
            })
            .filter(v => v)
        );
    }
}