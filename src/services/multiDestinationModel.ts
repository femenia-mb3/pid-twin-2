import { DESTINOS_DEMO, ESCENARIOS_PREDEFINIDOS, RECURSOS_DEMO, SENSORES_DEMO, ZONAS_DEMO } from '../data/demoData';
import { DATASETS_3D_CATALOG } from './catalog3DService';
import {
  DestinationSemanticProfile,
  NgsiLdEntity,
  NgsiLdEntityType,
  NgsiLdProperty,
  NgsiLdRelationship,
  SemanticModelDescriptor,
  SEMANTIC_CONTEXT_URL,
  SEMANTIC_PROFILE_ID,
} from '../types/semantic';
import { DataGovernance } from '../types/ontology';

const now = () => new Date().toISOString();

const property = <T>(value: T, observedAt?: string, unitCode?: string): NgsiLdProperty<T> => ({
  type: 'Property',
  value,
  ...(observedAt ? { observedAt } : {}),
  ...(unitCode ? { unitCode } : {}),
});

const relationship = (object: string): NgsiLdRelationship => ({ type: 'Relationship', object });

const slug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const destinationUrn = (destinationId: string) => `urn:ngsi-ld:TouristDestination:${destinationId}`;
const entityUrn = (type: NgsiLdEntityType, destinationId: string, id: string) => `urn:ngsi-ld:${type}:${destinationId}:${slug(id)}`;
const sourceUrn = (destinationId: string, source: string) => entityUrn('DataSource', destinationId, source);

/**
 * Cada perfil declara únicamente configuración, gobernanza y capacidades de un destino.
 * Los datos están siempre separados por destinationId y se representarán de forma persistente
 * en destino_perfiles_semanticos + registro_entidades_contexto en el piloto PostGIS.
 */
export const DESTINATION_SEMANTIC_PROFILES: DestinationSemanticProfile[] = [
  {
    id: 'profile_malaga_v1',
    tenantId: 'tenant_ayto_malaga',
    tenantName: 'Ayuntamiento de Málaga',
    destinationId: 'malaga',
    destinationName: 'Málaga',
    ineCode: '29067',
    namespace: 'urn:ngsi-ld:pid:malaga:',
    contextUrl: SEMANTIC_CONTEXT_URL,
    semanticProfile: SEMANTIC_PROFILE_ID,
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
    spatialLevels: ['NIVEL_1_2D_25D', 'NIVEL_2_EDIFICIOS', 'NIVEL_3_3D_TILES'],
    activeSpatialLevel: 'NIVEL_3_3D_TILES',
    enabledDomains: ['turismo', 'movilidad', 'medio_ambiente', 'infraestructuras', 'eventos', 'socioeconomica'],
    dataPolicy: 'MIXTA',
    evidence: {
      source: 'Perfil operativo de demo configurado en el Gemelo Digital Turístico',
      sourceUrl: '/api/semantic/profiles/profile_malaga_v1',
      reviewedAt: '2026-09-29T00:00:00.000Z'
    }
  },
  {
    id: 'profile_palma_v1',
    tenantId: 'tenant_ayto_palma',
    tenantName: 'Ajuntament de Palma',
    destinationId: 'palma',
    destinationName: 'Palma',
    ineCode: '07040',
    namespace: 'urn:ngsi-ld:pid:palma:',
    contextUrl: SEMANTIC_CONTEXT_URL,
    semanticProfile: SEMANTIC_PROFILE_ID,
    timezone: 'Europe/Madrid',
    locale: 'ca-ES',
    spatialLevels: ['NIVEL_1_2D_25D', 'NIVEL_2_EDIFICIOS'],
    activeSpatialLevel: 'NIVEL_1_2D_25D',
    enabledDomains: ['turismo', 'movilidad', 'medio_ambiente', 'eventos'],
    dataPolicy: 'MIXTA',
    evidence: {
      source: 'Perfil de segundo destino demostrador configurado en el Gemelo Digital Turístico',
      sourceUrl: '/api/semantic/profiles/profile_palma_v1',
      reviewedAt: '2026-09-29T00:00:00.000Z'
    }
  }
];

