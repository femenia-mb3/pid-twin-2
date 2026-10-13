-- =============================================================================
-- MIGRACIÓN 021: ENDURECIMIENTO DE GOBERNANZA Y SEGURIDAD AGENTES AUTÓNOMOS
-- Iteración 16: Cierre de Bypasses, FKs Compuestas y Fall-Closed en PostGIS
-- =============================================================================

BEGIN;

-- 1. Unicidad compuesta para FKs relacionales en incidentes y planes
ALTER TABLE incidentes_colapso_detectados 
  ADD CONSTRAINT uq_incidente_scope UNIQUE (id, tenant_id, destino_id);

ALTER TABLE planes_intervencion_rapida 
  ADD CONSTRAINT uq_plan_scope UNIQUE (id, tenant_id, destino_id);

-- 2. FK compuesta en planes para garantizar coincidencia de tenant y destino con el incidente
ALTER TABLE planes_intervencion_rapida
  DROP CONSTRAINT IF EXISTS fk_plan_incidente_compuesta,
  ADD CONSTRAINT fk_plan_incidente_compuesta
    FOREIGN KEY (incident_id, tenant_id, destino_id)
    REFERENCES incidentes_colapso_detectados (id, tenant_id, destino_id)
    ON DELETE CASCADE;

-- 3. FK compuesta en decisiones para garantizar coincidencia de tenant y destino
ALTER TABLE decisiones_intervencion_agente
  DROP CONSTRAINT IF EXISTS fk_decision_plan_compuesta,
  ADD CONSTRAINT fk_decision_plan_compuesta
    FOREIGN KEY (plan_id, tenant_id, destino_id)
    REFERENCES planes_intervencion_rapida (id, tenant_id, destino_id)
    ON DELETE CASCADE;

-- 4. Sustituir función de transición para cubrir BEFORE INSERT OR UPDATE
CREATE OR REPLACE FUNCTION fn_enforce_intervention_plan_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es inserción, solo se admiten estados iniciales
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('AUTORIZADO_EJECUTADO', 'RECHAZADO_OPERADOR') THEN
      RAISE EXCEPTION 'VIOLACIÓN DE GOBERNANZA: Un plan de intervención rápida no puede crearse directamente en estado final (%). Debe crearse como PENDIENTE_FIRMA_HUMANA o GENERADO.', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  -- Si es actualización
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status AND OLD.status IN ('PENDIENTE_FIRMA_HUMANA', 'GENERADO', 'PRE_APROBADO_DIRECTIVA') THEN
      IF NEW.status = 'AUTORIZADO_EJECUTADO' THEN
        IF NOT EXISTS (
          SELECT 1 FROM decisiones_intervencion_agente
          WHERE plan_id = NEW.id AND tenant_id = NEW.tenant_id AND destino_id = NEW.destino_id AND decision = 'AUTORIZADO_EJECUTADO'
        ) THEN
          RAISE EXCEPTION 'VIOLACIÓN DE GOBERNANZA: No se puede autorizar el plan % sin registrar previamente la firma formal en decisiones_intervencion_agente.', NEW.id;
        END IF;
      END IF;
    END IF;

    -- Inmutabilidad tras resolución final
    IF OLD.status IN ('AUTORIZADO_EJECUTADO', 'RECHAZADO_OPERADOR') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'VIOLACIÓN DE AUDITORÍA: Un plan de intervención rápida ya resuelto (%) no puede cambiar de estado.', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_intervention_plan_transition ON planes_intervencion_rapida;
CREATE TRIGGER trg_enforce_intervention_plan_transition
BEFORE INSERT OR UPDATE ON planes_intervencion_rapida
FOR EACH ROW EXECUTE FUNCTION fn_enforce_intervention_plan_transition();

COMMIT;
