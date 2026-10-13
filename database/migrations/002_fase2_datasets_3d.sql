-- ==============================================================================
-- GEMELO DIGITAL TURÍSTICO (SEGITTUR - PLATAFORMA INTELIGENTE DE DESTINOS)
-- MIGRACIÓN 002: CATÁLOGO DE ACTIVOS 3D, EDIFICIOS LOD2 Y MALLAS TEXTURIZADAS
-- ==============================================================================

-- 1. Enumerados para el catálogo tridimensional
DO $$ BEGIN
    CREATE TYPE tipo_activo_3d_enum AS ENUM ('point_cloud', 'terrain', 'buildings_lod2', 'photogrammetry_mesh');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_dataset_3d_enum AS ENUM ('planificado', 'captura_pendiente', 'procesamiento', 'validado_qa', 'publicado', 'retirado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipologia_edificio_3d_enum AS ENUM ('patrimonio_complejo', 'equipamiento_cultural', 'hito_urbano_portuario', 'edificacion_residencial', 'infraestructura_transporte');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE clasificacion_difusion_enum AS ENUM ('publica', 'restringida_seguridad', 'interna_municipal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla maestra de Datasets 3D
CREATE TABLE IF NOT EXISTS dataset_3d (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    tipo tipo_activo_3d_enum NOT NULL,
    version VARCHAR(64) NOT NULL,
    estado estado_dataset_3d_enum NOT NULL DEFAULT 'publicado',
    titulo VARCHAR(160) NOT NULL,
    descripcion TEXT,
    crs_horizontal VARCHAR(64) NOT NULL DEFAULT 'EPSG:25830',
    datum_vertical VARCHAR(64) NOT NULL DEFAULT 'REDNAP08 / Ortométrica',
    fecha_captura DATE NOT NULL,
    precision_xy_m NUMERIC(6,3),
    precision_z_m NUMERIC(6,3),
    resolucion_o_densidad VARCHAR(64) NOT NULL, -- ej: '6.20 ptos/m²', 'GSD 1.5 cm/px'
    cobertura GEOMETRY(MultiPolygon, 4326),
    tileset_url TEXT NOT NULL,
    formato_contenido VARCHAR(32) NOT NULL DEFAULT 'OGC 3D Tiles 1.1 / GLB',
    compresion VARCHAR(64) NOT NULL DEFAULT 'meshopt + KHR_mesh_quantization',
    tamano_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    licencia VARCHAR(64) NOT NULL DEFAULT 'CC-BY 4.0',
    atribucion TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(destino_id, tipo, version)
);

CREATE INDEX IF NOT EXISTS idx_dataset_3d_cobertura ON dataset_3d USING GIST (cobertura);
CREATE INDEX IF NOT EXISTS idx_dataset_3d_destino_tipo ON dataset_3d(destino_id, tipo, estado);

-- 3. Tabla de Edificios Singulares y Activos Clave de la Fase 2
CREATE TABLE IF NOT EXISTS edificio_3d (
    id VARCHAR(64) PRIMARY KEY,
    destino_id VARCHAR(64) NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
    dataset_3d_id VARCHAR(64) REFERENCES dataset_3d(id) ON DELETE SET NULL,
    recurso_turistico_id VARCHAR(64) REFERENCES recursos_turisticos(id) ON DELETE SET NULL,
    building_id_catastro VARCHAR(20),
    nombre VARCHAR(160) NOT NULL,
    tipologia tipologia_edificio_3d_enum NOT NULL,
    oleada INTEGER NOT NULL DEFAULT 1, -- 1: Primera oleada, 2: Segunda oleada
    titular_organismo VARCHAR(128) NOT NULL,
    finalidad_gemelo TEXT NOT NULL,
    clasificacion_difusion clasificacion_difusion_enum NOT NULL DEFAULT 'publica',
    requiere_permiso_especifico BOOLEAN NOT NULL DEFAULT TRUE,
    permiso_estado VARCHAR(32) NOT NULL DEFAULT 'APROBADO', -- 'APROBADO', 'EN_TRAMITACION', 'NO_REQUERIDO'
    gsd_objetivo_cm NUMERIC(4,1) DEFAULT 1.5,
    altura_cumbrera_m NUMERIC(6,2),
    superficie_m2 NUMERIC(8,2),
    geometria_huella GEOMETRY(Polygon, 4326),
    geometria_envolvente_3d GEOMETRY(PolyhedralSurfaceZ, 4326),
    estado_qa VARCHAR(32) NOT NULL DEFAULT 'APROBADO_QA', -- 'ESPECIFICADO', 'CAPTURADO', 'APROBADO_QA'
    notas_operativas TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edificio_3d_huella ON edificio_3d USING GIST (geometria_huella);
CREATE INDEX IF NOT EXISTS idx_edificio_3d_oleada ON edificio_3d (destino_id, oleada);

-- ==============================================================================
-- 4. POBLACIÓN DE DATOS INICIALES PARA EL PILOTO MÁLAGA (FASE 2)
-- ==============================================================================

-- Dataset 1: LiDAR PNOA 2024 actualmente desplegado
INSERT INTO dataset_3d (
    id, destino_id, tipo, version, estado, titulo, descripcion,
    crs_horizontal, datum_vertical, fecha_captura, precision_xy_m, precision_z_m,
    resolucion_o_densidad, tileset_url, formato_contenido, compresion, tamano_bytes,
    licencia, atribucion
) VALUES (
    'ds3d_malaga_lidar_2024', 'malaga', 'point_cloud', '2024-H30', 'publicado',
    'Nube PNOA-LiDAR 2024 Málaga Centro–Puerto',
    'Nube oficial de tercera cobertura nacional (tesela 373-4065 / H30 NPC02) teselada en OGC 3D Tiles 1.1 con 375 archivos GLB jerárquicos.',
    'EPSG:25830 (ETRS89 / UTM zone 30N)', 'REDNAP08 / Altura ortométrica oficial IGN', '2024-05-15', 0.200, 0.100,
    '6.20 puntos/m²', '/tilesets/malaga-centro-2024/tileset.json', 'OGC 3D Tiles 1.1 / GLB',
    'meshopt + KHR_mesh_quantization', 65445332,
    'CC-BY 4.0 Instituto Geográfico Nacional',
    'IGN-CNIG PNOA-LiDAR 2024. Plan Nacional de Ortofotografía Aérea.'
) ON CONFLICT (destino_id, tipo, version) DO UPDATE SET
    estado = EXCLUDED.estado,
    tileset_url = EXCLUDED.tileset_url;

-- Dataset 2: Catálogo LOD2 semántico (Fase 2)
INSERT INTO dataset_3d (
    id, destino_id, tipo, version, estado, titulo, descripcion,
    crs_horizontal, datum_vertical, fecha_captura, precision_xy_m, precision_z_m,
    resolucion_o_densidad, tileset_url, formato_contenido, compresion, tamano_bytes,
    licencia, atribucion
) VALUES (
    'ds3d_malaga_lod2_2026', 'malaga', 'buildings_lod2', '2026-v1-oleada1', 'validado_qa',
    'Edificios LOD2 Semánticos (Primera Oleada)',
    'Modelos volumétricos precisos de la envolvente edilicia con clasificación semántica de cubierta (RoofSurface), fachadas (WallSurface) y suelo.',
    'EPSG:25830', 'REDNAP08 / Ortométrica', '2026-02-01', 0.050, 0.080,
    'LOD2 CityJSON 2.0 / 3D Tiles', '/tilesets/malaga-lod2-oleada1/tileset.json', 'OGC 3D Tiles 1.1 / GLB',
    'meshopt + KHR_mesh_quantization', 14200000,
    'Uso institucional PID - Ayuntamiento de Málaga',
    'Ayuntamiento de Málaga · Gerencia Municipal de Urbanismo & SEGITTUR PID'
) ON CONFLICT (destino_id, tipo, version) DO UPDATE SET
    tileset_url = EXCLUDED.tileset_url,
    estado = EXCLUDED.estado;

-- Dataset 3: Mallas fotogramétricas texturizadas de alta resolución
INSERT INTO dataset_3d (
    id, destino_id, tipo, version, estado, titulo, descripcion,
    crs_horizontal, datum_vertical, fecha_captura, precision_xy_m, precision_z_m,
    resolucion_o_densidad, tileset_url, formato_contenido, compresion, tamano_bytes,
    licencia, atribucion
) VALUES (
    'ds3d_malaga_photo_2026', 'malaga', 'photogrammetry_mesh', '2026-v1-oleada1', 'validado_qa',
    'Mallas Fotogramétricas Texturizadas 3D (Primera Oleada)',
    'Mallas trianguladas con texturizado fotográfico de alta resolución para los cuatro activos singulares acordados.',
    'EPSG:25830', 'REDNAP08 / Ortométrica', '2026-02-15', 0.020, 0.030,
    'GSD 1.5 cm/píxel', '/tilesets/malaga-fotogrametria-oleada1/tileset.json', 'OGC 3D Tiles 1.1 / GLB',
    'meshopt + KTX2', 48500000,
    'Convenio Patrimonial Junta de Andalucía / Ayuntamiento de Málaga',
    'Consejería de Cultura / Ayto de Málaga / SEGITTUR'
) ON CONFLICT (destino_id, tipo, version) DO UPDATE SET
    tileset_url = EXCLUDED.tileset_url,
    estado = EXCLUDED.estado;

-- 5. Activos Clave Registrados de la Primera Oleada (Nombres unificados exactamente: Catedral de Málaga, Alcazaba, Museo Picasso Málaga, Centre Pompidou Málaga)
INSERT INTO edificio_3d (
    id, destino_id, dataset_3d_id, recurso_turistico_id, building_id_catastro, nombre, tipologia, oleada,
    titular_organismo, finalidad_gemelo, clasificacion_difusion, requiere_permiso_especifico,
    permiso_estado, gsd_objetivo_cm, altura_cumbrera_m, superficie_m2, estado_qa, notas_operativas
) VALUES
(
    'b3d_catedral_malaga', 'malaga', 'ds3d_malaga_photo_2026', 'rec_catedral', '29900A00100001',
    'Catedral de Málaga', 'patrimonio_complejo', 1,
    'Diócesis de Málaga / Cabildo Catedralicio',
    'Análisis de aforos en Plaza del Obispo, accesos turísticos y microclima en entorno de cubiertas.',
    'publica', TRUE, 'APROBADO', 1.0, 84.50, 4200.0, 'APROBADO_QA',
    'Vuelos de dron bajo escenario STS-01 en coordinación con Cabildo y Policía Local.'
),
(
    'b3d_alcazaba_malaga', 'malaga', 'ds3d_malaga_photo_2026', 'rec_alcazaba', '29900A00100002',
    'Alcazaba', 'patrimonio_complejo', 1,
    'Ayuntamiento de Málaga (Área de Cultura y Patrimonio)',
    'Simulación de capacidad de carga en accesos peatonales empinados, sombras y gestión de colas de entrada.',
    'publica', TRUE, 'APROBADO', 1.5, 45.20, 15000.0, 'APROBADO_QA',
    'Modelado conjunto de murallas y topografía con fotogrametría oblicua y escáner láser terrestre.'
),
(
    'b3d_museo_picasso', 'malaga', 'ds3d_malaga_photo_2026', 'rec_picasso', '29900A00100003',
    'Museo Picasso Málaga', 'equipamiento_cultural', 1,
    'Fundación Museo Picasso Málaga / Junta de Andalucía',
    'Simulación de dispersión de visitantes hacia Calle San Agustín y mitigación de cuellos de botella.',
    'publica', TRUE, 'APROBADO', 1.2, 18.30, 2800.0, 'APROBADO_QA',
    'Captura de patios interiores y cubiertas tradicionales sin interrumpir visitas públicas.'
),
(
    'b3d_centre_pompidou', 'malaga', 'ds3d_malaga_photo_2026', 'rec_pompidou', '29900A00100004',
    'Centre Pompidou Málaga', 'hito_urbano_portuario', 1,
    'Ayuntamiento de Málaga / Autoridad Portuaria de Málaga',
    'Conexión de flujos turísticos entre Muelle Uno y el casco histórico, aforos en paseos marítimos.',
    'publica', TRUE, 'APROBADO', 1.5, 12.00, 6300.0, 'APROBADO_QA',
    'Geometría contemporánea con superficies translúcidas y prisma de vidrio en espacio portuario.'
)
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    permiso_estado = EXCLUDED.permiso_estado,
    estado_qa = EXCLUDED.estado_qa;
