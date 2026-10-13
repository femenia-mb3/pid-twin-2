import { EscenarioSimulacion } from './ontology';
import { ParametrosDestinoConfigurables, ResultadoSimulacion } from '../engine/simulationEngine';
import { SimulationRun } from './simulationRun';

export type ScenarioStatus = 'BORRADOR' | 'VALIDADO' | 'EJECUTADO' | 'ARCHIVADO';
export type SpatialDistribution = 'UNIFORME' | 'CONCENTRADA' | 'REDISTRIBUIDA';
export type MobilityMode = 'NORMAL' | 'RESTRINGIDA' | 'REFORZADA';
export type ScenarioClimate = 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
export type ScenarioType = EscenarioSimulacion['tipo'];

export interface ScenarioInputs {
  zoneIds: string[];
  hour: number;
  climate: ScenarioClimate;
  visitorVariationPct: number;
  operationalCapacityPct: number;
  mobilityMode: MobilityMode;
  alertThresholdPct: number;
  intensity: number;
  spatialDistribution: SpatialDistribution;
  eventLabel?: string;
  notes?: string;
}

export interface ScenarioDefinition {
  id: string;
  destinationId: string;
  tenantId: string;
  name: string;
  description: string;
  type: ScenarioType;
  status: ScenarioStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string;
  executedAt?: string;
  archivedAt?: string;
  executionCount: number;
  inputs: ScenarioInputs;
}

export interface ScenarioDraftInput {
  destinationId: string;
  tenantId?: string;
  name: string;
  description: string;
  type: ScenarioType;
  createdBy: string;
  inputs: ScenarioInputs;
}

export interface ScenarioValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ScenarioValidationReport {
  valid: boolean;
  errors: ScenarioValidationIssue[];
  warnings: ScenarioValidationIssue[];
  validatedAt: string;
}

export interface ScenarioExecution {
  scenario: ScenarioDefinition;
  report: ScenarioValidationReport;
  simulation: ResultadoSimulacion;
  run: SimulationRun;
  parameters: ParametrosDestinoConfigurables;
  evidence: {
    scenarioVersion: number;
    engine: 'MOTOR_CONTEXTO_SIMULACION_MVP';
    persistence: 'MEMORY_DEMO_NOT_PERSISTED';
    base: 'SITUACION_OBSERVADA_DEL_CONTEXTO';
    comparison: 'BASE_ESCENARIO_DELTA';
  };
}

export interface ScenarioRuntimeBinding {
  scenario: EscenarioSimulacion;
  parameters: ParametrosDestinoConfigurables;
}

export const scenarioToRuntimeBinding = (definition: ScenarioDefinition): ScenarioRuntimeBinding => {
  const { inputs } = definition;
  const distributionMultiplier = inputs.spatialDistribution === 'CONCENTRADA'
    ? 1.2
    : inputs.spatialDistribution === 'REDISTRIBUIDA'
      ? 0.84
      : 1;
  const mobilityMultiplier = inputs.mobilityMode === 'RESTRINGIDA'
    ? 0.86
    : inputs.mobilityMode === 'REFORZADA'
      ? 1.08
      : 1;

  const impactZones = Object.fromEntries(
    inputs.zoneIds.map(zoneId => [zoneId, Number((distributionMultiplier * mobilityMultiplier).toFixed(3))]),
  );

  const alertas: EscenarioSimulacion['alertasGeneradas'] = [];
  if (inputs.mobilityMode === 'RESTRINGIDA') {
    alertas.push({
      tipo: 'BLOQUEO_ACCESO',
      severidad: 'MEDIA',
      mensaje: 'Movilidad restringida declarada por el operador en el escenario editable.',
    });
  }
  if (inputs.climate === 'LLUVIA' || inputs.climate === 'CALOR_EXTREMO') {
    alertas.push({
      tipo: 'METEO',
      severidad: 'MEDIA',
      mensaje: `Condición meteorológica declarada: ${inputs.climate.toLowerCase().replace('_', ' ')}.`,
    });
  }

  return {
    scenario: {
      id: definition.id,
      nombre: definition.name,
      descripcion: definition.description,
      tipo: definition.type,
      // La variación global se aplica una única vez mediante el parámetro
      // incrementoVisitantesManualPct del motor. Los impactos por zona solo
      // recogen la forma espacial declarada por el operador.
      factorAfluencia: 1,
      impactoZonas: impactZones,
      zonasAfectadas: inputs.zoneIds,
      rutasDesvioRecomendadas: [],
      alertasGeneradas: alertas,
    },
    parameters: {
      umbralSaturacionAlerta: inputs.alertThresholdPct,
      pesoCapacidadFisica: 0.6,
      pesoCapacidadPsicologica: 0.4,
      tasaEmisionKgCo2PorPersonaHora: 0.12,
      incrementoVisitantesManualPct: inputs.visitorVariationPct,
      franjaHoraria: `${String(inputs.hour).padStart(2, '0')}:00`,
      condicionClima: inputs.climate,
      horaSimulacion: inputs.hour,
      intensidadEscenario: inputs.intensity,
      factorCapacidadOperativa: inputs.operationalCapacityPct / 100,
      factorMovilidad: 1,
    },
  };
};

export const createScenarioDraft = (destinationId: string, tenantId = ''): ScenarioDraftInput => ({
  destinationId,
  tenantId,
  name: '',
  description: '',
  type: 'PERSONALIZADO',
  createdBy: 'Operador del destino',
  inputs: {
    zoneIds: [],
    hour: 12,
    climate: 'DESPEJADO',
    visitorVariationPct: 0,
    operationalCapacityPct: 100,
    mobilityMode: 'NORMAL',
    alertThresholdPct: 85,
    intensity: 1,
    spatialDistribution: 'UNIFORME',
    eventLabel: '',
    notes: '',
  },
});