export const SEMANTIC_MODEL: SemanticModelDescriptor = {
  profileId: SEMANTIC_PROFILE_ID,
  profileName: 'Perfil PID SEGITTUR para Gemelos Digitales Multidestino',
  version: '1.0.0',
  officialVocabulary: {
    name: 'Red de Ontologías del Sector Turístico — SEGITTUR',
    iri: 'https://ontologia.segittur.es/turismo/def/core',
    role: 'Vocabulario turístico de referencia reutilizado por el perfil de interoperabilidad.'
  },
  contextUrl: SEMANTIC_CONTEXT_URL,
  profileUrl: '/ontology/segittur-multidestino-profile.ttl',
  shaclUrl: '/ontology/segittur-multidestino-shapes.ttl',
  entityTypes: [
    { type: 'TouristDestination', label: 'Destino turístico', mapsTo: 'estur:TouristDestination', requiredAttributes: ['id', 'type', 'name', 'ineCode', 'location'] },
    { type: 'TourismZone', label: 'Zona turística operativa', mapsTo: 'pid:TourismZone', requiredAttributes: ['id', 'type', 'destination', 'location', 'capacity', 'capacityLoad'] },
    { type: 'TourismResource', label: 'Recurso turístico', mapsTo: 'estur:TouristEntity', requiredAttributes: ['id', 'type', 'destination', 'name', 'location', 'capacity'] },
    { type: 'TourismSensor', label: 'Sensor territorial', mapsTo: 'pid:TourismSensor', requiredAttributes: ['id', 'type', 'destination', 'location', 'measurement', 'observedAt'] },
    { type: 'TourismEvent', label: 'Evento turístico', mapsTo: 'estur:Event', requiredAttributes: ['id', 'type', 'destination', 'name', 'location'] },
    { type: 'SimulationScenario', label: 'Escenario de simulación', mapsTo: 'pid:SimulationScenario', requiredAttributes: ['id', 'type', 'destination', 'scenarioType', 'scenarioParameters'] },
    { type: 'SimulationResult', label: 'Resultado de simulación', mapsTo: 'pid:SimulationResult', requiredAttributes: ['id', 'type', 'destination', 'hasScenario', 'observedAt'] },
    { type: 'Dataset3D', label: 'Dataset 3D', mapsTo: 'pid:Dataset3D', requiredAttributes: ['id', 'type', 'destination', 'coverage', 'version', 'license'] },
    { type: 'DataSource', label: 'Fuente y procedencia', mapsTo: 'prov:Entity / pid:DataSource', requiredAttributes: ['id', 'type', 'name', 'dataQuality', 'updateFrequency', 'traceabilityId'] }
  ],
  evidence: [
    {
      label: 'Modelo conceptual de referencia para la Red de Ontologías del Sector Turístico',
      url: 'https://www.segittur.es/plataforma-inteligente/proyectos-plataforma-inteligente/modelo-conceptual-de-referencia-para-el-desarrollo-de-una-red-de-ontologias-del-sector-turistico/index.html',
      note: 'Fuente oficial SEGITTUR para el vocabulario turístico y la interoperabilidad entre destinos.'
    },
    {
      label: 'ETSI GS CIM 009 NGSI-LD API',
      url: 'https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_CIM009v010801p.pdf',
      note: 'Modelo de representación de entidades, propiedades, relaciones, geografía y tiempo.'
    }
  ]
};

const governanceToAttributes = (governance: DataGovernance, destinationId: string) => ({
  dataQuality: property(governance.calidad, governance.ultimaActualizacion),
  updateFrequency: property(governance.frecuenciaActualizacion),
  traceabilityId: property(governance.trazabilidadId),
  hasSource: relationship(sourceUrn(destinationId, governance.fuente))
});

