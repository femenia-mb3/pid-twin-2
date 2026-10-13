// =============================================================================
// CONTRATOS DE SIMULACIÓN MULTIDESTINO FEDERADA (ITERACIÓN 12)
// Soberanía del dato, compatibilidad previa, agregación sin mezclar datos crudos
// =============================================================================

import { IndicadoresDestino } from './ontology';
import { DataLane } from './interoperability';
import type { SemanticInputUseMode, ZoneSemanticSignal } from '../services/semanticSimulationInputService';

export type DestinationFederationStatus = 
  | 'COMPATIBLE' 
  | 'COMPATIBLE_CON_CONDICIONES' 
  | 'INCOMPLETO' 
  | 'NO_COMPATIBLE';

export interface CompatibilityEvidenceDetail {
  category: 'SEMANTICA_VARIABLES' | 'FUENTES_DISPONIBLES' | 'CALIDAD_FRECUENCIA' | 'TERRITORIO_CRS' | 'MODULOS_PID' | 'PRIVACIDAD_FINALIDAD';
  requirement: string;
  evaluatedStatus: 'CUMPLE' | 'ADVERTENCIA' | 'INCUMPLE';
  details: string;
  sourceId?: string;
  fingerprintSha256?: string;
}

export interface ParticipantCompatibilityEvaluation {
  destinationId: string;
  destinationName: string;
  tenantId: string;
  status: DestinationFederationStatus;
  compatibilityScorePct: number;
  checks: CompatibilityEvidenceDetail[];
  unmetMandatoryRequirements: string[];
  notes: string[];
}

export interface FederatedModelConfig {
  id: string;
  tenantId: string;
  coordinatorDestinationId: string;
  coordinatorDestinationName: string;
  modelPackageId: string;
  modelPackageVersion: string;
  modelTitle: string;
  name: string;
  description: string;
  temporalHorizonHours: number;
  dataSharingPolicy: 'SOLO_INDICADORES_AGREGADOS' | 'INDICADORES_Y_EVIDENCIA_AUTORIZADA';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: Array<{
    destinationId: string;
    destinationName: string;
    tenantId: string;
    role: 'COORDINADOR' | 'PARTICIPANTE';
    compatibilityStatus: DestinationFederationStatus;
    localBindingsSnapshot: Record<string, string>; // modelVariableId -> connectorId
  }>;
}

export interface LocalDestinationSimulationResult {
  destinationId: string;
  destinationName: string;
  tenantId: string;
  status: 'EXITOSO' | 'BLOQUEADO' | 'FALLIDO';
  base: IndicadoresDestino;
  scenario: IndicadoresDestino;
  delta: {
    visitantesEnDestino: number;
    variacionVsMedia: number;
    saturacionGlobalPct: number;
    emisionesCo2KgHora: number;
    ruidoMedioDb: number;
    distritosSaturadosCount: number;
    alertasActivasCount: number;
  };
  evidence: {
    contextFingerprint: string;
    datasetCount: number;
    connectorIds: string[];
    syntheticDemoData: boolean;
    uncertaintyPct: number;
    semanticInputs: {
      useMode: SemanticInputUseMode;
      usedForExecutionGate: boolean;
      calibrationApplied: boolean;
      calibrationRationale: string;
      observationCount: number;
      sourceTypes: Array<'PID_S2' | 'IOT_MQTT'>;
      latestObservedAt?: string;
      observationFingerprintsSha256: string[];
      evidenceFingerprintSha256: string;
      zoneSignals: ZoneSemanticSignal[];
      warnings: string[];
    };
  };
}

export interface FederatedSimulationResult {
  id: string;
  federatedConfigId: string;
  modelPackageId: string;
  modelPackageVersion: string;
  modelTitle: string;
  coordinatorDestinationId: string;
  executedAt: string;
  executedBy: string;
  status: 'COMPLETADO' | 'RECHAZADO_BLOQUEO' | 'FALLIDO';
  rejectionReason?: string;
  localResults: LocalDestinationSimulationResult[];
  aggregatedMetrics: {
    totalVisitantesBase: number;
    totalVisitantesEscenario: number;
    deltaTotalVisitantes: number;
    saturacionMediaPonderadaPct: number;
    totalAlertasActivas: number;
    emisionesTotalesCo2KgHora: number;
    nivelIncertidumbreGlobal: 'BAJA' | 'MEDIA' | 'ALTA';
  };
  evidence: {
    federationFingerprintSha256: string;
    destinationsIncluded: string[];
    dataLanesUsed: DataLane[];
    syntheticWarning: boolean;
    operatorSignature: string;
    semanticInputsUsed: boolean;
    semanticEvidenceFingerprintsSha256: string[];
  };
}

export interface FederatedExecutionDecision {
  id: string;
  federatedRunId: string;
  tenantId: string;
  destinationId: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  action: 'APROBAR_COMPARTICION' | 'ARCHIVAR_LOCAL' | 'DIFUNDIR_PID';
  rationale: string;
  decidedAt: string;
}
