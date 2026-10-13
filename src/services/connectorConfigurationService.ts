import crypto from 'node:crypto';
import { 
  OperationalConnectorDefinition, 
  CreateConnectorInput, 
  OperationalConnectorStatus 
} from '../types/operationalConfiguration';
import { postgisRepository } from './postgisRepository';

export class ConnectorConfigurationService {
  /**
   * Crea y valida un nuevo conector no-code. Por defecto, si requiere credenciales
   * y no están verificadas, se establece en PENDIENTE_CREDENCIALES.
   */
  public static async createConnector(
    input: CreateConnectorInput,
    tenantId: string,
    createdBy: string
  ): Promise<{ valid: boolean; connector?: OperationalConnectorDefinition; errors: string[] }> {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 3) {
      errors.push('El nombre del conector debe tener al menos 3 caracteres.');
    }

    if (!input.destinationId) {
      errors.push('El destino asociado al conector es obligatorio.');
    }

    if (!input.fieldMappings || input.fieldMappings.length === 0) {
      errors.push('Debe declarar al menos un mapeo de campo de origen.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const now = new Date().toISOString();
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
    const id = `conn_${input.destinationId}_${slug}_${Date.now().toString(36)}`;
    
    // Regla de seguridad: si no se ha validado en producción, el estado es PENDIENTE_CREDENCIALES o PLANTILLA_DISPONIBLE
    const status: OperationalConnectorStatus = input.status || (
      input.type === 'PID_SERVICE_S2' || input.type === 'PID_SERVICE_C4' || input.type === 'REST_API' || input.type === 'MQTT'
        ? 'PENDIENTE_CREDENCIALES'
        : 'ACTIVO_VERIFICADO'
    );

    const connector: OperationalConnectorDefinition = {
      id,
      tenantId,
      destinationId: input.destinationId,
      name: input.name.trim(),
      type: input.type,
      lane: input.lane,
      status,
      version: 1,
      endpointUrl: input.endpointUrl,
      filePath: input.filePath,
      secretReference: input.secretReference, // Referencia opaca únicamente
      updateFrequency: input.updateFrequency || 'Diaria',
      pidModulesRelated: input.pidModulesRelated || ['S2', 'S18'],
      fieldMappings: input.fieldMappings,
      evidence: {
        origin: input.endpointUrl || input.filePath || 'Fuente declarada por el destino',
        responsibleEntity: input.evidence?.responsibleEntity || 'Ayuntamiento del Destino',
        license: input.evidence?.license || 'CC-BY-4.0',
        purpose: input.evidence?.purpose || 'Alimentación de gemelo digital turístico',
        retentionPolicy: input.evidence?.retentionPolicy || '5 años para análisis histórico',
        privacyLevel: input.evidence?.privacyLevel || 'INTERNO_AGREGADO',
        dataQualityMinPct: input.evidence?.dataQualityMinPct || 85,
        territorialCoverage: input.evidence?.territorialCoverage || input.destinationId,
        reviewedAt: now,
        traceabilityId: `trc_${id}_v1`,
        url: `/api/connectors/${id}`,
        fingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
      },
      createdBy,
      createdAt: now,
      updatedAt: now
    };

    const saved = await postgisRepository.saveOperationalConnector(connector);
    if (!saved) {
      return { valid: false, errors: ['Error persistiendo el conector en PostGIS.'] };
    }

    return { valid: true, connector, errors: [] };
  }

  /**
   * Lista los conectores configurados para un destino.
   */
  public static async listConnectors(
    tenantId: string, 
    destinationId: string
  ): Promise<OperationalConnectorDefinition[]> {
    return await postgisRepository.listOperationalConnectors(tenantId, destinationId);
  }

  /**
   * Obtiene un conector por su ID verificando scope.
   */
  public static async getConnector(
    id: string, 
    tenantId: string, 
    destinationId: string
  ): Promise<OperationalConnectorDefinition | null> {
    return await postgisRepository.getOperationalConnector(id, tenantId, destinationId);
  }
}
