import fs from 'fs';

export function sanitize(string) {
    if (string === null || string === undefined) return '';
    return string.toString().trim();
}

export function sanitizeKey(string) {
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
};

export function convertCSVToDictionary(sourceFile, primaryKey) {
    const rowsAsArray = convert.csvToArray((fs.readFileSync(sourceFile)).toString());
    const columnIndex = rowsAsArray[0].reduce((map, column, index) => map.set(sanitizeKey(column), index), new Map());
    const pk = sanitizeKey(primaryKey);
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