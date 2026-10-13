-- =============================================================================
-- MIGRACIÓN 013 — Iteración 11: Configuración Operativa de Conectores, Datasets y Paquetes de Modelos
-- PostgreSQL 16 + PostGIS 3.4 con Row Level Security estricta
-- =============================================================================

BEGIN;

-- 1. Conectores Operativos por Destino
CREATE TABLE IF NOT EXISTS conectores_operativos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PID_SERVICE_S2', 'PID_SERVICE_C4', 'REST_API', 'MQTT', 'OGC_API', 'CSV', 'GEOJSON', 'JSON', 'SHP_ZIP')),
  carril TEXT NOT NULL CHECK (carril IN ('ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO')),
  estado TEXT NOT NULL DEFAULT 'PENDIENTE_CREDENCIALES' CHECK (estado IN ('ACTIVO_VERIFICADO', 'PENDIENTE_CREDENCIALES', 'PLANTILLA_DISPONIBLE')),
  version INTEGER NOT NULL DEFAULT 1,
  endpoint_url TEXT,
  file_path TEXT,
  secret_reference TEXT, -- NUNCA la clave/token real: solo puntero opaco
  frecuencia_actualizacion TEXT NOT NULL,
  modulos_pid_relacionados JSONB NOT NULL DEFAULT '[]'::jsonb,
  mapeo_campos JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidencia JSONB NOT NULL,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_conector_tenant_destino
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_conectores_scope ON conectores_operativos (tenant_id, destino_id, estado);

ALTER TABLE conectores_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conectores_operativos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conectores_scope_policy ON conectores_operativos;
CREATE POLICY conectores_scope_policy ON conectores_operativos
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON conectores_operativos TO gemelotur_app;

-- 2. Datasets Ingestados por Destino
CREATE TABLE IF NOT EXISTS datasets_ingestados (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  conector_id TEXT REFERENCES conectores_operativos (id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('CSV', 'GEOJSON', 'JSON', 'SHP_ZIP')),
  carril TEXT NOT NULL CHECK (carril IN ('ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO')),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  total_records INTEGER NOT NULL,
  valid_records INTEGER NOT NULL,
  invalid_records INTEGER NOT NULL,
  detected_crs TEXT NOT NULL DEFAULT 'EPSG:4326',
  geometry_type TEXT,
  fingerprint_sha256 TEXT NOT NULL,
  sample_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_report JSONB NOT NULL,
  evidencia JSONB NOT NULL,
  estado TEXT NOT NULL DEFAULT 'INGESTADO_PENDIENTE_VINCULO' CHECK (estado IN ('INGESTADO_PENDIENTE_VINCULO', 'VINCULADO_VALIDADO', 'RECHAZADO')),
  subido_por TEXT NOT NULL,
  subido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_dataset_tenant_destino
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_datasets_scope ON datasets_ingestados (tenant_id, destino_id, subido_en DESC);

ALTER TABLE datasets_ingestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets_ingestados FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS datasets_scope_policy ON datasets_ingestados;
CREATE POLICY datasets_scope_policy ON datasets_ingestados
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON datasets_ingestados TO gemelotur_app;

-- 3. Paquetes de Modelos de Simulación (SimulationModelPackage v1)
CREATE TABLE IF NOT EXISTS paquetes_modelos_simulacion (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_creador_id TEXT NOT NULL,
  destino_creador_nombre TEXT NOT NULL,
  nombre TEXT NOT NULL,
  version TEXT NOT NULL,
  dominio TEXT NOT NULL,
  resumen TEXT NOT NULL,
  estado_ciclo TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado_ciclo IN ('BORRADOR', 'VALIDADO', 'PUBLICADO_REUTILIZABLE', 'ARCHIVADO')),
  carriles_requeridos JSONB NOT NULL,
  modulos_pid_requeridos JSONB NOT NULL,
  variables JSONB NOT NULL,
  requisitos_fuentes JSONB NOT NULL,
  reglas_declarativas JSONB NOT NULL,
  indicadores_salida JSONB NOT NULL,
  politica_privacidad JSONB NOT NULL,
  evidencia JSONB NOT NULL,
  package_document JSONB NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paquetes_modelos_id_version UNIQUE (id, version)
);

