-- ==============================================================================
-- MIGRACIÓN 005 — CONTEXTPACKAGE v1 Y ALTA MULTIDESTINO
-- Compatible con PostgreSQL 16 + PostGIS 3.4.
-- Requiere 003_ontologia_multidestino.sql.
-- La importación productiva debe ejecutarse de forma transaccional:
-- tenant -> destinos -> destino_perfiles_semanticos -> context_packages -> entidades.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS context_packages (
    id VARCHAR(96) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
    schema_version VARCHAR(16) NOT NULL CHECK (schema_version = '1.0.0'),
    titulo VARCHAR(180) NOT NULL,
    finalidad TEXT NOT NULL,
    estado VARCHAR(24) NOT NULL DEFAULT 'BORRADOR'
        CHECK (estado IN ('BORRADOR', 'VALIDADO', 'IMPORTADO', 'RECHAZADO', 'SUSPENDIDO')),
    crs VARCHAR(32) NOT NULL CHECK (crs = 'EPSG:4326'),
    timezone VARCHAR(64) NOT NULL,
    locale VARCHAR(16) NOT NULL,
    semantic_context_url TEXT NOT NULL,
    semantic_profile_iri TEXT NOT NULL,
    namespace_ngsi_ld TEXT NOT NULL,
    package_document JSONB NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    importado_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT context_package_document_type CHECK ((package_document ->> 'type') = 'ContextPackage'),
    CONSTRAINT context_package_tenant_destino_unique UNIQUE (tenant_id, destino_id, schema_version),
    CONSTRAINT context_package_namespace_unique UNIQUE (namespace_ngsi_ld),
    CONSTRAINT context_package_identity_tenant_destino_unique UNIQUE (id, tenant_id, destino_id),
    CONSTRAINT context_package_tenant_destino_profile_fk
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS context_package_validaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    context_package_id VARCHAR(96) NOT NULL REFERENCES context_packages(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
    valido BOOLEAN NOT NULL,
    errores JSONB NOT NULL DEFAULT '[]'::jsonb,
    advertencias JSONB NOT NULL DEFAULT '[]'::jsonb,
    resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
    validador_version VARCHAR(32) NOT NULL DEFAULT 'context-package-validator-v1',
    validado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT context_package_validacion_parent_fk
        FOREIGN KEY (context_package_id, tenant_id, destino_id)
        REFERENCES context_packages(id, tenant_id, destino_id)
        ON DELETE CASCADE,
    CONSTRAINT context_package_validacion_tenant_destino_fk
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS context_package_fuentes (
    id VARCHAR(96) NOT NULL,
    context_package_id VARCHAR(96) NOT NULL REFERENCES context_packages(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
    nombre VARCHAR(180) NOT NULL,
    carril VARCHAR(32) NOT NULL CHECK (carril IN ('ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO')),
    formato VARCHAR(32) NOT NULL CHECK (formato IN ('NGSI_LD', 'GEOJSON', 'CSV', 'REST_JSON', 'MQTT', 'OGC_API_FEATURES', 'WMS_WFS')),
    frecuencia VARCHAR(24) NOT NULL CHECK (frecuencia IN ('TIEMPO_REAL', 'HORARIA', 'DIARIA', 'MENSUAL')),
    calidad VARCHAR(32) NOT NULL CHECK (calidad IN ('A_CERTIFICADA', 'B_ESTIMADA', 'C_EN_VALIDACION')),
    privacidad VARCHAR(24) NOT NULL CHECK (privacidad IN ('PUBLICO', 'INTERNO', 'RESTRINGIDO', 'ANONIMIZADO')),
    autorizacion VARCHAR(24) NOT NULL CHECK (autorizacion IN ('AUTORIZADO', 'PENDIENTE', 'NO_AUTORIZADO')),
    finalidad TEXT NOT NULL,
    trazabilidad_id VARCHAR(128) NOT NULL,
    endpoint_hint TEXT,
    PRIMARY KEY (context_package_id, id),
    CONSTRAINT context_package_fuente_parent_fk
        FOREIGN KEY (context_package_id, tenant_id, destino_id)
        REFERENCES context_packages(id, tenant_id, destino_id)
        ON DELETE CASCADE,
    CONSTRAINT context_package_fuente_tenant_destino_fk
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS context_package_variables (
    id VARCHAR(96) NOT NULL,
    context_package_id VARCHAR(96) NOT NULL REFERENCES context_packages(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants_gemelo(id) ON DELETE RESTRICT,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE RESTRICT,
    source_id VARCHAR(96) NOT NULL,
    etiqueta VARCHAR(180) NOT NULL,
    unidad VARCHAR(32) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    observada BOOLEAN NOT NULL,
    regla_calidad TEXT NOT NULL,
    PRIMARY KEY (context_package_id, id),
    CONSTRAINT context_package_variable_parent_fk
        FOREIGN KEY (context_package_id, tenant_id, destino_id)
        REFERENCES context_packages(id, tenant_id, destino_id)
        ON DELETE CASCADE,
    CONSTRAINT context_package_variable_source_fk
        FOREIGN KEY (context_package_id, source_id)
        REFERENCES context_package_fuentes(context_package_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT context_package_variable_tenant_destino_fk
        FOREIGN KEY (tenant_id, destino_id)
        REFERENCES destino_perfiles_semanticos(tenant_id, destino_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_context_packages_tenant_destino_estado
    ON context_packages (tenant_id, destino_id, estado, actualizado_en DESC);
CREATE INDEX IF NOT EXISTS idx_context_packages_document
    ON context_packages USING GIN (package_document jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_context_package_validaciones_latest
    ON context_package_validaciones (context_package_id, validado_en DESC);
CREATE INDEX IF NOT EXISTS idx_context_package_fuentes_destino
    ON context_package_fuentes (tenant_id, destino_id, autorizacion);

-- Aislamiento tenant+destino: el servicio de aplicación debe usar
-- SET LOCAL app.tenant_id y app.destino_id antes de acceder a cada transacción.
ALTER TABLE context_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_package_validaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_package_fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_package_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE context_package_validaciones FORCE ROW LEVEL SECURITY;
ALTER TABLE context_package_fuentes FORCE ROW LEVEL SECURITY;
ALTER TABLE context_package_variables FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS context_packages_por_tenant_destino ON context_packages;
CREATE POLICY context_packages_por_tenant_destino ON context_packages
    USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

DROP POLICY IF EXISTS context_package_validaciones_por_tenant_destino ON context_package_validaciones;
CREATE POLICY context_package_validaciones_por_tenant_destino ON context_package_validaciones
    USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

DROP POLICY IF EXISTS context_package_fuentes_por_tenant_destino ON context_package_fuentes;
CREATE POLICY context_package_fuentes_por_tenant_destino ON context_package_fuentes
    USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));

DROP POLICY IF EXISTS context_package_variables_por_tenant_destino ON context_package_variables;
CREATE POLICY context_package_variables_por_tenant_destino ON context_package_variables
    USING (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true) AND destino_id = current_setting('app.destino_id', true));
