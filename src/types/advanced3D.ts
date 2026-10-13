// =============================================================================
// CONTRATOS DE VISUALIZACIÓN 3D Y 4D AVANZADA OPEN SOURCE (ITERACIÓN 12)
// Catálogo de activos territoriales abiertos, capas, CRS y estado de degradación
// =============================================================================

export type Asset3DFormat = 
  | 'OGC_3D_TILES' 
  | 'GLTF_GLB' 
  | 'OGC_WMS' 
  | 'OGC_WMTS' 
  | 'TMS' 
  | 'GEOJSON_INSPIRE' 
  | 'TRAFFIC_LINESTRING';

export type SpatialLevel = 1 | 2 | 3 | 4;

export interface Asset3DRecord {
  id: string;
  name: string;
  destinationId: string;
  level: SpatialLevel;
  format: Asset3DFormat;
  endpointUrl: string;
  layerOrFileIdentifier?: string;
  crs: string;
  publisher: string;
  license: string; // ej. CC-BY 4.0 IGN-CNIG, ODbL Catastro
  licenseUrl: string;
  resolutionOrDensity: string;
  boundingExtent: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  isOfflineFallbackAvailable: boolean;
  fingerprintSha256: string;
  status: 'ACTIVO_VERIFICADO' | 'FALLBACK_DISPONIBLE' | 'DEGRADADO_COMPATIBLE';
  description: string;
}

export interface CameraPresetConfig {
  id: string;
  name: string;
  destinationId: string;
  position: { longitude: number; latitude: number; height: number };
  headingDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  recommendedTimeHour?: number;
}

export interface Visual4DTimelineState {
  currentHour: number;
  playing: boolean;
  speedMultiplier: number;
  activeScenarioId: string;
  sunLightingEnabled: boolean;
  selectedAssetIds: string[];
}
