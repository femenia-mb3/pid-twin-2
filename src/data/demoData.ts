import { RUTA_DESVIO_CRUCERO_SOHO, RUTA_DESVIO_EVENTO_SOHO } from './rutasCruceroViarias';
import { Destino, ZonaDestino, RecursoTuristico, SensorIoT, EscenarioSimulacion } from '../types/ontology';

export const DESTINOS_DEMO: Destino[] = [
  {
    id: 'malaga',
    nombre: 'Málaga (Destino Piloto SEGITTUR)',
    codigoIne: '29067',
    comunidadAutonoma: 'Andalucía',
    centro: [36.7213, -4.4214],
    zoomInicial: 15,
    poblacionCensada: 579076,
    capacidadCargaMaximaTeorica: 85000,
    descripcion: 'Pionera en Smart Tourism y Capital Europea del Turismo Inteligente. Nodo multimodal con puerto de cruceros, AVE y alta densidad cultural en centro histórico.'
  },
  {
    id: 'palma',
    nombre: 'Palma de Mallorca (Piloto Insular)',
    codigoIne: '07040',
    comunidadAutonoma: 'Islas Baleares',
    centro: [39.5696, 2.6502],
    zoomInicial: 15,
    poblacionCensada: 415940,
    capacidadCargaMaximaTeorica: 92000,
    descripcion: 'Destino insular de alta estacionalidad con presión concentrada en casco gótico, puerto marítimo y fachada marítima.'
  }
];

export const ZONAS_DEMO: ZonaDestino[] = [
  // --- MÁLAGA ---
  {
    id: 'malaga_centro',
    destinoId: 'malaga',
    nombre: 'Centro Histórico & Calle Larios',
    capa: 'turismo',
    tipoZona: 'CENTRO_HISTORICO',
    aforoMaximo: 18000,
    afluenciaActual: 14200,
    capacidadCargaPct: 78.8,
    coordenadasPoligono: [
      [36.7240, -4.4250],
      [36.7245, -4.4175],
      [36.7180, -4.4180],
      [36.7175, -4.4245]
    ],
    gobernanza: {
      fuente: 'PID-S1 Aforos Urbanos & Sensores Laser Catastro',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-TR-MLG-001'
    }
  },
  {
    id: 'malaga_puerto_muelle1',
    destinoId: 'malaga',
    nombre: 'Muelle Uno & Terminal Cruceros',
    capa: 'movilidad',
    tipoZona: 'NODO_TRANSPORTE',
    aforoMaximo: 15000,
    afluenciaActual: 8900,
    capacidadCargaPct: 59.3,
    coordenadasPoligono: [
      [36.7170, -4.4160],
      [36.7160, -4.4090],
      [36.7100, -4.4120],
      [36.7120, -4.4185]
    ],
    gobernanza: {
      fuente: 'Autoridad Portuaria de Málaga & PID Streaming',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-TR-MLG-002'
    }
  },
  {
    id: 'malaga_soho',
    destinoId: 'malaga',
    nombre: 'Barrio de las Artes (Soho)',
    capa: 'turismo',
    tipoZona: 'ZONA_CULTURAL',
    aforoMaximo: 12000,
    afluenciaActual: 5100,
    capacidadCargaPct: 42.5,
    coordenadasPoligono: [
      [36.7175, -4.4255],
      [36.7170, -4.4190],
      [36.7135, -4.4200],
      [36.7140, -4.4265]
    ],
    gobernanza: {
      fuente: 'Catastro y Señalización Inteligente Municipal',
      tipoFuente: 'territorial_ign',
      calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'HORARIA',
      trazabilidadId: 'SEGITTUR-TR-MLG-003'
    }
  },
  {
    id: 'malaga_malagueta',
    destinoId: 'malaga',
    nombre: 'Playa de la Malagueta',
    capa: 'medio_ambiente',
    tipoZona: 'ZONA_PLAYA',
    aforoMaximo: 22000,
    afluenciaActual: 9500,
    capacidadCargaPct: 43.1,
    coordenadasPoligono: [
      [36.7180, -4.4080],
      [36.7210, -4.3980],
      [36.7165, -4.3960],
      [36.7140, -4.4060]
    ],
    gobernanza: {
      fuente: 'Cámaras Costeras Inteligentes & AEMET OGC',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-TR-MLG-004'
    }
  },

  // --- PALMA DE MALLORCA ---
  {
    id: 'palma_casco_antiguo',
    destinoId: 'palma',
    nombre: 'Casco Antiguo & Catedral La Seu',
    capa: 'turismo',
    tipoZona: 'CENTRO_HISTORICO',
    aforoMaximo: 16000,
    afluenciaActual: 12800,
    capacidadCargaPct: 80.0,
    coordenadasPoligono: [
      [39.5720, 2.6450],
      [39.5730, 2.6550],
      [39.5660, 2.6560],
      [39.5665, 2.6460]
    ],
    gobernanza: {
      fuente: 'Smart Island Mallorca & PID Aforos',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-TR-PMI-001'
    }
  },
  {
    id: 'palma_paseo_maritimo',
    destinoId: 'palma',
    nombre: 'Paseo Marítimo & Port de Palma',
    capa: 'movilidad',
    tipoZona: 'NODO_TRANSPORTE',
    aforoMaximo: 20000,
    afluenciaActual: 11400,
    capacidadCargaPct: 57.0,
    coordenadasPoligono: [
      [39.5660, 2.6350],
      [39.5670, 2.6480],
      [39.5610, 2.6460],
      [39.5620, 2.6320]
    ],
    gobernanza: {
      fuente: 'Autoritat Portuària de Balears (APB)',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-TR-PMI-002'
    }
  }
];

