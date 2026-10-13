// Definición de tipos ontológicos según la arquitectura SEGITTUR PID

export type CapaTematica = 
  | 'turismo' 
  | 'movilidad' 
  | 'medio_ambiente' 
  | 'infraestructuras' 
  | 'socioeconomica' 
  | 'eventos';

export type FuenteTipo = 'pid_turistico' | 'territorial_ign' | 'tiempo_real_iot';

export interface DataGovernance {
  fuente: string;
  tipoFuente: FuenteTipo;
  calidad: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION';
  ultimaActualizacion: string;
  frecuenciaActualizacion: 'TIEMPO_REAL' | 'HORARIA' | 'DIARIA' | 'MENSUAL';
  trazabilidadId: string;
}

export interface Destino {
  id: string;
  nombre: string;
  codigoIne: string;
  comunidadAutonoma: string;
  centro: [number, number]; // [lat, lng]
  zoomInicial: number;
  poblacionCensada: number;
  capacidadCargaMaximaTeorica: number;
  descripcion: string;
  limitesGeoJson?: any;
}

export interface ZonaDestino {
  id: string;
  destinoId: string;
  nombre: string;
  capa: CapaTematica;
  tipoZona: 'CENTRO_HISTORICO' | 'ZONA_PLAYA' | 'ZONA_COMERCIAL' | 'ZONA_CULTURAL' | 'NODO_TRANSPORTE';
  aforoMaximo: number;
  afluenciaActual: number; // personas estimadas
  capacidadCargaPct: number; // 0 - 150%
  coordenadasPoligono: [number, number][]; // lat, lng
  gobernanza: DataGovernance;
}

export interface RecursoTuristico {
  id: string;
  destinoId: string;
  nombre: string;
  categoria: 'MONUMENTO' | 'MUSEO' | 'PLAYA' | 'MIRADOR' | 'HOTEL' | 'RESTAURANTE';
  capa: CapaTematica;
  ubicacion: [number, number]; // [lat, lng]
  aforoMaximo: number;
  visitantesHora: number;
  tiempoMedioVisitaMin: number;
  precioMedio: number;
  accesibilidadPmr: boolean;
  horario: string;
  gobernanza: DataGovernance;
}

export interface SensorIoT {
  id: string;
  destinoId: string;
  tipoSensor: 'CONTEO_PEATONAL' | 'CAMARA_AFORO' | 'CALIDAD_AIRE_NO2' | 'RUIDO_DB' | 'TEMPERATURA_C' | 'ESTACION_METEO' | 'PLUVIOMETRO' | 'TRAFICO_VEHICULAR';
  nombre: string;
  ubicacion: [number, number];
  valorActual: number;
  unidad: string;
  umbralAlerta: number;
  estado: 'NORMAL' | 'PRECAUCION' | 'CRITICO';
  ultimaLectura: string;
  gobernanza: DataGovernance;
}

export interface EscenarioSimulacion {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'CRUCERO_MASIVO' | 'EVENTO_CULTURAL' | 'EPISODIO_METEO' | 'CORTE_ACCESO' | 'PERSONALIZADO';
  factorAfluencia: number; // ej: 1.4 (+40%)
  impactoZonas: Record<string, number>; // multiplicador por zonaId
  zonasAfectadas: string[];
  rutasDesvioRecomendadas: {
    origen: string;
    destino: string;
    coordenadasRuta: [number, number][];
    capacidadDesvioHora: number;
    descripcion: string;
  }[];
  alertasGeneradas: {
    tipo: 'SATURACION' | 'CALIDAD_AIRE' | 'BLOQUEO_ACCESO' | 'METEO';
    mensaje: string;
    severidad: 'ALTA' | 'MEDIA' | 'BAJA';
  }[];
}

export interface IndicadoresDestino {
  visitantesEnDestino: number;
  variacionVsMedia: number; // %
  saturacionGlobalPct: number; // %
  emisionesCo2KgHora: number;
  ruidoMedioDb: number;
  consumoElectricoMwh: number; // MWh/día (sintético)
  indiceAccesibilidad: number; // 0-100 (sintético)
  minutosCentroSalud: number; // min a pie al centro de salud más cercano (sintético)
  minutosParadaBus: number; // min a pie a la parada de bus más cercana (sintético)
  minutosEscuela: number; // min a pie al colegio más cercano (sintético)
  distritosSaturadosCount: number;
  alertasActivasCount: number;
}
