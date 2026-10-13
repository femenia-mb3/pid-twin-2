import { EscenarioSimulacion, ZonaDestino } from '../types/ontology';

const emptyRoutes: EscenarioSimulacion['rutasDesvioRecomendadas'] = [];

const selectFocusZones = (zones: ZonaDestino[]) => [...zones]
  .sort((left, right) => (right.capacidadCargaPct - left.capacidadCargaPct) || (right.afluenciaActual - left.afluenciaActual))
  .slice(0, Math.max(1, Math.min(3, zones.length)));

const zoneImpacts = (zones: ZonaDestino[], factor: number) => Object.fromEntries(zones.map(zone => [zone.id, factor]));

export const createBaseScenario = (): EscenarioSimulacion => ({
  id: 'base',
  nombre: 'Situación base',
  descripcion: 'Contexto observado antes de aplicar una hipótesis de simulación.',
  tipo: 'PERSONALIZADO',
  factorAfluencia: 1,
  impactoZonas: {},
  zonasAfectadas: [],
  rutasDesvioRecomendadas: emptyRoutes,
  alertasGeneradas: [],
});

export const createRuntimeScenarioPresets = (zones: ZonaDestino[]): EscenarioSimulacion[] => {
  const focus = selectFocusZones(zones);
  const focusIds = focus.map(zone => zone.id);
  const highDemandImpacts = zoneImpacts(zones, 1.08);
  focus.forEach(zone => { highDemandImpacts[zone.id] = 1.28; });
  const eventImpacts = zoneImpacts(zones, 1.04);
  focus.forEach(zone => { eventImpacts[zone.id] = 1.22; });
  const weatherImpacts = zoneImpacts(zones, 0.97);

  return [
    createBaseScenario(),
    {
      id: 'presion-alta-demanda',
      nombre: 'Incremento puntual de demanda',
      descripcion: 'Hipótesis de concentración de llegadas y mayor presión sobre las zonas actualmente más cargadas.',
      tipo: 'CRUCERO_MASIVO',
      factorAfluencia: 1.22,
      impactoZonas: highDemandImpacts,
      zonasAfectadas: focusIds,
      rutasDesvioRecomendadas: emptyRoutes,
      alertasGeneradas: [{ tipo: 'SATURACION', mensaje: 'Posible incremento de presión sobre las zonas de mayor ocupación.', severidad: 'MEDIA' }],
    },
    {
      id: 'evento-local',
      nombre: 'Evento o actividad de atracción',
      descripcion: 'Hipótesis de aumento de visitantes por programación, actividad cultural o campaña local.',
      tipo: 'EVENTO_CULTURAL',
      factorAfluencia: 1.16,
      impactoZonas: eventImpacts,
      zonasAfectadas: focusIds,
      rutasDesvioRecomendadas: emptyRoutes,
      alertasGeneradas: [{ tipo: 'SATURACION', mensaje: 'Revisar aforo y distribución de flujos durante la actividad.', severidad: 'MEDIA' }],
    },
    {
      id: 'episodio-meteorologico',
      nombre: 'Condición meteorológica adversa',
      descripcion: 'Hipótesis de redistribución de flujos y alteración de capacidad bajo una condición meteorológica.',
      tipo: 'EPISODIO_METEO',
      factorAfluencia: 0.94,
      impactoZonas: weatherImpacts,
      zonasAfectadas: focusIds,
      rutasDesvioRecomendadas: emptyRoutes,
      alertasGeneradas: [{ tipo: 'METEO', mensaje: 'Contrastar la hipótesis meteorológica con la fuente autorizada del destino.', severidad: 'BAJA' }],
    },
  ];
};
