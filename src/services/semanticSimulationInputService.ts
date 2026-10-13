import crypto from 'node:crypto';
import { ZonaDestino } from '../types/ontology';
import { NormalizedContextObservation } from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';

export type SemanticInputUseMode =
  | 'CALIBRACION_APLICADA'
  | 'EVIDENCIA_OBSERVACIONAL_PARCIAL'
  | 'SIN_ENTRADAS_SEMANTICAS_ELEGIBLES';

export interface ZoneSemanticSignal {
  zoneId: string;
  sourceTypes: Array<'PID_S2' | 'IOT_MQTT'>;
  observationCount: number;
  latestObservedAt: string;
  observedVisitorCount: number;
  modelledZoneBaseline: number;
  signalCoveragePct: number;
}

export interface SemanticSimulationInputSnapshot {
  destinationId: string;
  tenantId: string;
  useMode: SemanticInputUseMode;
  usedForExecutionGate: boolean;
  calibrationApplied: boolean;
  calibrationRationale: string;
  observationCount: number;
  sourceTypes: Array<'PID_S2' | 'IOT_MQTT'>;
  latestObservedAt?: string;
  observationFingerprintsSha256: string[];
  evidenceFingerprintSha256: string;
  zoneSignals: ZoneSemanticSignal[];
  warnings: string[];
}

const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;

function isInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lon] = point;
  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const intersects = ((lonI > lon) !== (lonJ > lon))
      && (lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI);
    if (intersects) isInside = !isInside;
  }

  return isInside;
}

function latestDistinctSignals(
  observations: NormalizedContextObservation[]
): NormalizedContextObservation[] {
  const latestBySourceAndSensor = new Map<string, NormalizedContextObservation>();

  for (const observation of observations) {
    const key = `${observation.sourceType}:${observation.sensorUrn}:${observation.measurementConcept}`;
    const current = latestBySourceAndSensor.get(key);
    if (!current || new Date(observation.observedAt).getTime() > new Date(current.observedAt).getTime()) {
      latestBySourceAndSensor.set(key, observation);
    }
  }

  return [...latestBySourceAndSensor.values()];
}

/**
 * Obtiene una instantánea local, trazable y privada de la telemetría semántica.
 *
 * La capa no sustituye la afluencia territorial del modelo hasta que el destino
 * haya declarado un vínculo de cobertura (zona, unidad, alcance y transformación).
 * Aun así, se usa como compuerta de ejecución y evidencia observacional para que
 * el resultado nunca parezca calibrado con datos no declarados.
 */
export class SemanticSimulationInputService {
  public static async buildSnapshot(
    tenantId: string,
    destinationId: string,
    zones: ZonaDestino[],
    maximumAgeHours = 24
  ): Promise<SemanticSimulationInputSnapshot> {
    const now = Date.now();
    const allObservations = await postgisRepository.listContextObservations(tenantId, destinationId, { limit: 200 });
    const eligibleVisitorSignals = latestDistinctSignals(
      allObservations.filter(observation => {
        const observationAge = now - new Date(observation.observedAt).getTime();
        return observation.eligibleForSimulation
          && observation.validationStatus === 'VALIDADA'
          && observation.measurementConcept === 'visitorCount'
          && observation.unitCode === 'P1'
          && observationAge >= -HOURS_TO_MILLISECONDS
          && observationAge <= maximumAgeHours * HOURS_TO_MILLISECONDS;
      })
    );

    const byZone = new Map<string, NormalizedContextObservation[]>();
    for (const signal of eligibleVisitorSignals) {
      const zone = zones.find(candidate => isInsidePolygon(signal.coordinates, candidate.coordenadasPoligono));
      if (!zone) continue;
      const signals = byZone.get(zone.id) || [];
      signals.push(signal);
      byZone.set(zone.id, signals);
    }

    const zoneSignals = [...byZone.entries()].map(([zoneId, signals]) => {
      const zone = zones.find(candidate => candidate.id === zoneId)!;
      const observedVisitorCount = signals.reduce((total, signal) => total + signal.value, 0);
      const latestObservedAt = signals
        .map(signal => signal.observedAt)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

      return {
        zoneId,
        sourceTypes: [...new Set(signals.map(signal => signal.sourceType))],
        observationCount: signals.length,
        latestObservedAt,
        observedVisitorCount,
        modelledZoneBaseline: zone.afluenciaActual,
        signalCoveragePct: zone.afluenciaActual > 0
          ? Number(((observedVisitorCount / zone.afluenciaActual) * 100).toFixed(1))
          : 0
      };
    });

    const observationFingerprintsSha256 = eligibleVisitorSignals
      .map(observation => observation.fingerprintSha256)
      .sort();
    const latestObservedAt = eligibleVisitorSignals
      .map(observation => observation.observedAt)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
    const sourceTypes = [...new Set(eligibleVisitorSignals.map(observation => observation.sourceType))];

    const hasSignals = eligibleVisitorSignals.length > 0;
    const evidenceFingerprintSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify({ destinationId, tenantId, observationFingerprintsSha256, zoneSignals }))
      .digest('hex');

    return {
      destinationId,
      tenantId,
      useMode: hasSignals ? 'EVIDENCIA_OBSERVACIONAL_PARCIAL' : 'SIN_ENTRADAS_SEMANTICAS_ELEGIBLES',
      usedForExecutionGate: hasSignals,
      calibrationApplied: false,
      calibrationRationale: hasSignals
        ? 'Las observaciones S2/IoT se verificaron, deduplicaron por fuente/sensor y asociaron espacialmente como evidencia de entrada. No se altera la afluencia base mientras el destino no declare un vínculo de cobertura, unidad y transformación para calibración cuantitativa.'
        : 'No existen observaciones visitorCount validadas y vigentes para el destino dentro de la ventana de 24 horas.',
      observationCount: eligibleVisitorSignals.length,
      sourceTypes,
      latestObservedAt,
      observationFingerprintsSha256,
      evidenceFingerprintSha256,
      zoneSignals,
      warnings: hasSignals
        ? ['Cobertura observacional parcial: las señales se emplean como compuerta y evidencia, no como sustitución automática del estado territorial.', 'Los datos demostradores no validan precisión predictiva hasta contar con cobertura, históricos y calibración acordados por el destino.']
        : ['No hay señales semánticas elegibles para validar la ejecución local.']
    };
  }
}
