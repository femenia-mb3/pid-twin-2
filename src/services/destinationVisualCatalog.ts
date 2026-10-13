import { MapViewerProps } from '../components/MapViewer';

export interface DestinationVisualAdapter {
  cartographyBase?: MapViewerProps['cartografiaBase'];
  supportsCesiumTiles: boolean;
}

// Adaptadores de demostración: la interfaz nunca decide por el ID de una ciudad.
// Un ContextPackage o el catálogo operativo del piloto podrá registrar su propio adapter.
const visualAdapters: Record<string, DestinationVisualAdapter> = {
  malaga: {
    supportsCesiumTiles: true,
    cartographyBase: {
      edificiosUrl: '/data/malaga/malaga-urbana-building-parts.geojson',
      relieveUrl: '/data/malaga/malaga-urbana-hillshade.png',
      relieveBounds: [[36.7022500, -4.4335891], [36.7357701, -4.3803657]],
      edificiosEsperados: 9192,
      etiquetaRelieve: 'MDT50 PNOA 3.ª cobertura V1 · resolución 0,5 m',
    },
  },
};

export const getDestinationVisualAdapter = (destinationId: string): DestinationVisualAdapter => (
  visualAdapters[destinationId] || { supportsCesiumTiles: false }
);
