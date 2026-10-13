-- =========================================================================
-- MIGRACIÓN 022: GOOGLE GEO SUITE GOBERNADO Y EVIDENCIAS DE ENRIQUECIMIENTO
-- Plataforma Inteligente de Destinos (PID / SEGITTUR)
--
-- Establece:
-- 1. Tabla google_geo_conectores con aislamiento RLS forzado.
-- 2. Tabla google_geo_prevalidaciones para dictámenes institucionales formales.
-- 3. Tabla google_geo_auditoria_consultas append-only para trazabilidad y evidencias.
-- 4. Triggers inmutables y funciones de verificación de prevalidación.
-- =========================================================================

CREATE TABLE IF NOT EXISTS google_geo_conectores (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
  destino_id VARCHAR(80) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
  estado VARCHAR(40) NOT NULL DEFAULT 'DESHABILITADO'
    CHECK (estado IN ('DESHABILITADO', 'EN_PREVALIDACION', 'APROBADO_PILOTO', 'ACTIVO_VERIFICADO', 'SIN_CREDENCIALES', 'REVOCADO')),
  proveedor_visual VARCHAR(40) NOT NULL DEFAULT 'PID_OPEN_DATA'
    CHECK (proveedor_visual IN ('PID_OPEN_DATA', 'GOOGLE_PHOTOREALISTIC_3D')),
  credenciales_configuradas BOOLEAN NOT NULL DEFAULT false,
  modulos_activos JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_google_geo_destino UNIQUE (tenant_id, destino_id)
);

CREATE TABLE IF NOT EXISTS google_geo_prevalidaciones (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
  destino_id VARCHAR(80) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
  entidad_autorizada VARCHAR(180) NOT NULL,
  zona_id VARCHAR(80) NOT NULL,
  zona_nombre VARCHAR(180) NOT NULL,
  proposito VARCHAR(80) NOT NULL
    CHECK (proposito IN ('VISUALIZACION_FOTORREALISTA', 'INSPECCION_PATRIMONIAL', 'ANALISIS_TERRITORIAL_WHAT_IF')),
  estado VARCHAR(40) NOT NULL DEFAULT 'APROBADO_PILOTO'
    CHECK (estado IN ('PENDIENTE', 'APROBADO_PILOTO', 'RECHAZADO', 'REVOCADO')),
  operador_id VARCHAR(80) NOT NULL,
  operador_nombre VARCHAR(180) NOT NULL,
  operador_rol VARCHAR(80) NOT NULL,
  terminos_aceptados JSONB NOT NULL,
  justificacion TEXT NOT NULL,
  fingerprint_sha256 CHAR(64) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days')
);

CREATE TABLE IF NOT EXISTS google_geo_auditoria_consultas (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(80) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
  destino_id VARCHAR(80) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
  modulo_id VARCHAR(80) NOT NULL,
  operador_id VARCHAR(80) NOT NULL,
  operador_nombre VARCHAR(180) NOT NULL,
  proposito VARCHAR(180) NOT NULL,
  estado VARCHAR(40) NOT NULL
    CHECK (estado IN ('AUTORIZADO', 'RECHAZADO_POLITICA', 'FALLBACK_PID_ABIERTO')),
  evidence_sha256 CHAR(64) NOT NULL,
  atribucion_mostrada TEXT NOT NULL,
  resumen_payload JSONB NOT NULL,
  solicitado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ACTIVACIÓN DE ROW LEVEL SECURITY (RLS)
-- =========================================================================

ALTER TABLE google_geo_conectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_geo_conectores FORCE ROW LEVEL SECURITY;

ALTER TABLE google_geo_prevalidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_geo_prevalidaciones FORCE ROW LEVEL SECURITY;

ALTER TABLE google_geo_auditoria_consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_geo_auditoria_consultas FORCE ROW LEVEL SECURITY;

-- Políticas RLS conectores
DROP POLICY IF EXISTS google_geo_conectores_tenant_isolation ON google_geo_conectores;
CREATE POLICY google_geo_conectores_tenant_isolation ON google_geo_conectores
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  );

-- Políticas RLS prevalidaciones
DROP POLICY IF EXISTS google_geo_prevalidaciones_tenant_isolation ON google_geo_prevalidaciones;
CREATE POLICY google_geo_prevalidaciones_tenant_isolation ON google_geo_prevalidaciones
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  );

-- Políticas RLS auditoría
DROP POLICY IF EXISTS google_geo_auditoria_tenant_isolation ON google_geo_auditoria_consultas;
CREATE POLICY google_geo_auditoria_tenant_isolation ON google_geo_auditoria_consultas
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
    AND destino_id = NULLIF(current_setting('app.destino_id', true), '')
  );

-- =========================================================================
-- TRIGGER INMUTABLE DE AUDITORÍA (APPEND-ONLY)
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_google_geo_auditoria_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'VIOLACION DE AUDITORIA: Los registros de google_geo_auditoria_consultas son inmutables (append-only).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_google_geo_auditoria_immutable ON google_geo_auditoria_consultas;
CREATE TRIGGER trg_google_geo_auditoria_immutable
  BEFORE UPDATE OR DELETE ON google_geo_auditoria_consultas
  FOR EACH ROW
  EXECUTE FUNCTION fn_google_geo_auditoria_immutable();

-- =========================================================================
-- REGISTROS INICIALES DEMOSTRADORES (ESTADO SEGURO: DESHABILITADO)
-- =========================================================================

INSERT INTO google_geo_conectores (id, tenant_id, destino_id, estado, proveedor_visual, credenciales_configuradas, modulos_activos)
VALUES
  ('gg_con_malaga_01', 'tenant_ayto_malaga', 'malaga', 'DESHABILITADO', 'PID_OPEN_DATA', false, '[]'::jsonb),
  ('gg_con_palma_01', 'tenant_ayto_palma', 'palma', 'DESHABILITADO', 'PID_OPEN_DATA', false, '[]'::jsonb)
ON CONFLICT (tenant_id, destino_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON google_geo_conectores TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE ON google_geo_prevalidaciones TO gemelotur_app;
GRANT SELECT, INSERT ON google_geo_auditoria_consultas TO gemelotur_app;
