import {
  DataLane,
  InteroperabilityArchitecture,
  InteroperabilityConnector,
  ModelInstantiationInput,
  ModelInstantiationPreview,
  ModelVariableDefinition,
  OwnModelInput,
  OwnModelResult,
  PidServiceRelation,
  ReusableModelTemplate
} from '../types/interoperability';
import { MultiDestinationModel } from './multiDestinationModel';

const reviewedAt = '2026-09-30T00:00:00.000Z';

const evidence = (label: string, url: string, note: string) => ({ label, url, note, reviewedAt });

export const PID_SERVICE_RELATIONS: PidServiceRelation[] = [
  {
    id: 'S2',
    role: 'Incorporación y armonización de datos ontológicos.',
    dataTreatment: 'Normaliza entidades turísticas y relaciones hacia el contexto JSON-LD/NGSI-LD del destino.',
    privacyRule: 'Solo se admiten atributos previstos en el contrato semántico y con trazabilidad de origen.',
    evidence: evidence('Contrato semántico S2', '/api/semantic/model', 'El contexto y los tipos interoperables están publicados por el gemelo.')
  },
  {
    id: 'C4',
    role: 'Incorporación de históricos y datos no ontológicos.',
    dataTreatment: 'Conserva esquema fuente, fecha de observación y metadatos mientras se evalúa su mapeo semántico.',
    privacyRule: 'Aplicar minimización, finalidad y retención antes de combinarlo con otras fuentes.',
    evidence: evidence('Contratos de ingestión', '/api/interoperability/architecture', 'Carril de histórico y datos heterogéneos configurado en el MVP.')
  },
  {
    id: 'S11',
    role: 'Explotación territorial y geoespacial.',
    dataTreatment: 'Consume capas normalizadas, geometrías y catálogos para OGC API, GeoJSON, visor y análisis espacial.',
    privacyRule: 'Publicar solo geometrías y atributos compatibles con la clasificación de difusión.',
    evidence: evidence('Catálogo geoespacial OGC', '/api/geo/catalogo', 'Capas del destino publicables como servicios geoespaciales.')
  },
  {
    id: 'S18',
    role: 'Explotación, previsión y simulación.',
    dataTreatment: 'Recibe variables de contexto y devuelve escenarios, indicadores, alertas y recomendaciones.',
    privacyRule: 'Mantener la evidencia de fuentes y reglas de cada resultado de simulación.',
    evidence: evidence('Motor de simulación', '/api/simulacion/ejecutar', 'Contrato del motor común de contexto y simulación.')
  },
  {
    id: 'S15',
    role: 'Fuente complementaria de comportamiento o percepción.',
    dataTreatment: 'Se conecta mediante S2/C4 después de clasificar la finalidad y el detalle de agregación.',
    privacyRule: 'Requiere evaluación de privacidad y agregación previa cuando trate comportamiento de personas.',
    evidence: evidence('Política de fuentes complementarias', '/api/interoperability/architecture', 'Mapa PID configurable en el MVP.')
  },
  {
    id: 'S16',
    role: 'Fuente complementaria de comportamiento o percepción.',
    dataTreatment: 'Se conecta mediante S2/C4 y mantiene origen, periodo y reglas de actualización.',
    privacyRule: 'Requiere revisión de finalidad, minimización y base de legitimación aplicable.',
    evidence: evidence('Política de fuentes complementarias', '/api/interoperability/architecture', 'Mapa PID configurable en el MVP.')
  },
  {
    id: 'S17',
    role: 'Fuente complementaria de empresas o interacción.',
    dataTreatment: 'Se incorpora mediante contratos de fuente, no como una integración implícita del visor.',
    privacyRule: 'No activar sin autorización del proveedor, clasificación de datos y política de retención.',
    evidence: evidence('Política de fuentes complementarias', '/api/interoperability/architecture', 'Mapa PID configurable en el MVP.')
  },
  {
    id: 'S1',
    role: 'Fuente complementaria de activos y recursos normalizados.',
    dataTreatment: 'Aporta referencias de activos y recursos hacia la capa ontológica cuando procede.',
    privacyRule: 'Verificar propiedad, licencia y actualización de cada activo antes de su publicación.',
    evidence: evidence('Perfil ontológico PID', '/api/semantic/model', 'Entidades de activos, recursos, fuentes y trazabilidad.')
  },
  {
    id: 'S7',
    role: 'Fuente complementaria de interacción o actividad del destino.',
    dataTreatment: 'Se canaliza a través de contratos C4/S2, separando señal histórica de entidad semántica.',
    privacyRule: 'Aplicar evaluación de privacidad, agregación y proporcionalidad antes de su activación.',
    evidence: evidence('Política de fuentes complementarias', '/api/interoperability/architecture', 'Mapa PID configurable en el MVP.')
  }
];

