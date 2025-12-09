const fileCount = 44;
const totalSteps = fileCount + 2;
let progress = 0;
const dispatchProgress = () => {
    const delta = Math.round(progress / totalSteps * 100);
    window.dispatchEvent(new CustomEvent('loadProgress', { detail: delta }))
};
const dispatchFinished = () => window.dispatchEvent(new CustomEvent('loadFinished'));

try {
    const response = await fetch('../js/routes-output.json');
    window.ROUTES = await response.json();
    progress++;
    dispatchProgress();
    console.log(`Fetched routes`);
} catch (e) {
    console.log(`Error while fetching routes`, e);
}

const tripsLoaded = [];
console.log(`Loading trips...`);
for (let a = 0; a < fileCount; a++) {
    const filename = `./js/trips-output-${a}.json`;
    progress++;
    dispatchProgress();
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            console.log(`Skipping ${filename}: ${response.status}`);
            continue;
        }
        const newTrips = await response.json();
        tripsLoaded.push(...newTrips);
    } catch (e) {
        console.log(`Skipping ${filename}: ${response.status}`);
        continue;
    }
}
console.log(`Loaded ${tripsLoaded.length} trips`);
window.TRIPS = tripsLoaded;
window.dispatchEvent(new CustomEvent('tripsLoaded'));

progress++;
dispatchProgress();
try {
    const response = await fetch('../js/trips-sorted-output.json');
    const sortedTrips = await response.json();
    console.log(`Fetched sorted trips`);
    window.TRIP_SORT = sortedTrips;
    window.dispatchEvent(new CustomEvent('tripsSorted'));
} catch (e) {
    console.log(`Error while fetching sorted trips`, e);
}

dispatchFinished();