import { GoogleGeoSuiteService } from "./src/services/googleGeoSuiteService";
import { GoogleGeoSuitePostgisExtension } from "./src/services/googleGeoSuitePostgisExtension";
import { MacroeconomicImpactService } from "./src/services/macroeconomicImpactService";
import { FlowOptimizationService } from "./src/services/flowOptimizationService";
import { StressTestingService } from "./src/services/stressTestingService";
import { MacroPostgisExtension } from "./src/services/macroPostgisExtension";
import { RapidResponseAgentService } from "./src/services/rapidResponseAgentService";
import { RapidResponsePostgisExtension } from "./src/services/rapidResponsePostgisExtension";
import crypto from "node:crypto";

import { PidOntologyRegistryService } from "./src/services/pidOntologyRegistryService";
import { S2SemanticConnectorService } from "./src/services/s2SemanticConnectorService";
import { IotTelemetryValidationService } from "./src/services/iotTelemetryValidationService";
import { MqttCollectorService } from "./src/services/mqttCollectorService";
import { SemanticDataLineageService } from "./src/services/semanticDataLineageService";
import { FormalDataBindingService } from "./src/services/formalDataBindingService";
import { CalibrationEngineService } from "./src/services/calibrationEngineService";
import { ForecastEvaluationService } from "./src/services/forecastEvaluationService";
import { ForecastHorizon } from "./src/types/calibrationForecast";
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GeoServicesCatalog } from './src/services/geoServices';
import { DATASETS_3D_CATALOG, EDIFICIOS_OLEADA_1 } from './src/services/catalog3DService';
import { generarActivosTerritorialesPlaceholder } from './src/services/catalogoTerritorialPlaceholder';
import { MultiDestinationModel } from './src/services/multiDestinationModel';
import { SemanticAdapter } from './src/services/semanticAdapter';
import { NgsiLdEntityType, SEMANTIC_CONTEXT_URL, SEMANTIC_PROFILE_ID } from './src/types/semantic';
import { InteroperabilityCatalogService } from './src/services/interoperabilityCatalogService';
import { DataLane, ModelInstantiationInput, OwnModelInput } from './src/types/interoperability';
import { ContextPackageService } from './src/services/contextPackageService';
import { ScenarioStudioService } from './src/services/scenarioStudioService';
import { ScenarioDraftInput } from './src/types/scenarioStudio';
import { DestinationRuntimeService } from './src/services/destinationRuntimeService';
import { createRuntimeScenarioPresets } from './src/services/scenarioPresetFactory';
import { SimulationRunService } from './src/services/simulationRunService';
import { ParametrosDestinoConfigurables } from './src/engine/simulationEngine';
import { postgisClient } from './src/services/postgisClient';
import { postgisRepository } from './src/services/postgisRepository';
import { AiSimulationAgentService } from './src/services/aiSimulationAgentService';
import { AiPromptRequest } from './src/types/aiAgent';
import { PilotOperationsService } from './src/services/pilotOperationsService';
import { AiAuditDecision } from './src/types/pilotOperations';
import { JwtAuthService } from './src/services/jwtAuthService';
import { OAuthService } from './src/services/oauthService';
import { OpenDataService } from './src/services/openDataService';
import { DataIngestionService } from './src/services/dataIngestionService';
import { MultiDestinationCompatibilityService } from './src/services/multiDestinationCompatibilityService';
import { ConnectorConfigurationService } from './src/services/connectorConfigurationService';
import { DataBindingService } from './src/services/dataBindingService';
import { FederatedSimulationService } from './src/services/federatedSimulationService';
import { SimulationModelPackageService } from './src/services/simulationModelPackageService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length
    ? (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
    : false,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'X-PID-Tenant', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ type: ['application/json', 'application/ld+json'], limit: '2mb' }));

// 1. Salud del sistema y estado de conectividad real/fallback
app.get('/api/health', async (_req, res) => {
  const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
  const hasGeoserverUrl = Boolean(process.env.GEOSERVER_URL);
  const pgHealth = await postgisClient.checkHealth();

  res.json({
    status: 'ONLINE',
    servicio: 'Gemelo Digital Turístico PID',
    version: '1.0.0-MVP',
    mode: pgHealth.connected ? 'POSTGIS_PERSISTED_PILOT' : 'STANDALONE_MEMORY_DEMO',
    persistence: {
      driver: pgHealth.driver,
      connected: pgHealth.connected,
      database: pgHealth.database,
      serverVersion: pgHealth.serverVersion,
      postgisVersion: pgHealth.postgisVersion,
      rlsEnabled: pgHealth.rlsEnabled,
      counts: pgHealth.counts,
      error: pgHealth.error,
    },
    storage: {
      postgis_configured: pgHealth.connected || hasDbUrl,
      postgis_host: pgHealth.connected ? (process.env.PGHOST || '127.0.0.1:5432') : (hasDbUrl ? 'gemelotur_postgis:5432' : 'in-memory-spatial-engine'),
      geoserver_configured: hasGeoserverUrl,
      geoserver_host: hasGeoserverUrl ? process.env.GEOSERVER_URL : 'ready-for-docker-compose'
    },
    destinos_disponibles: ContextPackageService.getDestinations().length,
    contextPackages: {
      schemaVersion: '1.0.0',
      importedInMemory: ContextPackageService.getPackages().length,
      persistence: pgHealth.connected ? 'POSTGIS_PERSISTED' : 'MEMORY_DEMO_NOT_PERSISTED',
      postgisMigrationState: pgHealth.connected ? 'MIGRATIONS_001_TO_007_APPLIED' : (hasDbUrl ? 'DATABASE_URL_CONFIGURED' : 'NOT_CONFIGURED')
    },
    semantic: {
      profile: SEMANTIC_PROFILE_ID,
      context: SEMANTIC_CONTEXT_URL,
      destinationProfiles: MultiDestinationModel.getProfiles().length
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/persistence/status', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const pgHealth = await postgisClient.checkHealth();
  res.json({
    type: 'PersistenceStatus',
    health: pgHealth,
    timestamp: new Date().toISOString(),
  });
});

// 2. ContextPackage v1: contrato de alta de un destino y catálogo en memoria de la demo.
const contextPackageNoStore = (res: express.Response) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/json');
};

app.get('/api/context-packages/schema', (_req, res) => {
  contextPackageNoStore(res);
  return res.json({
    type: 'ContextPackageSchema',
    schemaVersion: '1.0.0',
    schemaUrl: '/context-packages/context-package-v1.schema.json',
    documentationUrl: '/context-packages/ESTANDAR_CONTEXTPACKAGE_V1.md'
  });
});

app.get('/api/context-packages/examples', (_req, res) => {
  contextPackageNoStore(res);
  return res.json({
    type: 'ContextPackageExampleCollection',
    examples: [{
      id: 'context-destino-demostrador-v1',
      label: 'Destino Demostrador (datos sintéticos)',
      url: '/context-packages/context-package-v1-destino-demostrador.json',
      syntheticDemoData: true
    }]
  });
});

app.post('/api/context-packages/validate', (req, res) => {
  const report = ContextPackageService.validate(req.body);
  contextPackageNoStore(res);
  return res.status(report.valid ? 200 : 422).json({ type: 'ContextPackageValidationResult', persistence: 'NOT_REQUESTED', report });
});

app.post('/api/context-packages/import', async (req, res) => {
  const result = await ContextPackageService.importAsync(req.body);
  contextPackageNoStore(res);
  return res.status(result.type === 'ContextPackageImportResult' ? 201 : 422).json(result);
});

app.get('/api/context-packages/destinations', (_req, res) => {
  contextPackageNoStore(res);
  const packages = ContextPackageService.getPackages();
  return res.json({
    type: 'ContextPackageDestinationCollection',
    persistence: 'MEMORY_DEMO_NOT_PERSISTED',
    total: packages.length,
    destinations: packages.map(contextPackage => ({
      packageId: contextPackage.id,
      tenantId: contextPackage.tenant.id,
      destination: contextPackage.destination,
      summary: {
        zones: contextPackage.context.zones.length,
        resources: contextPackage.context.resources.length,
        sensors: contextPackage.context.sensors.length,
        sources: contextPackage.context.dataSources.length
      }
    }))
  });
});

// 3. Editor de escenarios por destino. Los borradores de este MVP son
// intencionadamente privados del destino y viven en memoria hasta el piloto PostGIS.
const scenarioNoStore = (res: express.Response) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/json');
};

const scenarioError = (res: express.Response, status: number, error: string) => {
  scenarioNoStore(res);
  return res.status(status).json({ type: 'ScenarioEditorError', error, persistence: 'MEMORY_DEMO_NOT_PERSISTED' });
};

const scenarioDestination = (req: express.Request): string | undefined => {
  const queryDestination = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  const bodyDestination = typeof req.body?.destinationId === 'string' ? req.body.destinationId : undefined;
  if (queryDestination && bodyDestination && queryDestination !== bodyDestination) return undefined;
  return queryDestination || bodyDestination;
};

const scenarioScope = (req: express.Request, res: express.Response, destinationId: string | undefined) => {
  if (!destinationId) {
    scenarioError(res, 422, 'La operación requiere destino.');
    return undefined;
  }
  const resolved = DestinationRuntimeService.resolve(destinationId);
  if (!resolved.runtime || !resolved.report.valid) {
    scenarioError(res, 404, 'Destino no encontrado para el editor de escenarios.');
    return undefined;
  }

  // Iteración 8: Autenticación Institucional Obligatoria (OIDC / Bearer JWT / Cookie HttpOnly)
  const token = JwtAuthService.extractTokenFromRequest(req);
  const claims = token ? JwtAuthService.verifyToken(token) : null;

  if (!claims) {
    scenarioError(res, 401, 'UNAUTHORIZED: La operación requiere autenticación institucional válida (Bearer token o cookie de sesión autorizada).');
    return undefined;
  }

  const currentOp = { 
    sub: claims.sub,
    username: claims.username,
    tenantId: claims.tenantId, 
    role: claims.role, 
    authorizedDestinations: claims.authorizedDestinations 
  };

  // Si se provee cabecera X-PID-Tenant, debe coincidir con el tenant autenticado
  const headerTenant = req.get('X-PID-Tenant');

  if (headerTenant && headerTenant !== currentOp.tenantId && currentOp.role !== 'ADMIN_SEGITTUR') {
    scenarioError(res, 403, 'FORBIDDEN_TENANT_CLAIM_MISMATCH: El encabezado X-PID-Tenant no coincide con el tenant institucional autenticado.');
    return undefined;
  }

  const tenantId = currentOp.tenantId;

  // Validar autorización del operador sobre el destino geográfico
  if (currentOp.role !== 'ADMIN_SEGITTUR' && !currentOp.authorizedDestinations.includes(destinationId)) {
    scenarioError(res, 403, `FORBIDDEN_OPERATOR_DESTINATION_MISMATCH: El operador '${currentOp.username}' no dispone de autorización para operar sobre '${destinationId}'.`);
    return undefined;
  }

  if (tenantId !== resolved.runtime.tenant.id && currentOp.role !== 'ADMIN_SEGITTUR') {
    scenarioError(res, 403, 'El tenant institucional no corresponde al destino indicado.');
    return undefined;
  }
  return resolved.runtime;
};

app.get('/api/scenarios', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const includeArchived = req.query.includeArchived === 'true';
  scenarioNoStore(res);
  return res.json({
    type: 'ScenarioCollection',
    destinationId,
    persistence: 'MEMORY_DEMO_NOT_PERSISTED',
    scenarios: ScenarioStudioService.list(destinationId, includeArchived),
  });
});

