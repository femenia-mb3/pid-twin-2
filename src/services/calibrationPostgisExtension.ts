// =============================================================================
// EXTENSIÓN POSTGIS: CALIBRACIÓN REAL Y PREDICCIÓN VALIDABLE (ITERACIÓN 14)
// Operaciones transaccionales bajo contexto RLS fijado (tenant_id y destino_id)
// =============================================================================

import { postgisClient } from './postgisClient';
import { 
  ModelVariableBindingRule, 
  ActiveDestinationCalibration, 
  ModelForecastRun, 
  ForecastEvaluationResult,
  RuleApprovalState
} from '../types/calibrationForecast';

export class CalibrationPostgisExtension {
  /**
   * Guarda o actualiza una regla formal de vínculo.
   */
  public static async saveBindingRule(rule: ModelVariableBindingRule): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(rule.tenantId, rule.destinationId, async (client) => {
      const text = `
        INSERT INTO reglas_vinculo_calibracion (
          id, tenant_id, destino_id, model_id, model_variable_id, model_variable_label,
          source_type, source_connector_id, sensor_urn, target_zone_id, target_zone_name,
          spatial_coverage_type, spatial_coverage_radius_meters, expected_source_unit,
          target_model_unit, unit_multiplier, aggregation_method, aggregation_window_minutes,
          min_quality_required, approval_state, approved_by, approved_at, approval_rationale,
          evidence_fingerprint_sha256, actualizado_en
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          model_variable_label = EXCLUDED.model_variable_label,
          source_type = EXCLUDED.source_type,
          source_connector_id = EXCLUDED.source_connector_id,
          sensor_urn = EXCLUDED.sensor_urn,
          target_zone_id = EXCLUDED.target_zone_id,
          target_zone_name = EXCLUDED.target_zone_name,
          spatial_coverage_type = EXCLUDED.spatial_coverage_type,
          spatial_coverage_radius_meters = EXCLUDED.spatial_coverage_radius_meters,
          expected_source_unit = EXCLUDED.expected_source_unit,
          target_model_unit = EXCLUDED.target_model_unit,
          unit_multiplier = EXCLUDED.unit_multiplier,
          aggregation_method = EXCLUDED.aggregation_method,
          aggregation_window_minutes = EXCLUDED.aggregation_window_minutes,
          min_quality_required = EXCLUDED.min_quality_required,
          approval_state = EXCLUDED.approval_state,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          approval_rationale = EXCLUDED.approval_rationale,
          evidence_fingerprint_sha256 = EXCLUDED.evidence_fingerprint_sha256,
          actualizado_en = CURRENT_TIMESTAMP;
      `;

      const values = [
        rule.id,
        rule.tenantId,
        rule.destinationId,
        rule.modelId,
        rule.modelVariableId,
        rule.modelVariableLabel,
        rule.sourceType,
        rule.sourceConnectorId,
        rule.sensorUrn || null,
        rule.targetZoneId,
        rule.targetZoneName,
        rule.spatialCoverageType,
        rule.spatialCoverageRadiusMeters || null,
        rule.expectedSourceUnit,
        rule.targetModelUnit,
        rule.unitMultiplier,
        rule.aggregationMethod,
        rule.aggregationWindowMinutes,
        rule.minQualityRequired,
        rule.approvalState,
        rule.approvedBy || null,
        rule.approvedAt ? new Date(rule.approvedAt) : null,
        rule.approvalRationale || null,
        rule.evidenceFingerprintSha256
      ];

      const res = await client.query(text, values);
      return (res.rowCount ?? 0) > 0;
    });
  }

  /**
   * Lista reglas de vínculo por destino y opcionalmente por modelo.
   */
  public static async listBindingRules(
    tenantId: string, 
    destinationId: string, 
    modelId?: string,
    state?: RuleApprovalState
  ): Promise<ModelVariableBindingRule[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      let text = `
        SELECT id, tenant_id, destino_id, model_id, model_variable_id, model_variable_label,
               source_type, source_connector_id, sensor_urn, target_zone_id, target_zone_name,
               spatial_coverage_type, spatial_coverage_radius_meters, expected_source_unit,
               target_model_unit, unit_multiplier, aggregation_method, aggregation_window_minutes,
               min_quality_required, approval_state, approved_by, approved_at, approval_rationale,
               evidence_fingerprint_sha256, creado_en, actualizado_en
        FROM reglas_vinculo_calibracion
        WHERE destino_id = $1
      `;
      const values: any[] = [destinationId];

      if (modelId) {
        values.push(modelId);
        text += ` AND model_id = $${values.length}`;
      }
      if (state) {
        values.push(state);
        text += ` AND approval_state = $${values.length}`;
      }

      text += ` ORDER BY creado_en DESC`;

      const res = await client.query(text, values);
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        modelVariableId: r.model_variable_id,
        modelVariableLabel: r.model_variable_label,
        sourceType: r.source_type,
        sourceConnectorId: r.source_connector_id,
        sensorUrn: r.sensor_urn,
        targetZoneId: r.target_zone_id,
        targetZoneName: r.target_zone_name,
        spatialCoverageType: r.spatial_coverage_type,
        spatialCoverageRadiusMeters: r.spatial_coverage_radius_meters ? Number(r.spatial_coverage_radius_meters) : undefined,
        expectedSourceUnit: r.expected_source_unit,
        targetModelUnit: r.target_model_unit,
        unitMultiplier: Number(r.unit_multiplier),
        aggregationMethod: r.aggregation_method,
        aggregationWindowMinutes: Number(r.aggregation_window_minutes),
        minQualityRequired: r.min_quality_required,
        approvalState: r.approval_state,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : undefined,
        approvalRationale: r.approval_rationale,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        createdAt: new Date(r.creado_en).toISOString(),
        updatedAt: new Date(r.actualizado_en).toISOString()
      }));
    });
  }

  /**
   * Obtiene una regla de vínculo por ID.
   */
  public static async getBindingRuleById(tenantId: string, destinationId: string, id: string): Promise<ModelVariableBindingRule | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const text = `
        SELECT id, tenant_id, destino_id, model_id, model_variable_id, model_variable_label,
               source_type, source_connector_id, sensor_urn, target_zone_id, target_zone_name,
               spatial_coverage_type, spatial_coverage_radius_meters, expected_source_unit,
               target_model_unit, unit_multiplier, aggregation_method, aggregation_window_minutes,
               min_quality_required, approval_state, approved_by, approved_at, approval_rationale,
               evidence_fingerprint_sha256, creado_en, actualizado_en
        FROM reglas_vinculo_calibracion
        WHERE destino_id = $1 AND id = $2
        LIMIT 1
      `;
      const res = await client.query(text, [destinationId, id]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        modelVariableId: r.model_variable_id,
        modelVariableLabel: r.model_variable_label,
        sourceType: r.source_type,
        sourceConnectorId: r.source_connector_id,
        sensorUrn: r.sensor_urn,
        targetZoneId: r.target_zone_id,
        targetZoneName: r.target_zone_name,
        spatialCoverageType: r.spatial_coverage_type,
        spatialCoverageRadiusMeters: r.spatial_coverage_radius_meters ? Number(r.spatial_coverage_radius_meters) : undefined,
        expectedSourceUnit: r.expected_source_unit,
        targetModelUnit: r.target_model_unit,
        unitMultiplier: Number(r.unit_multiplier),
        aggregationMethod: r.aggregation_method,
        aggregationWindowMinutes: Number(r.aggregation_window_minutes),
        minQualityRequired: r.min_quality_required,
        approvalState: r.approval_state,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : undefined,
        approvalRationale: r.approval_rationale,
        evidenceFingerprintSha256: r.evidence_fingerprint_sha256,
        createdAt: new Date(r.creado_en).toISOString(),
        updatedAt: new Date(r.actualizado_en).toISOString()
      };
    });
  }

  /**
   * Guarda una versión de calibración aprobada por el operador.
   */
  public static async saveActiveCalibration(cal: ActiveDestinationCalibration): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(cal.tenantId, cal.destinationId, async (client) => {
      // Si se activa como vigente, marcar las previas como HISTORICAS
      if (cal.status === 'ACTIVA_VIGENTE') {
        await client.query(
          `UPDATE versiones_calibracion_destino SET status = 'HISTORICA' WHERE destino_id = $1 AND model_id = $2 AND status = 'ACTIVA_VIGENTE'`,
          [cal.destinationId, cal.modelId]
        );
      }

      const text = `
        INSERT INTO versiones_calibracion_destino (
          id, tenant_id, destino_id, model_id, version, proposal_id, factors_by_zone,
          decision_state, operator_id, operator_name, operator_role, rationale,
          decided_at, calibration_fingerprint_sha256, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          rationale = EXCLUDED.rationale;
      `;

      const values = [
        cal.id,
        cal.tenantId,
        cal.destinationId,
        cal.modelId,
        cal.version,
        cal.proposalId,
        JSON.stringify(cal.factorsByZone),
        cal.decisionState,
        cal.operatorId,
        cal.operatorName,
        cal.operatorRole,
        cal.rationale,
        new Date(cal.decidedAt),
        cal.calibrationFingerprintSha256,
        cal.status
      ];

      const res = await client.query(text, values);
      return (res.rowCount ?? 0) > 0;
    });
  }

  /**
   * Obtiene la calibración vigente para un destino y modelo.
   */
  public static async getActiveCalibration(tenantId: string, destinationId: string, modelId: string): Promise<ActiveDestinationCalibration | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const text = `
        SELECT id, tenant_id, destino_id, model_id, version, proposal_id, factors_by_zone,
               decision_state, operator_id, operator_name, operator_role, rationale,
               decided_at, calibration_fingerprint_sha256, status
        FROM versiones_calibracion_destino
        WHERE destino_id = $1 AND model_id = $2 AND status = 'ACTIVA_VIGENTE'
        ORDER BY version DESC
        LIMIT 1
      `;
      const res = await client.query(text, [destinationId, modelId]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        version: Number(r.version),
        proposalId: r.proposal_id,
        factorsByZone: typeof r.factors_by_zone === 'string' ? JSON.parse(r.factors_by_zone) : r.factors_by_zone,
        decisionState: r.decision_state,
        operatorId: r.operator_id,
        operatorName: r.operator_name,
        operatorRole: r.operator_role,
        rationale: r.rationale,
        decidedAt: new Date(r.decided_at).toISOString(),
        calibrationFingerprintSha256: r.calibration_fingerprint_sha256,
        status: r.status
      };
    });
  }

  /**
   * Registra una predicción emitida por horizonte.
   */
  public static async saveForecastRun(run: ModelForecastRun): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(run.tenantId, run.destinationId, async (client) => {
      const text = `
        INSERT INTO predicciones_horizontes_registro (
          id, tenant_id, destino_id, model_id, model_title, horizon, horizon_hours,
          forecast_timestamp, target_timestamp, calibration_id_used, calibration_fingerprint_sha256,
          predicted_visitor_total, predicted_zone_values, predicted_saturation_avg_pct,
          predicted_alerts_count, uncertainty_type, confidence_pct, fingerprint_sha256, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          reconciliation_id = EXCLUDED.reconciliation_id;
      `;

      const values = [
        run.id,
        run.tenantId,
        run.destinationId,
        run.modelId,
        run.modelTitle,
        run.horizon,
        run.horizonHours,
        new Date(run.forecastTimestamp),
        new Date(run.targetTimestamp),
        run.calibrationIdUsed || null,
        run.calibrationFingerprintSha256 || null,
        run.predictedVisitorTotal,
        JSON.stringify(run.predictedZoneValues),
        run.predictedSaturationAvgPct,
        run.predictedAlertsCount,
        run.uncertaintyType,
        run.confidencePct,
        run.fingerprintSha256,
        run.status
      ];

      const res = await client.query(text, values);
      return (res.rowCount ?? 0) > 0;
    });
  }

  /**
   * Lista predicciones registradas.
   */
  public static async listForecastRuns(tenantId: string, destinationId: string, modelId?: string): Promise<ModelForecastRun[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      let text = `
        SELECT id, tenant_id, destino_id, model_id, model_title, horizon, horizon_hours,
               forecast_timestamp, target_timestamp, calibration_id_used, calibration_fingerprint_sha256,
               predicted_visitor_total, predicted_zone_values, predicted_saturation_avg_pct,
               predicted_alerts_count, uncertainty_type, confidence_pct, fingerprint_sha256,
               status, reconciliation_id
        FROM predicciones_horizontes_registro
        WHERE destino_id = $1
      `;
      const values: any[] = [destinationId];

      if (modelId) {
        values.push(modelId);
        text += ` AND model_id = $${values.length}`;
      }

      text += ` ORDER BY forecast_timestamp DESC LIMIT 50`;

      const res = await client.query(text, values);
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        modelTitle: r.model_title,
        horizon: r.horizon,
        horizonHours: Number(r.horizon_hours),
        forecastTimestamp: new Date(r.forecast_timestamp).toISOString(),
        targetTimestamp: new Date(r.target_timestamp).toISOString(),
        calibrationIdUsed: r.calibration_id_used,
        calibrationFingerprintSha256: r.calibration_fingerprint_sha256,
        predictedVisitorTotal: Number(r.predicted_visitor_total),
        predictedZoneValues: typeof r.predicted_zone_values === 'string' ? JSON.parse(r.predicted_zone_values) : r.predicted_zone_values,
        predictedSaturationAvgPct: Number(r.predicted_saturation_avg_pct),
        predictedAlertsCount: Number(r.predicted_alerts_count),
        uncertaintyType: r.uncertainty_type,
        confidencePct: Number(r.confidence_pct),
        fingerprintSha256: r.fingerprint_sha256,
        status: r.status,
        reconciliationId: r.reconciliation_id
      }));
    });
  }

  /**
   * Registra una evaluación ex-post (inmutable, append-only).
   */
  public static async recordForecastEvaluation(evalResult: ForecastEvaluationResult): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(evalResult.tenantId, evalResult.destinationId, async (client) => {
      const text = `
        INSERT INTO evaluaciones_prediccion_observacion (
          id, forecast_run_id, tenant_id, destino_id, model_id, horizon,
          forecast_timestamp, target_timestamp, evaluated_at, predicted_value,
          actual_observed_value, absolute_error, percentage_error_pct, bias,
          evaluation_quality, observed_sources_count, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        );
      `;

      const values = [
        evalResult.id,
        evalResult.forecastRunId,
        evalResult.tenantId,
        evalResult.destinationId,
        evalResult.modelId,
        evalResult.horizon,
        new Date(evalResult.forecastTimestamp),
        new Date(evalResult.targetTimestamp),
        new Date(evalResult.evaluatedAt),
        evalResult.predictedValue,
        evalResult.actualObservedValue,
        evalResult.absoluteError,
        evalResult.percentageErrorPct,
        evalResult.bias,
        evalResult.evaluationQuality,
        evalResult.observedSourcesCount,
        evalResult.notes
      ];

      const res = await client.query(text, values);
      if ((res.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE predicciones_horizontes_registro SET status = 'RECONCILIADA_CON_REALIDAD', reconciliation_id = $1 WHERE id = $2`,
          [evalResult.id, evalResult.forecastRunId]
        );
        return true;
      }
      return false;
    });
  }

  /**
   * Lista evaluaciones ex-post registradas.
   */
  public static async listForecastEvaluations(tenantId: string, destinationId: string, modelId?: string): Promise<ForecastEvaluationResult[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      let text = `
        SELECT id, forecast_run_id, tenant_id, destino_id, model_id, horizon,
               forecast_timestamp, target_timestamp, evaluated_at, predicted_value,
               actual_observed_value, absolute_error, percentage_error_pct, bias,
               evaluation_quality, observed_sources_count, notes
        FROM evaluaciones_prediccion_observacion
        WHERE destino_id = $1
      `;
      const values: any[] = [destinationId];

      if (modelId) {
        values.push(modelId);
        text += ` AND model_id = $${values.length}`;
      }

      text += ` ORDER BY evaluated_at DESC LIMIT 100`;

      const res = await client.query(text, values);
      return res.rows.map((r: any) => ({
        id: r.id,
        forecastRunId: r.forecast_run_id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        destinationName: r.destino_id,
        modelId: r.model_id,
        horizon: r.horizon,
        forecastTimestamp: new Date(r.forecast_timestamp).toISOString(),
        targetTimestamp: new Date(r.target_timestamp).toISOString(),
        evaluatedAt: new Date(r.evaluated_at).toISOString(),
        predictedValue: Number(r.predicted_value),
        actualObservedValue: Number(r.actual_observed_value),
        absoluteError: Number(r.absolute_error),
        percentageErrorPct: Number(r.percentage_error_pct),
        bias: r.bias,
        evaluationQuality: r.evaluation_quality,
        observedSourcesCount: Number(r.observed_sources_count),
        notes: r.notes || ''
      }));
    });
  }
}
