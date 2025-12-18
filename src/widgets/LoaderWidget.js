export default class Loader {
    static BLANK = '___';
    static PROGRESS = 'loadprogress';
    static FINISHED = 'loadfinished';
    static STEPS = [
        { key: 'routes', before: 'Find routes', during: 'Finding routes', after: `Found ${Loader.BLANK} routes` },
        { key: 'stops', before: 'Analyze stops', during: 'Analyzing stops', after: `Analyzed ${Loader.BLANK} stops` },
        { key: 'shapes', before: 'Draw shapes', during: 'Drawing shapes', after: `Drew ${Loader.BLANK} shapes` },
        { key: 'trips', before: 'Plan trips', during: 'Planning trips', after: `Planned ${Loader.BLANK} trips` },
        { key: 'segments', before: 'Calculate segment times', during: 'Calculating segment times...', after: `Timed ${Loader.BLANK} segments` },
    ];
}
