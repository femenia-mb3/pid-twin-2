import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { DESTINOS_DEMO } from '../data/demoData';
import contextPackageSchema from '../../context-package/schema/context-package-v1.schema.json';
import {
  CONTEXT_PACKAGE_TYPE,
  CONTEXT_PACKAGE_VERSION,
  ContextPackageImportResult,
  ContextPackageValidationIssue,
  ContextPackageValidationReport,
  ContextPackageV1,
} from '../types/contextPackage';
import { RecursoTuristico, SensorIoT, ZonaDestino } from '../types/ontology';
import { SEMANTIC_CONTEXT_URL, SEMANTIC_PROFILE_ID } from '../types/semantic';
import { postgisRepository } from './postgisRepository';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;
const INE_PATTERN = /^[0-9]{5}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SUPPORTED_FORMATS = new Set(['NGSI_LD', 'GEOJSON', 'CSV', 'REST_JSON', 'MQTT', 'OGC_API_FEATURES', 'WMS_WFS']);
const SUPPORTED_SPATIAL_LEVELS = new Set(['NIVEL_1_2D_25D', 'NIVEL_2_EDIFICIOS', 'NIVEL_3_3D_TILES']);
const SUPPORTED_GOVERNANCE_SOURCES = new Set(['pid_turistico', 'territorial_ign', 'tiempo_real_iot']);
const SUPPORTED_QUALITIES = new Set(['A_CERTIFICADA', 'B_ESTIMADA', 'C_EN_VALIDACION']);
const SUPPORTED_FREQUENCIES = new Set(['TIEMPO_REAL', 'HORARIA', 'DIARIA', 'MENSUAL']);
const SUPPORTED_LANES = new Set(['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO']);
const SUPPORTED_PRIVACY = new Set(['PUBLICO', 'INTERNO', 'RESTRINGIDO', 'ANONIMIZADO']);
const SUPPORTED_AUTHORIZATION = new Set(['AUTORIZADO', 'PENDIENTE', 'NO_AUTORIZADO']);
const SEMANTIC_ENTITY_MAPPINGS = {
  destination: 'TouristDestination',
  zone: 'TourismZone',
  resource: 'TourismResource',
  sensor: 'TourismSensor',
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(contextPackageSchema);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isValidDate = (value: unknown): value is string => isNonEmptyString(value)
  && ISO_DATE_TIME_PATTERN.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;
const isValidId = (value: unknown): value is string => isNonEmptyString(value) && ID_PATTERN.test(value);
const isCoordinate = (value: unknown, limit: number) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

const issue = (code: string, path: string, message: string): ContextPackageValidationIssue => ({ code, path, message });

const summarize = (candidate: unknown) => {
  const root = isRecord(candidate) ? candidate : {};
  const context = isRecord(root.context) ? root.context : {};
  return {
    zones: Array.isArray(context.zones) ? context.zones.length : 0,
    resources: Array.isArray(context.resources) ? context.resources.length : 0,
    sensors: Array.isArray(context.sensors) ? context.sensors.length : 0,
    sources: Array.isArray(context.dataSources) ? context.dataSources.length : 0,
    variables: Array.isArray(context.variables) ? context.variables.length : 0,
  };
};

const validateGovernance = (value: unknown, path: string, errors: ContextPackageValidationIssue[]) => {
  if (!isRecord(value)) {
    errors.push(issue('GOVERNANCE_REQUIRED', path, 'Toda entidad operativa debe declarar gobernanza y trazabilidad.'));
    return;
  }
  ['fuente', 'tipoFuente', 'calidad', 'ultimaActualizacion', 'frecuenciaActualizacion', 'trazabilidadId'].forEach(field => {
    if (!isNonEmptyString(value[field])) errors.push(issue('GOVERNANCE_FIELD_REQUIRED', `${path}.${field}`, `Falta el campo de gobernanza ${field}.`));
  });
  if (isNonEmptyString(value.ultimaActualizacion) && !isValidDate(value.ultimaActualizacion)) {
    errors.push(issue('GOVERNANCE_DATE_INVALID', `${path}.ultimaActualizacion`, 'La fecha de actualización debe ser ISO-8601 válida.'));
  }
  if (isNonEmptyString(value.tipoFuente) && !SUPPORTED_GOVERNANCE_SOURCES.has(value.tipoFuente)) errors.push(issue('GOVERNANCE_SOURCE_TYPE_INVALID', `${path}.tipoFuente`, 'El tipo de fuente de gobernanza no está soportado.'));
  if (isNonEmptyString(value.calidad) && !SUPPORTED_QUALITIES.has(value.calidad)) errors.push(issue('GOVERNANCE_QUALITY_INVALID', `${path}.calidad`, 'La calidad de gobernanza no está soportada.'));
  if (isNonEmptyString(value.frecuenciaActualizacion) && !SUPPORTED_FREQUENCIES.has(value.frecuenciaActualizacion)) errors.push(issue('GOVERNANCE_FREQUENCY_INVALID', `${path}.frecuenciaActualizacion`, 'La frecuencia de gobernanza no está soportada.'));
};

type PlanarPoint = [number, number];

const samePoint = ([x1, y1]: PlanarPoint, [x2, y2]: PlanarPoint) => x1 === x2 && y1 === y2;
const signedArea = (points: PlanarPoint[]) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;
const orientation = (a: PlanarPoint, b: PlanarPoint, c: PlanarPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const isOnSegment = (a: PlanarPoint, b: PlanarPoint, p: PlanarPoint) => Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
const segmentsIntersect = (a: PlanarPoint, b: PlanarPoint, c: PlanarPoint, d: PlanarPoint) => {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if ((abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)) return true;
  const epsilon = 1e-12;
  return (Math.abs(abC) < epsilon && isOnSegment(a, b, c)) || (Math.abs(abD) < epsilon && isOnSegment(a, b, d)) || (Math.abs(cdA) < epsilon && isOnSegment(c, d, a)) || (Math.abs(cdB) < epsilon && isOnSegment(c, d, b));
};

const validatePolygon = (value: unknown, path: string, errors: ContextPackageValidationIssue[]) => {
  if (!Array.isArray(value) || value.length < 3) {
    errors.push(issue('GEOMETRY_POLYGON_REQUIRED', path, 'Cada zona debe aportar al menos tres coordenadas [latitud, longitud].'));
    return;
  }
  value.forEach((position, index) => {
    if (!Array.isArray(position) || position.length !== 2 || !isCoordinate(position[0], 90) || !isCoordinate(position[1], 180)) {
      errors.push(issue('GEOMETRY_COORDINATE_INVALID', `${path}[${index}]`, 'La coordenada debe ser [latitud, longitud] dentro del rango EPSG:4326.'));
    }
  });
  if (errors.some(error => error.path.startsWith(path))) return;
  const ring = value.map(position => [position[1] as number, position[0] as number] as PlanarPoint);
  if (ring.length > 3 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();
  if (new Set(ring.map(point => point.join(','))).size < 3 || Math.abs(signedArea(ring)) < 1e-12) {
    errors.push(issue('GEOMETRY_DEGENERATE', path, 'El polígono debe encerrar una superficie no degenerada.'));
    return;
  }
  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    for (let other = index + 1; other < ring.length; other += 1) {
      const otherNext = (other + 1) % ring.length;
      if (index === other || next === other || index === otherNext || (index === 0 && otherNext === 0)) continue;
      if (segmentsIntersect(ring[index], ring[next], ring[other], ring[otherNext])) {
        errors.push(issue('GEOMETRY_SELF_INTERSECTION', path, 'El polígono de zona no puede autointersecarse.'));
        return;
      }
    }
  }
};

const validatePoint = (value: unknown, path: string, errors: ContextPackageValidationIssue[]) => {
  if (!Array.isArray(value) || value.length !== 2 || !isCoordinate(value[0], 90) || !isCoordinate(value[1], 180)) {
    errors.push(issue('GEOMETRY_POINT_INVALID', path, 'La ubicación debe ser [latitud, longitud] dentro del rango EPSG:4326.'));
  }
};

/**
 * Registro de la demo: no simula persistencia. El estado se pierde al reiniciar
 * el proceso; la migración 005 contiene el equivalente relacional para PostGIS.
 */
class ContextPackageRegistry {
  private readonly importedPackages = new Map<string, ContextPackageV1>();

  private knownDestinationIds() {
    return new Set([
      ...DESTINOS_DEMO.map(destination => destination.id),
      ...Array.from(this.importedPackages.values()).map(contextPackage => contextPackage.destination.id),
    ]);
  }

  validate(candidate: unknown): ContextPackageValidationReport {
    const errors: ContextPackageValidationIssue[] = [];
    const warnings: ContextPackageValidationIssue[] = [];
    const summary = summarize(candidate);

    if (!isRecord(candidate)) {
      return { valid: false, errors: [issue('PACKAGE_OBJECT_REQUIRED', '$', 'El ContextPackage debe ser un objeto JSON.')], warnings, summary, validatedAt: new Date().toISOString() };
    }

    if (!validateSchema(candidate)) {
      (validateSchema.errors || []).forEach(schemaError => {
        const path = schemaError.instancePath || '$';
        const detail = schemaError.message || 'Incumple el JSON Schema ContextPackage v1.';
        errors.push(issue(`SCHEMA_${schemaError.keyword.toUpperCase()}`, path, detail));
      });
    }

    if (candidate.type !== CONTEXT_PACKAGE_TYPE) errors.push(issue('PACKAGE_TYPE_INVALID', 'type', `Se requiere type=${CONTEXT_PACKAGE_TYPE}.`));
    if (candidate.schemaVersion !== CONTEXT_PACKAGE_VERSION) errors.push(issue('SCHEMA_VERSION_UNSUPPORTED', 'schemaVersion', `La versión soportada es ${CONTEXT_PACKAGE_VERSION}.`));
    if (!isValidId(candidate.id)) errors.push(issue('PACKAGE_ID_INVALID', 'id', 'El id debe usar minúsculas, números y guiones.'));
    if (!isNonEmptyString(candidate.title) || candidate.title.length < 5) errors.push(issue('TITLE_REQUIRED', 'title', 'El título debe contener al menos cinco caracteres.'));
    if (!isNonEmptyString(candidate.purpose) || candidate.purpose.length < 10) errors.push(issue('PURPOSE_REQUIRED', 'purpose', 'Debe declarar una finalidad explícita para el paquete.'));
    if (!isValidDate(candidate.createdAt)) errors.push(issue('CREATED_AT_INVALID', 'createdAt', 'createdAt debe ser una fecha ISO-8601 válida.'));

    const tenant = candidate.tenant;
    if (!isRecord(tenant)) {
      errors.push(issue('TENANT_REQUIRED', 'tenant', 'Debe declarar el tenant responsable del destino.'));
    } else {
      if (!isValidId(tenant.id)) errors.push(issue('TENANT_ID_INVALID', 'tenant.id', 'El identificador del tenant no es válido.'));
      if (!isNonEmptyString(tenant.legalName)) errors.push(issue('TENANT_NAME_REQUIRED', 'tenant.legalName', 'Falta la razón social o entidad responsable.'));
      if (!['PUBLICA', 'MIXTA', 'RESTRINGIDA'].includes(String(tenant.dataPolicy))) errors.push(issue('TENANT_POLICY_INVALID', 'tenant.dataPolicy', 'La política de datos debe ser PUBLICA, MIXTA o RESTRINGIDA.'));
    }

    const destination = candidate.destination;
    if (!isRecord(destination)) {
      errors.push(issue('DESTINATION_REQUIRED', 'destination', 'Debe declarar un destino de alta.'));
    } else {
      const destinationId = destination.id;
      if (!isValidId(destinationId)) errors.push(issue('DESTINATION_ID_INVALID', 'destination.id', 'El identificador de destino no es válido.'));
      if (isValidId(destinationId) && this.knownDestinationIds().has(destinationId)) errors.push(issue('DESTINATION_ID_COLLISION', 'destination.id', `Ya existe un destino registrado con id ${destinationId}.`));
      if (!isNonEmptyString(destination.nombre)) errors.push(issue('DESTINATION_NAME_REQUIRED', 'destination.nombre', 'Falta el nombre del destino.'));
      if (!isNonEmptyString(destination.codigoIne) || !INE_PATTERN.test(destination.codigoIne)) errors.push(issue('INE_CODE_INVALID', 'destination.codigoIne', 'El código INE debe tener cinco dígitos.'));
      if (!isNonEmptyString(destination.comunidadAutonoma)) errors.push(issue('DESTINATION_REGION_REQUIRED', 'destination.comunidadAutonoma', 'Falta la comunidad autónoma o ámbito territorial.'));
      validatePoint(destination.centro, 'destination.centro', errors);
      if (!Number.isInteger(destination.zoomInicial) || (destination.zoomInicial as number) < 8 || (destination.zoomInicial as number) > 19) errors.push(issue('DESTINATION_ZOOM_INVALID', 'destination.zoomInicial', 'El zoom inicial debe estar entre 8 y 19.'));
      if (typeof destination.poblacionCensada !== 'number' || destination.poblacionCensada < 0) errors.push(issue('DESTINATION_POPULATION_INVALID', 'destination.poblacionCensada', 'La población censada debe ser un número no negativo.'));
      if (typeof destination.capacidadCargaMaximaTeorica !== 'number' || destination.capacidadCargaMaximaTeorica <= 0) errors.push(issue('CAPACITY_REQUIRED', 'destination.capacidadCargaMaximaTeorica', 'El perfil de destino necesita una capacidad de carga positiva.'));
      if (!isNonEmptyString(destination.descripcion) || destination.descripcion.length < 10) errors.push(issue('DESTINATION_DESCRIPTION_REQUIRED', 'destination.descripcion', 'La descripción del destino debe contener al menos diez caracteres.'));
    }

    const context = candidate.context;
    if (!isRecord(context)) {
      errors.push(issue('CONTEXT_REQUIRED', 'context', 'Debe declarar el contexto operacional del destino.'));
    } else {
      if (context.crs !== 'EPSG:4326') errors.push(issue('CRS_UNSUPPORTED', 'context.crs', 'ContextPackage v1 requiere coordenadas EPSG:4326.'));
      if (!isNonEmptyString(context.timezone)) errors.push(issue('TIMEZONE_REQUIRED', 'context.timezone', 'Debe declarar zona horaria.'));
      if (!isNonEmptyString(context.locale)) errors.push(issue('LOCALE_REQUIRED', 'context.locale', 'Debe declarar locale del destino.'));

      const profile = context.modelProfile;
      if (!isRecord(profile)) {
        errors.push(issue('MODEL_PROFILE_REQUIRED', 'context.modelProfile', 'Debe declarar el perfil de capacidad del modelo.'));
      } else {
        if (!isValidId(profile.id)) errors.push(issue('MODEL_PROFILE_ID_INVALID', 'context.modelProfile.id', 'El id del perfil de modelo no es válido.'));
        if (!isNonEmptyString(profile.name)) errors.push(issue('MODEL_PROFILE_NAME_REQUIRED', 'context.modelProfile.name', 'Falta el nombre del perfil de modelo.'));
        if (!isNonEmptyString(profile.version) || !/^\d+\.\d+(\.\d+)?$/.test(profile.version)) errors.push(issue('MODEL_PROFILE_VERSION_INVALID', 'context.modelProfile.version', 'La versión del perfil debe tener formato semántico numérico.'));
        if (!Array.isArray(profile.enabledDomains) || profile.enabledDomains.length === 0 || profile.enabledDomains.some(domain => !isNonEmptyString(domain))) errors.push(issue('MODEL_PROFILE_DOMAINS_INVALID', 'context.modelProfile.enabledDomains', 'Debe declarar al menos un dominio habilitado.'));
        if (!SUPPORTED_SPATIAL_LEVELS.has(String(profile.activeSpatialLevel))) errors.push(issue('SPATIAL_LEVEL_INVALID', 'context.modelProfile.activeSpatialLevel', 'El nivel espacial declarado no está soportado.'));
        const capacityProfile = profile.capacityProfile;
        if (!isRecord(capacityProfile) || typeof capacityProfile.alertThresholdPct !== 'number' || capacityProfile.alertThresholdPct <= 0 || capacityProfile.alertThresholdPct > 100 || typeof capacityProfile.theoreticalCapacity !== 'number' || capacityProfile.theoreticalCapacity <= 0) {
          errors.push(issue('CAPACITY_PROFILE_INVALID', 'context.modelProfile.capacityProfile', 'El perfil de capacidad debe incluir umbral entre 1 y 100 y capacidad positiva.'));
        }
      }

      const zones = context.zones;
      if (!Array.isArray(zones) || zones.length === 0) {
        errors.push(issue('ZONES_REQUIRED', 'context.zones', 'El paquete necesita al menos una zona operativa.'));
      } else {
        const ids = new Set<string>();
        zones.forEach((zone, index) => {
          if (!isRecord(zone)) return errors.push(issue('ZONE_OBJECT_INVALID', `context.zones[${index}]`, 'La zona debe ser un objeto.'));
          if (!isValidId(zone.id) || ids.has(String(zone.id))) errors.push(issue('ZONE_ID_INVALID', `context.zones[${index}].id`, 'El id de zona debe ser único y válido.'));
          ids.add(String(zone.id));
          if (destination && isRecord(destination) && zone.destinoId !== destination.id) errors.push(issue('ZONE_DESTINATION_MISMATCH', `context.zones[${index}].destinoId`, 'La zona no pertenece al destino declarado.'));
          if (!isNonEmptyString(zone.nombre) || !isNonEmptyString(zone.capa) || !isNonEmptyString(zone.tipoZona)) errors.push(issue('ZONE_OPERATIONAL_FIELDS_REQUIRED', `context.zones[${index}]`, 'La zona debe declarar nombre, capa y tipo operativo.'));
          if (typeof zone.aforoMaximo !== 'number' || zone.aforoMaximo <= 0) errors.push(issue('ZONE_CAPACITY_INVALID', `context.zones[${index}].aforoMaximo`, 'El aforo de zona debe ser positivo.'));
          if (typeof zone.afluenciaActual !== 'number' || zone.afluenciaActual < 0) errors.push(issue('ZONE_FLOW_INVALID', `context.zones[${index}].afluenciaActual`, 'La afluencia no puede ser negativa.'));
          if (typeof zone.capacidadCargaPct !== 'number' || zone.capacidadCargaPct < 0 || zone.capacidadCargaPct > 150) errors.push(issue('ZONE_LOAD_INVALID', `context.zones[${index}].capacidadCargaPct`, 'La capacidad de carga debe estar entre 0 y 150.'));
          validatePolygon(zone.coordenadasPoligono, `context.zones[${index}].coordenadasPoligono`, errors);
          validateGovernance(zone.gobernanza, `context.zones[${index}].gobernanza`, errors);
        });
      }

      const entityCollections: Array<[string, unknown, 'ubicacion' | 'coordenadasPoligono']> = [
        ['resources', context.resources, 'ubicacion'],
        ['sensors', context.sensors, 'ubicacion'],
      ];
      entityCollections.forEach(([collectionName, values, coordinateKey]) => {
        if (!Array.isArray(values)) return errors.push(issue('ENTITY_COLLECTION_INVALID', `context.${collectionName}`, `context.${collectionName} debe ser un array.`));
        const ids = new Set<string>();
        values.forEach((entity, index) => {
          if (!isRecord(entity)) return errors.push(issue('ENTITY_OBJECT_INVALID', `context.${collectionName}[${index}]`, 'La entidad debe ser un objeto.'));
          if (!isValidId(entity.id) || ids.has(String(entity.id))) errors.push(issue('ENTITY_ID_INVALID', `context.${collectionName}[${index}].id`, 'El id de entidad debe ser único y válido.'));
          ids.add(String(entity.id));
          if (destination && isRecord(destination) && entity.destinoId !== destination.id) errors.push(issue('ENTITY_DESTINATION_MISMATCH', `context.${collectionName}[${index}].destinoId`, 'La entidad no pertenece al destino declarado.'));
          if (!isNonEmptyString(entity.nombre)) errors.push(issue('ENTITY_NAME_REQUIRED', `context.${collectionName}[${index}].nombre`, 'La entidad debe declarar nombre.'));
          validatePoint(entity[coordinateKey], `context.${collectionName}[${index}].${coordinateKey}`, errors);
          validateGovernance(entity.gobernanza, `context.${collectionName}[${index}].gobernanza`, errors);
          if (collectionName === 'resources') {
            if (!isNonEmptyString(entity.categoria) || typeof entity.aforoMaximo !== 'number' || entity.aforoMaximo <= 0 || typeof entity.visitantesHora !== 'number' || entity.visitantesHora < 0 || !isNonEmptyString(entity.horario)) {
              errors.push(issue('RESOURCE_OPERATIONAL_FIELDS_INVALID', `context.resources[${index}]`, 'El recurso debe declarar categoría, aforo, visitantes/hora y horario válidos.'));
            }
          }
          if (collectionName === 'sensors') {
            if (!isNonEmptyString(entity.tipoSensor) || typeof entity.valorActual !== 'number' || !isNonEmptyString(entity.unidad) || typeof entity.umbralAlerta !== 'number' || !['NORMAL', 'PRECAUCION', 'CRITICO'].includes(String(entity.estado))) {
              errors.push(issue('SENSOR_OPERATIONAL_FIELDS_INVALID', `context.sensors[${index}]`, 'El sensor debe declarar tipo, valor, unidad, umbral y estado válidos.'));
            }
          }
        });
      });

      const sources = context.dataSources;
      if (!Array.isArray(sources) || sources.length === 0) {
        errors.push(issue('SOURCES_REQUIRED', 'context.dataSources', 'El paquete necesita al menos una fuente declarada.'));
      } else {
        const sourceIds = new Set<string>();
        sources.forEach((source, index) => {
          if (!isRecord(source)) return errors.push(issue('SOURCE_OBJECT_INVALID', `context.dataSources[${index}]`, 'La fuente debe ser un objeto.'));
          if (!isValidId(source.id) || sourceIds.has(String(source.id))) errors.push(issue('SOURCE_ID_INVALID', `context.dataSources[${index}].id`, 'El id de fuente debe ser único y válido.'));
          sourceIds.add(String(source.id));
          if (!isNonEmptyString(source.name)) errors.push(issue('SOURCE_NAME_REQUIRED', `context.dataSources[${index}].name`, 'La fuente debe declarar nombre.'));
          if (!SUPPORTED_LANES.has(String(source.lane))) errors.push(issue('SOURCE_LANE_INVALID', `context.dataSources[${index}].lane`, 'El carril de interoperabilidad no está soportado.'));
          if (!SUPPORTED_FORMATS.has(String(source.format))) errors.push(issue('SOURCE_FORMAT_UNSUPPORTED', `context.dataSources[${index}].format`, 'El formato de fuente no está soportado.'));
          if (!SUPPORTED_FREQUENCIES.has(String(source.updateFrequency))) errors.push(issue('SOURCE_FREQUENCY_INVALID', `context.dataSources[${index}].updateFrequency`, 'La frecuencia de fuente no está soportada.'));
          if (!SUPPORTED_QUALITIES.has(String(source.dataQuality))) errors.push(issue('SOURCE_QUALITY_INVALID', `context.dataSources[${index}].dataQuality`, 'La calidad de fuente no está soportada.'));
          if (!SUPPORTED_PRIVACY.has(String(source.privacy))) errors.push(issue('SOURCE_PRIVACY_INVALID', `context.dataSources[${index}].privacy`, 'La clasificación de privacidad no está soportada.'));
          if (!SUPPORTED_AUTHORIZATION.has(String(source.authorization))) errors.push(issue('SOURCE_AUTHORIZATION_INVALID', `context.dataSources[${index}].authorization`, 'El estado de autorización no está soportado.'));
          if (!isNonEmptyString(source.purpose)) errors.push(issue('SOURCE_PURPOSE_REQUIRED', `context.dataSources[${index}].purpose`, 'La fuente debe declarar su finalidad.'));
          if (!isNonEmptyString(source.traceabilityId)) errors.push(issue('SOURCE_TRACEABILITY_REQUIRED', `context.dataSources[${index}].traceabilityId`, 'Cada fuente debe incluir trazabilidad.'));
          if (source.authorization === 'NO_AUTORIZADO') errors.push(issue('SOURCE_NOT_AUTHORIZED', `context.dataSources[${index}].authorization`, 'No se puede importar una fuente no autorizada.'));
          if (source.authorization === 'PENDIENTE') warnings.push(issue('SOURCE_AUTHORIZATION_PENDING', `context.dataSources[${index}].authorization`, 'La fuente queda registrada como pendiente de autorización antes de activarse en producción.'));
          if (source.dataQuality === 'B_ESTIMADA' || source.dataQuality === 'C_EN_VALIDACION') warnings.push(issue('SOURCE_QUALITY_PENDING', `context.dataSources[${index}].dataQuality`, 'La calidad declarada requiere revisión antes de utilizarla para predicción real.'));
        });

        const variables = context.variables;
        if (!Array.isArray(variables) || variables.length === 0) {
          errors.push(issue('VARIABLES_REQUIRED', 'context.variables', 'Debe declarar al menos una variable de contexto.'));
        } else {
          variables.forEach((variable, index) => {
            if (!isRecord(variable)) return errors.push(issue('VARIABLE_OBJECT_INVALID', `context.variables[${index}]`, 'La variable debe ser un objeto.'));
            if (!isValidId(variable.id)) errors.push(issue('VARIABLE_ID_INVALID', `context.variables[${index}].id`, 'El id de variable no es válido.'));
            if (!isNonEmptyString(variable.unit)) errors.push(issue('VARIABLE_UNIT_REQUIRED', `context.variables[${index}].unit`, 'Cada variable debe declarar su unidad.'));
            if (!isNonEmptyString(variable.sourceId) || !sourceIds.has(variable.sourceId)) errors.push(issue('VARIABLE_SOURCE_UNKNOWN', `context.variables[${index}].sourceId`, 'La variable debe referirse a una fuente declarada.'));
          });
        }
      }
    }

    const semantic = candidate.semanticMapping;
    if (!isRecord(semantic)) {
      errors.push(issue('SEMANTIC_MAPPING_REQUIRED', 'semanticMapping', 'Debe declarar el mapeo semántico NGSI-LD.'));
    } else {
      if (semantic.contextUrl !== SEMANTIC_CONTEXT_URL) errors.push(issue('SEMANTIC_CONTEXT_INVALID', 'semanticMapping.contextUrl', `ContextPackage v1 requiere ${SEMANTIC_CONTEXT_URL}.`));
      if (semantic.ontologyProfile !== SEMANTIC_PROFILE_ID) errors.push(issue('SEMANTIC_PROFILE_INVALID', 'semanticMapping.ontologyProfile', `ContextPackage v1 requiere ${SEMANTIC_PROFILE_ID}.`));
      const destinationId = isRecord(destination) && isValidId(destination.id) ? destination.id : undefined;
      const expectedNamespace = destinationId ? `urn:ngsi-ld:pid:${destinationId}:` : undefined;
      if (!isNonEmptyString(semantic.namespace) || semantic.namespace !== expectedNamespace) errors.push(issue('SEMANTIC_NAMESPACE_INVALID', 'semanticMapping.namespace', `El namespace debe coincidir con ${expectedNamespace || 'el destino declarado'}.`));
      const entityMappings = semantic.entityMappings;
      if (!isRecord(entityMappings)) {
        errors.push(issue('SEMANTIC_ENTITY_MAPPINGS_REQUIRED', 'semanticMapping.entityMappings', 'Debe declarar el mapeo de las cuatro entidades del perfil.'));
      } else {
        Object.entries(SEMANTIC_ENTITY_MAPPINGS).forEach(([key, expectedValue]) => {
          if (entityMappings[key] !== expectedValue) errors.push(issue('SEMANTIC_ENTITY_MAPPING_INVALID', `semanticMapping.entityMappings.${key}`, `Se requiere ${expectedValue}.`));
        });
      }
    }

    const evidence = candidate.evidence;
    if (!isRecord(evidence)) {
      errors.push(issue('EVIDENCE_REQUIRED', 'evidence', 'Debe declarar licencia, cobertura y procedencia.'));
    } else {
      if (!isNonEmptyString(evidence.license)) errors.push(issue('LICENSE_REQUIRED', 'evidence.license', 'Falta la licencia de los datos.'));
      if (!isValidDate(evidence.cutOffDate)) errors.push(issue('CUTOFF_DATE_INVALID', 'evidence.cutOffDate', 'La fecha de corte debe ser ISO-8601 válida.'));
      if (!isNonEmptyString(evidence.coverageNote)) errors.push(issue('COVERAGE_REQUIRED', 'evidence.coverageNote', 'Falta la nota de cobertura del paquete.'));
      if (!isNonEmptyString(evidence.provenance)) errors.push(issue('PROVENANCE_REQUIRED', 'evidence.provenance', 'Falta la procedencia declarada.'));
      if (typeof evidence.syntheticDemoData !== 'boolean') errors.push(issue('SYNTHETIC_FLAG_REQUIRED', 'evidence.syntheticDemoData', 'Debe declarar si el paquete contiene datos sintéticos.'));
      if (evidence.syntheticDemoData === true) warnings.push(issue('SYNTHETIC_DEMO_DATA', 'evidence.syntheticDemoData', 'El paquete contiene datos sintéticos: no debe presentarse como una predicción ni como dato municipal real.'));
    }

    return {
      valid: errors.length === 0,
      packageId: isNonEmptyString(candidate.id) ? candidate.id : undefined,
      errors,
      warnings,
      summary,
      validatedAt: new Date().toISOString(),
    };
  }

  import(candidate: unknown): ContextPackageImportResult | { type: 'ContextPackageImportRejected'; persistence: 'REJECTED'; report: ContextPackageValidationReport } {
    const report = this.validate(candidate);
    if (!report.valid) return { type: 'ContextPackageImportRejected', persistence: 'REJECTED', report };
    const contextPackage = candidate as ContextPackageV1;
    this.importedPackages.set(contextPackage.id, structuredClone(contextPackage));
    postgisRepository.persistContextPackage(contextPackage, report).catch(err => {
      console.warn('[ContextPackageService] Persistencia PostGIS background error:', err);
    });
    return {
      type: 'ContextPackageImportResult',
      persistence: 'MEMORY_DEMO_NOT_PERSISTED',
      package: structuredClone(contextPackage),
      report,
      importedAt: new Date().toISOString(),
    };
  }

  async importAsync(candidate: unknown): Promise<ContextPackageImportResult | { type: 'ContextPackageImportRejected'; persistence: 'REJECTED'; report: ContextPackageValidationReport }> {
    const report = this.validate(candidate);
    if (!report.valid) return { type: 'ContextPackageImportRejected', persistence: 'REJECTED', report };
    const contextPackage = candidate as ContextPackageV1;
    this.importedPackages.set(contextPackage.id, structuredClone(contextPackage));

    let persistenceMode: 'MEMORY_DEMO_NOT_PERSISTED' | 'POSTGIS_PERSISTED' = 'MEMORY_DEMO_NOT_PERSISTED';
    try {
      const pgRes = await postgisRepository.persistContextPackage(contextPackage, report);
      if (pgRes.success) {
        persistenceMode = 'POSTGIS_PERSISTED';
      }
    } catch (err) {
      console.warn('[ContextPackageService] Persistencia PostGIS omitida o fallida, fallback a memoria:', err);
    }

    return {
      type: 'ContextPackageImportResult',
      persistence: persistenceMode,
      package: structuredClone(contextPackage),
      report,
      importedAt: new Date().toISOString(),
    };
  }

  getPackages() {
    return Array.from(this.importedPackages.values()).map(contextPackage => structuredClone(contextPackage));
  }

  getPackage(packageId: string) {
    const contextPackage = this.importedPackages.get(packageId);
    return contextPackage ? structuredClone(contextPackage) : undefined;
  }

  getByDestination(destinationId: string) {
    const contextPackage = Array.from(this.importedPackages.values()).find(item => item.destination.id === destinationId);
    return contextPackage ? structuredClone(contextPackage) : undefined;
  }

  getDestinations() {
    return [...DESTINOS_DEMO, ...this.getPackages().map(contextPackage => contextPackage.destination)];
  }

  getRuntimeData(destinationId: string): { zones: ZonaDestino[]; resources: RecursoTuristico[]; sensors: SensorIoT[] } | undefined {
    const contextPackage = this.getByDestination(destinationId);
    if (!contextPackage) return undefined;
    return {
      zones: contextPackage.context.zones,
      resources: contextPackage.context.resources,
      sensors: contextPackage.context.sensors,
    };
  }

  zonesGeoJson(destinationId: string) {
    const contextPackage = this.getByDestination(destinationId);
    if (!contextPackage) return undefined;
    return {
      type: 'FeatureCollection',
      features: contextPackage.context.zones.map(zone => ({
        type: 'Feature',
        id: zone.id,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            ...zone.coordenadasPoligono.map(([lat, lng]) => [lng, lat]),
            [zone.coordenadasPoligono[0][1], zone.coordenadasPoligono[0][0]],
          ]],
        },
        properties: { ...zone, source: 'ContextPackage v1' },
      })),
    };
  }

  resourcesGeoJson(destinationId: string) {
    const contextPackage = this.getByDestination(destinationId);
    if (!contextPackage) return undefined;
    return {
      type: 'FeatureCollection',
      features: contextPackage.context.resources.map(resource => ({
        type: 'Feature',
        id: resource.id,
        geometry: { type: 'Point', coordinates: [resource.ubicacion[1], resource.ubicacion[0]] },
        properties: { ...resource, source: 'ContextPackage v1' },
      })),
    };
  }

  sensorsGeoJson(destinationId: string) {
    const contextPackage = this.getByDestination(destinationId);
    if (!contextPackage) return undefined;
    return {
      type: 'FeatureCollection',
      features: contextPackage.context.sensors.map(sensor => ({
        type: 'Feature',
        id: sensor.id,
        geometry: { type: 'Point', coordinates: [sensor.ubicacion[1], sensor.ubicacion[0]] },
        properties: { ...sensor, source: 'ContextPackage v1' },
      })),
    };
  }
}

export const ContextPackageService = new ContextPackageRegistry();