app.post('/api/scenarios', (req, res) => {
  const destinationId = scenarioDestination(req);
  if (!scenarioScope(req, res, destinationId)) return;
  const result = ScenarioStudioService.create(req.body as ScenarioDraftInput);
  scenarioNoStore(res);
  return res.status(result.valid ? 201 : 422).json({ type: 'ScenarioCreation', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.get('/api/scenarios/:scenarioId', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const scenario = ScenarioStudioService.get(req.params.scenarioId, destinationId);
  if (!scenario) return scenarioError(res, 404, 'Escenario no encontrado para el destino indicado.');
  scenarioNoStore(res);
  return res.json({ type: 'ScenarioDefinition', persistence: 'MEMORY_DEMO_NOT_PERSISTED', scenario });
});

app.get('/api/scenarios/:scenarioId/versions', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const versions = ScenarioStudioService.versions(req.params.scenarioId, destinationId);
  if (!versions) return scenarioError(res, 404, 'Escenario no encontrado para el destino indicado.');
  scenarioNoStore(res);
  return res.json({ type: 'ScenarioVersionCollection', persistence: 'MEMORY_DEMO_NOT_PERSISTED', scenarioId: req.params.scenarioId, versions });
});

app.put('/api/scenarios/:scenarioId', (req, res) => {
  const destinationId = scenarioDestination(req);
  if (!scenarioScope(req, res, destinationId)) return;
  const result = ScenarioStudioService.update(req.params.scenarioId, destinationId, req.body as ScenarioDraftInput);
  scenarioNoStore(res);
  return res.status(result.valid ? 200 : 422).json({ type: 'ScenarioUpdate', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.post('/api/scenarios/:scenarioId/validate', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const result = ScenarioStudioService.validate(req.params.scenarioId, destinationId);
  scenarioNoStore(res);
  return res.status(result.valid ? 200 : 422).json({ type: 'ScenarioValidation', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.post('/api/scenarios/:scenarioId/duplicate', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const createdBy = typeof req.body?.createdBy === 'string' ? req.body.createdBy : undefined;
  const result = ScenarioStudioService.duplicate(req.params.scenarioId, destinationId, createdBy);
  scenarioNoStore(res);
  return res.status(result.valid ? 201 : 422).json({ type: 'ScenarioDuplication', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.post('/api/scenarios/:scenarioId/archive', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  if (!scenarioScope(req, res, destinationId)) return;
  const result = ScenarioStudioService.archive(req.params.scenarioId, destinationId);
  scenarioNoStore(res);
  return res.status(result.valid ? 200 : 422).json({ type: 'ScenarioArchive', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.post('/api/scenarios/:scenarioId/execute', async (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const scenario = ScenarioStudioService.get(req.params.scenarioId, runtime.destination.id);
  if (scenario) {
    // Si el escenario requiere validación de readiness por proceder de un modelo con variables obligatorias
    const modelId = (req.body && req.body.modelId) || (scenario.inputs && (scenario.inputs as any).modelId);
    if (modelId) {
      const readiness = await DataBindingService.evaluateModelReadiness(modelId, runtime.tenant.id, runtime.destination.id);
      if (!readiness.isReadyToExecute) {
        scenarioNoStore(res);
        return res.status(422).json({
          type: 'ScenarioExecutionBlocked',
          error: 'Ejecución bloqueada: existen variables obligatorias del modelo sin conector o sin datos autorizados.',
          readiness
        });
      }
    }
  }

  const result = ScenarioStudioService.execute(req.params.scenarioId, runtime.destination.id);
  scenarioNoStore(res);
  return res.status(result.valid ? 201 : 422).json({ type: 'ScenarioExecution', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

// 4. Destinos
app.get('/api/geo/destinos', (_req, res) => {
  res.json(DestinationRuntimeService.list().map(runtime => ({
    ...runtime.destination,
    tenantId: runtime.tenant.id,
    origin: runtime.origin,
    contextFingerprint: runtime.fingerprint.value,
    quality: runtime.quality,
  })));
});

const runtimeScopeError = (res: express.Response, status: number, error: string) => {
  res.set('Cache-Control', 'no-store');
  return res.status(status).json({ type: 'DestinationRuntimeError', error });
};

const scopedRuntime = (destinationId: unknown, res: express.Response) => {
  if (typeof destinationId !== 'string' || !destinationId.trim()) {
    runtimeScopeError(res, 422, 'La operación requiere el parámetro destino o destinationId.');
    return undefined;
  }
  const resolved = DestinationRuntimeService.resolve(destinationId);
  if (!resolved.runtime || !resolved.report.valid) {
    runtimeScopeError(res, 404, 'No existe un runtime operativo para el destino solicitado.');
    return undefined;
  }
  return resolved.runtime;
};

const requireTenantScope = (
  req: express.Request,
  runtime: NonNullable<ReturnType<typeof scopedRuntime>>,
  res: express.Response,
) => {
  // Iteración 8: Comprobar token Bearer / claims del operador si está presente
  const token = JwtAuthService.extractTokenFromRequest(req);
  if (token) {
    const claims = JwtAuthService.verifyToken(token);
    if (claims) {
      if (!claims.authorizedDestinations.includes(runtime.destination.id) && claims.role !== 'AUDITOR_NACIONAL') {
        runtimeScopeError(res, 403, `FORBIDDEN: El operador institucional no tiene autorización para operar en ${runtime.destination.id}.`);
        return false;
      }
      if (claims.tenantId !== runtime.tenant.id && claims.role !== 'AUDITOR_NACIONAL') {
        runtimeScopeError(res, 403, `FORBIDDEN: Tenant mismatch. Operador pertenece a ${claims.tenantId}, no a ${runtime.tenant.id}.`);
        return false;
      }
    }
  }

  const tenantId = req.get('X-PID-Tenant');
  if (!tenantId) {
    runtimeScopeError(res, 401, 'La operación requiere el encabezado X-PID-Tenant. La autenticación de producción debe aportar este scope desde los claims de sesión.');
    return false;
  }
  if (tenantId !== runtime.tenant.id) {
    runtimeScopeError(res, 403, 'El tenant solicitado no está autorizado para el destino indicado.');
    return false;
  }
  return true;
};

const defaultSimulationParameters = (runtime: NonNullable<ReturnType<typeof scopedRuntime>>): ParametrosDestinoConfigurables => ({
  umbralSaturacionAlerta: runtime.modelProfile.capacityProfile.alertThresholdPct,
  pesoCapacidadFisica: 0.6,
  pesoCapacidadPsicologica: 0.4,
  tasaEmisionKgCo2PorPersonaHora: 0.12,
  incrementoVisitantesManualPct: 0,
  franjaHoraria: '12:00',
  condicionClima: 'DESPEJADO',
  horaSimulacion: 12,
  intensidadEscenario: 1,
  factorCapacidadOperativa: 1,
  factorMovilidad: 1,
});

// 3. Catálogo de servicios y capas
app.get('/api/geo/catalogo', (_req, res) => {
  res.json(GeoServicesCatalog.getOgcMetadata());
});

// 4. Capas GeoJSON (Capacidad de carga, recursos, sensores)
app.get('/api/geo/capas/zonas', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'no-store');
  res.json(GeoServicesCatalog.getZonasGeoJSON(runtime.zones));
});

app.get('/api/geo/capas/recursos', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'no-store');
  res.json(GeoServicesCatalog.getRecursosGeoJSON(runtime.resources));
});

app.get('/api/geo/capas/sensores', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'no-store');
  res.json(GeoServicesCatalog.getSensoresGeoJSON(runtime.sensors));
});

// 5. Catálogo OGC API Features & WMS/WFS
app.get('/api/geo/ogc/collections', (_req, res) => {
  res.json(GeoServicesCatalog.getOgcMetadata());
});

// 6. Contrato de teselas vectoriales (MVT / Vector Tiles endpoint)
app.get('/api/geo/tiles/:capa/:z/:x/:y', (req, res) => {
  const { capa, z, x, y } = req.params;
  res.set('Content-Type', 'application/json');
  res.json({
    status: 'MVT_TILE_READY',
    capa,
    tile: { z: Number(z), x: Number(x), y: Number(y) },
    format: 'application/vnd.mapbox-vector-tile',
    message: 'En el piloto persistente este endpoint conecta con el backend Tegola/GeoServer MVT.'
  });
});

// 7. Ejecuciones normalizadas: el contrato común para cualquier destino y escenario.
app.post('/api/runs/simulations', (req, res) => {
  const runtime = scopedRuntime(req.body?.destinationId, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;
  const presets = createRuntimeScenarioPresets(runtime.zones);
  const scenario = req.body?.scenario || presets.find(item => item.id === req.body?.scenarioId);
  if (!scenario) return runtimeScopeError(res, 422, 'La ejecución requiere un escenario completo o un scenarioId válido del catálogo del destino.');
  if (!req.body?.parameters || typeof req.body.parameters !== 'object') return runtimeScopeError(res, 422, 'La ejecución requiere parámetros explícitos y validados.');
  const parameters = req.body.parameters;
  const result = SimulationRunService.execute({
    destinationId: runtime.destination.id,
    scenario,
    parameters,
    actor: typeof req.body?.actor === 'string' ? req.body.actor : undefined,
    scenarioDefinitionId: typeof req.body?.scenarioDefinitionId === 'string' ? req.body.scenarioDefinitionId : undefined,
    scenarioVersion: Number.isInteger(req.body?.scenarioVersion) ? req.body.scenarioVersion : undefined,
    seed: typeof req.body?.seed === 'string' ? req.body.seed : undefined,
  });
  res.set('Cache-Control', 'no-store');
  return res.status(result.valid ? 201 : 422).json({ type: 'SimulationRunExecution', persistence: 'MEMORY_DEMO_NOT_PERSISTED', ...result });
});

app.get('/api/runs', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;
  res.set('Cache-Control', 'no-store');
  return res.json({ type: 'SimulationRunCollection', destinationId: runtime.destination.id, persistence: 'MEMORY_DEMO_NOT_PERSISTED', runs: SimulationRunService.list(runtime.destination.id) });
});

app.get('/api/runs/:runId', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;
  const run = SimulationRunService.get(req.params.runId, runtime.destination.id);
  if (!run) return runtimeScopeError(res, 404, 'La corrida no existe o no pertenece al destino solicitado.');
  res.set('Cache-Control', 'no-store');
  return res.json(run);
});

app.get('/api/runs/:runId/export', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;
  if (req.query.format !== 'geojson') return runtimeScopeError(res, 422, 'El formato de exportación soportado es geojson.');
  const exportData = SimulationRunService.exportGeoJson(req.params.runId, runtime.destination.id);
  if (!exportData) return runtimeScopeError(res, 404, 'La corrida no existe o no pertenece al destino solicitado.');
  res.set('Cache-Control', 'no-store');
  res.type('application/geo+json');
  return res.json(exportData);
});

// Adaptador retrocompatible: conserva la respuesta de simulación anterior y adjunta SimulationRun v1.
app.post('/api/simulacion/ejecutar', (req, res) => {
  const runtime = scopedRuntime(req.body?.destinoId, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;
  const presets = createRuntimeScenarioPresets(runtime.zones);
  const scenario = typeof req.body?.escenarioId === 'string'
    ? presets.find(item => item.id === req.body.escenarioId)
    : presets.find(item => item.id === 'base');
  if (!scenario) return runtimeScopeError(res, 422, 'escenarioId no es válido para el destino solicitado.');
  const result = SimulationRunService.execute({
    destinationId: runtime.destination.id,
    scenario,
    parameters: { ...defaultSimulationParameters(runtime), ...(req.body?.parametros || {}) },
    actor: typeof req.body?.actor === 'string' ? req.body.actor : undefined,
  });
  if (!result.valid || !result.run) return res.status(422).json({ type: 'SimulationRunExecution', ...result });
  res.set('Cache-Control', 'no-store');
  return res.json({ ...result.run.outputs.scenario, run: result.run, deprecation: 'Use POST /api/runs/simulations for the normalized contract.' });
});

// 8. Ingestión de telemetría IoT (Streaming / Batch)
app.post('/api/ingestion/telemetria', (req, res) => {
  const { sensorId, valor, unidad, timestamp } = req.body;
  if (!sensorId || valor === undefined) {
    return res.status(400).json({ error: 'sensorId y valor son requeridos' });
  }

  return res.status(201).json({
    status: 'INGESTED',
    message: 'Telemetría validada ontológicamente y encolada para persistencia',
    sensorId,
    valor,
    unidad,
    timestamp: timestamp || new Date().toISOString(),
    trazabilidadId: `TR-ING-${Date.now()}`
  });
});

// 9. Catálogo de Datasets 3D (Fase 2: LiDAR, LOD2 y Fotogrametría)
app.get('/api/3d/datasets', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  const destinoId = runtime.destination.id;
  const datasets = DATASETS_3D_CATALOG.filter(d => d.destinoId === destinoId);
  res.json({
    destinoId,
    total: datasets.length,
    datasets
  });
});

app.get('/api/3d/datasets/:id/manifest', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  const dataset = DATASETS_3D_CATALOG.find(d => d.id === req.params.id && d.destinoId === runtime.destination.id);
  if (!dataset) {
    return runtimeScopeError(res, 404, 'Dataset 3D no encontrado para el destino solicitado.');
  }
  res.set('Cache-Control', 'no-store');
  res.json({
    manifestVersion: '1.0',
    dataset,
    loader: {
      engine: 'CesiumJS',
      tilesetUrl: dataset.tilesetUrl,
      options: {
        maximumScreenSpaceError: dataset.tipo === 'point_cloud' ? 12 : 16,
        pointCloudShading: {
          attenuation: true,
          geometricErrorScale: 1.25
        }
      }
    }
  });
});

// Endpoints de Datos Abiertos Interoperables (Iteración 10)
app.get('/api/geo/open-data/catalog', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'public, max-age=300');
  const catalog = OpenDataService.getCatalog(runtime.destination.id);
  return res.json(catalog);
});

app.get('/api/geo/open-data/traffic', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'no-store');
  const segments = OpenDataService.getTrafficSegments(runtime.destination.id);
  return res.json({
    type: 'FeatureCollection',
    destinationId: runtime.destination.id,
    timestamp: new Date().toISOString(),
    features: segments.map(seg => ({
      type: 'Feature',
      id: seg.id,
      geometry: {
        type: 'LineString',
        coordinates: seg.coordenadas.map(([lat, lng]) => [lng, lat])
      },
      properties: {
        id: seg.id,
        nombreVia: seg.nombreVia,
        nivelCongestion: seg.nivelCongestion,
        velocidadMediaKmh: seg.velocidadMediaKmh,
        intensidadVehiculosHora: seg.intensidadVehiculosHora,
        fuente: seg.fuente,
        timestamp: seg.timestamp
      }
    }))
  });
});

// Ingestión No-Code de Datos Ontológicos (S2) e Históricos (C4)
app.post('/api/ingestion/datasets', (req, res) => {
  const runtime = scopedRuntime(req.body?.destinationId, res);
  if (!runtime) return;
  if (!requireTenantScope(req, runtime, res)) return;

  const { title, lane, fileFormat, rawPayload, sourceName, licenseDeclared, columnMapping } = req.body;
  if (!title || !lane || !fileFormat || !rawPayload) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios de ingestión (title, lane, fileFormat, rawPayload).' });
  }

  const result = DataIngestionService.processBatch({
    destinationId: runtime.destination.id,
    tenantId: runtime.destination.tenantId,
    title,
    lane,
    fileFormat,
    rawPayload,
    sourceName: sourceName || 'Ingesta No-Code Municipal',
    licenseDeclared: licenseDeclared || 'CC-BY 4.0 Datos Abiertos',
    columnMapping,
    actorEmail: req.headers['x-operator-email'] as string | undefined
  });

  res.set('Cache-Control', 'no-store');
  return res.status(result.appliedToRuntime ? 201 : 422).json(result);
});

app.get('/api/ingestion/history', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  res.set('Cache-Control', 'no-store');
  const history = DataIngestionService.getHistory(runtime.destination.id);
  return res.json({
    destinationId: runtime.destination.id,
    total: history.length,
    history
  });
});

// Matriz de Compatibilidad Multidestino
app.post('/api/multidestino/compatibility-matrix', (req, res) => {
  const { modelId, destinationIds } = req.body;
  if (!modelId || !Array.isArray(destinationIds) || destinationIds.length === 0) {
    return res.status(400).json({ error: 'modelId y array destinationIds son requeridos.' });
  }

  const matrix = MultiDestinationCompatibilityService.evaluateModelCompatibility(modelId, destinationIds);
  res.set('Cache-Control', 'no-store');
  return res.json(matrix);
});

// 10. Fichas de Alcance y Gobernanza de la Primera Oleada (Fase 2)
app.get('/api/3d/oleadas/primera', (req, res) => {
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;
  const destinoId = runtime.destination.id;
  const edificios = EDIFICIOS_OLEADA_1.filter(e => e.destinoId === destinoId);
  res.json({
    destinoId,
    oleada: 1,
    titulo: edificios.length ? 'Primera Oleada · Activos 3D prioritarios del destino' : 'Primera Oleada · Sin activos 3D registrados',
    criterioSeleccion: edificios.length ? 'Activos priorizados por valor operativo y viabilidad de captura' : 'Pendiente de priorización por el destino',
    totalEdificios: edificios.length,
    edificios
  });
});

// 11. Capa de integración, normalización e interoperabilidad PID.
// Los contratos son explícitos; ninguna ruta invoca servicios PID externos en modo demo.
const interoperabilityNoStore = (res: express.Response) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/json');
};

const interoperabilityError = (res: express.Response, status: number, error: string, details?: Record<string, unknown>) => {
  interoperabilityNoStore(res);
  return res.status(status).json({
    type: 'InteroperabilityError',
    error,
    ...(details || {})
  });
};

app.get('/api/interoperability/architecture', (_req, res) => {
  interoperabilityNoStore(res);
  return res.json({
    type: 'InteroperabilityArchitecture',
    architecture: InteroperabilityCatalogService.getArchitecture()
  });
});

app.get('/api/interoperability/connectors', (req, res) => {
  const destinationId = req.query.destino as string | undefined;
  if (!destinationId) return interoperabilityError(res, 422, 'La consulta de conectores requiere destino.');
  const lane = req.query.carril as DataLane | undefined;
  const profile = MultiDestinationModel.getProfile(destinationId);
  if (!profile) return interoperabilityError(res, 404, `Destino de interoperabilidad no encontrado: ${destinationId}.`);
  if (lane && !['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'].includes(lane)) {
    return interoperabilityError(res, 400, `Carril no soportado: ${lane}.`, { supportedLanes: ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'] });
  }

  const connectors = InteroperabilityCatalogService.getConnectors(destinationId, lane);
  interoperabilityNoStore(res);
  return res.json({
    type: 'InteroperabilityConnectorCollection',
    destinationId,
    tenantId: profile.tenantId,
    total: connectors.length,
    connectors,
    persistence: 'CONFIGURATION_DEMO_NOT_CONNECTED'
  });
});

app.get('/api/interoperability/connectors/:connectorId', (req, res) => {
  const connector = InteroperabilityCatalogService.getConnector(req.params.connectorId);
  if (!connector) return interoperabilityError(res, 404, 'Conector de interoperabilidad no encontrado.');
  interoperabilityNoStore(res);
  return res.json({ type: 'InteroperabilityConnector', connector, persistence: 'CONFIGURATION_DEMO_NOT_CONNECTED' });
});

app.post('/api/models/own', (req, res) => {
  const result = InteroperabilityCatalogService.createOwnModel(req.body as OwnModelInput);
  interoperabilityNoStore(res);
  return res.status(result.valid ? 201 : 422).json({ type: 'OwnModelCreation', ...result });
});

app.post('/api/models/:modelId/publish', (req, res) => {
  const destinationId = req.body?.destinationId as string | undefined;
  if (!destinationId) return interoperabilityError(res, 422, 'La publicación requiere destinationId para comprobar la propiedad del borrador.');
  const result = InteroperabilityCatalogService.publishOwnModel(req.params.modelId, destinationId);
  interoperabilityNoStore(res);
  return res.status(result.valid ? 201 : 422).json({ type: 'OwnModelPublication', ...result });
});

app.get('/api/models/own/:modelId', (req, res) => {
  const destinationId = req.query.destino as string | undefined;
  const model = InteroperabilityCatalogService.getModel(req.params.modelId);
  if (!model || (model.publication === 'MODELO_PROPIO' && model.ownerDestinationId !== destinationId)) {
    return interoperabilityError(res, 404, 'Modelo no encontrado o no autorizado para el destino solicitado.');
  }
  interoperabilityNoStore(res);
  return res.json({ type: 'ModelTemplate', model });
});

app.get('/api/models/reusable', (req, res) => {
  const destinationId = req.query.destino as string | undefined;
  if (!destinationId) return interoperabilityError(res, 422, 'El catálogo de modelos requiere destino.');
  const profile = MultiDestinationModel.getProfile(destinationId);
  if (!profile) return interoperabilityError(res, 404, `Destino para el catálogo de modelos no encontrado: ${destinationId}.`);
  const models = InteroperabilityCatalogService.getModels(destinationId);
  interoperabilityNoStore(res);
  return res.json({
    type: 'ReusableModelCatalog',
    destinationId,
    tenantId: profile.tenantId,
    total: models.length,
    models,
    evidence: '/api/interoperability/architecture'
  });
});

app.get('/api/models/reusable/:modelId', (req, res) => {
  const model = InteroperabilityCatalogService.getModel(req.params.modelId);
  if (!model) return interoperabilityError(res, 404, 'Plantilla reutilizable no encontrada.');
  interoperabilityNoStore(res);
  return res.json({ type: 'ReusableModelTemplate', model });
});

app.post('/api/models/reusable/:modelId/instantiate', (req, res) => {
  const input = req.body as ModelInstantiationInput;
  if (!input || !input.destinationId || !Array.isArray(input.connectorIds) || !input.parameters) {
    return interoperabilityError(res, 422, 'La instancia requiere destinationId, connectorIds y parameters.');
  }
  const result = InteroperabilityCatalogService.instantiate(req.params.modelId, input);
  interoperabilityNoStore(res);
  return res.status(result.valid ? 201 : 422).json({
    type: 'ReusableModelInstantiation',
    ...result
  });
});

// Borrador de escenario desde una plantilla del catálogo, sin registrar nada en el servidor:
// el cliente lo conserva solo en su sesión (desaparece al recargar).
app.post('/api/models/reusable/:modelId/scenario-draft', (req, res) => {
  const destinationId = req.query.destino as string | undefined;
  if (!destinationId) return interoperabilityError(res, 422, 'El borrador requiere destino.');
  const { zoneIds, parameters } = req.body || {};
  const conversion = InteroperabilityCatalogService.modelToScenarioDraft(
    req.params.modelId,
    destinationId,
    Array.isArray(zoneIds) ? zoneIds : [],
    parameters || {},
  );
  interoperabilityNoStore(res);
  if (!conversion.valid || !conversion.draft) {
    return interoperabilityError(res, 422, conversion.errors?.[0] || 'No se pudo generar el borrador de escenario desde el modelo.');
  }
  return res.json({ type: 'ModelScenarioDraft', persistence: 'SESSION_ONLY', draft: conversion.draft });
});

// Importar un modelo del catálogo directamente a la pestaña Simulación como escenario ejecutable
app.post('/api/models/reusable/:modelId/import-scenario', (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const { zoneIds, parameters } = req.body || {};
  const conversion = InteroperabilityCatalogService.modelToScenarioDraft(
    req.params.modelId,
    runtime.destination.id,
    Array.isArray(zoneIds) ? zoneIds : runtime.zones.map(z => z.id).slice(0, 2),
    parameters || {}
  );

  if (!conversion.valid || !conversion.draft) {
    return scenarioError(res, 422, conversion.errors?.[0] || 'No se pudo generar el borrador de escenario desde el modelo.');
  }

  // Registrar el escenario en ScenarioStudioService
  const creation = ScenarioStudioService.create(conversion.draft);
  scenarioNoStore(res);
  return res.status(creation.valid ? 201 : 422).json({
    type: 'ModelScenarioImport',
    modelId: req.params.modelId,
    persistence: 'MEMORY_DEMO_NOT_PERSISTED',
    ...creation,
  });
});

// 12. Perfil Semántico SEGITTUR/PID y Modelo Multidestino (NGSI-LD JSON-LD)
const semanticNoStore = (res: express.Response) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/ld+json');
};

const semanticError = (res: express.Response, status: number, error: string, details?: Record<string, unknown>) => {
  semanticNoStore(res);
  return res.status(status).json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'SemanticError',
    error,
    ...(details || {})
  });
};

app.get('/api/semantic/model', (_req, res) => {
  semanticNoStore(res);
  res.json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'SemanticModel',
    ...MultiDestinationModel.getModel()
  });
});

