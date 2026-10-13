import {
  NgsiLdEntity,
  NgsiLdEntityType,
  SemanticValidationResult,
  SEMANTIC_CONTEXT_URL,
} from '../types/semantic';

const SUPPORTED_ENTITY_TYPES: NgsiLdEntityType[] = [
  'TouristDestination',
  'TourismZone',
  'TourismResource',
  'TourismSensor',
  'TourismEvent',
  'SimulationScenario',
  'SimulationResult',
  'Dataset3D',
  'DataSource',
  'DestinationProfile',
  'IngestionContract'
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const hasCompatibleContext = (context: unknown) => {
  if (typeof context === 'string') return context === SEMANTIC_CONTEXT_URL;
  if (Array.isArray(context)) return context.some(item => item === SEMANTIC_CONTEXT_URL);
  return false;
};

const isRelationship = (value: unknown): value is { type: string; object: string } => (
  isRecord(value) && value.type === 'Relationship' && typeof value.object === 'string' && value.object.length > 0
);

/**
 * Valida el mínimo común para que un adaptador municipal pueda enviar entidades sin
 * acoplarse al modelo interno. La persistencia se ejecutará después en el piloto PostGIS.
 */
export const SemanticAdapter = {
  validateEntity: (input: unknown): SemanticValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isRecord(input)) {
      return { valid: false, errors: ['La entidad debe ser un objeto JSON-LD.'], warnings };
    }

    const id = input.id;
    const type = input.type;
    const context = input['@context'];
    const destination = input.destination;

    if (typeof id !== 'string' || !id.startsWith('urn:ngsi-ld:')) {
      errors.push('id es obligatorio y debe usar un URN NGSI-LD (urn:ngsi-ld:<Tipo>:<destino>:<id>).');
    }

    if (typeof type !== 'string' || !SUPPORTED_ENTITY_TYPES.includes(type as NgsiLdEntityType)) {
      errors.push(`type es obligatorio y debe ser uno de: ${SUPPORTED_ENTITY_TYPES.join(', ')}.`);
    }

    if (!hasCompatibleContext(context)) {
      errors.push(`@context debe contener el contexto de perfil ${SEMANTIC_CONTEXT_URL}.`);
    }

    if (!isRelationship(destination)) {
      errors.push('destination es obligatorio y debe ser una Relationship NGSI-LD con object.');
    }

    if (typeof type === 'string' && type === 'TouristDestination') {
      const name = input.name;
      const ineCode = input.ineCode;
      if (!isRecord(name) || name.type !== 'Property' || typeof name.value !== 'string') {
        errors.push('TouristDestination requiere name como Property de texto.');
      }
      if (!isRecord(ineCode) || ineCode.type !== 'Property' || typeof ineCode.value !== 'string') {
        errors.push('TouristDestination requiere ineCode como Property de texto.');
      }
    }

    if (typeof type === 'string' && ['TourismZone', 'TourismResource', 'TourismSensor', 'Dataset3D'].includes(type)) {
      if (!isRecord(input.location) || input.location.type !== 'GeoProperty') {
        errors.push(`${type} requiere location como GeoProperty.`);
      }
    }

    if (typeof type === 'string' && type === 'TourismSensor') {
      if (!isRecord(input.measurement) || input.measurement.type !== 'Property') {
        errors.push('TourismSensor requiere measurement como Property.');
      }
    }

    if (!('dataQuality' in input)) {
      warnings.push('La entidad no declara dataQuality; se recomienda mantener el contrato de gobernanza PID.');
    }
    if (!('traceabilityId' in input)) {
      warnings.push('La entidad no declara traceabilityId; se recomienda registrar procedencia y trazabilidad.');
    }

    if (errors.length > 0) return { valid: false, errors, warnings };

    return {
      valid: true,
      normalizedEntity: {
        ...(input as unknown as NgsiLdEntity),
        '@context': Array.isArray(context) ? context : [context as string],
      },
      errors,
      warnings
    };
  },

  supportedEntityTypes: () => SUPPORTED_ENTITY_TYPES
};
