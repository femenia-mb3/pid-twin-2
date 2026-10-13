export const SEMANTIC_CONTEXT_URL = '/ontology/segittur-pid-context-v1.jsonld';
export const SEMANTIC_PROFILE_ID = 'urn:pid:gemelo:profile:segittur-multidestino:v1';

export type NgsiLdEntityType =
  | 'TouristDestination'
  | 'TourismZone'
  | 'TourismResource'
  | 'TourismSensor'
  | 'TourismEvent'
  | 'SimulationScenario'
  | 'SimulationResult'
  | 'Dataset3D'
  | 'ContextPackage'
  | 'DataSource'
  | 'DestinationProfile'
  | 'IngestionContract';

export type DataQuality = 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION';
export type UpdateFrequency = 'TIEMPO_REAL' | 'HORARIA' | 'DIARIA' | 'MENSUAL';
export type SpatialLevel = 'NIVEL_1_2D_25D' | 'NIVEL_2_EDIFICIOS' | 'NIVEL_3_3D_TILES';

export interface NgsiLdProperty<T> {
  type: 'Property';
  value: T;
  observedAt?: string;
  createdAt?: string;
  modifiedAt?: string;
  unitCode?: string;
  datasetId?: string;
}

export interface NgsiLdRelationship {
  type: 'Relationship';
  object: string;
  observedAt?: string;
  datasetId?: string;
}

export interface NgsiLdGeoProperty {
  type: 'GeoProperty';
  value: {
    type: 'Point' | 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
  observedAt?: string;
}

export interface NgsiLdEntity {
  id: string;
  type: NgsiLdEntityType;
  '@context': string | string[];
  destination: NgsiLdRelationship;
  tenant?: NgsiLdRelationship;
  name?: NgsiLdProperty<string>;
  description?: NgsiLdProperty<string>;
  location?: NgsiLdGeoProperty;
  dataQuality?: NgsiLdProperty<DataQuality>;
  updateFrequency?: NgsiLdProperty<UpdateFrequency>;
  traceabilityId?: NgsiLdProperty<string>;
  hasSource?: NgsiLdRelationship;
  [attribute: string]: unknown;
}

export interface DestinationSemanticProfile {
  id: string;
  tenantId: string;
  tenantName: string;
  destinationId: string;
  destinationName: string;
  ineCode: string;
  namespace: string;
  contextUrl: string;
  semanticProfile: string;
  timezone: string;
  locale: string;
  spatialLevels: SpatialLevel[];
  activeSpatialLevel: SpatialLevel;
  enabledDomains: Array<'turismo' | 'movilidad' | 'medio_ambiente' | 'infraestructuras' | 'eventos' | 'socioeconomica'>;
  dataPolicy: 'PUBLICA' | 'MIXTA' | 'RESTRINGIDA';
  evidence: {
    source: string;
    sourceUrl: string;
    reviewedAt: string;
  };
}

export interface SemanticModelDescriptor {
  profileId: string;
  profileName: string;
  version: string;
  officialVocabulary: {
    name: string;
    iri: string;
    role: string;
  };
  contextUrl: string;
  profileUrl: string;
  shaclUrl: string;
  entityTypes: Array<{
    type: NgsiLdEntityType;
    label: string;
    mapsTo: string;
    requiredAttributes: string[];
  }>;
  evidence: Array<{
    label: string;
    url: string;
    note: string;
  }>;
}

export interface SemanticValidationResult {
  valid: boolean;
  normalizedEntity?: NgsiLdEntity;
  errors: string[];
  warnings: string[];
}
