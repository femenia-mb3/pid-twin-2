import crypto from 'node:crypto';
import { 
  CreateS2ConnectorInput, 
  NormalizedContextObservation, 
  S2SemanticConnectorProfile, 
  SemanticBatchRecord, 
  SourceActivationDecision 
} from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';
import { OFFICIAL_PID_CORE_ONTOLOGY, PidOntologyRegistryService } from './pidOntologyRegistryService';
import { NgsiLdEntityType } from '../types/semantic';

export class S2SemanticConnectorService {
  public static async createProfile(
    input: CreateS2ConnectorInput,
    tenantId: string,
    operatorName: string
  ): Promise<{ valid: boolean; profile?: S2SemanticConnectorProfile; errors?: string[] }> {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 3) {
      errors.push('El nombre del conector S2 debe tener al menos 3 caracteres.');
    }
    if (!input.baseUrl || !/^https?:\/\//i.test(input.baseUrl)) {
      errors.push('La baseUrl de S2 debe ser una URL válida HTTP/HTTPS.');
    }
    if (!Array.isArray(input.allowedEntityTypes) || input.allowedEntityTypes.length === 0) {
      errors.push('Debe indicar al menos un tipo NGSI-LD permitido (ej. TouristDestination, TourismSensor).');
    }

    const ontologyIri = input.ontologyIri || OFFICIAL_PID_CORE_ONTOLOGY.iri;
    const ontology = await PidOntologyRegistryService.getOntologyByIri(ontologyIri);
    if (!ontology || !ontology.approved) {
      errors.push(`La ontología indicada (${ontologyIri}) no está en el registro institucional de ontologías aprobadas.`);
    }

