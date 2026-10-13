import { AiDataSourceCitation } from './aiAgent';

export type OperatorRole = 'ADMIN_SEGITTUR' | 'GESTOR_TURISMO' | 'SUPERVISOR_MOVILIDAD' | 'ANALISTA_DESTINO';

export interface OperatorIdentity {
  id: string;
  username: string;
  displayName: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: OperatorRole;
  authorizedDestinations: string[];
}

export type AiAuditDecision = 'PROPUESTO' | 'APLICADO_SIMULADOR' | 'EXPORTADO_ESTUDIO' | 'RECHAZADO' | 'MODIFICADO_Y_EJECUTADO';

export interface AiProposalAuditRecord {
  id: string;
  proposalId: string;
  tenantId: string;
  destinationId: string;
  operatorId: string;
  operatorName: string;
  prompt: string;
  intent: string;
  status: string;
  contextFingerprint: string;
  contextVersion: string;
  dataSources: AiDataSourceCitation[];
  rationale: string;
  assumptions: string[];
  uncertaintyLevel: 'BAJA' | 'MEDIA' | 'ALTA';
  confidencePct: number;
  syntheticDemoData: boolean;
  decision: AiAuditDecision;
  decisionRationale?: string;
  linkedScenarioId?: string;
  linkedRunId?: string;
  createdAt: string;
  decidedAt?: string;
}

export type ProtocolSeverity = 'INFORMATIVA' | 'MODERADA' | 'CRITICA';
export type ProtocolResponsibleUnit = 'POLICIA_LOCAL' | 'MOVILIDAD_TRANSITO' | 'PATRIMONIO_CULTURA' | 'PROTECCION_CIVIL' | 'PUERTO_CRUCEROS';

export interface ProtocolActionStep {
  step: number;
  action: string;
  targetZoneId: string;
  targetZoneName: string;
  responsibleUnit: ProtocolResponsibleUnit;
  resourcesAssigned: string[];
  estimatedExecutionMinutes: number;
}

export interface OperationalProtocol {
  id: string;
  tenantId: string;
  destinationId: string;
  name: string;
  description: string;
  triggerType: 'SATURACION_ZONA' | 'CONCENTRACION_CRUCEROS' | 'ALERTA_METEOROLOGICA' | 'EMISIONES_CO2' | 'EVENTO_MASIVO';
  triggerThresholdPct: number;
  targetZoneIds: string[];
  severity: ProtocolSeverity;
  leadUnit: ProtocolResponsibleUnit;
  actionSteps: ProtocolActionStep[];
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastCalibrationRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  zoneId: string;
  zoneName: string;
  horizon: 'T_1H' | 'T_4H' | 'T_24H' | 'T_48H';
  predictedAt: string;
  targetTimestamp: string;
  predictedVisitors: number;
  observedVisitors: number;
  absoluteError: number;
  percentageError: number;
  calibratedConfidencePct: number;
  modelId: string;
  sensorVerificationId?: string;
}
