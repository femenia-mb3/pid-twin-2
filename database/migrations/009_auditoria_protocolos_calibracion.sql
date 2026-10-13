-- =============================================================================
-- MIGRACIÓN 009 — Iteración 6: Auditoría de IA, Protocolos Operativos y Calibración Predictiva
-- Requiere 005_context_packages.sql, 006_editor_escenarios.sql y 007_simulation_runs.sql.
-- PostgreSQL 16 + PostGIS 3.4 con ROW LEVEL SECURITY obligatoria.
-- =============================================================================

BEGIN;

-- 1. Tabla de Operadores y Sesiones del Gemelo
CREATE TABLE IF NOT EXISTS operadores_sesion (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants_gemelo (id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN_SEGITTUR', 'GESTOR_TURISMO', 'SUPERVISOR_MOVILIDAD', 'ANALISTA_DESTINO')),
  destinos_autorizados JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar operadores de demostración institucional
INSERT INTO operadores_sesion (id, username, display_name, email, tenant_id, rol, destinos_autorizados)
VALUES 
  ('op_malaga_01', 'gestor_malaga', 'Carlos Domínguez (Gestor Turismo Málaga)', 'carlos.dominguez@malaga.es', 'tenant_ayto_malaga', 'GESTOR_TURISMO', '["malaga"]'::jsonb),
  ('op_palma_01', 'gestor_palma', 'Catalina Ribas (Movilidad Palma)', 'catalina.ribas@palma.es', 'tenant_ayto_palma', 'SUPERVISOR_MOVILIDAD', '["palma"]'::jsonb),
  ('op_segittur_01', 'admin_pid', 'Dirección Técnica SEGITTUR (Supervisión PID)', 'gemelo.digital@segittur.es', 'tenant_ayto_malaga', 'ADMIN_SEGITTUR', '["malaga", "palma"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  destinos_autorizados = EXCLUDED.destinos_autorizados;

-- 2. Tabla de Auditoría Inmutable de Consultas y Propuestas de IA (Knowledge Guard)
CREATE TABLE IF NOT EXISTS ai_proposals_audit (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  intent TEXT NOT NULL,
  status TEXT NOT NULL,
  context_fingerprint TEXT NOT NULL,
  context_version TEXT NOT NULL,
  data_sources JSONB NOT NULL,
  rationale TEXT NOT NULL,
  assumptions JSONB NOT NULL,
  uncertainty_level TEXT NOT NULL,
  confidence_pct NUMERIC(5,2) NOT NULL,
  synthetic_demo_data BOOLEAN NOT NULL DEFAULT true,
  decision TEXT NOT NULL DEFAULT 'PROPUESTO' CHECK (decision IN ('PROPUESTO', 'APLICADO_SIMULADOR', 'EXPORTADO_ESTUDIO', 'RECHAZADO', 'MODIFICADO_Y_EJECUTADO')),
  decision_rationale TEXT,
  linked_scenario_id TEXT,
  linked_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT ai_proposals_audit_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT ai_proposals_audit_fingerprint_check
    CHECK (context_fingerprint ~ '^[0-9a-f]{64}$')
);

-- 3. Tabla de Protocolos Operativos ante Saturación y Eventos Críticos
CREATE TABLE IF NOT EXISTS protocolos_operativos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('SATURACION_ZONA', 'CONCENTRACION_CRUCEROS', 'ALERTA_METEOROLOGICA', 'EMISIONES_CO2', 'EVENTO_MASIVO')),
  trigger_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 85.00,
  target_zone_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  severidad TEXT NOT NULL CHECK (severidad IN ('INFORMATIVA', 'MODERADA', 'CRITICA')),
  lead_unit TEXT NOT NULL CHECK (lead_unit IN ('POLICIA_LOCAL', 'MOVILIDAD_TRANSITO', 'PATRIMONIO_CULTURA', 'PROTECCION_CIVIL', 'PUERTO_CRUCEROS')),
  action_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT protocolos_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

-- 4. Tabla de Calibración Predictiva (Predicción vs Observación Real)
CREATE TABLE IF NOT EXISTS calibraciones_predictivas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('T_1H', 'T_4H', 'T_24H', 'T_48H')),
  predicted_at TIMESTAMPTZ NOT NULL,
  target_timestamp TIMESTAMPTZ NOT NULL,
  predicted_visitors INTEGER NOT NULL,
  observed_visitors INTEGER NOT NULL,
  absolute_error INTEGER NOT NULL,
  percentage_error NUMERIC(5,2) NOT NULL,
  calibrated_confidence_pct NUMERIC(5,2) NOT NULL,
  model_id TEXT NOT NULL,
  sensor_verification_id TEXT,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calibraciones_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_ai_proposals_audit_scope_created
  ON ai_proposals_audit (tenant_id, destino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_proposals_audit_fingerprint
  ON ai_proposals_audit (tenant_id, destino_id, context_fingerprint);
CREATE INDEX IF NOT EXISTS idx_protocolos_operativos_scope
  ON protocolos_operativos (tenant_id, destino_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_calibraciones_scope_horizon
  ON calibraciones_predictivas (tenant_id, destino_id, horizon, target_timestamp DESC);

-- Habilitar y forzar Row Level Security
ALTER TABLE ai_proposals_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_proposals_audit FORCE ROW LEVEL SECURITY;

ALTER TABLE protocolos_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolos_operativos FORCE ROW LEVEL SECURITY;

ALTER TABLE calibraciones_predictivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibraciones_predictivas FORCE ROW LEVEL SECURITY;

-- Políticas RLS por Tenant y Destino
DROP POLICY IF EXISTS ai_proposals_audit_scope_policy ON ai_proposals_audit;
CREATE POLICY ai_proposals_audit_scope_policy ON ai_proposals_audit
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

DROP POLICY IF EXISTS protocolos_operativos_scope_policy ON protocolos_operativos;
CREATE POLICY protocolos_operativos_scope_policy ON protocolos_operativos
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

DROP POLICY IF EXISTS calibraciones_predictivas_scope_policy ON calibraciones_predictivas;
CREATE POLICY calibraciones_predictivas_scope_policy ON calibraciones_predictivas
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- Otorgar permisos al rol de aplicacion no superusuario
GRANT SELECT, INSERT, UPDATE ON operadores_sesion TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE ON ai_proposals_audit TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON protocolos_operativos TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE ON calibraciones_predictivas TO gemelotur_app;

-- 5. Actualizar función fn_gemelotur_persistence_health para incluir auditoría y protocolos
CREATE OR REPLACE FUNCTION fn_gemelotur_persistence_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_destinos BIGINT;
  v_packages BIGINT;
  v_escenarios BIGINT;
  v_runs BIGINT;
  v_zonas BIGINT;
  v_auditorias BIGINT;
  v_protocolos BIGINT;
  v_calibraciones BIGINT;
  v_rls BOOLEAN;
BEGIN
  SELECT count(*) INTO v_destinos FROM destinos;
  SELECT count(*) INTO v_packages FROM context_packages;
  SELECT count(*) INTO v_escenarios FROM escenarios_definiciones;
  SELECT count(*) INTO v_runs FROM simulation_runs;
  SELECT count(*) INTO v_zonas FROM zonas_destino;
  SELECT count(*) INTO v_auditorias FROM ai_proposals_audit;
  SELECT count(*) INTO v_protocolos FROM protocolos_operativos;
  SELECT count(*) INTO v_calibraciones FROM calibraciones_predictivas;

  SELECT relrowsecurity INTO v_rls
  FROM pg_class
  WHERE relname = 'ai_proposals_audit' AND relnamespace = 'public'::regnamespace;

  RETURN jsonb_build_object(
    'destinos', v_destinos,
    'contextPackages', v_packages,
    'escenarios', v_escenarios,
    'simulationRuns', v_runs,
    'zonas', v_zonas,
    'aiAudits', v_auditorias,
    'protocolos', v_protocolos,
    'calibraciones', v_calibraciones,
    'rlsEnabled', COALESCE(v_rls, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_gemelotur_persistence_health() TO gemelotur_app;

COMMIT;
