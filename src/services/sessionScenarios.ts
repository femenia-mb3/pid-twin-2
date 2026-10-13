// Escenarios de sesión: se crean en el navegador (catálogo, paquete YAML o editor visual)
// y viven solo en el estado de React. No se envían al servidor ni se guardan: al recargar desaparecen.

import { ScenarioDefinition, ScenarioDraftInput, ScenarioInputs, ScenarioClimate, MobilityMode } from '../types/scenarioStudio';
import { SimulationModelPackageV1 } from '../types/simulationModelPackage';

export const SESSION_SCENARIO_PREFIX = 'sesion-';

export const isSessionScenarioId = (id: string): boolean => id.startsWith(SESSION_SCENARIO_PREFIX);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function createSessionScenario(draft: ScenarioDraftInput): ScenarioDefinition {
  const now = new Date().toISOString();
  const inputs: ScenarioInputs = {
    ...draft.inputs,
    hour: clamp(Math.round(draft.inputs.hour), 0, 23),
    visitorVariationPct: clamp(draft.inputs.visitorVariationPct, -90, 300),
    operationalCapacityPct: clamp(draft.inputs.operationalCapacityPct, 10, 150),
    alertThresholdPct: clamp(draft.inputs.alertThresholdPct, 10, 150),
    intensity: clamp(draft.inputs.intensity, 0, 2),
  };
  return {
    id: `${SESSION_SCENARIO_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    destinationId: draft.destinationId,
    tenantId: draft.tenantId || '',
    name: draft.name.trim() || 'Simulación sin título',
    description: draft.description.trim() || 'Simulación creada en esta sesión.',
    type: draft.type,
    status: 'VALIDADO',
    version: 1,
    createdBy: draft.createdBy,
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
    executionCount: 0,
    inputs,
    sourceModelId: draft.sourceModelId,
  };
}

/**
 * Ajustes propios de cada plantilla del catálogo al añadirla al panel.
 * Movilidad y ZBE concentra más visitantes en el casco histórico (centro), con al menos +25 %.
 */
export function applyModelProfile(draft: ScenarioDraftInput, modelId: string, centroZoneIds: string[]): ScenarioDraftInput {
  if (modelId !== 'modelo_movilidad') return { ...draft, sourceModelId: modelId };
  return {
    ...draft,
    sourceModelId: modelId,
    inputs: {
      ...draft.inputs,
      zoneIds: Array.from(new Set([...draft.inputs.zoneIds, ...centroZoneIds])),
      visitorVariationPct: Math.max(draft.inputs.visitorVariationPct, 25),
      spatialDistribution: 'CONCENTRADA',
    },
  };
}

const CLIMAS: ScenarioClimate[] = ['DESPEJADO', 'LLUVIA', 'CALOR_EXTREMO'];
const MOVILIDADES: MobilityMode[] = ['NORMAL', 'RESTRINGIDA', 'REFORZADA'];

/**
 * Convierte un paquete de modelo (YAML/JSON validado) en un escenario de sesión.
 * Convenciones por id de variable: umbral, capacidad, hora, clima, intensidad, movilidad,
 * variacion o incremento (en %), y visitantes o afluencia (escalado dentro de su rango min–max).
 * Las reglas MULTIPLY/ADD sobre variables de visitantes también ajustan la variación.
 */
export function packageToSessionScenario(
  pkg: SimulationModelPackageV1,
  destinationId: string,
  tenantId: string,
  zoneIds: string[],
): { scenario: ScenarioDefinition; applied: string[] } {
  const applied: string[] = [];
  const inputs: ScenarioInputs = {
    zoneIds,
    hour: 12,
    climate: 'DESPEJADO',
    visitorVariationPct: 0,
    operationalCapacityPct: 100,
    mobilityMode: 'NORMAL',
    alertThresholdPct: 85,
    intensity: 1,
    spatialDistribution: 'CONCENTRADA',
    eventLabel: pkg.name,
    notes: `Paquete ${pkg.id} v${pkg.version}. ${pkg.summary}`,
  };

  for (const variable of pkg.variables) {
    const id = variable.id.toLowerCase();
    const num = Number(variable.defaultValue);
    const text = String(variable.defaultValue).toUpperCase();
    if (/umbral/.test(id) && Number.isFinite(num)) {
      inputs.alertThresholdPct = num;
      applied.push(`${variable.label} → umbral de alerta ${num} %`);
    } else if (/capacidad/.test(id) && Number.isFinite(num)) {
      inputs.operationalCapacityPct = num;
      applied.push(`${variable.label} → capacidad operativa ${num} %`);
    } else if (/^hora|horario|franja/.test(id) && Number.isFinite(num)) {
      inputs.hour = num;
      applied.push(`${variable.label} → hora ${num}:00`);
    } else if (/clima|meteo/.test(id) && CLIMAS.includes(text as ScenarioClimate)) {
      inputs.climate = text as ScenarioClimate;
      applied.push(`${variable.label} → clima ${text}`);
    } else if (/movilidad/.test(id) && MOVILIDADES.includes(text as MobilityMode)) {
      inputs.mobilityMode = text as MobilityMode;
      applied.push(`${variable.label} → movilidad ${text}`);
    } else if (/intensidad|factor/.test(id) && Number.isFinite(num)) {
      inputs.intensity = num;
      applied.push(`${variable.label} → intensidad ${num}`);
    } else if (/variacion|incremento/.test(id) && Number.isFinite(num)) {
      inputs.visitorVariationPct = num;
      applied.push(`${variable.label} → variación de visitantes ${num} %`);
    } else if (/visitantes|afluencia|llegadas|pasajeros/.test(id) && Number.isFinite(num)
      && variable.min !== undefined && variable.max !== undefined && variable.max > variable.min) {
      const pct = Math.round(((num - variable.min) / (variable.max - variable.min)) * 60);
      inputs.visitorVariationPct = pct;
      applied.push(`${variable.label} (${num}) → variación de visitantes +${pct} % (escala 0–60 % sobre su rango)`);
    }
  }

  for (const rule of pkg.declarativeRules) {
    if (!/visitantes|afluencia|llegadas|pasajeros/i.test(rule.impactVariable)) continue;
    if (rule.operator === 'MULTIPLY') {
      inputs.visitorVariationPct = Math.round(((1 + inputs.visitorVariationPct / 100) * rule.value - 1) * 100);
      applied.push(`Regla «${rule.name}» → ×${rule.value} sobre visitantes`);
    } else if (rule.operator === 'ADD') {
      inputs.visitorVariationPct += rule.value;
      applied.push(`Regla «${rule.name}» → ${rule.value >= 0 ? '+' : ''}${rule.value} % de visitantes`);
    }
  }

  const scenario = createSessionScenario({
    destinationId,
    tenantId,
    name: pkg.name,
    description: `${pkg.summary} (paquete ${pkg.id} v${pkg.version})`,
    type: 'PERSONALIZADO',
    createdBy: `Paquete de modelo subido (${pkg.evidence?.responsibleAuthor || 'usuario'})`,
    inputs,
  });
  return { scenario, applied };
}