export const INTEROPERABILITY_ARCHITECTURE: InteroperabilityArchitecture = {
  id: 'pid-interoperability-layer-v1',
  version: '1.0.0',
  title: 'Capa de integración, normalización e interoperabilidad',
  flow: [
    'Fuentes PID + nacionales + propias del destino',
    'Capa de integración, normalización e interoperabilidad',
    'Modelo semántico y geoespacial del destino',
    'Motor común de contexto y simulación',
    'Modelos preconfigurados + propios + reutilizables',
    'S11 / S18 / visor geoespacial / APIs / dashboards'
  ],
  lanes: [
    {
      id: 'ONTOLOGICO',
      title: 'Carril ontológico',
      subtitle: 'Datos con significado interoperable y entidades del destino.',
      sources: ['S2', 'S1', 'recursos y activos normalizados', 'NGSI-LD', 'GeoJSON semántico'],
      processing: ['Validación de contexto', 'mapeo SEGITTUR/PID', 'relaciones de destino', 'calidad y trazabilidad'],
      output: 'Entidades NGSI-LD listas para S11, S18 y APIs del gemelo.',
      evidence: evidence('Perfil semántico del Gemelo', '/api/semantic/model', 'Describe los tipos, relaciones, contexto y evidencia del carril ontológico.')
    },
    {
      id: 'NO_ONTOLOGICO_HISTORICO',
      title: 'Carril no ontológico / histórico',
      subtitle: 'Series y fuentes heterogéneas que conservan su esquema de origen.',
      sources: ['C4', 'APIs municipales', 'CSV', 'MQTT', 'ocupación', 'movilidad', 'aparcamientos', 'comercio'],
      processing: ['Transformación de formatos', 'validación de esquema fuente', 'metadatos temporales', 'anonimización/agregación', 'mapeo gradual'],
      output: 'Series contextualizadas y datasets trazables para análisis y posterior armonización.',
      evidence: evidence('Arquitectura de interoperabilidad', '/api/interoperability/architecture', 'Expone los contratos del carril histórico y de fuentes locales.')
    }
  ],
  pidServices: PID_SERVICE_RELATIONS,
  evidence: [
    evidence('Modelo multidestino y perfil semántico', '/api/semantic/model', 'Base de interoperabilidad turística y de aislamiento por destino.'),
    evidence('Catálogo geoespacial', '/api/geo/catalogo', 'Evidencia de explotación territorial preparada para S11.'),
    evidence('Motor de simulación', '/api/simulacion/ejecutar', 'Evidencia de explotación de escenarios preparada para S18.')
  ]
};

