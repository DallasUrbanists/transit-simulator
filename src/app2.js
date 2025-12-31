import Shape from "./models/Shape";
import Trip from "./models/Trip";
import Playback from "./Playback";
import SystemVisualization from "./programs/SystemVisualization";
import MapboxContext from "./widgets/MapboxContext";

const timezone = 'America/Chicago';
const map = new MapboxContext('map');
const program = new SystemVisualization();
const playback = new Playback(program);

window.playback = playback;
window.program = program;

async function main() {
    console.time('Get all trips');
    const trips = (await Trip.where('service_id').anyOf(['2', '14']).toArray()).map(t => Trip.fromObject(t));
    console.timeEnd('Get all trips');
    console.time('Get all shapes');
    const shapes = await Shape.all('map');
    console.timeEnd('Get all shapes');
    console.time('Assign shapes');
    trips.forEach(trip => trip.shape = shapes.get(trip.shape_id));
    console.timeEnd('Assign shapes');
    console.time('Segmentize trips');
    const segmentCache = new Map();
    for (let trip of trips) {
        await trip.segmentize({ replaceSegments: false, segmentCacheMap: segmentCache });
    }
    console.timeEnd('Segmentize trips');
    program.prepare({ map, timezone, trips }).then(() => {
        console.log('Ready to render!');
        program.render(playback.playhead);
    });
}

main();
