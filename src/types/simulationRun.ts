import { ParametrosDestinoConfigurables, ResultadoSimulacion } from '../engine/simulationEngine';
import { DestinationRuntime, RuntimeDataQuality } from './destinationRuntime';
import { EscenarioSimulacion, IndicadoresDestino } from './ontology';

export interface SimulationIndicatorDelta {
  visitantesEnDestino: number;
  variacionVsMedia: number;
  saturacionGlobalPct: number;
  emisionesCo2KgHora: number;
  ruidoMedioDb: number;
  distritosSaturadosCount: number;
  alertasActivasCount: number;
}

export interface SimulationComparison {
  base: IndicadoresDestino;
  scenario: IndicadoresDestino;
  delta: SimulationIndicatorDelta;
}

export interface DerivedGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  resultKind: 'SIMULATION_DERIVED';
  layer: 'zones' | 'resources' | 'sensors';
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'Polygon'; coordinates: [number, number][][] };
    properties: Record<string, unknown>;
  }>;
}

export interface SimulationRunLayers {
  zones: DerivedGeoJsonFeatureCollection;
  resources: DerivedGeoJsonFeatureCollection;
  sensors: DerivedGeoJsonFeatureCollection;
}

export interface SimulationRunModel {
  id: string;
  name: string;
  version: string;
  domains: string[];
}

export interface SimulationRunEvidence {
  contextPackageId?: string;
  contextFingerprint: string;
  contextVersion: string;
  origin: DestinationRuntime['origin'];
  quality: RuntimeDataQuality;
  inputEntityCounts: { zones: number; resources: number; sensors: number };
  sources: Array<{ id: string; name: string; traceabilityId: string; dataQuality: string; authorization: string }>;
  persistence: 'MEMORY_DEMO_NOT_PERSISTED' | 'POSTGIS_PERSISTED';
}

export interface SimulationUncertainty {
  type: 'PARAMETRIC_RULES_DEMO';
  confidencePct: number;
  note: string;
}

export interface SimulationRun {
  id: string;
  type: 'SimulationRun';
  status: 'COMPLETED';
  destinationId: string;
  tenantId: string;
  createdAt: string;
  actor: string;
  seed: string;
  scenario: EscenarioSimulacion;
  scenarioDefinitionId?: string;
  scenarioVersion?: number;
  parameters: ParametrosDestinoConfigurables;
  model: SimulationRunModel;
  comparison: SimulationComparison;
  outputs: {
    base: ResultadoSimulacion;
    scenario: ResultadoSimulacion;
    layers: SimulationRunLayers;
    alerts: EscenarioSimulacion['alertasGeneradas'];
    recommendations: string[];
  };
  uncertainty: SimulationUncertainty;
  evidence: SimulationRunEvidence;
}

export interface SimulationRunRequest {
  destinationId: string;
  scenario: EscenarioSimulacion;
  parameters: ParametrosDestinoConfigurables;
  actor?: string;
  scenarioDefinitionId?: string;
  scenarioVersion?: number;
  seed?: string;
}

export interface SimulationRunExecutionResult {
  valid: boolean;
  run?: SimulationRun;
  errors: Array<{ code: string; path: string; message: string }>;
}
