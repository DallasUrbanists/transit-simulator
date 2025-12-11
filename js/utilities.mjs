import { DateTime } from "luxon";
import fs from 'fs';

export function sanitizeKey(string) {
    if (string === null || string === undefined) {
        return '';
    }
    return string.toString().trim().toLowerCase();
}

export async function convertCSVToDictionary(sourceFile, primaryKey) {
    const parsedRows = parseCSV((await fs.readFileSync(sourceFile)).toString());    
    const columnIndex = {};
    const results = new Map();
    const pk = primaryKey.trim().toLowerCase();

    parsedRows[0].forEach((value, index) => columnIndex[value.trim().toLowerCase()] = index);

    if (!Object.keys(columnIndex).includes(pk)) {
        throw new Error(`The CSV contents of ${sourceFile} doesn't have a '${primaryKey}' column.`);
    }

    parsedRows.slice(1).forEach(row => {
        const result = new Map();
        for (let column in columnIndex) {
            const index = columnIndex[column];
            const value = row[index];
            result.set(column, typeof value === 'string' ? value.trim() : null);
        }
        if (result.has(pk)) {
            results.set(result.get(pk), result);
        }
    });

    return results;
}


export function parseCSV(data) {
    const rows = data.split('\n'); // Split into rows
    const result = rows.map(row => row.split(',')); // Split each row into columns
    return result;
}
export function convertTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}
export function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

// Function to get current time in seconds since midnight
export function getCurrentTimeInSeconds() {
    const now = new Date();

    // Extract hours, minutes, and seconds
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Convert to total seconds
    return hours * 3600 + minutes * 60 + seconds;
}
export function convertSecondsToTimeString(timestamp) {
    const dateObj = new Date(parseInt(timestamp) * 1000);
    const hours = dateObj.getUTCHours();
    const minutes = dateObj.getUTCMinutes();
    const seconds = dateObj.getSeconds();
    const meridian = hours >= 12 ? 'PM' : 'AM';

    let h = hours;
    if (hours === 0) {
        h = 12;
    } else if (hours > 12) {
        h = hours - 12;
    }

    return h.toString().padStart(2, '0') + ':' +
        minutes.toString().padStart(2, '0') + ':' +
        seconds.toString().padStart(2, '0') + ' ' + meridian;
}
export function getHourFromTimestamp(timestamp) {
    const dateObj = new Date(parseInt(timestamp) * 1000);
    const hours = dateObj.getUTCHours();
    return parseInt(hours);
}

export const convert = {
    milesToFeet: (miles = 1) => miles * 5280,
    daysToSeconds: (days = 1) => days * 24 * 60 * 60,
    secondsToTimeString: (seconds) => DateTime
        .fromSeconds(parseInt(seconds))
        .toLocaleString(DateTime.TIME_WITH_SECONDS),
};