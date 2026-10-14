import { RUTAS_CENTRO_A_ZONA_MALAGA, RUTAS_ENOTURISMO, RUTAS_GIBRALFARO, RUTAS_ZBE_ENTRADA, RutaPeatonal } from '../data/rutasModelosCatalogo';

/** Flujo turístico dibujado en los visores cuando una simulación del catálogo está activa. */
export interface FlujoModelo {
  id: string;
  etiqueta: string;
  color: string;
  /** [lat, lng] */
  puntos: [number, number][];
  /** Peso relativo (0–1): grosor e intensidad frente a la intensidad del escenario. */
  peso: number;
  esDesvio: boolean;
}

export const COLOR_RUTA_DESVIO = '#f59e0b';

interface ModeloFlujos {
  etiqueta: string;
  color: string;
  rutas: RutaPeatonal[];
}

const FLUJOS_POR_MODELO: Record<string, ModeloFlujos> = {
  modelo_movilidad: { etiqueta: 'Flujo turístico hacia el casco histórico (ZBE)', color: '#2563eb', rutas: RUTAS_ZBE_ENTRADA },
  modelo_espacios_naturales: { etiqueta: 'Flujo turístico al Parque Forestal de Gibralfaro', color: '#16a34a', rutas: RUTAS_GIBRALFARO },
  modelo_enoturismo: { etiqueta: 'Flujo turístico hacia la Cámara de aforo (C/ Carretería)', color: '#9f1239', rutas: RUTAS_ENOTURISMO },
};

/**
 * Flujos que genera cada simulación del catálogo. Con lluvia u ola de calor se añade la
 * «Ruta de Desvío»: un flujo menor, de otro color, que vuelve hacia fuera del centro.
 */
export function flujosParaEscenario(
  modelId: string | undefined,
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO',
): FlujoModelo[] {
  const modelo = modelId ? FLUJOS_POR_MODELO[modelId] : undefined;
  if (!modelo) return [];

  const flujos: FlujoModelo[] = modelo.rutas.map((ruta, i) => ({
    id: `${modelId}-flujo-${i}`,
    etiqueta: `${modelo.etiqueta} · ${ruta.nombre}`,
    color: modelo.color,
    puntos: ruta.puntos,
    peso: 1,
    esDesvio: false,
  }));

  if (clima !== 'DESPEJADO') {
    const motivo = clima === 'LLUVIA' ? 'lluvia' : 'ola de calor';
    modelo.rutas.forEach((ruta, i) => flujos.push({
      id: `${modelId}-desvio-${i}`,
      etiqueta: `Ruta de Desvío (${motivo}) · ${ruta.nombre}`,
      color: COLOR_RUTA_DESVIO,
      puntos: [...ruta.puntos].reverse(),
      peso: 0.45,
      esDesvio: true,
    }));
  }
  return flujos;
}

/** Id con el que se marcan las simulaciones creadas en el editor visual no-code. */
export const MODELO_EDITOR_VISUAL = 'editor_visual';

export const COLOR_FLUJO_EDITOR = '#7c3aed';

/**
 * Simulación creada en el editor visual: los turistas salen del centro de la ciudad hacia cada zona
 * seleccionada. En Málaga siguen rutas a pie reales; en otras zonas, una línea recta al centro de la zona.
 */
export function flujosEditorVisual(
  zoneIds: string[],
  zonas: Array<{ id: string; nombre: string; coordenadasPoligono: [number, number][] }>,
  centroCiudad: [number, number],
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO',
): FlujoModelo[] {
  const flujos: FlujoModelo[] = [];
  for (const id of zoneIds) {
    const zona = zonas.find(z => z.id === id);
    if (!zona) continue;
    const ruta = RUTAS_CENTRO_A_ZONA_MALAGA[id] ?? (() => {
      const n = zona.coordenadasPoligono.length || 1;
      const lat = zona.coordenadasPoligono.reduce((a, p) => a + p[0], 0) / n;
      const lng = zona.coordenadasPoligono.reduce((a, p) => a + p[1], 0) / n;
      return [centroCiudad, [lat, lng]] as [number, number][];
    })();
    flujos.push({
      id: `editor-flujo-${id}`,
      etiqueta: `Flujo turístico desde el centro · ${zona.nombre}`,
      color: COLOR_FLUJO_EDITOR,
      puntos: ruta,
      peso: 1,
      esDesvio: false,
    });
  }
  void clima;
  return flujos;
}

/** Entradas de leyenda (una por tipo de flujo, no por ruta). */
export function leyendaFlujosModelo(flujos: FlujoModelo[]): Array<{ color: string; etiqueta: string }> {
  const principal = flujos.find(f => !f.esDesvio);
  const desvio = flujos.find(f => f.esDesvio);
  return [
    ...(principal ? [{ color: principal.color, etiqueta: principal.etiqueta.split(' · ')[0] }] : []),
    ...(desvio ? [{ color: desvio.color, etiqueta: desvio.etiqueta.split(' · ')[0] }] : []),
  ];
}
