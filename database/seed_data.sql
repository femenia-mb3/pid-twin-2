-- ==============================================================================
-- DATOS SEMILLA PARA EL GEMELO DIGITAL TURÍSTICO (DESTINO MÁLAGA Y PALMA)
-- ==============================================================================

-- 1. Insertar Destinos Turísticos
INSERT INTO destinos (id, nombre, codigo_ine, comunidad_autonoma, poblacion_censada, capacidad_carga_maxima, descripcion, geometria_centro)
VALUES 
(
    'malaga', 
    'Málaga (Destino Piloto SEGITTUR)', 
    '29067', 
    'Andalucía', 
    579076, 
    85000, 
    'Capital Europea del Turismo Inteligente. Nodo intermodal de cruceros y alta concentración cultural.',
    ST_SetSRID(ST_MakePoint(-4.4214, 36.7213), 4326)
),
(
    'palma', 
    'Palma de Mallorca (Piloto Insular)', 
    '07040', 
    'Islas Baleares', 
    415940, 
    92000, 
    'Destino insular de alta estacionalidad con presión concentrada en casco gótico y puerto marítimo.',
    ST_SetSRID(ST_MakePoint(2.6502, 39.5696), 4326)
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Zonas Territoriales
INSERT INTO zonas_destino (id, destino_id, nombre, capa, tipo_zona, aforo_maximo, afluencia_actual, geometria_poligono, fuente_origen, tipo_fuente, calidad_dato, trazabilidad_id)
VALUES
(
    'malaga_centro',
    'malaga',
    'Centro Histórico & Calle Larios',
    'turismo',
    'CENTRO_HISTORICO',
    18000,
    14200,
    ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
        ST_MakePoint(-4.4250, 36.7240),
        ST_MakePoint(-4.4175, 36.7245),
        ST_MakePoint(-4.4180, 36.7180),
        ST_MakePoint(-4.4245, 36.7175),
        ST_MakePoint(-4.4250, 36.7240)
    ])), 4326),
    'PID-S1 Aforos Urbanos & Sensores Laser Catastro',
    'pid_turistico',
    'A_CERTIFICADA',
    'SEGITTUR-TR-MLG-001'
),
(
    'malaga_puerto_muelle1',
    'malaga',
    'Muelle Uno & Terminal Cruceros',
    'movilidad',
    'NODO_TRANSPORTE',
    15000,
    8900,
    ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
        ST_MakePoint(-4.4160, 36.7170),
        ST_MakePoint(-4.4090, 36.7160),
        ST_MakePoint(-4.4120, 36.7100),
        ST_MakePoint(-4.4185, 36.7120),
        ST_MakePoint(-4.4160, 36.7170)
    ])), 4326),
    'Autoridad Portuaria de Málaga & PID Streaming',
    'tiempo_real_iot',
    'A_CERTIFICADA',
    'SEGITTUR-TR-MLG-002'
),
(
    'malaga_soho',
    'malaga',
    'Barrio de las Artes (Soho)',
    'turismo',
    'ZONA_CULTURAL',
    12000,
    5100,
    ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
        ST_MakePoint(-4.4255, 36.7175),
        ST_MakePoint(-4.4190, 36.7170),
        ST_MakePoint(-4.4200, 36.7135),
        ST_MakePoint(-4.4265, 36.7140),
        ST_MakePoint(-4.4255, 36.7175)
    ])), 4326),
    'Catastro y Señalización Inteligente Municipal',
    'territorial_ign',
    'B_ESTIMADA',
    'SEGITTUR-TR-MLG-003'
),
(
    'malaga_malagueta',
    'malaga',
    'Playa de la Malagueta',
    'medio_ambiente',
    'ZONA_PLAYA',
    22000,
    9500,
    ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
        ST_MakePoint(-4.4080, 36.7180),
        ST_MakePoint(-4.3980, 36.7210),
        ST_MakePoint(-4.3960, 36.7165),
        ST_MakePoint(-4.4060, 36.7140),
        ST_MakePoint(-4.4080, 36.7180)
    ])), 4326),
    'Cámaras Costeras Inteligentes & AEMET OGC',
    'tiempo_real_iot',
    'A_CERTIFICADA',
    'SEGITTUR-TR-MLG-004'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Insertar Recursos Turísticos y Monumentos
INSERT INTO recursos_turisticos (id, destino_id, nombre, categoria, capa, ubicacion, aforo_maximo, visitantes_hora, tiempo_medio_visita_min, precio_medio, accesibilidad_pmr, horario, fuente_origen, trazabilidad_id)
VALUES
(
    'rec_alcazaba',
    'malaga',
    'Alcazaba y Teatro Romano',
    'MONUMENTO',
    'turismo',
    ST_SetSRID(ST_MakePoint(-4.4168, 36.7218), 4326),
    850,
    720,
    90,
    7.00,
    TRUE,
    '09:00 - 20:00',
    'PID-S10 Patrimonio Cultural',
    'SEGITTUR-REC-01'
),
(
    'rec_catedral',
    'malaga',
    'Catedral de la Encarnación (La Manquita)',
    'MONUMENTO',
    'turismo',
    ST_SetSRID(ST_MakePoint(-4.4199, 36.7202), 4326),
    1200,
    980,
    60,
    10.00,
    TRUE,
    '10:00 - 18:00',
    'PID-S10 Patrimonio Cultural',
    'SEGITTUR-REC-02'
),
(
    'rec_picasso',
    'malaga',
    'Museo Picasso Málaga',
    'MUSEO',
    'turismo',
    ST_SetSRID(ST_MakePoint(-4.4182, 36.7225), 4326),
    600,
    540,
    75,
    12.00,
    TRUE,
    '10:00 - 19:00',
    'Red de Museos PID',
    'SEGITTUR-REC-03'
),
(
    'rec_pompidou',
    'malaga',
    'Centre Pompidou Málaga (El Cubo)',
    'MUSEO',
    'turismo',
    ST_SetSRID(ST_MakePoint(-4.4136, 36.7176), 4326),
    700,
    310,
    70,
    9.00,
    TRUE,
    '09:30 - 20:00',
    'Red de Museos PID',
    'SEGITTUR-REC-04'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Insertar Sensores IoT
INSERT INTO sensores_iot (id, destino_id, tipo_sensor, nombre, ubicacion, valor_actual, unidad, umbral_alerta, estado, fuente_origen, trazabilidad_id)
VALUES
(
    'iot_larios_01',
    'malaga',
    'CONTEO_PEATONAL',
    'Sensor Óptico Calle Larios Norte',
    ST_SetSRID(ST_MakePoint(-4.4225, 36.7215), 4326),
    3840.0,
    'peatones/h',
    4000.0,
    'PRECAUCION',
    'Red IoT Municipal - MQTT/NGSI-LD',
    'IOT-MLG-01'
),
(
    'iot_constitucion_02',
    'malaga',
    'CAMARA_AFORO',
    'Cámara IA Plaza de la Constitución',
    ST_SetSRID(ST_MakePoint(-4.4224, 36.7226), 4326),
    82.0,
    '% ocupación',
    85.0,
    'PRECAUCION',
    'Visión Artificial Edge Computing',
    'IOT-MLG-02'
)
ON CONFLICT (id) DO NOTHING;
