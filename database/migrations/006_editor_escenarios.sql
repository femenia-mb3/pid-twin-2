-- Iteración 2 — Editor de escenarios por destino
-- Requiere las migraciones 003_ontologia_multidestino.sql y 005_context_packages.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS escenarios_definiciones (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 3 AND 100),
  descripcion TEXT NOT NULL CHECK (char_length(descripcion) BETWEEN 8 AND 500),
  tipo TEXT NOT NULL CHECK (tipo IN ('CRUCERO_MASIVO', 'EVENTO_CULTURAL', 'EPISODIO_METEO', 'CORTE_ACCESO', 'PERSONALIZADO')),
  estado TEXT NOT NULL CHECK (estado IN ('BORRADOR', 'VALIDADO', 'EJECUTADO', 'ARCHIVADO')),
  version_actual INTEGER NOT NULL DEFAULT 1 CHECK (version_actual >= 1),
  creado_por TEXT NOT NULL CHECK (char_length(creado_por) BETWEEN 1 AND 120),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  validado_en TIMESTAMPTZ,
  ejecutado_en TIMESTAMPTZ,
  archivado_en TIMESTAMPTZ,
  ejecuciones_count INTEGER NOT NULL DEFAULT 0 CHECK (ejecuciones_count >= 0),
  CONSTRAINT uq_escenario_id_tenant_destino UNIQUE (id, tenant_id, destino_id),
  CONSTRAINT fk_escenario_tenant_destino
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS escenarios_versiones (
  escenario_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('BORRADOR', 'VALIDADO', 'EJECUTADO', 'ARCHIVADO')),
  entradas JSONB NOT NULL,
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (escenario_id, version),
  CONSTRAINT uq_escenario_version_tenant_destino UNIQUE (escenario_id, version, tenant_id, destino_id),
  CONSTRAINT fk_escenario_version_parent
    FOREIGN KEY (escenario_id, tenant_id, destino_id)
    REFERENCES escenarios_definiciones (id, tenant_id, destino_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_escenario_version_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_escenario_entradas_object CHECK (jsonb_typeof(entradas) = 'object')
);

CREATE TABLE IF NOT EXISTS escenarios_validaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escenario_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  valido BOOLEAN NOT NULL,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  advertencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  validado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_validacion_version
    FOREIGN KEY (escenario_id, version, tenant_id, destino_id)
    REFERENCES escenarios_versiones (escenario_id, version, tenant_id, destino_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_validacion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_validacion_arrays CHECK (jsonb_typeof(errores) = 'array' AND jsonb_typeof(advertencias) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_escenarios_destino_estado
  ON escenarios_definiciones (tenant_id, destino_id, estado, actualizado_en DESC);
CREATE INDEX IF NOT EXISTS idx_escenarios_versiones_scope
  ON escenarios_versiones (tenant_id, destino_id, escenario_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_escenarios_validaciones_scope
  ON escenarios_validaciones (tenant_id, destino_id, validado_en DESC);

ALTER TABLE escenarios_definiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenarios_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenarios_validaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenarios_definiciones FORCE ROW LEVEL SECURITY;
ALTER TABLE escenarios_versiones FORCE ROW LEVEL SECURITY;
ALTER TABLE escenarios_validaciones FORCE ROW LEVEL SECURITY;

CREATE POLICY escenarios_definiciones_scope_policy ON escenarios_definiciones
  USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

CREATE POLICY escenarios_versiones_scope_policy ON escenarios_versiones
  USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

CREATE POLICY escenarios_validaciones_scope_policy ON escenarios_validaciones
  USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

COMMIT;
