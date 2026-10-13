-- =============================================================================
-- MIGRACIÓN 007 — SimulationRun v1: base, escenario, delta y capas derivadas
-- Requiere 003_ontologia_multidestino.sql, 005_context_packages.sql y
-- 006_editor_escenarios.sql. PostgreSQL 16 + PostGIS 3.4.
-- Cada transacción de aplicación debe fijar SET LOCAL app.tenant_id y
-- SET LOCAL app.destino_id antes de leer o escribir.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  scenario_definition_id TEXT,
  scenario_version INTEGER,
  actor TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (state IN ('COMPLETED', 'FAILED', 'CANCELLED')),
  seed TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  context_package_id VARCHAR(96),
  context_fingerprint TEXT NOT NULL,
  context_version TEXT NOT NULL,
  runtime_origin TEXT NOT NULL CHECK (runtime_origin IN ('DEMO_CATALOG', 'CONTEXT_PACKAGE_V1')),
  quality JSONB NOT NULL,
  scenario_snapshot JSONB NOT NULL,
  parameters_snapshot JSONB NOT NULL,
  comparison JSONB NOT NULL,
  uncertainty JSONB NOT NULL,
  evidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT simulation_runs_identity_scope_unique UNIQUE (id, tenant_id, destino_id),
  CONSTRAINT simulation_runs_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT simulation_runs_scenario_fk
    FOREIGN KEY (scenario_definition_id, tenant_id, destino_id)
    REFERENCES escenarios_definiciones (id, tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT simulation_runs_scenario_version_fk
    FOREIGN KEY (scenario_definition_id, scenario_version, tenant_id, destino_id)
    REFERENCES escenarios_versiones (escenario_id, version, tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT simulation_runs_context_package_fk
    FOREIGN KEY (context_package_id, tenant_id, destino_id)
    REFERENCES context_packages (id, tenant_id, destino_id)
    ON DELETE SET NULL,
  CONSTRAINT simulation_runs_snapshots_object CHECK (
    jsonb_typeof(quality) = 'object'
    AND jsonb_typeof(scenario_snapshot) = 'object'
    AND jsonb_typeof(parameters_snapshot) = 'object'
    AND jsonb_typeof(comparison) = 'object'
    AND jsonb_typeof(uncertainty) = 'object'
    AND jsonb_typeof(evidence) = 'object'
    AND comparison ?& ARRAY['base', 'scenario', 'delta']
    AND evidence ?& ARRAY['contextFingerprint', 'origin', 'persistence']
    AND uncertainty ? 'type'
    AND quality ?& ARRAY['level', 'sourceCount', 'cutOffDate']
    AND scenario_snapshot ?& ARRAY['id', 'nombre', 'tipo', 'factorAfluencia']
    AND parameters_snapshot ?& ARRAY[
      'umbralSaturacionAlerta', 'pesoCapacidadFisica', 'pesoCapacidadPsicologica',
      'tasaEmisionKgCo2PorPersonaHora', 'incrementoVisitantesManualPct',
      'franjaHoraria', 'condicionClima', 'horaSimulacion', 'intensidadEscenario',
      'factorCapacidadOperativa', 'factorMovilidad'
    ]
    AND jsonb_typeof(comparison -> 'base') = 'object'
    AND jsonb_typeof(comparison -> 'scenario') = 'object'
    AND jsonb_typeof(comparison -> 'delta') = 'object'
    AND jsonb_typeof(evidence -> 'sources') = 'array'
    AND evidence ->> 'contextFingerprint' = context_fingerprint
    AND evidence ->> 'origin' = runtime_origin
    AND context_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT simulation_runs_version_with_definition CHECK (
    (scenario_definition_id IS NULL AND scenario_version IS NULL)
    OR (scenario_definition_id IS NOT NULL AND scenario_version IS NOT NULL AND scenario_version >= 1)
  )
);

CREATE TABLE IF NOT EXISTS simulation_run_layers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  layer_name TEXT NOT NULL CHECK (layer_name IN ('zones', 'resources', 'sensors')),
  result_kind TEXT NOT NULL DEFAULT 'SIMULATION_DERIVED' CHECK (result_kind = 'SIMULATION_DERIVED'),
  feature_collection JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT simulation_run_layers_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT simulation_run_layers_parent_scope_fk
    FOREIGN KEY (run_id, tenant_id, destino_id)
    REFERENCES simulation_runs (id, tenant_id, destino_id)
    ON DELETE CASCADE,
  CONSTRAINT simulation_run_layers_unique_name UNIQUE (run_id, layer_name),
  CONSTRAINT simulation_run_layers_feature_collection CHECK (
    jsonb_typeof(feature_collection) = 'object'
    AND feature_collection ->> 'type' = 'FeatureCollection'
    AND feature_collection ->> 'resultKind' = 'SIMULATION_DERIVED'
    AND feature_collection ->> 'layer' = layer_name
    AND jsonb_typeof(feature_collection -> 'features') = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_scope_created
  ON simulation_runs (tenant_id, destino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_fingerprint
  ON simulation_runs (tenant_id, destino_id, context_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_scenario
  ON simulation_runs (tenant_id, destino_id, scenario_definition_id, scenario_version);
CREATE INDEX IF NOT EXISTS idx_simulation_run_layers_scope
  ON simulation_run_layers (tenant_id, destino_id, run_id, layer_name);
CREATE INDEX IF NOT EXISTS idx_simulation_run_layers_document
  ON simulation_run_layers USING GIN (feature_collection jsonb_path_ops);

ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_run_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE simulation_run_layers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simulation_runs_scope_policy ON simulation_runs;
CREATE POLICY simulation_runs_scope_policy ON simulation_runs
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

DROP POLICY IF EXISTS simulation_run_layers_scope_policy ON simulation_run_layers;
CREATE POLICY simulation_run_layers_scope_policy ON simulation_run_layers
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

COMMIT;
