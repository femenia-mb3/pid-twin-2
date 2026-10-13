import { DataLane, PidServiceRelation } from './interoperability';

export type OperationalConnectorType =
  | 'PID_SERVICE_S2'
  | 'PID_SERVICE_C4'
  | 'REST_API'
  | 'MQTT'
  | 'OGC_API'
  | 'CSV'
  | 'GEOJSON'
  | 'JSON'
  | 'SHP_ZIP';

export type OperationalConnectorStatus =
  | 'ACTIVO_VERIFICADO'
  | 'PENDIENTE_CREDENCIALES'
  | 'PLANTILLA_DISPONIBLE';

export type OperationalPrivacyLevel =
  | 'PUBLICO'
  | 'INTERNO_AGREGADO'
  | 'REQUIERE_EVALUACION';

export interface ConnectorFieldMapping {
  sourceField: string;
  sourceType: 'string' | 'number' | 'boolean' | 'date' | 'geometry';
  targetConcept: string;
  unit?: string;
  required: boolean;
  description?: string;
}

export interface ConnectorEvidence {
  origin: string;
  responsibleEntity: string;
  license: string;
  purpose: string;
  retentionPolicy: string;
  privacyLevel: OperationalPrivacyLevel;
  dataQualityMinPct: number;
  territorialCoverage: string;
  reviewedAt: string;
  traceabilityId: string;
  url?: string;
  fingerprintSha256?: string;
}

export interface OperationalConnectorDefinition {
  id: string;
  tenantId: string;
  destinationId: string;
  name: string;
  type: OperationalConnectorType;
  lane: DataLane;
  status: OperationalConnectorStatus;
  version: number;
  endpointUrl?: string;
  filePath?: string;
  secretReference?: string; // NUNCA el secreto real: solo un puntero como 'secret://vault/malaga_aforos_api_key'
  updateFrequency: string;
  pidModulesRelated: Array<PidServiceRelation['id']>;
  fieldMappings: ConnectorFieldMapping[];
  evidence: ConnectorEvidence;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorInput {
  destinationId: string;
  name: string;
  type: OperationalConnectorType;
  lane: DataLane;
  status?: OperationalConnectorStatus;
  endpointUrl?: string;
  filePath?: string;
  secretReference?: string;
  updateFrequency: string;
  pidModulesRelated?: Array<PidServiceRelation['id']>;
  fieldMappings: ConnectorFieldMapping[];
  evidence: {
    responsibleEntity: string;
    license: string;
    purpose: string;
    retentionPolicy: string;
    privacyLevel: OperationalPrivacyLevel;
    dataQualityMinPct: number;
    territorialCoverage: string;
    url?: string;
  };
}

export type DatasetFormat = 'CSV' | 'GEOJSON' | 'JSON' | 'SHP_ZIP';

export interface IngestedDatasetRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId?: string;
  name: string;
  format: DatasetFormat;
  lane: DataLane;
  fileName: string;
  fileSizeBytes: number;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  detectedCrs: string;
  geometryType?: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'None';
  fingerprintSha256: string;
  sampleFields: string[];
  sampleRecords: Array<Record<string, any>>;
  validationReport: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  evidence: ConnectorEvidence;
  status: 'INGESTADO_PENDIENTE_VINCULO' | 'VINCULADO_VALIDADO' | 'RECHAZADO';
  uploadedBy: string;
  uploadedAt: string;
}

export interface ModelDataBinding {
  id: string;
  tenantId: string;
  destinationId: string;
  modelId: string;
  modelTitle: string;
  modelVariableId: string;
  modelVariableLabel: string;
  required: boolean;
  connectorId: string;
  connectorName: string;
  connectorStatus: OperationalConnectorStatus;
  datasetId?: string;
  datasetName?: string;
  sourceField: string;
  transformation: 'DIRECT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'PEAK' | 'PERCENTAGE';
  transformationArg?: number;
  unit?: string;
  frequency: string;
  qualityLevel: string;
  availability: 'DISPONIBLE' | 'PENDIENTE_AUTORIZACION' | 'INCOMPATIBLE';
  datasetFingerprintSha256?: string;
  active: boolean;
  configuredBy: string;
  configuredAt: string;
  notes?: string;
}

export interface ModelExecutionReadiness {
  modelId: string;
  modelTitle: string;
  destinationId: string;
  isReadyToExecute: boolean;
  totalRequiredVariables: number;
  satisfiedRequiredVariables: number;
  bindings: ModelDataBinding[];
  blockingIssues: Array<{
    code: 'MISSING_MANDATORY_VARIABLE' | 'CONNECTOR_UNAUTHORIZED' | 'QUALITY_BELOW_MINIMUM' | 'DATASET_MISSING';
    variableId: string;
    message: string;
  }>;
  evaluatedAt: string;
}
