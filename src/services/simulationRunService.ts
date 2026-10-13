import { MotorContextoSimulacion, ParametrosDestinoConfigurables, ResultadoSimulacion } from '../engine/simulationEngine';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { createBaseScenario } from './scenarioPresetFactory';
import { EscenarioSimulacion, IndicadoresDestino } from '../types/ontology';
import { postgisRepository } from './postgisRepository';
import {
  DerivedGeoJsonFeatureCollection,
  SimulationComparison,
  SimulationRun,
  SimulationRunExecutionResult,
  SimulationRunLayers,
  SimulationRunRequest,
} from '../types/simulationRun';

const clone = <T>(value: T): T => structuredClone(value);

const stableHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const runId = (destinationId: string, seed: string) => `run-${destinationId}-${seed}-${Date.now().toString(36)}`;

const error = (code: string, path: string, message: string) => ({ code, path, message });

const deltaIndicators = (base: IndicadoresDestino, scenario: IndicadoresDestino) => ({
  visitantesEnDestino: scenario.visitantesEnDestino - base.visitantesEnDestino,
  variacionVsMedia: Number((scenario.variacionVsMedia - base.variacionVsMedia).toFixed(1)),
  saturacionGlobalPct: Number((scenario.saturacionGlobalPct - base.saturacionGlobalPct).toFixed(1)),
  emisionesCo2KgHora: scenario.emisionesCo2KgHora - base.emisionesCo2KgHora,
  ruidoMedioDb: Number((scenario.ruidoMedioDb - base.ruidoMedioDb).toFixed(1)),
  distritosSaturadosCount: scenario.distritosSaturadosCount - base.distritosSaturadosCount,
  alertasActivasCount: scenario.alertasActivasCount - base.alertasActivasCount,
});

const comparisonFrom = (base: ResultadoSimulacion, scenario: ResultadoSimulacion): SimulationComparison => ({
  base: base.indicadoresActuales,
  scenario: scenario.indicadoresSimulados,
  delta: deltaIndicators(base.indicadoresActuales, scenario.indicadoresSimulados),
});

const polygon = (coordinates: [number, number][]) => {
  const ring = coordinates.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push([...ring[0]] as [number, number]);
  return ring;
};

const derivedLayers = (runIdValue: string, base: ResultadoSimulacion, scenario: ResultadoSimulacion): SimulationRunLayers => {
  const baseZones = new Map(base.zonasResultados.map(zone => [zone.id, zone]));
  const baseResources = new Map(base.recursosResultados.map(resource => [resource.id, resource]));
  const baseSensors = new Map(base.sensoresSimulados.map(sensor => [sensor.id, sensor]));

  const zones: DerivedGeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    resultKind: 'SIMULATION_DERIVED',
    layer: 'zones',
    features: scenario.zonasResultados.map(zone => {
      const baseline = baseZones.get(zone.id);
      return {
        type: 'Feature',
        id: zone.id,
        geometry: { type: 'Polygon', coordinates: [polygon(zone.coordenadasPoligono)] },
        properties: {
          runId: runIdValue,
          resultKind: 'SIMULATION_DERIVED',
          baselineAfluencia: baseline?.afluenciaSimulada ?? 0,
          scenarioAfluencia: zone.afluenciaSimulada,
          deltaAfluencia: zone.afluenciaSimulada - (baseline?.afluenciaSimulada ?? 0),
          baselineCargaPct: baseline?.capacidadCargaSimuladaPct ?? 0,
          scenarioCargaPct: zone.capacidadCargaSimuladaPct,
          deltaCargaPct: Number((zone.capacidadCargaSimuladaPct - (baseline?.capacidadCargaSimuladaPct ?? 0)).toFixed(1)),
          risk: zone.nivelRiesgo,
        },
      };
    }),
  };

  const resources: DerivedGeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    resultKind: 'SIMULATION_DERIVED',
    layer: 'resources',
    features: scenario.recursosResultados.map(resource => {
      const baseline = baseResources.get(resource.id);
      return {
        type: 'Feature',
        id: resource.id,
        geometry: { type: 'Point', coordinates: [resource.ubicacion[1], resource.ubicacion[0]] },
        properties: {
          runId: runIdValue,
          resultKind: 'SIMULATION_DERIVED',
          baselineVisitorsHour: baseline?.visitantesSimuladosHora ?? 0,
          scenarioVisitorsHour: resource.visitantesSimuladosHora,
          deltaVisitorsHour: resource.visitantesSimuladosHora - (baseline?.visitantesSimuladosHora ?? 0),
          scenarioOccupancyPct: resource.ocupacionSimuladaPct,
          scenarioWaitMinutes: resource.tiempoEsperaEstimadoMin,
        },
      };
    }),
  };

  const sensors: DerivedGeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    resultKind: 'SIMULATION_DERIVED',
    layer: 'sensors',
    features: scenario.sensoresSimulados.map(sensor => {
      const baseline = baseSensors.get(sensor.id);
      return {
        type: 'Feature',
        id: sensor.id,
        geometry: { type: 'Point', coordinates: [sensor.ubicacion[1], sensor.ubicacion[0]] },
        properties: {
          runId: runIdValue,
          resultKind: 'SIMULATION_DERIVED',
          baselineValue: baseline?.valorSimulado ?? 0,
          scenarioValue: sensor.valorSimulado,
          deltaValue: Number((sensor.valorSimulado - (baseline?.valorSimulado ?? 0)).toFixed(2)),
          state: sensor.estadoSimulado,
        },
      };
    }),
  };

  return { zones, resources, sensors };
};

