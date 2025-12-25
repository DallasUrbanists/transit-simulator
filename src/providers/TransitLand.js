const apikey = import.meta.env.VITE_TRANSITLAND_API_KEY;

export default class TransitLand {
    static VECTOR_TILES_ENDPOINT = 'https://transit.land/api/v2/tiles/routes/tiles/{z}/{x}/{y}.pbf?apikey='+apikey;
    static REST_API_BASE_URL = 'https://transit.land/api/v2/rest';

    static async searchRoutes({ agency_key }) {
        const features = [];
        const url = new URL(TransitLand.REST_API_BASE_URL + '/routes.geojson');
        const params = new URLSearchParams({ agency_key, apikey });
        const search = async (after) => {
            if (after) params.set('after', after);
            url.search = params;
            const result = await fetch(url).then(result => result.json()).catch(err => console.error(err));
            features.push(...result.features);
            if (result?.meta?.after) {
                return await search(result.meta.after);
            }
            return features;
        }
        return await search();
    }

    static async searchTrips({ route_onestop_id }) {
        const features = [];
        const url = new URL(`${TransitLand.REST_API_BASE_URL}/routes/${route_onestop_id}/trips.geojson`);
        const params = new URLSearchParams({ apikey });
        const search = async (after) => {
            if (after) params.set('after', after);
            url.search = params;
            const result = await fetch(url).then(result => result.json()).catch(err => console.error(err));
            features.push(...result.features);
            if (result?.meta?.after) {
                return await search(result.meta.after);
            }
            return features;
        }
        return await search();
    }
}