export const INTEROPERABILITY_CONNECTORS: InteroperabilityConnector[] = [
  {
    id: 'conn_malaga_s2_recursos', destinationId: 'malaga', tenantId: 'tenant_ayto_malaga',
    title: 'S2 · Recursos y activos turísticos normalizados', lane: 'ONTOLOGICO', sourceClass: 'PID', pidServiceId: 'S2', connectorType: 'PID_SERVICE', inputFormat: 'NGSI_LD',
    targetDomains: ['turismo', 'recursos', 'eventos'], normalizationSteps: ['Validación JSON-LD', 'mapeo estur/pid', 'enlace con destino', 'trazabilidad'],
    updateFrequency: 'Diaria / por evento', qualityRule: 'Campos obligatorios, URN estable y contexto compatible.', status: 'CONTRATO_CONFIGURADO', privacyLevel: 'PUBLICO',
    purpose: 'Incorporar recursos y activos turísticos con significado interoperable.', evidence: evidence('Entidades semánticas Málaga', '/api/semantic/entities?destino=malaga', 'Colección NGSI-LD demostradora del destino.')
  },
  {
    id: 'conn_malaga_c4_historicos', destinationId: 'malaga', tenantId: 'tenant_ayto_malaga',
    title: 'C4 · Histórico de afluencia, ocupación y contexto', lane: 'NO_ONTOLOGICO_HISTORICO', sourceClass: 'PID', pidServiceId: 'C4', connectorType: 'PID_SERVICE', inputFormat: 'REST_JSON',
    targetDomains: ['afluencia', 'ocupacion', 'historicos'], normalizationSteps: ['Control temporal', 'esquema fuente', 'agregación', 'mapeo opcional'],
    updateFrequency: 'Horaria / histórica', qualityRule: 'Fecha, periodo, unidad y procedencia obligatorios.', status: 'CONTRATO_CONFIGURADO', privacyLevel: 'INTERNO_AGREGADO',
    purpose: 'Aportar series históricas sin forzar su semantización prematura.', evidence: evidence('Contrato C4 de demostración', '/api/interoperability/connectors?destino=malaga', 'Contrato demostrador, sin enlace real al servicio externo.')
  },
  {
    id: 'conn_malaga_api_municipal', destinationId: 'malaga', tenantId: 'tenant_ayto_malaga',
    title: 'API municipal · Aparcamientos y movilidad', lane: 'NO_ONTOLOGICO_HISTORICO', sourceClass: 'MUNICIPAL', connectorType: 'REST_API', inputFormat: 'REST_JSON',
    targetDomains: ['movilidad', 'aparcamientos', 'accesibilidad'], normalizationSteps: ['Validación de contrato REST', 'normalización de unidades', 'agregación por zona', 'mapeo gradual'],
    updateFrequency: 'Cada 15 minutos', qualityRule: 'Identificador de fuente, timestamp, unidad y cobertura territorial obligatorios.', status: 'PENDIENTE_AUTORIZACION', privacyLevel: 'INTERNO_AGREGADO',
    purpose: 'Incorporar indicadores municipales de accesibilidad sin representar una conexión viva.', evidence: evidence('Contrato API municipal de demostración', '/api/interoperability/connectors?destino=malaga', 'Requiere autorización, endpoint y credencial del proveedor municipal.')
  },
  {
    id: 'conn_malaga_iot_larios', destinationId: 'malaga', tenantId: 'tenant_ayto_malaga',
    title: 'IoT Calle Larios · Aforos y confort urbano', lane: 'NO_ONTOLOGICO_HISTORICO', sourceClass: 'OPERADOR_LOCAL', connectorType: 'MQTT', inputFormat: 'MQTT',
    targetDomains: ['movilidad', 'afluencia', 'medio_ambiente'], normalizationSteps: ['Validación de unidad', 'ventana temporal', 'anonimización', 'asociación a zona'],
    updateFrequency: 'Tiempo real', qualityRule: 'Sensor registrado, timestamp, unidad y rango físico válidos.', status: 'PILOTO_VALIDADO', privacyLevel: 'INTERNO_AGREGADO',
    purpose: 'Alimentar contexto para capacidad de carga y desvío de flujos.', evidence: evidence('Telemetría IoT de demo', '/api/ingestion/telemetria', 'Endpoint de validación y encolado de telemetría.')
  },
  {
    id: 'conn_malaga_geo_ogc', destinationId: 'malaga', tenantId: 'tenant_ayto_malaga',
    title: 'GIS municipal / OGC · Zonas y capas operativas', lane: 'ONTOLOGICO', sourceClass: 'MUNICIPAL', connectorType: 'OGC_API', inputFormat: 'OGC_API_FEATURES',
    targetDomains: ['territorio', 'infraestructuras', 'zonas'], normalizationSteps: ['Reproyección', 'validación geometría', 'mapeo de atributos', 'publicación OGC'],
    updateFrequency: 'Diaria', qualityRule: 'CRS declarado, geometría válida y licencia de publicación.', status: 'CONTRATO_CONFIGURADO', privacyLevel: 'PUBLICO',
    purpose: 'Alinear capas municipales con zonas y recursos del modelo del destino.', evidence: evidence('Catálogo OGC del Gemelo', '/api/geo/catalogo', 'Catálogo de capas y servicios geoespaciales del MVP.')
  },
  {
    id: 'conn_palma_s2_activos', destinationId: 'palma', tenantId: 'tenant_ayto_palma',
    title: 'S2 · Activos y recursos turísticos de Palma', lane: 'ONTOLOGICO', sourceClass: 'PID', pidServiceId: 'S2', connectorType: 'PID_SERVICE', inputFormat: 'NGSI_LD',
    targetDomains: ['turismo', 'patrimonio', 'eventos'], normalizationSteps: ['Validación JSON-LD', 'mapeo estur/pid', 'enlace con destino', 'trazabilidad'],
    updateFrequency: 'Diaria / por evento', qualityRule: 'Campos obligatorios, URN estable y contexto compatible.', status: 'CONTRATO_CONFIGURADO', privacyLevel: 'PUBLICO',
    purpose: 'Incorporar recursos y activos turísticos de un segundo destino sin cambiar el motor.', evidence: evidence('Entidades semánticas Palma', '/api/semantic/entities?destino=palma', 'Colección NGSI-LD demostradora del segundo perfil.')
  },
  {
    id: 'conn_palma_c4_cruceros', destinationId: 'palma', tenantId: 'tenant_ayto_palma',
    title: 'C4 · Histórico de cruceros, ocupación y flujos', lane: 'NO_ONTOLOGICO_HISTORICO', sourceClass: 'PID', pidServiceId: 'C4', connectorType: 'PID_SERVICE', inputFormat: 'CSV',
    targetDomains: ['cruceros', 'afluencia', 'movilidad'], normalizationSteps: ['Control de columnas', 'normalización de fecha', 'agregación', 'mapeo gradual'],
    updateFrequency: 'Diaria / mensual', qualityRule: 'Serie con período, unidad, origen y cobertura declarados.', status: 'CONTRATO_CONFIGURADO', privacyLevel: 'INTERNO_AGREGADO',
    purpose: 'Analizar desembarcos y dispersión sin exigir un modelo ontológico de partida.', evidence: evidence('Contrato C4 Palma de demostración', '/api/interoperability/connectors?destino=palma', 'Contrato demostrador, sin enlace real al servicio externo.')
  },
  {
    id: 'conn_palma_eventos_csv', destinationId: 'palma', tenantId: 'tenant_ayto_palma',
    title: 'Agenda municipal · Eventos y ocupación de espacio público', lane: 'NO_ONTOLOGICO_HISTORICO', sourceClass: 'MUNICIPAL', connectorType: 'CSV', inputFormat: 'CSV',
    targetDomains: ['eventos', 'espacio_publico'], normalizationSteps: ['Validación de calendario', 'geocodificación', 'mapeo a TourismEvent cuando proceda'],
    updateFrequency: 'Diaria', qualityRule: 'Título, fecha, localización y organismo responsable obligatorios.', status: 'PENDIENTE_AUTORIZACION', privacyLevel: 'PUBLICO',
    purpose: 'Contextualizar picos de demanda y restricciones de acceso.', evidence: evidence('Contrato de eventos Palma', '/api/interoperability/connectors?destino=palma', 'Pendiente de autorización y contrato de fuente real.')
  },
  {
    id: 'conn_palma_playas_geojson', destinationId: 'palma', tenantId: 'tenant_ayto_palma',
    title: 'Playas y calidad ambiental · GeoJSON municipal', lane: 'ONTOLOGICO', sourceClass: 'MUNICIPAL', connectorType: 'GEOJSON', inputFormat: 'GEOJSON',
    targetDomains: ['playas', 'medio_ambiente', 'capacidad_carga'], normalizationSteps: ['Reproyección', 'validación GeoJSON', 'mapeo de zonas y atributos de capacidad'],
    updateFrequency: 'Horaria / diaria', qualityRule: 'Geometría válida, indicador con unidad y actualización declarada.', status: 'PENDIENTE_AUTORIZACION', privacyLevel: 'PUBLICO',
    purpose: 'Preparar un modelo de playas reutilizable con parámetros propios del destino.', evidence: evidence('Contrato de playas Palma', '/api/interoperability/connectors?destino=palma', 'Pendiente de autorización y publicación del proveedor local.')
  }
];