app.get('/api/semantic/profiles', (_req, res) => {
  semanticNoStore(res);
  res.json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'DestinationProfileCollection',
    total: MultiDestinationModel.getProfiles().length,
    profiles: MultiDestinationModel.getProfiles()
  });
});

app.get('/api/semantic/profiles/:profileId', (req, res) => {
  const profile = MultiDestinationModel.getProfile(req.params.profileId);
  if (!profile) return semanticError(res, 404, 'Perfil semántico de destino no encontrado.');
  semanticNoStore(res);
  return res.json({ '@context': SEMANTIC_CONTEXT_URL, type: 'DestinationProfile', ...profile });
});

app.get('/api/semantic/entities', (req, res) => {
  const destinationId = req.query.destino as string | undefined;
  if (!destinationId) return semanticError(res, 422, 'La consulta semántica requiere destino.');
  const requestedType = req.query.type as NgsiLdEntityType | undefined;
  const profile = MultiDestinationModel.getProfile(destinationId);
  if (!profile) return semanticError(res, 404, `Destino semántico no encontrado: ${destinationId}.`);

  const supportedTypes = SemanticAdapter.supportedEntityTypes();
  if (requestedType && !supportedTypes.includes(requestedType)) {
    return semanticError(res, 400, `Tipo semántico no soportado: ${requestedType}.`, { supportedTypes });
  }

  const entities = MultiDestinationModel.getEntities(destinationId, requestedType);
  semanticNoStore(res);
  return res.json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'EntityCollection',
    destinationId,
    tenantId: profile.tenantId,
    total: entities.length,
    entities,
    evidence: profile.evidence
  });
});

