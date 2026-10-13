import { SensorIoT } from '../types/ontology';

export type KpiMapa = 'visitantes' | 'saturacion' | 'co2' | 'ruido'
  | 'consumo' | 'accesibilidad' | 'centroSalud' | 'paradaBus' | 'escuela';
export const KPI_MAPA_IDS: KpiMapa[] = [
  'visitantes', 'saturacion', 'co2', 'ruido', 'consumo', 'accesibilidad', 'centroSalud', 'paradaBus', 'escuela'
];

type SensorSimulado = SensorIoT & { valorSimulado?: number };

interface KpiConfig {
  label: string;
  unidad: string;
  decimales: number;
  min: number;
  max: number;
  // Clases de color pastel, de valor bajo a alto.
  rampa: string[];
  // Lecturas de sensor que alimentan el KPI, convertidas a la unidad del KPI.
  estaciones: (s: SensorSimulado) => number | null;
  // Variación local por altura del edificio (suave; la estructura espacial viene del kriging).
  factorEdificio?: (plantas: number) => number;
  // KPI sintético sin sensores: valor medio de partida para generar el campo espacial.
  base?: number;
  // Gradiente centro→periferia como fracción del rango: valor(anillo) = centro[0] - anillo * centro[1].
  centro?: [number, number];
}

const lectura = (s: SensorSimulado) => s.valorSimulado ?? s.valorActual;

