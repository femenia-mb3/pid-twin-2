-- =============================================================================
-- MIGRACIÓN 015 — Iteración 13: Ontologías PID S2 y Conectores IoT Semánticos
-- PostgreSQL 16 + PostGIS 3.4 con Row Level Security estricta y auditoría append-only
-- =============================================================================

BEGIN;

-- 1. Registro de Ontologías PID y vocabulario institucional aprobado
CREATE TABLE IF NOT EXISTS registros_ontologia_pid (
  id TEXT PRIMARY KEY,
  iri TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  titulo TEXT NOT NULL,
  provenance TEXT NOT NULL,
  creador TEXT NOT NULL,
  licencia TEXT NOT NULL,
  documentation_url TEXT NOT NULL,
  context_url TEXT NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  aprobado BOOLEAN NOT NULL DEFAULT true,
  revisado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON registros_ontologia_pid TO gemelotur_app;

-- 2. Conectores Semánticos S2
CREATE TABLE IF NOT EXISTS conectores_semanticos_s2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_version TEXT NOT NULL DEFAULT 'NGSI-LD-1.8',
  context_url TEXT NOT NULL,
  context_fingerprint_sha256 TEXT NOT NULL,
  ontology_iri TEXT NOT NULL,
  auth_reference TEXT,
  allowed_entity_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_query_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  activation_state TEXT NOT NULL DEFAULT 'BORRADOR'
    CHECK (activation_state IN ('BORRADOR', 'VALIDADO', 'ACTIVO', 'SUSPENDIDO')),
  evidencia JSONB NOT NULL,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_conector_s2_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_conectores_s2_scope
  ON conectores_semanticos_s2 (tenant_id, destino_id, activation_state);

ALTER TABLE conectores_semanticos_s2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE conectores_semanticos_s2 FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conectores_s2_scope_policy ON conectores_semanticos_s2;
CREATE POLICY conectores_s2_scope_policy ON conectores_semanticos_s2
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON conectores_semanticos_s2 TO gemelotur_app;

-- 3. Conectores Brokers IoT (MQTT / WSS)
CREATE TABLE IF NOT EXISTS conectores_iot_broker (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  protocolo TEXT NOT NULL DEFAULT 'MQTT_5' CHECK (protocolo IN ('MQTT_5', 'MQTTS_5', 'WSS_MQTT')),
  broker_host TEXT NOT NULL,
  broker_port INTEGER NOT NULL DEFAULT 8883,
  tls_enabled BOOLEAN NOT NULL DEFAULT true,
  topic_namespace TEXT NOT NULL,
  default_qos INTEGER NOT NULL DEFAULT 1 CHECK (default_qos IN (0, 1, 2)),
  auth_reference TEXT,
  max_message_size_bytes INTEGER NOT NULL DEFAULT 65536,
  max_rate_messages_per_minute INTEGER NOT NULL DEFAULT 1200,
  activation_state TEXT NOT NULL DEFAULT 'BORRADOR'
    CHECK (activation_state IN ('BORRADOR', 'VALIDADO', 'ACTIVO', 'SUSPENDIDO')),
  evidencia JSONB NOT NULL,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_conector_iot_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_conectores_iot_scope
  ON conectores_iot_broker (tenant_id, destino_id, activation_state);

ALTER TABLE conectores_iot_broker ENABLE ROW LEVEL SECURITY;
ALTER TABLE conectores_iot_broker FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conectores_iot_scope_policy ON conectores_iot_broker;
CREATE POLICY conectores_iot_scope_policy ON conectores_iot_broker
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON conectores_iot_broker TO gemelotur_app;

-- 4. Dispositivos IoT Registrados por Conector
CREATE TABLE IF NOT EXISTS dispositivos_iot_registrados (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT NOT NULL REFERENCES conectores_iot_broker (id) ON DELETE CASCADE,
  sensor_urn TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  measurement_concept TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  zone_id TEXT,
  zone_name TEXT,
  estado TEXT NOT NULL DEFAULT 'ALTA_REGISTRADA'
    CHECK (estado IN ('ALTA_REGISTRADA', 'EN_OBSERVACION', 'FUERA_DE_SERVICIO', 'EN_MANTENIMIENTO')),
  geometria GEOMETRY(Point, 4326) NOT NULL,
  evidencia JSONB NOT NULL,
  registrado_por TEXT NOT NULL,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_dispositivo_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_iot_scope
  ON dispositivos_iot_registrados (tenant_id, destino_id, conector_id);
CREATE INDEX IF NOT EXISTS idx_dispositivos_iot_geom
  ON dispositivos_iot_registrados USING GIST (geometria);

ALTER TABLE dispositivos_iot_registrados ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_iot_registrados FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispositivos_iot_scope_policy ON dispositivos_iot_registrados;
CREATE POLICY dispositivos_iot_scope_policy ON dispositivos_iot_registrados
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON dispositivos_iot_registrados TO gemelotur_app;

-- 5. Lotes de Ingestión Semántica e IoT
CREATE TABLE IF NOT EXISTS lotes_ingestion_semantica (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT NOT NULL,
  conector_tipo TEXT NOT NULL CHECK (conector_tipo IN ('PID_S2', 'IOT_MQTT')),
  iniciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_recibidos INTEGER NOT NULL DEFAULT 0,
  total_aceptados INTEGER NOT NULL DEFAULT 0,
  total_rechazados INTEGER NOT NULL DEFAULT 0,
  fingerprint_sha256 TEXT NOT NULL,
  evidencia JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lotes_ingestion_scope
  ON lotes_ingestion_semantica (tenant_id, destino_id, conector_id, iniciado_en DESC);

ALTER TABLE lotes_ingestion_semantica ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_ingestion_semantica FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lotes_ingestion_scope_policy ON lotes_ingestion_semantica;
CREATE POLICY lotes_ingestion_scope_policy ON lotes_ingestion_semantica
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON lotes_ingestion_semantica TO gemelotur_app;

-- 6. Observaciones Contextuales Normalizadas (Inmutables)
CREATE TABLE IF NOT EXISTS observaciones_contexto_iot (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('PID_S2', 'IOT_MQTT')),
  sensor_urn TEXT NOT NULL,
  batch_id TEXT REFERENCES lotes_ingestion_semantica (id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  measurement_concept TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  unit_code TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  geometria GEOMETRY(Point, 4326) NOT NULL,
  calidad TEXT NOT NULL DEFAULT 'B_ESTIMADA' CHECK (calidad IN ('A_CERTIFICADA', 'B_ESTIMADA', 'C_EN_VALIDACION')),
  validation_status TEXT NOT NULL DEFAULT 'VALIDADA'
    CHECK (validation_status IN ('VALIDADA', 'RECHAZADA_FUERA_DE_RANGO', 'RECHAZADA_TIMESTAMP_INVALIDO', 'RECHAZADA_SCHEMA', 'DUPLICADA')),
  raw_payload JSONB NOT NULL,
  normalized_ngsi_ld JSONB NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  eligible_for_simulation BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_observacion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_observaciones_scope_time
  ON observaciones_contexto_iot (tenant_id, destino_id, sensor_urn, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observaciones_geom
  ON observaciones_contexto_iot USING GIST (geometria);

ALTER TABLE observaciones_contexto_iot ENABLE ROW LEVEL SECURITY;
ALTER TABLE observaciones_contexto_iot FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS observaciones_scope_policy ON observaciones_contexto_iot;
CREATE POLICY observaciones_scope_policy ON observaciones_contexto_iot
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON observaciones_contexto_iot TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON observaciones_contexto_iot FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_observaciones_contexto_immutable ON observaciones_contexto_iot;
CREATE TRIGGER trg_observaciones_contexto_immutable
BEFORE UPDATE OR DELETE ON observaciones_contexto_iot
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 7. Cuarentena de Errores de Ingestión
CREATE TABLE IF NOT EXISTS errores_ingestion_semantica (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('PID_S2', 'IOT_MQTT')),
  reason_code TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  payload_fingerprint_sha256 TEXT NOT NULL,
  ocurrido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_errores_ingestion_scope
  ON errores_ingestion_semantica (tenant_id, destino_id, conector_id, ocurrido_en DESC);

ALTER TABLE errores_ingestion_semantica ENABLE ROW LEVEL SECURITY;
ALTER TABLE errores_ingestion_semantica FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS errores_ingestion_scope_policy ON errores_ingestion_semantica;
CREATE POLICY errores_ingestion_scope_policy ON errores_ingestion_semantica
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON errores_ingestion_semantica TO gemelotur_app;

-- 8. Decisiones Humanas de Activación / Suspensión de Fuentes (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS decisiones_activacion_fuentes_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT NOT NULL,
  connector_kind TEXT NOT NULL CHECK (connector_kind IN ('S2_SEMANTIC', 'IOT_MQTT')),
  accion TEXT NOT NULL CHECK (accion IN ('ACTIVAR', 'SUSPENDER', 'VALIDAR')),
  operador_id TEXT NOT NULL,
  operador_nombre TEXT NOT NULL,
  operador_rol TEXT NOT NULL,
  justificacion TEXT NOT NULL,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  decidido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisiones_activacion_fuentes
  ON decisiones_activacion_fuentes_audit (tenant_id, destino_id, conector_id);

ALTER TABLE decisiones_activacion_fuentes_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisiones_activacion_fuentes_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decisiones_activacion_fuentes_policy ON decisiones_activacion_fuentes_audit;
CREATE POLICY decisiones_activacion_fuentes_policy ON decisiones_activacion_fuentes_audit
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON decisiones_activacion_fuentes_audit TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON decisiones_activacion_fuentes_audit FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_decisiones_activacion_fuentes_immutable ON decisiones_activacion_fuentes_audit;
CREATE TRIGGER trg_decisiones_activacion_fuentes_immutable
BEFORE UPDATE OR DELETE ON decisiones_activacion_fuentes_audit
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- Semillas institucionales de la ontología pública de referencia
INSERT INTO registros_ontologia_pid (
  id, iri, version, titulo, provenance, creador, licencia, documentation_url, context_url, fingerprint_sha256, aprobado
) VALUES (
  'ont_segittur_core_v1',
  'https://ontologia.segittur.es/turismo/def/core#',
  '1.0.0',
  'Modelo Conceptual de Referencia para el Sector Turístico - SEGITTUR',
  'Ontology created by SEGITTUR, with contributions from OEG-UPM, Gnoss and Globaldit (Widoco/LODE 2025-08-25)',
  'SEGITTUR (Sociedad Mercantil Estatal para la Gestión de la Innovación y las Tecnologías Turísticas)',
  'CC-BY-4.0',
  'https://ontologia.segittur.es/turismo/def/core/',
  '/ontology/segittur-pid-context-v1.jsonld',
  '9f81a7d65b1239c0fa48f8a2ef0442436d4076383e4c41490212a439281a8c3d',
  true
)
ON CONFLICT (id) DO UPDATE SET
  version = EXCLUDED.version,
  titulo = EXCLUDED.titulo,
  provenance = EXCLUDED.provenance,
  actualizado_en = CURRENT_TIMESTAMP;

COMMIT;
