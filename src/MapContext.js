import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import * as turf from '@turf/turf';
import L, { Map as LeafletMap } from 'leaflet';
import { fixtureIndex as fixtures, getFixtureShape as getFixtureShape } from './models/fixtures';
import { dispatch, getStored, store } from './misc/utilities.mjs';

const defaultCoords = [32.780694233921906, -96.79930204561467]; // Downtown Dallas
const defaultZoomLevel = 13;
const defaultMapStyleCode = 'STREETS.DARK';

export default class MapContext extends LeafletMap {
    activeTrips = new Set();
    drawnFixtures = new Map();

    static STYLE_CHANGED = 'map-style-changed';

    constructor(containerId) {
        super(containerId);
        this.setView(
            getStoredCoords() ?? defaultCoords,
            getStored('map-zoom') ?? defaultZoomLevel,
        );
        this.tileLayer = new MaptilerLayer({
            apiKey: import.meta.env.VITE_MAPTILER_API_KEY,
            opacity: getStored('map-opacity') ?? 1,
        }).addTo(this);
        this.setStyle(getStored('map-style') ?? defaultMapStyleCode);
        this.on('zoomend', this.handleZoom);
        this.on('moveend', this.handleMove);
    }
    setStyle(styleCode) {
        this.style = styleCode;
        const code = styleCode.split(".");
        const styles = maptilersdk.MapStyle;
        this.tileLayer.setStyle(code.length === 2 ? styles[code[0]][code[1]] : styles[code[0]]);
        store('map-style', styleCode);
        dispatch(MapContext.STYLE_CHANGED, styleCode);
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
        store('map-zoom', this.getZoom());
        this.redrawFixtures();
    }
    handleMove(e) {
        store('map-coords', JSON.stringify(this.getCenter()));
    }
    redrawFixtures = () => {
        Object.keys(fixtures).forEach(fixtureIndex => {
            if (this.drawnFixtures.has(fixtureIndex)) {
                const prior = this.drawnFixtures.get(fixtureIndex);
                prior.forEach(layer => this.removeLayer(layer));
                this.drawnFixtures.delete(fixtureIndex);
            }
            const fixtureFeature = getFixtureShape(fixtureIndex);
            if (!fixtureFeature) return;
            const fixtureShape = turf.simplify(
                fixtureFeature,
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
    const stored = getStored('map-coords');
    return stored ? JSON.parse(stored) : undefined;
}