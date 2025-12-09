function parseCSV(data) {
    const rows = data.split('\n'); // Split into rows
    const result = rows.map(row => row.split(',')); // Split each row into columns
    return result;
}
function convertTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}
// Function to get current time in seconds since midnight
function getCurrentTimeInSeconds() {
    const now = new Date();

    // Extract hours, minutes, and seconds
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Convert to total seconds
    return hours * 3600 + minutes * 60 + seconds;
}
function convertSecondsToTimeString(timestamp) {
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
function getHourFromTimestamp(timestamp) {
    const dateObj = new Date(parseInt(timestamp) * 1000);
    const hours = dateObj.getUTCHours();
    return parseInt(hours);
}

function isNumeric(str) {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}