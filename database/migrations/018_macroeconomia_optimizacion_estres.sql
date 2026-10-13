-- =============================================================================
-- MIGRACIÓN 018: IMPACTO MACROECONÓMICO, OPTIMIZACIÓN DE FLUJOS Y PRUEBAS DE ESTRÉS
-- Iteración 15: PostGIS + RLS Bicomponente (tenant_id, destino_id) + Auditoría Inmutable
-- =============================================================================

BEGIN;

-- 1. Simulaciones de Impacto Macroeconómico
CREATE TABLE IF NOT EXISTS simulaciones_impacto_macroeconomico (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  run_id TEXT,
  scenario_title TEXT NOT NULL,
  total_visitors_modeled NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics_base JSONB NOT NULL,
  metrics_scenario JSONB NOT NULL,
  metrics_delta JSONB NOT NULL,
  uncertainty_type TEXT NOT NULL CHECK (uncertainty_type IN ('CALIBRADA_EMPIRICA', 'PARAMETRICA_SINTETICA')),
  evidence_fingerprint_sha256 TEXT NOT NULL,
  methodology_disclaimer TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_macro_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_simulaciones_macro_scope
  ON simulaciones_impacto_macroeconomico (tenant_id, destino_id, model_id, timestamp);

ALTER TABLE simulaciones_impacto_macroeconomico ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulaciones_impacto_macroeconomico FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macro_simulations_scope_policy ON simulaciones_impacto_macroeconomico;
CREATE POLICY macro_simulations_scope_policy ON simulaciones_impacto_macroeconomico
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON simulaciones_impacto_macroeconomico TO gemelotur_app;

-- 2. Propuestas de Optimización y Balanceo de Flujos
CREATE TABLE IF NOT EXISTS propuestas_optimizacion_flujos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  critical_zones_count INTEGER NOT NULL,
  receptive_zones_count INTEGER NOT NULL,
  suggested_routes JSONB NOT NULL,
  projected_peak_relief_pct NUMERIC NOT NULL,
  estimated_diversion_cost_euros NUMERIC NOT NULL,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA' CHECK (status IN ('PENDIENTE_FIRMA', 'APROBADA_OPERADOR', 'RECHAZADA_OPERADOR')),
  governance_warning TEXT NOT NULL,
  generado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_optimizacion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_propuestas_optimizacion_scope
  ON propuestas_optimizacion_flujos (tenant_id, destino_id, status);

ALTER TABLE propuestas_optimizacion_flujos ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuestas_optimizacion_flujos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_optimization_scope_policy ON propuestas_optimizacion_flujos;
CREATE POLICY flow_optimization_scope_policy ON propuestas_optimizacion_flujos
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON propuestas_optimizacion_flujos TO gemelotur_app;

-- 3. Registro Inmutable de Decisiones Humanas sobre Optimización
CREATE TABLE IF NOT EXISTS decisiones_optimizacion_flujos (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES propuestas_optimizacion_flujos (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APROBADA_OPERADOR', 'RECHAZADA_OPERADOR')),
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_fingerprint_sha256 TEXT NOT NULL,
  CONSTRAINT fk_decision_optimizacion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_optimizacion_unica
  ON decisiones_optimizacion_flujos (proposal_id);

ALTER TABLE decisiones_optimizacion_flujos ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisiones_optimizacion_flujos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_decision_scope_policy ON decisiones_optimizacion_flujos;
CREATE POLICY flow_decision_scope_policy ON decisiones_optimizacion_flujos
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON decisiones_optimizacion_flujos TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON decisiones_optimizacion_flujos FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_decisiones_optimizacion_immutable ON decisiones_optimizacion_flujos;
CREATE TRIGGER trg_decisiones_optimizacion_immutable
BEFORE UPDATE OR DELETE ON decisiones_optimizacion_flujos
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 4. Registro de Pruebas de Estrés en Horizontes T+1, T+4, T+24
CREATE TABLE IF NOT EXISTS pruebas_estres_horizontes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  stress_profile_name TEXT NOT NULL CHECK (stress_profile_name IN ('PICO_MASIVO_MODERADO', 'PICO_SEVERO_INMINENTE', 'COLAPSO_EVENTO_EXTRAORDINARIO')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  horizons_data JSONB NOT NULL,
  global_resilience_verdict TEXT NOT NULL CHECK (global_resilience_verdict IN ('RESILIENTE_CON_HOLGURA', 'VULNERABILIDAD_MODERADA', 'RIESGO_COLAPSO_INMINENTE')),
  evidence_fingerprint_sha256 TEXT NOT NULL,
  disclaimer TEXT NOT NULL,
  CONSTRAINT fk_estres_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_pruebas_estres_scope
  ON pruebas_estres_horizontes (tenant_id, destino_id, executed_at);

ALTER TABLE pruebas_estres_horizontes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruebas_estres_horizontes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stress_tests_scope_policy ON pruebas_estres_horizontes;
CREATE POLICY stress_tests_scope_policy ON pruebas_estres_horizontes
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON pruebas_estres_horizontes TO gemelotur_app;

COMMIT;