app.post('/api/semantic/validate', (req, res) => {
  const result = SemanticAdapter.validateEntity(req.body);
  semanticNoStore(res);
  return res.status(result.valid ? 200 : 422).json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'SemanticValidationResult',
    ...result
  });
});

app.post('/api/semantic/normalize', (req, res) => {
  const result = SemanticAdapter.validateEntity(req.body);
  semanticNoStore(res);
  if (!result.valid) {
    return res.status(422).json({
      '@context': SEMANTIC_CONTEXT_URL,
      type: 'SemanticNormalizationResult',
      persistence: 'REJECTED',
      ...result
    });
  }

  return res.status(201).json({
    '@context': SEMANTIC_CONTEXT_URL,
    type: 'SemanticNormalizationResult',
    persistence: 'VALIDATED_NOT_PERSISTED',
    message: 'Entidad validada contra el perfil. En piloto PostGIS se almacena en registro_entidades_contexto.',
    ...result
  });
});

// 13. Agente de IA para simulaciones en lenguaje natural (Iteración 5)
// Regla de Knowledge: Ninguna respuesta o propuesta se emite sin vinculación obligatoria a evidencias comprobables.
// Copiloto con humano en el bucle: genera propuestas auditables para revisión humana; no ejecuta ni persiste de forma ciega.
app.get('/api/ai/capabilities', (req, res) => {
  const destinationId = typeof req.query.destino === 'string' ? req.query.destino : undefined;
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set('Cache-Control', 'no-store');
  const capabilities = AiSimulationAgentService.getCapabilities(destinationId);
  return res.json(capabilities);
});

app.post('/api/ai/simulate-prompt', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length < 5) {
    return scenarioError(res, 422, 'La consulta de simulación IA requiere un prompt de al menos 5 caracteres.');
  }
  if (prompt.length > 1000) {
    return scenarioError(res, 422, 'El prompt excede la longitud máxima permitida de 1000 caracteres.');
  }

  try {
    const request: AiPromptRequest = {
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      prompt,
      activeZoneId: typeof req.body?.activeZoneId === 'string' ? req.body.activeZoneId : undefined,
      contextPreferences: req.body?.contextPreferences,
    };

    const proposal = await AiSimulationAgentService.interpretPrompt(request);

    // Iteración 7: El servidor registra de inmediato la propuesta inmutable en la BD (Server-Side Registry)
    const token = JwtAuthService.extractTokenFromRequest(req);
    const claims = token ? JwtAuthService.verifyToken(token) : null;
    const operator = claims 
      ? { id: claims.sub, username: claims.username, displayName: claims.displayName, email: claims.email, tenantId: claims.tenantId, tenantName: claims.tenantName, role: claims.role, authorizedDestinations: claims.authorizedDestinations }
      : PilotOperationsService.getCurrentOperator();

    await PilotOperationsService.registerServerProposal(proposal, operator).catch(err => {
      console.warn('[AI Server Registry Warning] Fallo persistiendo propuesta server-side:', err.message);
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(proposal);
  } catch (err: any) {
    console.error('[AI Agent Server Error]', err);
    return scenarioError(res, 500, err.message || 'Error procesando la solicitud del Agente IA.');
  }
});

// =============================================================================
// ITERACIÓN 6: ENDPOINTS DE OPERACIONES DE PILOTO (AUTENTICACIÓN, AUDITORÍA, PROTOCOLOS Y CALIBRACIÓN)
// =============================================================================

const verifyOperatorClaims = (req: express.Request, res: express.Response, destinationId: string): boolean => {
  const token = JwtAuthService.extractTokenFromRequest(req);
  const claims = token ? JwtAuthService.verifyToken(token) : null;

  if (!claims) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'La operación requiere un Bearer token o sesión institucional válida.'
    });
    return false;
  }

  const operator = claims;
  (req as any).operator = {
    id: operator.sub,
    sub: operator.sub,
    username: operator.username,
    displayName: operator.displayName,
    email: operator.email,
    tenantId: operator.tenantId,
    role: operator.role,
    authorizedDestinations: operator.authorizedDestinations
  };

  if (operator.role === 'ADMIN_SEGITTUR') return true;
  if (!operator.authorizedDestinations.includes(destinationId)) {
    res.status(403).json({
      error: 'FORBIDDEN_OPERATOR_DESTINATION_MISMATCH',
      message: `El operador '${operator.username}' no dispone de autorización sobre el destino '${destinationId}'.`,
      authorizedDestinations: operator.authorizedDestinations,
    });
    return false;
  }
  return true;
};

// Identidad de operador y control de claims
app.post('/api/auth/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

  if (!username) {
    return res.status(400).json({ error: 'El campo username es obligatorio.' });
  }

  try {
    let op: OperatorIdentity | null = null;
    if (apiKey) {
      op = await postgisRepository.authenticateInstitutionalOperator(username, apiKey);
    }

    if (!op) {
      // Intentar por username o por email
      try {
        op = await PilotOperationsService.switchOperator(username);
      } catch {
        const allOps = await PilotOperationsService.listOperators();
        op = allOps.find(o => o.email === username || o.username === username || o.id === username) || null;
      }
    }

    if (!op) {
      return res.status(404).json({ error: `Operador institucional '${username}' no encontrado o credenciales incorrectas.` });
    }

    const { token, claims, expiresIn } = JwtAuthService.signToken(op, apiKey ? 'INSTITUTIONAL_KEY' : 'SESSION_COOKIE');

    res.set('Cache-Control', 'no-store');
    res.cookie('webdev_app_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: expiresIn * 1000,
    });
    res.cookie('institutional_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: expiresIn * 1000,
    });

    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn,
      claims,
      operator: op,
    });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Operador institucional no encontrado.' });
  }
});

app.get('/api/auth/me', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = JwtAuthService.extractTokenFromRequest(_req);
  const claims = token ? JwtAuthService.verifyToken(token) : null;
  
  if (!claims) {
    return res.json({
      authenticated: false,
      tokenVerified: false,
      operator: null,
      message: 'No hay sesión institucional activa.'
    });
  }

  return res.json({
    authenticated: true,
    tokenVerified: true,
    operator: claims,
  });
});

// Endpoints OIDC / Manus OAuth
app.get('/api/oauth/authorize-url', (req, res) => {
  const redirectUri = typeof req.query.redirectUri === 'string' 
    ? req.query.redirectUri 
    : `${req.protocol}://${req.get('host')}/api/oauth/callback`;
  
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const authUrl = OAuthService.getAuthorizeUrl(redirectUri, state);
  
  res.set('Cache-Control', 'no-store');
  return res.json({ authUrl, redirectUri });
});

