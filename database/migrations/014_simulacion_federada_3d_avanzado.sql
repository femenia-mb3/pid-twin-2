-- =============================================================================
-- MIGRACIÓN 014 — Iteración 12: Simulación Multidestino Federada y Catálogo 3D/4D
-- PostgreSQL 16 + PostGIS 3.4 con Row Level Security estricta
-- =============================================================================

BEGIN;

-- 1. Configuraciones de Modelos Federados
CREATE TABLE IF NOT EXISTS configuraciones_federadas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  coordinador_destino_id TEXT NOT NULL,
  coordinador_destino_nombre TEXT NOT NULL,
  modelo_paquete_id TEXT NOT NULL,
  modelo_paquete_version TEXT NOT NULL,
  modelo_titulo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  horizonte_temporal_horas INTEGER NOT NULL DEFAULT 4,
  politica_comparticion TEXT NOT NULL DEFAULT 'SOLO_INDICADORES_AGREGADOS' CHECK (politica_comparticion IN ('SOLO_INDICADORES_AGREGADOS', 'INDICADORES_Y_EVIDENCIA_AUTORIZADA')),
  participantes JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_conf_fed_tenant_destino
    FOREIGN KEY (tenant_id, coordinador_destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_configuraciones_federadas_scope 
  ON configuraciones_federadas (tenant_id, coordinador_destino_id);

ALTER TABLE configuraciones_federadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuraciones_federadas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuraciones_federadas_scope_policy ON configuraciones_federadas;
CREATE POLICY configuraciones_federadas_scope_policy ON configuraciones_federadas
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.destino_id', true) = ANY(
      ARRAY(SELECT jsonb_array_elements(participantes)->>'destinationId')
    )
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND coordinador_destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON configuraciones_federadas TO gemelotur_app;

-- 2. Ejecuciones Federadas Agregadas
CREATE TABLE IF NOT EXISTS ejecuciones_federadas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  configuracion_federada_id TEXT NOT NULL REFERENCES configuraciones_federadas (id) ON DELETE CASCADE,
  coordinador_destino_id TEXT NOT NULL,
  modelo_paquete_id TEXT NOT NULL,
  modelo_paquete_version TEXT NOT NULL,
  modelo_titulo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'COMPLETADO' CHECK (estado IN ('COMPLETADO', 'RECHAZADO_BLOQUEO', 'FALLIDO')),
  motivo_rechazo TEXT,
  resultados_locales JSONB NOT NULL,
  metricas_agregadas JSONB NOT NULL,
  evidencia JSONB NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  ejecutado_por TEXT NOT NULL,
  ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ejecuciones_federadas_scope 
  ON ejecuciones_federadas (tenant_id, coordinador_destino_id, ejecutado_en DESC);

ALTER TABLE ejecuciones_federadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejecuciones_federadas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ejecuciones_federadas_scope_policy ON ejecuciones_federadas;
CREATE POLICY ejecuciones_federadas_scope_policy ON ejecuciones_federadas
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR coordinador_destino_id = current_setting('app.destino_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON ejecuciones_federadas TO gemelotur_app;

-- 3. Decisiones Humanas sobre Resultados Federados (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS decisiones_federadas_audit (
  id TEXT PRIMARY KEY,
  federated_run_id TEXT NOT NULL REFERENCES ejecuciones_federadas (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  operador_id TEXT NOT NULL,
  operador_nombre TEXT NOT NULL,
  operador_rol TEXT NOT NULL,
  accion TEXT NOT NULL CHECK (accion IN ('APROBAR_COMPARTICION', 'ARCHIVAR_LOCAL', 'DIFUNDIR_PID')),
  justificacion TEXT NOT NULL,
  decidido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisiones_federadas_audit 
  ON decisiones_federadas_audit (tenant_id, destino_id, federated_run_id);

ALTER TABLE decisiones_federadas_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisiones_federadas_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decisiones_federadas_policy ON decisiones_federadas_audit;
CREATE POLICY decisiones_federadas_policy ON decisiones_federadas_audit
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT ON decisiones_federadas_audit TO gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON decisiones_federadas_audit FROM gemelotur_app;

DROP TRIGGER IF EXISTS trg_decisiones_federadas_immutable ON decisiones_federadas_audit;
CREATE TRIGGER trg_decisiones_federadas_immutable
BEFORE UPDATE OR DELETE ON decisiones_federadas_audit
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 4. Catálogo de Activos 3D y 4D Territoriales
CREATE TABLE IF NOT EXISTS activos_3d_catalogo (
  id TEXT PRIMARY KEY,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  nivel INTEGER NOT NULL CHECK (nivel BETWEEN 1 AND 4),
  formato TEXT NOT NULL CHECK (formato IN ('OGC_3D_TILES', 'GLTF_GLB', 'OGC_WMS', 'OGC_WMTS', 'TMS', 'GEOJSON_INSPIRE', 'TRAFFIC_LINESTRING')),
  endpoint_url TEXT NOT NULL,
  layer_or_file_id TEXT,
  crs TEXT NOT NULL DEFAULT 'EPSG:4326',
  publisher TEXT NOT NULL,
  licencia TEXT NOT NULL,
  licencia_url TEXT NOT NULL,
  resolucion_densidad TEXT NOT NULL,
  bounding_extent JSONB NOT NULL,
  offline_fallback BOOLEAN NOT NULL DEFAULT true,
  fingerprint_sha256 TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVO_VERIFICADO' CHECK (estado IN ('ACTIVO_VERIFICADO', 'FALLBACK_DISPONIBLE', 'DEGRADADO_COMPATIBLE')),
  descripcion TEXT NOT NULL,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activos_3d_destino ON activos_3d_catalogo (destino_id, nivel);

GRANT SELECT, INSERT, UPDATE, DELETE ON activos_3d_catalogo TO gemelotur_app;

COMMIT;
