// =============================================================================
// CONTRATOS DE DATOS: AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ANTE COLAPSO
// Iteración 16: Plataforma Inteligente de Destinos (PID / SEGITTUR)
// =============================================================================

import { ProtocolResponsibleUnit } from './pilotOperations';

export type AgentOperationalMode = 
  | 'VIGILANCIA_PASIVA'     // Solo monitoriza y registra indicadores
  | 'ALERTA_PREVENTIVA'     // Emite avisos tempranos si se proyecta colapso en T+1h/T+4h
  | 'RESPUESTA_ACTIVA';     // Genera planes de mitigación y ejecuta medidas pre-aprobadas

export type IncidentSeverity = 'AMARILLA_ADVERTENCIA' | 'NARANJA_CRITICA' | 'ROJA_COLAPSO_INMINENTE';

export type ActionRiskLevel = 
  | 'NIVEL_1_INFORMATIVO_AUTONOMO'    // Mensajería variable digital, avisos en app, sugerencia rutas
  | 'NIVEL_2_OPERATIVO_FIRMA_HUMANA'; // Desvío policial, corte de accesos, habilitación parkings

export type InterventionPlanStatus = 
  | 'GENERADO'
  | 'PRE_APROBADO_DIRECTIVA'
  | 'PENDIENTE_FIRMA_HUMANA'
  | 'AUTORIZADO_EJECUTADO'
  | 'RECHAZADO_OPERADOR';

/**
 * Perfil de configuración del Agente Autónomo de Respuesta por Destino
 */
export interface RapidResponseAgentProfile {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  agentName: string;
  mode: AgentOperationalMode;
  enabled: boolean;
  saturationThresholdPct: number;      // Ej. 85% para alerta crítica
  earlyWarningHorizonHours: number;    // Ej. 4 horas
  monitoredZoneIds: string[];
  autonomousPreApprovedActions: string[]; // Códigos de acciones nivel 1 pre-autorizadas
  leadUnit: ProtocolResponsibleUnit;
  evidenceFingerprintSha256: string;
  updatedAt: string;
}

/**
 * Incidente de colapso o sobrecarga detectado por el agente
 */
export interface CollapseIncident {
  id: string;
  tenantId: string;
  destinationId: string;
  agentId: string;
  severity: IncidentSeverity;
  detectedAt: string;
  sourceZoneId: string;
  sourceZoneName: string;
  currentSaturationPct: number;
  currentVisitors: number;
  predictedPeakVisitors: number;
  predictedHorizon: 'T_1H' | 'T_4H' | 'T_24H';
  timeToCriticalAlertMinutes: number;
  triggerCause: string;
  triggeringSensors: string[];
  evidenceDataSources: string[];
  evidenceFingerprintSha256: string;
  resolved: boolean;
}

/**
 * Medida concreta de intervención rápida
 */
export interface InterventionActionStep {
  step: number;
  code: string;
  name: string;
  description: string;
  riskLevel: ActionRiskLevel;
  responsibleUnit: ProtocolResponsibleUnit;
  targetZoneId: string;
  targetZoneName: string;
  estimatedDiversionSharePct: number;
  estimatedCostEuros: number;
  isPreApprovedByDirective: boolean;
  status: 'PENDIENTE' | 'EJECUTADA_AUTONOMA' | 'AUTORIZADA_HUMANA' | 'OMITIDA';
}

/**
 * Plan estructurado de intervención rápida generado ante un incidente
 */
export interface RapidInterventionPlan {
  id: string;
  incidentId: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  title: string;
  createdAt: string;
  status: InterventionPlanStatus;
  projectedReliefPct: number;
  estimatedTotalCostEuros: number;
  actions: InterventionActionStep[];
  governanceWarning: string;
  evidenceFingerprintSha256: string;
  syntheticDisclaimer: string;
}

/**
 * Registro de firma y decisión humana inmutable
 */
export interface AgentExecutionDecisionRecord {
  id: string;
  planId: string;
  incidentId: string;
  tenantId: string;
  destinationId: string;
  decision: 'AUTORIZADO_EJECUTADO' | 'RECHAZADO_OPERADOR';
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  rationale: string;
  approvedActions: string[];
  decidedAt: string;
  decisionFingerprintSha256: string;
}
