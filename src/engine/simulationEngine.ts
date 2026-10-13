import { ZonaDestino, RecursoTuristico, SensorIoT, EscenarioSimulacion, IndicadoresDestino } from '../types/ontology';

/** Indicadores urbanos sintéticos (demo): reaccionan a la presión de visitantes y a la saturación. */
function indicadoresUrbanosSinteticos(ratioVisitantes: number, saturacionPct: number) {
  const presion = Math.max(0, ratioVisitantes - 1);
  const congestion = 1 + presion * 0.15 + Math.max(0, saturacionPct - 70) * 0.004;
  return {
    consumoElectricoMwh: Number((142 * (1 + (ratioVisitantes - 1) * 0.35)).toFixed(1)),
    indiceAccesibilidad: Math.round(Math.min(100, Math.max(0, 78 - presion * 12 - Math.max(0, saturacionPct - 70) * 0.2))),
    minutosCentroSalud: Number((11.5 * congestion).toFixed(1)),
    minutosParadaBus: Number((4.2 * congestion).toFixed(1)),
    minutosEscuela: Number((8.6 * congestion).toFixed(1))
  };
}

export interface ParametrosDestinoConfigurables {
  umbralSaturacionAlerta: number; // Por defecto 85%
  pesoCapacidadFisica: number; // 0.6
  pesoCapacidadPsicologica: number; // 0.4
  tasaEmisionKgCo2PorPersonaHora: number; // 0.12 kg CO2 / visitante
  incrementoVisitantesManualPct: number; // -50% a +100%
  franjaHoraria: string; // "12:00", "18:00", etc.
  condicionClima: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  horaSimulacion: number; // 0-23
  intensidadEscenario: number; // 0-1.5, combina curva temporal y magnitud configurada
  factorCapacidadOperativa: number; // 0.5-1.2, capacidad disponible respecto al aforo nominal
  factorMovilidad: number; // reservado para reglas de movilidad autorizadas por destino
}

export interface ResultadoSimulacion {
  escenarioId: string;
  indicadoresActuales: IndicadoresDestino;
  indicadoresSimulados: IndicadoresDestino;
  zonasResultados: (ZonaDestino & {
    afluenciaSimulada: number;
    capacidadCargaSimuladaPct: number;
    nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
    deltaPersonas: number;
  })[];
  recursosResultados: (RecursoTuristico & {
    visitantesSimuladosHora: number;
    ocupacionSimuladaPct: number;
    tiempoEsperaEstimadoMin: number;
  })[];
  sensoresSimulados: (SensorIoT & {
    valorSimulado: number;
    estadoSimulado: 'NORMAL' | 'PRECAUCION' | 'CRITICO';
  })[];
  rutasOptimizadas: EscenarioSimulacion['rutasDesvioRecomendadas'];
  alertasActivas: EscenarioSimulacion['alertasGeneradas'];
  recomendacionesGestion: string[];
}

