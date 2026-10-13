/**
 * Contratos de datos para la Iteración 17: Google Geo Suite Gobernado.
 * Asegura tipado estricto, evidencias criptográficas, estados de conector
 * y prevalidaciones institucionales para el enriquecimiento del Gemelo Digital PID.
 */

export type GoogleGeoModuleId =
  | 'photorealistic_3d_tiles'
  | 'google_3d_maps'
  | 'routes_api'
  | 'places_api'
  | 'maps_grounding';

export type GoogleGeoConnectorStatus =
  | 'DESHABILITADO'
  | 'EN_PREVALIDACION'
  | 'APROBADO_PILOTO'
  | 'ACTIVO_VERIFICADO'
  | 'SIN_CREDENCIALES'
  | 'REVOCADO';

export type GoogleGeoModuleState =
  | 'DISPONIBLE_ACTIVO'
  | 'PREPARADO_NO_ACTIVO'
  | 'REQUIERE_PREVALIDACION'
  | 'DESHABILITADO_POLITICA';

export interface GoogleGeoEvidenceEnvelope {
  traceabilityId: string;
  destinationId: string;
  tenantId: string;
  serviceRequested: GoogleGeoModuleId;
  purpose: string;
  attributionRequired: string;
  nonPersistenceCertified: boolean;
  humanSupervisor: {
    operatorId: string;
    operatorName: string;
    operatorRole: string;
  };
  requestTimestamp: string;
  contextFingerprintSha256: string;
  evidenceSha256: string;
  disclaimer: string;
}

export interface GoogleGeoModuleDefinition {
  id: GoogleGeoModuleId;
  name: string;
  category: 'VISUALIZACION_3D' | 'MOVILIDAD_FLUJOS' | 'CONTEXTO_POI' | 'INTELIGENCIA_GROUNDING';
  description: string;
  status: GoogleGeoModuleState;
  enrichmentRole: string;
  pidCompatibility: string;
  governanceRequirement: string;
  nonPersistenceRule: string;
  attributionText: string;
}

export interface GoogleGeoPrevalidationRequest {
  destinationId: string;
  tenantId: string;
  authorizedEntity: string;
  targetZoneId: string;
  targetZoneName: string;
  purpose: 'VISUALIZACION_FOTORREALISTA' | 'INSPECCION_PATRIMONIAL' | 'ANALISIS_TERRITORIAL_WHAT_IF';
  acceptedTerms: {
    attributionVisible: boolean;
    noTileCachingOrStorage: boolean;
    humanSupervisionOnly: boolean;
    segitturDataSovereigntyAccepted: boolean;
  };
  technicalNotes?: string;
}

export interface GoogleGeoPrevalidationRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  authorizedEntity: string;
  targetZoneId: string;
  targetZoneName: string;
  purpose: string;
  status: 'PENDIENTE' | 'APROBADO_PILOTO' | 'RECHAZADO' | 'REVOCADO';
  reviewedBy: {
    operatorId: string;
    operatorName: string;
    operatorRole: string;
  };
  evaluatedAt: string;
  expiresAt: string;
  justification: string;
  fingerprintSha256: string;
}

export interface GoogleGeoConnectorConfig {
  destinationId: string;
  destinationName: string;
  tenantId: string;
  status: GoogleGeoConnectorStatus;
  credentialsConfigured: boolean;
  activeModules: GoogleGeoModuleId[];
  prevalidation: GoogleGeoPrevalidationRecord | null;
  currentVisualProvider: 'PID_OPEN_DATA' | 'GOOGLE_PHOTOREALISTIC_3D';
  lastEvidenceEnvelope: GoogleGeoEvidenceEnvelope | null;
  updatedAt: string;
}

export interface GoogleGeoAuditQueryRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  moduleId: GoogleGeoModuleId;
  operatorId: string;
  operatorName: string;
  purpose: string;
  status: 'AUTORIZADO' | 'RECHAZADO_POLITICA' | 'FALLBACK_PID_ABIERTO';
  evidenceSha256: string;
  attributionRendered: string;
  requestedAt: string;
  payloadSummary: Record<string, any>;
}
