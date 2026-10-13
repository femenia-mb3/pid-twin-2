import { postgisClient } from './postgisClient';

export class SemanticPostgisExtension {
  public static async listApprovedOntologies(): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    try {
      const pool = (postgisClient as any).pool;
      if (!pool) return [];
      const res = await pool.query(
        `SELECT id, iri, version, titulo, provenance, creador, licencia,
                documentation_url, context_url, fingerprint_sha256, aprobado, revisado_en
         FROM registros_ontologia_pid
         WHERE aprobado = true
         ORDER BY version DESC`
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        iri: r.iri,
        version: r.version,
        title: r.titulo,
        provenance: r.provenance,
        creator: r.creador,
        license: r.licencia,
        documentationUrl: r.documentation_url,
        contextUrl: r.context_url,
        fingerprintSha256: r.fingerprint_sha256,
        approved: r.aprobado,
        reviewedAt: r.revisado_en.toISOString()
      }));
    } catch {
      return [];
    }
  }

  public static async saveS2Connector(profile: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(profile.tenantId, profile.destinationId, async (client) => {
      await client.query(
        `INSERT INTO conectores_semanticos_s2 (
           id, tenant_id, destino_id, nombre, base_url, api_version,
           context_url, context_fingerprint_sha256, ontology_iri, auth_reference,
           allowed_entity_types, allowed_query_templates, field_mappings,
           quality_policy, activation_state, evidencia, creado_por, creado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           base_url = EXCLUDED.base_url,
           allowed_entity_types = EXCLUDED.allowed_entity_types,
           field_mappings = EXCLUDED.field_mappings,
           quality_policy = EXCLUDED.quality_policy,
           activation_state = EXCLUDED.activation_state,
           evidencia = EXCLUDED.evidencia,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          profile.id,
          profile.tenantId,
          profile.destinationId,
          profile.name,
          profile.baseUrl,
          profile.apiVersion,
          profile.contextUrl,
          profile.contextFingerprintSha256,
          profile.ontologyIri,
          profile.authReference || null,
          JSON.stringify(profile.allowedEntityTypes),
          JSON.stringify(profile.allowedQueryTemplates),
          JSON.stringify(profile.fieldMappings),
          JSON.stringify(profile.qualityPolicy),
          profile.activationState,
          JSON.stringify(profile.evidence),
          profile.createdBy
        ]
      );
      return true;
    });
  }

  public static async getS2Connector(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM conectores_semanticos_s2 WHERE id = $1 AND destino_id = $2 LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        baseUrl: r.base_url,
        apiVersion: r.api_version,
        contextUrl: r.context_url,
        contextFingerprintSha256: r.context_fingerprint_sha256,
        ontologyIri: r.ontology_iri,
        authReference: r.auth_reference,
        allowedEntityTypes: r.allowed_entity_types,
        allowedQueryTemplates: r.allowed_query_templates,
        fieldMappings: r.field_mappings,
        qualityPolicy: r.quality_policy,
        activationState: r.activation_state,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      };
    });
  }

  public static async listS2Connectors(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM conectores_semanticos_s2 WHERE destino_id = $1 ORDER BY creado_en DESC`,
        [destinoId]
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        baseUrl: r.base_url,
        apiVersion: r.api_version,
        contextUrl: r.context_url,
        contextFingerprintSha256: r.context_fingerprint_sha256,
        ontologyIri: r.ontology_iri,
        authReference: r.auth_reference,
        allowedEntityTypes: r.allowed_entity_types,
        allowedQueryTemplates: r.allowed_query_templates,
        fieldMappings: r.field_mappings,
        qualityPolicy: r.quality_policy,
        activationState: r.activation_state,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      }));
    });
  }

  public static async updateS2ConnectorState(id: string, tenantId: string, destinoId: string, state: string): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `UPDATE conectores_semanticos_s2
         SET activation_state = $1, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $2 AND destino_id = $3`,
        [state, id, destinoId]
      );
      return (res.rowCount || 0) > 0;
    });
  }

  public static async saveIotBrokerConnector(profile: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(profile.tenantId, profile.destinationId, async (client) => {
      await client.query(
        `INSERT INTO conectores_iot_broker (
           id, tenant_id, destino_id, nombre, protocolo, broker_host, broker_port,
           tls_enabled, topic_namespace, default_qos, auth_reference,
           max_message_size_bytes, max_rate_messages_per_minute, activation_state,
           evidencia, creado_por, creado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           broker_host = EXCLUDED.broker_host,
           broker_port = EXCLUDED.broker_port,
           tls_enabled = EXCLUDED.tls_enabled,
           topic_namespace = EXCLUDED.topic_namespace,
           activation_state = EXCLUDED.activation_state,
           evidencia = EXCLUDED.evidencia,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          profile.id,
          profile.tenantId,
          profile.destinationId,
          profile.name,
          profile.protocol,
          profile.brokerHost,
          profile.brokerPort,
          profile.tlsEnabled,
          profile.topicNamespace,
          profile.defaultQos,
          profile.authReference || null,
          profile.maxMessageSizeBytes,
          profile.maxRateMessagesPerMinute,
          profile.activationState,
          JSON.stringify(profile.evidence),
          profile.createdBy
        ]
      );
      return true;
    });
  }

  public static async getIotBrokerConnector(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM conectores_iot_broker WHERE id = $1 AND destino_id = $2 LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        protocol: r.protocolo,
        brokerHost: r.broker_host,
        brokerPort: r.broker_port,
        tlsEnabled: r.tls_enabled,
        topicNamespace: r.topic_namespace,
        defaultQos: r.default_qos,
        authReference: r.auth_reference,
        maxMessageSizeBytes: r.max_message_size_bytes,
        maxRateMessagesPerMinute: r.max_rate_messages_per_minute,
        activationState: r.activation_state,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      };
    });
  }

  public static async listIotBrokerConnectors(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM conectores_iot_broker WHERE destino_id = $1 ORDER BY creado_en DESC`,
        [destinoId]
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        protocol: r.protocolo,
        brokerHost: r.broker_host,
        brokerPort: r.broker_port,
        tlsEnabled: r.tls_enabled,
        topicNamespace: r.topic_namespace,
        defaultQos: r.default_qos,
        authReference: r.auth_reference,
        maxMessageSizeBytes: r.max_message_size_bytes,
        maxRateMessagesPerMinute: r.max_rate_messages_per_minute,
        activationState: r.activation_state,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      }));
    });
  }

  public static async updateIotConnectorState(id: string, tenantId: string, destinoId: string, state: string): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `UPDATE conectores_iot_broker
         SET activation_state = $1, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $2 AND destino_id = $3`,
        [state, id, destinoId]
      );
      return (res.rowCount || 0) > 0;
    });
  }

  public static async saveIotDevice(device: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(device.tenantId, device.destinationId, async (client) => {
      const [lat, lon] = device.coordinates;
      await client.query(
        `INSERT INTO dispositivos_iot_registrados (
           id, tenant_id, destino_id, conector_id, sensor_urn, nombre,
           sensor_type, measurement_concept, unit_code, zone_id, zone_name,
           estado, geometria, evidencia, registrado_por, registrado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_SetSRID(ST_MakePoint($13, $14), 4326), $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (sensor_urn) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           sensor_type = EXCLUDED.sensor_type,
           measurement_concept = EXCLUDED.measurement_concept,
           unit_code = EXCLUDED.unit_code,
           estado = EXCLUDED.estado,
           geometria = EXCLUDED.geometria,
           evidencia = EXCLUDED.evidencia,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          device.id,
          device.tenantId,
          device.destinationId,
          device.connectorId,
          device.sensorUrn,
          device.name,
          device.sensorType,
          device.measurementConcept,
          device.unitCode,
          device.zoneId || null,
          device.zoneName || null,
          device.state,
          lon,
          lat,
          JSON.stringify(device.evidence),
          device.registeredBy
        ]
      );
      return true;
    });
  }

  public static async getIotDeviceByUrn(urn: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, conector_id, sensor_urn, nombre,
                sensor_type, measurement_concept, unit_code, zone_id, zone_name,
                estado, ST_Y(geometria) as lat, ST_X(geometria) as lon, evidencia,
                registrado_por, registrado_en, actualizado_en
         FROM dispositivos_iot_registrados
         WHERE sensor_urn = $1 AND destino_id = $2 LIMIT 1`,
        [urn, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        sensorUrn: r.sensor_urn,
        name: r.nombre,
        sensorType: r.sensor_type,
        measurementConcept: r.measurement_concept,
        unitCode: r.unit_code,
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        state: r.estado,
        coordinates: [Number(r.lat), Number(r.lon)],
        evidence: r.evidencia,
        registeredBy: r.registrado_por,
        registeredAt: r.registrado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      };
    });
  }

  public static async listIotDevices(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, conector_id, sensor_urn, nombre,
                sensor_type, measurement_concept, unit_code, zone_id, zone_name,
                estado, ST_Y(geometria) as lat, ST_X(geometria) as lon, evidencia,
                registrado_por, registrado_en, actualizado_en
         FROM dispositivos_iot_registrados
         WHERE destino_id = $1
         ORDER BY registrado_en DESC`,
        [destinoId]
      );
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        sensorUrn: r.sensor_urn,
        name: r.nombre,
        sensorType: r.sensor_type,
        measurementConcept: r.measurement_concept,
        unitCode: r.unit_code,
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        state: r.estado,
        coordinates: [Number(r.lat), Number(r.lon)],
        evidence: r.evidencia,
        registeredBy: r.registrado_por,
        registeredAt: r.registrado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString()
      }));
    });
  }

  public static async saveSemanticBatch(batch: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(batch.tenantId, batch.destinationId, async (client) => {
      await client.query(
        `INSERT INTO lotes_ingestion_semantica (
           id, tenant_id, destino_id, conector_id, conector_tipo, iniciado_en,
           finalizado_en, total_recibidos, total_aceptados, total_rechazados,
           fingerprint_sha256, evidencia
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          batch.id,
          batch.tenantId,
          batch.destinationId,
          batch.connectorId,
          batch.connectorType,
          batch.startedAt,
          batch.finishedAt,
          batch.totalReceived,
          batch.totalAccepted,
          batch.totalRejected,
          batch.fingerprintSha256,
          JSON.stringify(batch.evidence)
        ]
      );
      return true;
    });
  }

  public static async getSemanticBatchById(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM lotes_ingestion_semantica WHERE id = $1 AND destino_id = $2 LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        connectorType: r.conector_tipo,
        startedAt: r.iniciado_en.toISOString(),
        finishedAt: r.finalizado_en.toISOString(),
        totalReceived: r.total_recibidos,
        totalAccepted: r.total_aceptados,
        totalRejected: r.total_rechazados,
        fingerprintSha256: r.fingerprint_sha256,
        evidence: r.evidencia
      };
    });
  }

  public static async saveContextObservation(obs: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(obs.tenantId, obs.destinationId, async (client) => {
      const [lat, lon] = obs.coordinates;
      await client.query(
        `INSERT INTO observaciones_contexto_iot (
           id, tenant_id, destino_id, conector_id, source_type, sensor_urn,
           batch_id, idempotency_key, measurement_concept, valor, unit_code,
           observed_at, received_at, geometria, calidad, validation_status,
           raw_payload, normalized_ngsi_ld, fingerprint_sha256, eligible_for_simulation
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP,
           ST_SetSRID(ST_MakePoint($13, $14), 4326), $15, $16, $17, $18, $19, $20
         )
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          obs.id,
          obs.tenantId,
          obs.destinationId,
          obs.connectorId,
          obs.sourceType,
          obs.sensorUrn,
          obs.batchId || null,
          obs.idempotencyKey,
          obs.measurementConcept,
          obs.value,
          obs.unitCode,
          obs.observedAt,
          lon,
          lat,
          obs.quality,
          obs.validationStatus,
          JSON.stringify(obs.rawPayload),
          JSON.stringify(obs.normalizedNgsiLd),
          obs.fingerprintSha256,
          obs.eligibleForSimulation
        ]
      );
      return true;
    });
  }

  public static async getContextObservationById(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, conector_id, source_type, sensor_urn,
                batch_id, idempotency_key, measurement_concept, valor, unit_code,
                observed_at, received_at, ST_Y(geometria) as lat, ST_X(geometria) as lon,
                calidad, validation_status, raw_payload, normalized_ngsi_ld,
                fingerprint_sha256, eligible_for_simulation
         FROM observaciones_contexto_iot
         WHERE id = $1 AND destino_id = $2 LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        sourceType: r.source_type,
        sensorUrn: r.sensor_urn,
        batchId: r.batch_id,
        idempotencyKey: r.idempotency_key,
        measurementConcept: r.measurement_concept,
        value: Number(r.valor),
        unitCode: r.unit_code,
        observedAt: r.observed_at.toISOString(),
        receivedAt: r.received_at.toISOString(),
        coordinates: [Number(r.lat), Number(r.lon)],
        quality: r.calidad,
        validationStatus: r.validation_status,
        rawPayload: r.raw_payload,
        normalizedNgsiLd: r.normalized_ngsi_ld,
        fingerprintSha256: r.fingerprint_sha256,
        eligibleForSimulation: r.eligible_for_simulation
      };
    });
  }

  public static async listContextObservations(
    tenantId: string,
    destinoId: string,
    filter?: { sensorUrn?: string; sourceType?: string; limit?: number }
  ): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      let query = `SELECT id, tenant_id, destino_id, conector_id, source_type, sensor_urn,
                          batch_id, idempotency_key, measurement_concept, valor, unit_code,
                          observed_at, received_at, ST_Y(geometria) as lat, ST_X(geometria) as lon,
                          calidad, validation_status, raw_payload, normalized_ngsi_ld,
                          fingerprint_sha256, eligible_for_simulation
                   FROM observaciones_contexto_iot
                   WHERE destino_id = $1`;
      const params: any[] = [destinoId];

      if (filter?.sensorUrn) {
        params.push(filter.sensorUrn);
        query += ` AND sensor_urn = $${params.length}`;
      }
      if (filter?.sourceType) {
        params.push(filter.sourceType);
        query += ` AND source_type = $${params.length}`;
      }

      query += ` ORDER BY observed_at DESC LIMIT $${params.length + 1}`;
      params.push(filter?.limit || 50);

      const res = await client.query(query, params);
      return res.rows.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        sourceType: r.source_type,
        sensorUrn: r.sensor_urn,
        batchId: r.batch_id,
        idempotencyKey: r.idempotency_key,
        measurementConcept: r.measurement_concept,
        value: Number(r.valor),
        unitCode: r.unit_code,
        observedAt: r.observed_at.toISOString(),
        receivedAt: r.received_at.toISOString(),
        coordinates: [Number(r.lat), Number(r.lon)],
        quality: r.calidad,
        validationStatus: r.validation_status,
        rawPayload: r.raw_payload,
        normalizedNgsiLd: r.normalized_ngsi_ld,
        fingerprintSha256: r.fingerprint_sha256,
        eligibleForSimulation: r.eligible_for_simulation
      }));
    });
  }

  public static async recordSemanticError(err: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(err.tenantId, err.destinationId, async (client) => {
      await client.query(
        `INSERT INTO errores_ingestion_semantica (
           id, tenant_id, destino_id, conector_id, source_type,
           reason_code, mensaje, raw_payload, payload_fingerprint_sha256, ocurrido_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          err.id,
          err.tenantId,
          err.destinationId,
          err.connectorId,
          err.sourceType,
          err.reasonCode,
          err.message,
          JSON.stringify(err.rawPayload),
          err.payloadFingerprintSha256
        ]
      );
      return true;
    });
  }

  public static async recordSourceActivationDecision(decision: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(decision.tenantId, decision.destinationId, async (client) => {
      await client.query(
        `INSERT INTO decisiones_activacion_fuentes_audit (
           id, tenant_id, destino_id, conector_id, connector_kind, accion,
           operador_id, operador_nombre, operador_rol, justificacion,
           evidence_fingerprint_sha256, decidido_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          decision.id,
          decision.tenantId,
          decision.destinationId,
          decision.connectorId,
          decision.connectorKind,
          decision.action,
          decision.operatorId,
          decision.operatorName,
          decision.operatorRole,
          decision.rationale,
          decision.evidenceFingerprintSha256
        ]
      );
      return true;
    });
  }
}
