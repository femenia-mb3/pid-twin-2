-- =============================================================================
-- MIGRACIÓN 011 — Iteración 7: Auditoría Server-Side Append-Only y Tokens Institucionales
-- Garantiza que las propuestas de IA se persistan en el momento de generación en el servidor
-- y que las decisiones humanas se registren como eventos append-only inmutables.
-- =============================================================================

BEGIN;

-- 1. Tabla de Decisiones Humanas Append-Only (Event Sourcing de Auditoría)
CREATE TABLE IF NOT EXISTS ai_decisions_audit (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APLICADO_SIMULADOR', 'EXPORTADO_ESTUDIO', 'RECHAZADO', 'MODIFICADO_Y_EJECUTADO')),
  decision_rationale TEXT,
  linked_scenario_id TEXT,
  linked_run_id TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_decisions_proposal_fk
    FOREIGN KEY (proposal_id)
    REFERENCES ai_proposals_audit (id)
    ON DELETE RESTRICT,
  CONSTRAINT ai_decisions_scope_fk
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

-- Índices de auditoría rápida
CREATE INDEX IF NOT EXISTS idx_ai_decisions_proposal
  ON ai_decisions_audit (proposal_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_scope_date
  ON ai_decisions_audit (tenant_id, destino_id, decided_at DESC);

-- Habilitar y forzar Row Level Security en la tabla de decisiones
ALTER TABLE ai_decisions_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_decisions_audit_scope_policy ON ai_decisions_audit;
CREATE POLICY ai_decisions_audit_scope_policy ON ai_decisions_audit
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- Otorgar permisos al rol no-superusuario gemelotur_app (SOLO SELECT E INSERT, NUNCA UPDATE NI DELETE)
GRANT SELECT, INSERT ON ai_decisions_audit TO gemelotur_app;

-- Trigger de inmutabilidad estricta sobre decisiones humanas
CREATE OR REPLACE FUNCTION fn_prevent_decision_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'VIOLACION DE AUDITORIA: Las decisiones humanas de IA son inmutables y no pueden modificarse ni eliminarse.';
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_immutable ON ai_decisions_audit;
CREATE TRIGGER trg_decision_immutable
BEFORE UPDATE OR DELETE ON ai_decisions_audit
FOR EACH ROW EXECUTE FUNCTION fn_prevent_decision_tampering();

COMMIT;
