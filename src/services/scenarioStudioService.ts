import { DestinationRuntimeService } from './destinationRuntimeService';
import { SimulationRunService } from './simulationRunService';
import { postgisRepository } from './postgisRepository';
import {
  ScenarioDefinition,
  ScenarioDraftInput,
  ScenarioExecution,
  ScenarioStatus,
  ScenarioValidationIssue,
  ScenarioValidationReport,
  scenarioToRuntimeBinding,
} from '../types/scenarioStudio';

interface ScenarioOperationResult {
  valid: boolean;
  scenario?: ScenarioDefinition;
  report: ScenarioValidationReport;
  error?: string;
}

const scenarios = new Map<string, ScenarioDefinition>();
const scenarioVersions = new Map<string, ScenarioDefinition[]>();
const allowedTypes = new Set(['CRUCERO_MASIVO', 'EVENTO_CULTURAL', 'EPISODIO_METEO', 'CORTE_ACCESO', 'PERSONALIZADO']);
const allowedClimate = new Set(['DESPEJADO', 'LLUVIA', 'CALOR_EXTREMO']);
const allowedMobility = new Set(['NORMAL', 'RESTRINGIDA', 'REFORZADA']);
const allowedDistribution = new Set(['UNIFORME', 'CONCENTRADA', 'REDISTRIBUIDA']);

const issue = (code: string, path: string, message: string): ScenarioValidationIssue => ({ code, path, message });
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function destinationRuntime(destinationId: string) {
  const resolved = DestinationRuntimeService.resolve(destinationId);
  return resolved.report.valid ? resolved.runtime : undefined;
}

function tenantFor(destinationId: string) {
  return destinationRuntime(destinationId)?.tenant.id || 'tenant-unresolved';
}

function validationReport(input: ScenarioDraftInput | ScenarioDefinition, options: { existingId?: string; allowArchived?: boolean } = {}): ScenarioValidationReport {
  const errors: ScenarioValidationIssue[] = [];
  const warnings: ScenarioValidationIssue[] = [];
  const runtime = destinationRuntime(input.destinationId);
  const { inputs } = input;

  if (!runtime) errors.push(issue('DESTINATION_UNKNOWN', 'destinationId', 'El destino no existe o todavía no se ha dado de alta mediante ContextPackage.'));
  if (runtime && input.tenantId && input.tenantId !== runtime.tenant.id) {
    errors.push(issue('TENANT_DESTINATION_SCOPE_INVALID', 'tenantId', 'El tenant del borrador no corresponde al destino seleccionado.'));
  }
  if (!input.name?.trim() || input.name.trim().length < 3 || input.name.trim().length > 100) {
    errors.push(issue('NAME_INVALID', 'name', 'El nombre debe tener entre 3 y 100 caracteres.'));
  }
  if (!input.description?.trim() || input.description.trim().length < 8 || input.description.trim().length > 500) {
    errors.push(issue('DESCRIPTION_INVALID', 'description', 'La descripción debe tener entre 8 y 500 caracteres.'));
  }
  if (!allowedTypes.has(input.type)) errors.push(issue('TYPE_INVALID', 'type', 'Tipo de escenario no soportado.'));
  if (!input.createdBy?.trim() || input.createdBy.trim().length > 120) errors.push(issue('AUTHOR_INVALID', 'createdBy', 'Debe declarar el autor y no puede exceder 120 caracteres.'));
  if (!inputs || typeof inputs !== 'object') {
    errors.push(issue('INPUTS_REQUIRED', 'inputs', 'El escenario requiere parámetros de entrada.'));
  } else {
    if (!Array.isArray(inputs.zoneIds) || inputs.zoneIds.length === 0) errors.push(issue('ZONES_REQUIRED', 'inputs.zoneIds', 'Seleccione al menos una zona afectada.'));
    if (Array.isArray(inputs.zoneIds) && new Set(inputs.zoneIds).size !== inputs.zoneIds.length) errors.push(issue('ZONES_DUPLICATED', 'inputs.zoneIds', 'Las zonas afectadas no pueden repetirse.'));
    if (runtime && Array.isArray(inputs.zoneIds)) {
      const availableZoneIds = new Set(runtime.zones.map(zone => zone.id));
      inputs.zoneIds.forEach((zoneId, index) => {
        if (!availableZoneIds.has(zoneId)) errors.push(issue('ZONE_NOT_IN_DESTINATION', `inputs.zoneIds[${index}]`, 'La zona no pertenece al destino del escenario.'));
      });
    }
    if (!Number.isInteger(inputs.hour) || inputs.hour < 0 || inputs.hour > 23) errors.push(issue('HOUR_INVALID', 'inputs.hour', 'La hora debe ser un entero entre 0 y 23.'));
    if (!allowedClimate.has(inputs.climate)) errors.push(issue('CLIMATE_INVALID', 'inputs.climate', 'Seleccione una condición meteorológica autorizada.'));
    if (!Number.isFinite(inputs.visitorVariationPct) || inputs.visitorVariationPct < -50 || inputs.visitorVariationPct > 100) errors.push(issue('VISITOR_VARIATION_INVALID', 'inputs.visitorVariationPct', 'La variación de visitantes debe estar entre -50% y +100%.'));
    if (!Number.isFinite(inputs.operationalCapacityPct) || inputs.operationalCapacityPct < 50 || inputs.operationalCapacityPct > 120) errors.push(issue('CAPACITY_INVALID', 'inputs.operationalCapacityPct', 'La capacidad operativa debe estar entre 50% y 120%.'));
    if (!allowedMobility.has(inputs.mobilityMode)) errors.push(issue('MOBILITY_INVALID', 'inputs.mobilityMode', 'Seleccione una modalidad de movilidad autorizada.'));
    if (!Number.isFinite(inputs.alertThresholdPct) || inputs.alertThresholdPct < 60 || inputs.alertThresholdPct > 100) errors.push(issue('ALERT_THRESHOLD_INVALID', 'inputs.alertThresholdPct', 'El umbral de alerta debe estar entre 60% y 100%.'));
    if (!Number.isFinite(inputs.intensity) || inputs.intensity < 0 || inputs.intensity > 1.5) errors.push(issue('INTENSITY_INVALID', 'inputs.intensity', 'La intensidad debe estar entre 0 y 1,5.'));
    if (!allowedDistribution.has(inputs.spatialDistribution)) errors.push(issue('DISTRIBUTION_INVALID', 'inputs.spatialDistribution', 'Seleccione una distribución espacial autorizada.'));
    if (inputs.eventLabel && inputs.eventLabel.length > 120) errors.push(issue('EVENT_LABEL_INVALID', 'inputs.eventLabel', 'La etiqueta de evento no puede superar 120 caracteres.'));
    if (inputs.notes && inputs.notes.length > 1000) errors.push(issue('NOTES_INVALID', 'inputs.notes', 'Las notas no pueden superar 1.000 caracteres.'));
    if (input.type === 'EVENTO_CULTURAL' && !inputs.eventLabel?.trim()) warnings.push(issue('EVENT_LABEL_RECOMMENDED', 'inputs.eventLabel', 'Se recomienda identificar el evento para mejorar la trazabilidad.'));
    if (inputs.operationalCapacityPct < 80) warnings.push(issue('CAPACITY_REDUCTION', 'inputs.operationalCapacityPct', 'La capacidad operativa reducida puede elevar la saturación incluso con afluencia estable.'));
    if (inputs.spatialDistribution === 'CONCENTRADA' && inputs.zoneIds.length > 1) warnings.push(issue('CONCENTRATED_MULTIZONE', 'inputs.spatialDistribution', 'La concentración se aplicará sobre todas las zonas seleccionadas.'));
  }

  if ('status' in input && input.status === 'ARCHIVADO' && !options.allowArchived) {
    errors.push(issue('ARCHIVED_SCENARIO', 'status', 'No se puede modificar, validar ni ejecutar un escenario archivado. Duplíquelo para reutilizarlo.'));
  }

  return { valid: errors.length === 0, errors, warnings, validatedAt: now() };
}