export const RECURSOS_DEMO: RecursoTuristico[] = [
  // --- MÁLAGA ---
  {
    id: 'rec_alcazaba',
    destinoId: 'malaga',
    nombre: 'Alcazaba y Teatro Romano',
    categoria: 'MONUMENTO',
    capa: 'turismo',
    ubicacion: [36.7218, -4.4168],
    aforoMaximo: 850,
    visitantesHora: 720,
    tiempoMedioVisitaMin: 90,
    precioMedio: 7.0,
    accesibilidadPmr: true,
    horario: '09:00 - 20:00',
    gobernanza: {
      fuente: 'PID-S10 Patrimonio Cultural',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'HORARIA',
      trazabilidadId: 'SEGITTUR-REC-01'
    }
  },
  {
    id: 'rec_catedral',
    destinoId: 'malaga',
    nombre: 'Catedral de la Encarnación (La Manquita)',
    categoria: 'MONUMENTO',
    capa: 'turismo',
    ubicacion: [36.7202, -4.4199],
    aforoMaximo: 1200,
    visitantesHora: 980,
    tiempoMedioVisitaMin: 60,
    precioMedio: 10.0,
    accesibilidadPmr: true,
    horario: '10:00 - 18:00',
    gobernanza: {
      fuente: 'PID-S10 Patrimonio Cultural',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'HORARIA',
      trazabilidadId: 'SEGITTUR-REC-02'
    }
  },
  {
    id: 'rec_picasso',
    destinoId: 'malaga',
    nombre: 'Museo Picasso Málaga',
    categoria: 'MUSEO',
    capa: 'turismo',
    ubicacion: [36.7225, -4.4182],
    aforoMaximo: 600,
    visitantesHora: 540,
    tiempoMedioVisitaMin: 75,
    precioMedio: 12.0,
    accesibilidadPmr: true,
    horario: '10:00 - 19:00',
    gobernanza: {
      fuente: 'Red de Museos PID',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-REC-03'
    }
  },
  {
    id: 'rec_pompidou',
    destinoId: 'malaga',
    nombre: 'Centre Pompidou Málaga (El Cubo)',
    categoria: 'MUSEO',
    capa: 'turismo',
    ubicacion: [36.7176, -4.4136],
    aforoMaximo: 700,
    visitantesHora: 310,
    tiempoMedioVisitaMin: 70,
    precioMedio: 9.0,
    accesibilidadPmr: true,
    horario: '09:30 - 20:00',
    gobernanza: {
      fuente: 'Red de Museos PID',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SEGITTUR-REC-04'
    }
  },

  // --- PALMA ---
  {
    id: 'rec_la_seu',
    destinoId: 'palma',
    nombre: 'Catedral-Basílica de Santa María (La Seu)',
    categoria: 'MONUMENTO',
    capa: 'turismo',
    ubicacion: [39.5678, 2.6482],
    aforoMaximo: 1500,
    visitantesHora: 1100,
    tiempoMedioVisitaMin: 60,
    precioMedio: 9.0,
    accesibilidadPmr: true,
    horario: '10:00 - 18:00',
    gobernanza: {
      fuente: 'Patrimoni Balear & PID',
      tipoFuente: 'pid_turistico',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'HORARIA',
      trazabilidadId: 'SEGITTUR-REC-PMI-01'
    }
  },
  {
    id: 'rec_castell_bellver',
    destinoId: 'palma',
    nombre: 'Castell de Bellver',
    categoria: 'MONUMENTO',
    capa: 'turismo',
    ubicacion: [39.5638, 2.6194],
    aforoMaximo: 800,
    visitantesHora: 420,
    tiempoMedioVisitaMin: 90,
    precioMedio: 4.0,
    accesibilidadPmr: false,
    horario: '10:00 - 19:00',
    gobernanza: {
      fuente: 'Ajuntament de Palma',
      tipoFuente: 'territorial_ign',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'HORARIA',
      trazabilidadId: 'SEGITTUR-REC-PMI-02'
    }
  }
];

