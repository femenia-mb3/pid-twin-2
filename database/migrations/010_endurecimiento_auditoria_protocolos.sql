-- =============================================================================
-- MIGRACIÓN 010 — Endurecimiento Institucional de Auditoría y Ejecución de Protocolos
-- Inmutabilidad estricta de auditoría (APPEND-ONLY), revocación de UPDATE/DELETE
-- y tabla de activación y ejecución de protocolos operativos ante saturación.
-- =============================================================================

BEGIN;

-- 1. Revocar permisos destructivos sobre la tabla de auditoría al rol de aplicación
REVOKE UPDATE, DELETE, TRUNCATE ON ai_proposals_audit FROM gemelotur_app;

-- 2. Trigger de inmutabilidad estricta: impedir cualquier modificación o borrado
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'VIOLACION DE AUDITORIA: Los registros de auditoria IA son inmutables y no pueden modificarse ni eliminarse.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON ai_proposals_audit;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON ai_proposals_audit
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 3. Tabla de Ejecuciones de Protocolos Operativos ante Saturación
CREATE TABLE IF NOT EXISTS protocolos_ejecuciones (
  id TEXT PRIMARY KEY,
  protocolo_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  zona_id TEXT NOT NULL,
  afluencia_observada INTEGER NOT NULL,
  aforo_maximo INTEGER NOT NULL,
  saturacion_pct NUMERIC(5,2) NOT NULL,
  operador_id TEXT NOT NULL,
  operador_nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVADO' CHECK (estado IN ('ACTIVADO', 'EN_EJECUCION', 'COMPLETADO', 'CANCELADO')),
  pasos_completados JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT,
  activado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_en TIMESTAMPTZ,
  CONSTRAINT protocolos_ejecuciones_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT,
  CONSTRAINT protocolos_ejecuciones_protocolo_fk
    FOREIGN KEY (protocolo_id)
    REFERENCES protocolos_operativos (id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_protocolos_ejecuciones_scope
  ON protocolos_ejecuciones (tenant_id, destino_id, activado_en DESC);

ALTER TABLE protocolos_ejecuciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolos_ejecuciones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protocolos_ejecuciones_scope_policy ON protocolos_ejecuciones;
CREATE POLICY protocolos_ejecuciones_scope_policy ON protocolos_ejecuciones
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON protocolos_ejecuciones TO gemelotur_app;

-- 4. Modificar tabla de calibración para separar predicción y observación real con huella de modelo
ALTER TABLE calibraciones_predictivas 
  ADD COLUMN IF NOT EXISTS context_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS calidad_dato TEXT DEFAULT 'A_CERTIFICADA';

COMMIT;