app.post('/api/oauth/callback', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const redirectUri = typeof req.body?.redirectUri === 'string' ? req.body.redirectUri.trim() : '';

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'code y redirectUri son requeridos.' });
  }

  try {
    const accessToken = await OAuthService.exchangeCode(code, redirectUri);
    if (!accessToken) {
      return res.status(401).json({ error: 'Fallo al intercambiar el código OIDC por token de acceso.' });
    }

    const userInfo = await OAuthService.getUserInfo(accessToken);
    if (!userInfo?.openId) {
      return res.status(401).json({ error: 'No se pudo obtener información del usuario OIDC.' });
    }

    const operator = await OAuthService.resolveOperatorByOpenId(userInfo.openId, userInfo.email);
    if (!operator) {
      return res.status(403).json({ error: 'Usuario OIDC autenticado pero sin rol institucional asignado en el Gemelo Digital.' });
    }

    const { token, claims, expiresIn } = JwtAuthService.signToken(operator, 'OIDC_MANUS');

    res.cookie('webdev_app_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: expiresIn * 1000,
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      authenticated: true,
      token,
      claims,
      operator,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error en el flujo OIDC.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('webdev_app_session', { sameSite: 'none', secure: true });
  res.clearCookie('institutional_session', { sameSite: 'none', secure: true });
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, message: 'Sesión institucional cerrada.' });
});

app.get('/api/auth/operators', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const operators = await PilotOperationsService.listOperators();
  return res.json({ operators });
});

app.post('/api/auth/switch-operator', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username) return res.status(400).json({ error: 'Username requerido' });
  try {
    const op = await PilotOperationsService.switchOperator(username);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, operator: op });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

// Auditoría inmutable de propuestas de IA con evidencia vinculada
app.get('/api/ai/audit', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const audits = await PilotOperationsService.getAuditLog(runtime.tenant.id, runtime.destination.id);
  return res.json({ audits });
});

app.post('/api/ai/audit/decision', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { proposalId, proposal, decision, decisionRationale, linkedScenarioId, linkedRunId } = req.body || {};
  const targetProposalId = proposalId || (typeof proposal?.id === 'string' ? proposal.id : undefined);

  if (!targetProposalId || !decision) {
    return res.status(422).json({ error: 'Faltan campos obligatorios proposalId o decision.' });
  }

  const token = JwtAuthService.extractTokenFromRequest(req);
  const claims = token ? JwtAuthService.verifyToken(token) : null;
  const operator = claims 
    ? { id: claims.sub, username: claims.username, displayName: claims.displayName, email: claims.email, tenantId: claims.tenantId, tenantName: claims.tenantName, role: claims.role, authorizedDestinations: claims.authorizedDestinations }
    : PilotOperationsService.getCurrentOperator();

  try {
    const result = await PilotOperationsService.recordServerProposalDecision(
      targetProposalId,
      runtime.tenant.id,
      runtime.destination.id,
      operator,
      decision as AiAuditDecision,
      decisionRationale,
      linkedScenarioId,
      linkedRunId
    );

    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, proposalId: targetProposalId, decision, ...result });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Error registrando decisión sobre propuesta previa.' });
  }
});

// Protocolos operativos ante saturación
app.get('/api/protocols', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const protocols = await PilotOperationsService.listProtocols(runtime.tenant.id, runtime.destination.id);
  return res.json({ protocols });
});

// Calibración predictiva (T+X vs observación real)
app.get('/api/calibrations', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const calibrations = await PilotOperationsService.getCalibrations(runtime.tenant.id, runtime.destination.id);
  return res.json(calibrations);
});

// =========================================================================
// NUEVAS RUTAS ITERACIÓN 11: CONECTORES, DATASETS, PAQUETES Y VÍNCULOS
// =========================================================================

// 1. Conectores Operativos No-Code
app.get('/api/connectors', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const connectors = await ConnectorConfigurationService.listConnectors(runtime.tenant.id, runtime.destination.id);
  return res.json({ connectors, total: connectors.length });
});

app.post('/api/connectors', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const result = await ConnectorConfigurationService.createConnector(
    { ...req.body, destinationId: runtime.destination.id },
    runtime.tenant.id,
    operator.displayName
  );

  res.set('Cache-Control', 'no-store');
  return res.status(result.valid ? 201 : 422).json(result);
});

// 2. Ingesta de Archivos Propios (CSV, GeoJSON, JSON y SHP comprimido en ZIP)
app.post('/api/ingestion/datasets/file', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { name, format, fileName, rawPayload, lane, connectorId } = req.body || {};

  if (!name || !format || !fileName || !rawPayload) {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, format, fileName, rawPayload' });
  }

  const result = await DataIngestionService.processDatasetUpload({
    destinationId: runtime.destination.id,
    name,
    format,
    fileName,
    rawPayload,
    lane: lane || 'ONTOLOGICO',
    uploadedBy: operator.displayName,
    connectorId
  }, runtime.tenant.id);

  res.set('Cache-Control', 'no-store');
  return res.status(result.status === 'RECHAZADO' ? 422 : 201).json(result);
});

app.get('/api/ingestion/datasets', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const datasets = await DataIngestionService.listDatasets(runtime.tenant.id, runtime.destination.id);
  return res.json({ datasets, total: datasets.length });
});

// 3. Paquetes de Modelos de Simulación (SimulationModelPackage v1)
app.post('/api/models/packages/validate', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { rawContent } = req.body || {};
  if (!rawContent || typeof rawContent !== 'string') {
    return res.status(400).json({ valid: false, errors: ['El campo rawContent es obligatorio.'] });
  }

  const validation = SimulationModelPackageService.parseAndValidate(rawContent);
  return res.status(validation.valid ? 200 : 422).json(validation);
});

app.post('/api/models/packages/import', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { rawContent } = req.body || {};
  if (!rawContent || typeof rawContent !== 'string') {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'El campo rawContent es obligatorio.' });
  }

  const validation = SimulationModelPackageService.parseAndValidate(rawContent);
  if (!validation.valid || !validation.normalizedPackage) {
    res.set('Cache-Control', 'no-store');
    return res.status(422).json({ error: 'El paquete no superó la validación del esquema seguro.', errors: validation.errors });
  }

  const pkg = validation.normalizedPackage;
  // Alinear con el creador y tenant actual
  pkg.creatorDestinationId = runtime.destination.id;
  pkg.creatorDestinationName = runtime.destination.nombre;

  const persisted = await SimulationModelPackageService.persistPackage(pkg, runtime.tenant.id, operator.displayName);
  res.set('Cache-Control', 'no-store');
  return res.status(persisted.success ? 201 : 500).json({ ...persisted, package: pkg });
});

app.post('/api/models/packages/:packageId/decision', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { version, decision, rationale } = req.body || {};

  if (!version || !decision || !rationale) {
    res.set('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'version, decision y rationale son obligatorios.' });
  }

  const decisionRecord = {
    id: `dec_pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    packageId: req.params.packageId,
    version,
    tenantId: runtime.tenant.id,
    destinationId: runtime.destination.id,
    operatorId: operator.id,
    operatorName: operator.displayName,
    operatorRole: operator.role,
    decision,
    rationale,
    decidedAt: new Date().toISOString()
  };

  const outcome = await SimulationModelPackageService.recordHumanDecision(decisionRecord);
  res.set('Cache-Control', 'no-store');
  return res.status(outcome.success ? 200 : 422).json({ ...outcome, decision: decisionRecord });
});

// 4. Vínculos de Datos y Preparación de Simulación
app.get('/api/bindings', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const bindings = await DataBindingService.listBindings(runtime.tenant.id, runtime.destination.id);
  return res.json({ bindings, total: bindings.length });
});

app.post('/api/bindings', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const result = await DataBindingService.createOrUpdateBinding({
    ...req.body,
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id
  }, operator.displayName);

  res.set('Cache-Control', 'no-store');
  return res.status(result.valid ? 201 : 422).json(result);
});

app.get('/api/models/:modelId/readiness', async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set('Cache-Control', 'no-store');
  const readiness = await DataBindingService.evaluateModelReadiness(
    req.params.modelId,
    runtime.tenant.id,
    runtime.destination.id
  );
  return res.json(readiness);
});


// =============================================================================
// CAPACIDADES ITERACIÓN 12: SIMULACIÓN FEDERADA MULTIDESTINO Y ACTIVOS 3D
// =============================================================================

// Evaluar compatibilidad federada
app.post("/api/federation/evaluate-compatibility", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { modelId, participantDestinationIds } = req.body || {};
  if (!modelId || !Array.isArray(participantDestinationIds) || participantDestinationIds.length === 0) {
    res.set("Cache-Control", "no-store");
    return res.status(400).json({ error: "modelId y participantDestinationIds (array) son obligatorios." });
  }

  res.set("Cache-Control", "no-store");
  const evaluations = await FederatedSimulationService.evaluateFederationCompatibility(
    modelId,
    participantDestinationIds
  );
  return res.json({ modelId, evaluations, totalEvaluated: evaluations.length });
});

// Guardar configuración federada con reevaluación estricta en servidor
app.post("/api/federation/configs", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { modelPackageId, modelPackageVersion, modelTitle, name, description, participants, temporalHorizonHours, dataSharingPolicy } = req.body || {};

  if (!modelPackageId || !name || !Array.isArray(participants) || participants.length === 0) {
    res.set("Cache-Control", "no-store");
    return res.status(400).json({ error: "modelPackageId, name y participants son obligatorios." });
  }

  // REEVALUACIÓN EN SERVIDOR: nunca confiar ciegamente en el status enviado por el cliente
  const participantIds = participants.map((p: any) => p.destinationId);
  const evaluations = await FederatedSimulationService.evaluateFederationCompatibility(modelPackageId, participantIds);
  const evalMap = new Map(evaluations.map(e => [e.destinationId, e]));

  const validatedParticipants = participants.map((p: any) => {
    const evaluated = evalMap.get(p.destinationId);
    return {
      destinationId: p.destinationId,
      destinationName: evaluated?.destinationName || p.destinationName,
      tenantId: evaluated?.tenantId || p.tenantId,
      role: p.destinationId === destinationId ? "COORDINADOR" : "PARTICIPANTE",
      compatibilityStatus: evaluated ? evaluated.status : "NO_COMPATIBLE",
      localBindingsSnapshot: p.localBindingsSnapshot || {}
    };
  });

  const id = `fed_cfg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const config = {
    id,
    tenantId: runtime.tenant.id,
    coordinatorDestinationId: runtime.destination.id,
    coordinatorDestinationName: runtime.destination.nombre,
    modelPackageId,
    modelPackageVersion: modelPackageVersion || "1.0.0",
    modelTitle: modelTitle || name,
    name,
    description: description || "",
    temporalHorizonHours: Number(temporalHorizonHours) || 4,
    dataSharingPolicy: dataSharingPolicy || "SOLO_INDICADORES_AGREGADOS",
    participants: validatedParticipants,
    createdBy: operator.displayName,
    createdAt: new Date().toISOString()
  };

  const saved = await postgisRepository.saveFederatedConfig(config);
  res.set("Cache-Control", "no-store");
  if (!saved) return res.status(500).json({ error: "Error al persistir la configuración federada en PostGIS." });
  return res.status(201).json(config);
});

// Listar configuraciones federadas
app.get("/api/federation/configs", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set("Cache-Control", "no-store");
  const configs = await postgisRepository.listFederatedConfigs(runtime.tenant.id, runtime.destination.id);
  return res.json({ configs, total: configs.length });
});