export const SENSORES_DEMO: SensorIoT[] = [
  // --- MÁLAGA ---
  {
    id: 'iot_larios_01',
    destinoId: 'malaga',
    tipoSensor: 'CONTEO_PEATONAL',
    nombre: 'Sensor Óptico Calle Larios Norte',
    ubicacion: [36.7215, -4.4225],
    valorActual: 3840,
    unidad: 'peatones/h',
    umbralAlerta: 4000,
    estado: 'PRECAUCION',
    ultimaLectura: 'Hace 30 seg',
    gobernanza: {
      fuente: 'Red IoT Municipal - Protocolo MQTT / NGSI-LD',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'IOT-MLG-01'
    }
  },
  {
    id: 'iot_constitucion_02',
    destinoId: 'malaga',
    tipoSensor: 'CAMARA_AFORO',
    nombre: 'Cámara IA Plaza de la Constitución',
    ubicacion: [36.7226, -4.4224],
    valorActual: 82,
    unidad: '% ocupación',
    umbralAlerta: 85,
    estado: 'PRECAUCION',
    ultimaLectura: 'Hace 15 seg',
    gobernanza: {
      fuente: 'Visión Artificial Edge Computing',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'IOT-MLG-02'
    }
  },
  {
    id: 'iot_ruido_larios_03',
    destinoId: 'malaga',
    tipoSensor: 'RUIDO_DB',
    nombre: 'Sonómetro Centro Histórico',
    ubicacion: [36.7207, -4.4190],
    valorActual: 67.8,
    unidad: 'dB(A)',
    umbralAlerta: 70,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-RUI-01'
    }
  },
  {
    id: 'iot_ruido_soho_04',
    destinoId: 'malaga',
    tipoSensor: 'RUIDO_DB',
    nombre: 'Sonómetro Alameda–Soho',
    ubicacion: [36.7172, -4.4248],
    valorActual: 73.2,
    unidad: 'dB(A)',
    umbralAlerta: 70,
    estado: 'PRECAUCION',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-RUI-02'
    }
  },
  {
    id: 'iot_temperatura_marina_05',
    destinoId: 'malaga',
    tipoSensor: 'TEMPERATURA_C',
    nombre: 'Sensor térmico Plaza de la Marina',
    ubicacion: [36.7187, -4.4208],
    valorActual: 27.6,
    unidad: '°C',
    umbralAlerta: 32,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-TMP-01'
    }
  },
  {
    id: 'iot_temperatura_parque_06',
    destinoId: 'malaga',
    tipoSensor: 'TEMPERATURA_C',
    nombre: 'Sensor térmico Paseo del Parque',
    ubicacion: [36.7194, -4.4158],
    valorActual: 25.9,
    unidad: '°C',
    umbralAlerta: 32,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-TMP-02'
    }
  },
  {
    id: 'iot_aire_parque_07',
    destinoId: 'malaga',
    tipoSensor: 'CALIDAD_AIRE_NO2',
    nombre: 'Calidad del aire Paseo del Parque',
    ubicacion: [36.7183, -4.4170],
    valorActual: 31.4,
    unidad: 'µg/m³ NO₂',
    umbralAlerta: 40,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-AIR-01'
    }
  },
  {
    id: 'iot_aire_muelle_08',
    destinoId: 'malaga',
    tipoSensor: 'CALIDAD_AIRE_NO2',
    nombre: 'Calidad del aire Muelle Uno',
    ubicacion: [36.7161, -4.4124],
    valorActual: 43.6,
    unidad: 'µg/m³ NO₂',
    umbralAlerta: 40,
    estado: 'PRECAUCION',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-AIR-02'
    }
  },

  // --- PALMA ---
  {
    id: 'iot_palma_borne_01',
    destinoId: 'palma',
    tipoSensor: 'CONTEO_PEATONAL',
    nombre: 'Sensor Peatonal Paseo del Borne',
    ubicacion: [39.5702, 2.6465],
    valorActual: 2950,
    unidad: 'peatones/h',
    umbralAlerta: 3500,
    estado: 'NORMAL',
    ultimaLectura: 'Hace 45 seg',
    gobernanza: {
      fuente: 'Smart Island Balears',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'A_CERTIFICADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'IOT-PMI-01'
    }
  },

  // --- MÁLAGA · sensores adicionales y pluviómetros ---
  {
    id: 'iot_oeste_09',
    destinoId: 'malaga',
    tipoSensor: 'CONTEO_PEATONAL',
    nombre: 'Sensor Peatonal Plaza de la Constitución Oeste',
    ubicacion: [36.7202, -4.4272],
    valorActual: 2310,
    unidad: 'peatones/h',
    umbralAlerta: 4000,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-09'
    }
  },
  {
    id: 'iot_oeste_10',
    destinoId: 'malaga',
    tipoSensor: 'RUIDO_DB',
    nombre: 'Ruido Calle Granada Oeste',
    ubicacion: [36.7189, -4.4281],
    valorActual: 62.4,
    unidad: 'dB(A)',
    umbralAlerta: 70,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-10'
    }
  },
  {
    id: 'iot_oeste_11',
    destinoId: 'malaga',
    tipoSensor: 'TEMPERATURA_C',
    nombre: 'Temperatura Calle Góngora',
    ubicacion: [36.710007897165326, -4.430846106532398],
    valorActual: 29.1,
    unidad: '°C',
    umbralAlerta: 32,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-11'
    }
  },
  {
    id: 'iot_oeste_12',
    destinoId: 'malaga',
    tipoSensor: 'CALIDAD_AIRE_NO2',
    nombre: 'Calidad del aire Alameda Principal Oeste',
    ubicacion: [36.7164, -4.4268],
    valorActual: 37.8,
    unidad: 'µg/m³ NO₂',
    umbralAlerta: 40,
    estado: 'NORMAL',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-12'
    }
  },
  {
    id: 'iot_oeste_13',
    destinoId: 'malaga',
    tipoSensor: 'RUIDO_DB',
    nombre: 'Ruido Avenida de Andalucía',
    ubicacion: [36.7149, -4.4296],
    valorActual: 77.9,
    unidad: 'dB(A)',
    umbralAlerta: 70,
    estado: 'CRITICO',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-13'
    }
  },
  {
    id: 'iot_oeste_14',
    destinoId: 'malaga',
    tipoSensor: 'CAMARA_AFORO',
    nombre: 'Cámara de aforo Calle Carretería',
    ubicacion: [36.7213, -4.4302],
    valorActual: 88,
    unidad: '% ocupación',
    umbralAlerta: 85,
    estado: 'PRECAUCION',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-14'
    }
  },
  {
    id: 'iot_oeste_15',
    destinoId: 'malaga',
    tipoSensor: 'TEMPERATURA_C',
    nombre: 'Temperatura Paseo del Parque Oeste',
    ubicacion: [36.7175, -4.431],
    valorActual: 33.4,
    unidad: '°C',
    umbralAlerta: 32,
    estado: 'PRECAUCION',
    ultimaLectura: 'Dato simulado · ahora',
    gobernanza: {
      fuente: 'Generador sintético para demostración', tipoFuente: 'tiempo_real_iot', calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(), frecuenciaActualizacion: 'TIEMPO_REAL', trazabilidadId: 'SYN-MLG-W-15'
    }
  },

  {
    id: 'iot_pluvio_mlg_01',
    destinoId: 'malaga',
    tipoSensor: 'PLUVIOMETRO',
    nombre: 'Pluviómetro Alameda Principal',
    ubicacion: [36.7172, -4.4256],
    valorActual: 0.1,
    unidad: 'mm/h',
    umbralAlerta: 30,
    estado: 'NORMAL',
    ultimaLectura: 'Hace 1 min',
    gobernanza: {
      fuente: 'Red IoT Municipal - Pluviometría (datos sintéticos de demostración)',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SYN-MLG-PLV-01'
    }
  },
  {
    id: 'iot_pluvio_mlg_02',
    destinoId: 'malaga',
    tipoSensor: 'PLUVIOMETRO',
    nombre: 'Pluviómetro Puerto · Muelle Uno',
    ubicacion: [36.719, -4.4153],
    valorActual: 0.2,
    unidad: 'mm/h',
    umbralAlerta: 30,
    estado: 'NORMAL',
    ultimaLectura: 'Hace 1 min',
    gobernanza: {
      fuente: 'Red IoT Municipal - Pluviometría (datos sintéticos de demostración)',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SYN-MLG-PLV-02'
    }
  },
  {
    id: 'iot_pluvio_mlg_03',
    destinoId: 'malaga',
    tipoSensor: 'PLUVIOMETRO',
    nombre: 'Pluviómetro La Malagueta',
    ubicacion: [36.7204, -4.4087],
    valorActual: 0.3,
    unidad: 'mm/h',
    umbralAlerta: 30,
    estado: 'NORMAL',
    ultimaLectura: 'Hace 1 min',
    gobernanza: {
      fuente: 'Red IoT Municipal - Pluviometría (datos sintéticos de demostración)',
      tipoFuente: 'tiempo_real_iot',
      calidad: 'B_ESTIMADA',
      ultimaActualizacion: new Date().toISOString(),
      frecuenciaActualizacion: 'TIEMPO_REAL',
      trazabilidadId: 'SYN-MLG-PLV-03'
    }
  },
];