const validateScenario = (scenario: EscenarioSimulacion, zoneIds: Set<string>) => {
  const errors: Array<{ code: string; path: string; message: string }> = [];
  if (!scenario || typeof scenario !== 'object') return [error('SCENARIO_REQUIRED', 'scenario', 'La ejecución necesita una definición de escenario.')];
  if (!scenario.id || !scenario.nombre || !scenario.tipo) errors.push(error('SCENARIO_FIELDS_REQUIRED', 'scenario', 'El escenario requiere id, nombre y tipo.'));
  if (!Number.isFinite(scenario.factorAfluencia) || scenario.factorAfluencia <= 0) errors.push(error('SCENARIO_FACTOR_INVALID', 'scenario.factorAfluencia', 'factorAfluencia debe ser positivo.'));
  if ((scenario.zonasAfectadas || []).some(zoneId => !zoneIds.has(zoneId))) errors.push(error('SCENARIO_ZONE_SCOPE_INVALID', 'scenario.zonasAfectadas', 'El escenario contiene una zona ajena al destino.'));
  if (Object.keys(scenario.impactoZonas || {}).some(zoneId => !zoneIds.has(zoneId))) errors.push(error('SCENARIO_IMPACT_SCOPE_INVALID', 'scenario.impactoZonas', 'El impacto debe referirse únicamente a zonas del destino.'));
  return errors;
};

const validateParameters = (parameters: ParametrosDestinoConfigurables) => {
  const errors: Array<{ code: string; path: string; message: string }> = [];
  if (!parameters || typeof parameters !== 'object') return [error('PARAMETERS_REQUIRED', 'parameters', 'La ejecución requiere parámetros explícitos.')];
  const numberInRange = (key: keyof ParametrosDestinoConfigurables, minimum: number, maximum: number, integer = false) => {
    const value = parameters[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      errors.push(error('PARAMETER_INVALID', `parameters.${key}`, `${key} debe ser ${integer ? 'un entero ' : ''}entre ${minimum} y ${maximum}.`));
    }
  };
  numberInRange('umbralSaturacionAlerta', 1, 100);
  numberInRange('pesoCapacidadFisica', 0, 1);
  numberInRange('pesoCapacidadPsicologica', 0, 1);
  numberInRange('tasaEmisionKgCo2PorPersonaHora', 0, 100);
  numberInRange('incrementoVisitantesManualPct', -100, 300);
  numberInRange('horaSimulacion', 0, 23, true);
  numberInRange('intensidadEscenario', 0, 1.5);
  numberInRange('factorCapacidadOperativa', 0.1, 2);
  numberInRange('factorMovilidad', 0.1, 2);
  if (parameters.pesoCapacidadFisica + parameters.pesoCapacidadPsicologica <= 0) {
    errors.push(error('PARAMETER_WEIGHTS_INVALID', 'parameters', 'La suma de pesos de capacidad debe ser positiva.'));
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(parameters.franjaHoraria || '')) {
    errors.push(error('PARAMETER_TIME_INVALID', 'parameters.franjaHoraria', 'franjaHoraria debe seguir el formato HH:MM.'));
  }
  if (!['DESPEJADO', 'LLUVIA', 'CALOR_EXTREMO'].includes(parameters.condicionClima)) {
    errors.push(error('PARAMETER_CLIMATE_INVALID', 'parameters.condicionClima', 'condicionClima no es válida.'));
  }
  return errors;
};

class SimulationRunRegistry {
  private readonly runs = new Map<string, SimulationRun>();

