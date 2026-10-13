-- =============================================================================
-- MIGRACIÓN 016 — Iteración 14: Calibración Real y Predicción Validable
-- PostgreSQL 16 + PostGIS 3.4 con Row Level Security forzada y auditoría append-only
-- =============================================================================

BEGIN;

-- 1. Reglas Formales de Vínculo Fuente -> Cobertura -> Variable
CREATE TABLE IF NOT EXISTS reglas_vinculo_calibracion (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_variable_id TEXT NOT NULL,
  model_variable_label TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('PID_S2', 'IOT_MQTT', 'PID_C4', 'MUNICIPAL_API', 'INGESTED_DATASET')),
  source_connector_id TEXT NOT NULL,
  sensor_urn TEXT,
  target_zone_id TEXT NOT NULL,
  target_zone_name TEXT NOT NULL,
  spatial_coverage_type TEXT NOT NULL DEFAULT 'EXACT_ZONE' CHECK (spatial_coverage_type IN ('EXACT_ZONE', 'POINT_RADIUS', 'CORRIDOR')),
  spatial_coverage_radius_meters NUMERIC,
  expected_source_unit TEXT NOT NULL,
  target_model_unit TEXT NOT NULL,
  unit_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  aggregation_method TEXT NOT NULL DEFAULT 'LATEST' CHECK (aggregation_method IN ('LATEST', 'TIME_WEIGHTED_AVERAGE', 'SUM_SENSORS', 'MEDIAN_MOVING_WINDOW')),
  aggregation_window_minutes INTEGER NOT NULL DEFAULT 15,
  min_quality_required TEXT NOT NULL DEFAULT 'B_ESTIMADA' CHECK (min_quality_required IN ('A_CERTIFICADA', 'B_ESTIMADA')),
  approval_state TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (approval_state IN ('BORRADOR', 'APROBADO_OPERADOR', 'SUSPENDIDO')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  approval_rationale TEXT,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_regla_vinculo_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reglas_vinculo_scope
  ON reglas_vinculo_calibracion (tenant_id, destino_id, model_id, approval_state);

ALTER TABLE reglas_vinculo_calibracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_vinculo_calibracion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reglas_vinculo_scope_policy ON reglas_vinculo_calibracion;
CREATE POLICY reglas_vinculo_scope_policy ON reglas_vinculo_calibracion
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON reglas_vinculo_calibracion TO gemelotur_app;

-- 2. Versiones de Calibración Aprobadas por el Destino
CREATE TABLE IF NOT EXISTS versiones_calibracion_destino (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  proposal_id TEXT NOT NULL,
  factors_by_zone JSONB NOT NULL,
  decision_state TEXT NOT NULL CHECK (decision_state IN ('APROBADA', 'RECHAZADA', 'REVOCADA')),
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calibration_fingerprint_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVA_VIGENTE' CHECK (status IN ('ACTIVA_VIGENTE', 'HISTORICA', 'SUSPENDIDA')),
  CONSTRAINT fk_calibracion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_versiones_calibracion_scope
  ON versiones_calibracion_destino (tenant_id, destino_id, model_id, status);

ALTER TABLE versiones_calibracion_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE versiones_calibracion_destino FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS versiones_calibracion_scope_policy ON versiones_calibracion_destino;
CREATE POLICY versiones_calibracion_scope_policy ON versiones_calibracion_destino
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON versiones_calibracion_destino TO gemelotur_app;

-- 3. Registro de Predicciones por Horizonte Temporal (T+1, T+4, T+24)
CREATE TABLE IF NOT EXISTS predicciones_horizontes_registro (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_title TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('T+1', 'T+4', 'T+24')),
  horizon_hours INTEGER NOT NULL,
  forecast_timestamp TIMESTAMPTZ NOT NULL,
  target_timestamp TIMESTAMPTZ NOT NULL,
  calibration_id_used TEXT,
  calibration_fingerprint_sha256 TEXT,
  predicted_visitor_total NUMERIC NOT NULL,
  predicted_zone_values JSONB NOT NULL,
  predicted_saturation_avg_pct NUMERIC NOT NULL,
  predicted_alerts_count INTEGER NOT NULL DEFAULT 0,
  uncertainty_type TEXT NOT NULL CHECK (uncertainty_type IN ('CALIBRADA_EMPIRICA', 'PARAMETRICA_SINTETICA')),
  confidence_pct NUMERIC NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDIENTE_EVALUACION' CHECK (status IN ('PENDIENTE_EVALUACION', 'RECONCILIADA_CON_REALIDAD', 'CADUCADA_SIN_OBSERVACION')),
  reconciliation_id TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_predicciones_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_predicciones_horizontes_scope
  ON predicciones_horizontes_registro (tenant_id, destino_id, target_timestamp, status);

ALTER TABLE predicciones_horizontes_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones_horizontes_registro FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS predicciones_horizontes_policy ON predicciones_horizontes_registro;
CREATE POLICY predicciones_horizontes_policy ON predicciones_horizontes_registro
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON predicciones_horizontes_registro TO gemelotur_app;

-- 4. Evaluaciones Ex-Post Predicción vs Realidad (Inmutable, Append-Only)
CREATE TABLE IF NOT EXISTS evaluaciones_prediccion_observacion (
  id TEXT PRIMARY KEY,
  forecast_run_id TEXT NOT NULL REFERENCES predicciones_horizontes_registro (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('T+1', 'T+4', 'T+24')),
  forecast_timestamp TIMESTAMPTZ NOT NULL,
  target_timestamp TIMESTAMPTZ NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  predicted_value NUMERIC NOT NULL,
  actual_observed_value NUMERIC NOT NULL,
  absolute_error NUMERIC NOT NULL,
  percentage_error_pct NUMERIC NOT NULL,
  bias TEXT NOT NULL CHECK (bias IN ('NEUTRO', 'SOBREESTIMACION', 'SUBESTIMACION')),
  evaluation_quality TEXT NOT NULL CHECK (evaluation_quality IN ('OPTIMA_COMPLETA', 'PARCIAL_POCOS_SENSORES')),
  observed_sources_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  CONSTRAINT fk_evaluaciones_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_prediccion_scope
  ON evaluaciones_prediccion_observacion (tenant_id, destino_id, model_id, horizon);

ALTER TABLE evaluaciones_prediccion_observacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_prediccion_observacion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evaluaciones_prediccion_policy ON evaluaciones_prediccion_observacion;
CREATE POLICY evaluaciones_prediccion_policy ON evaluaciones_prediccion_observacion
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON evaluaciones_prediccion_observacion TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON evaluaciones_prediccion_observacion FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_evaluaciones_prediccion_immutable ON evaluaciones_prediccion_observacion;
CREATE TRIGGER trg_evaluaciones_prediccion_immutable
BEFORE UPDATE OR DELETE ON evaluaciones_prediccion_observacion
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

COMMIT;
