-- =============================================================================
-- MIGRACIÓN 020: AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ANTE COLAPSO
-- Iteración 16: PostGIS + RLS Bicomponente (tenant_id, destino_id) + Inmutabilidad
-- =============================================================================

BEGIN;

-- 1. Tabla de Configuración de Agentes de Respuesta por Destino
CREATE TABLE IF NOT EXISTS agentes_respuesta_configuracion (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('VIGILANCIA_PASIVA', 'ALERTA_PREVENTIVA', 'RESPUESTA_ACTIVA')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  saturation_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 85.00,
  early_warning_horizon_hours INTEGER NOT NULL DEFAULT 4,
  monitored_zone_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  autonomous_preapproved_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_unit TEXT NOT NULL CHECK (lead_unit IN ('POLICIA_LOCAL', 'MOVILIDAD_TRANSITO', 'PATRIMONIO_CULTURA', 'PROTECCION_CIVIL', 'PUERTO_CRUCEROS')),
  evidence_fingerprint_sha256 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_agente_config_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_agentes_respuesta_scope
  ON agentes_respuesta_configuracion (tenant_id, destino_id);

ALTER TABLE agentes_respuesta_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentes_respuesta_configuracion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_config_scope_policy ON agentes_respuesta_configuracion;
CREATE POLICY agent_config_scope_policy ON agentes_respuesta_configuracion
  USING (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON agentes_respuesta_configuracion TO gemelotur_app;

-- 2. Tabla de Incidentes de Colapso Detectados
CREATE TABLE IF NOT EXISTS incidentes_colapso_detectados (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agentes_respuesta_configuracion (id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('AMARILLA_ADVERTENCIA', 'NARANJA_CRITICA', 'ROJA_COLAPSO_INMINENTE')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_zone_id TEXT NOT NULL,
  source_zone_name TEXT NOT NULL,
  current_saturation_pct NUMERIC(5,2) NOT NULL,
  current_visitors INTEGER NOT NULL,
  predicted_peak_visitors INTEGER NOT NULL,
  predicted_horizon TEXT NOT NULL CHECK (predicted_horizon IN ('T_1H', 'T_4H', 'T_24H')),
  time_to_critical_alert_minutes INTEGER NOT NULL,
  trigger_cause TEXT NOT NULL,
  triggering_sensors JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT fk_incidente_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_incidentes_scope_detected
  ON incidentes_colapso_detectados (tenant_id, destino_id, detected_at DESC);

ALTER TABLE incidentes_colapso_detectados ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidentes_colapso_detectados FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_scope_policy ON incidentes_colapso_detectados;
CREATE POLICY incident_scope_policy ON incidentes_colapso_detectados
  USING (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON incidentes_colapso_detectados TO gemelotur_app;

-- 3. Tabla de Planes de Intervención Rápida
CREATE TABLE IF NOT EXISTS planes_intervencion_rapida (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidentes_colapso_detectados (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA_HUMANA' CHECK (status IN ('GENERADO', 'PRE_APROBADO_DIRECTIVA', 'PENDIENTE_FIRMA_HUMANA', 'AUTORIZADO_EJECUTADO', 'RECHAZADO_OPERADOR')),
  projected_relief_pct NUMERIC(5,2) NOT NULL,
  estimated_total_cost_euros NUMERIC(10,2) NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  governance_warning TEXT NOT NULL,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  synthetic_disclaimer TEXT NOT NULL,
  CONSTRAINT fk_plan_intervencion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_planes_intervencion_scope
  ON planes_intervencion_rapida (tenant_id, destino_id, created_at DESC);

ALTER TABLE planes_intervencion_rapida ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_intervencion_rapida FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intervention_plan_scope_policy ON planes_intervencion_rapida;
CREATE POLICY intervention_plan_scope_policy ON planes_intervencion_rapida
  USING (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON planes_intervencion_rapida TO gemelotur_app;

-- 4. Registro Inmutable de Decisiones Humanas sobre Planes de Intervención (Append-Only)
CREATE TABLE IF NOT EXISTS decisiones_intervencion_agente (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planes_intervencion_rapida (id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES incidentes_colapso_detectados (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('AUTORIZADO_EJECUTADO', 'RECHAZADO_OPERADOR')),
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  rationale TEXT NOT NULL,
  approved_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision_fingerprint_sha256 TEXT NOT NULL,
  CONSTRAINT fk_decision_intervencion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_intervencion_unica
  ON decisiones_intervencion_agente (plan_id);

ALTER TABLE decisiones_intervencion_agente ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisiones_intervencion_agente FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intervention_decision_scope_policy ON decisiones_intervencion_agente;
CREATE POLICY intervention_decision_scope_policy ON decisiones_intervencion_agente
  USING (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON decisiones_intervencion_agente TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON decisiones_intervencion_agente FROM gemelotur_app;

-- Trigger inmutable: no se permite alterar ni borrar una decisión humana
DROP TRIGGER IF EXISTS trg_decisiones_intervencion_immutable ON decisiones_intervencion_agente;
CREATE TRIGGER trg_decisiones_intervencion_immutable
BEFORE UPDATE OR DELETE ON decisiones_intervencion_agente
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- Trigger de transición gobernada: no se puede cambiar el plan a AUTORIZADO_EJECUTADO sin registro previo en decisiones_intervencion_agente
CREATE OR REPLACE FUNCTION fn_enforce_intervention_plan_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status AND OLD.status IN ('PENDIENTE_FIRMA_HUMANA', 'GENERADO', 'PRE_APROBADO_DIRECTIVA') THEN
    IF NEW.status = 'AUTORIZADO_EJECUTADO' THEN
      IF NOT EXISTS (
        SELECT 1 FROM decisiones_intervencion_agente
        WHERE plan_id = NEW.id AND decision = 'AUTORIZADO_EJECUTADO'
      ) THEN
        RAISE EXCEPTION 'VIOLACIÓN DE GOBERNANZA: No se puede autorizar el plan % sin registrar previamente la firma formal en decisiones_intervencion_agente.', NEW.id;
      END IF;
    END IF;
  END IF;

  -- Inmutabilidad tras resolución final
  IF OLD.status IN ('AUTORIZADO_EJECUTADO', 'RECHAZADO_OPERADOR') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'VIOLACIÓN DE AUDITORÍA: Un plan de intervención rápida ya resuelto (%) no puede cambiar de estado.', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_intervention_plan_transition ON planes_intervencion_rapida;
CREATE TRIGGER trg_enforce_intervention_plan_transition
BEFORE UPDATE ON planes_intervencion_rapida
FOR EACH ROW EXECUTE FUNCTION fn_enforce_intervention_plan_transition();

-- 5. Semilla inicial de agentes para Málaga y Palma
INSERT INTO agentes_respuesta_configuracion (
  id, tenant_id, destino_id, agent_name, mode, enabled,
  saturation_threshold_pct, early_warning_horizon_hours,
  monitored_zone_ids, autonomous_preapproved_actions, lead_unit,
  evidence_fingerprint_sha256, updated_at
) VALUES 
  (
    'agent_mlg_colapso_01',
    'tenant_ayto_malaga',
    'malaga',
    'Agente Centinela de Colapso Centro-Puerto Málaga',
    'RESPUESTA_ACTIVA',
    true,
    85.00,
    4,
    '["malaga_centro", "malaga_puerto", "malaga_playas_este"]'::jsonb,
    '["ACT_DIGITAL_PMV", "AVISO_APP_VISITANTES", "DESVIO_RECOMENDADO_MUELLE_UNO"]'::jsonb,
    'POLICIA_LOCAL',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    now()
  ),
  (
    'agent_plm_colapso_01',
    'tenant_ayto_palma',
    'palma',
    'Agente Centinela de Flujos y Cruceros Casco Histórico Palma',
    'ALERTA_PREVENTIVA',
    true,
    80.00,
    4,
    '["palma_centro_historico", "palma_puerto_estacion_maritima"]'::jsonb,
    '["ACT_DIGITAL_PMV", "AVISO_APP_VISITANTES"]'::jsonb,
    'PUERTO_CRUCEROS',
    'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  mode = EXCLUDED.mode,
  saturation_threshold_pct = EXCLUDED.saturation_threshold_pct,
  monitored_zone_ids = EXCLUDED.monitored_zone_ids,
  autonomous_preapproved_actions = EXCLUDED.autonomous_preapproved_actions;

COMMIT;
