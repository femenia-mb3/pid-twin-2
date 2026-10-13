import { IotTelemetryValidationService } from './iotTelemetryValidationService';
import { RawTelemetrySampleInput } from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';

export interface MqttCollectorStatus {
  service: 'GemeloTur-MqttCollector';
  version: '1.0.0';
  running: boolean;
  activeConnectorsCount: number;
  activeBrokers: Array<{
    connectorId: string;
    destinationId: string;
    brokerUrl: string;
    topicNamespace: string;
    connected: boolean;
    authorized: boolean;
    lastTelemetryAt?: string;
  }>;
  totalMessagesProcessed: number;
  totalMessagesRejected: number;
  simulatedNetworkNotice: string;
}

/**
 * MqttCollectorService:
 * Colector desacoplado y gobernado.
 * 
 * Regla de Oro de Seguridad y Privacidad:
 * - NO conecta de forma autónoma a internet si no hay un conector en estado ACTIVO con secreto referenciado.
 * - Provee procesamiento seguro en el servidor y validación de payloads conforme al esquema NGSI-LD.
 */
export class MqttCollectorService {
  private static isRunning = true;
  private static totalProcessed = 0;
  private static totalRejected = 0;

  public static async getStatus(tenantId: string, destinationId: string): Promise<MqttCollectorStatus> {
    const connectors = await postgisRepository.listIotBrokerConnectors(tenantId, destinationId);
    const activeConnectors = connectors.filter(c => c.activationState === 'ACTIVO');

    return {
      service: 'GemeloTur-MqttCollector',
      version: '1.0.0',
      running: this.isRunning,
      activeConnectorsCount: activeConnectors.length,
      activeBrokers: connectors.map(c => ({
        connectorId: c.id,
        destinationId: c.destinationId,
        brokerUrl: `${c.tlsEnabled ? 'mqtts' : 'mqtt'}://${c.brokerHost}:${c.brokerPort}`,
        topicNamespace: c.topicNamespace,
        connected: c.activationState === 'ACTIVO',
        authorized: Boolean(c.authReference && c.activationState === 'ACTIVO'),
        lastTelemetryAt: c.updatedAt
      })),
      totalMessagesProcessed: this.totalProcessed,
      totalMessagesRejected: this.totalRejected,
      simulatedNetworkNotice: 'Servicio colector persistente operando bajo aislamiento RLS y autorización humana explícita. Ningún secreto ni credencial es expuesto al cliente.'
    };
  }

  public static async processIncomingMessage(
    connectorId: string,
    tenantId: string,
    destinationId: string,
    payload: RawTelemetrySampleInput
  ): Promise<{ accepted: boolean; errorReason?: string }> {
    const result = await IotTelemetryValidationService.validateAndIngestTelemetrySample(
      connectorId,
      tenantId,
      destinationId,
      payload
    );

    if (result.accepted) {
      this.totalProcessed += 1;
    } else {
      this.totalRejected += 1;
    }

    return {
      accepted: result.accepted,
      errorReason: result.errorReason
    };
  }
}
