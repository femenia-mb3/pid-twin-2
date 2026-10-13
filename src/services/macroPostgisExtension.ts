// =============================================================================
// EXTENSIÓN POSTGIS: IMPACTO MACROECONÓMICO, OPTIMIZACIÓN Y ESTRÉS
// Iteración 15: PostGIS + Row Level Security (tenant_id + destino_id)
// =============================================================================

import { postgisClient } from './postgisClient';
import { 
  MacroeconomicSimulationResult, 
  FlowOptimizationProposal, 
  OptimizationDecisionRecord, 
  StressTestExecutionResult 
} from '../types/macroOptimizationStress';

export class MacroPostgisExtension {
  /**
   * Guarda una simulación de impacto macroeconómico bajo contexto RLS
   */
  public static async saveMacroeconomicSimulation(
    sim: MacroeconomicSimulationResult
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(sim.tenantId, sim.destinationId, async (client) => {
      await client.query(
        `INSERT INTO simulaciones_impacto_macroeconomico (
           id, tenant_id, destino_id, model_id, run_id, scenario_title,
           total_visitors_modeled, timestamp, metrics_base, metrics_scenario,
           metrics_delta, uncertainty_type, evidence_fingerprint_sha256, methodology_disclaimer
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          sim.id,
          sim.tenantId,
          sim.destinationId,
          sim.modelId,
          sim.runId || null,
          sim.scenarioTitle,
          sim.totalVisitorsModeled,
          sim.timestamp,
          JSON.stringify(sim.metrics.base),
          JSON.stringify(sim.metrics.scenario),
          JSON.stringify(sim.metrics.delta),
          sim.uncertaintyType,
          sim.evidenceFingerprintSha256,
          sim.methodologyDisclaimer
        ]
      );
      return true;
    });
  }

  /**
   * Lista simulaciones macroeconómicas de un destino
   */
  public static async listMacroeconomicSimulations(
    tenantId: string,
    destinationId: string,
    limit: number = 20
  ): Promise<MacroeconomicSimulationResult[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM simulaciones_impacto_macroeconomico
         WHERE tenant_id = $1 AND destino_id = $2
         ORDER BY timestamp DESC
         LIMIT $3`,
        [tenantId, destinationId, limit]
      );

      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        runId: r.run_id,
        scenarioTitle: r.scenario_title,
        totalVisitorsModeled: Number(r.total_visitors_modeled),
        timestamp: r.timestamp,
        metrics: {
          base: typeof r.metrics_base === 'string' ? JSON.parse(r.metrics_base) : r.metrics_base,
          scenario: typeof r.metrics_scenario === 'string' ? JSON.parse(r.metrics_scenario) : r.metrics_scenario,
          delta: typeof r.metrics_delta === 'string' ? JSON.parse(r.metrics_delta) : r.metrics_delta
        },
        uncertaintyType: r.uncertainty_type,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        methodologyDisclaimer: r.methodology_disclaimer
      }));
    });
  }

  /**
   * Guarda una propuesta técnica de optimización de flujos
   */
  public static async saveFlowOptimizationProposal(
    prop: FlowOptimizationProposal
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(prop.tenantId, prop.destinationId, async (client) => {
      await client.query(
        `INSERT INTO propuestas_optimizacion_flujos (
           id, tenant_id, destino_id, trigger_condition, critical_zones_count,
           receptive_zones_count, suggested_routes, projected_peak_relief_pct,
           estimated_diversion_cost_euros, evidence_fingerprint_sha256, status, governance_warning
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          prop.id,
          prop.tenantId,
          prop.destinationId,
          prop.triggerCondition,
          prop.criticalZonesCount,
          prop.receptiveZonesCount,
          JSON.stringify(prop.suggestedRoutes),
          prop.projectedPeakReliefPct,
          prop.estimatedDiversionCostEuros,
          prop.evidenceFingerprintSha256,
          prop.status,
          prop.governanceWarning
        ]
      );
      return true;
    });
  }

  /**
   * Obtiene una propuesta de optimización por ID
   */
  public static async getFlowOptimizationProposal(
    tenantId: string,
    destinationId: string,
    proposalId: string
  ): Promise<FlowOptimizationProposal | null> {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM propuestas_optimizacion_flujos
         WHERE id = $1 AND tenant_id = $2 AND destino_id = $3
         LIMIT 1`,
        [proposalId, tenantId, destinationId]
      );

      if (res.rows.length === 0) return null;
      const r = res.rows[0];

      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        generatedAt: r.generado_en,
        triggerCondition: r.trigger_condition,
        criticalZonesCount: Number(r.critical_zones_count),
        receptiveZonesCount: Number(r.receptive_zones_count),
        suggestedRoutes: typeof r.suggested_routes === 'string' ? JSON.parse(r.suggested_routes) : r.suggested_routes,
        projectedPeakReliefPct: Number(r.projected_peak_relief_pct),
        estimatedDiversionCostEuros: Number(r.estimated_diversion_cost_euros),
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        status: r.status,
        governanceWarning: r.governance_warning
      };
    });
  }

  /**
   * Registra la decisión humana sobre una propuesta de optimización y actualiza su estado
   */
  public static async recordOptimizationDecision(
    decisionRecord: OptimizationDecisionRecord
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(decisionRecord.tenantId, decisionRecord.destinationId, async (client) => {
      // 1. Insertar decisión inmutable
      await client.query(
        `INSERT INTO decisiones_optimizacion_flujos (
           id, proposal_id, tenant_id, destino_id, decision, operator_id,
           operator_name, operator_role, rationale, decided_at, decision_fingerprint_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          decisionRecord.id,
          decisionRecord.proposalId,
          decisionRecord.tenantId,
          decisionRecord.destinationId,
          decisionRecord.decision,
          decisionRecord.operatorId,
          decisionRecord.operatorName,
          decisionRecord.operatorRole,
          decisionRecord.rationale,
          decisionRecord.decidedAt,
          decisionRecord.decisionFingerprintSha256
        ]
      );

      // 2. Actualizar estado en propuestas_optimizacion_flujos
      await client.query(
        `UPDATE propuestas_optimizacion_flujos
         SET status = $1
         WHERE id = $2 AND tenant_id = $3 AND destino_id = $4`,
        [decisionRecord.decision, decisionRecord.proposalId, decisionRecord.tenantId, decisionRecord.destinationId]
      );

      return true;
    });
  }

  /**
   * Guarda una ejecución de prueba de estrés en PostGIS
   */
  public static async saveStressTestExecution(
    res: StressTestExecutionResult
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(res.tenantId, res.destinationId, async (client) => {
      await client.query(
        `INSERT INTO pruebas_estres_horizontes (
           id, tenant_id, destino_id, stress_profile_name, executed_at,
           horizons_data, global_resilience_verdict, evidence_fingerprint_sha256, disclaimer
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          res.id,
          res.tenantId,
          res.destinationId,
          res.stressProfileName,
          res.executedAt,
          JSON.stringify(res.horizons),
          res.globalResilienceVerdict,
          res.evidenceFingerprintSha256,
          res.disclaimer
        ]
      );
      return true;
    });
  }

  /**
   * Lista resultados de pruebas de estrés
   */
  public static async listStressTests(
    tenantId: string,
    destinationId: string,
    limit: number = 10
  ): Promise<StressTestExecutionResult[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM pruebas_estres_horizontes
         WHERE tenant_id = $1 AND destino_id = $2
         ORDER BY executed_at DESC
         LIMIT $3`,
        [tenantId, destinationId, limit]
      );

      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        stressProfileName: r.stress_profile_name,
        executedAt: r.executed_at,
        horizons: typeof r.horizons_data === 'string' ? JSON.parse(r.horizons_data) : r.horizons_data,
        globalResilienceVerdict: r.global_resilience_verdict,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        disclaimer: r.disclaimer
      }));
    });
  }
}
