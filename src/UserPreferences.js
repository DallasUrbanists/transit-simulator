import { getRoute } from "./models/routes";

// TO-DO: Verify what all the various Service IDs mean
const BUS_WEEKDAY_SERVICE = '2';
const BUS_SATURDAY_SERVICE = '3';
const BUS_SUNDAY_SERVICE = '4';
const RAIL_WEEKDAY_SERVICE = '14';
const RAIL_IDK1_SERVICE = '19'; // Probably Rail Saturday service?
const RAIL_IDK2_SERVICE = '20'; // Probably Rail Sunday service?
const RAIL_IDK3_SERVICE = '21'; // Probably Rail Special service?
const MATA_IDK1_SERVICE = '402'; // M Line Trolley is covered by RAIL_WEEKDAY_SERVICE
const MATA_IDK2_SERVICE = '502'; // M Line Trolley is covered by RAIL_WEEKDAY_SERVICE
const UTD_IDK1_SERVICE = '902'; // UTD 883 Routes are covered by BUS_WEEKDAY_SERVICE
const UTD_IDK2_SERVICE = '1002'; // UTD 883 Routes are covered by BUS_WEEKDAY_SERVICE
const TRE_IDK1_SERVICE = '1621'; // Trinity Railray Express is covered by RAIL_WEEKDAY_SERVICE
const TRE_IDK2_SERVICE = '1521'; // Trinity Railray Express is covered by RAIL_WEEKDAY_SERVICE
// DENTON COUNTY TRANSITY AUTHORITY SERVICE CODES
const DCTA_BUS_WEEKDAY = '2026_Spring_-Weekday';
const DCTA_RAIL_WEEKDAY = 'A-Train-Mo-Th';
// TRINITY METRO SERVICE CODES
const TRINITY_MON_FRI = '140.0.1';
const TRINITY_XMAS_CAPITAL_EXPRESS = '140.CCEX.1';
const TRINITY_XMAS_PALACE_THEATRE = '140.CCPT.1';

const ALL_AVAILABLE = 'all available';

// Choose specific routes/trips to enable
export default class UserPreferences {
    enableAgencies = ['DART', 'TrinityMetro', 'DCTA'];
    enableRoutes = ALL_AVAILABLE;
    enableServiceIDs = [
        BUS_WEEKDAY_SERVICE,
        RAIL_WEEKDAY_SERVICE,
        DCTA_BUS_WEEKDAY,
        DCTA_RAIL_WEEKDAY,
        TRINITY_MON_FRI,
        TRINITY_XMAS_CAPITAL_EXPRESS,
        TRINITY_XMAS_PALACE_THEATRE,
        '312753486348',
        '312753486348',
        '112760676348',
        '112760676348',
    ];
    tripCriteria(trip) {
        if (!this.enableServiceIDs.includes(trip.get('service_id'))) {
            return false;
        }
        const route = getRoute(trip);
        if (this.enableRoutes !== ALL_AVAILABLE && !this.enableRoutes.includes(route.get('route_id'))) {
            return false;
        }
        return true;
    };
}