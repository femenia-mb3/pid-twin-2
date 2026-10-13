// Tipos estructurados para el catálogo y consumo de datos abiertos interoperables (IGN, PNOA, Catastro, Tráfico Abierto)

export type OpenDataSourceType = 'WMS' | 'WMTS' | 'TMS' | '3D_TILES' | 'GEOJSON' | 'SENSOR_STREAM';
export type OpenDataCategory = 'ORTOFOTO' | 'ELEVACION' | 'CATASTRO_EDIFICIOS' | 'LIDAR_PUNTOS' | 'TRAFICO_MOVILIDAD' | 'MEDIO_AMBIENTE';

export interface OpenDataSourceRecord {
  id: string;
  name: string;
  category: OpenDataCategory;
  serviceType: OpenDataSourceType;
  endpointUrl: string;
  wmsLayerName?: string;
  publisher: string;
  license: string;
  licenseUrl: string;
  crs: string;
  coverage: string;
  resolutionOrDensity: string;
  updateFrequency: string;
  openSourceStandard: 'OGC_WMS' | 'OGC_WMTS' | 'OGC_3D_TILES' | 'INSPIRE' | 'GEOJSON';
  status: 'ONLINE' | 'DEMO_STANDALONE' | 'OFFLINE';
  description: string;
}

export interface TrafficFlowSegment {
  id: string;
  nombreVia: string;
  destinoId: string;
  nivelCongestion: 'FLUIDO' | 'MODERADO' | 'DENSO' | 'CONGESTIONADO';
  velocidadMediaKmh: number;
  intensidadVehiculosHora: number;
  coordenadas: [number, number][]; // LineString
  fuente: string;
  timestamp: string;
}

export interface OpenDataCatalogResponse {
  type: 'OpenDataCatalog';
  destinationId: string;
  totalSources: number;
  sources: OpenDataSourceRecord[];
  disclaimer: string;
}
