const MILE_IN_FEET = 5280;
const MILE_IN_METERS = 1609.344;
const END_OF_DAY = 60 * 60 * 24;
const app = ((settings) => {
    const map = L.map('map').setView(settings.defaultCoords, settings.defaultZoomLevel);
    const busPane = map.createPane('busPane');
    const busPathsPane = map.createPane('busPathsPane');
    const lightRailPane = map.createPane('lightRailPane');
    const lightRailPathsPane = map.createPane('lightRailPathsPane');
    const commuterRailPane = map.createPane('commuterRailPane');
    const commuterRailPathsPane = map.createPane('commuterRailPathsPane');
    const streetcarPane = map.createPane('streetcarPane');
    const streetcarPathsPane = map.createPane('streetcarPathsPane');
    const tileLayer = L.maptiler.maptilerLayer({ apiKey: settings.maptilerApiKey, style: settings.defaultMapStyle }).addTo(map);
    const activeTrips = {};
    const fadePile = [];
    //const parkedVehicles = new Map();
    const allVehicles = L.layerGroup().addTo(map);
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
    const choosePathsPane = (label) => {
        switch (label) {
            case 'B':
            case 'R':
            case 'O':
            case 'G':
                return 'lightRailPathsPane';
            case 'S':
            case 'TRE':
                return 'commuterRailPathsPane';
            case 'M':
            case 'DSC':
                return 'streetcarPathsPane';
            default:
                return 'busPathsPane';
        }
    };
    const chooseMarkerClassName = (label) => {
        switch (label) {
            case 'B':
            case 'R':
            case 'O':
            case 'G':
                return 'light-rail train rail';
            case 'S':
            case 'TRE':
                return 'commuter-rail train rail';
            case 'M':
            case 'DSC':
                return 'streetcar rail';
            default:
                return 'bus';
        }
    };
    // const chooseParkingRadius = (label) => {
    //     switch (label) {
    //         case 'M':
    //         case 'DSC':
    //             return MILE_IN_METERS;
    //         case 'B':
    //         case 'R':
    //         case 'O':
    //         case 'G':
    //         case 'S':
    //         case 'TRE':
    //             return MILE_IN_METERS * 10;
    //         default:
    //             return MILE_IN_METERS * 3;
    //     }
    // };
    // const chooseParkedOpacity = (label) => {
    //     switch (label) {
    //         case 'M':
    //         case 'DSC':
    //         case 'B':
    //         case 'R':
    //         case 'O':
    //         case 'G':
    //         case 'S':
    //         case 'TRE':
    //             return 1;
    //         default:
    //             return 0.25;
    //     }
    // };
    const measureDistanceFeet = (latLng1, latLng2) => {
        const lat = 0, lng = 1;
        return turf.distance(
            turf.point([latLng1[lng], latLng1[lat]]),
            turf.point([latLng2[lng], latLng2[lat]]),
            { units: 'feet' }
        );
    };
    // const clearParkedVehicles = () => {
    //     for (const [key, value] of parkedVehicles) {
    //         map.removeLayer(value);
    //         parkedVehicles.delete(key);
    //     }
    //     parkedVehicles.clear();
    // };
    // const findNearestParked = (tripLabel, latLng) => {
    //     const parkedForTrip = parkedVehicles.get(tripLabel) ?? [];
    //     for (let i = 0; i < parkedForTrip.length; i++) {
    //         const parkedMarker = parkedForTrip[i];
    //         const distanceMeters = map.distance(latLng, parkedMarker.getLatLng());
    //         if (distanceMeters <= chooseParkingRadius(tripLabel)) {
    //             return parkedMarker;
    //         }
    //     }
    //     return undefined;
    // };
    // const parkVehicle = (tripLabel, marker) => {
    //     if (!parkedVehicles.has(tripLabel)) {
    //         parkedVehicles.set(tripLabel, []);
    //     }
    //     parkedVehicles.get(tripLabel).push(marker);
    //     const parkedForTrip = parkedVehicles.get(tripLabel);
    //     console.log(parkedForTrip.length);
    //     if (parkedForTrip.length > 2) {
    //         parkedVehicles.set(tripLabel, parkedForTrip.slice(-2));
    //     }
    //     console.log(parkedVehicles.get(tripLabel).length);
    //     if (window.playhead > END_OF_DAY) {
    //         marker.setOpacity(0);
    //     } else {
    //         marker.setOpacity(chooseParkedOpacity(tripLabel));
    //     }
    //     marker.parkingStart = window.playhead;
    // };
    // const unparkVehicle = (tripLabel, marker) => {
    //     const parked = parkedVehicles.get(tripLabel);
    //     if (parked) {
    //         parkedVehicles.set(tripLabel, parked.filter(m => m != marker));
    //     }
    // };
    const render = (targetPlayhead) => {
        if (!window.TRIPS || !window.TRIP_SORT || !window.ROUTES) {
            console.log('Not ready to render.');
            return;
        }

        const activeHour = getHourFromTimestamp(targetPlayhead);
        window.TRIP_SORT[activeHour]
            .filter(trip => trip.startSeconds <= targetPlayhead && trip.endSeconds >= targetPlayhead)
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
            const segments = trip.details.trip_segments;
            const firstPosition = segments[0].geometry.coordinates[0];
            const latLng = latLngFromCoord(firstPosition);
            // const nearestParked = findNearestParked(trip.label, latLng);
            if (targetPlayhead < trip.startSeconds || targetPlayhead > trip.endSeconds) {
                if (isPlaying()) {
                    // if (trip.marker && !nearestParked) {
                    //     parkVehicle(trip.label, trip.marker);
                    // } else {
                    const marker = trip.marker;
                    marker.setOpacity(0.5);
                    trip.shadow = marker;
                    setTimeout(() => {
                        marker.setOpacity(0);
                        setTimeout(() => {
                            trip.shadow = null;
                            allVehicles.removeLayer(marker);
                            map.removeLayer(marker);
                        }, 1000);
                    }, 2000);
                    // }
                    trip.marker = null;
                    if (trip.tail) {
                        fadePile.push(trip.tail);
                        trip.tail = null;
                    }
                } else {
                    if (trip.marker) {
                        map.removeLayer(trip.marker);
                        delete trip.marker;
                    }
                    if (trip.tail) {
                        map.removeLayer(trip.tail);
                        delete trip.tail;
                    }
                }
                trip.history = [];
                activeTrips[tripId] = null;
                continue;
            }
            if (!trip.label) {
                trip.label = labelSubstitution(trip.route.short_name);
            }
            if (!trip.marker) {
                // if (nearestParked) {
                //     trip.marker = nearestParked;
                //     unparkVehicle(trip.label, trip.marker);
                // } else {
                if (trip.shadow) {
                    trip.shadow.setOpacity(0);
                }
                const className = `transit-icon vehicle-${trip.label} ${chooseMarkerClassName(trip.label)}`;
                const icon = L.divIcon({ className, html: trip.label, iconSize: [24, 24] });
                trip.marker = L.marker(latLng, { icon, pane: choosePane(trip.label) }).addTo(allVehicles);
                trip.marker.type = 'vehicle';
                trip.marker.label = trip.label;
                // }
            }
            trip.marker.setOpacity(1);
            if (!trip.history) {
                trip.history = [];
            }
            if (isPlaying()) {
                const minTailLength = 8;
                const maxTailLength = Math.round(8192 / window.playSpeed);
                const maxTailEndLength = MILE_IN_FEET;
                if (trip.history.length > maxTailLength) {
                    trip.history = trip.history.slice(maxTailLength * -1);
                }
                if (trip.history.length >= minTailLength) {
                    try {
                        // If either end of tail is more than a few miles long, it's probably due to an awkward jump
                        // We want to prevent this by resetting history when either end becomes too long
                        const indexA = trip.history.length - 1;
                        const positionA = trip.history[indexA];
                        const positionB = trip.history[indexA - 1];
                        const tailLengthAB = measureDistanceFeet(positionA, positionB);
                        if (tailLengthAB > maxTailEndLength) {
                            trip.history = [];
                        } else {
                            const positionC = trip.history[1];
                            const positionD = trip.history[0];
                            const tailLengthCD = measureDistanceFeet(positionC, positionD);
                            if (tailLengthCD > maxTailEndLength) {
                                trip.history = [];
                            } else {
                                if (!trip.tail) {
                                    const { weight, opacity } = chooseStyle(trip.label);
                                    const pathPane = choosePathsPane(trip.label);
                                    trip.tail = L.polyline(trip.history, {
                                        className: `tail-${trip.label} ${chooseMarkerClassName(trip.label)}`,
                                        color: `#${trip.route.color}`,
                                        weight,
                                        opacity,
                                        pane: pathPane
                                    }).addTo(map);
                                    trip.tail.type = 'tail';
                                } else {
                                    trip.tail.setLatLngs(trip.history);
                                }
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        console.log(trip.history);
                    }
                }
            } else {
                if (trip.tail) {
                    fadePile.push(trip.tail);
                    trip.tail = null;
                }
                trip.history = [];
            }

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const startSec = segment.properties.startSeconds;
                const endSec = segment.properties.endSeconds;
                const duration = segment.properties.durationSeconds;
                const distance = segment.properties.distanceFeet;
                if (targetPlayhead <= startSec) {
                    const newPos = latLngFromCoord(firstCoord(segment));
                    trip.marker.setLatLng(newPos);
                    if (isPlaying()) {
                        if (
                            trip.history.length === 0 ||
                            trip.history[trip.history.length - 1] == newPos
                        ) {
                            trip.history.push(newPos);
                        }
                    }
                    break;
                }
                if (targetPlayhead <= endSec) {
                    const elapsedSeconds = targetPlayhead - startSec;
                    const elapsedRatio = elapsedSeconds / duration;
                    const easedRatio = easeInOutCubic(elapsedRatio);
                    const elapsedDistance = distance * easedRatio;
                    const newPos = turf.flip(
                        turf.along(segment, elapsedDistance, { units: 'feet' })
                    ).geometry.coordinates;
                    trip.marker.setLatLng(newPos);
                    if (isPlaying()) {
                        trip.history.push(newPos);
                    }
                    break;
                }
            }
        }

        fadePile.forEach((layer, index) => {
            if (!layer) {
                return;
            }
            if (!isPlaying()) {
                map.removeLayer(layer);
                fadePile.splice(index, 1);
                return;
            }
            switch (layer.type) {
                case 'tail':
                    const latLngs = layer.getLatLngs();
                    if (latLngs.length <= 5) {
                        map.removeLayer(layer);
                        fadePile.splice(index, 1);
                    } else {
                        latLngs.shift();
                        layer.setLatLngs(latLngs);
                    }
                    break;
                case 'vehicle':
                    const secondsInPile = targetPlayhead - layer.timeOfEnd;
                    const secondsToFade = 2 * window.playSpeed;
                    if (secondsInPile >= secondsToFade) {
                        map.removeLayer(layer);
                        fadePile.splice(index, 1);
                    } else {
                        layer.setOpacity(easeOutQuad(1 - secondsInPile / secondsToFade));
                    }
                    break;
                default:
                    fadePile.splice(index, 1);
                    map.removeLayer(layer);
                    break;
            }
        });

        // for (const [tripLabel, markers] of parkedVehicles) {
        //     // To help prevent abandoned parking, limit number of parked vehicles per route
        //     if (markers.length > 2) {
        //         const surplus = markers.splice(2);
        //         surplus.forEach(marker => {
        //             allVehicles.removeLayer(marker);
        //             map.removeLayer(marker);
        //         });
        //     }
        //     markers.forEach(marker => {
        //         const timeParked = targetPlayhead - marker.parkingStart;
        //         const maxParkedTime = 4 * window.playSpeed;
        //         if (timeParked > maxParkedTime || timeParked < 0) {
        //             marker.setOpacity(0);
        //             setTimeout(() => {
        //                 allVehicles.removeLayer(marker);
        //                 map.removeLayer(marker);
        //                 parkedVehicles.delete(tripLabel);
        //             }, 2000);
        //         }
        //     });
        // }
    };
    const emptyHours = new Set();
    const pulse = (timestamp) => {
        const deltaMilliseconds = Math.max(0, timestamp - window.startTimestamp);
        const deltaSeconds = (deltaMilliseconds * window.playSpeed) / 1000;
        let newPlayhead = window.startPlayhead + deltaSeconds;
        const activeTripCount = Object.values(activeTrips).filter(t => t).length;
        const activeHour = getHourFromTimestamp(newPlayhead);

        render(newPlayhead);

        // If last render resulted in zero empty trips and is past midnight
        // Then reset the clock to restart animation from the beginning on next pulse
        if (newPlayhead > END_OF_DAY && activeTripCount === 0) {
            // clearParkedVehicles();
            allVehicles.clearLayers();
            if (!emptyHours.has(activeHour)) {
                emptyHours.add(activeHour);
            }
        }
        if (emptyHours.size > 1) {
            newPlayhead = newPlayhead - END_OF_DAY;
            window.startTimestamp = timestamp;
            window.startPlayhead = newPlayhead;
            setPlayhead(newPlayhead);
            emptyHours.clear();
        } else {
            setPlayhead(newPlayhead);
        }

        if (isPlaying()) {
            window.appAnimation = requestAnimationFrame(pulse);
        }
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
    const scrub = (newPlayhead) => {
        stopPlayback();
        //clearParkedVehicles();
        setPlayhead(newPlayhead);
        render(newPlayhead);
    };

    window.playhead = 0;
    window.playSpeed = settings.defaultPlaySpeed;

    const px = (n) => `${n}px`;

    const handleZoomScaling = () => {
        const currentZoom = map.getZoom();
        const busIcons = document.querySelectorAll('.transit-icon.bus, .transit-icon.streetcar');
        const lightRailPathPane = document.querySelector('.leaflet-pane.leaflet-lightRailPaths-pane');
        const commuterRailPathPane = document.querySelector('.leaflet-pane.leaflet-commuterRailPaths-pane');
        if (currentZoom < 12) {
            lightRailPathPane.style.zIndex = 415;
            commuterRailPathPane.style.zIndex = 420;
        } else {
            lightRailPathPane.style.zIndex = 315;
            commuterRailPathPane.style.zIndex = 320;
        }
        busIcons.forEach(icon => {
            let iconSize, fontSize;
            if (currentZoom < 12) {
                iconSize = 12;
                fontSize = 7;
            } else {
                iconSize = 24;
                fontSize = 12;
            }
            icon.style.width = px(iconSize);
            icon.style.height = px(iconSize);
            icon.style.fontSize = px(fontSize);
            icon.style.lineHeight = px(iconSize);
            icon.style.marginLeft = px(iconSize / -2);
            icon.style.marginTop = px(iconSize / -2);
        });
    };

    map.on('zoomend', handleZoomScaling);
    map.on('layeradd', handleZoomScaling);

    return {
        render,
        isPlaying,
        setPlayhead,
        setPlaySpeed,
        scrub,
        startPlayback,
        stopPlayback,
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
    defaultPlaySpeed: 64,
    vehicleFadeTTL: 10000,
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
        console.error('segment not found');
        return null;
    }

    const elapsedSeconds = window.playhead - currentSegment.properties.startSeconds;
    const elapsedRatio = elapsedSeconds / currentSegment.properties.durationSeconds;
    const elapsedDistance = currentSegment.properties.distanceFeet * elapsedRatio;
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

function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
}
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}