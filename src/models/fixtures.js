import { segments } from "./segments.js";
import * as turf from "@turf/turf";

const BLUE = '#198BC3';
const RED = '#FD3E3E';
const GREEN = '#006F38';
const ORANGE = '#F68B1F';
const SILVER = '#C0C0C0';

export const fixtureIndex = {
    texRail: { refShape: '33493', refIndexes: [1, 2, 3, 4, 5, 6], colors: ['#e91c2e']},
    silverTexRail: { refShape: '146593', refIndexes: [0], colors: ['#e91c2e', SILVER] },
    silverWest: { refShape: '146593', refIndexes: [1, 2, 3, 4, 5, 6], colors: [SILVER] },
    silverShiloh: { refShape: '146593', refIndexes: [7, 8], colors: [SILVER] },
    treVictoryUnion: { refShape: '146574', refIndexes: [8], colors: ['#002579'] },
    orangeDfwAirport: { refShape: '146517', refIndexes: [0, 1, 2, 3, 4, 5, 6], colors: [ORANGE] },
    blueRowlett: { refShape: '146460', refIndexes: [16, 17, 18, 19, 20, 21], colors: [BLUE] },
    treWest: { refShape: '146574', refIndexes: [1, 2, 3, 4, 5, 6], colors: ['#002579'] },
    treMedicalMarketVictory: { refShape: '146574', refIndexes: [7], colors: ['#002579'] },
    blueUntDallas: { refShape: '146460', refIndexes: [0, 1, 2, 3, 4, 5, 6], colors: [BLUE] },
    greenBuckner: { refShape: '146508', refIndexes: [0, 1, 2, 3, 4, 5, 6, 7], colors: [GREEN]},
    redWestmorelandBranch: { refShape: '146545', refIndexes: [0, 1, 2, 3], colors: [RED]},
    redBlue: { refShape: '146545', refIndexes: [4, 5, 6, 7], colors: [RED, BLUE]},
    redBlueOrangeGreen: { refShape: '146545', refIndexes: [8, 9, 10], colors: [GREEN, ORANGE, RED, BLUE]},
    redBlueOrange: { refShape: '146545', refIndexes: [11, 12], colors: [ORANGE, RED, BLUE,  ]},
    redOrange: { refShape: '146545', refIndexes: [13, 14, 15, 16, 17], colors: [ORANGE, RED, ]},
    redSpringValley: { refShape: '146545', refIndexes: [18, 19, 20, 21], colors: [RED]},
    redSilver: { refShape: '146545', refIndexes: [22], colors: [RED, SILVER ]},
    redParkerRoad: { refShape: '146545', refIndexes: [23, 24], colors: [RED ]},
    greenOrangeVictory: { refShape: '146508', refIndexes: [11], colors: [ORANGE, GREEN ]},
    greenOrangeTre: { refShape: '146508', refIndexes: [12], colors: [ORANGE, GREEN ]},
    greenOrangeBachman: { refShape: '146508', refIndexes: [13, 14, 15, 16], colors: [ORANGE, GREEN,  ]},
    aTrain: { refShape: '4911-A-OB', refIndexes: [0, 1, 2, 3, 4], colors: ['#a98300']},
    greenATrain: { refShape: '146508', refIndexes: [22], colors: [GREEN, '#a98300']},
    greenDowntownCarollton: { refShape: '146508', refIndexes: [17, 18, 19, 20, 21], colors: [GREEN ]},
    treTexRail: { refShape: '33493', refIndexes: [0], colors: ['#e91c2e', '#002579']},
};

export function getFixtureShape(key) {
    const details = fixtureIndex[key];
    const refShape = segments.get(details.refShape);
    if (!refShape) return undefined;
    const refSegments = refShape.filter((v, index) => details.refIndexes.includes(index));
    return turf.multiLineString(refSegments.map(segment => turf.getCoords(segment)), { colors: details.colors } );
}