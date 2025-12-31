import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

export default class MapboxContext {
  constructor(htmlElementContainerId) {
    this.map = new mapboxgl.Map({
      container: htmlElementContainerId,
      //style: "mapbox://styles/hexel/cmjp7tzsz002901s43iuk2xf5/draft", // Satellite
      style: "mapbox://styles/hexel/cmjp42xzb008s01qnh3l772ey/draft", // Day
      center: [-96.797, 32.7767],
      zoom: 13,
      config: {
        basemap: {
          show3dObjects: true,
          show3dBuildings: true,
          show3dFacades: true,
          show3dLandmarks: true,
          show3dTrees: true,
        }
      },
      controls: {
        instructions: false
      }
    });
  }

  moveMarker(name, { long, lat }) {
    new mapboxgl.Marker()
      .setLngLat([long, lat])
      .addTo(this.map);
  }

  addSource(sourceId, options) {
    return this.map.addSource(sourceId, options);
  }

  getSource(sourceId) {
    return this.map.getSource(sourceId);
  }

  addLayer(options) {
    return this.map.addLayer(options);
  }

  on(event, callback) {
    return this.map.on(event, () => callback());
  }
}