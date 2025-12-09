const app = ((settings) => {
    const map = L.map('map').setView(settings.defaultCoords, settings.defaultZoomLevel);
    const busPane = map.createPane('busPane');
    const lightRailPane = map.createPane('lightRailPane');
    const commuterRailPane = map.createPane('commuterRailPane');
    const streetcarPane = map.createPane('streetcarPane');
    const tileLayer = L.maptiler.maptilerLayer({ apiKey: settings.maptilerApiKey, style: settings.defaultMapStyle }).addTo(map);
    const activeTrips = {};
    const fadePile = [];
    const dispatchUpdate = () => window.dispatchEvent(new CustomEvent('playheadChanged'));
    const isPlaying = () => window.appIsPlaying === true;
    const setPlayhead = (seconds) => {
        window.playhead = seconds;
        dispatchUpdate();
    };
    const setPlaySpeed = (speed) => {
        window.playSpeed = speed;
        if (isPlaying()) {
            window.cancelAnimationFrame(window.appAnimation);
            window.startTimestamp = performance.now();
            window.startPlayhead = window.playhead;
            window.appAnimation = requestAnimationFrame(pulse);
        } else {
            dispatchUpdate();
        }
    };
    const chooseStyle = (label) => {
        switch (label) {
            case 'B':
            case 'R':
            case 'O':
            case 'G':
                return { weight: 8, opacity: 1 };
            case 'S':
            case 'TRE':
                return { weight: 12, opacity: 1 };
            case 'M':
            case 'DSC':
                return { weight: 6, opacity: 0.75 };
            default:
                return { weight: 4, opacity: 0.75 };
        }
    };
    const choosePane = (label) => {
        switch (label) {
            case 'B':
            case 'R':
            case 'O':
            case 'G':
                return lightRailPane;
            case 'S':
            case 'TRE':
                return commuterRailPane;
            case 'M':
            case 'DSC':
                return streetcarPane;
            default:
                return busPane;
        }
    };
    const pulse = (timestamp) => {
        const deltaMilliseconds = Math.max(0, timestamp - window.startTimestamp);
        const deltaSeconds = (deltaMilliseconds * window.playSpeed) / 1000;
        const newPlayhead = window.startPlayhead + deltaSeconds;

        if (window.TRIPS && window.TRIP_SORT && window.ROUTES) {
            const activeHour = getHourFromTimestamp(newPlayhead);
            window.TRIP_SORT[activeHour]
                .filter(trip => trip.startSeconds <= newPlayhead && trip.endSeconds >= newPlayhead)
                .map(trip => {
                    if (!trip.details) {
                        trip.details = window.TRIPS.find(t => t.trip_id == trip.trip_id);
                    }
                    // Ignore weekend service trips
                    if (['3', '4'].includes(trip.details.service_id)) {
                        return;
                    }
                    if (!activeTrips[trip.trip_id]) {
                        activeTrips[trip.trip_id] = trip;
                    }
                    if (!trip.route) {
                        trip.route = window.ROUTES.find(r => r.id == trip.details.route_id);
                    }
                });
            for (let tripId in activeTrips) {
                const trip = activeTrips[tripId];
                if (!trip) {
                    continue;
                }
                if (newPlayhead < trip.startSeconds || newPlayhead > trip.endSeconds) {
                    trip.history = [];
                    if (trip.marker) {
                        map.removeLayer(trip.marker);
                        trip.marker = null;
                    }
                    if (trip.tail) {
                        fadePile.push(trip.tail);
                        trip.tail = null;
                    }
                    activeTrips[tripId] = null;
                    continue;
                }
                const segments = trip.details.trip_segments;
                if (!trip.label) {
                    trip.label = labelSubstitution(trip.route.short_name);
                }
                if (!trip.marker) {
                    const firstPosition = segments[0].geometry.coordinates[0];
                    const latLng = latLngFromCoord(firstPosition);
                    const className = 'transit-icon vehicle-' + trip.label;
                    const icon = L.divIcon({ className, html: trip.label, iconSize: [24, 24] });
                    //console.log(choosePane(trip.label));
                    trip.marker = L.marker(latLng, { icon, pane: choosePane(trip.label) }).addTo(map);
                }
                if (!trip.history) {
                    const first = trip.marker.getLatLng();
                    trip.history = [[first.lat, first.lng]];
                }
                const minTailLength = 4;
                const maxTailLength = Math.round(8192 / window.playSpeed);
                if (trip.history.length > maxTailLength) {
                    trip.history = trip.history.slice(maxTailLength * -1);
                }
                if (trip.history.length >= minTailLength) {
                    try {
                        const tailLength = turf.distance(
                            turf.point([trip.history[0][1], trip.history[0][0]]),
                            turf.point([trip.history[2][1], trip.history[2][0]]),
                            { units: 'feet' }
                        );
                        // If the base of tail is more than a mile long, it's probably due to an awkward jump from terminal to terminal
                        // We don't want tails like this, so reset history before drawing tail
                        if (tailLength > 5280) {
                            trip.history = [];
                        } else {
                            if (!trip.tail) {
                                const { weight, opacity } = chooseStyle(trip.label);
                                trip.tail = L.polyline(trip.history, {
                                    color: `#${trip.route.color}`,
                                    weight,
                                    opacity,
                                }).addTo(map);
                            } else {
                                trip.tail.setLatLngs(trip.history);
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        console.log(trip.history);
                    }
                }

                for (let i=0; i<segments.length; i++) {
                    const segment = segments[i];
                    const startSec = segment.properties.startSeconds;
                    const endSec = segment.properties.endSeconds;
                    const duration = segment.properties.durationSeconds;
                    const distance = segment.properties.distanceFeet;
                    if (newPlayhead <= startSec) {
                        const newPos = latLngFromCoord(firstCoord(segment));
                        trip.marker.setLatLng(newPos);
                        trip.history.push(newPos);
                        break;
                    }
                    if (newPlayhead <= endSec) {
                        const elapsedSeconds = newPlayhead - startSec;
                        const elapsedRatio = elapsedSeconds / duration;
                        const elapsedDistance = distance * elapsedRatio;
                        const newPos = turf.flip(
                            turf.along(segment, elapsedDistance, { units: 'feet' })
                        ).geometry.coordinates;
                        trip.marker.setLatLng(newPos);
                        trip.history.push(newPos);
                        break;
                    }
                }
            }
        }

        fadePile.forEach((layer, index) => {
            if (!layer) {
                return;
            }
            const latLngs = layer.getLatLngs();
            if (latLngs.length <= 5) {
                map.removeLayer(layer);
                fadePile.splice(index, 1);
            } else {
                latLngs.shift();
                layer.setLatLngs(latLngs);
            }
        });

        setPlayhead(newPlayhead);
        window.appAnimation = requestAnimationFrame(pulse);
    };
    const startPlayback = () => {
        window.appIsPlaying = true;
        window.startTimestamp = performance.now();
        window.startPlayhead = window.playhead;
        window.appAnimation = requestAnimationFrame(pulse);
        dispatchUpdate();
    };
    const stopPlayback = () => {
        window.appIsPlaying = false;
        window.cancelAnimationFrame(window.appAnimation);
        dispatchUpdate();
    };
    const initiateTrip = (trip) => {
        const route = window.ROUTES.find(r => r.id == trip.route_id);
        const latLng = findCurrentTripLatLng(trip);
        const icon = L.divIcon({
            className: 'transit-icon',
            html: route.short_name,
            iconSize: [24, 24],
        });
        try {
            const marker = L.marker(latLng, { icon }).addTo(map);
            tripMarkers.set(trip.trip_id, marker);
        } catch (e) {
            console.log([route, latLng, trip]);
            console.error(e);
        }
    };
    const deactivateTrip = (trip_id) => {
        const marker = tripMarkers.get(trip_id);
        map.removeLayer(marker);
        tripMarkers.delete(trip_id);
    };
    const moveMarkers = () => {

    };

    window.playhead = 0;
    window.playSpeed = settings.defaultPlaySpeed;

    return {
        isPlaying,
        setPlayhead,
        setPlaySpeed,
        initiateTrip,
        deactivateTrip,
        moveMarkers,
        togglePlay: () => isPlaying() ? stopPlayback() : startPlayback(),
        setMapStyle: (style) => {
            const style_code = style.split(".");
            style_code.length === 2
                ? tileLayer.setStyle(maptilersdk.MapStyle[style_code[0]][style_code[1]])
                : tileLayer.setStyle(maptilersdk.MapStyle[style_code[0]])
                ;
        },
    };
})({
    defaultCoords: [32.780694233921906, -96.79930204561467],
    maptilerApiKey: '4I9PqHwTZ9xDdwVnOp74',
    defaultZoomLevel: 13,
    defaultMapStyle: maptilersdk.MapStyle['STREETS']['DARK'],
    defaultPlaySpeed: 64
});

function labelSubstitution(string) {
    if (['RED', 'BLUE', 'ORANGE', 'GREEN', 'SILVER'].includes(string)) {
        return string.charAt(0);
    }
    if (string === '620') {
        return 'DSC';
    }
    if (string === '425') {
        return 'M';
    }
    return string;
}

function findCurrentTripLatLng(trip) {
    const currentSegment = trip.trip_segments.find(s => {
        return s.properties.startSeconds <= window.playhead && s.properties.endSeconds >= window.playhead;
    });

    if (!currentSegment) {
        console.log([trip.trip_segments.map(seg => [seg.properties.startSeconds, seg.properties.endSeconds]), window.playhead]);
        console.error('segment not found');
        return null;
    }

    const elapsedSeconds = window.playhead - currentSegment.properties.startSeconds;
    const elapsedRatio = elapsedSeconds / currentSegment.properties.durationSeconds;
    const elapsedDistance =  currentSegment.properties.distanceFeet * elapsedRatio;
    const point = turf.along(currentSegment, elapsedDistance, { units: 'feet' });
    return turf.flip(point).geometry.coordinates;
}

function latLngFromCoord(lngLat) {
    return [lngLat[1], lngLat[0]];
}

function firstCoord(feature) {
    return feature.geometry.coordinates[0];
}

function lastCoord(feature) {
    return feature.geometry.coordinates[feature.geometry.coordinates.length - 1];
}