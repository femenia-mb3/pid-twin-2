// Red viaria principal de Málaga (OpenStreetMap, ODbL) con carga de tráfico sintética pero coherente:
// depende de la jerarquía de la vía, la cercanía al centro, la franja horaria y un ruido estable por vía.

export interface TramoViario {
  id: string;
  nombre: string;
  clase: string;
  /** [lng, lat] */
  coordenadas: [number, number][];
  /** 0 (fluido) – 1 (colapsado) */
  carga: number;
  velocidadKmh: number;
  vehiculosHora: number;
}

interface RoadFeature {
  properties: { n: string; h: string; ow?: number; l?: number; ms?: number };
  geometry: { coordinates: [number, number][] };
}

const CENTRO = { lng: -4.4214, lat: 36.7213 };

// Capacidad (veh/h por sentido, aprox.) y velocidad libre por clase.
const CLASES: Record<string, { capacidad: number; libre: number; base: number }> = {
  motorway: { capacidad: 4200, libre: 100, base: 0.42 },
  motorway_link: { capacidad: 1800, libre: 60, base: 0.4 },
  primary: { capacidad: 2400, libre: 50, base: 0.5 },
  primary_link: { capacidad: 1200, libre: 40, base: 0.45 },
  secondary: { capacidad: 1500, libre: 40, base: 0.4 },
};

export const COLORES_CARGA = ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444', '#b91c1c'];

export function colorCarga(carga: number): string {
  return COLORES_CARGA[Math.min(COLORES_CARGA.length - 1, Math.floor(carga * COLORES_CARGA.length))];
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Perfil diario: valle nocturno y puntas de mañana (8h), mediodía y tarde (18-19h). */
export function factorHorario(hora: number): number {
  const punta = (centro: number, ancho: number, altura: number) =>
    altura * Math.exp(-((hora - centro) ** 2) / (2 * ancho ** 2));
  return Math.min(1.25, 0.28 + punta(8.3, 1.2, 0.7) + punta(14, 1.6, 0.45) + punta(18.5, 1.6, 0.8));
}

function distanciaCentroKm(lng: number, lat: number): number {
  const dx = (lng - CENTRO.lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const dy = (lat - CENTRO.lat) * 111.32;
  return Math.hypot(dx, dy);
}

export function construirRed(features: RoadFeature[], hora: number): TramoViario[] {
  const horario = factorHorario(hora);
  const tramos: TramoViario[] = [];
  features.forEach((f, i) => {
    const clase = CLASES[f.properties.h];
    const coords = f.geometry.coordinates;
    if (!clase || coords.length < 2) return;
    const nombre = f.properties.n || `Vía ${f.properties.h}`;
    const medio = coords[Math.floor(coords.length / 2)];
    // Más presión cerca del centro; la circunvalación y accesos fluyen mejor fuera de punta.
    const cercania = Math.max(0, 1 - distanciaCentroKm(medio[0], medio[1]) / 7);
    // Ruido estable por vía (misma calle ≈ mismo comportamiento) + variación local por tramo.
    const ruido = (hash(nombre) - 0.5) * 0.35 + (hash(`${nombre}#${i}`) - 0.5) * 0.18;
    const carga = Math.max(0.03, Math.min(1, (clase.base + 0.3 * cercania) * horario + ruido * horario));
    // Relación velocidad-carga tipo BPR: v = v0 / (1 + 0.15·c^4) con caída más fuerte al saturar.
    const velocidadKmh = Math.max(6, Math.round(clase.libre / (1 + 1.6 * carga ** 3.2)));
    const carriles = f.properties.l ?? (f.properties.h === 'motorway' ? 3 : 2);
    const vehiculosHora = Math.round(clase.capacidad * (carriles / 2) * Math.min(1, carga * 1.05) * (f.properties.ow ? 1 : 2));
    tramos.push({ id: `osm-${i}`, nombre, clase: f.properties.h, coordenadas: coords, carga, velocidadKmh, vehiculosHora });
  });
  return tramos;
}

let cache: Promise<RoadFeature[]> | null = null;

export function cargarViarioPrincipal(): Promise<RoadFeature[]> {
  cache ??= fetch('/data/malaga/malaga-viario-principal-osm.geojson')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((j: { features: RoadFeature[] }) => j.features)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}
