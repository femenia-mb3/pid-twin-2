-- ==============================================================================
-- GEMELO DIGITAL TURÍSTICO (SEGITTUR - PLATAFORMA INTELIGENTE DE DESTINOS)
-- DDL DE BASE DE DATOS ESPACIAL COMPATIBLE CON POSTGRESQL 16 + POSTGIS 3.4
-- ==============================================================================

-- 1. Habilitación de extensiones geoespaciales y UUID
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerados para gobernanza y ontología SEGITTUR
CREATE TYPE tipo_fuente_enum AS ENUM ('pid_turistico', 'territorial_ign', 'tiempo_real_iot');
CREATE TYPE calidad_dato_enum AS ENUM ('A_CERTIFICADA', 'B_ESTIMADA', 'C_EN_VALIDACION');
CREATE TYPE capa_tematica_enum AS ENUM ('turismo', 'movilidad', 'medio_ambiente', 'infraestructuras', 'socioeconomica', 'eventos');
CREATE TYPE estado_sensor_enum AS ENUM ('NORMAL', 'PRECAUCION', 'CRITICO');

-- ==============================================================================
-- 3. TABLA DE DESTINOS TURÍSTICOS INTELIGENTES (DTI)
-- ==============================================================================
CREATE TABLE destinos (
    id VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(128) NOT NULL,
    codigo_ine VARCHAR(10) NOT NULL UNIQUE,
    comunidad_autonoma VARCHAR(64) NOT NULL,
    poblacion_censada INTEGER NOT NULL,
    capacidad_carga_maxima INTEGER NOT NULL,
    descripcion TEXT,
    geometria_centro GEOMETRY(Point, 4326) NOT NULL,
    limites_administrativos GEOMETRY(MultiPolygon, 4326),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. TABLA DE ZONAS TERRITORIALES Y POLÍGONOS DE CAPACIDAD DE CARGA
-- ==============================================================================
CREATE TABLE zonas_destino (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(128) NOT NULL,
    capa capa_tematica_enum NOT NULL DEFAULT 'turismo',
    tipo_zona VARCHAR(32) NOT NULL, -- 'CENTRO_HISTORICO', 'ZONA_PLAYA', etc.
    aforo_maximo INTEGER NOT NULL,
    afluencia_actual INTEGER DEFAULT 0,
    capacidad_carga_pct NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN aforo_maximo > 0 THEN ROUND((afluencia_actual::numeric / aforo_maximo::numeric) * 100, 2) ELSE 0 END
    ) STORED,
    geometria_poligono GEOMETRY(Polygon, 4326) NOT NULL,
    -- Gobernanza del dato
    fuente_origen VARCHAR(128) NOT NULL,
    tipo_fuente tipo_fuente_enum NOT NULL DEFAULT 'pid_turistico',
    calidad_dato calidad_dato_enum NOT NULL DEFAULT 'A_CERTIFICADA',
    trazabilidad_id VARCHAR(64) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. TABLA DE RECURSOS TURÍSTICOS Y EQUIPAMIENTOS (POIs)
-- ==============================================================================
CREATE TABLE recursos_turisticos (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    nombre VARCHAR(128) NOT NULL,
    categoria VARCHAR(32) NOT NULL, -- 'MONUMENTO', 'MUSEO', 'PLAYA'
    capa capa_tematica_enum NOT NULL DEFAULT 'turismo',
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    aforo_maximo INTEGER NOT NULL,
    visitantes_hora INTEGER DEFAULT 0,
    tiempo_medio_visita_min INTEGER DEFAULT 60,
    precio_medio NUMERIC(6,2) DEFAULT 0.0,
    accesibilidad_pmr BOOLEAN DEFAULT TRUE,
    horario VARCHAR(64),
    -- Gobernanza
    fuente_origen VARCHAR(128) NOT NULL,
    trazabilidad_id VARCHAR(64) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 6. TABLA DE SENSORES IOT Y TELEMETRÍA EN TIEMPO REAL
-- ==============================================================================
CREATE TABLE sensores_iot (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    tipo_sensor VARCHAR(32) NOT NULL, -- 'CONTEO_PEATONAL', 'CAMARA_AFORO', etc.
    nombre VARCHAR(128) NOT NULL,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    valor_actual NUMERIC(10,2) NOT NULL,
    unidad VARCHAR(16) NOT NULL,
    umbral_alerta NUMERIC(10,2) NOT NULL,
    estado estado_sensor_enum DEFAULT 'NORMAL',
    ultima_lectura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fuente_origen VARCHAR(128) NOT NULL,
    trazabilidad_id VARCHAR(64) NOT NULL
);

-- ==============================================================================
-- 7. TABLA DE HISTÓRICO DE TELEMETRÍA (SERIES TEMPORALES)
-- ==============================================================================
CREATE TABLE historico_telemetria (
    id BIGSERIAL PRIMARY KEY,
    sensor_id VARCHAR(64) NOT NULL REFERENCES sensores_iot(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    marca_tiempo TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. ÍNDICES ESPACIALES GIST PARA ALTO RENDIMIENTO EN CONSULTAS GIS
-- ==============================================================================
CREATE INDEX idx_destinos_centro_geo ON destinos USING GIST (geometria_centro);
CREATE INDEX idx_zonas_poligono_geo ON zonas_destino USING GIST (geometria_poligono);
CREATE INDEX idx_recursos_ubicacion_geo ON recursos_turisticos USING GIST (ubicacion);
CREATE INDEX idx_sensores_ubicacion_geo ON sensores_iot USING GIST (ubicacion);
CREATE INDEX idx_historico_sensor_fecha ON historico_telemetria (sensor_id, marca_tiempo DESC);

-- ==============================================================================
-- 9. VISTAS GEOSERVER / OGC COMPATIBLES
-- ==============================================================================
CREATE OR REPLACE VIEW vista_geoserver_afluencia_calor AS
SELECT 
    z.id,
    z.nombre,
    z.destino_id,
    z.capacidad_carga_pct,
    z.afluencia_actual,
    z.aforo_maximo,
    ST_Centroid(z.geometria_poligono) AS geom_punto_calor,
    z.geometria_poligono AS geom_area
FROM zonas_destino z;
