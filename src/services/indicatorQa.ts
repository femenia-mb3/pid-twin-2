// Preguntas y respuestas sobre los indicadores del destino (smart city).
// Las respuestas se calculan solo con la instantánea de indicadores que envía el cliente
// (situación actual + resultado del escenario activo); no se inventan datos.

export interface ContextoIndicadores {
  destino: string;
  escenario: string;
  clima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  hora: number;
  actuales: IndicadoresInstantanea;
  simulados: IndicadoresInstantanea;
  zonas: Array<{
    nombre: string;
    aforoMaximo: number;
    afluenciaActual: number;
    afluenciaSimulada: number;
    capacidadActualPct: number;
    capacidadSimuladaPct: number;
    riesgo: string;
  }>;
  sensores: Array<{ nombre: string; tipo: string; valor: number; unidad: string; estado: string }>;
  recomendaciones: string[];
}

export interface IndicadoresInstantanea {
  visitantesEnDestino: number;
  variacionVsMedia: number;
  saturacionGlobalPct: number;
  emisionesCo2KgHora: number;
  ruidoMedioDb: number;
  consumoElectricoMwh: number;
  indiceAccesibilidad: number;
  minutosCentroSalud: number;
  minutosParadaBus: number;
  minutosEscuela: number;
  distritosSaturadosCount: number;
  alertasActivasCount: number;
}

export interface RespuestaIndicadores {
  answer: string;
  sources: string[];
}

const CLIMA: Record<ContextoIndicadores['clima'], string> = { DESPEJADO: 'despejado', LLUVIA: 'lluvia', CALOR_EXTREMO: 'calor extremo' };
const n0 = (v: number) => Math.round(v).toLocaleString('es-ES');
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('es-ES');
const sig = (v: number) => `${v > 0 ? '+' : ''}${n1(v)}`;
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tiene = (q: string, ...palabras: string[]) => palabras.some(p => q.includes(p));

const delta = (actual: number, simulado: number, unidad: string) => {
  const d = simulado - actual;
  if (Math.abs(d) < 0.05) return `sin cambios respecto a la situación actual`;
  const pct = actual !== 0 ? ` (${sig((d / actual) * 100)} %)` : '';
  return `${d > 0 ? 'sube' : 'baja'} ${n1(Math.abs(d))} ${unidad}${pct} respecto a la situación actual`;
};

function resumen(c: ContextoIndicadores): RespuestaIndicadores {
  const s = c.simulados;
  return {
    answer:
      `Resumen de ${c.destino} (${c.escenario}, ${String(c.hora).padStart(2, '0')}:00, clima ${CLIMA[c.clima]}):\n` +
      `• Visitantes en destino: ${n0(s.visitantesEnDestino)} (${sig(s.variacionVsMedia)} % vs situación actual)\n` +
      `• Saturación global: ${n1(s.saturacionGlobalPct)} % · distritos saturados: ${s.distritosSaturadosCount} · alertas activas: ${s.alertasActivasCount}\n` +
      `• Emisiones de CO₂: ${n0(s.emisionesCo2KgHora)} kg/h · ruido medio: ${n1(s.ruidoMedioDb)} dB · consumo eléctrico: ${n1(s.consumoElectricoMwh)} MWh/día\n` +
      `• Accesibilidad: ${n0(s.indiceAccesibilidad)}/100 · a pie: salud ${n0(s.minutosCentroSalud)} min, bus ${n0(s.minutosParadaBus)} min, escuela ${n0(s.minutosEscuela)} min`,
    sources: ['indicadoresSimulados', 'indicadoresActuales'],
  };
}

function ayuda(c: ContextoIndicadores): RespuestaIndicadores {
  return {
    answer:
      `No he identificado qué indicador te interesa. Puedo responder sobre: saturación y aforo (global o por zona), visitantes, CO₂, ruido, consumo eléctrico, ` +
      `accesibilidad, servicios cercanos (salud, bus, escuela), alertas, sensores y recomendaciones, y comparar el escenario con la situación actual.\n\n` +
      resumen(c).answer,
    sources: ['indicadoresSimulados'],
  };
}

