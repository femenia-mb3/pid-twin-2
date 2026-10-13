import { DataLineageGraph, DataLineageTraceNode } from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';

export class SemanticDataLineageService {
  public static async buildLineageForObservation(
    observationId: string,
    tenantId: string,
    destinationId: string
  ): Promise<DataLineageGraph | null> {
    const obs = await postgisRepository.getContextObservationById(observationId, tenantId, destinationId);
    if (!obs) return null;

    const nodes: DataLineageTraceNode[] = [];

    // Nodo 1: Observación
    nodes.push({
      type: 'OBSERVACION',
      id: obs.id,
      label: `Observación ${obs.measurementConcept}: ${obs.value} ${obs.unitCode}`,
      timestamp: obs.observedAt,
      fingerprintSha256: obs.fingerprintSha256,
      status: obs.validationStatus,
      details: {
        sensorUrn: obs.sensorUrn,
        quality: obs.quality,
        eligibleForSimulation: obs.eligibleForSimulation,
        coordinates: obs.coordinates
      }
    });

    // Nodo 2: Lote si existe
    if (obs.batchId) {
      const batch = await postgisRepository.getSemanticBatchById(obs.batchId, tenantId, destinationId);
      if (batch) {
        nodes.push({
          type: 'LOTE',
          id: batch.id,
          label: `Lote de Ingestión ${batch.connectorType}`,
          timestamp: batch.finishedAt,
          fingerprintSha256: batch.fingerprintSha256,
          status: 'COMPLETADO',
          details: {
            totalReceived: batch.totalReceived,
            totalAccepted: batch.totalAccepted,
            totalRejected: batch.totalRejected
          }
        });
      }
    }

    // Nodo 3: Conector / Contrato
    if (obs.sourceType === 'PID_S2') {
      const connector = await postgisRepository.getS2Connector(obs.connectorId, tenantId, destinationId);
      if (connector) {
        nodes.push({
          type: 'CONECTOR',
          id: connector.id,
          label: `Conector S2: ${connector.name}`,
          timestamp: connector.createdAt,
          fingerprintSha256: connector.evidence.packageFingerprintSha256 || connector.contextFingerprintSha256,
          status: connector.activationState,
          details: {
            baseUrl: connector.baseUrl,
            ontologyIri: connector.ontologyIri,
            apiVersion: connector.apiVersion
          }
        });
      }
    } else {
      const connector = await postgisRepository.getIotBrokerConnector(obs.connectorId, tenantId, destinationId);
      if (connector) {
        nodes.push({
          type: 'CONECTOR',
          id: connector.id,
          label: `Broker IoT: ${connector.name} (${connector.protocol})`,
          timestamp: connector.createdAt,
          fingerprintSha256: connector.evidence.packageFingerprintSha256 || 'sha256_iot_connector',
          status: connector.activationState,
          details: {
            brokerHost: connector.brokerHost,
            topicNamespace: connector.topicNamespace,
            tlsEnabled: connector.tlsEnabled
          }
        });
      }
    }

    // Nodo 4: Vínculo de Modelo si la observación aplica a alguna variable
    const bindings = await postgisRepository.listDataBindings(tenantId, destinationId);
    const matchedBinding = bindings.find(b => b.conectorId === obs.connectorId || b.sourceField === obs.measurementConcept);
    if (matchedBinding) {
      nodes.push({
        type: 'VINCULO_MODELO',
        id: matchedBinding.id,
        label: `Vínculo a Variable [${matchedBinding.modelVariableLabel}]`,
        timestamp: matchedBinding.configuredAt,
        fingerprintSha256: matchedBinding.datasetFingerprintSha256 || 'sha256_direct_telemetry',
        status: matchedBinding.availability,
        details: {
          modelId: matchedBinding.modelId,
          modelTitle: matchedBinding.modelTitle,
          required: matchedBinding.required,
          qualityLevel: matchedBinding.qualityLevel
        }
      });
    }

    return {
      destinationId,
      rootType: 'OBSERVACION',
      rootId: observationId,
      nodes,
      provenanceEvidence: {
        responsibleEntity: 'Destino Territorial Autenticado',
        license: 'CC-BY-4.0',
        traceabilityId: `LINEAGE-${obs.id}`,
        verified: true
      }
    };
  }
}