const reusable = (
  id: string, title: string, domain: string, summary: string,
  requiredLanes: DataLane[], sourceRequirements: string[], variables: ReusableModelTemplate['variables'], ruleSummary: string,
  creatorDestinationName = 'SEGITTUR (Modelo PID Transversal)',
  adoptedByDestinationIds = ['malaga', 'palma'],
  pidModulesRequired: Array<'S1' | 'S2' | 'C4' | 'S7' | 'S11' | 'S15' | 'S16' | 'S17' | 'S18'> = ['S2', 'S18']
): ReusableModelTemplate => ({
  id, version: '1.0.0', title, domain, publication: 'REUTILIZABLE_PID', lifecycle: 'VALIDADO', summary,
  creatorDestinationName,
  adoptedByDestinationIds,
  pidModulesRequired,
  requiredLanes, sourceRequirements, variables, ruleSummary,
  privacyRule: 'Solo se publican plantillas parametrizadas; las instancias conservan el vínculo al destino, las fuentes y la política de datos.',
  evidence: evidence(`Ficha ${title}`, `/api/models/reusable/${id}`, 'Plantilla demostradora con requisitos de fuente, variables y reglas verificables.')
});

export const REUSABLE_MODEL_CATALOG: ReusableModelTemplate[] = [
  reusable('modelo_saturacion_turistica', 'Saturación turística', 'Capacidad de carga', 'Predice presión por zonas y propone redistribución de flujos.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Zonas con capacidad', 'afluencia o conteos', 'recursos'], [{ id: 'umbralAlerta', label: 'Umbral de alerta', unit: '%', defaultValue: 85, valueType: 'number', min: 50, max: 100 }, { id: 'horizonte', label: 'Horizonte', unit: 'horas', defaultValue: 4, valueType: 'number', min: 1, max: 48 }], 'Compara afluencia, capacidad y contexto para activar alertas y rutas.', 'SEGITTUR (Dirección Técnica)', ['malaga', 'palma'], ['S2', 'S11', 'S18']),
  reusable('modelo_puertos_cruceros', 'Puertos y cruceros', 'Flujos portuarios', 'Transforma escalas y desembarcos en escenarios de distribución puerto-centro.', ['NO_ONTOLOGICO_HISTORICO'], ['Escalas de crucero', 'desembarcos', 'rutas y recursos'], [{ id: 'tasaDesembarco', label: 'Tasa de desembarco', unit: '%', defaultValue: 75 }, { id: 'tiempoDispersión', label: 'Tiempo de dispersión', unit: 'min', defaultValue: 45 }], 'Proyecta oleadas de visitantes y recomienda escalonamiento o rutas.', 'Ajuntament de Palma (Movilidad Portuaria)', ['palma', 'malaga'], ['C4', 'S11', 'S18']),
  reusable('modelo_playas', 'Playas y litoral inteligente', 'Litoral', 'Gestiona ocupación, calidad ambiental y confort en zonas de playa.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Geometrías de playa', 'aforo/ocupación', 'meteorología o calidad'], [{ id: 'capacidadObjetivo', label: 'Capacidad objetivo', unit: '%', defaultValue: 75 }, { id: 'radioInfluencia', label: 'Radio de influencia', unit: 'm', defaultValue: 500 }], 'Relaciona ocupación, condiciones y capacidad para sugerir reparto de demanda.', 'Ajuntament de Palma (Gestión Litoral)', ['palma', 'malaga'], ['S2', 'C4', 'S18']),
  reusable('modelo_patrimonio', 'Patrimonio y flujos históricos', 'Activos patrimoniales', 'Protege activos sensibles mediante control de carga, accesos y microclima.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Recursos patrimoniales', 'zonas de acceso', 'aforo o sensores'], [{ id: 'limiteVisitas', label: 'Límite de visitas', unit: 'personas/hora', defaultValue: 300 }, { id: 'sensibilidad', label: 'Sensibilidad patrimonial', defaultValue: 'alta' }], 'Calcula capacidad admisible y recomendaciones específicas de protección.', 'Ayuntamiento de Málaga (Cultura y Patrimonio)', ['malaga', 'palma'], ['S1', 'S2', 'S18']),
  reusable('modelo_movilidad', 'Movilidad y ZBE', 'Flujos y accesibilidad', 'Modela rutas, accesos, aparcamientos y dispersión peatonal.', ['NO_ONTOLOGICO_HISTORICO'], ['Conteos de movilidad', 'red viaria/rutas', 'puntos de interés'], [{ id: 'velocidadPeatonal', label: 'Velocidad peatonal', unit: 'km/h', defaultValue: 4.5 }, { id: 'factorDesvio', label: 'Factor de desvío', defaultValue: 0.2 }], 'Evalúa capacidad de rutas y propone alternativas ante cuellos de botella.', 'Ayuntamiento de Málaga (Área de Tráfico)', ['malaga', 'palma'], ['C4', 'S11', 'S18']),
  reusable('modelo_eventos', 'Eventos y espacio público', 'Eventos y espacio público', 'Anticipa concentración de visitantes asociada a agenda y restricciones de espacio.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Agenda de eventos', 'zonas', 'movilidad o afluencia'], [{ id: 'ventanaEvento', label: 'Ventana operativa', unit: 'horas', defaultValue: 6 }, { id: 'factorAsistencia', label: 'Factor de asistencia', defaultValue: 1 }], 'Incorpora temporalidad, localización y aforo previsto para calcular presión.', 'SEGITTUR (Módulo Transversal)', ['malaga', 'palma'], ['S2', 'S7', 'S18']),
  reusable('modelo_nieve', 'Nieve y montaña', 'Destino de montaña', 'Gestiona capacidad de pistas, accesos y condiciones de nieve.', ['NO_ONTOLOGICO_HISTORICO'], ['Estado de nieve', 'aforo', 'movilidad de acceso'], [{ id: 'cotaMinima', label: 'Cota mínima', unit: 'm', defaultValue: 1500 }, { id: 'capacidadRemontes', label: 'Capacidad remontes', unit: 'personas/hora', defaultValue: 2000 }], 'Combina condición operativa y demanda para mitigar sobrecarga.', 'Destino Sierra Nevada / Pirineos', ['palma'], ['C4', 'S18']),
  reusable('modelo_espacios_naturales', 'Espacios naturales y senderos', 'Naturaleza y senderos', 'Controla flujos, capacidad y sensibilidad ambiental en itinerarios naturales.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Zonas protegidas', 'senderos', 'conteos o reservas'], [{ id: 'capacidadSendero', label: 'Capacidad de sendero', unit: 'personas/día', defaultValue: 600 }, { id: 'factorSensibilidad', label: 'Factor de sensibilidad', defaultValue: 1.2 }], 'Cruza carga de visitantes y restricciones ambientales para recomendar límites.', 'Parque Nacional / Destino Verde', ['malaga'], ['S2', 'S18']),
  reusable('modelo_enoturismo', 'Enoturismo y bodegas', 'Turismo enológico', 'Integra bodegas, reservas, vendimia, rutas y capacidad de acogida.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Bodegas/recursos', 'reservas', 'eventos estacionales'], [{ id: 'plazasVisita', label: 'Plazas por visita', unit: 'personas', defaultValue: 40 }, { id: 'duracionVisita', label: 'Duración de visita', unit: 'min', defaultValue: 90 }], 'Parametriza experiencias, reservas y rutas para distribuir visitas.', 'Ruta del Vino de España', ['malaga'], ['S1', 'S2']),
  reusable('modelo_cicloturismo', 'Cicloturismo y rutas activas', 'Rutas activas', 'Optimiza rutas ciclistas según capacidad, condiciones y seguridad.', ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'], ['Red ciclista', 'puntos de interés', 'meteorología/movilidad'], [{ id: 'capacidadTramo', label: 'Capacidad por tramo', unit: 'ciclistas/hora', defaultValue: 120 }, { id: 'pendienteMaxima', label: 'Pendiente máxima', unit: '%', defaultValue: 8 }], 'Sugiere itinerarios alternativos y franjas de menor presión.', 'Red de Destinos Ciclistas', ['malaga', 'palma'], ['S11', 'S18'])
];