const asPolygon = (coordinates: [number, number][]) => ({
  type: 'Polygon' as const,
  coordinates: [[...coordinates.map(([lat, lng]) => [lng, lat]), [coordinates[0][1], coordinates[0][0]]]]
});

const profilesByDestination = new Map(DESTINATION_SEMANTIC_PROFILES.map(profile => [profile.destinationId, profile]));

export const MultiDestinationModel = {
  getProfiles: () => DESTINATION_SEMANTIC_PROFILES,

  getProfile: (profileIdOrDestinationId: string) => DESTINATION_SEMANTIC_PROFILES.find(
    profile => profile.id === profileIdOrDestinationId || profile.destinationId === profileIdOrDestinationId
  ),

  getModel: () => SEMANTIC_MODEL,

  getEntities: (destinationId: string, entityType?: NgsiLdEntityType): NgsiLdEntity[] => {
    const profile = profilesByDestination.get(destinationId);
    const destination = DESTINOS_DEMO.find(item => item.id === destinationId);
    if (!profile || !destination) return [];

    const context = SEMANTIC_CONTEXT_URL;
    const tenantUrn = `urn:ngsi-ld:Organization:${profile.tenantId}`;
    const destinationIdUrn = destinationUrn(destinationId);

    const destinationEntity: NgsiLdEntity = {
      id: destinationIdUrn,
      type: 'TouristDestination',
      '@context': context,
      destination: relationship(destinationIdUrn),
      tenant: relationship(tenantUrn),
      name: property(destination.nombre),
      description: property(destination.descripcion),
      ineCode: property(destination.codigoIne),
      location: { type: 'GeoProperty', value: { type: 'Point', coordinates: [destination.centro[1], destination.centro[0]] } },
      capacity: property(destination.capacidadCargaMaximaTeorica, undefined, 'P1'),
      ontologyProfile: property(profile.semanticProfile),
      namespace: property(profile.namespace),
      timezone: property(profile.timezone),
      spatialLevel: property(profile.activeSpatialLevel)
    };

    const zones: NgsiLdEntity[] = ZONAS_DEMO
      .filter(zone => zone.destinoId === destinationId)
      .map(zone => ({
        id: entityUrn('TourismZone', destinationId, zone.id),
        type: 'TourismZone',
        '@context': context,
        destination: relationship(destinationIdUrn),
        tenant: relationship(tenantUrn),
        name: property(zone.nombre),
        category: property(zone.tipoZona),
        location: { type: 'GeoProperty', value: asPolygon(zone.coordenadasPoligono) },
        capacity: property(zone.aforoMaximo, undefined, 'P1'),
        currentFlow: property(zone.afluenciaActual, zone.gobernanza.ultimaActualizacion, 'P1H'),
        capacityLoad: property(zone.capacidadCargaPct, zone.gobernanza.ultimaActualizacion, 'P1'),
        ...governanceToAttributes(zone.gobernanza, destinationId)
      }));

    const resources: NgsiLdEntity[] = RECURSOS_DEMO
      .filter(resource => resource.destinoId === destinationId)
      .map(resource => ({
        id: entityUrn('TourismResource', destinationId, resource.id),
        type: 'TourismResource',
        '@context': context,
        destination: relationship(destinationIdUrn),
        tenant: relationship(tenantUrn),
        name: property(resource.nombre),
        category: property(resource.categoria),
        location: { type: 'GeoProperty', value: { type: 'Point', coordinates: [resource.ubicacion[1], resource.ubicacion[0]] } },
        capacity: property(resource.aforoMaximo, undefined, 'P1'),
        visitorCount: property(resource.visitantesHora, resource.gobernanza.ultimaActualizacion, 'P1H'),
        openingHours: property(resource.horario),
        accessibility: property(resource.accesibilidadPmr),
        ...governanceToAttributes(resource.gobernanza, destinationId)
      }));

    const sensors: NgsiLdEntity[] = SENSORES_DEMO
      .filter(sensor => sensor.destinoId === destinationId)
      .map(sensor => ({
        id: entityUrn('TourismSensor', destinationId, sensor.id),
        type: 'TourismSensor',
        '@context': context,
        destination: relationship(destinationIdUrn),
        tenant: relationship(tenantUrn),
        name: property(sensor.nombre),
        sensorType: property(sensor.tipoSensor),
        location: { type: 'GeoProperty', value: { type: 'Point', coordinates: [sensor.ubicacion[1], sensor.ubicacion[0]] } },
        measurement: property(sensor.valorActual, sensor.gobernanza.ultimaActualizacion, sensor.unidad),
        alertLevel: property(sensor.estado),
        observedAt: property(sensor.gobernanza.ultimaActualizacion),
        ...governanceToAttributes(sensor.gobernanza, destinationId)
      }));

    const scenarios: NgsiLdEntity[] = ESCENARIOS_PREDEFINIDOS
      .filter(scenario => scenario.id === 'base' || scenario.zonasAfectadas.some(zoneId => zoneId.startsWith(`${destinationId}_`)))
      .map(scenario => ({
        id: entityUrn('SimulationScenario', destinationId, scenario.id),
        type: 'SimulationScenario',
        '@context': context,
        destination: relationship(destinationIdUrn),
        tenant: relationship(tenantUrn),
        name: property(scenario.nombre),
        description: property(scenario.descripcion),
        scenarioType: property(scenario.tipo),
        scenarioParameters: property({ factorAfluencia: scenario.factorAfluencia, impactoZonas: scenario.impactoZonas }),
        routeRecommendation: property(scenario.rutasDesvioRecomendadas)
      }));

    const datasets: NgsiLdEntity[] = DATASETS_3D_CATALOG
      .filter(dataset => dataset.destinoId === destinationId)
      .map(dataset => ({
        id: entityUrn('Dataset3D', destinationId, dataset.id),
        type: 'Dataset3D',
        '@context': context,
        destination: relationship(destinationIdUrn),
        tenant: relationship(tenantUrn),
        name: property(dataset.titulo),
        description: property(dataset.descripcion),
        category: property(dataset.tipo),
        version: property(dataset.version),
        coverage: property('Málaga Centro–Puerto'),
        license: property(dataset.licencia),
        location: { type: 'GeoProperty', value: { type: 'Point', coordinates: [destination.centro[1], destination.centro[0]] } },
        sourceSystem: property(dataset.atribucion),
        checksum: property(`catalog:${dataset.id}:${dataset.version}`),
        dataQuality: property('A_CERTIFICADA'),
        updateFrequency: property('MENSUAL')
      }));

    const sourceEntities = new Map<string, NgsiLdEntity>();
    [...zones, ...resources, ...sensors].forEach(entity => {
      const source = entity.hasSource as NgsiLdRelationship | undefined;
      const sourceName = source?.object.split(':').pop()?.replace(/-/g, ' ') || 'Fuente configurada';
      if (source && !sourceEntities.has(source.object)) {
        sourceEntities.set(source.object, {
          id: source.object,
          type: 'DataSource',
          '@context': context,
          destination: relationship(destinationIdUrn),
          tenant: relationship(tenantUrn),
          name: property(sourceName),
          description: property('Origen declarado por la entidad operativa del destino.'),
          dataQuality: entity.dataQuality,
          updateFrequency: entity.updateFrequency,
          traceabilityId: entity.traceabilityId
        });
      }
    });

    const allEntities = [destinationEntity, ...zones, ...resources, ...sensors, ...scenarios, ...datasets, ...sourceEntities.values()];
    return entityType ? allEntities.filter(entity => entity.type === entityType) : allEntities;
  },

  createEmptyDestinationEntity: (destinationId: string) => ({
    id: destinationUrn(destinationId),
    type: 'TouristDestination' as const,
    '@context': SEMANTIC_CONTEXT_URL,
    destination: relationship(destinationUrn(destinationId)),
    createdAt: property(now())
  })
};
