let debugTripShape;

window.debugTrip = (tripId) => {
    const trip = getTrip(tripId);
    const shape = trip.get('shape');
    debugTripShape = L.geoJSON(shape, {
        style: () => ({ color: '#FFFFFF', weight: 10 })
    }).addTo(map).getLayers()[0];
    console.log(trip);
};

window.debugTripSlice = (tripId, index) => {
    const trip = getTrip(tripId);
    const shape = trip.get('shape');
    const coords = turf.getCoords(turf.flip(shape));
    const sliced = coords.slice(0, index);
    debugTripShape.setLatLngs(sliced);
    console.log(sliced);
};

const debugSegments = new Set();

window.debugSegment = (tripId, segmentIndex) => {
    const trip = getTrip(tripId);
    const segments = trip.get('segments');
    const currentSegment = segments[segmentIndex];

    const geoLayers = L.geoJSON(currentSegment, {
        style: () => ({ color: randomColor() })
    }).addTo(map);
    const lineLayer = geoLayers.getLayers()[0];

    debugSegments.add(lineLayer);

    console.log({
        trip,
        segments,
        currentSegment,
        geoLayers,
        lineLayer
    });
};

window.clearMap = () => document.querySelectorAll('.transit-icon, .transit-tail').forEach(node => node.style.display = 'none');
