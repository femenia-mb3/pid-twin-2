import { ConnectorEvidence, ConnectorFieldMapping, OperationalPrivacyLevel } from './operationalConfiguration';
import { DataQuality, NgsiLdEntityType } from './semantic';

export type SemanticSourceActivationState = 'BORRADOR' | 'VALIDADO' | 'ACTIVO' | 'SUSPENDIDO';
export type IotTransportProtocol = 'MQTT_5' | 'MQTTS_5' | 'WSS_MQTT';
export type IotSensorState = 'ALTA_REGISTRADA' | 'EN_OBSERVACION' | 'FUERA_DE_SERVICIO' | 'EN_MANTENIMIENTO';
export type ObservationValidationStatus = 'VALIDADA' | 'RECHAZADA_FUERA_DE_RANGO' | 'RECHAZADA_TIMESTAMP_INVALIDO' | 'RECHAZADA_SCHEMA' | 'DUPLICADA';

export interface PidOntologyRegistryRecord {
  id: string;
  iri: string;
  version: string;
  title: string;
  provenance: string;
  creator: string;
  license: string;
  documentationUrl: string;
  contextUrl: string;
  fingerprintSha256: string;
  approved: boolean;
  reviewedAt: string;
}

export interface S2SemanticConnectorProfile {
  id: string;
  tenantId: string;
  destinationId: string;
  name: string;
  baseUrl: string;
  apiVersion: 'NGSI-LD-1.8' | 'NGSI-LD-1.6';
  contextUrl: string;
  contextFingerprintSha256: string;
  ontologyIri: string;
  authReference?: string;
  allowedEntityTypes: NgsiLdEntityType[];
  allowedQueryTemplates: string[];
  fieldMappings: ConnectorFieldMapping[];
  qualityPolicy: {
    minimumQuality: DataQuality;
    maxLatencySeconds: number;
    requireGeoproperty: boolean;
  };
  activationState: SemanticSourceActivationState;
  evidence: ConnectorEvidence;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateS2ConnectorInput {
  destinationId: string;
  name: string;
  baseUrl: string;
  apiVersion?: 'NGSI-LD-1.8' | 'NGSI-LD-1.6';
  contextUrl?: string;
  ontologyIri?: string;
  authReference?: string;
  allowedEntityTypes: NgsiLdEntityType[];
  allowedQueryTemplates?: string[];
  fieldMappings: ConnectorFieldMapping[];
  qualityPolicy?: {
    minimumQuality?: DataQuality;
    maxLatencySeconds?: number;
    requireGeoproperty?: boolean;
  };
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

export interface IotBrokerConnectorProfile {
  id: string;
  tenantId: string;
  destinationId: string;
  name: string;
  protocol: IotTransportProtocol;
  brokerHost: string;
  brokerPort: number;
  tlsEnabled: boolean;
  topicNamespace: string;
  defaultQos: 0 | 1 | 2;
  authReference?: string;
  maxMessageSizeBytes: number;
  maxRateMessagesPerMinute: number;
  activationState: SemanticSourceActivationState;
  evidence: ConnectorEvidence;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIotConnectorInput {
  destinationId: string;
  name: string;
  protocol?: IotTransportProtocol;
  brokerHost: string;
  brokerPort: number;
  tlsEnabled?: boolean;
  topicNamespace: string;
  defaultQos?: 0 | 1 | 2;
  authReference?: string;
  maxMessageSizeBytes?: number;
  maxRateMessagesPerMinute?: number;
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

export interface RegisteredIotDevice {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId: string;
  sensorUrn: string;
  name: string;
  sensorType: string;
  measurementConcept: string;
  unitCode: string;
  zoneId?: string;
  zoneName?: string;
  state: IotSensorState;
  coordinates: [number, number];
  evidence: ConnectorEvidence;
  registeredBy: string;
  registeredAt: string;
  updatedAt: string;
}

export interface RegisterIotDeviceInput {
  destinationId: string;
  connectorId: string;
  sensorUrn: string;
  name: string;
  sensorType: string;
  measurementConcept: string;
  unitCode: string;
  zoneId?: string;
  zoneName?: string;
  state?: IotSensorState;
  coordinates: [number, number];
  evidence: {
    responsibleEntity: string;
    license: string;
    purpose: string;
    retentionPolicy: string;
    privacyLevel: OperationalPrivacyLevel;
    dataQualityMinPct: number;
    territorialCoverage: string;
  };
}

export interface RawTelemetrySampleInput {
  sensorId: string;
  measurement: string;
  value: number;
  unitCode: string;
  observedAt: string;
  sequence?: number;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  sourceTraceabilityId?: string;
}

export interface NormalizedContextObservation {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId: string;
  sourceType: 'PID_S2' | 'IOT_MQTT';
  sensorUrn: string;
  batchId?: string;
  idempotencyKey: string;
  measurementConcept: string;
  value: number;
  unitCode: string;
  observedAt: string;
  receivedAt: string;
  coordinates: [number, number];
  quality: DataQuality;
  validationStatus: ObservationValidationStatus;
  rawPayload: Record<string, unknown>;
  normalizedNgsiLd: Record<string, unknown>;
  fingerprintSha256: string;
  eligibleForSimulation: boolean;
}

export interface SemanticBatchRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId: string;
  connectorType: 'PID_S2' | 'IOT_MQTT';
  startedAt: string;
  finishedAt: string;
  totalReceived: number;
  totalAccepted: number;
  totalRejected: number;
  fingerprintSha256: string;
  evidence: {
    origin: string;
    responsibleEntity: string;
    license: string;
    traceabilityId: string;
  };
}

export interface SemanticIngestionErrorRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId: string;
  sourceType: 'PID_S2' | 'IOT_MQTT';
  reasonCode: string;
  message: string;
  rawPayload: Record<string, unknown>;
  payloadFingerprintSha256: string;
  occurredAt: string;
}

export interface SourceActivationDecision {
  id: string;
  tenantId: string;
  destinationId: string;
  connectorId: string;
  connectorKind: 'S2_SEMANTIC' | 'IOT_MQTT';
  action: 'ACTIVAR' | 'SUSPENDER' | 'VALIDAR';
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  rationale: string;
  evidenceFingerprintSha256: string;
  decidedAt: string;
}

export interface DataLineageTraceNode {
  type: 'CONECTOR' | 'CONTRATO' | 'LOTE' | 'OBSERVACION' | 'VINCULO_MODELO' | 'SIMULACION';
  id: string;
  label: string;
  timestamp: string;
  fingerprintSha256: string;
  status: string;
  details: Record<string, unknown>;
}

export interface DataLineageGraph {
  destinationId: string;
  rootType: 'OBSERVACION' | 'CONECTOR';
  rootId: string;
  nodes: DataLineageTraceNode[];
  provenanceEvidence: {
    responsibleEntity: string;
    license: string;
    traceabilityId: string;
    verified: boolean;
  };
}
