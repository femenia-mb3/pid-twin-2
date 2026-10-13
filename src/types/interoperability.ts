export type DataLane = 'ONTOLOGICO' | 'NO_ONTOLOGICO_HISTORICO';
export type ConnectorType = 'PID_SERVICE' | 'REST_API' | 'CSV' | 'GEOJSON' | 'MQTT' | 'OGC_API';
export type ConnectorStatus = 'CONTRATO_CONFIGURADO' | 'PENDIENTE_AUTORIZACION' | 'PILOTO_VALIDADO';
export type PrivacyLevel = 'PUBLICO' | 'INTERNO_AGREGADO' | 'REQUIERE_EVALUACION';
export type ModelPublication = 'PRECONFIGURADO_PID' | 'MODELO_PROPIO' | 'REUTILIZABLE_PID';
export type ModelLifecycle = 'BORRADOR' | 'VALIDADO' | 'PUBLICADO';

export interface ModelVariableDefinition {
  id: string;
  label: string;
  unit?: string;
  defaultValue: string | number | boolean;
  valueType?: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  allowedValues?: string[];
  required?: boolean;
}

export interface EvidenceRef {
  label: string;
  url: string;
  note: string;
  reviewedAt: string;
}

export interface DataLaneDefinition {
  id: DataLane;
  title: string;
  subtitle: string;
  sources: string[];
  processing: string[];
  output: string;
  evidence: EvidenceRef;
}

export interface PidServiceRelation {
  id: 'S1' | 'S2' | 'C4' | 'S7' | 'S11' | 'S15' | 'S16' | 'S17' | 'S18';
  role: string;
  dataTreatment: string;
  privacyRule: string;
  evidence: EvidenceRef;
}

export interface InteroperabilityConnector {
  id: string;
  destinationId: string;
  tenantId: string;
  title: string;
  lane: DataLane;
  sourceClass: 'PID' | 'NACIONAL' | 'MUNICIPAL' | 'OPERADOR_LOCAL';
  pidServiceId?: PidServiceRelation['id'];
  connectorType: ConnectorType;
  inputFormat: 'NGSI_LD' | 'REST_JSON' | 'CSV' | 'GEOJSON' | 'MQTT' | 'OGC_API_FEATURES';
  targetDomains: string[];
  normalizationSteps: string[];
  updateFrequency: string;
  qualityRule: string;
  status: ConnectorStatus;
  privacyLevel: PrivacyLevel;
  purpose: string;
  evidence: EvidenceRef;
}

export interface ReusableModelTemplate {
  id: string;
  version: string;
  title: string;
  domain: string;
  publication: ModelPublication;
  lifecycle: ModelLifecycle;
  ownerDestinationId?: string;
  ownerTenantId?: string;
  creatorDestinationName?: string;
  adoptedByDestinationIds?: string[];
  pidModulesRequired?: Array<'S1' | 'S2' | 'C4' | 'S7' | 'S11' | 'S15' | 'S16' | 'S17' | 'S18'>;
  summary: string;
  requiredLanes: DataLane[];
  variables: ModelVariableDefinition[];
  sourceRequirements: string[];
  ruleSummary: string;
  privacyRule: string;
  evidence: EvidenceRef;
}

export interface InteroperabilityArchitecture {
  id: string;
  version: string;
  title: string;
  flow: string[];
  lanes: DataLaneDefinition[];
  pidServices: PidServiceRelation[];
  evidence: EvidenceRef[];
}

export interface ModelInstantiationInput {
  destinationId: string;
  connectorIds: string[];
  parameters: Record<string, string | number | boolean>;
}

export interface ModelInstantiationPreview {
  persistence: 'VALIDATED_NOT_PERSISTED' | 'REJECTED';
  valid: boolean;
  errors: string[];
  instance?: {
    id: string;
    destinationId: string;
    tenantId: string;
    templateId: string;
    templateVersion: string;
    status: 'BORRADOR_VALIDADO';
    connectorIds: string[];
    parameters: Record<string, string | number | boolean>;
    evidence: EvidenceRef;
  };
}

export interface OwnModelInput {
  destinationId: string;
  title: string;
  domain: string;
  summary: string;
  requiredLanes: DataLane[];
  sourceRequirements: string[];
  variables: ModelVariableDefinition[];
  ruleSummary: string;
  privacyRule: string;
}

export interface OwnModelResult {
  persistence: 'VALIDATED_NOT_PERSISTED' | 'REJECTED';
  valid: boolean;
  errors: string[];
  model?: ReusableModelTemplate;
}