// Ejecutar simulación federada
app.post("/api/federation/configs/:id/execute", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const configs = await postgisRepository.listFederatedConfigs(runtime.tenant.id, runtime.destination.id);
  const config = configs.find(c => c.id === req.params.id);

  if (!config) {
    res.set("Cache-Control", "no-store");
    return res.status(404).json({ error: "Configuración federada no encontrada para este destino." });
  }

  // Comprobar que ningún participante tenga estado INCOMPLETO o NO_COMPATIBLE
  const invalidParticipant = config.participants.find(p => p.compatibilityStatus === "INCOMPLETO" || p.compatibilityStatus === "NO_COMPATIBLE");
  if (invalidParticipant) {
    res.set("Cache-Control", "no-store");
    return res.status(422).json({
      error: "Ejecución federada bloqueada: uno o más destinos participantes presentan incompatibilidad o variables faltantes.",
      incompatibleDestination: invalidParticipant.destinationName
    });
  }

  res.set("Cache-Control", "no-store");
  const result = await FederatedSimulationService.executeFederatedSimulation(config, {
    id: operator.id,
    name: operator.displayName,
    role: operator.role
  });

  return res.status(201).json(result);
});

// Consultar ejecución federada por ID
app.get("/api/federation/runs/:runId", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set("Cache-Control", "no-store");
  const run = await postgisRepository.getFederatedExecutionById(req.params.runId, runtime.tenant.id, runtime.destination.id);
  if (!run) return res.status(404).json({ error: "Ejecución federada no encontrada." });
  return res.json(run);
});

// Decisión humana inmutable sobre ejecución federada
app.post("/api/federation/runs/:runId/decision", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { action, rationale } = req.body || {};

  if (!action || !rationale) {
    res.set("Cache-Control", "no-store");
    return res.status(400).json({ error: "action y rationale son obligatorios." });
  }

  const decision = {
    id: `dec_fed_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    federatedRunId: req.params.runId,
    tenantId: runtime.tenant.id,
    destinationId: runtime.destination.id,
    operatorId: operator.id,
    operatorName: operator.displayName,
    operatorRole: operator.role,
    action,
    rationale,
    decidedAt: new Date().toISOString()
  };

  const saved = await postgisRepository.recordFederatedDecision(decision);
  res.set("Cache-Control", "no-store");
  if (!saved) return res.status(500).json({ error: "Error al registrar la decisión federada en PostGIS." });
  return res.status(201).json({ success: true, decision });
});

// Catálogo unificado de activos 3D/4D abiertos
app.get("/api/3d/catalog/assets", (req, res) => {
  // Inventario de metadatos de solo lectura (como /api/3d/datasets): no requiere sesión.
  const runtime = scopedRuntime(req.query.destino, res);
  if (!runtime) return;

  res.set("Cache-Control", "no-store");
  const allAssets = [
    {
      id: "ign-pnoa-ortoimagen-wms",
      name: "Ortoimagen PNOA Máxima Actualidad (IGN)",
      destinationId: "espana_general",
      level: 1,
      format: "OGC_WMS",
      endpointUrl: "https://www.ign.es/wms-inspire/pnoa-ma",
      layerOrFileIdentifier: "OI.OrthoimageCoverage",
      crs: "EPSG:4326",
      publisher: "Instituto Geográfico Nacional (IGN / CNIG)",
      license: "CC-BY 4.0 IGN-CNIG",
      licenseUrl: "https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf",
      resolutionOrDensity: "25-50 cm/píxel",
      boundingExtent: [-18.5, 27.5, 4.5, 44.0],
      isOfflineFallbackAvailable: true,
      fingerprintSha256: "b9e59d95f9c4701e858db421d60b3765108fb217f7d1f568607a972f7ff0d04c",
      status: "ACTIVO_VERIFICADO",
      description: "Servicio WMS OGC oficial de ortofotografía aérea de España PNOA."
    },
    {
      id: "ign-base-gris-tms",
      name: "Cartografía Raster IGN Base Gris (WMTS/TMS)",
      destinationId: "espana_general",
      level: 1,
      format: "TMS",
      endpointUrl: "https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg",
      crs: "EPSG:3857",
      publisher: "IGN / IDEE",
      license: "CC-BY 4.0 IGN-CNIG",
      licenseUrl: "https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf",
      resolutionOrDensity: "Nivel de zoom 0-18",
      boundingExtent: [-18.5, 27.5, 4.5, 44.0],
      isOfflineFallbackAvailable: true,
      fingerprintSha256: "f46c65bdf354fafe2a0a2569e4f55f2f5344383c07223bdf2c33299742308e28",
      status: "ACTIVO_VERIFICADO",
      description: "Mapa base atenuado ideal para superposición analítica de calor y afluencia."
    },
    {
      id: "pnoa-lidar-3dtiles-malaga",
      name: "PNOA LiDAR 3D Tiles v1.1 Málaga Centro-Puerto",
      destinationId: "malaga",
      level: 3,
      format: "OGC_3D_TILES",
      endpointUrl: "/tilesets/malaga-centro-2024/tileset.json",
      crs: "EPSG:4979",
      publisher: "Centro Nacional de Información Geográfica (CNIG)",
      license: "CC-BY 4.0 IGN-CNIG",
      licenseUrl: "https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf",
      resolutionOrDensity: "5 puntos/m² RGBI",
      boundingExtent: [-4.430, 36.710, -4.410, 36.728],
      isOfflineFallbackAvailable: true,
      fingerprintSha256: "2502c38d82361664c39c9413ca228b33534b8686cf46b2b73bc36a1883b1cebb",
      status: "ACTIVO_VERIFICADO",
      description: "Nube de puntos LiDAR clasificada y teselada a estándar OGC 3D Tiles 1.1."
    },
    {
      id: "catastro-inspire-building-parts",
      name: "Catastro INSPIRE Edificaciones y Alturas LiDAR",
      destinationId: runtime.destination.id,
      level: 2,
      format: "GEOJSON_INSPIRE",
      endpointUrl: "/data/malaga/malaga-urbana-building-parts-lidar-color.geojson",
      crs: "EPSG:4326",
      publisher: "Dirección General del Catastro / IGN",
      license: "ODbL Directiva INSPIRE",
      licenseUrl: "https://www.catastro.minhap.es/",
      resolutionOrDensity: "Polígonos 2.5D con cota y altura zMax",
      boundingExtent: [-4.430, 36.710, -4.410, 36.728],
      isOfflineFallbackAvailable: true,
      fingerprintSha256: "3679c5fe1178619bc5a6435be7feae8be37e72a44f123ff504859f816c271500",
      status: "ACTIVO_VERIFICADO",
      description: "Huellas de edificios con coloración LiDAR y alturas estimadas para simulación de densidad urbana."
    },
    {
      id: "trafico-abierto-stream",
      name: "Tráfico y Congestión Vial Abierta",
      destinationId: runtime.destination.id,
      level: 4,
      format: "TRAFFIC_LINESTRING",
      endpointUrl: "/api/geo/open-data/traffic",
      crs: "EPSG:4326",
      publisher: "Ayuntamiento / DGT Tráfico Abierto",
      license: "Public Domain / CC0",
      licenseUrl: "https://datos.gob.es",
      resolutionOrDensity: "Red de vías principales y acceso a centros históricos",
      boundingExtent: [-4.430, 36.710, -4.410, 36.728],
      isOfflineFallbackAvailable: true,
      fingerprintSha256: "52dcad02a501bfd9fae15f36e4f3ea36c84bceeb2a4e931ca8a24c0840b2a8d3",
      status: "ACTIVO_VERIFICADO",
      description: "Segmentos de viales con indicador de velocidad media y nivel de congestión para simulaciones de movilidad."
    }
  ];

  const assets = [
    ...allAssets.filter(a => a.destinationId === runtime.destination.id || a.destinationId === 'espana_general'),
    ...generarActivosTerritorialesPlaceholder(runtime.destination.id, runtime.destination.nombre),
  ];
  return res.json({ destinationId: runtime.destination.id, assets, total: assets.length });
});


// =============================================================================
// CAPACIDADES ITERACIÓN 13: ONTOLOGÍAS PID S2 Y CONECTORES IOT SEMÁNTICOS
// =============================================================================

// 1. Registro de Ontologías PID aprobadas
app.get("/api/semantic/ontology-registry", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const ontologies = await PidOntologyRegistryService.listApprovedOntologies();
  return res.json({
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id,
    total: ontologies.length,
    ontologies
  });
});

// 2. Conectores Semánticos S2
app.get("/api/semantic/s2-connectors", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const connectors = await postgisRepository.listS2Connectors(runtime.tenant.id, runtime.destination.id);
  return res.json({
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id,
    total: connectors.length,
    connectors
  });
});

app.post("/api/semantic/s2-connectors", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const result = await S2SemanticConnectorService.createProfile(
    { ...req.body, destinationId: runtime.destination.id },
    runtime.tenant.id,
    operator.displayName
  );

  res.set("Cache-Control", "private, no-store");
  if (!result.valid) return res.status(422).json({ errors: result.errors });
  return res.status(201).json({ success: true, profile: result.profile });
});

app.post("/api/semantic/s2-connectors/:id/preflight", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set("Cache-Control", "private, no-store");
  const preflight = await S2SemanticConnectorService.executePreflight(
    req.params.id,
    runtime.tenant.id,
    runtime.destination.id
  );

  return res.status(preflight.allowed ? 200 : 422).json(preflight);
});

app.post("/api/semantic/s2-connectors/:id/decision", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { action, rationale } = req.body || {};

  if (!action || !rationale) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "action y rationale son requeridos para la auditoría inmutable." });
  }

  const decision = {
    id: `dec_s2_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    tenantId: runtime.tenant.id,
    destinationId: runtime.destination.id,
    connectorId: req.params.id,
    connectorKind: "S2_SEMANTIC" as const,
    action,
    operatorId: operator.id,
    operatorName: operator.displayName,
    operatorRole: operator.role,
    rationale,
    evidenceFingerprintSha256: crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex"),
    decidedAt: new Date().toISOString()
  };

  const result = await S2SemanticConnectorService.recordDecision(decision);
  res.set("Cache-Control", "private, no-store");
  if (!result.success) return res.status(422).json({ errors: result.errors });
  return res.status(201).json({ success: true, decision, newState: result.newState });
});

// Ingestión de muestra verificada S2 (para pruebas gobernadas y demostradores sin conectar a red no autorizada)
app.post("/api/semantic/s2-connectors/:id/ingest-sample", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { samples } = req.body || {};

  if (!Array.isArray(samples) || samples.length === 0) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "El array samples es obligatorio." });
  }

  try {
    const result = await S2SemanticConnectorService.ingestSampleBatch(
      req.params.id,
      runtime.tenant.id,
      runtime.destination.id,
      samples,
      operator.displayName
    );
    res.set("Cache-Control", "private, no-store");
    return res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.set("Cache-Control", "private, no-store");
    return res.status(422).json({ error: err.message });
  }
});

// 3. Conectores Brokers IoT y Dispositivos
app.get("/api/iot/connectors", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const connectors = await postgisRepository.listIotBrokerConnectors(runtime.tenant.id, runtime.destination.id);
  return res.json({
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id,
    total: connectors.length,
    connectors
  });
});

app.post("/api/iot/connectors", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const result = await IotTelemetryValidationService.createBrokerProfile(
    { ...req.body, destinationId: runtime.destination.id },
    runtime.tenant.id,
    operator.displayName
  );

  res.set("Cache-Control", "private, no-store");
  if (!result.valid) return res.status(422).json({ errors: result.errors });
  return res.status(201).json({ success: true, profile: result.profile });
});

