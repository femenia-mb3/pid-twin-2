-- ==============================================================================
-- MIGRACIÓN 004 — CAPA DE INTEROPERABILIDAD Y CATÁLOGO DE MODELOS REUTILIZABLES
-- Compatible con PostgreSQL 16 + PostGIS 3.4
-- Aplica después de 003_ontologia_multidestino.sql.
-- ============================================================================

-- 1. Fuentes y contratos por destino. Se conserva el origen heterogéneo y la
-- posibilidad de mapearlo más tarde a entidades semánticas.
CREATE TABLE IF NOT EXISTS fuentes_interoperabilidad_destino (
    id VARCHAR(96) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(180) NOT NULL,
    carril_datos VARCHAR(32) NOT NULL
        CHECK (carril_datos IN ('ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO')),
    clase_fuente VARCHAR(32) NOT NULL
        CHECK (clase_fuente IN ('PID', 'NACIONAL', 'MUNICIPAL', 'OPERADOR_LOCAL')),
    servicio_pid VARCHAR(8),
    tipo_conector VARCHAR(32) NOT NULL
        CHECK (tipo_conector IN ('PID_SERVICE', 'REST_API', 'CSV', 'GEOJSON', 'MQTT', 'OGC_API')),
    formato_entrada VARCHAR(32) NOT NULL
        CHECK (formato_entrada IN ('NGSI_LD', 'REST_JSON', 'CSV', 'GEOJSON', 'MQTT', 'OGC_API_FEATURES')),
    dominios_destino JSONB NOT NULL DEFAULT '[]'::jsonb,
    pasos_normalizacion JSONB NOT NULL DEFAULT '[]'::jsonb,
    frecuencia_actualizacion VARCHAR(64) NOT NULL,
    regla_calidad TEXT NOT NULL,
    estado VARCHAR(32) NOT NULL
        CHECK (estado IN ('CONTRATO_CONFIGURADO', 'PENDIENTE_AUTORIZACION', 'PILOTO_VALIDADO')),
    clasificacion_privacidad VARCHAR(32) NOT NULL
        CHECK (clasificacion_privacidad IN ('PUBLICO', 'INTERNO_AGREGADO', 'REQUIERE_EVALUACION')),
    finalidad TEXT NOT NULL,
    evidencia_url TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fuente_interop_tenant_destino
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_fuente_interop_tenant_destino_id UNIQUE (id, tenant_id, destino_id)
);

CREATE INDEX IF NOT EXISTS idx_fuente_interop_tenant_destino
    ON fuentes_interoperabilidad_destino (tenant_id, destino_id, carril_datos, estado);

-- 2. Catálogo común: una plantilla no contiene datos del municipio. Puede
-- evolucionar desde modelo propio a reutilizable al contar con variables y evidencia.
CREATE TABLE IF NOT EXISTS catalogo_modelos_reutilizables (
    id VARCHAR(96) NOT NULL,
    version VARCHAR(32) NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    dominio VARCHAR(96) NOT NULL,
    tipo_publicacion VARCHAR(32) NOT NULL
        CHECK (tipo_publicacion IN ('PRECONFIGURADO_PID', 'MODELO_PROPIO', 'REUTILIZABLE_PID')),
    estado VARCHAR(24) NOT NULL
        CHECK (estado IN ('BORRADOR', 'VALIDADO', 'PUBLICADO')),
    resumen TEXT NOT NULL,
    carriles_requeridos JSONB NOT NULL DEFAULT '[]'::jsonb,
    requisitos_fuente JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables_parametrizables JSONB NOT NULL DEFAULT '[]'::jsonb,
    reglas JSONB NOT NULL DEFAULT '[]'::jsonb,
    regla_privacidad TEXT NOT NULL,
    evidencia_url TEXT NOT NULL,
    publicado_por_tenant_id VARCHAR(64) REFERENCES tenants_gemelo(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, version)
);

