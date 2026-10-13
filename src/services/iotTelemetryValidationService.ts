import crypto from 'node:crypto';
import { 
  CreateIotConnectorInput, 
  IotBrokerConnectorProfile, 
  NormalizedContextObservation, 
  RawTelemetrySampleInput, 
  RegisteredIotDevice, 
  RegisterIotDeviceInput, 
  SourceActivationDecision 
} from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';
import { NgsiLdEntityType } from '../types/semantic';

export class IotTelemetryValidationService {
  public static async createBrokerProfile(
    input: CreateIotConnectorInput,
    tenantId: string,
    operatorName: string
  ): Promise<{ valid: boolean; profile?: IotBrokerConnectorProfile; errors?: string[] }> {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 3) {
      errors.push('El nombre del conector IoT debe tener al menos 3 caracteres.');
    }
    if (!input.brokerHost || input.brokerHost.trim().length < 3) {
      errors.push('El host del broker MQTT es obligatorio.');
    }
    if (!input.brokerPort || input.brokerPort < 1 || input.brokerPort > 65535) {
      errors.push('El puerto del broker debe estar entre 1 y 65535.');
    }
    if (!input.topicNamespace || !/^pid\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\//.test(input.topicNamespace)) {
      errors.push('El namespace del tópico debe seguir el patrón jerárquico pid/{tenantId}/{destinationId}/...');
    }

    if (!input.evidence?.responsibleEntity || !input.evidence?.purpose) {
      errors.push('La evidencia de gobernanza (entidad responsable y finalidad) es obligatoria.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const id = `iot_${input.destinationId}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const profile: IotBrokerConnectorProfile = {
      id,
      tenantId,
      destinationId: input.destinationId,
      name: input.name.trim(),
      protocol: input.protocol || 'MQTTS_5',
      brokerHost: input.brokerHost.trim(),
      brokerPort: input.brokerPort,
      tlsEnabled: input.tlsEnabled ?? true,
      topicNamespace: input.topicNamespace.trim(),
      defaultQos: input.defaultQos ?? 1,
      authReference: input.authReference || undefined,
      maxMessageSizeBytes: input.maxMessageSizeBytes || 65536,
      maxRateMessagesPerMinute: input.maxRateMessagesPerMinute || 1200,
      activationState: 'BORRADOR',
      evidence: {
        origin: `mqtts://${input.brokerHost}:${input.brokerPort}`,
        responsibleEntity: input.evidence.responsibleEntity,
        license: input.evidence.license || 'CC-BY-4.0',
        traceabilityId: `TR-IOT-${id}`,
        purpose: input.evidence.purpose,
        retentionPolicy: input.evidence.retentionPolicy || '5 años para análisis territorial',
        privacyLevel: input.evidence.privacyLevel || 'DATOS_PUBLICOS_AGREGADOS',
        dataQualityMinPct: input.evidence.dataQualityMinPct || 85,
        territorialCoverage: input.evidence.territorialCoverage || input.destinationId,
        fingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        reviewedAt: now,
        url: input.evidence.url || `/api/iot/connectors/${id}`
      },
      createdBy: operatorName,
      createdAt: now,
      updatedAt: now
    };

    const saved = await postgisRepository.saveIotBrokerConnector(profile);
    if (!saved) {
      return { valid: false, errors: ['Error al persistir el conector IoT en PostGIS.'] };
    }

    return { valid: true, profile };
  }

