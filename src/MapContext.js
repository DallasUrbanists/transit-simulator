import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import * as turf from '@turf/turf';
import L, { Map as LeafletMap } from 'leaflet';
import { sectionIndex as fixtures, getSpecialShape as getFixtureShape } from './special';

const defaultCoords = [32.780694233921906, -96.79930204561467]; // Downtown Dallas
const defaultZoomLevel = 13;
const defaultMapStyle = maptilersdk.MapStyle['STREETS']['DARK'];

export default class MapContext extends LeafletMap {
    activeTrips = new Set();
    drawnFixtures = new Map();
    constructor(containerId) {
        super(containerId);
        this.setView(
            getStoredCoords() ?? defaultCoords,
            localStorage.getItem('last_map_zoom') ?? defaultZoomLevel,
        );
        this.tileLayer = new MaptilerLayer({
            apiKey: import.meta.env.VITE_MAPTILER_API_KEY,
            style: getStoredMapStyle() ?? defaultMapStyle,
            opacity: localStorage.getItem('last_map_opacity') ?? defaultMapStyle,
        }).addTo(this);
        this.on('zoomend', this.handleZoom);
        this.on('moveend', this.handleMove);
        this.redrawFixtures();
    }
    setStyle(styleString) {
        const code = styleString.split(".");
        const styles = maptilersdk.MapStyle;
        this.tileLayer.setStyle(code.length === 2 ? styles[code[0]][code[1]] : styles[code[0]]);
        localStorage.setItem('last_map_style', styleString);
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
    handleZoom(e) {
        localStorage.setItem('last_map_zoom', this.getZoom());
        this.redrawFixtures();
    }
    handleMove(e) {
        localStorage.setItem('last_map_coords', JSON.stringify(this.getCenter()));
    }
    redrawFixtures = () => {
        Object.keys(fixtures).forEach(fixtureIndex => {
            if (this.drawnFixtures.has(fixtureIndex)) {
                const prior = this.drawnFixtures.get(fixtureIndex);
                prior.forEach(layer => this.removeLayer(layer));
                this.drawnFixtures.delete(fixtureIndex);
            }
            const fixtureShape = turf.simplify(
                getFixtureShape(fixtureIndex),
                { tolerance: this.getZoomTolerance() }
            );
            const totalWidth = 12;
            const colors = fixtureShape.properties.colors;
            const widthPerLine = totalWidth / colors.length;
            const leftShift = (widthPerLine / colors.length) * (colors.length - 1);
            const newShapes = [];
            colors.forEach((color, index) => {
                newShapes.push(L.polyline(
                    turf.getCoords(turf.flip(fixtureShape)),
                    { color, weight: widthPerLine, offset: 0 - leftShift + (index * widthPerLine) }
                ).addTo(this));
            });
            this.drawnFixtures.set(fixtureIndex, newShapes);
        });
    }

    getZoomTolerance() {
        switch (this.getZoom()) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9: return 1;
            case 10: return 0.01;
            case 11: return 0.001;
            case 12:
            case 13: return 0.0001;
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20: return 0.00001;
        }
    }
}

function getStoredCoords() {
    const stored = localStorage.getItem('last_map_coords');
    return stored ? JSON.parse(stored) : undefined;
}

function getStoredMapStyle() {
    const stored = localStorage.getItem('last_map_style');
    if (stored) {
        const code = stored.split(".");
        const styles = maptilersdk.MapStyle;
        return code.length === 2 ? styles[code[0]][code[1]] : styles[code[0]];
    }
    return undefined;
}