function toDefinition(input: ScenarioDraftInput, id: string, version: number, status: ScenarioStatus, previous?: ScenarioDefinition): ScenarioDefinition {
  const timestamp = now();
  return {
    id,
    destinationId: input.destinationId,
    tenantId: tenantFor(input.destinationId),
    name: input.name.trim(),
    description: input.description.trim(),
    type: input.type,
    status,
    version,
    createdBy: input.createdBy.trim(),
    createdAt: previous?.createdAt || timestamp,
    updatedAt: timestamp,
    validatedAt: status === 'VALIDADO' || status === 'EJECUTADO' ? timestamp : previous?.validatedAt,
    executedAt: previous?.executedAt,
    archivedAt: status === 'ARCHIVADO' ? timestamp : undefined,
    executionCount: previous?.executionCount || 0,
    inputs: clone(input.inputs),
  };
}

function storeVersionSnapshot(scenario: ScenarioDefinition) {
  const current = scenarioVersions.get(scenario.id) || [];
  scenarioVersions.set(scenario.id, [...current.filter(item => item.version !== scenario.version), clone(scenario)]);
  // Persistir en PostGIS de forma transparente
  postgisRepository.persistScenario(scenario, scenario.tenantId).catch(err => {
    console.warn('[ScenarioStudioService] PostGIS persist warning:', err);
  });
}