  public static async registerDevice(
    input: RegisterIotDeviceInput,
    tenantId: string,
    operatorName: string
  ): Promise<{ valid: boolean; device?: RegisteredIotDevice; errors?: string[] }> {
    const errors: string[] = [];

    if (!input.sensorUrn || !input.sensorUrn.startsWith('urn:ngsi-ld:TourismSensor:')) {
      errors.push('sensorUrn debe seguir el formato URN NGSI-LD: urn:ngsi-ld:TourismSensor:{id}');
    }
    if (!input.name || input.name.trim().length < 3) {
      errors.push('El nombre del dispositivo debe tener al menos 3 caracteres.');
    }
    if (!input.measurementConcept) {
      errors.push('measurementConcept es obligatorio (ej. visitorCount, noiseDba, temperature).');
    }
    if (!input.unitCode) {
      errors.push('unitCode es obligatorio (código UNECE/UN-CEFACT, ej. P1, 2N, CEL).');
    }
    if (!input.coordinates || input.coordinates.length !== 2) {
      errors.push('coordinates debe ser una tupla [latitud, longitud] válida.');
    }

    const connector = await postgisRepository.getIotBrokerConnector(input.connectorId, tenantId, input.destinationId);
    if (!connector) {
      errors.push(`Conector IoT broker ${input.connectorId} no encontrado para este destino.`);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const id = `dev_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const device: RegisteredIotDevice = {
      id,
      tenantId,
      destinationId: input.destinationId,
      connectorId: input.connectorId,
      sensorUrn: input.sensorUrn.trim(),
      name: input.name.trim(),
      sensorType: input.sensorType || 'AFORO_PEATONAL',
      measurementConcept: input.measurementConcept.trim(),
      unitCode: input.unitCode.trim(),
      zoneId: input.zoneId,
      zoneName: input.zoneName,
      state: input.state || 'ALTA_REGISTRADA',
      coordinates: input.coordinates,
      evidence: {
        origin: `urn:device:${input.sensorUrn.trim()}`,
        responsibleEntity: input.evidence.responsibleEntity,
        license: input.evidence.license || 'CC-BY-4.0',
        traceabilityId: `TR-DEV-${id}`,
        purpose: input.evidence.purpose,
        retentionPolicy: input.evidence.retentionPolicy || '5 años para análisis territorial',
        privacyLevel: input.evidence.privacyLevel || 'DATOS_PUBLICOS_AGREGADOS',
        dataQualityMinPct: input.evidence.dataQualityMinPct || 85,
        territorialCoverage: input.evidence.territorialCoverage || input.destinationId,
        fingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        reviewedAt: now,
        url: `/api/iot/devices/${id}`
      },
      registeredBy: operatorName,
      registeredAt: now,
      updatedAt: now
    };

    const saved = await postgisRepository.saveIotDevice(device);
    if (!saved) {
      return { valid: false, errors: ['Error al persistir el dispositivo IoT en PostGIS.'] };
    }

    return { valid: true, device };
  }

  public static async recordDecision(
    decision: SourceActivationDecision
  ): Promise<{ success: boolean; newState?: string; errors?: string[] }> {
    const connector = await postgisRepository.getIotBrokerConnector(decision.connectorId, decision.tenantId, decision.destinationId);
    if (!connector) {
      return { success: false, errors: ['Conector IoT no encontrado.'] };
    }

    let nextState: 'BORRADOR' | 'VALIDADO' | 'ACTIVO' | 'SUSPENDIDO' = connector.activationState;
    if (decision.action === 'VALIDAR') nextState = 'VALIDADO';
    if (decision.action === 'ACTIVAR') nextState = 'ACTIVO';
    if (decision.action === 'SUSPENDER') nextState = 'SUSPENDIDO';

    const recorded = await postgisRepository.recordSourceActivationDecision(decision);
    if (!recorded) {
      return { success: false, errors: ['No se pudo registrar la decisión de auditoría inmutable.'] };
    }

    await postgisRepository.updateIotConnectorState(connector.id, decision.tenantId, decision.destinationId, nextState);
    return { success: true, newState: nextState };
  }

  public static async validateAndIngestTelemetrySample(
    connectorId: string,
    tenantId: string,
    destinationId: string,
    sample: RawTelemetrySampleInput
  ): Promise<{
    accepted: boolean;
    observation?: NormalizedContextObservation;
    errorReason?: string;
  }> {
    const connector = await postgisRepository.getIotBrokerConnector(connectorId, tenantId, destinationId);
    if (!connector) {
      return { accepted: false, errorReason: 'Conector IoT no encontrado.' };
    }

    // Regla de Oro: Solo conectores en estado ACTIVO admiten telemetría real
    if (connector.activationState !== 'ACTIVO') {
      return {
        accepted: false,
        errorReason: `El conector IoT ${connectorId} está en estado ${connector.activationState}; requiere activación formal previa.`
      };
    }

    // Validación runtime de valores numéricos finitos
    if (typeof sample.value !== 'number' || !Number.isFinite(sample.value)) {
      return { accepted: false, errorReason: 'El valor de telemetría debe ser un número finito válido.' };
    }

    const device = await postgisRepository.getIotDeviceByUrn(sample.sensorId, tenantId, destinationId);
    if (!device) {
      await postgisRepository.recordSemanticError({
        id: `err_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        tenantId,
        destinationId,
        connectorId,
        sourceType: 'IOT_MQTT',
        reasonCode: 'DISPOSITIVO_NO_REGISTRADO',
        message: `El sensorUrn ${sample.sensorId} no está registrado en el inventario de dispositivos autorizados.`,
        rawPayload: sample as unknown as Record<string, unknown>,
        payloadFingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(sample)).digest('hex'),
        occurredAt: new Date().toISOString()
      });
      return { accepted: false, errorReason: 'Dispositivo no registrado en el inventario del destino.' };
    }

    // Regla de integridad: el sensor debe pertenecer al conector IoT emisor
    if (device.connectorId !== connectorId) {
      await postgisRepository.recordSemanticError({
        id: `err_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        tenantId,
        destinationId,
        connectorId,
        sourceType: 'IOT_MQTT',
        reasonCode: 'CONECTOR_NO_CORRESPONDE',
        message: `El dispositivo ${device.sensorUrn} está registrado bajo el conector ${device.connectorId}, pero la telemetría se envió a través de ${connectorId}.`,
        rawPayload: sample as unknown as Record<string, unknown>,
        payloadFingerprintSha256: crypto.createHash('sha256').update(JSON.stringify(sample)).digest('hex'),
        occurredAt: new Date().toISOString()
      });
      return { accepted: false, errorReason: 'El dispositivo no está asociado al conector IoT emisor.' };
    }

    // Regla de coherencia de tipo de medición y unidad
    if (sample.measurement && sample.measurement !== device.measurementConcept) {
      return { 
        accepted: false, 
        errorReason: `El concepto de medición ${sample.measurement} no coincide con el configurado para el dispositivo (${device.measurementConcept}).` 
      };
    }

    const obsDate = new Date(sample.observedAt);
    if (Number.isNaN(obsDate.getTime())) {
      return { accepted: false, errorReason: 'Timestamp observedAt inválido.' };
    }

    // Regla de calidad: límite de obsolescencia (máx 7 días hacia atrás, no más de 1 hora a futuro)
    const ageHours = (Date.now() - obsDate.getTime()) / (1000 * 3600);
    if (ageHours > 168 || ageHours < -1) {
      return { accepted: false, errorReason: 'Timestamp de observación fuera de ventana temporal admisible.' };
    }

    // Idempotencia
    const idempotencyKey = crypto.createHash('sha256')
      .update(`${connectorId}:${sample.sensorId}:${sample.measurement}:${sample.observedAt}:${sample.sequence ?? 0}`)
      .digest('hex');

    const coords: [number, number] = sample.location?.coordinates
      ? [sample.location.coordinates[1], sample.location.coordinates[0]]
      : device.coordinates;

    const normalizedNgsiLd = {
      id: sample.sensorId,
      type: 'TourismSensor' as NgsiLdEntityType,
      '@context': '/ontology/segittur-pid-context-v1.jsonld',
      destination: { type: 'Relationship', object: `urn:ngsi-ld:TouristDestination:${destinationId}` },
      tenant: { type: 'Relationship', object: `urn:ngsi-ld:Tenant:${tenantId}` },
      measurementConcept: { type: 'Property', value: sample.measurement, observedAt: sample.observedAt },
      currentValue: { type: 'Property', value: sample.value, unitCode: sample.unitCode, observedAt: sample.observedAt },
      location: {
        type: 'GeoProperty',
        value: { type: 'Point', coordinates: [coords[1], coords[0]] },
        observedAt: sample.observedAt
      },
      hasSource: { type: 'Relationship', object: `urn:pid:connector:iot:${connectorId}` }
    };

    const fingerprintSha256 = crypto.createHash('sha256').update(JSON.stringify(normalizedNgsiLd)).digest('hex');

    const observation: NormalizedContextObservation = {
      id: `obs_iot_${crypto.randomBytes(6).toString('hex')}`,
      tenantId,
      destinationId,
      connectorId,
      sourceType: 'IOT_MQTT',
      sensorUrn: sample.sensorId,
      idempotencyKey,
      measurementConcept: sample.measurement,
      value: sample.value,
      unitCode: sample.unitCode,
      observedAt: sample.observedAt,
      receivedAt: new Date().toISOString(),
      coordinates: coords,
      quality: 'A_CERTIFICADA',
      validationStatus: 'VALIDADA',
      rawPayload: sample as unknown as Record<string, unknown>,
      normalizedNgsiLd,
      fingerprintSha256,
      eligibleForSimulation: true
    };

    const saved = await postgisRepository.saveContextObservation(observation);
    if (!saved) {
      return { accepted: false, errorReason: 'Lectura duplicada o rechazada por restricción de persistencia.' };
    }

    return { accepted: true, observation };
  }
}