export const ESCENARIOS_PREDEFINIDOS: EscenarioSimulacion[] = [
  {
    id: 'base',
    nombre: 'Situación Actual (Tiempo Real)',
    descripcion: 'Afluencia y parámetros observados en vivo por la red de sensores IoT y fuentes PID.',
    tipo: 'PERSONALIZADO',
    factorAfluencia: 1.0,
    impactoZonas: {
      malaga_centro: 1.0,
      malaga_puerto_muelle1: 1.0,
      malaga_soho: 1.0,
      malaga_malagueta: 1.0,
      palma_casco_antiguo: 1.0,
      palma_paseo_maritimo: 1.0
    },
    zonasAfectadas: [],
    rutasDesvioRecomendadas: [],
    alertasGeneradas: []
  },
  {
    id: 'crucero_masivo',
    nombre: 'Escenario 1: Llegada Simultánea 2 Mega-Cruceros',
    descripcion: 'Desembarco de 9.500 cruceristas con desplazamiento directo hacia cascos históricos y recursos patrimoniales.',
    tipo: 'CRUCERO_MASIVO',
    factorAfluencia: 1.45,
    impactoZonas: {
      malaga_centro: 1.55,
      malaga_puerto_muelle1: 1.70,
      malaga_soho: 1.15,
      malaga_malagueta: 1.10,
      palma_casco_antiguo: 1.50,
      palma_paseo_maritimo: 1.65
    },
    zonasAfectadas: ['malaga_centro', 'malaga_puerto_muelle1', 'palma_casco_antiguo'],
    rutasDesvioRecomendadas: [
      {
        origen: 'Terminal de Cruceros',
        destino: 'Barrio de las Artes (Soho) & CAC',
        coordenadasRuta: RUTA_DESVIO_CRUCERO_SOHO,
        capacidadDesvioHora: 2200,
        descripcion: 'Desvío peatonal cultural por Paseo de los Curas hacia Soho para descongestionar Calle Larios un 32%.'
      }
    ],
    alertasGeneradas: [
      {
        tipo: 'SATURACION',
        mensaje: 'Casco histórico superará el 90% de capacidad de carga en los próximos 40 minutos.',
        severidad: 'ALTA'
      }
    ]
  },
  {
    id: 'evento_cultural',
    nombre: 'Escenario 2: La Noche en Blanco (Concentración Cultural)',
    descripcion: 'Apertura extraordinaria nocturna de museos y monumentos con aumento de concentración peatonal.',
    tipo: 'EVENTO_CULTURAL',
    factorAfluencia: 1.60,
    impactoZonas: {
      malaga_centro: 1.85,
      malaga_puerto_muelle1: 1.20,
      malaga_soho: 1.65,
      malaga_malagueta: 0.60,
      palma_casco_antiguo: 1.75,
      palma_paseo_maritimo: 1.10
    },
    zonasAfectadas: ['malaga_centro', 'palma_casco_antiguo'],
    rutasDesvioRecomendadas: [
      {
        origen: 'Plaza Constitución',
        destino: 'Soho / CAC',
        coordenadasRuta: RUTA_DESVIO_EVENTO_SOHO,
        capacidadDesvioHora: 2500,
        descripcion: 'Corredor cultural secundario conectado hacia actuaciones urbanas en Soho.'
      }
    ],
    alertasGeneradas: [
      {
        tipo: 'SATURACION',
        mensaje: 'Colas estimadas superiores a 45 min en monumentos y museos principales.',
        severidad: 'ALTA'
      }
    ]
  },
  {
    id: 'episodio_meteo',
    nombre: 'Escenario 3: Lluvia Torrencial Repentina (DANA / Chubasco)',
    descripcion: 'Desalojo masivo de playas y paseos con concentración en centros cubiertos y transporte público.',
    tipo: 'EPISODIO_METEO',
    factorAfluencia: 1.10,
    impactoZonas: {
      malaga_centro: 1.40,
      malaga_puerto_muelle1: 0.50,
      malaga_soho: 1.30,
      malaga_malagueta: 0.15,
      palma_casco_antiguo: 1.35,
      palma_paseo_maritimo: 0.30
    },
    zonasAfectadas: ['malaga_centro', 'palma_casco_antiguo'],
    rutasDesvioRecomendadas: [],
    alertasGeneradas: [
      {
        tipo: 'METEO',
        mensaje: 'AEMET Alerta Amarilla por precipitación. Desalojo preventivo de áreas litorales.',
        severidad: 'ALTA'
      }
    ]
  }
];