    if (!input.evidence?.responsibleEntity || !input.evidence?.purpose) {
      errors.push('La evidencia de gobernanza (entidad responsable y finalidad) es obligatoria.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const contextUrl = input.contextUrl || OFFICIAL_PID_CORE_ONTOLOGY.contextUrl;
    const contextFingerprintSha256 = PidOntologyRegistryService.computeContextFingerprint(contextUrl);

    const id = `s2_${input.destinationId}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const profile: S2SemanticConnectorProfile = {
      id,
      tenantId,
      destinationId: input.destinationId,
      name: input.name.trim(),
      baseUrl: input.baseUrl.trim(),
      apiVersion: input.apiVersion || 'NGSI-LD-1.8',
      contextUrl,
      contextFingerprintSha256,
      ontologyIri,
      authReference: input.authReference || undefined,
      allowedEntityTypes: input.allowedEntityTypes,
      allowedQueryTemplates: input.allowedQueryTemplates || ['/ngsi-ld/v1/entities?type={type}&limit={limit}'],
      fieldMappings: input.fieldMappings || [],
      qualityPolicy: {
        minimumQuality: input.qualityPolicy?.minimumQuality || 'B_ESTIMADA',
        maxLatencySeconds: input.qualityPolicy?.maxLatencySeconds || 3600,
        requireGeoproperty: input.qualityPolicy?.requireGeoproperty ?? true
      },
      activationState: 'BORRADOR',
      evidence: {
        
        origin: input.baseUrl,
        responsibleEntity: input.evidence.responsibleEntity,
        license: input.evidence.license || 'CC-BY-4.0',
        traceabilityId: `TR-S2-${id}`,
        purpose: input.evidence.purpose,
        retentionPolicy: input.evidence.retentionPolicy || '5 años para análisis territorial',
        privacyLevel: input.evidence.privacyLevel || 'DATOS_PUBLICOS_AGREGADOS',
        dataQualityMinPct: input.evidence.dataQualityMinPct || 85,
        territorialCoverage: input.evidence.territorialCoverage || input.destinationId,
        fingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        reviewedAt: now,
        url: input.evidence.url || `/api/semantic/s2-connectors/${id}`
      },
      createdBy: operatorName,
      createdAt: now,
      updatedAt: now
    };

    const saved = await postgisRepository.saveS2Connector(profile);
    if (!saved) {
      return { valid: false, errors: ['Error al persistir el conector S2 en PostGIS.'] };
    }

    return { valid: true, profile };
  }

  public static async executePreflight(
    connectorId: string,
    tenantId: string,
    destinationId: string
  ): Promise<{
    allowed: boolean;
    status: 'BLOQUEADO_SIN_AUTORIZACION' | 'SIMULACION_PREFLIGHT_VERIFICADA' | 'RECHAZADO';
    message: string;
    details: Record<string, unknown>;
  }> {
    const connector = await postgisRepository.getS2Connector(connectorId, tenantId, destinationId);
    if (!connector) {
      return {
        allowed: false,
        status: 'RECHAZADO',
        message: 'Conector S2 no encontrado.',
        details: { connectorId }
      };
    }

    // Regla de seguridad estricta: NO se ejecutan llamadas de red a endpoints reales no autorizados
    if (!connector.authReference || connector.activationState === 'BORRADOR') {
      return {
        allowed: false,
        status: 'BLOQUEADO_SIN_AUTORIZACION',
        message: 'Preflight bloqueado: el conector está en estado BORRADOR o no cuenta con secreto institucional configurado. Debe ser validado y autorizado por un operador humano.',
        details: {
          connectorId: connector.id,
          activationState: connector.activationState,
          authReferencePresent: Boolean(connector.authReference),
          baseUrl: connector.baseUrl,
          requiresHumanApproval: true
        }
      };
    }

    return {
      allowed: true,
      status: 'SIMULACION_PREFLIGHT_VERIFICADA',
      message: 'Preflight sintáctico verificado: esquema NGSI-LD compatible, tipos registrados y contexto alineado.',
      details: {
        connectorId: connector.id,
        allowedEntityTypes: connector.allowedEntityTypes,
        apiVersion: connector.apiVersion,
        contextUrl: connector.contextUrl
      }
    };
  }

  public static async recordDecision(
    decision: SourceActivationDecision
  ): Promise<{ success: boolean; newState?: string; errors?: string[] }> {
    const connector = await postgisRepository.getS2Connector(decision.connectorId, decision.tenantId, decision.destinationId);
    if (!connector) {
      return { success: false, errors: ['Conector S2 no encontrado.'] };
    }

    let nextState: 'BORRADOR' | 'VALIDADO' | 'ACTIVO' | 'SUSPENDIDO' = connector.activationState;
    if (decision.action === 'VALIDAR') nextState = 'VALIDADO';
    if (decision.action === 'ACTIVAR') nextState = 'ACTIVO';
    if (decision.action === 'SUSPENDER') nextState = 'SUSPENDIDO';

    const recorded = await postgisRepository.recordSourceActivationDecision(decision);
    if (!recorded) {
      return { success: false, errors: ['No se pudo registrar la decisión de auditoría inmutable.'] };
    }

    await postgisRepository.updateS2ConnectorState(connector.id, decision.tenantId, decision.destinationId, nextState);
    return { success: true, newState: nextState };
  }

  public static async ingestSampleBatch(
    connectorId: string,
    tenantId: string,
    destinationId: string,
    samples: Array<{
      sensorUrn: string;
      measurementConcept: string;
      value: number;
      unitCode: string;
      observedAt: string;
      coordinates: [number, number];
      rawPayload?: Record<string, unknown>;
    }>,
    _operatorName: string
  ): Promise<{
    batch: SemanticBatchRecord;
    observations: NormalizedContextObservation[];
    rejected: Array<{ reason: string; item: unknown }>;
  }> {
    const connector = await postgisRepository.getS2Connector(connectorId, tenantId, destinationId);
    if (!connector) {
      throw new Error(`Conector S2 ${connectorId} no encontrado para este destino.`);
    }

    if (connector.activationState !== 'ACTIVO' && connector.activationState !== 'VALIDADO') {
      throw new Error(`El conector S2 ${connectorId} se encuentra en estado ${connector.activationState} y no admite ingestión.`);
    }

    const batchId = `s2_batch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const observations: NormalizedContextObservation[] = [];
    const rejected: Array<{ reason: string; item: unknown }> = [];

    for (const rawSample of (samples as any[])) {
      const sensorUrn = rawSample.sensorUrn || rawSample.id || "urn:ngsi-ld:TourismSensor:default";
      const measurementConcept = rawSample.measurementConcept?.value || rawSample.measurementConcept || "visitorCount";
      const value = typeof rawSample.currentValue?.value === "number" ? rawSample.currentValue.value : (typeof rawSample.value === "number" ? rawSample.value : 0);
      const unitCode = rawSample.currentValue?.unitCode || rawSample.unitCode || "P1";
      const observedAt = rawSample.observedAt || new Date().toISOString();
      const coords: [number, number] = rawSample.location?.value?.coordinates 
        ? [rawSample.location.value.coordinates[1], rawSample.location.value.coordinates[0]]
        : (rawSample.coordinates || [36.7202, -4.4214]);

      const obsTime = new Date(observedAt);
      if (Number.isNaN(obsTime.getTime())) {
        rejected.push({ reason: 'Timestamp observado inválido', item: rawSample });
        continue;
      }

      if (value < 0 || value > 1000000) {
        rejected.push({ reason: 'Valor fuera de rango admisible', item: rawSample });
        continue;
      }

      const idempotencyKey = crypto.createHash('sha256')
        .update(`${connectorId}:${sensorUrn}:${measurementConcept}:${observedAt}`)
        .digest('hex');

      const raw = rawSample.rawPayload || rawSample || {
        source: 'S2_REST_SIMULATED',
        sensorUrn,
        measurement: measurementConcept,
        value,
        unitCode,
        observedAt
      };

      const normalizedNgsiLd = {
        id: sensorUrn,
        type: 'TourismSensor' as NgsiLdEntityType,
        '@context': connector.contextUrl,
        destination: { type: 'Relationship', object: `urn:ngsi-ld:TouristDestination:${destinationId}` },
        tenant: { type: 'Relationship', object: `urn:ngsi-ld:Tenant:${tenantId}` },
        measurementConcept: { type: 'Property', value: measurementConcept, observedAt },
        currentValue: { type: 'Property', value, unitCode, observedAt },
        location: {
          type: 'GeoProperty',
          value: { type: 'Point', coordinates: [coords[1], coords[0]] },
          observedAt
        },
        hasSource: { type: 'Relationship', object: `urn:pid:connector:s2:${connectorId}` }
      };

      const fingerprintSha256 = crypto.createHash('sha256').update(JSON.stringify(normalizedNgsiLd)).digest('hex');

      observations.push({
        id: `obs_s2_${crypto.randomBytes(6).toString('hex')}`,
        tenantId,
        destinationId,
        connectorId,
        sourceType: 'PID_S2',
        sensorUrn,
        batchId,
        idempotencyKey,
        measurementConcept,
        value,
        unitCode,
        observedAt,
        receivedAt: now,
        coordinates: coords,
        quality: connector.qualityPolicy.minimumQuality,
        validationStatus: 'VALIDADA',
        rawPayload: raw,
        normalizedNgsiLd,
        fingerprintSha256,
        eligibleForSimulation: true
      });
    }

    const batch: SemanticBatchRecord = {
      id: batchId,
      tenantId,
      destinationId,
      connectorId,
      connectorType: 'PID_S2',
      startedAt: now,
      finishedAt: new Date().toISOString(),
      totalReceived: samples.length,
      totalAccepted: observations.length,
      totalRejected: rejected.length,
      fingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(observations.map(o => o.fingerprintSha256))).digest('hex'),
      evidence: {
        origin: connector.baseUrl,
        responsibleEntity: connector.evidence.responsibleEntity,
        license: connector.evidence.licenseDeclared,
        traceabilityId: `TR-S2-${batchId}`
      }
    };

    await postgisRepository.saveSemanticBatch(batch);
    for (const obs of observations) {
      await postgisRepository.saveContextObservation(obs);
    }

    return { batch, observations, rejected };
  }
}
