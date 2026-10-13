import { Destino, RecursoTuristico, SensorIoT, ZonaDestino } from './ontology';

export const CONTEXT_PACKAGE_TYPE = 'ContextPackage' as const;
export const CONTEXT_PACKAGE_VERSION = '1.0.0' as const;

export type ContextPackageSourceFormat = 'NGSI_LD' | 'GEOJSON' | 'CSV' | 'REST_JSON' | 'MQTT' | 'OGC_API_FEATURES' | 'WMS_WFS';
export type ContextPackageLane = 'ONTOLOGICO' | 'NO_ONTOLOGICO_HISTORICO';
export type ContextPackagePrivacy = 'PUBLICO' | 'INTERNO' | 'RESTRINGIDO' | 'ANONIMIZADO';
export type ContextPackageAuthorization = 'AUTORIZADO' | 'PENDIENTE' | 'NO_AUTORIZADO';

export interface ContextPackageTenant {
  id: string;
  legalName: string;
  dataPolicy: 'PUBLICA' | 'MIXTA' | 'RESTRINGIDA';
}

export interface ContextPackageDataSource {
  id: string;
  name: string;
  lane: ContextPackageLane;
  format: ContextPackageSourceFormat;
  updateFrequency: 'TIEMPO_REAL' | 'HORARIA' | 'DIARIA' | 'MENSUAL';
  dataQuality: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION';
  privacy: ContextPackagePrivacy;
  authorization: ContextPackageAuthorization;
  purpose: string;
  traceabilityId: string;
  endpointHint?: string;
}

export interface ContextPackageVariable {
  id: string;
  label: string;
  unit: string;
  entityType: 'TourismZone' | 'TourismResource' | 'TourismSensor' | 'TourismEvent';
  observed: boolean;
  sourceId: string;
  qualityRule: string;
}

export interface ContextPackageModelProfile {
  id: string;
  name: string;
  version: string;
  enabledDomains: string[];
  activeSpatialLevel: 'NIVEL_1_2D_25D' | 'NIVEL_2_EDIFICIOS' | 'NIVEL_3_3D_TILES';
  capacityProfile: {
    alertThresholdPct: number;
    theoreticalCapacity: number;
  };
}

export interface ContextPackageSemanticMapping {
  contextUrl: string;
  ontologyProfile: string;
  namespace: string;
  entityMappings: Record<'destination' | 'zone' | 'resource' | 'sensor', string>;
}

export interface ContextPackageEvidence {
  license: string;
  cutOffDate: string;
  coverageNote: string;
  syntheticDemoData: boolean;
  provenance: string;
}

export interface ContextPackageV1 {
  type: typeof CONTEXT_PACKAGE_TYPE;
  schemaVersion: typeof CONTEXT_PACKAGE_VERSION;
  id: string;
  title: string;
  purpose: string;
  createdAt: string;
  tenant: ContextPackageTenant;
  destination: Destino;
  context: {
    crs: 'EPSG:4326';
    timezone: string;
    locale: string;
    modelProfile: ContextPackageModelProfile;
    dataSources: ContextPackageDataSource[];
    variables: ContextPackageVariable[];
    zones: ZonaDestino[];
    resources: RecursoTuristico[];
    sensors: SensorIoT[];
  };
  semanticMapping: ContextPackageSemanticMapping;
  evidence: ContextPackageEvidence;
}

export interface ContextPackageValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ContextPackageValidationReport {
  valid: boolean;
  packageId?: string;
  errors: ContextPackageValidationIssue[];
  warnings: ContextPackageValidationIssue[];
  summary: {
    zones: number;
    resources: number;
    sensors: number;
    sources: number;
    variables: number;
  };
  validatedAt: string;
}

export interface ContextPackageImportResult {
  type: 'ContextPackageImportResult';
  persistence: 'MEMORY_DEMO_NOT_PERSISTED' | 'POSTGIS_PERSISTED';
  package: ContextPackageV1;
  report: ContextPackageValidationReport;
  importedAt: string;
}
