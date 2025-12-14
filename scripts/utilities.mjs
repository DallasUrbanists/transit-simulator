const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BASE_URL) || 'http://localhost:5173/';

export const $ = query => document.querySelector(query);
export const $$ = query => document.querySelectorAll(query);

export function absURL(path) {
    if (typeof window === 'undefined') {
        return (new URL(path, BASE_URL)).href;
    }
    return path;
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

export function randomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

export function isLight(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 100; // true = light, false = dark
}

export function minValMax(min, val, max) {
    return Math.min(
        max,
        Math.max(
            min,
            val
        )
    );
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

export const ease = {
    inOutCubic: (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
};

export async function convertCSVToDictionary(sourceFile, primaryKey, transform) {
    const rowsAsArray = convert.csvToArray(await fetchText(sourceFile));
    const columnIndex = convert.arrayToColumnIndex(rowsAsArray[0]);
    const pk = saniKey(primaryKey);
    if (!columnIndex.has(pk)) throw new Error(`The CSV contents of ${sourceFile} doesn't have a '${primaryKey}' column.`);
    return rowsAsArray.slice(1).reduce((rowsAsMap, rowAsArray) => {
        const rowKey = rowAsArray[columnIndex.get(pk)];
        if (rowKey !== '') {
            const rowId = rowAsArray[columnIndex.get(pk)];
            const rowAsMap = new Map();
            columnIndex.entries().reduce((map, entry) => {
                map.set(entry[0], sanitize(rowAsArray[entry[1]]));
                return map;
            }, rowAsMap);
            if (typeof transform === 'function') {
                const transformation = transform(rowAsMap);
                if (transformation) {
                    rowsAsMap.set(rowId, transformation);
                }
            } else {
                rowsAsMap.set(rowId, rowAsMap);
            }
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

export const DAY = convert.daysToSeconds(1);