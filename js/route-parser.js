import fs from 'fs';
import { parseCSV, isNumeric } from './utilities.js';

const routesText = await fs.readFileSync('../gtfs/DART/routes.txt');
const routes = parseCSV(routesText.toString()).slice(1).map(row => {
    let short_name = row[2];
    if (isNumeric(short_name)) {
        short_name = `${parseInt(short_name)}`;
    }
    return {
        id: parseInt(row[0]),
        short_name,
        long_name: (row[3]??'').trim(),
        type: parseInt(row[5]),
        color: (row[7]??'').trim(),
        text_color: (row[8]??'').trim(),
    }
});

const filename = './routes-output.json';
const routesJSON = JSON.stringify(routes, null, 2);
fs.writeFile(filename, routesJSON, err => {
    if (err) {
        console.error(err);
    } else {
        console.log(`File ${filename} written successfully`);
    }
});