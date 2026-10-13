-- =============================================================================
-- MIGRACIÓN 019: SUBSANACIÓN DE SEGURIDAD Y ENDURECIMIENTO DE FIRMA (ITERACIÓN 15)
-- Transición gobernada de estados en optimización y RLS estricta bicomponente
-- =============================================================================

BEGIN;

-- 1. Trigger que impide cambiar status en propuestas_optimizacion_flujos sin existir decisión firmada
CREATE OR REPLACE FUNCTION fn_enforce_optimization_proposal_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado pasa de PENDIENTE_FIRMA a APROBADA_OPERADOR o RECHAZADA_OPERADOR,
  -- debe existir una fila correspondiente en decisiones_optimizacion_flujos
  IF NEW.status <> OLD.status AND OLD.status = 'PENDIENTE_FIRMA' THEN
    IF NOT EXISTS (
      SELECT 1 FROM decisiones_optimizacion_flujos 
      WHERE proposal_id = NEW.id AND decision = NEW.status
    ) THEN
      RAISE EXCEPTION 'VIOLACIÓN DE GOBERNANZA: No se puede cambiar el estado de la propuesta a % sin registrar previamente la decisión firmada en decisiones_optimizacion_flujos.', NEW.status;
    END IF;
  END IF;

  -- Si ya fue resuelta, es inmutable (no puede volver a PENDIENTE_FIRMA ni modificarse)
  IF OLD.status IN ('APROBADA_OPERADOR', 'RECHAZADA_OPERADOR') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'VIOLACIÓN DE AUDITORÍA: Una propuesta de optimización ya resuelta (%) no puede cambiar de estado.', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_optimization_proposal_transition ON propuestas_optimizacion_flujos;
CREATE TRIGGER trg_enforce_optimization_proposal_transition
BEFORE UPDATE ON propuestas_optimizacion_flujos
FOR EACH ROW EXECUTE FUNCTION fn_enforce_optimization_proposal_transition();

-- 2. Endurecer RLS en simulaciones_impacto_macroeconomico para exigir tenant_id Y destino_id estrictos
DROP POLICY IF EXISTS macro_simulations_scope_policy ON simulaciones_impacto_macroeconomico;
CREATE POLICY macro_simulations_scope_policy ON simulaciones_impacto_macroeconomico
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- 3. Endurecer RLS en propuestas_optimizacion_flujos
DROP POLICY IF EXISTS flow_optimization_scope_policy ON propuestas_optimizacion_flujos;
CREATE POLICY flow_optimization_scope_policy ON propuestas_optimizacion_flujos
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- 4. Endurecer RLS en decisiones_optimizacion_flujos
DROP POLICY IF EXISTS flow_decision_scope_policy ON decisiones_optimizacion_flujos;
CREATE POLICY flow_decision_scope_policy ON decisiones_optimizacion_flujos
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- 5. Endurecer RLS en pruebas_estres_horizontes
DROP POLICY IF EXISTS stress_tests_scope_policy ON pruebas_estres_horizontes;
CREATE POLICY stress_tests_scope_policy ON pruebas_estres_horizontes
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

COMMIT;
