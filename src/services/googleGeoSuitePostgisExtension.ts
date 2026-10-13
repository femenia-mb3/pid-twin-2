import { postgisClient } from './postgisClient';
import {
  GoogleGeoConnectorConfig,
  GoogleGeoConnectorStatus,
  GoogleGeoPrevalidationRecord,
  GoogleGeoAuditQueryRecord,
} from '../types/googleGeoSuite';

export class GoogleGeoSuitePostgisExtension {
  /**
   * Obtiene la configuración del conector Google Geo Suite para un destino dado con RLS.
   */
  public static async getConnectorStatus(
    tenantId: string,
    destinoId: string
  ): Promise<GoogleGeoConnectorConfig | null> {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      // 1. Obtener registro del conector
      const conRes = await client.query(
        `SELECT id, tenant_id, destino_id, estado, proveedor_visual,
                credenciales_configuradas, modulos_activos, actualizado_en
         FROM google_geo_conectores
         WHERE destino_id = $1`,
        [destinoId]
      );

      if (conRes.rows.length === 0) return null;
      const r = conRes.rows[0];

      // 2. Obtener última prevalidación vigente
      const prevRes = await client.query(
        `SELECT id, tenant_id, destino_id, entidad_autorizada, zona_id, zona_nombre,
                proposito, estado, operador_id, operador_nombre, operador_rol,
                terminos_aceptados, justificacion, fingerprint_sha256, creado_en, expira_en
         FROM google_geo_prevalidaciones
         WHERE destino_id = $1 AND expira_en > CURRENT_TIMESTAMP AND estado = 'APROBADO_PILOTO'
         ORDER BY creado_en DESC
         LIMIT 1`,
        [destinoId]
      );

      let prevalidation: GoogleGeoPrevalidationRecord | null = null;
      if (prevRes.rows.length > 0) {
        const pr = prevRes.rows[0];
        prevalidation = {
          id: pr.id,
          tenantId: pr.tenant_id,
          destinationId: pr.destino_id,
          authorizedEntity: pr.entidad_autorizada,
          targetZoneId: pr.zona_id,
          targetZoneName: pr.zona_nombre,
          purpose: pr.proposito,
          status: pr.estado,
          reviewedBy: {
            operatorId: pr.operador_id,
            operatorName: pr.operador_nombre,
            operatorRole: pr.operador_rol,
          },
          evaluatedAt: pr.creado_en.toISOString(),
          expiresAt: pr.expira_en.toISOString(),
          justification: pr.justificacion,
          fingerprintSha256: pr.fingerprint_sha256,
        };
      }

      return {
        destinationId: destinoId,
        destinationName: destinoId === 'malaga' ? 'Málaga' : 'Palma',
        tenantId,
        status: r.estado as GoogleGeoConnectorStatus,
        credentialsConfigured: r.credenciales_configuradas,
        activeModules: r.modulos_activos,
        prevalidation,
        currentVisualProvider: r.proveedor_visual,
        lastEvidenceEnvelope: null,
        updatedAt: r.actualizado_en.toISOString(),
      };
    });
  }

  /**
   * Registra una prevalidación formal aprobada o denegada en PostGIS.
   */
  public static async savePrevalidation(
    record: GoogleGeoPrevalidationRecord,
    tenantId: string,
    destinoId: string
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      // 1. Insertar registro de prevalidación
      await client.query(
        `INSERT INTO google_geo_prevalidaciones (
           id, tenant_id, destino_id, entidad_autorizada, zona_id, zona_nombre,
           proposito, estado, operador_id, operador_nombre, operador_rol,
           terminos_aceptados, justificacion, fingerprint_sha256, creado_en, expira_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          record.id,
          tenantId,
          destinoId,
          record.authorizedEntity,
          record.targetZoneId,
          record.targetZoneName,
          record.purpose,
          record.status,
          record.reviewedBy.operatorId,
          record.reviewedBy.operatorName,
          record.reviewedBy.operatorRole,
          JSON.stringify({ terms: 'accepted' }),
          record.justification,
          record.fingerprintSha256,
          record.evaluatedAt,
          record.expiresAt,
        ]
      );

      // 2. Actualizar estado del conector
      const nuevoEstado: GoogleGeoConnectorStatus = record.status === 'APROBADO_PILOTO' ? 'APROBADO_PILOTO' : 'REVOCADO';
      await client.query(
        `UPDATE google_geo_conectores
         SET estado = $1, actualizado_en = CURRENT_TIMESTAMP
         WHERE destino_id = $2`,
        [nuevoEstado, destinoId]
      );

      return true;
    });
  }

  /**
   * Conmuta el proveedor visual y estado del conector (con fallback a PID_OPEN_DATA).
   */
  public static async updateConnectorState(
    tenantId: string,
    destinoId: string,
    status: GoogleGeoConnectorStatus,
    visualProvider: 'PID_OPEN_DATA' | 'GOOGLE_PHOTOREALISTIC_3D',
    activeModules: string[]
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      await client.query(
        `UPDATE google_geo_conectores
         SET estado = $1,
             proveedor_visual = $2,
             modulos_activos = $3,
             actualizado_en = CURRENT_TIMESTAMP
         WHERE destino_id = $4`,
        [status, visualProvider, JSON.stringify(activeModules), destinoId]
      );
      return true;
    });
  }

  /**
   * Inserta un registro inmutable en el log de auditoría de Google Geo Suite.
   */
  public static async recordAuditQuery(
    record: GoogleGeoAuditQueryRecord,
    tenantId: string,
    destinoId: string
  ): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      await client.query(
        `INSERT INTO google_geo_auditoria_consultas (
           id, tenant_id, destino_id, modulo_id, operador_id, operador_nombre,
           proposito, estado, evidence_sha256, atribucion_mostrada, resumen_payload, solicitado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          record.id,
          tenantId,
          destinoId,
          record.moduleId,
          record.operatorId,
          record.operatorName,
          record.purpose,
          record.status,
          record.evidenceSha256,
          record.attributionRendered,
          JSON.stringify(record.payloadSummary),
        ]
      );
      return true;
    });
  }

  /**
   * Obtiene los registros de auditoría de Google Geo Suite para un destino con RLS.
   */
  public static async getAuditQueries(
    tenantId: string,
    destinoId: string,
    limit = 20
  ): Promise<GoogleGeoAuditQueryRecord[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, modulo_id, operador_id, operador_nombre,
                proposito, estado, evidence_sha256, atribucion_mostrada, resumen_payload, solicitado_en
         FROM google_geo_auditoria_consultas
         WHERE destino_id = $1
         ORDER BY solicitado_en DESC
         LIMIT $2`,
        [destinoId, limit]
      );

      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        moduleId: r.modulo_id,
        operatorId: r.operador_id,
        operatorName: r.operador_nombre,
        purpose: r.proposito,
        status: r.estado,
        evidenceSha256: r.evidence_sha256,
        attributionRendered: r.atribucion_mostrada,
        requestedAt: r.solicitado_en.toISOString(),
        payloadSummary: r.resumen_payload,
      }));
    });
  }
}