CREATE INDEX IF NOT EXISTS idx_paquetes_modelos_scope ON paquetes_modelos_simulacion (tenant_id, destino_creador_id, estado_ciclo);

ALTER TABLE paquetes_modelos_simulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes_modelos_simulacion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paquetes_modelos_policy ON paquetes_modelos_simulacion;
CREATE POLICY paquetes_modelos_policy ON paquetes_modelos_simulacion
  USING (
    estado_ciclo = 'PUBLICADO_REUTILIZABLE'
    OR (tenant_id = current_setting('app.tenant_id', true) AND destino_creador_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_creador_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON paquetes_modelos_simulacion TO gemelotur_app;

-- 4. Vínculos Explícitos: Dato/Conector -> Variable -> Modelo
CREATE TABLE IF NOT EXISTS vinculos_datos_modelos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_title TEXT NOT NULL,
  model_variable_id TEXT NOT NULL,
  model_variable_label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  conector_id TEXT NOT NULL REFERENCES conectores_operativos (id) ON DELETE CASCADE,
  dataset_id TEXT REFERENCES datasets_ingestados (id) ON DELETE SET NULL,
  source_field TEXT NOT NULL,
  transformation TEXT NOT NULL DEFAULT 'DIRECT' CHECK (transformation IN ('DIRECT', 'MULTIPLY', 'DIVIDE', 'AVERAGE', 'PEAK', 'PERCENTAGE')),
  transformation_arg NUMERIC,
  unidad TEXT,
  frecuencia TEXT NOT NULL,
  calidad_nivel TEXT NOT NULL,
  disponibilidad TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (disponibilidad IN ('DISPONIBLE', 'PENDIENTE_AUTORIZACION', 'INCOMPATIBLE')),
  activo BOOLEAN NOT NULL DEFAULT true,
  configurado_por TEXT NOT NULL,
  configurado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas TEXT,
  CONSTRAINT vinculo_destino_variable_unico UNIQUE (destino_id, model_id, model_variable_id)
);

CREATE INDEX IF NOT EXISTS idx_vinculos_scope ON vinculos_datos_modelos (tenant_id, destino_id, model_id);

ALTER TABLE vinculos_datos_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_datos_modelos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vinculos_scope_policy ON vinculos_datos_modelos;
CREATE POLICY vinculos_scope_policy ON vinculos_datos_modelos
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON vinculos_datos_modelos TO gemelotur_app;

-- 5. Decisiones Humanas de Validación y Publicación de Modelos (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS decisiones_modelos_audit (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  operador_id TEXT NOT NULL,
  operador_nombre TEXT NOT NULL,
  operador_rol TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APROBAR_VALIDADO', 'PUBLICAR_REUTILIZABLE', 'RECHAZAR', 'ARCHIVAR')),
  justificacion TEXT NOT NULL,
  decidido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisiones_modelos_audit ON decisiones_modelos_audit (tenant_id, destino_id, package_id);

ALTER TABLE decisiones_modelos_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisiones_modelos_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decisiones_modelos_policy ON decisiones_modelos_audit;
CREATE POLICY decisiones_modelos_policy ON decisiones_modelos_audit
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- Inmutabilidad estricta: solo INSERT y SELECT
GRANT SELECT, INSERT ON decisiones_modelos_audit TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON decisiones_modelos_audit FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_decisiones_modelos_immutable ON decisiones_modelos_audit;
CREATE TRIGGER trg_decisiones_modelos_immutable
BEFORE UPDATE OR DELETE ON decisiones_modelos_audit
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

COMMIT;