export function answerIndicatorQuestion(pregunta: string, c: ContextoIndicadores): RespuestaIndicadores {
  const q = norm(pregunta);
  const a = c.actuales;
  const s = c.simulados;

  // Zona mencionada por nombre (alguna palabra significativa del nombre)
  const zona = c.zonas.find(z => norm(z.nombre).split(/[^a-z0-9]+/).filter(w => w.length > 3).some(w => q.includes(w)));

  if (tiene(q, 'resumen', 'resumeme', 'indicadores', 'estado general', 'panorama', 'situacion general')) return resumen(c);

  if (tiene(q, 'recomend', 'recomiend', 'que hago', 'que hacer', 'mitig', 'medida', 'consejo', 'sugier')) {
    return {
      answer: c.recomendaciones.length
        ? `Recomendaciones del motor para este escenario:\n${c.recomendaciones.map(r => `• ${r}`).join('\n')}`
        : 'No hay recomendaciones activas: los indicadores están en rango.',
      sources: ['recomendacionesGestion'],
    };
  }

  if (zona || tiene(q, 'zona', 'distrito', 'barrio', 'saturad', 'aforo', 'ocupacion', 'capacidad', 'masific', 'lleno', 'congestion')) {
    if (zona) {
      return {
        answer:
          `${zona.nombre}: ocupación simulada ${n1(zona.capacidadSimuladaPct)} % (actual ${n1(zona.capacidadActualPct)} %), riesgo ${zona.riesgo.toLowerCase()}.\n` +
          `Afluencia: ${n0(zona.afluenciaSimulada)} personas frente a ${n0(zona.afluenciaActual)} actuales, sobre un aforo máximo de ${n0(zona.aforoMaximo)}.`,
        sources: ['zonasResultados'],
      };
    }
    const orden = [...c.zonas].sort((x, y) => y.capacidadSimuladaPct - x.capacidadSimuladaPct);
    const top = orden.slice(0, 3);
    return {
      answer:
        `Saturación global ${n1(s.saturacionGlobalPct)} % (${delta(a.saturacionGlobalPct, s.saturacionGlobalPct, 'pp')}); ${s.distritosSaturadosCount} zona(s) por encima del umbral.\n` +
        `Zonas más cargadas:\n${top.map(z => `• ${z.nombre}: ${n1(z.capacidadSimuladaPct)} % (${z.riesgo.toLowerCase()})`).join('\n')}`,
      sources: ['zonasResultados', 'indicadoresSimulados'],
    };
  }

  if (tiene(q, 'visitante', 'turista', 'afluencia', 'gente', 'personas')) {
    return {
      answer: `Hay ${n0(s.visitantesEnDestino)} visitantes en ${c.destino} en el escenario «${c.escenario}»; ${delta(a.visitantesEnDestino, s.visitantesEnDestino, 'visitantes')}.`,
      sources: ['indicadoresSimulados', 'indicadoresActuales'],
    };
  }

  if (tiene(q, 'co2', 'emision', 'carbono', 'contamin', 'huella')) {
    const no2 = c.sensores.filter(x => x.tipo === 'CALIDAD_AIRE_NO2');
    const extra = no2.length ? `\nCalidad del aire (NO₂): ${no2.map(x => `${x.nombre} ${n1(x.valor)} ${x.unidad} (${x.estado.toLowerCase()})`).join('; ')}.` : '';
    return {
      answer: `Las emisiones de CO₂ estimadas son ${n0(s.emisionesCo2KgHora)} kg/h; ${delta(a.emisionesCo2KgHora, s.emisionesCo2KgHora, 'kg/h')}.${extra}`,
      sources: ['indicadoresSimulados', 'sensoresSimulados'],
    };
  }

  if (tiene(q, 'ruido', 'sonor', 'decibel', ' db')) {
    return {
      answer: `El ruido medio es ${n1(s.ruidoMedioDb)} dB; ${delta(a.ruidoMedioDb, s.ruidoMedioDb, 'dB')}.`,
      sources: ['indicadoresSimulados', 'sensoresSimulados'],
    };
  }

  if (tiene(q, 'electric', 'energia', 'consumo', 'mwh')) {
    return {
      answer: `El consumo eléctrico sintético es ${n1(s.consumoElectricoMwh)} MWh/día; ${delta(a.consumoElectricoMwh, s.consumoElectricoMwh, 'MWh/día')}.`,
      sources: ['indicadoresSimulados'],
    };
  }

  if (tiene(q, 'accesib', 'movilidad reducida', 'pmr')) {
    return {
      answer: `El índice de accesibilidad es ${n0(s.indiceAccesibilidad)}/100 (actual ${n0(a.indiceAccesibilidad)}/100). Es un indicador sintético.`,
      sources: ['indicadoresSimulados'],
    };
  }

  if (tiene(q, 'salud', 'hospital', 'medico', 'bus', 'autobus', 'parada', 'escuela', 'colegio', 'servicio', 'a pie', 'cercan')) {
    return {
      answer:
        `Tiempos a pie (indicadores sintéticos): centro de salud ${n0(s.minutosCentroSalud)} min, parada de bus ${n0(s.minutosParadaBus)} min, colegio ${n0(s.minutosEscuela)} min. ` +
        `En la situación actual eran ${n0(a.minutosCentroSalud)}, ${n0(a.minutosParadaBus)} y ${n0(a.minutosEscuela)} min.`,
      sources: ['indicadoresSimulados'],
    };
  }

  if (tiene(q, 'alerta', 'critic', 'peligro', 'riesgo', 'problema')) {
    const criticos = c.sensores.filter(x => x.estado === 'CRITICO');
    const precaucion = c.sensores.filter(x => x.estado === 'PRECAUCION');
    const zonasRiesgo = c.zonas.filter(z => z.riesgo === 'ALTO' || z.riesgo === 'CRITICO');
    return {
      answer:
        `Alertas activas: ${s.alertasActivasCount}. Sensores en estado crítico: ${criticos.length}${criticos.length ? ` (${criticos.slice(0, 4).map(x => x.nombre).join(', ')})` : ''}; en precaución: ${precaucion.length}.\n` +
        `Zonas con riesgo alto o crítico: ${zonasRiesgo.length ? zonasRiesgo.map(z => `${z.nombre} (${n1(z.capacidadSimuladaPct)} %)`).join(', ') : 'ninguna'}.`,
      sources: ['sensoresSimulados', 'zonasResultados', 'indicadoresSimulados'],
    };
  }

  if (tiene(q, 'sensor', 'temperatura', 'calor', 'lluvia', 'pluvi', 'tiempo', 'meteo', 'trafico', 'aire', 'no2')) {
    const mapa: Array<[string, string]> = [['temperatura', 'TEMPERATURA_C'], ['calor', 'TEMPERATURA_C'], ['pluvi', 'PLUVIOMETRO'], ['lluvia', 'PLUVIOMETRO'], ['trafico', 'TRAFICO_VEHICULAR'], ['aire', 'CALIDAD_AIRE_NO2'], ['no2', 'CALIDAD_AIRE_NO2'], ['meteo', 'ESTACION_METEO'], ['tiempo', 'ESTACION_METEO']];
    const tipo = mapa.find(([k]) => q.includes(k))?.[1];
    const lista = (tipo ? c.sensores.filter(x => x.tipo === tipo) : c.sensores).slice(0, 6);
    return {
      answer: lista.length
        ? `Sensores${tipo ? '' : ' (muestra)'}:\n${lista.map(x => `• ${x.nombre}: ${n1(x.valor)} ${x.unidad} (${x.estado.toLowerCase()})`).join('\n')}\nClima del escenario: ${CLIMA[c.clima]}.`
        : 'No hay sensores de ese tipo en el destino.',
      sources: ['sensoresSimulados'],
    };
  }

  if (tiene(q, 'escenario', 'cambia', 'compar', 'diferencia', 'impacto', 'efecto', 'variacion', 'que pasa', 'que ocurre')) {
    return {
      answer:
        `Impacto de «${c.escenario}» frente a la situación actual:\n` +
        `• Visitantes: ${delta(a.visitantesEnDestino, s.visitantesEnDestino, 'visitantes')}\n` +
        `• Saturación global: ${delta(a.saturacionGlobalPct, s.saturacionGlobalPct, 'pp')}\n` +
        `• CO₂: ${delta(a.emisionesCo2KgHora, s.emisionesCo2KgHora, 'kg/h')}\n` +
        `• Ruido: ${delta(a.ruidoMedioDb, s.ruidoMedioDb, 'dB')}\n` +
        `• Zonas saturadas: ${a.distritosSaturadosCount} → ${s.distritosSaturadosCount}`,
      sources: ['indicadoresActuales', 'indicadoresSimulados'],
    };
  }

  return ayuda(c);
}

/** Instrucciones y contexto para un modelo de lenguaje: debe responder solo con estos datos. */
export function buildIndicatorPrompt(c: ContextoIndicadores): string {
  return (
    'Eres el asistente de indicadores de un gemelo digital turístico (smart city). Responde en español, de forma breve y concreta, ' +
    'usando EXCLUSIVAMENTE los datos del contexto JSON. Si el dato no está en el contexto, dilo claramente. Indica siempre las unidades ' +
    'y distingue la situación actual de la simulada. Los datos son sintéticos de demostración.\n\nCONTEXTO:\n' + JSON.stringify(c)
  );
}