export class ScenarioStudioService {
  static list(destinationId: string, includeArchived = false): ScenarioDefinition[] {
    return Array.from(scenarios.values())
      .filter(scenario => scenario.destinationId === destinationId && (includeArchived || scenario.status !== 'ARCHIVADO'))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  static get(id: string, destinationId: string): ScenarioDefinition | undefined {
    const scenario = scenarios.get(id);
    return scenario?.destinationId === destinationId ? clone(scenario) : undefined;
  }

  static versions(id: string, destinationId: string): ScenarioDefinition[] | undefined {
    const scenario = scenarios.get(id);
    if (!scenario || scenario.destinationId !== destinationId) return undefined;
    return (scenarioVersions.get(id) || []).map(clone).sort((left, right) => right.version - left.version);
  }

  static create(input: ScenarioDraftInput): ScenarioOperationResult {
    const report = validationReport(input);
    if (!report.valid) return { valid: false, report };
    const id = `esc-${input.destinationId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const scenario = toDefinition(input, id, 1, 'BORRADOR');
    scenarios.set(id, scenario);
    storeVersionSnapshot(scenario);
    return { valid: true, scenario: clone(scenario), report };
  }

  static update(id: string, destinationId: string, input: ScenarioDraftInput): ScenarioOperationResult {
    const current = scenarios.get(id);
    if (!current || current.destinationId !== destinationId) return { valid: false, report: { valid: false, errors: [issue('SCENARIO_NOT_FOUND', 'id', 'Escenario no encontrado para el destino indicado.')], warnings: [], validatedAt: now() } };
    const report = validationReport({ ...input, status: current.status }, { existingId: id });
    if (!report.valid) return { valid: false, report };
    const scenario = toDefinition(input, id, current.version + 1, 'BORRADOR', current);
    scenarios.set(id, scenario);
    storeVersionSnapshot(scenario);
    return { valid: true, scenario: clone(scenario), report };
  }

  static validate(id: string, destinationId: string): ScenarioOperationResult {
    const current = scenarios.get(id);
    if (!current || current.destinationId !== destinationId) return { valid: false, report: { valid: false, errors: [issue('SCENARIO_NOT_FOUND', 'id', 'Escenario no encontrado para el destino indicado.')], warnings: [], validatedAt: now() } };
    const report = validationReport(current);
    if (!report.valid) return { valid: false, scenario: clone(current), report };
    const scenario: ScenarioDefinition = { ...current, status: 'VALIDADO', validatedAt: now(), updatedAt: now() };
    scenarios.set(id, scenario);
    return { valid: true, scenario: clone(scenario), report };
  }

  static duplicate(id: string, destinationId: string, createdBy?: string): ScenarioOperationResult {
    const current = scenarios.get(id);
    if (!current || current.destinationId !== destinationId) return { valid: false, report: { valid: false, errors: [issue('SCENARIO_NOT_FOUND', 'id', 'Escenario no encontrado para el destino indicado.')], warnings: [], validatedAt: now() } };
    const draft: ScenarioDraftInput = {
      destinationId,
      tenantId: current.tenantId,
      name: `Copia de ${current.name}`.slice(0, 100),
      description: current.description,
      type: current.type,
      createdBy: createdBy?.trim() || current.createdBy,
      inputs: clone(current.inputs),
    };
    return this.create(draft);
  }

  static archive(id: string, destinationId: string): ScenarioOperationResult {
    const current = scenarios.get(id);
    if (!current || current.destinationId !== destinationId) return { valid: false, report: { valid: false, errors: [issue('SCENARIO_NOT_FOUND', 'id', 'Escenario no encontrado para el destino indicado.')], warnings: [], validatedAt: now() } };
    const scenario: ScenarioDefinition = { ...current, status: 'ARCHIVADO', archivedAt: now(), updatedAt: now() };
    const report = validationReport(scenario, { allowArchived: true });
    scenarios.set(id, scenario);
    return { valid: true, scenario: clone(scenario), report };
  }

  static execute(id: string, destinationId: string): { valid: boolean; execution?: ScenarioExecution; report: ScenarioValidationReport } {
    const current = scenarios.get(id);
    if (!current || current.destinationId !== destinationId) return { valid: false, report: { valid: false, errors: [issue('SCENARIO_NOT_FOUND', 'id', 'Escenario no encontrado para el destino indicado.')], warnings: [], validatedAt: now() } };
    const report = validationReport(current);
    if (!report.valid) return { valid: false, report };
    const binding = scenarioToRuntimeBinding(current);
    const runResult = SimulationRunService.execute({
      destinationId,
      scenario: binding.scenario,
      parameters: binding.parameters,
      actor: current.createdBy,
      scenarioDefinitionId: current.id,
      scenarioVersion: current.version,
    });
    if (!runResult.valid || !runResult.run) {
      return { valid: false, report: { valid: false, errors: runResult.errors.map(item => issue(item.code, item.path, item.message)), warnings: [], validatedAt: now() } };
    }
    const scenario: ScenarioDefinition = {
      ...current,
      status: 'EJECUTADO',
      validatedAt: current.validatedAt || now(),
      executedAt: now(),
      updatedAt: now(),
      executionCount: current.executionCount + 1,
    };
    scenarios.set(id, scenario);
    return {
      valid: true,
      report,
      execution: {
        scenario: clone(scenario),
        report,
        simulation: runResult.run.outputs.scenario,
        run: runResult.run,
        parameters: binding.parameters,
        evidence: {
          scenarioVersion: scenario.version,
          engine: 'MOTOR_CONTEXTO_SIMULACION_MVP',
          persistence: 'MEMORY_DEMO_NOT_PERSISTED',
          base: 'SITUACION_OBSERVADA_DEL_CONTEXTO',
          comparison: 'BASE_ESCENARIO_DELTA',
        },
      },
    };
  }
}