-- 3. Una instancia enlaza modelo, destino, fuentes concretas y parámetros locales.
CREATE TABLE IF NOT EXISTS instancias_modelo_destino (
    id VARCHAR(160) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    modelo_id VARCHAR(96) NOT NULL,
    modelo_version VARCHAR(32) NOT NULL,
    estado VARCHAR(32) NOT NULL DEFAULT 'BORRADOR_VALIDADO'
        CHECK (estado IN ('BORRADOR_VALIDADO', 'ACTIVO', 'SUSPENDIDO', 'RETIRADO')),
    parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidencia_url TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_instancia_modelo_tenant_destino
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_instancia_modelo_catalogo
        FOREIGN KEY (modelo_id, modelo_version)
        REFERENCES catalogo_modelos_reutilizables(id, version)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_instancia_modelo_tenant_destino
    ON instancias_modelo_destino (tenant_id, destino_id, estado);

-- 4. Tabla puente: no se aceptan IDs de fuente sin integridad referencial ni
-- cruces accidentales de tenant/destino. Sustituye al vínculo JSONB opaco.
CREATE TABLE IF NOT EXISTS instancias_modelo_fuentes (
    instancia_id VARCHAR(160) NOT NULL REFERENCES instancias_modelo_destino(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    fuente_id VARCHAR(96) NOT NULL,
    vinculada_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instancia_id, fuente_id),
    CONSTRAINT fk_instancia_fuente_tenant_destino
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_instancia_fuente_mismo_destino
        FOREIGN KEY (fuente_id, tenant_id, destino_id)
        REFERENCES fuentes_interoperabilidad_destino(id, tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_instancia_fuente_tenant_destino
    ON instancias_modelo_fuentes (tenant_id, destino_id, fuente_id);

-- 5. Plantillas de referencia. No transportan datos de Málaga ni Palma.
INSERT INTO catalogo_modelos_reutilizables (
    id, version, titulo, dominio, tipo_publicacion, estado, resumen,
    carriles_requeridos, requisitos_fuente, variables_parametrizables, reglas,
    regla_privacidad, evidencia_url
) VALUES
    ('modelo_saturacion_turistica', '1.0.0', 'Saturación turística', 'Capacidad de carga', 'REUTILIZABLE_PID', 'VALIDADO', 'Presión por zonas y redistribución de flujos.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Zonas con capacidad", "afluencia o conteos", "recursos"]', '["umbralAlerta", "horizonte"]', '["capacidad", "afluencia", "alertas"]', 'Solo agregados y fuentes con trazabilidad.', '/api/models/reusable/modelo_saturacion_turistica'),
    ('modelo_playas', '1.0.0', 'Playas', 'Litoral', 'REUTILIZABLE_PID', 'VALIDADO', 'Ocupación, calidad ambiental y confort de playas.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Geometrías de playa", "aforo", "meteorología"]', '["capacidadObjetivo", "radioInfluencia"]', '["ocupación", "capacidad", "calidad"]', 'No incluir identificadores personales.', '/api/models/reusable/modelo_playas'),
    ('modelo_eventos', '1.0.0', 'Eventos', 'Eventos y espacio público', 'REUTILIZABLE_PID', 'VALIDADO', 'Concentración vinculada a agenda y restricciones.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Agenda", "zonas", "movilidad"]', '["ventanaEvento", "factorAsistencia"]', '["calendario", "aforo", "presión"]', 'Solo datos de agenda pública o autorizada.', '/api/models/reusable/modelo_eventos'),
    ('modelo_movilidad', '1.0.0', 'Movilidad', 'Flujos y accesibilidad', 'REUTILIZABLE_PID', 'VALIDADO', 'Rutas, accesos y dispersión peatonal.', '["NO_ONTOLOGICO_HISTORICO"]', '["Conteos", "red viaria", "POIs"]', '["velocidadPeatonal", "factorDesvio"]', '["rutas", "cuellos de botella"]', 'Agregación previa de señales de movilidad.', '/api/models/reusable/modelo_movilidad'),
    ('modelo_patrimonio', '1.0.0', 'Patrimonio', 'Activos patrimoniales', 'REUTILIZABLE_PID', 'VALIDADO', 'Capacidad, accesos y protección patrimonial.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Recursos", "zonas", "sensores"]', '["limiteVisitas", "sensibilidad"]', '["aforo", "microclima", "protección"]', 'Respetar restricciones de seguridad y difusión.', '/api/models/reusable/modelo_patrimonio'),
    ('modelo_puertos_cruceros', '1.0.0', 'Puertos y cruceros', 'Flujos portuarios', 'REUTILIZABLE_PID', 'VALIDADO', 'Escalas y desembarcos puerto-centro.', '["NO_ONTOLOGICO_HISTORICO"]', '["Escalas", "desembarcos", "rutas"]', '["tasaDesembarco", "tiempoDispersión"]', '["oleadas", "distribución"]', 'Usar datos operativos autorizados y agregados.', '/api/models/reusable/modelo_puertos_cruceros'),
    ('modelo_nieve', '1.0.0', 'Nieve', 'Destino de montaña', 'REUTILIZABLE_PID', 'VALIDADO', 'Capacidad de pistas y accesos.', '["NO_ONTOLOGICO_HISTORICO"]', '["Nieve", "aforo", "movilidad"]', '["cotaMinima", "capacidadRemontes"]', '["operación", "demanda"]', 'Sin datos identificativos de usuarios.', '/api/models/reusable/modelo_nieve'),
    ('modelo_espacios_naturales', '1.0.0', 'Espacios naturales', 'Naturaleza y senderos', 'REUTILIZABLE_PID', 'VALIDADO', 'Flujos y sensibilidad ambiental.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Zonas", "senderos", "conteos"]', '["capacidadSendero", "factorSensibilidad"]', '["carga", "protección"]', 'No publicar ubicaciones sensibles sin autorización.', '/api/models/reusable/modelo_espacios_naturales'),
    ('modelo_enoturismo', '1.0.0', 'Enoturismo', 'Turismo enológico', 'REUTILIZABLE_PID', 'VALIDADO', 'Bodegas, reservas y rutas.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Bodegas", "reservas", "eventos"]', '["plazasVisita", "duracionVisita"]', '["experiencias", "reservas"]', 'Respetar condiciones de compartición empresarial.', '/api/models/reusable/modelo_enoturismo'),
    ('modelo_cicloturismo', '1.0.0', 'Cicloturismo', 'Rutas activas', 'REUTILIZABLE_PID', 'VALIDADO', 'Rutas y seguridad ciclista.', '["ONTOLOGICO", "NO_ONTOLOGICO_HISTORICO"]', '["Red ciclista", "POIs", "meteorología"]', '["capacidadTramo", "pendienteMaxima"]', '["itinerarios", "seguridad"]', 'Aplicar agregación en señales de movilidad.', '/api/models/reusable/modelo_cicloturismo')
ON CONFLICT (id, version) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    resumen = EXCLUDED.resumen,
    requisitos_fuente = EXCLUDED.requisitos_fuente,
    variables_parametrizables = EXCLUDED.variables_parametrizables,
    actualizado_en = CURRENT_TIMESTAMP;

-- 6. Aislamiento de los contratos, instancias y vínculos locales.
ALTER TABLE fuentes_interoperabilidad_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias_modelo_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias_modelo_fuentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fuente_interop_por_tenant_destino ON fuentes_interoperabilidad_destino;
CREATE POLICY fuente_interop_por_tenant_destino ON fuentes_interoperabilidad_destino
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );

DROP POLICY IF EXISTS instancia_modelo_por_tenant_destino ON instancias_modelo_destino;
CREATE POLICY instancia_modelo_por_tenant_destino ON instancias_modelo_destino
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );

DROP POLICY IF EXISTS instancia_fuente_por_tenant_destino ON instancias_modelo_fuentes;
CREATE POLICY instancia_fuente_por_tenant_destino ON instancias_modelo_fuentes
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );
