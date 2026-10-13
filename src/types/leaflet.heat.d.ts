import * as L from 'leaflet';

declare module 'leaflet' {
  interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  function heatLayer(latlngs: Array<[number, number, number]>, options?: HeatMapOptions): L.Layer;
}