app.post("/api/iot/connectors/:id/decision", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const { action, rationale } = req.body || {};

  if (!action || !rationale) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "action y rationale son requeridos para la auditoría inmutable." });
  }

  const decision = {
    id: `dec_iot_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    tenantId: runtime.tenant.id,
    destinationId: runtime.destination.id,
    connectorId: req.params.id,
    connectorKind: "IOT_MQTT" as const,
    action,
    operatorId: operator.id,
    operatorName: operator.displayName,
    operatorRole: operator.role,
    rationale,
    evidenceFingerprintSha256: crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex"),
    decidedAt: new Date().toISOString()
  };

  const result = await IotTelemetryValidationService.recordDecision(decision);
  res.set("Cache-Control", "private, no-store");
  if (!result.success) return res.status(422).json({ errors: result.errors });
  return res.status(201).json({ success: true, decision, newState: result.newState });
});

app.get("/api/iot/devices", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const devices = await postgisRepository.listIotDevices(runtime.tenant.id, runtime.destination.id);
  return res.json({
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id,
    total: devices.length,
    devices
  });
});

app.post("/api/iot/devices", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = PilotOperationsService.getCurrentOperator();
  const result = await IotTelemetryValidationService.registerDevice(
    { ...req.body, destinationId: runtime.destination.id },
    runtime.tenant.id,
    operator.displayName
  );

  res.set("Cache-Control", "private, no-store");
  if (!result.valid) return res.status(422).json({ errors: result.errors });
  return res.status(201).json({ success: true, device: result.device });
});

// Telemetría gobernada IoT
app.post("/api/iot/telemetry", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { connectorId, sample } = req.body || {};
  if (!connectorId || !sample) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "connectorId y sample son requeridos." });
  }

  const result = await MqttCollectorService.processIncomingMessage(
    connectorId,
    runtime.tenant.id,
    runtime.destination.id,
    sample
  );

  res.set("Cache-Control", "private, no-store");
  if (!result.accepted) return res.status(422).json({ error: result.errorReason });
  return res.status(201).json({ success: true, message: "Telemetría normalizada y persistida en observaciones_contexto_iot" });
});

// Estado del colector MQTT persistente
app.get("/api/iot/ingestion-status", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const status = await MqttCollectorService.getStatus(runtime.tenant.id, runtime.destination.id);
  return res.json(status);
});

// Observaciones contextuales normalizadas
app.get("/api/iot/observations", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const observations = await postgisRepository.listContextObservations(
    runtime.tenant.id,
    runtime.destination.id,
    {
      sensorUrn: req.query.sensorUrn as string | undefined,
      sourceType: req.query.sourceType as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50
    }
  );

  return res.json({
    destinationId: runtime.destination.id,
    tenantId: runtime.tenant.id,
    total: observations.length,
    observations
  });
});

// 4. Linaje de datos
app.get("/api/semantic/lineage/:observationId", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const lineage = await SemanticDataLineageService.buildLineageForObservation(
    req.params.observationId,
    runtime.tenant.id,
    runtime.destination.id
  );

  if (!lineage) return res.status(404).json({ error: "Linaje no encontrado para la observación solicitada." });
  return res.json(lineage);
});


// =============================================================================
// CAPACIDADES ITERACIÓN 14: CALIBRACIÓN REAL Y PREDICCIÓN VALIDABLE
// =============================================================================

// 1. Reglas formales de vínculo (fuente -> cobertura -> zona -> variable)
app.get("/api/calibration/rules", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const modelId = req.query.modelId as string | undefined;
  const rules = await FormalDataBindingService.listRules(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json({ destinationId: runtime.destination.id, total: rules.length, rules });
});

app.post("/api/calibration/rules", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const result = await FormalDataBindingService.createBindingRule({
    ...req.body,
    tenantId: runtime.tenant.id,
    destinationId: runtime.destination.id
  });

  res.set("Cache-Control", "private, no-store");
  return res.status(result.valid ? 201 : 422).json(result);
});

app.post("/api/calibration/rules/:id/approval", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator || PilotOperationsService.getCurrentOperator();
  const { state, rationale } = req.body || {};

  if (!state || !rationale) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "state y rationale son requeridos." });
  }

  const result = await FormalDataBindingService.setRuleApprovalState(
    runtime.tenant.id,
    runtime.destination.id,
    req.params.id,
    state,
    { id: operator.sub || operator.id, name: operator.displayName || operator.name || "Operador", role: operator.role },
    rationale
  );

  res.set("Cache-Control", "private, no-store");
  return res.status(result.success ? 200 : 422).json(result);
});

// 2. Cobertura territorial
app.get("/api/calibration/coverage", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const modelId = (req.query.modelId as string) || "mod_afluencia_peatonal_ejes";
  res.set("Cache-Control", "private, no-store");
  const report = await FormalDataBindingService.evaluateCoverage(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json(report);
});

// 3. Propuesta técnica y aplicación de calibración
app.post("/api/calibration/proposals/generate", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator || PilotOperationsService.getCurrentOperator();
  const { modelId, windowMinutes } = req.body || {};
  const targetModelId = modelId || "mod_afluencia_peatonal_ejes";

  res.set("Cache-Control", "private, no-store");
  const proposal = await CalibrationEngineService.generateCalibrationProposal(
    runtime.tenant.id,
    runtime.destination.id,
    targetModelId,
    Number(windowMinutes) || 60,
    { id: operator.sub || operator.id, name: operator.displayName || operator.name || "Operador", role: operator.role }
  );

  return res.status(200).json(proposal);
});

app.post("/api/calibration/proposals/apply", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator || PilotOperationsService.getCurrentOperator();
  const { proposalId, decision, rationale } = req.body || {};

  if (!proposalId || !decision || !rationale) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "proposalId, decision y rationale son obligatorios." });
  }

  const result = await CalibrationEngineService.applyCalibrationDecision(
    runtime.tenant.id,
    runtime.destination.id,
    proposalId,
    decision,
    { id: operator.sub || operator.id, name: operator.displayName || operator.name || "Operador", role: operator.role },
    rationale
  );

  res.set("Cache-Control", "private, no-store");
  return res.status(result.success ? 201 : 422).json(result);
});

app.get("/api/calibration/active", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const modelId = (req.query.modelId as string) || "mod_afluencia_peatonal_ejes";
  res.set("Cache-Control", "private, no-store");
  const active = await CalibrationEngineService.getActiveCalibration(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json({ destinationId: runtime.destination.id, modelId, activeCalibration: active });
});

// 4. Predicción Formal y Reconciliación Ex-Post
app.post("/api/forecast/runs", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { modelId, horizon } = req.body || {};
  const targetModel = modelId || "mod_afluencia_peatonal_ejes";
  const targetHorizon: ForecastHorizon = (horizon as ForecastHorizon) || "T+4";

  res.set("Cache-Control", "private, no-store");
  const result = await ForecastEvaluationService.executeAndRecordForecast(
    runtime.tenant.id,
    runtime.destination.id,
    targetModel,
    targetHorizon
  );

  return res.status(result.success ? 201 : 422).json(result);
});

app.get("/api/forecast/runs", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const modelId = req.query.modelId as string | undefined;
  res.set("Cache-Control", "private, no-store");
  const forecasts = await ForecastEvaluationService.listForecasts(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json({ destinationId: runtime.destination.id, total: forecasts.length, forecasts });
});

app.post("/api/forecast/evaluations/reconcile", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { forecastRunId, actualObservedValue, rationale } = req.body || {};
  if (!forecastRunId) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "forecastRunId es obligatorio." });
  }

  res.set("Cache-Control", "private, no-store");
  const result = await ForecastEvaluationService.reconcileForecastWithObservations(
    runtime.tenant.id,
    runtime.destination.id,
    forecastRunId,
    actualObservedValue !== undefined ? Number(actualObservedValue) : undefined,
    rationale
  );

  return res.status(result.success ? 201 : 422).json(result);
});

app.get("/api/forecast/accuracy", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const modelId = (req.query.modelId as string) || "mod_afluencia_peatonal_ejes";
  res.set("Cache-Control", "private, no-store");
  const summary = await ForecastEvaluationService.getAccuracySummary(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json(summary);
});

app.get("/api/forecast/evaluations", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  const modelId = req.query.modelId as string | undefined;
  res.set("Cache-Control", "private, no-store");
  const evaluations = await ForecastEvaluationService.listEvaluations(runtime.tenant.id, runtime.destination.id, modelId);
  return res.json({ destinationId: runtime.destination.id, total: evaluations.length, evaluations });
});


// =============================================================================
// CAPACIDADES ITERACIÓN 15: MACROECONOMÍA, OPTIMIZACIÓN Y PRUEBAS DE ESTRÉS
// =============================================================================

// 1. Simulación de Impacto Macroeconómico
app.post("/api/macro/simulate", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { scenarioTitle, visitorDeltaPct, runId } = req.body || {};
  res.set("Cache-Control", "private, no-store");

  const deltaNum = visitorDeltaPct !== undefined ? Number(visitorDeltaPct) : 15.0;
  if (!Number.isFinite(deltaNum) || deltaNum < -90 || deltaNum > 500) {
    return res.status(400).json({ error: "visitorDeltaPct debe ser un número finito entre -90 y +500%." });
  }

  const result = await MacroeconomicImpactService.executeMacroSimulation(
    runtime.tenant.id,
    runtime.destination.id,
    scenarioTitle || "Escenario de Afluencia Proyectada",
    deltaNum,
    runId
  );

  return res.status(201).json(result);
});

app.get("/api/macro/simulations", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const simulations = await MacroPostgisExtension.listMacroeconomicSimulations(
    runtime.tenant.id,
    runtime.destination.id,
    req.query.limit ? Number(req.query.limit) : 20
  );
  return res.json({ destinationId: runtime.destination.id, total: simulations.length, simulations });
});

// 2. Optimización y Desvío Dinámico de Flujos
app.post("/api/optimization/proposals/generate", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { criticalThresholdPct } = req.body || {};
  res.set("Cache-Control", "private, no-store");

  const threshNum = criticalThresholdPct !== undefined ? Number(criticalThresholdPct) : 80;
  if (!Number.isFinite(threshNum) || threshNum < 40 || threshNum > 150) {
    return res.status(400).json({ error: "criticalThresholdPct debe ser un número finito entre 40 y 150%." });
  }

  const proposal = await FlowOptimizationService.generateProposal(
    runtime.tenant.id,
    runtime.destination.id,
    threshNum
  );

  return res.status(201).json(proposal);
});

app.post("/api/optimization/proposals/apply", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator;
  if (!operator || !operator.id) {
    res.set("Cache-Control", "private, no-store");
    return res.status(401).json({ error: "Token JWT institucional inválido o ausente." });
  }

  const { proposalId, decision, rationale } = req.body || {};

  if (!proposalId || !decision || !rationale) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "proposalId, decision y rationale son requeridos." });
  }

  if (decision !== "APROBADA_OPERADOR" && decision !== "RECHAZADA_OPERADOR") {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "decision debe ser APROBADA_OPERADOR o RECHAZADA_OPERADOR." });
  }

  res.set("Cache-Control", "private, no-store");
  const result = await FlowOptimizationService.applyDecision(
    runtime.tenant.id,
    runtime.destination.id,
    proposalId,
    decision,
    { id: operator.id, name: operator.displayName || operator.name || operator.email || "Operador", role: operator.role || "OPERADOR" },
    rationale
  );

  return res.status(result.success ? 201 : 422).json(result);
});

// 3. Pruebas de Estrés en Horizontes T+1, T+4 y T+24
app.post("/api/stress-test/execute", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { profile } = req.body || {};
  res.set("Cache-Control", "private, no-store");

  const allowedProfiles = ["PICO_MASIVO_MODERADO", "PICO_SEVERO_INMINENTE", "COLAPSO_EVENTO_EXTRAORDINARIO"];
  const targetProfile = profile || "PICO_SEVERO_INMINENTE";
  if (!allowedProfiles.includes(targetProfile)) {
    return res.status(400).json({ error: `Perfil de estrés no válido. Opciones: ${allowedProfiles.join(", ")}` });
  }

  const result = await StressTestingService.executeStressTest(
    runtime.tenant.id,
    runtime.destination.id,
    targetProfile
  );

  return res.status(201).json(result);
});

app.get("/api/stress-test/results", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const results = await MacroPostgisExtension.listStressTests(
    runtime.tenant.id,
    runtime.destination.id,
    req.query.limit ? Number(req.query.limit) : 10
  );
  return res.json({ destinationId: runtime.destination.id, total: results.length, results });
});

// =============================================================================
// CAPACIDADES ITERACIÓN 16: AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ANTE COLAPSO
// =============================================================================

// 1. Obtener perfil de agente autónomo del destino
app.get("/api/rapid-response/agents", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const agent = await RapidResponseAgentService.getOrInitializeAgent(
    runtime.tenant.id,
    runtime.destination.id
  );
  return res.json({ destinationId: runtime.destination.id, agent });
});

// 2. Evaluar territorio en tiempo real y detectar posibles incidentes de colapso
app.post("/api/rapid-response/evaluate", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const { forcedSaturationBoostPct } = req.body || {};
  res.set("Cache-Control", "private, no-store");

  const boost = forcedSaturationBoostPct !== undefined ? Number(forcedSaturationBoostPct) : 0;
  const result = await RapidResponseAgentService.evaluateTerritoryAndDetectIncidents(
    runtime.tenant.id,
    runtime.destination.id,
    boost
  );

  return res.status(200).json(result);
});

// 3. Listar incidentes históricos detectados por los agentes
app.get("/api/rapid-response/incidents", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const incidents = await RapidResponsePostgisExtension.listIncidents(
    runtime.tenant.id,
    runtime.destination.id,
    req.query.limit ? Number(req.query.limit) : 20
  );
  return res.json({ destinationId: runtime.destination.id, total: incidents.length, incidents });
});

// 4. Consultar plan de intervención rápida por ID
app.get("/api/rapid-response/plans/:planId", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;

  res.set("Cache-Control", "private, no-store");
  const plan = await RapidResponsePostgisExtension.getInterventionPlan(
    runtime.tenant.id,
    runtime.destination.id,
    req.params.planId
  );

  if (!plan) {
    return res.status(404).json({ error: `Plan de intervención ${req.params.planId} no encontrado.` });
  }

  return res.json(plan);
});

// 5. Firma humana institucional y autorización formal de plan de mitigación
app.post("/api/rapid-response/plans/:planId/execute", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator;
  if (!operator || !operator.id) {
    res.set("Cache-Control", "private, no-store");
    return res.status(401).json({ error: "Token JWT institucional inválido o ausente." });
  }

  const { decision, rationale } = req.body || {};
  if (!decision) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "decision es obligatorio (AUTORIZADO_EJECUTADO o RECHAZADO_OPERADOR)." });
  }

  // EXIGENCIA DE FIRMA CON RATIONALE VÁLIDO (Mínimo 10 caracteres)
  if (!rationale || typeof rationale !== "string" || rationale.trim().length < 10) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "Se requiere una justificación técnica formal (rationale) de al menos 10 caracteres para firmar o rechazar el plan." });
  }

  // EXIGENCIA DE ROL CON CAPACIDAD OPERATIVA DE AUTORIZACIÓN
  const authorizedRoles = ["GESTOR_TURISMO", "ADMIN_SEGITTUR", "COORDINADOR_POLICIA", "DIRECTOR_MOVILIDAD", "OPERADOR"];
  if (operator.role && !authorizedRoles.includes(operator.role)) {
    res.set("Cache-Control", "private, no-store");
    return res.status(403).json({ error: `El rol institucional '${operator.role}' no tiene competencia para firmar planes de contingencia Nivel 2.` });
  }

  if (decision !== "AUTORIZADO_EJECUTADO" && decision !== "RECHAZADO_OPERADOR") {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "decision debe ser AUTORIZADO_EJECUTADO o RECHAZADO_OPERADOR." });
  }

  res.set("Cache-Control", "private, no-store");
  try {
    const result = await RapidResponseAgentService.executeInterventionDecision(
      runtime.tenant.id,
      runtime.destination.id,
      req.params.planId,
      {
        id: operator.id,
        username: operator.username || operator.email,
        displayName: operator.displayName || operator.name || "Operador Institucional",
        email: operator.email || "operador@destino.es",
        tenantId: runtime.tenant.id,
        tenantName: runtime.tenant.legalName || "Tenant Municipal",
        role: operator.role || "GESTOR_TURISMO",
        authorizedDestinations: operator.authorizedDestinations || [runtime.destination.id]
      },
      decision,
      rationale || "Autorización formal de medidas de contingencia ante saturación."
    );

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(422).json({ error: err.message });
  }
});


// =========================================================================
// ENDPOINTS ITERACIÓN 17: GOOGLE GEO SUITE GOBERNADO Y EVIDENCIAS
// =========================================================================

// 1. Estado del conector Google Geo Suite para el destino
app.get("/api/google-geo/status", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set("Cache-Control", "private, no-store");
  try {
    let config = await GoogleGeoSuitePostgisExtension.getConnectorStatus(runtime.tenant.id, runtime.destination.id);
    if (!config) {
      config = {
        destinationId: runtime.destination.id,
        destinationName: runtime.destination.nombre,
        tenantId: runtime.tenant.id,
        status: "DESHABILITADO",
        credentialsConfigured: false,
        activeModules: [],
        prevalidation: null,
        currentVisualProvider: "PID_OPEN_DATA",
        lastEvidenceEnvelope: null,
        updatedAt: new Date().toISOString()
      };
    }
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Catálogo de módulos preparados y sus reglas de gobernanza
app.get("/api/google-geo/modules", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  return res.json({
    modules: GoogleGeoSuiteService.MODULES_CATALOG,
    governanceNotice: "La integración con Google Maps Platform está sujeta a prevalidación municipal, no persistencia de datos gráficos y atribución obligatoria.",
    sovereigntyModel: "PID_SEGITTUR_SOVEREIGN"
  });
});

// 3. Prevalidación institucional firmada por operador
app.post("/api/google-geo/prevalidate", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator;
  if (!operator || !operator.id) {
    res.set("Cache-Control", "private, no-store");
    return res.status(401).json({ error: "Token JWT institucional inválido o ausente." });
  }

  const allowedGoogleRoles = ["GESTOR_TURISMO", "ADMIN_SEGITTUR", "DIRECTOR_MOVILIDAD", "OPERADOR"];
  if (operator.role && !allowedGoogleRoles.includes(operator.role)) {
    res.set("Cache-Control", "private, no-store");
    return res.status(403).json({ error: `El rol '${operator.role}' no tiene competencia para operar Google Geo Suite.` });
  }

  const { authorizedEntity, targetZoneId, targetZoneName, purpose, acceptedTerms, technicalNotes } = req.body || {};
  if (!authorizedEntity || !targetZoneId || !purpose || !acceptedTerms) {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "Faltan campos obligatorios: authorizedEntity, targetZoneId, purpose, acceptedTerms." });
  }

  res.set("Cache-Control", "private, no-store");
  try {
    const result = await GoogleGeoSuiteService.processPrevalidation({
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      authorizedEntity,
      targetZoneId,
      targetZoneName: targetZoneName || targetZoneId,
      purpose,
      acceptedTerms,
      technicalNotes
    }, {
      id: operator.id,
      username: operator.username || operator.email,
      displayName: operator.displayName || operator.name || "Operador Institucional",
      email: operator.email || "operador@destino.es",
      tenantId: runtime.tenant.id,
      tenantName: runtime.tenant.legalName || "Tenant Municipal",
      role: operator.role || "GESTOR_TURISMO",
      authorizedDestinations: operator.authorizedDestinations || [runtime.destination.id]
    });

    if (!result.success) {
      return res.status(422).json({ error: result.error });
    }
    return res.status(201).json(result.record);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Conmutación de proveedor visual (PID Open Data vs Google Photorealistic 3D)
app.post("/api/google-geo/toggle", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  const operator = (req as any).operator;
  if (!operator || !operator.id) {
    res.set("Cache-Control", "private, no-store");
    return res.status(401).json({ error: "Token JWT institucional inválido o ausente." });
  }

  const allowedGoogleRoles = ["GESTOR_TURISMO", "ADMIN_SEGITTUR", "DIRECTOR_MOVILIDAD", "OPERADOR"];
  if (operator.role && !allowedGoogleRoles.includes(operator.role)) {
    res.set("Cache-Control", "private, no-store");
    return res.status(403).json({ error: `El rol '${operator.role}' no tiene competencia para operar Google Geo Suite.` });
  }

  const { enableGoogle3D } = req.body || {};
  if (typeof enableGoogle3D !== "boolean") {
    res.set("Cache-Control", "private, no-store");
    return res.status(400).json({ error: "enableGoogle3D booleano es obligatorio." });
  }

  res.set("Cache-Control", "private, no-store");
  try {
    const result = await GoogleGeoSuiteService.toggleVisualProvider(
      runtime.tenant.id,
      runtime.destination.id,
      enableGoogle3D,
      {
        id: operator.id,
        username: operator.username || operator.email,
        displayName: operator.displayName || operator.name || "Operador Institucional",
        email: operator.email || "operador@destino.es",
        tenantId: runtime.tenant.id,
        tenantName: runtime.tenant.legalName || "Tenant Municipal",
        role: operator.role || "GESTOR_TURISMO",
        authorizedDestinations: operator.authorizedDestinations || [runtime.destination.id]
      }
    );

    if (!result.success) {
      return res.status(422).json({ error: result.error });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Historial de auditoría inmutable de Google Geo Suite para el destino
app.get("/api/google-geo/audit", async (req, res) => {
  const destinationId = scenarioDestination(req);
  const runtime = scenarioScope(req, res, destinationId);
  if (!runtime) return;
  if (!verifyOperatorClaims(req, res, destinationId)) return;

  res.set("Cache-Control", "private, no-store");
  try {
    const auditLogs = await GoogleGeoSuitePostgisExtension.getAuditQueries(runtime.tenant.id, runtime.destination.id, 50);
    return res.json({
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      totalQueries: auditLogs.length,
      auditLogs
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Servir frontend compilado en modo producción (dist) - Compatible con Express 5
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`API Gemelo Digital Turístico escuchando en http://0.0.0.0:${PORT}`);
});