// El catálogo demo conserva los modelos propios en memoria. En piloto persistente,
// este estado se materializa mediante las tablas de la migración 004.
const CUSTOM_MODEL_CATALOG = new Map<string, ReusableModelTemplate>();

const isDataLane = (value: string): value is DataLane => value === 'ONTOLOGICO' || value === 'NO_ONTOLOGICO_HISTORICO';

const normalizeVariableType = (variable: ModelVariableDefinition): 'number' | 'string' | 'boolean' => {
  if (variable.valueType) return variable.valueType;
  return typeof variable.defaultValue as 'number' | 'string' | 'boolean';
};

const validateVariableDefinitions = (variables: ModelVariableDefinition[]): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!Array.isArray(variables) || variables.length === 0) return ['El modelo requiere al menos una variable parametrizable.'];
  variables.forEach((variable, index) => {
    if (!variable.id || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.id)) errors.push(`Variable ${index + 1}: id inválido.`);
    if (ids.has(variable.id)) errors.push(`La variable ${variable.id} está duplicada.`);
    ids.add(variable.id);
    if (!variable.label?.trim()) errors.push(`La variable ${variable.id || index + 1} requiere etiqueta.`);
    const type = normalizeVariableType(variable);
    if (typeof variable.defaultValue !== type) errors.push(`La variable ${variable.id} no coincide con su tipo ${type}.`);
    if (type === 'number' && (!Number.isFinite(variable.defaultValue as number) || (variable.min !== undefined && variable.max !== undefined && variable.min > variable.max))) {
      errors.push(`La variable numérica ${variable.id} tiene rango o valor por defecto inválido.`);
    }
    if (variable.allowedValues && (type !== 'string' || !variable.allowedValues.includes(variable.defaultValue as string))) {
      errors.push(`La variable ${variable.id} debe usar un valor por defecto incluido en allowedValues.`);
    }
  });
  return errors;
};

