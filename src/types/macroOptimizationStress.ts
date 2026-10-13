// =============================================================================
// CONTRATOS DE DATOS: IMPACTO MACROECONÓMICO, OPTIMIZACIÓN Y ESTRÉS (ITERACIÓN 15)
// SEGITTUR / Plataforma Inteligente de Destinos (PID)
// =============================================================================

export interface MacroeconomicImpactMetrics {
  // Gasto directo
  directVisitorSpendEuros: number;
  averageSpendPerVisitorDayEuros: number;
  spendByCategoryEuros: {
    alojamiento: number;
    restauracion: number;
    comercioMinorista: number;
    culturaYActividades: number;
    transporteLocal: number;
  };

  // Valor Añadido Bruto (VAB) e Impacto Indirecto/Inducido
  grossValueAddedEuros: number; // VAB total generado
  directVabEuros: number;
  indirectAndInducedVabEuros: number;
  multiplierUsed: number; // Multiplicador insumo-producto (ej. 1.42)

  // Empleo generado equivalente
  equivalentJobsGenerated: number;

  // Retorno fiscal estimado para el destino
  fiscalReturnEuros: {
    tasaTuristicaMunicipal: number;
    impuestosComercialesLocales: number;
    ivaProrrateadoEfectivo: number;
    totalFiscalRevenueEuros: number;
  };

  // Coste de externalidades socioambientales estimadas
  externalitiesCostEuros: {
    refuerzoLimpiezaResiduos: number;
    seguridadYMovilidadExtraordinaria: number;
    huellaCarbonoEtsEuros: number;
    degradacionEspacioPublico: number;
    totalExternalitiesCostEuros: number;
  };

  // Balance socioeconómico neto
  netSocioeconomicBenefitEuros: number;
  netBenefitMarginPct: number;
}

export interface MacroeconomicSimulationResult {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  modelId: string;
  runId?: string;
  scenarioTitle: string;
  totalVisitorsModeled: number;
  timestamp: string;
  metrics: {
    base: MacroeconomicImpactMetrics;
    scenario: MacroeconomicImpactMetrics;
    delta: {
      spendDiffEuros: number;
      spendDiffPct: number;
      vabDiffEuros: number;
      jobsDiff: number;
      fiscalRevenueDiffEuros: number;
      externalitiesDiffEuros: number;
      netBenefitDiffEuros: number;
    };
  };
  uncertaintyType: 'CALIBRADA_EMPIRICA' | 'PARAMETRICA_SINTETICA';
  evidenceFingerprintSha256: string;
  methodologyDisclaimer: string;
}

export interface FlowDiversionRoute {
  sourceZoneId: string;
  sourceZoneName: string;
  sourceCurrentSaturationPct: number;
  targetZoneId: string;
  targetZoneName: string;
  targetCurrentSaturationPct: number;
  suggestedDiversionSharePct: number; // ej. 20%
  expectedSaturationReliefPct: number;
  transitModeRecommended: 'PEATONAL_SEÑALIZADA' | 'TRANSPORTE_PUBLICO' | 'MICRO_MOVILIDAD';
  corridorName: string;
  incentivesSuggested: string[];
}

export interface FlowOptimizationProposal {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  generatedAt: string;
  triggerCondition: string; // ej. "Afluencia supera umbral crítico (85%) en Eje Larios y Plaza Constitución"
  criticalZonesCount: number;
  receptiveZonesCount: number;
  suggestedRoutes: FlowDiversionRoute[];
  projectedPeakReliefPct: number;
  estimatedDiversionCostEuros: number;
  evidenceFingerprintSha256: string;
  status: 'PENDIENTE_FIRMA' | 'APROBADA_OPERADOR' | 'RECHAZADA_OPERADOR';
  governanceWarning: string;
}

export interface OptimizationDecisionRecord {
  id: string;
  tenantId: string;
  destinationId: string;
  proposalId: string;
  decision: 'APROBADA_OPERADOR' | 'RECHAZADA_OPERADOR';
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  rationale: string;
  decidedAt: string;
  decisionFingerprintSha256: string;
}

export interface StressHorizonOutcome {
  horizon: 'T+1' | 'T+4' | 'T+24';
  horizonHours: number;
  shockFactorPct: number; // ej. +30%, +60%, +100%
  baselineVisitors: number;
  stressedVisitors: number;
  averageSaturationPct: number;
  saturatedZonesCount: number;
  criticalZonesList: Array<{
    zoneId: string;
    zoneName: string;
    saturationPct: number;
    capacityLimit: number;
    isOverflown: boolean;
  }>;
  resilienceScorePct: number; // 0 a 100
  timeToCriticalAlertMinutes: number;
  externalitiesShockEuros: number;
  recommendations: string[];
}

export interface StressTestExecutionResult {
  id: string;
  tenantId: string;
  destinationId: string;
  destinationName: string;
  executedAt: string;
  stressProfileName: 'PICO_MASIVO_MODERADO' | 'PICO_SEVERO_INMINENTE' | 'COLAPSO_EVENTO_EXTRAORDINARIO';
  horizons: {
    'T+1': StressHorizonOutcome;
    'T+4': StressHorizonOutcome;
    'T+24': StressHorizonOutcome;
  };
  globalResilienceVerdict: 'RESILIENTE_CON_HOLGURA' | 'VULNERABILIDAD_MODERADA' | 'RIESGO_COLAPSO_INMINENTE';
  evidenceFingerprintSha256: string;
  disclaimer: string;
}
