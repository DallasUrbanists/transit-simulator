import L, { Map } from 'leaflet';
import { MaptilerLayer } from "@maptiler/leaflet-maptilersdk";
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

const defaultCoords = [32.780694233921906, -96.79930204561467];
const defaultZoomLevel = 13;
const defaultMapStyle = maptilersdk.MapStyle['STREETS']['DARK'];

export default class MapContext extends Map {
    activeTrips = new Set();
    constructor(elementId) {
        super(elementId);
        this.setView(
            localStorage.getItem('last_map_coords') ?? defaultCoords,
            localStorage.getItem('last_map_zoom') ?? defaultZoomLevel,
        );
        this.tileLayer = new MaptilerLayer({
            apiKey: import.meta.env.VITE_MAPTILER_API_KEY,
            style: localStorage.getItem('last_map_style') ?? defaultMapStyle,
            opacity: localStorage.getItem('last_map_opacity') ?? defaultMapStyle,
        }).addTo(this);
    }
    activate(trip) {
        this.activeTrips.add(trip);
    }
    deactivate(trip) {
        this.removeMarker(trip);
        this.removeTail(trip);
        this.activeTrips.delete(trip);
    }
    hasMarker(trip) {
        return this.hasLayer(trip.get('marker'));
    }
    addMarker(trip) {
        if (trip.has('marker') && !this.hasMarker(trip)) {
            this.addLayer(trip.get('marker'));
        }
    }
    removeMarker(trip) {
        if (trip.has('marker')) {
            this.removeLayer(trip.get('marker'));
        }
    }
    addTail(trip) {
        if (trip.has('tail') && !this.hasLayer(trip.get('tail'))) {
            this.addLayer(trip.get('tail'));
        }
    }
    removeTail(trip) {
        if (trip.has('tail')) {
            this.removeLayer(trip.get('tail'));
        }
    }
}