export class InteroperabilityCatalogService {
  static getArchitecture(): InteroperabilityArchitecture {
    return INTEROPERABILITY_ARCHITECTURE;
  }

  static getConnectors(destinationId: string, lane?: DataLane): InteroperabilityConnector[] {
    return INTEROPERABILITY_CONNECTORS.filter(connector => connector.destinationId === destinationId && (!lane || connector.lane === lane));
  }

  static getConnector(id: string): InteroperabilityConnector | undefined {
    return INTEROPERABILITY_CONNECTORS.find(connector => connector.id === id);
  }

  static getModels(destinationId?: string): ReusableModelTemplate[] {
    const ownOrPublished = [...CUSTOM_MODEL_CATALOG.values()].filter(model =>
      model.publication === 'REUTILIZABLE_PID' || model.ownerDestinationId === destinationId
    );
    return [...REUSABLE_MODEL_CATALOG, ...ownOrPublished];
  }

  static getModel(id: string): ReusableModelTemplate | undefined {
    return REUSABLE_MODEL_CATALOG.find(model => model.id === id) || CUSTOM_MODEL_CATALOG.get(id);
  }

  static createOwnModel(input: OwnModelInput): OwnModelResult {
    const profile = MultiDestinationModel.getProfile(input.destinationId);
    const errors: string[] = [];
    if (!profile) errors.push('El destino propietario del modelo no existe.');
    if (!input.title?.trim()) errors.push('El título del modelo es obligatorio.');
    if (!input.domain?.trim()) errors.push('El dominio del modelo es obligatorio.');
    if (!input.summary?.trim()) errors.push('El resumen del modelo es obligatorio.');
    if (!input.ruleSummary?.trim()) errors.push('El resumen de reglas es obligatorio.');
    if (!input.privacyRule?.trim()) errors.push('La política de privacidad es obligatoria.');
    if (!Array.isArray(input.requiredLanes) || input.requiredLanes.length === 0 || input.requiredLanes.some(lane => !isDataLane(lane))) {
      errors.push('El modelo requiere al menos un carril de datos válido.');
    }
    if (!Array.isArray(input.sourceRequirements) || input.sourceRequirements.filter(item => item.trim()).length === 0) errors.push('El modelo requiere al menos una fuente mínima.');
    errors.push(...validateVariableDefinitions(input.variables));
    if (errors.length > 0 || !profile) return { persistence: 'REJECTED', valid: false, errors };

    const slug = input.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'modelo';
    const id = `modelo_propio_${input.destinationId}_${slug}_${Date.now()}`;
    const model: ReusableModelTemplate = {
      id,
      version: '0.1.0',
      title: input.title.trim(),
      domain: input.domain.trim(),
      publication: 'MODELO_PROPIO',
      lifecycle: 'BORRADOR',
      ownerDestinationId: input.destinationId,
      ownerTenantId: profile.tenantId,
      summary: input.summary.trim(),
      requiredLanes: [...new Set(input.requiredLanes)],
      sourceRequirements: input.sourceRequirements.map(item => item.trim()).filter(Boolean),
      variables: input.variables.map(variable => ({ ...variable, valueType: normalizeVariableType(variable), required: variable.required ?? true })),
      ruleSummary: input.ruleSummary.trim(),
      privacyRule: input.privacyRule.trim(),
      evidence: evidence('Borrador propio validado', `/api/models/own/${id}?destino=${input.destinationId}`, 'Borrador de demostración con propietario, variables y política declarados.')
    };
    CUSTOM_MODEL_CATALOG.set(id, model);
    return { persistence: 'VALIDATED_NOT_PERSISTED', valid: true, errors: [], model };
  }

