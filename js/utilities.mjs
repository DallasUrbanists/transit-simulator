import { loadEnvFile } from 'node:process';
loadEnvFile('../.env');

export function absURL(path) {
    return (new URL(path, process.env.BASE_URL)).href;
}

export async function fetchText(sourceFile) {
    const file = await fetch(sourceFile);
    return file.text();
}

export function sanitize(string) {
    if (string === null || string === undefined) return '';
    return string.toString().trim();
}

export function saniKey(string) {
    return sanitize(string).toLowerCase();
}

export const convert = {
    milesToFeet: (miles = 1) => miles * 5280,
    daysToSeconds: (days = 1) => days * 24 * 60 * 60,
    secondsToTimeString: timestamp => {
        const dateObj = new Date(parseInt(timestamp) * 1000);
        const hours = dateObj.getUTCHours();
        const f = s => s.toString().padStart(2, '0');
        let h = hours;
        if (hours === 0) h = 12;
        else if (hours > 12) h = hours - 12;
        return `${f(h)}:${f(dateObj.getUTCMinutes())}:${f(dateObj.getSeconds())} ${hours >= 12 ? 'PM' : 'AM'}`;
    },
    timeStringToSeconds: timeString => {
        const n = timeString.split(':');
        return parseInt(n[0]) * 3600 + parseInt(n[1]) * 60 + parseInt(n[2]);
    },
    secondsToHour: timestamp => parseInt(new Date(parseInt(timestamp) * 1000).getUTCHours()),
    nowInSeconds: () => {
        const now = new Date();
        return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    },
    csvToArray: string => string.split('\n').map(row => row.split(',')),
    arrayToColumnIndex: array => array.reduce((map, column, index) => map.set(saniKey(column), index), new Map()),
};


export async function convertCSVToDictionary(sourceFile, primaryKey) {
    const rowsAsArray = convert.csvToArray(await fetchText(sourceFile));
    const columnIndex = convert.arrayToColumnIndex(rowsAsArray[0]);
    const pk = saniKey(primaryKey);
    if (!columnIndex.has(pk)) throw new Error(`The CSV contents of ${sourceFile} doesn't have a '${primaryKey}' column.`);
    return rowsAsArray.slice(1).reduce((rowsAsMap, rowAsArray) => {
        const rowKey = rowAsArray[columnIndex.get(pk)];
        if (rowKey !== '') {
            rowsAsMap.set(rowAsArray[columnIndex.get(pk)], columnIndex.entries().reduce((map, entry) => {
                map.set(entry[0], sanitize(rowAsArray[entry[1]]));
                return map;
            }, new Map()));
        }
        return rowsAsMap;
    }, new Map());
}

export function setIfNotHas(property, value, map) {
    if (!map.has(property)) {
        map.set(property, value);
    }
    return map.get(property);
}