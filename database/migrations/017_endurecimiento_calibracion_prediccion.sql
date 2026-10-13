-- =============================================================================
-- MIGRACIÓN 017: ENDURECIMIENTO DE CALIBRACIÓN REAL Y PREDICCIÓN VALIDABLE
-- Subsanación de hallazgos de seguridad, RLS bicomponente (tenant+destino) e inmutabilidad
-- =============================================================================

BEGIN;

-- 1. Endurecer RLS en reglas_vinculo_calibracion con tenant_id Y destino_id
DROP POLICY IF EXISTS reglas_vinculo_scope_policy ON reglas_vinculo_calibracion;
CREATE POLICY reglas_vinculo_scope_policy ON reglas_vinculo_calibracion
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- 2. Tabla para propuestas de calibración generadas server-side (evita forjado de propuestas desde cliente)
CREATE TABLE IF NOT EXISTS propuestas_calibracion_servidor (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  destino_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_title TEXT NOT NULL,
  data_window_minutes INTEGER NOT NULL,
  total_signals_processed INTEGER NOT NULL,
  average_factor NUMERIC NOT NULL,
  proposals_by_zone JSONB NOT NULL,
  evidence_fingerprint_sha256 TEXT NOT NULL,
  governance_warning TEXT NOT NULL,
  generado_por TEXT NOT NULL,
  generado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA' CHECK (status IN ('PENDIENTE_FIRMA', 'APROBADA', 'RECHAZADA', 'EXPIRADA')),
  CONSTRAINT fk_propuesta_calibracion_scope
    FOREIGN KEY (tenant_id, destino_id)
    REFERENCES destino_perfiles_semanticos (tenant_id, destino_id)
    ON DELETE RESTRICT
);

ALTER TABLE propuestas_calibracion_servidor ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuestas_calibracion_servidor FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS propuestas_calibracion_scope_policy ON propuestas_calibracion_servidor;
CREATE POLICY propuestas_calibracion_scope_policy ON propuestas_calibracion_servidor
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

GRANT SELECT, INSERT, UPDATE ON propuestas_calibracion_servidor TO gemelotur_app;

-- 3. Endurecer RLS en versiones_calibracion_destino con tenant_id Y destino_id
DROP POLICY IF EXISTS versiones_calibracion_scope_policy ON versiones_calibracion_destino;
CREATE POLICY versiones_calibracion_scope_policy ON versiones_calibracion_destino
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- Índice único parcial: sólo puede existir UNA calibración ACTIVA_VIGENTE por tenant/destino/modelo
CREATE UNIQUE INDEX IF NOT EXISTS idx_calibracion_activa_unica
  ON versiones_calibracion_destino (tenant_id, destino_id, model_id)
  WHERE (status = 'ACTIVA_VIGENTE');

-- 4. Endurecer RLS en predicciones_horizontes_registro con tenant_id Y destino_id
DROP POLICY IF EXISTS predicciones_horizontes_policy ON predicciones_horizontes_registro;
CREATE POLICY predicciones_horizontes_policy ON predicciones_horizontes_registro
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- 5. Endurecer RLS en evaluaciones_prediccion_observacion y forzar UNIQUE(forecast_run_id)
DROP POLICY IF EXISTS evaluaciones_prediccion_policy ON evaluaciones_prediccion_observacion;
CREATE POLICY evaluaciones_prediccion_policy ON evaluaciones_prediccion_observacion
  USING (
    (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    OR current_setting('app.tenant_id', true) = 'tenant_segittur_global'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    AND destino_id = current_setting('app.destino_id', true)
  );

-- Evitar duplicados de evaluación por forecast run
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluacion_forecast_unica
  ON evaluaciones_prediccion_observacion (forecast_run_id);

COMMIT;