  static publishOwnModel(modelId: string, destinationId: string): OwnModelResult {
    const model = CUSTOM_MODEL_CATALOG.get(modelId);
    if (!model) return { persistence: 'REJECTED', valid: false, errors: ['Solo los modelos propios de demostración pueden publicarse mediante esta operación.'] };
    if (model.ownerDestinationId !== destinationId) return { persistence: 'REJECTED', valid: false, errors: ['El destino solicitante no es propietario del borrador.'] };
    const errors = validateVariableDefinitions(model.variables);
    if (model.requiredLanes.length === 0) errors.push('El borrador no declara carriles requeridos.');
    if (model.sourceRequirements.length === 0) errors.push('El borrador no declara fuentes mínimas.');
    if (errors.length > 0) return { persistence: 'REJECTED', valid: false, errors };
    const published: ReusableModelTemplate = {
      ...model,
      publication: 'REUTILIZABLE_PID',
      lifecycle: 'PUBLICADO',
      version: '1.0.0',
      evidence: evidence('Plantilla reutilizable publicada en demo', `/api/models/reusable/${model.id}`, 'Publicación demostradora; en producción requiere revisión y autorización persistente.')
    };
    CUSTOM_MODEL_CATALOG.set(modelId, published);
    return { persistence: 'VALIDATED_NOT_PERSISTED', valid: true, errors: [], model: published };
  }

  static instantiate(modelId: string, input: ModelInstantiationInput): ModelInstantiationPreview {
    const model = this.getModel(modelId);
    const profile = MultiDestinationModel.getProfile(input.destinationId);
    if (!model) return { persistence: 'REJECTED', valid: false, errors: ['La plantilla reutilizable solicitada no existe.'] };
    if (!profile) return { persistence: 'REJECTED', valid: false, errors: ['El destino de la instancia no existe en el modelo multidestino.'] };
    if (model.publication === 'MODELO_PROPIO' && model.ownerDestinationId !== input.destinationId) {
      return { persistence: 'REJECTED', valid: false, errors: ['Un borrador propio solo puede usarse en su destino propietario hasta que sea publicado como reutilizable.'] };
    }

    const destinationConnectors = this.getConnectors(input.destinationId);
    const selectedConnectors = input.connectorIds
      .map(connectorId => destinationConnectors.find(connector => connector.id === connectorId))
      .filter((connector): connector is InteroperabilityConnector => Boolean(connector));
    const selectedLanes = new Set(selectedConnectors.map(connector => connector.lane));
    const missingLanes = model.requiredLanes.filter(lane => !selectedLanes.has(lane));

    if (selectedConnectors.length !== input.connectorIds.length) {
      return { persistence: 'REJECTED', valid: false, errors: ['La instancia referencia un conector que no pertenece al destino seleccionado.'] };
    }
    const pendingConnectors = selectedConnectors.filter(connector => connector.status === 'PENDIENTE_AUTORIZACION');
    if (pendingConnectors.length > 0) {
      return { persistence: 'REJECTED', valid: false, errors: [`Los conectores pendientes de autorización no se pueden vincular: ${pendingConnectors.map(connector => connector.title).join(', ')}.`] };
    }
    if (missingLanes.length > 0) {
      return {
        persistence: 'REJECTED', valid: false,
        errors: [`La plantilla requiere fuentes del carril: ${missingLanes.join(', ')}.`]
      };
    }

    const parameterErrors: string[] = [];
    const normalizedParameters: Record<string, string | number | boolean> = {};
    const allowedIds = new Set(model.variables.map(variable => variable.id));
    Object.keys(input.parameters || {}).forEach(parameterId => {
      if (!allowedIds.has(parameterId)) parameterErrors.push(`El parámetro ${parameterId} no pertenece a la plantilla ${model.title}.`);
    });
    model.variables.forEach(variable => {
      const value = input.parameters?.[variable.id];
      if (value === undefined || value === null || value === '') {
        if (variable.required !== false) parameterErrors.push(`Falta el parámetro obligatorio ${variable.label}.`);
        return;
      }
      const type = normalizeVariableType(variable);
      if (typeof value !== type) {
        parameterErrors.push(`El parámetro ${variable.label} debe ser de tipo ${type}.`);
        return;
      }
      if (type === 'number') {
        const numericValue = value as number;
        if (!Number.isFinite(numericValue)) parameterErrors.push(`El parámetro ${variable.label} debe ser numérico finito.`);
        if (variable.min !== undefined && numericValue < variable.min) parameterErrors.push(`${variable.label} no puede ser menor que ${variable.min}${variable.unit ? ` ${variable.unit}` : ''}.`);
        if (variable.max !== undefined && numericValue > variable.max) parameterErrors.push(`${variable.label} no puede ser mayor que ${variable.max}${variable.unit ? ` ${variable.unit}` : ''}.`);
      }
      if (type === 'string' && variable.allowedValues && !variable.allowedValues.includes(value as string)) {
        parameterErrors.push(`El parámetro ${variable.label} debe ser uno de: ${variable.allowedValues.join(', ')}.`);
      }
      normalizedParameters[variable.id] = value;
    });
    if (parameterErrors.length > 0) return { persistence: 'REJECTED', valid: false, errors: parameterErrors };

    return {
        persistence: 'VALIDATED_NOT_PERSISTED',
        valid: true,
        errors: [],
        instance: {
          id: `urn:pid:gemelo:model-instance:${input.destinationId}:${model.id}:demo`,
          destinationId: input.destinationId,
          tenantId: profile.tenantId,
          templateId: model.id,
          templateVersion: model.version,
          status: 'BORRADOR_VALIDADO',
          connectorIds: selectedConnectors.map(connector => connector.id),
          parameters: normalizedParameters,
          evidence: evidence('Instancia validada de demostración', `/api/models/reusable/${model.id}`, 'Contrato validado; se persiste tras activar PostGIS y las credenciales de fuente.')
        }
      };
    }

