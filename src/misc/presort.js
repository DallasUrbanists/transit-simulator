import fs from 'fs';
import { convert } from './utilities.mjs';

const inputDirectory = '../public/GTFS/Amtrak/';
const outputDirectory = '../public/GTFS/AmtrakTexas/';
const read = filename => fs.readFileSync(inputDirectory+filename, { encoding: 'utf8', flag: 'r' });
const write = (filename, txt) => fs.writeFile(outputDirectory+filename, txt, () => { console.log('Wrote output to ' + filename) });

async function getRoutesIds() {
    const inputTxt = fs.readFileSync(outputDirectory+'routes.txt', { encoding: 'utf8', flag: 'r' });
    return convert.csvToArray(inputTxt).slice(1).map(row => row[0]);
} 

async function getTripsForRoutes(routes) {
    const trips = [];
    const shapes = [];
    const routeIdColumn = 0;
    const tripIdColumn = 2;
    const shapeIdColumn = 5;
    write('trips.txt', read('trips.txt').split('\n').filter((rowTxt, index) => {
        if (index === 0) return true;
        const rowArray = rowTxt.split(',');
        const tripId = rowArray[tripIdColumn];
        const routeId = rowArray[routeIdColumn];
        if (routes.includes(routeId)) {
            trips.push(tripId);
            shapes.push(rowArray[shapeIdColumn]);
            //console.log(`Trip ${tripId} of Route ${routeId} is ACCEPTED`);
            return true;
        }
        //console.log(`Trip ${tripId} is REJECTED`);
        return false;
    }).map(s => s.trim()).join('\n'));
    return { trips, shapes };
}

async function getShapes(shapeIds) {
    write('shapes.txt', read('shapes.txt').split('\n').filter((rowTxt, index) => {
        if (index === 0) return true;
        const shapeIdColumn = 0;
        const rowArray = rowTxt.split(',');
        return shapeIds.includes(rowArray[shapeIdColumn]);
    }).map(s => s.trim()).join('\n'));
}

async function getStopTimes(tripIds) {
    const stops = [];
    const tripIdColumn = 0;
    const stopIdColumn = 3;
    write('stop_times.txt', read('stop_times.txt').split('\n').filter((rowTxt, index) => {
        if (index === 0) return true;
        const rowArray = rowTxt.split(',');
        if (tripIds.includes(rowArray[tripIdColumn])) {
            stops.push(rowArray[stopIdColumn]);
            return true;
        }
        return false;
    }).map(s => s.trim()).join('\n'));
    return stops;
}

async function getStops(stopIds) {
    write('stops.txt', read('stops.txt').split('\n').filter((rowTxt, index) => {
        if (index === 0) return true;
        const stopIdColumn = 0;
        return stopIds.includes(rowTxt.split(',')[stopIdColumn]);
    }).map(s => s.trim()).join('\n'));
}

getRoutesIds().then(getTripsForRoutes).then(({ trips, shapes }) => {
    getShapes(shapes);
    getStopTimes(trips).then(getStops);
});

/*getRoutesIds().then(routes => {
    const inputFile = '../public/GTFS/Amtrak/shapes.txt';
    const inputTxt = fs.readFileSync(inputFile, { encoding: 'utf8', flag: 'r' });
    const outputArray = convert.csvToArray(inputTxt).filter((row, index) => {
        if (index === 0) {
            return true;
        }
        const rowAsArray = row.split(',');
        return rowAsArray[]
    });
});
/*
    , 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file: ', err);
            return;
        }
        string.split('\n').slice(1).forEach(rowAsTxt => {
            const rowAsArray = rowAsTxt.split(',');
            
        });
    });

}

inputFile = '../public/GTFS/Amtrak/shapes.txt';
fs.readFile(inputFile, 'utf8', (err, data) => {
    string.split('\n').slice(1).forEach(rowAsTxt => {
        const rowAsArray = rowAsTxt.split(',');
        
    });
});*/