export class MotorContextoSimulacion {
  public static simular(
    zonas: ZonaDestino[],
    recursos: RecursoTuristico[],
    sensores: SensorIoT[],
    escenario: EscenarioSimulacion,
    params: ParametrosDestinoConfigurables
  ): ResultadoSimulacion {
    // 1. Factores de ajuste por clima y slider manual
    const factorManual = 1.0 + (params.incrementoVisitantesManualPct / 100);
    const intensidadEscenario = escenario.id === 'base' ? 0 : Math.max(0, Math.min(1.5, params.intensidadEscenario));
    const intensidadClima = escenario.tipo === 'EPISODIO_METEO' ? intensidadEscenario : 1;
    let factorClima = 1.0;
    if (params.condicionClima === 'LLUVIA') factorClima = 1 - 0.15 * intensidadClima;
    if (params.condicionClima === 'CALOR_EXTREMO') factorClima = 0.90;

    const factorEscenarioTemporal = 1 + (escenario.factorAfluencia - 1) * intensidadEscenario;
    const factorMovilidad = Math.max(0.5, Math.min(1.2, params.factorMovilidad));
    const factorCapacidadOperativa = Math.max(0.5, Math.min(1.2, params.factorCapacidadOperativa));
    const factorGlobalTotal = factorEscenarioTemporal * factorClima * factorManual * factorMovilidad;

    // 2. Simulación por Zonas (Ponderando capacidad física y psicológica)
    const pesoCapacidadTotal = params.pesoCapacidadFisica + params.pesoCapacidadPsicologica;
    const factorPonderado = pesoCapacidadTotal > 0
      ? 1 + ((params.pesoCapacidadPsicologica / pesoCapacidadTotal) * 0.05 * intensidadEscenario)
      : 1;

    const zonasResultados = zonas.map(z => {
      const multZonaObjetivo = escenario.impactoZonas[z.id] !== undefined ? escenario.impactoZonas[z.id] : 1.0;
      const multZona = 1 + (multZonaObjetivo - 1) * intensidadEscenario;
      let ajusteClimaZona = 1.0;
      if (params.condicionClima === 'LLUVIA') {
        if (z.tipoZona === 'ZONA_PLAYA') ajusteClimaZona = 1 - 0.8 * intensidadClima;
        if (z.tipoZona === 'CENTRO_HISTORICO' || z.tipoZona === 'ZONA_CULTURAL') ajusteClimaZona = 1 + 0.35 * intensidadClima;
      }

      const afluenciaSimulada = Math.round(z.afluenciaActual * multZona * factorManual * ajusteClimaZona * factorPonderado);
      const aforoOperativo = z.aforoMaximo * factorCapacidadOperativa;
      const capacidadCargaSimuladaPct = aforoOperativo > 0 ? Number(((afluenciaSimulada / aforoOperativo) * 100).toFixed(1)) : 0;
      
      let nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO' = 'BAJO';
      if (capacidadCargaSimuladaPct >= 95) nivelRiesgo = 'CRITICO';
      else if (capacidadCargaSimuladaPct >= params.umbralSaturacionAlerta) nivelRiesgo = 'ALTO';
      else if (capacidadCargaSimuladaPct >= 65) nivelRiesgo = 'MEDIO';

      return {
        ...z,
        afluenciaSimulada,
        capacidadCargaSimuladaPct,
        nivelRiesgo,
        deltaPersonas: afluenciaSimulada - z.afluenciaActual
      };
    });

    // 3. Simulación por Recursos Turísticos
    const recursosResultados = recursos.map(r => {
      let multRec = factorGlobalTotal;
      if (params.condicionClima === 'LLUVIA') {
        if (r.categoria === 'PLAYA' || r.categoria === 'MIRADOR') multRec *= 1 - 0.75 * intensidadClima;
        if (r.categoria === 'MUSEO' || r.categoria === 'MONUMENTO') multRec *= 1 + 0.40 * intensidadClima;
      }
      const visitantesSimuladosHora = Math.round(r.visitantesHora * multRec);
      const ocupacionSimuladaPct = r.aforoMaximo > 0 ? Number(((visitantesSimuladosHora / r.aforoMaximo) * 100).toFixed(1)) : 0;
      
      // Estimación no lineal de colas
      let tiempoEsperaEstimadoMin = 0;
      if (ocupacionSimuladaPct > 80) {
        tiempoEsperaEstimadoMin = Math.round((ocupacionSimuladaPct - 75) * 1.8);
      }

      return {
        ...r,
        visitantesSimuladosHora,
        ocupacionSimuladaPct,
        tiempoEsperaEstimadoMin
      };
    });

    // 4. Sensores simulados
    const sensoresSimulados = sensores.map(s => {
      let valorSimulado = s.valorActual;
      if (s.tipoSensor === 'CONTEO_PEATONAL' || s.tipoSensor === 'CAMARA_AFORO') {
        valorSimulado = Math.round(s.valorActual * factorGlobalTotal);
      } else if (s.tipoSensor === 'RUIDO_DB') {
        valorSimulado = Number((s.valorActual + (factorGlobalTotal > 1 ? (factorGlobalTotal - 1) * 6 : 0)).toFixed(1));
      } else if (s.tipoSensor === 'CALIDAD_AIRE_NO2') {
        const factorMeteo = params.condicionClima === 'LLUVIA' ? 1 - 0.16 * intensidadClima : params.condicionClima === 'CALOR_EXTREMO' ? 1.12 : 1;
        valorSimulado = Number((s.valorActual * (factorGlobalTotal > 1 ? 1 + (factorGlobalTotal - 1) * 0.4 : 1) * factorMeteo).toFixed(1));
      } else if (s.tipoSensor === 'TEMPERATURA_C') {
        const deltaMeteo = params.condicionClima === 'CALOR_EXTREMO' ? 6.5 : params.condicionClima === 'LLUVIA' ? -2.2 * intensidadClima : 0;
        valorSimulado = Number((s.valorActual + deltaMeteo + Math.max(0, factorGlobalTotal - 1) * 0.8).toFixed(1));
      } else if (s.tipoSensor === 'PLUVIOMETRO') {
        // Con lluvia el pluviómetro registra precipitación en mm/h según la intensidad del episodio.
        valorSimulado = params.condicionClima === 'LLUVIA' ? Number((s.valorActual + 8 + 38 * intensidadClima).toFixed(1)) : s.valorActual;
      }

      let estadoSimulado: 'NORMAL' | 'PRECAUCION' | 'CRITICO' = 'NORMAL';
      if (valorSimulado >= s.umbralAlerta * 1.1) estadoSimulado = 'CRITICO';
      else if (valorSimulado >= s.umbralAlerta) estadoSimulado = 'PRECAUCION';

      return {
        ...s,
        valorSimulado,
        estadoSimulado
      };
    });

    // 5. Indicadores globales agregados derivados exclusivamente del contexto recibido.
    const totalVisitantesActuales = zonas.reduce((acc, curr) => acc + curr.afluenciaActual, 0);
    const totalVisitantesSimulados = zonasResultados.reduce((acc, curr) => acc + curr.afluenciaSimulada, 0);
    const aforoMaximoGlobal = zonas.reduce((acc, curr) => acc + curr.aforoMaximo, 0) * factorCapacidadOperativa;
    const sensoresRuido = sensores.filter(sensor => sensor.tipoSensor === 'RUIDO_DB');
    const ruidoActual = sensoresRuido.length
      ? Number((sensoresRuido.reduce((total, sensor) => total + sensor.valorActual, 0) / sensoresRuido.length).toFixed(1))
      : 0;
    const alertasActuales = sensores.filter(sensor => sensor.estado !== 'NORMAL').length;

    const saturacionGlobalActualPct = aforoMaximoGlobal > 0 ? Number(((totalVisitantesActuales / aforoMaximoGlobal) * 100).toFixed(1)) : 0;
    const saturacionGlobalSimuladaPct = aforoMaximoGlobal > 0 ? Number(((totalVisitantesSimulados / aforoMaximoGlobal) * 100).toFixed(1)) : 0;

    const indicadoresActuales: IndicadoresDestino = {
      visitantesEnDestino: totalVisitantesActuales,
      variacionVsMedia: 0,
      saturacionGlobalPct: saturacionGlobalActualPct,
      emisionesCo2KgHora: Math.round(totalVisitantesActuales * params.tasaEmisionKgCo2PorPersonaHora),
      ruidoMedioDb: ruidoActual,
      ...indicadoresUrbanosSinteticos(1, saturacionGlobalActualPct),
      distritosSaturadosCount: zonas.filter(z => z.capacidadCargaPct >= params.umbralSaturacionAlerta).length,
      alertasActivasCount: alertasActuales
    };

    const indicadoresSimulados: IndicadoresDestino = {
      visitantesEnDestino: totalVisitantesSimulados,
      variacionVsMedia: totalVisitantesActuales > 0 ? Number((((totalVisitantesSimulados - totalVisitantesActuales) / totalVisitantesActuales) * 100).toFixed(1)) : 0,
      saturacionGlobalPct: saturacionGlobalSimuladaPct,
      emisionesCo2KgHora: Math.round(totalVisitantesSimulados * params.tasaEmisionKgCo2PorPersonaHora),
      ruidoMedioDb: Math.max(0, Number((ruidoActual + (factorGlobalTotal - 1) * 5.2).toFixed(1))),
      ...indicadoresUrbanosSinteticos(
        totalVisitantesActuales > 0 ? totalVisitantesSimulados / totalVisitantesActuales : 1,
        saturacionGlobalSimuladaPct
      ),
      distritosSaturadosCount: zonasResultados.filter(z => z.capacidadCargaSimuladaPct >= params.umbralSaturacionAlerta).length,
      alertasActivasCount: (intensidadEscenario >= 0.55 ? escenario.alertasGeneradas.length : 0) + (saturacionGlobalSimuladaPct > 80 ? 1 : 0)
    };

    // 6. Recomendaciones automáticas del motor
    const recomendacionesGestion: string[] = [];
    if (indicadoresSimulados.saturacionGlobalPct > 80) {
      recomendacionesGestion.push('Activar protocolo de tarificación dinámica o reserva previa en recursos patrimoniales de alta demanda.');
      recomendacionesGestion.push('Emitir avisos de descongestión en la App Turística municipal y paneles luminosos urbanos.');
    }
    if (zonasResultados.some(z => z.capacidadCargaSimuladaPct >= 90)) {
      recomendacionesGestion.push('Desplegar señalización inteligente y rutas peatonales alternativas hacia zonas de menor carga del destino.');
      recomendacionesGestion.push('Aumentar capacidad de acceso o frecuencia de lanzaderas en los nodos de entrada definidos por el destino.');
    }
    if (params.condicionClima === 'LLUVIA' && (escenario.tipo !== 'EPISODIO_METEO' || intensidadEscenario >= 0.25)) {
      recomendacionesGestion.push('Alerta meteorológica: Dirigir flujos hacia centros culturales cubiertos con reserva de aforo en tiempo real.');
    }
    if (escenario.tipo === 'CRUCERO_MASIVO' && intensidadEscenario >= 0.45) {
      recomendacionesGestion.push('Escalonar llegadas y reforzar la distribución desde los nodos de acceso para evitar concentraciones simultáneas.');
    }
    if (escenario.tipo === 'EVENTO_CULTURAL' && intensidadEscenario >= 0.45) {
      recomendacionesGestion.push('Publicar ocupación y tiempos de espera por equipamiento para repartir las visitas del circuito cultural nocturno.');
    }
    if (recomendacionesGestion.length === 0) {
      recomendacionesGestion.push('Capacidad turística en rango óptimo. Mantener monitorización ordinaria en continuo.');
    }

    return {
      escenarioId: escenario.id,
      indicadoresActuales,
      indicadoresSimulados,
      zonasResultados,
      recursosResultados,
      sensoresSimulados,
      rutasOptimizadas: intensidadEscenario >= 0.25 ? escenario.rutasDesvioRecomendadas : [],
      alertasActivas: intensidadEscenario >= 0.55 ? escenario.alertasGeneradas : [],
      recomendacionesGestion
    };
  }
}
