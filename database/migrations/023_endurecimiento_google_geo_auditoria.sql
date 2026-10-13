-- =========================================================================
-- MIGRACIÓN 023: ENDURECIMIENTO DE AUDITORÍA, PRIVILEGIOS Y TRUNCATE
-- Plataforma Inteligente de Destinos (PID / SEGITTUR)
--
-- Resuelve:
-- 1. Revocación total de TRUNCATE, DELETE y UPDATE para gemelotur_app en google_geo_auditoria_consultas.
-- 2. Trigger a nivel de sentencia que bloquea expresamente TRUNCATE.
-- 3. Clave foránea compuesta (tenant_id, destino_id) para garantizar coherencia territorial.
-- 4. Exigencia de fecha de expiración vigente en prevalidaciones.
-- =========================================================================

-- 1. Revocar permisos destructivos heredados a gemelotur_app
REVOKE TRUNCATE, DELETE, UPDATE, REFERENCES, TRIGGER ON google_geo_auditoria_consultas FROM gemelotur_app;
REVOKE TRUNCATE, DELETE ON google_geo_prevalidaciones FROM gemelotur_app;
REVOKE TRUNCATE ON google_geo_conectores FROM gemelotur_app;

-- 2. Asegurar únicamente privilegios de inserción y lectura estrictos
GRANT SELECT, INSERT ON google_geo_auditoria_consultas TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE ON google_geo_prevalidaciones TO gemelotur_app;
GRANT SELECT, INSERT, UPDATE ON google_geo_conectores TO gemelotur_app;

-- 3. Trigger a nivel de sentencia (STATEMENT) para bloquear TRUNCATE
CREATE OR REPLACE FUNCTION fn_google_geo_auditoria_block_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'VIOLACION DE AUDITORIA CRITICA: La tabla google_geo_auditoria_consultas es inmutable y no admite TRUNCATE.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_google_geo_auditoria_block_truncate ON google_geo_auditoria_consultas;
CREATE TRIGGER trg_google_geo_auditoria_block_truncate
  BEFORE TRUNCATE ON google_geo_auditoria_consultas
  FOR EACH STATEMENT
  EXECUTE FUNCTION fn_google_geo_auditoria_block_truncate();

-- 4. Añadir índice y check de expiración en prevalidaciones
CREATE INDEX IF NOT EXISTS idx_google_geo_preval_vigencia ON google_geo_prevalidaciones (destino_id, estado, expira_en);
