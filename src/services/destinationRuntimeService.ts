import { DESTINOS_DEMO, RECURSOS_DEMO, SENSORES_DEMO, ZONAS_DEMO } from '../data/demoData';
import { createHash } from 'crypto';
import { ContextPackageService } from './contextPackageService';
import { MultiDestinationModel } from './multiDestinationModel';
import {
  DestinationRuntime,
  RuntimeResolution,
  RuntimeValidationIssue,
  RuntimeValidationReport,
} from '../types/destinationRuntime';
import { ContextPackageDataSource, ContextPackageV1 } from '../types/contextPackage';

const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const issue = (code: string, path: string, message: string): RuntimeValidationIssue => ({ code, path, message });

function fingerprint(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function sourceFromGovernance(id: string, name: string, governance: { tipoFuente: string; calidad: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION'; frecuenciaActualizacion: 'TIEMPO_REAL' | 'HORARIA' | 'DIARIA' | 'MENSUAL'; trazabilidadId: string }): ContextPackageDataSource {
  return {
    id,
    name,
    lane: 'ONTOLOGICO',
    format: 'REST_JSON',
    updateFrequency: governance.frecuenciaActualizacion,
    dataQuality: governance.calidad,
    privacy: 'PUBLICO',
    authorization: 'AUTORIZADO',
    purpose: 'Catálogo demostrador del Gemelo Digital Turístico PID.',
    traceabilityId: governance.trazabilidadId,
  };
}

function qualityRank(level: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION') {
  return level === 'C_EN_VALIDACION' ? 3 : level === 'B_ESTIMADA' ? 2 : 1;
}

function qualityFromSources(sources: ContextPackageDataSource[], syntheticDemoData: boolean, cutOffDate: string) {
  const level = sources.reduce<'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION'>((current, source) => (
    qualityRank(source.dataQuality) > qualityRank(current) ? source.dataQuality : current
  ), 'A_CERTIFICADA');
  return {
    level,
    syntheticDemoData,
    sourceCount: sources.length,
    pendingAuthorizationCount: sources.filter(source => source.authorization === 'PENDIENTE').length,
    cutOffDate,
  };
}

function profileForCatalog(destination: (typeof DESTINOS_DEMO)[number]) {
  const semanticProfile = MultiDestinationModel.getProfile(destination.id);
  const theoreticalCapacity = destination.capacidadCargaMaximaTeorica;
  return {
    id: semanticProfile?.id || `runtime-profile-${destination.id}`,
    name: semanticProfile ? `Perfil operacional ${semanticProfile.destinationName}` : 'Perfil operacional demostrador',
    version: '1.0.0',
    enabledDomains: semanticProfile?.enabledDomains || ['turismo', 'movilidad', 'medio_ambiente'],
    activeSpatialLevel: semanticProfile?.activeSpatialLevel || 'NIVEL_1_2D_25D' as const,
    capacityProfile: { alertThresholdPct: 85, theoreticalCapacity },
  };
}

function buildCatalogRuntime(destinationId: string): DestinationRuntime | undefined {
  const destination = DESTINOS_DEMO.find(item => item.id === destinationId);
  if (!destination) return undefined;
  const zones = ZONAS_DEMO.filter(item => item.destinoId === destinationId);
  const resources = RECURSOS_DEMO.filter(item => item.destinoId === destinationId);
  const sensors = SENSORES_DEMO.filter(item => item.destinoId === destinationId);
  const firstGovernance = zones[0]?.gobernanza || resources[0]?.gobernanza || sensors[0]?.gobernanza;
  const sources = firstGovernance ? [sourceFromGovernance(`catalog-${destinationId}`, 'Catálogo demostrador', firstGovernance)] : [];
  const modelProfile = profileForCatalog(destination);
  const semanticProfile = MultiDestinationModel.getProfile(destinationId);
  const cutOffDate = firstGovernance?.ultimaActualizacion || '1970-01-01T00:00:00.000Z';
  return {
    id: `runtime-${destinationId}`,
    destination: clone(destination),
    tenant: semanticProfile
      ? { id: semanticProfile.tenantId, legalName: semanticProfile.tenantName, dataPolicy: semanticProfile.dataPolicy }
      : { id: 'tenant-demo', legalName: 'Entorno demostrador PID', dataPolicy: 'PUBLICA' },
    origin: 'DEMO_CATALOG',
    modelProfile,
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
    zones: clone(zones),
    resources: clone(resources),
    sensors: clone(sensors),
    sources,
    quality: qualityFromSources(sources, true, cutOffDate),
    fingerprint: {
      algorithm: 'sha256',
      value: fingerprint([{ destination, tenant: semanticProfile?.tenantId, zones, resources, sensors, sources, quality: qualityFromSources(sources, true, cutOffDate), modelProfile }]),
      contextVersion: 'demo-catalog-v1',
    },
  };
}

function buildContextPackageRuntime(contextPackage: ContextPackageV1): DestinationRuntime {
  const { destination, tenant, context, evidence } = contextPackage;
  return {
    id: `runtime-${destination.id}`,
    destination: clone(destination),
    tenant: clone(tenant),
    origin: 'CONTEXT_PACKAGE_V1',
    contextPackageId: contextPackage.id,
    modelProfile: clone(context.modelProfile),
    timezone: context.timezone,
    locale: context.locale,
    zones: clone(context.zones),
    resources: clone(context.resources),
    sensors: clone(context.sensors),
    sources: clone(context.dataSources),
    quality: qualityFromSources(context.dataSources, evidence.syntheticDemoData, evidence.cutOffDate),
    fingerprint: {
      algorithm: 'sha256',
      value: fingerprint([{ id: contextPackage.id, schemaVersion: contextPackage.schemaVersion, tenant, destination, evidence, sources: context.dataSources, zones: context.zones, resources: context.resources, sensors: context.sensors, modelProfile: context.modelProfile }]),
      contextVersion: contextPackage.schemaVersion,
    },
  };
}

function validateRuntime(runtime: DestinationRuntime): RuntimeValidationReport {
  const errors: RuntimeValidationIssue[] = [];
  const warnings: RuntimeValidationIssue[] = [];
  const expectedDestinationId = runtime.destination.id;
  if (!expectedDestinationId) errors.push(issue('RUNTIME_DESTINATION_REQUIRED', 'destination.id', 'El runtime necesita un destino identificado.'));
  if (!runtime.tenant.id) errors.push(issue('RUNTIME_TENANT_REQUIRED', 'tenant.id', 'El runtime necesita un tenant identificado.'));
  if (!runtime.zones.length) errors.push(issue('RUNTIME_ZONES_REQUIRED', 'zones', 'El runtime necesita al menos una zona para simular.'));
  if (runtime.zones.some(zone => zone.destinoId !== expectedDestinationId)) errors.push(issue('RUNTIME_ZONE_SCOPE_INVALID', 'zones', 'Todas las zonas deben pertenecer al destino del runtime.'));
  if (runtime.resources.some(resource => resource.destinoId !== expectedDestinationId)) errors.push(issue('RUNTIME_RESOURCE_SCOPE_INVALID', 'resources', 'Todos los recursos deben pertenecer al destino del runtime.'));
  if (runtime.sensors.some(sensor => sensor.destinoId !== expectedDestinationId)) errors.push(issue('RUNTIME_SENSOR_SCOPE_INVALID', 'sensors', 'Todos los sensores deben pertenecer al destino del runtime.'));
  if (runtime.zones.some(zone => zone.aforoMaximo <= 0)) errors.push(issue('RUNTIME_CAPACITY_INVALID', 'zones.aforoMaximo', 'Cada zona requiere un aforo positivo.'));
  if (runtime.sources.some(source => source.authorization === 'NO_AUTORIZADO')) errors.push(issue('RUNTIME_SOURCE_UNAUTHORIZED', 'sources', 'No se puede ejecutar con fuentes no autorizadas.'));
  if (!runtime.sources.length) warnings.push(issue('RUNTIME_SOURCE_METADATA_EMPTY', 'sources', 'No hay metadatos de fuentes; el resultado debe tratarse como demostración.'));
  if (runtime.quality.syntheticDemoData) warnings.push(issue('RUNTIME_SYNTHETIC_DATA', 'quality.syntheticDemoData', 'El runtime usa datos sintéticos y no representa observación municipal real.'));
  if (runtime.quality.pendingAuthorizationCount > 0) warnings.push(issue('RUNTIME_PENDING_AUTHORIZATION', 'sources', 'Hay fuentes pendientes de autorización para un piloto productivo.'));
  return { valid: errors.length === 0, errors, warnings, checkedAt: now() };
}

class DestinationRuntimeRegistry {
  resolve(destinationId: string): RuntimeResolution {
    const contextPackage = ContextPackageService.getByDestination(destinationId);
    const runtime = contextPackage ? buildContextPackageRuntime(contextPackage) : buildCatalogRuntime(destinationId);
    if (!runtime) {
      return { runtime: undefined, report: { valid: false, errors: [issue('RUNTIME_NOT_FOUND', 'destinationId', 'No existe un contexto ejecutable para el destino solicitado.')], warnings: [], checkedAt: now() } };
    }
    return { runtime, report: validateRuntime(runtime) };
  }

  list(): DestinationRuntime[] {
    return ContextPackageService.getDestinations()
      .map(destination => this.resolve(destination.id).runtime)
      .filter((runtime): runtime is DestinationRuntime => Boolean(runtime))
      .map(clone);
  }

  validate(destinationId: string): RuntimeValidationReport {
    return this.resolve(destinationId).report;
  }
}

export const DestinationRuntimeService = new DestinationRuntimeRegistry();