export const KPI_MAPA_CONFIG: Record<KpiMapa, KpiConfig> = {
  visitantes: {
    label: 'Visitantes',
    unidad: 'pers/h',
    decimales: 0,
    min: 1500, max: 4900,
    rampa: ['#e3f2fd', '#bbdefb', '#b2ebf2', '#c8e6c9', '#fff9c4', '#ffe0b2', '#ffccbc'],
    estaciones: s => s.tipoSensor === 'CONTEO_PEATONAL' ? lectura(s)
      : s.tipoSensor === 'CAMARA_AFORO' ? lectura(s) * 46 : null, // % ocupación → pers/h (aforo ≈ 4.600)
    factorEdificio: p => 0.94 + Math.min(p, 8) * 0.012,
    centro: [0.18, 0.17]
  },
  saturacion: {
    label: 'Saturación',
    unidad: '%',
    decimales: 0,
    min: 60, max: 115,
    rampa: ['#dcedc8', '#e6f2b8', '#fff9c4', '#ffecb3', '#ffd9b3', '#ffc4c4', '#f8b4c8'],
    estaciones: s => s.umbralAlerta ? (lectura(s) / s.umbralAlerta) * 100 : null
  },
  co2: {
    label: 'Emisiones CO₂',
    unidad: 'kg/h',
    decimales: 1,
    min: 8, max: 24,
    rampa: ['#e0f7ef', '#c9f0dd', '#d7f0c4', '#eef2bd', '#fbe9b7', '#f9d4b8', '#f2c4cf'],
    estaciones: s => s.tipoSensor === 'CALIDAD_AIRE_NO2' ? lectura(s) * 0.45 : null, // µg/m³ NO₂ → kg CO₂/h (índice)
    factorEdificio: p => 0.92 + Math.min(p, 8) * 0.02,
    centro: [0.1, 0.1]
  },
  ruido: {
    label: 'Presión sonora',
    unidad: 'dB(A)',
    decimales: 1,
    min: 58, max: 80,
    rampa: ['#ede7f6', '#e1d7f5', '#d9c8f0', '#e8c8ec', '#f5c6e0', '#f8bcd0', '#f5b0b8'],
    estaciones: s => s.tipoSensor === 'RUIDO_DB' ? lectura(s) : null
  },
  consumo: {
    label: 'Consumo eléctrico',
    unidad: 'kWh/m²·año',
    decimales: 0,
    min: 60, max: 180,
    rampa: ['#e8f5e9', '#dcedc8', '#f0f4c3', '#fff9c4', '#ffecb3', '#ffe0b2', '#ffccbc'],
    estaciones: () => null,
    base: 115,
    centro: [0.15, 0.12],
    factorEdificio: p => 0.9 + Math.min(p, 8) * 0.025
  },
  accesibilidad: {
    label: 'Índice de accesibilidad',
    unidad: '/100',
    decimales: 0,
    min: 40, max: 95,
    // Valor bajo = mala accesibilidad.
    rampa: ['#f8bbd0', '#ffccbc', '#ffe0b2', '#fff9c4', '#e6ee9c', '#c5e1a5', '#a5d6a7'],
    estaciones: () => null,
    base: 70,
    centro: [0.2, 0.2]
  },
  centroSalud: {
    label: 'Tiempo a centro de salud',
    unidad: 'min',
    decimales: 1,
    min: 4, max: 25,
    rampa: ['#e0f7fa', '#d0eef7', '#d4e6f7', '#e0dcf5', '#efd3f0', '#f8cde0', '#f8c0c8'],
    estaciones: () => null,
    base: 12,
    centro: [-0.2, -0.2]
  },
  paradaBus: {
    label: 'Tiempo a parada de bus',
    unidad: 'min',
    decimales: 1,
    min: 1, max: 12,
    rampa: ['#e0f7fa', '#d0eef7', '#d4e6f7', '#e0dcf5', '#efd3f0', '#f8cde0', '#f8c0c8'],
    estaciones: () => null,
    base: 4.5,
    centro: [-0.15, -0.15]
  },
  escuela: {
    label: 'Tiempo a escuela',
    unidad: 'min',
    decimales: 1,
    min: 3, max: 18,
    rampa: ['#e0f7fa', '#d0eef7', '#d4e6f7', '#e0dcf5', '#efd3f0', '#f8cde0', '#f8c0c8'],
    estaciones: () => null,
    base: 8.5,
    centro: [-0.1, -0.1]
  }
};

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = (v: number[]) => `#${v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

export const oscurecer = (color: string, f = 0.86) => toHex(hex(color).map(v => v * f));

export const kpiGradientCss = (kpi: KpiMapa) => {
  const r = KPI_MAPA_CONFIG[kpi].rampa;
  return `linear-gradient(90deg, ${r.join(', ')})`;
};

export const formatoKpi = (kpi: KpiMapa, valor: number) =>
  valor.toLocaleString('es-ES', {
    minimumFractionDigits: KPI_MAPA_CONFIG[kpi].decimales,
    maximumFractionDigits: KPI_MAPA_CONFIG[kpi].decimales
  });

export function claseKpi(kpi: KpiMapa, valor: number): number {
  const { min, max, rampa } = KPI_MAPA_CONFIG[kpi];
  return Math.min(rampa.length - 1, Math.max(0, Math.floor(((valor - min) / (max - min)) * rampa.length)));
}

export const colorKpi = (kpi: KpiMapa, valor: number) => KPI_MAPA_CONFIG[kpi].rampa[claseKpi(kpi, valor)];

/** Clases de la leyenda con su intervalo numérico. */
export function clasesLeyenda(kpi: KpiMapa) {
  const { min, max, rampa } = KPI_MAPA_CONFIG[kpi];
  const paso = (max - min) / rampa.length;
  return rampa.map((color, i) => ({
    color,
    desde: min + paso * i,
    hasta: min + paso * (i + 1),
    abierta: i === 0 ? 'bajo' as const : i === rampa.length - 1 ? 'alto' as const : null
  }));
}

export function textoClase(kpi: KpiMapa, c: ReturnType<typeof clasesLeyenda>[number]) {
  const unidad = KPI_MAPA_CONFIG[kpi].unidad;
  if (c.abierta === 'bajo') return `< ${formatoKpi(kpi, c.hasta)} ${unidad}`;
  if (c.abierta === 'alto') return `≥ ${formatoKpi(kpi, c.desde)} ${unidad}`;
  return `${formatoKpi(kpi, c.desde)} – ${formatoKpi(kpi, c.hasta)} ${unidad}`;
}

// ---------------------------------------------------------------------------
// Kriging ordinario con variograma exponencial
// ---------------------------------------------------------------------------

interface Estacion { x: number; y: number; z: number }

export interface ModeloKpi {
  kpi: KpiMapa;
  /** Valor simulado del KPI en la unidad física del indicador. */
  valorEn: (lat: number, lng: number, plantas?: number) => number;
}

const hash01 = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function invertir(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((fila, i) => [...fila, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map(fila => fila.slice(n));
}

const RANGO_M = 900;      // alcance del variograma
const RADIOS_M = [450, 950, 1500];
const ESTACIONES_POR_ANILLO = 8;

function crearModelo(kpi: KpiMapa, sensores: SensorSimulado[]): ModeloKpi | null {
  const cfg = KPI_MAPA_CONFIG[kpi];
  let reales = sensores
    .map(s => ({ s, z: cfg.estaciones(s) }))
    .filter((e): e is { s: SensorSimulado; z: number } => e.z !== null && Number.isFinite(e.z));
  // KPI sintético: sin lecturas propias, se ancla al valor base en la ubicación de los sensores.
  if (reales.length === 0 && cfg.base !== undefined) {
    reales = sensores.map(s => ({ s, z: cfg.base as number }));
  }
  if (reales.length === 0) return null;

  // Proyección local en metros respecto al centroide de los sensores del KPI.
  const lat0 = reales.reduce((a, e) => a + e.s.ubicacion[0], 0) / reales.length;
  const lng0 = reales.reduce((a, e) => a + e.s.ubicacion[1], 0) / reales.length;
  const mLat = 111000;
  const mLng = 111000 * Math.cos(lat0 * Math.PI / 180);
  const aXY = (lat: number, lng: number): [number, number] => [(lng - lng0) * mLng, (lat - lat0) * mLat];

  const estaciones: Estacion[] = reales.map(e => {
    const [x, y] = aXY(e.s.ubicacion[0], e.s.ubicacion[1]);
    return { x, y, z: e.z };
  });

  // Estaciones virtuales sintéticas: pocos sensores reales no bastan para definir zonas,
  // así que se generan puntos de control coherentes con la media medida y un patrón
  // espacial determinista (gradiente centro→periferia + lóbulos por sector).
  const media = estaciones.reduce((a, e) => a + e.z, 0) / estaciones.length;
  const semilla = KPI_MAPA_IDS.indexOf(kpi) * 7.31;
  const rango = cfg.max - cfg.min;
  RADIOS_M.forEach((radio, anillo) => {
    for (let k = 0; k < ESTACIONES_POR_ANILLO; k++) {
      const ang = (k / ESTACIONES_POR_ANILLO) * Math.PI * 2 + anillo * 0.4 + hash01(semilla + anillo * 10 + k) * 0.5;
      const x = Math.cos(ang) * radio;
      const y = Math.sin(ang) * radio;
      const sector = Math.sin(ang * 2 + semilla) * 0.6 + (hash01(semilla * 3 + anillo * 17 + k) - 0.5) * 0.8;
      const centro = cfg.centro ? cfg.centro[0] - anillo * cfg.centro[1] : 0;
      const z = media + rango * (sector * 0.42 + centro);
      estaciones.push({ x, y, z: Math.min(cfg.max * 1.02, Math.max(cfg.min * 0.98, z)) });
    }
  });

  const n = estaciones.length;
  const zMedia = estaciones.reduce((a, e) => a + e.z, 0) / n;
  const varianza = estaciones.reduce((a, e) => a + (e.z - zMedia) ** 2, 0) / n;
  const sill = Math.max(varianza, (rango * 0.12) ** 2);
  const cov = (h: number) => sill * Math.exp(-3 * h / RANGO_M);

  const K = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => {
    if (i === n && j === n) return 0;
    if (i === n || j === n) return 1;
    const h = Math.hypot(estaciones[i].x - estaciones[j].x, estaciones[i].y - estaciones[j].y);
    return cov(h) + (i === j ? sill * 0.03 : 0); // pepita
  }));
  const Kinv = invertir(K);
  if (!Kinv) return null;

  const c0 = new Array<number>(n + 1).fill(1);
  return {
    kpi,
    valorEn: (lat, lng, plantas = 1) => {
      const [x, y] = aXY(lat, lng);
      for (let i = 0; i < n; i++) c0[i] = cov(Math.hypot(estaciones[i].x - x, estaciones[i].y - y));
      let valor = 0;
      for (let i = 0; i < n; i++) {
        let w = 0;
        for (let j = 0; j <= n; j++) w += Kinv[i][j] * c0[j];
        valor += w * estaciones[i].z;
      }
      const f = cfg.factorEdificio ? cfg.factorEdificio(plantas) : 1;
      return Math.min(cfg.max * 1.05, Math.max(cfg.min * 0.95, valor * f));
    }
  };
}

export type ModelosKpi = Partial<Record<KpiMapa, ModeloKpi>>;

export function crearModelosKpi(sensores: SensorSimulado[]): ModelosKpi {
  const modelos: ModelosKpi = {};
  KPI_MAPA_IDS.forEach(kpi => {
    const m = crearModelo(kpi, sensores);
    if (m) modelos[kpi] = m;
  });
  return modelos;
}

/** Valores simulados de todos los KPI en un edificio, listos para mostrar en popups. */
export function valoresKpiEdificio(modelos: ModelosKpi, lat: number, lng: number, plantas: number) {
  return KPI_MAPA_IDS.flatMap(kpi => {
    const m = modelos[kpi];
    if (!m) return [];
    const valor = m.valorEn(lat, lng, plantas);
    return [{
      kpi,
      label: KPI_MAPA_CONFIG[kpi].label,
      unidad: KPI_MAPA_CONFIG[kpi].unidad,
      valor,
      texto: `${formatoKpi(kpi, valor)} ${KPI_MAPA_CONFIG[kpi].unidad}`,
      color: colorKpi(kpi, valor)
    }];
  });
}

export function centroideGeoJSON(geometry: any): [number, number] | null {
  const anillo = geometry?.type === 'Polygon' ? geometry.coordinates?.[0]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0]
    : null;
  if (!anillo?.length) return null;
  const lng = anillo.reduce((a: number, p: number[]) => a + p[0], 0) / anillo.length;
  const lat = anillo.reduce((a: number, p: number[]) => a + p[1], 0) / anillo.length;
  return [lat, lng];
}

// ---------------------------------------------------------------------------
// Caché de colores por KPI: el kriging se evalúa una sola vez por edificio y KPI
// mientras los sensores no cambien, de modo que alternar de KPI es instantáneo.
// ---------------------------------------------------------------------------

export interface PuntoEdificio { lat: number; lng: number; plantas: number }

const claveSensores = (sensores: SensorSimulado[]) =>
  sensores.map(s => `${s.id}:${s.valorSimulado ?? s.valorActual}`).join('|');

let modelosCache: { clave: string; modelos: ModelosKpi } | null = null;

/** Modelos de kriging reutilizados mientras las lecturas de los sensores sean las mismas. */
export function modelosKpiCacheados(sensores: SensorSimulado[]): ModelosKpi {
  const clave = claveSensores(sensores);
  if (modelosCache?.clave !== clave) modelosCache = { clave, modelos: crearModelosKpi(sensores) };
  return modelosCache.modelos;
}

const coloresCache = new WeakMap<PuntoEdificio[], { clave: string; porKpi: Map<KpiMapa, string[]> }>();

/** Color de cada edificio (mismo orden que `puntos`) para un KPI; vacío si el KPI no tiene modelo. */
export function coloresKpiEdificios(puntos: PuntoEdificio[], sensores: SensorSimulado[], kpi: KpiMapa): string[] {
  const clave = claveSensores(sensores);
  let entrada = coloresCache.get(puntos);
  if (!entrada || entrada.clave !== clave) {
    entrada = { clave, porKpi: new Map() };
    coloresCache.set(puntos, entrada);
  }
  const guardado = entrada.porKpi.get(kpi);
  if (guardado) return guardado;
  const modelo = modelosKpiCacheados(sensores)[kpi];
  const colores = modelo ? puntos.map(p => colorKpi(kpi, modelo.valorEn(p.lat, p.lng, p.plantas))) : [];
  entrada.porKpi.set(kpi, colores);
  return colores;
}

/** Calcula en segundo plano los KPI que faltan (uno por turno) para que el cambio de KPI sea inmediato. */
export function precalentarKpis(puntos: PuntoEdificio[], sensores: SensorSimulado[], cancelado: () => boolean = () => false) {
  const pendientes = [...KPI_MAPA_IDS];
  const paso = () => {
    const kpi = pendientes.shift();
    if (!kpi || cancelado()) return;
    coloresKpiEdificios(puntos, sensores, kpi);
    window.setTimeout(paso, 30);
  };
  window.setTimeout(paso, 300);
}