  /**
   * Convierte una plantilla de modelo parametrizada en una definición de escenario
   * lista para ser registrada y ejecutada en la pestaña Simulación.
   */
  static modelToScenarioDraft(
    modelId: string, 
    destinationId: string, 
    zoneIds: string[], 
    customParameters: Record<string, any> = {}
  ): { valid: boolean; draft?: any; errors?: string[] } {
    const model = this.getModel(modelId);
    if (!model) return { valid: false, errors: ['Modelo no encontrado'] };

    const profile = MultiDestinationModel.getProfile(destinationId);
    if (!profile) return { valid: false, errors: ['Destino no encontrado'] };

    // Mapear variables del modelo a inputs del escenario
    const umbral = Number(customParameters.umbralAlerta || customParameters.capacidadObjetivo || 85);
    const intensidad = Number(customParameters.factorAsistencia || customParameters.intensidad || 1);
    const tasaDesembarco = Number(customParameters.tasaDesembarco || 0);

    let visitorVariation = 0;
    if (tasaDesembarco > 0) visitorVariation = Math.round(tasaDesembarco * 0.4);
    else if (customParameters.horizonte) visitorVariation = 20;
    else if (customParameters.ventanaEvento) visitorVariation = 35;

    const draft = {
      destinationId,
      tenantId: profile.tenantId,
      name: `${model.title} · ${profile.destinationName}`,
      description: `Simulación generada a partir del modelo reutilizable «${model.title}» (v${model.version}). ${model.summary}`,
      type: model.id.includes('crucero') ? 'CRUCERO_MASIVO' 
          : model.id.includes('evento') ? 'EVENTO_CULTURAL'
          : model.id.includes('playa') || model.id.includes('meteo') ? 'EPISODIO_METEO'
          : 'PERSONALIZADO',
      createdBy: `Catálogo PID (${model.creatorDestinationName || 'SEGITTUR'})`,
      inputs: {
        zoneIds: zoneIds.length ? zoneIds : (destinationId === 'malaga' ? ['malaga_centro'] : ['palma_casco_antiguo']),
        hour: 12,
        climate: customParameters.clima || 'DESPEJADO',
        visitorVariationPct: visitorVariation,
        operationalCapacityPct: 100,
        mobilityMode: customParameters.modoMovilidad || 'NORMAL',
        alertThresholdPct: umbral,
        intensity: intensidad,
        spatialDistribution: 'CONCENTRADA',
        eventLabel: model.title,
        notes: `Módulos PID requeridos: ${(model.pidModulesRequired || ['S2', 'S18']).join(', ')}. Regla: ${model.ruleSummary}`,
      }
    };

    return { valid: true, draft };
  }
  }
