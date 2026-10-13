// =============================================================================
// CONTRATOS DE DATOS: CALIBRACIÓN REAL Y PREDICCIÓN VALIDABLE (ITERACIÓN 14)
// Trazabilidad formal: fuente -> cobertura -> zona -> variable -> unidad -> transformacion
// =============================================================================

export type SourceType = 'PID_S2' | 'IOT_MQTT' | 'PID_C4' | 'MUNICIPAL_API' | 'INGESTED_DATASET';

export type SpatialCoverageType = 'EXACT_ZONE' | 'POINT_RADIUS' | 'CORRIDOR';

export type AggregationMethod = 'LATEST' | 'TIME_WEIGHTED_AVERAGE' | 'SUM_SENSORS' | 'MEDIAN_MOVING_WINDOW';

export type RuleApprovalState = 'BORRADOR' | 'APROBADO_OPERADOR' | 'SUSPENDIDO';

export type ForecastHorizon = 'T+1' | 'T+4' | 'T+24';

export type PredictionBias = 'NEUTRO' | 'SOBREESTIMACION' | 'SUBESTIMACION';

/**
 * Regla formal que conecta una fuente observacional verificable con una variable de modelo.
 */
export interface ModelVariableBindingRule {
  id: string;
  tenantId: string;
  destinationId: string;
  modelId: string;
  modelVariableId: string;
  modelVariableLabel: string;
  sourceType: SourceType;
  sourceConnectorId: string;
  sensorUrn?: string;
  targetZoneId: string;
  targetZoneName: string;
  spatialCoverageType: SpatialCoverageType;
  spatialCoverageRadiusMeters?: number;
  expectedSourceUnit: string;
  targetModelUnit: string;
  unitMultiplier: number;
  aggregationMethod: AggregationMethod;
  aggregationWindowMinutes: number;
  minQualityRequired: 'A_CERTIFICADA' | 'B_ESTIMADA';
  approvalState: RuleApprovalState;
  approvedBy?: string;
  approvedAt?: string;
  approvalRationale?: string;
  evidenceFingerprintSha256: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Diagnóstico de cobertura territorial de fuentes para un destino y modelo.
 */
export interface DestinationCoverageReport {
  destinationId: string;
  destinationName: string;
  modelId: string;
  totalZonesCount: number;
  coveredZonesCount: number;
  coveragePct: number;
  status: 'COBERTURA_COMPLETA' | 'COBERTURA_PARCIAL' | 'SIN_COBERTURA_FORMAL';
  activeRulesCount: number;
  pendingApprovalRulesCount: number;
  zoneDetails: Array<{
    zoneId: string;
    zoneName: string;
    hasActiveRule: boolean;
    sensorCount: number;
    lastObservationTime?: string;
    signalStatus: 'OPTIMA' | 'DEGRADADA' | 'SIN_SENAL';
  }>;
  evaluatedAt: string;
}

/**
 * Propuesta técnica de calibración zonal calculada antes de someterla al operador.
 */
export interface CalibrationFactorProposal {
  zoneId: string;
  zoneName: string;
  modeledBaseValue: number;
  observedAggregateSignal: number;
  suggestedFactor: number; // observed / modeledBase
  appliedMultiplierClamped: number; // acotado a tolerancias seguras (ej. [0.4, 2.5])
  observationsCount: number;
  sampleTimeRange: { from: string; to: string };
  confidenceScorePct: number;
  isWithinSafetyBounds: boolean;
  notes: string[];
}

export interface CalibrationProposal {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  modelId: string;
  modelTitle: string;
  generatedAt: string;
  dataWindowMinutes: number;
  totalSignalsProcessed: number;
  averageFactor: number;
  proposalsByZone: CalibrationFactorProposal[];
  evidenceFingerprintSha256: string;
  governanceWarning: string;
}

/**
 * Calibración activa registrada en el destino tras firma humana inmutable.
 */
export interface ActiveDestinationCalibration {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  modelId: string;
  version: number;
  proposalId: string;
  factorsByZone: Record<string, number>; // zoneId -> factor
  decisionState: 'APROBADA' | 'RECHAZADA' | 'REVOCADA';
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  rationale: string;
  decidedAt: string;
  calibrationFingerprintSha256: string;
  status: 'ACTIVA_VIGENTE' | 'HISTORICA' | 'SUSPENDIDA';
}

/**
 * Registro de una predicción emitida por horizonte temporal (T+1, T+4, T+24).
 */
export interface ModelForecastRun {
  id: string;
  tenantId: string;
  destinationId: string;
  modelId: string;
  modelTitle: string;
  horizon: ForecastHorizon;
  horizonHours: number;
  forecastTimestamp: string; // Momento de la emisión
  targetTimestamp: string; // Momento proyectado para el que se predice
  calibrationIdUsed?: string;
  calibrationFingerprintSha256?: string;
  predictedVisitorTotal: number;
  predictedZoneValues: Record<string, number>;
  predictedSaturationAvgPct: number;
  predictedAlertsCount: number;
  uncertaintyType: 'CALIBRADA_EMPIRICA' | 'PARAMETRICA_SINTETICA';
  confidencePct: number;
  fingerprintSha256: string;
  status: 'PENDIENTE_EVALUACION' | 'RECONCILIADA_CON_REALIDAD' | 'CADUCADA_SIN_OBSERVACION';
  reconciliationId?: string;
}

/**
 * Evaluación ex-post de predicción frente a observación real (MAE, MAPE, Sesgo).
 */
export interface ForecastEvaluationResult {
  id: string;
  forecastRunId: string;
  tenantId: string;
  destinationId: string;
  modelId: string;
  horizon: ForecastHorizon;
  forecastTimestamp: string;
  targetTimestamp: string;
  evaluatedAt: string;
  predictedValue: number;
  actualObservedValue: number;
  absoluteError: number; // |predicted - actual|
  percentageErrorPct: number; // (|predicted - actual| / actual) * 100
  bias: PredictionBias;
  evaluationQuality: 'OPTIMA_COMPLETA' | 'PARCIAL_POCOS_SENSORES';
  observedSourcesCount: number;
  notes: string;
}

/**
 * Resumen de precisión histórica acumulada por destino y modelo.
 */
export interface ModelHistoricalAccuracySummary {
  destinationId: string;
  modelId: string;
  totalEvaluations: number;
  byHorizon: Record<ForecastHorizon, {
    samplesCount: number;
    meanAbsoluteError: number;
    meanAbsolutePercentageErrorPct: number;
    biasSummary: {
      neutroCount: number;
      sobreestimacionCount: number;
      subestimacionCount: number;
    };
    empiricalConfidencePct: number;
  }>;
  overallMapePct: number;
  lastUpdated: string;
}
