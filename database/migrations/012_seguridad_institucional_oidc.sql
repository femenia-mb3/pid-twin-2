-- =============================================================================
-- MIGRACIÓN 012 — Iteración 8: Seguridad Institucional, OIDC y Auditoría Durable
-- PostgreSQL 16 + PostGIS 3.4 con Row Level Security
-- =============================================================================

BEGIN;

-- 1. Tabla de Operadores Institucionales OIDC / OAuth2
CREATE TABLE IF NOT EXISTS operadores_institucionales (
  id TEXT PRIMARY KEY,
  open_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants_gemelo (id) ON DELETE RESTRICT,
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN_SEGITTUR', 'GESTOR_TURISMO', 'SUPERVISOR_MOVILIDAD', 'ANALISTA_DESTINO')),
  destinos_autorizados JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_key_hash TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de búsqueda rápida para autenticación
CREATE INDEX IF NOT EXISTS idx_operadores_open_id ON operadores_institucionales (open_id);
CREATE INDEX IF NOT EXISTS idx_operadores_email ON operadores_institucionales (email);

-- Insertar cuentas institucionales de referencia vinculadas a dominios municipales y SEGITTUR
INSERT INTO operadores_institucionales (id, open_id, email, display_name, tenant_id, rol, destinos_autorizados, api_key_hash)
VALUES
  ('inst_op_malaga', 'oidc_malaga_carlos', 'carlos.dominguez@malaga.es', 'Carlos Domínguez (Gestor Turismo Málaga)', 'tenant_ayto_malaga', 'GESTOR_TURISMO', '["malaga"]'::jsonb, crypt('malaga_secure_token_2026', gen_salt('bf'))),
  ('inst_op_palma', 'oidc_palma_catalina', 'catalina.ribas@palma.es', 'Catalina Ribas (Movilidad Palma)', 'tenant_ayto_palma', 'SUPERVISOR_MOVILIDAD', '["palma"]'::jsonb, crypt('palma_secure_token_2026', gen_salt('bf'))),
  ('inst_op_segittur', 'oidc_segittur_admin', 'gemelo.digital@segittur.es', 'Dirección Técnica SEGITTUR (Supervisión PID)', 'tenant_ayto_malaga', 'ADMIN_SEGITTUR', '["malaga", "palma"]'::jsonb, crypt('segittur_master_key_2026', gen_salt('bf')))
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  destinos_autorizados = EXCLUDED.destinos_autorizados;

-- 2. Asegurar clave única compuesta en ai_proposals_audit para integridad referencial territorial
ALTER TABLE ai_proposals_audit 
  DROP CONSTRAINT IF EXISTS ai_proposals_audit_unique_scope;

ALTER TABLE ai_proposals_audit
  ADD CONSTRAINT ai_proposals_audit_unique_scope UNIQUE (id, tenant_id, destino_id);

-- 3. Habilitar y forzar Row Level Security en operadores institucionales
ALTER TABLE operadores_institucionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadores_institucionales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operadores_institucionales_policy ON operadores_institucionales;
CREATE POLICY operadores_institucionales_policy ON operadores_institucionales
  FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  );

-- Otorgar permisos al rol no-superusuario gemelotur_app
GRANT SELECT, INSERT, UPDATE ON operadores_institucionales TO gemelotur_app;

-- Revocar permisos destructivos explícitamente en tablas de auditoría
REVOKE DELETE, TRUNCATE ON ai_proposals_audit FROM gemelotur_app;
REVOKE UPDATE, DELETE, TRUNCATE ON ai_decisions_audit FROM gemelotur_app;

COMMIT;