  execute(request: SimulationRunRequest): SimulationRunExecutionResult {
    if (!request.destinationId) return { valid: false, errors: [error('DESTINATION_REQUIRED', 'destinationId', 'La ejecución requiere destinationId.')] };
    const resolved = DestinationRuntimeService.resolve(request.destinationId);
    if (!resolved.runtime || !resolved.report.valid) {
      return { valid: false, errors: resolved.report.errors.map(item => error(item.code, item.path, item.message)) };
    }
    const runtime = resolved.runtime;
    const scenarioErrors = validateScenario(request.scenario, new Set(runtime.zones.map(zone => zone.id)));
    if (scenarioErrors.length) return { valid: false, errors: scenarioErrors };
    const parameterErrors = validateParameters(request.parameters);
    if (parameterErrors.length) return { valid: false, errors: parameterErrors };

    const seed = request.seed || stableHash(JSON.stringify([runtime.fingerprint.value, request.scenario, request.parameters]));
    const baselineParameters: ParametrosDestinoConfigurables = {
      ...request.parameters,
      incrementoVisitantesManualPct: 0,
      condicionClima: 'DESPEJADO',
      intensidadEscenario: 0,
      factorCapacidadOperativa: 1,
      factorMovilidad: 1,
    };
    const base = MotorContextoSimulacion.simular(runtime.zones, runtime.resources, runtime.sensors, createBaseScenario(), baselineParameters);
    const scenario = MotorContextoSimulacion.simular(runtime.zones, runtime.resources, runtime.sensors, request.scenario, request.parameters);
    const id = runId(runtime.destination.id, seed);
    const run: SimulationRun = {
      id,
      type: 'SimulationRun',
      status: 'COMPLETED',
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      createdAt: new Date().toISOString(),
      actor: request.actor || 'operador-destino',
      seed,
      scenario: clone(request.scenario),
      scenarioDefinitionId: request.scenarioDefinitionId,
      scenarioVersion: request.scenarioVersion,
      parameters: clone(request.parameters),
      model: {
        id: runtime.modelProfile.id,
        name: runtime.modelProfile.name,
        version: runtime.modelProfile.version,
        domains: [...runtime.modelProfile.enabledDomains],
      },
      comparison: comparisonFrom(base, scenario),
      outputs: {
        base,
        scenario,
        layers: derivedLayers(id, base, scenario),
        alerts: scenario.alertasActivas,
        recommendations: scenario.recomendacionesGestion,
      },
      uncertainty: {
        type: 'PARAMETRIC_RULES_DEMO',
        confidencePct: runtime.quality.syntheticDemoData ? 0 : 65,
        note: runtime.quality.syntheticDemoData
          ? 'Resultados producidos con reglas paramétricas y datos sintéticos; no constituyen una predicción real calibrada.'
          : 'Resultados paramétricos pendientes de calibración frente a históricos observados del destino.',
      },
      evidence: {
        contextPackageId: runtime.contextPackageId,
        contextFingerprint: runtime.fingerprint.value,
        contextVersion: runtime.fingerprint.contextVersion,
        origin: runtime.origin,
        quality: clone(runtime.quality),
        inputEntityCounts: { zones: runtime.zones.length, resources: runtime.resources.length, sensors: runtime.sensors.length },
        sources: runtime.sources.map(source => ({
          id: source.id,
          name: source.name,
          traceabilityId: source.traceabilityId,
          dataQuality: source.dataQuality,
          authorization: source.authorization,
        })),
        persistence: 'MEMORY_DEMO_NOT_PERSISTED',
      },
    };
    this.runs.set(id, clone(run));
    // Persistir en PostGIS
    postgisRepository.persistSimulationRun(run, runtime.tenant.id, runtime.destination.id).catch(err => {
      console.warn('[SimulationRunService] PostGIS persist warning:', err);
    });
    return { valid: true, run: clone(run), errors: [] };
  }

  list(destinationId: string): SimulationRun[] {
    return Array.from(this.runs.values()).filter(run => run.destinationId === destinationId).map(clone);
  }

  get(runIdValue: string, destinationId: string): SimulationRun | undefined {
    const run = this.runs.get(runIdValue);
    return run && run.destinationId === destinationId ? clone(run) : undefined;
  }

  exportGeoJson(runIdValue: string, destinationId: string) {
    const run = this.get(runIdValue, destinationId);
    if (!run) return undefined;
    return {
      type: 'FeatureCollection' as const,
      resultKind: 'SIMULATION_DERIVED' as const,
      runId: run.id,
      destinationId: run.destinationId,
      features: [...run.outputs.layers.zones.features, ...run.outputs.layers.resources.features, ...run.outputs.layers.sensors.features],
    };
  }
}

export const SimulationRunService = new SimulationRunRegistry();
