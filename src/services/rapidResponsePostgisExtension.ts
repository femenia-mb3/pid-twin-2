// =============================================================================
// EXTENSIÓN POSTGIS: AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ANTE COLAPSO
// Iteración 16: PostGIS + Row Level Security (tenant_id + destino_id)
// =============================================================================

import { postgisClient } from './postgisClient';
import {
  RapidResponseAgentProfile,
  CollapseIncident,
  RapidInterventionPlan,
  AgentExecutionDecisionRecord
} from '../types/rapidResponseAgent';

export class RapidResponsePostgisExtension {
  /**
   * Obtiene la configuración activa del agente de un destino bajo RLS
   */
  public static async getAgentProfile(
    tenantId: string,
    destinationId: string
  ): Promise<RapidResponseAgentProfile | null> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La base de datos institucional no está disponible.");

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM agentes_respuesta_configuracion
         WHERE tenant_id = $1 AND destino_id = $2
         LIMIT 1`,
        [tenantId, destinationId]
      );

      if (res.rows.length === 0) return null;
      const r = res.rows[0];

      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        agentName: r.agent_name,
        mode: r.mode,
        enabled: Boolean(r.enabled),
        saturationThresholdPct: Number(r.saturation_threshold_pct),
        earlyWarningHorizonHours: Number(r.early_warning_horizon_hours),
        monitoredZoneIds: typeof r.monitored_zone_ids === 'string' ? JSON.parse(r.monitored_zone_ids) : r.monitored_zone_ids,
        autonomousPreApprovedActions: typeof r.autonomous_preapproved_actions === 'string' ? JSON.parse(r.autonomous_preapproved_actions) : r.autonomous_preapproved_actions,
        leadUnit: r.lead_unit,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        updatedAt: r.updated_at
      };
    });
  }

  /**
   * Registra un nuevo incidente de colapso en PostGIS bajo RLS
   */
  public static async saveIncident(
    incident: CollapseIncident
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La persistencia de auditoría no está conectada. Operación denegada.");

    return await postgisClient.withTenantContext(incident.tenantId, incident.destinationId, async (client) => {
      await client.query(
        `INSERT INTO incidentes_colapso_detectados (
           id, tenant_id, destino_id, agent_id, severity, detected_at,
           source_zone_id, source_zone_name, current_saturation_pct,
           current_visitors, predicted_peak_visitors, predicted_horizon,
           time_to_critical_alert_minutes, trigger_cause, triggering_sensors,
           evidence_data_sources, evidence_fingerprint_sha256, resolved
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO NOTHING`,
        [
          incident.id,
          incident.tenantId,
          incident.destinationId,
          incident.agentId,
          incident.severity,
          incident.detectedAt,
          incident.sourceZoneId,
          incident.sourceZoneName,
          incident.currentSaturationPct,
          incident.currentVisitors,
          incident.predictedPeakVisitors,
          incident.predictedHorizon,
          incident.timeToCriticalAlertMinutes,
          incident.triggerCause,
          JSON.stringify(incident.triggeringSensors),
          JSON.stringify(incident.evidenceDataSources),
          incident.evidenceFingerprintSha256,
          incident.resolved
        ]
      );
      return true;
    });
  }

  /**
   * Lista incidentes detectados de un destino
   */
  public static async listIncidents(
    tenantId: string,
    destinationId: string,
    limit: number = 20
  ): Promise<CollapseIncident[]> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La base de datos institucional no está disponible.");

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM incidentes_colapso_detectados
         WHERE tenant_id = $1 AND destino_id = $2
         ORDER BY detected_at DESC
         LIMIT $3`,
        [tenantId, destinationId, limit]
      );

      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        agentId: r.agent_id,
        severity: r.severity,
        detectedAt: r.detected_at,
        sourceZoneId: r.source_zone_id,
        sourceZoneName: r.source_zone_name,
        currentSaturationPct: Number(r.current_saturation_pct),
        currentVisitors: Number(r.current_visitors),
        predictedPeakVisitors: Number(r.predicted_peak_visitors),
        predictedHorizon: r.predicted_horizon,
        timeToCriticalAlertMinutes: Number(r.time_to_critical_alert_minutes),
        triggerCause: r.trigger_cause,
        triggeringSensors: typeof r.triggering_sensors === 'string' ? JSON.parse(r.triggering_sensors) : r.triggering_sensors,
        evidenceDataSources: typeof r.evidence_data_sources === 'string' ? JSON.parse(r.evidence_data_sources) : r.evidence_data_sources,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        resolved: Boolean(r.resolved)
      }));
    });
  }

  /**
   * Guarda un plan de intervención rápida
   */
  public static async saveInterventionPlan(
    plan: RapidInterventionPlan
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La persistencia de auditoría no está conectada. Operación denegada.");

    return await postgisClient.withTenantContext(plan.tenantId, plan.destinationId, async (client) => {
      await client.query(
        `INSERT INTO planes_intervencion_rapida (
           id, incident_id, tenant_id, destino_id, title, created_at,
           status, projected_relief_pct, estimated_total_cost_euros,
           actions, governance_warning, evidence_fingerprint_sha256, synthetic_disclaimer
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          plan.id,
          plan.incidentId,
          plan.tenantId,
          plan.destinationId,
          plan.title,
          plan.createdAt,
          plan.status,
          plan.projectedReliefPct,
          plan.estimatedTotalCostEuros,
          JSON.stringify(plan.actions),
          plan.governanceWarning,
          plan.evidenceFingerprintSha256,
          plan.syntheticDisclaimer
        ]
      );
      return true;
    });
  }

  /**
   * Obtiene un plan de intervención por ID
   */
  public static async getInterventionPlan(
    tenantId: string,
    destinationId: string,
    planId: string
  ): Promise<RapidInterventionPlan | null> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La base de datos institucional no está disponible.");

    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM planes_intervencion_rapida
         WHERE id = $1 AND tenant_id = $2 AND destino_id = $3
         LIMIT 1`,
        [planId, tenantId, destinationId]
      );

      if (res.rows.length === 0) return null;
      const r = res.rows[0];

      return {
        id: r.id,
        incidentId: r.incident_id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        title: r.title,
        createdAt: r.created_at,
        status: r.status,
        projectedReliefPct: Number(r.projected_relief_pct),
        estimatedTotalCostEuros: Number(r.estimated_total_cost_euros),
        actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
        governanceWarning: r.governance_warning,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        syntheticDisclaimer: r.synthetic_disclaimer
      };
    });
  }

  /**
   * Registra la decisión humana inmutable sobre un plan de intervención rápida
   */
  public static async recordAgentInterventionDecision(
    decisionRecord: AgentExecutionDecisionRecord
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) throw new Error("POSTGIS_UNAVAILABLE: La persistencia de auditoría no está conectada. Operación denegada.");

    return await postgisClient.withTenantContext(decisionRecord.tenantId, decisionRecord.destinationId, async (client) => {
      // 1. Insertar en tabla inmutable
      await client.query(
        `INSERT INTO decisiones_intervencion_agente (
           id, plan_id, incident_id, tenant_id, destino_id, decision,
           operator_id, operator_name, operator_role, rationale,
           approved_actions, decided_at, decision_fingerprint_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          decisionRecord.id,
          decisionRecord.planId,
          decisionRecord.incidentId,
          decisionRecord.tenantId,
          decisionRecord.destinationId,
          decisionRecord.decision,
          decisionRecord.operatorId,
          decisionRecord.operatorName,
          decisionRecord.operatorRole,
          decisionRecord.rationale,
          JSON.stringify(decisionRecord.approvedActions),
          decisionRecord.decidedAt,
          decisionRecord.decisionFingerprintSha256
        ]
      );

      // 2. Actualizar estado del plan (el trigger comprobará la presencia de la decisión)
      await client.query(
        `UPDATE planes_intervencion_rapida
         SET status = $1
         WHERE id = $2 AND tenant_id = $3 AND destino_id = $4`,
        [decisionRecord.decision, decisionRecord.planId, decisionRecord.tenantId, decisionRecord.destinationId]
      );

      // 3. Marcar incidente como resuelto si fue autorizado
      if (decisionRecord.decision === 'AUTORIZADO_EJECUTADO') {
        await client.query(
          `UPDATE incidentes_colapso_detectados
           SET resolved = true
           WHERE id = $1 AND tenant_id = $2 AND destino_id = $3`,
          [decisionRecord.incidentId, decisionRecord.tenantId, decisionRecord.destinationId]
        );
      }

      return true;
    });
  }
}
