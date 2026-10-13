-- ==============================================================================
-- MIGRACIÓN 003 — ONTOLOGÍA SEGITTUR Y MODELO MULTIDESTINO
-- Compatible con PostgreSQL 16 + PostGIS 3.4
-- Aplica después de database/schema_postgis.sql y datos de destinos.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Aislamiento lógico por entidad operadora/tenant.
CREATE TABLE IF NOT EXISTS tenants_gemelo (
    id VARCHAR(64) PRIMARY KEY,
    nombre_legal VARCHAR(180) NOT NULL,
    tipo_entidad VARCHAR(32) NOT NULL DEFAULT 'ADMINISTRACION_LOCAL',
    contacto_gobernanza VARCHAR(180),
    politica_datos VARCHAR(24) NOT NULL DEFAULT 'MIXTA'
        CHECK (politica_datos IN ('PUBLICA', 'MIXTA', 'RESTRINGIDA')),
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Perfil semántico por destino: no se mezcla configuración de municipios.
CREATE TABLE IF NOT EXISTS destino_perfiles_semanticos (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL UNIQUE REFERENCES destinos(id) ON DELETE CASCADE,
    namespace_ngsi_ld VARCHAR(180) NOT NULL UNIQUE,
    context_url TEXT NOT NULL,
    perfil_ontologico_iri TEXT NOT NULL,
    zona_horaria VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid',
    locale VARCHAR(16) NOT NULL DEFAULT 'es-ES',
    nivel_espacial_activo VARCHAR(32) NOT NULL DEFAULT 'NIVEL_1_2D_25D',
    niveles_espaciales JSONB NOT NULL DEFAULT '["NIVEL_1_2D_25D"]'::jsonb,
    dominios_habilitados JSONB NOT NULL DEFAULT '["turismo"]'::jsonb,
    politica_datos VARCHAR(24) NOT NULL DEFAULT 'MIXTA'
        CHECK (politica_datos IN ('PUBLICA', 'MIXTA', 'RESTRINGIDA')),
    fuente_evidencia TEXT NOT NULL,
    url_evidencia TEXT NOT NULL,
    revisado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_perfil_semantico_tenant_destino UNIQUE (tenant_id, destino_id)
);

-- 3. Registro de entidades normalizadas NGSI-LD.
-- payload conserva la entidad íntegra; geometry y observed_at se indexan para consultas operativas.
CREATE TABLE IF NOT EXISTS registro_entidades_contexto (
    entity_id TEXT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    entity_type VARCHAR(64) NOT NULL,
    context_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    geometry GEOMETRY(Geometry, 4326),
    observed_at TIMESTAMP WITH TIME ZONE,
    data_quality VARCHAR(32),
    traceability_id VARCHAR(128),
    source_entity_id TEXT,
    validado BOOLEAN NOT NULL DEFAULT FALSE,
    version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT registro_contexto_contexto_presente CHECK (payload ? '@context'),
    CONSTRAINT registro_contexto_tipo_consistente CHECK ((payload ->> 'type') = entity_type),
    CONSTRAINT registro_contexto_urn_ngsi CHECK (entity_id LIKE 'urn:ngsi-ld:%'),
    CONSTRAINT fk_registro_contexto_tenant_destino
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_registro_contexto_tenant_destino
    ON registro_entidades_contexto (tenant_id, destino_id, entity_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_registro_contexto_geometria
    ON registro_entidades_contexto USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_registro_contexto_payload
    ON registro_entidades_contexto USING GIN (payload jsonb_path_ops);

-- 4. Contratos de ingestión configurables por destino y fuente.
CREATE TABLE IF NOT EXISTS contratos_ingestion_semantica (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(180) NOT NULL,
    source_system VARCHAR(180) NOT NULL,
    formato_entrada VARCHAR(32) NOT NULL CHECK (formato_entrada IN ('NGSI_LD', 'GEOJSON', 'CSV', 'REST_JSON', 'MQTT')),
    entity_type_destino VARCHAR(64) NOT NULL,
    context_url TEXT NOT NULL,
    mapeo_atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
    politica_calidad VARCHAR(32) NOT NULL DEFAULT 'C_EN_VALIDACION',
    estado VARCHAR(24) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'VALIDADO', 'ACTIVO', 'SUSPENDIDO')),
    evidencia_url TEXT,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (destino_id, source_system, entity_type_destino),
    CONSTRAINT fk_contrato_ingestion_tenant_destino
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_contratos_ingestion_destino_estado
    ON contratos_ingestion_semantica (tenant_id, destino_id, estado);

-- 5. Perfiles de referencia ya presentes en el MVP: Málaga y Palma.
INSERT INTO tenants_gemelo (id, nombre_legal, tipo_entidad, politica_datos)
VALUES
    ('tenant_ayto_malaga', 'Ayuntamiento de Málaga', 'ADMINISTRACION_LOCAL', 'MIXTA'),
    ('tenant_ayto_palma', 'Ajuntament de Palma', 'ADMINISTRACION_LOCAL', 'MIXTA')
ON CONFLICT (id) DO UPDATE SET
    nombre_legal = EXCLUDED.nombre_legal,
    politica_datos = EXCLUDED.politica_datos,
    actualizado_en = CURRENT_TIMESTAMP;

INSERT INTO destino_perfiles_semanticos (
    id, tenant_id, destino_id, namespace_ngsi_ld, context_url, perfil_ontologico_iri,
    zona_horaria, locale, nivel_espacial_activo, niveles_espaciales, dominios_habilitados,
    politica_datos, fuente_evidencia, url_evidencia
) VALUES
(
    'profile_malaga_v1', 'tenant_ayto_malaga', 'malaga', 'urn:ngsi-ld:pid:malaga:',
    '/ontology/segittur-pid-context-v1.jsonld', 'urn:pid:gemelo:profile:segittur-multidestino:v1',
    'Europe/Madrid', 'es-ES', 'NIVEL_3_3D_TILES',
    '["NIVEL_1_2D_25D", "NIVEL_2_EDIFICIOS", "NIVEL_3_3D_TILES"]'::jsonb,
    '["turismo", "movilidad", "medio_ambiente", "infraestructuras", "eventos", "socioeconomica"]'::jsonb,
    'MIXTA',
    'Perfil operativo de demo configurado en el Gemelo Digital Turístico',
    '/api/semantic/profiles/profile_malaga_v1'
),
(
    'profile_palma_v1', 'tenant_ayto_palma', 'palma', 'urn:ngsi-ld:pid:palma:',
    '/ontology/segittur-pid-context-v1.jsonld', 'urn:pid:gemelo:profile:segittur-multidestino:v1',
    'Europe/Madrid', 'ca-ES', 'NIVEL_1_2D_25D',
    '["NIVEL_1_2D_25D", "NIVEL_2_EDIFICIOS"]'::jsonb,
    '["turismo", "movilidad", "medio_ambiente", "eventos"]'::jsonb,
    'MIXTA',
    'Perfil de segundo destino demostrador configurado en el Gemelo Digital Turístico',
    '/api/semantic/profiles/profile_palma_v1'
)
ON CONFLICT (destino_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    namespace_ngsi_ld = EXCLUDED.namespace_ngsi_ld,
    context_url = EXCLUDED.context_url,
    perfil_ontologico_iri = EXCLUDED.perfil_ontologico_iri,
    niveles_espaciales = EXCLUDED.niveles_espaciales,
    dominios_habilitados = EXCLUDED.dominios_habilitados,
    actualizado_en = CURRENT_TIMESTAMP;

-- 6. Vista de operación: catálogo de entidades filtrable por tenant y destino.
CREATE OR REPLACE VIEW vista_contexto_multidestino AS
SELECT
    e.tenant_id,
    t.nombre_legal AS tenant_nombre,
    e.destino_id,
    d.nombre AS destino_nombre,
    e.entity_id,
    e.entity_type,
    e.observed_at,
    e.data_quality,
    e.traceability_id,
    e.validado,
    e.geometry,
    e.payload
FROM registro_entidades_contexto e
JOIN tenants_gemelo t ON t.id = e.tenant_id
JOIN destinos d ON d.id = e.destino_id;

-- 7. Aislamiento de filas: la API debe ejecutar SET LOCAL app.tenant_id = '<tenant>'
-- y SET LOCAL app.destino_id = '<destino>' antes de cada transacción.
-- El rol de aplicación no debe ser propietario de estas tablas.
ALTER TABLE destino_perfiles_semanticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_entidades_contexto ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_ingestion_semantica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfil_destino_por_tenant ON destino_perfiles_semanticos;
CREATE POLICY perfil_destino_por_tenant ON destino_perfiles_semanticos
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );

DROP POLICY IF EXISTS registro_contexto_por_tenant ON registro_entidades_contexto;
CREATE POLICY registro_contexto_por_tenant ON registro_entidades_contexto
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );

DROP POLICY IF EXISTS contratos_ingestion_por_tenant ON contratos_ingestion_semantica;
CREATE POLICY contratos_ingestion_por_tenant ON contratos_ingestion_semantica
    USING (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)
        AND destino_id = current_setting('app.destino_id', true)
    );
