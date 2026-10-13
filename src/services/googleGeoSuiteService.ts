import crypto from 'node:crypto';
import {
  GoogleGeoModuleDefinition,
  GoogleGeoEvidenceEnvelope,
  GoogleGeoPrevalidationRequest,
  GoogleGeoPrevalidationRecord,
  GoogleGeoAuditQueryRecord,
} from '../types/googleGeoSuite';
import { GoogleGeoSuitePostgisExtension } from './googleGeoSuitePostgisExtension';
import { OperatorIdentity } from '../types/pilotOperations';

export class GoogleGeoSuiteService {
  /**
   * Catálogo de módulos de Google Geo Suite y su estado de preparación.
   */
  public static readonly MODULES_CATALOG: GoogleGeoModuleDefinition[] = [
    {
      id: 'photorealistic_3d_tiles',
      name: 'Photorealistic 3D Tiles (Cesium)',
      category: 'VISUALIZACION_3D',
      description: 'Malla fotorrealista 3D de alta definición servida en estándar OGC 3D Tiles mediante CesiumJS.',
      status: 'DISPONIBLE_ACTIVO',
      enrichmentRole: 'Inspección visual detallada de cubiertas, fachadas y volumetrías de edificios singulares.',
      pidCompatibility: 'Mapeable sobre zonas y recursos del catálogo territorial PID; degradación automática a Nivel 1/2.',
      governanceRequirement: 'Prevalidación municipal obligatoria; no persistencia de mallas; atribución Google visible.',
      nonPersistenceRule: 'Prohibida la descarga, cacheo persistente o indexación de geometrías 3D en PostGIS/S3.',
      attributionText: 'Imagery ©2026 Google, Data SIO, NOAA, U.S. Navy, NGA, GEBCO',
    },
    {
      id: 'google_3d_maps',
      name: 'Google Maps 3D JavaScript API',
      category: 'VISUALIZACION_3D',
      description: 'Visor 3D nativo WebGL con controles de cámara inmersiva y capas vectoriales dinámicas.',
      status: 'PREPARADO_NO_ACTIVO',
      enrichmentRole: 'Exploración turística preliminar en entornos urbanos consolidados.',
      pidCompatibility: 'Requiere encapsulación en iframe o contenedor aislado para evitar colisiones con Leaflet/Cesium.',
      governanceRequirement: 'Uso restringido a salas de control y demostradores autorizados.',
      nonPersistenceRule: 'No se almacena ningún activo gráfico.',
      attributionText: 'Google Maps Platform 3D API',
    },
    {
      id: 'routes_api',
      name: 'Routes API & Real-Time Traffic',
      category: 'MOVILIDAD_FLUJOS',
      description: 'Matriz de tiempos de desplazamiento multimodal y niveles de congestión del viario urbano.',
      status: 'PREPARADO_NO_ACTIVO',
      enrichmentRole: 'Comparativa de tiempos de desvío peatonal y cálculo de rutas alternativas ante saturación.',
      pidCompatibility: 'Solo usable como dato de contexto en simulación; no sustituye los sensores municipales de aforo.',
      governanceRequirement: 'Validación por técnico de Movilidad del destino antes de generar planes de contingencia.',
      nonPersistenceRule: 'Datos volátiles de tráfico; retención en memoria con expiración en 15 minutos.',
      attributionText: 'Google Routes Service',
    },
    {
      id: 'places_api',
      name: 'Places API (New)',
      category: 'CONTEXTO_POI',
      description: 'Metadatos de afluencia típica por hora (popular times), valoraciones y horarios de comercios/POIs.',
      status: 'PREPARADO_NO_ACTIVO',
      enrichmentRole: 'Enriquecimiento contextual de la oferta complementaria alrededor de los recursos protegidos.',
      pidCompatibility: 'Los POIs oficiales proceden de S2/Ontología PID; Google solo aporta metadatos agregados de demanda.',
      governanceRequirement: 'Prohibido sustituir el inventario municipal por datos de Google.',
      nonPersistenceRule: 'Actualización en tiempo real sin almacenamiento permanente de fichas de negocio.',
      attributionText: 'Google Places Platform',
    },
    {
      id: 'maps_grounding',
      name: 'Gemini Maps Grounding',
      category: 'INTELIGENCIA_GROUNDING',
      description: 'Anclaje factual de modelos de lenguaje con la base de conocimiento geográfico de Google.',
      status: 'PREPARADO_NO_ACTIVO',
      enrichmentRole: 'Asistente de consultas espaciales en lenguaje natural con citas verificables de geolocalización.',
      pidCompatibility: 'El Copiloto IA de la PID mantiene la soberanía de las propuestas de simulación.',
      governanceRequirement: 'Cada respuesta generada debe citar fuentes y quedar registrada en ai_proposals_audit.',
      nonPersistenceRule: 'Trazabilidad de prompts y respuestas en base de datos de auditoría interna.',
      attributionText: 'Grounding with Google Maps Search',
    },
  ];

  /**
   * Genera el sobre de evidencia criptográfica con huella SHA-256 inmutable.
   */
  public static buildEvidenceEnvelope(
    destinationId: string,
    tenantId: string,
    serviceRequested: any,
    purpose: string,
    operator: OperatorIdentity,
    contextFingerprint: string
  ): GoogleGeoEvidenceEnvelope {
    const timestamp = new Date().toISOString();
    const traceabilityId = `gg_ev_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const attribution = 'Imagery ©2026 Google | Plataforma Inteligente de Destinos (SEGITTUR)';
    const disclaimer = 'Datos de Google Maps Platform utilizados exclusivamente como enriquecimiento visual en vivo. Prohibido el almacenamiento permanente de teselas según políticas oficiales de Google Maps Platform. Todos los modelos de decisión y simulación residen en PostGIS bajo soberanía del destino.';

    const rawPayload = `${traceabilityId}|${destinationId}|${tenantId}|${serviceRequested}|${purpose}|${operator.id}|${timestamp}|${contextFingerprint}`;
    const evidenceSha256 = crypto.createHash('sha256').update(rawPayload).digest('hex');

    return {
      traceabilityId,
      destinationId,
      tenantId,
      serviceRequested,
      purpose,
      attributionRequired: attribution,
      nonPersistenceCertified: true,
      humanSupervisor: {
        operatorId: operator.id,
        operatorName: operator.displayName,
        operatorRole: operator.role,
      },
      requestTimestamp: timestamp,
      contextFingerprintSha256: contextFingerprint,
      evidenceSha256,
      disclaimer,
    };
  }

  /**
   * Procesa la prevalidación formal firmada por un operador institucional.
   */
  public static async processPrevalidation(
    req: GoogleGeoPrevalidationRequest,
    operator: OperatorIdentity
  ): Promise<{ success: boolean; record: GoogleGeoPrevalidationRecord; error?: string }> {
    // 1. Verificación de condiciones de gobernanza
    if (!req.acceptedTerms.attributionVisible || !req.acceptedTerms.noTileCachingOrStorage || !req.acceptedTerms.humanSupervisionOnly || !req.acceptedTerms.segitturDataSovereigntyAccepted) {
      return {
        success: false,
        record: null as any,
        error: 'Es obligatorio aceptar todas las condiciones de gobernanza: atribución visible, no almacenamiento y soberanía de datos PID.',
      };
    }

    const prevalidationId = `prev_gg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 días de validez piloto

    const rawFingerprint = `${prevalidationId}|${req.tenantId}|${req.destinationId}|${req.authorizedEntity}|${req.targetZoneId}|${operator.id}|${now.toISOString()}`;
    const fingerprintSha256 = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

    const record: GoogleGeoPrevalidationRecord = {
      id: prevalidationId,
      tenantId: req.tenantId,
      destinationId: req.destinationId,
      authorizedEntity: req.authorizedEntity,
      targetZoneId: req.targetZoneId,
      targetZoneName: req.targetZoneName,
      purpose: req.purpose,
      status: 'APROBADO_PILOTO',
      reviewedBy: {
        operatorId: operator.id,
        operatorName: operator.displayName,
        operatorRole: operator.role,
      },
      evaluatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      justification: req.technicalNotes || 'Prevalidación institucional de prueba piloto para enriquecimiento fotorrealista 3D con CesiumJS bajo supervisión humana.',
      fingerprintSha256,
    };

    // Guardar en PostGIS
    const saved = await GoogleGeoSuitePostgisExtension.savePrevalidation(record, req.tenantId, req.destinationId);

    // Registrar en auditoría
    const auditRecord: GoogleGeoAuditQueryRecord = {
      id: `aud_gg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      tenantId: req.tenantId,
      destinationId: req.destinationId,
      moduleId: 'photorealistic_3d_tiles',
      operatorId: operator.id,
      operatorName: operator.displayName,
      purpose: 'PREVALIDACION_INSTITUCIONAL_APROBADA',
      status: 'AUTORIZADO',
      evidenceSha256: fingerprintSha256,
      attributionRendered: 'Google Maps Platform / SEGITTUR PID',
      requestedAt: now.toISOString(),
      payloadSummary: {
        prevalidationId,
        authorizedEntity: req.authorizedEntity,
        targetZoneId: req.targetZoneId,
        purpose: req.purpose,
      },
    };
    await GoogleGeoSuitePostgisExtension.recordAuditQuery(auditRecord, req.tenantId, req.destinationId);

    return {
      success: saved,
      record,
    };
  }

  /**
   * Conmuta el proveedor visual entre PID Open Data y Google Photorealistic 3D.
   */
  public static async toggleVisualProvider(
    tenantId: string,
    destinationId: string,
    enableGoogle3D: boolean,
    operator: OperatorIdentity
  ): Promise<{ success: boolean; currentVisualProvider: string; evidence?: GoogleGeoEvidenceEnvelope; error?: string }> {
    // 1. Verificar si el destino tiene prevalidación aprobada
    const currentConfig = await GoogleGeoSuitePostgisExtension.getConnectorStatus(tenantId, destinationId);
    if (!currentConfig) {
      return { success: false, currentVisualProvider: 'PID_OPEN_DATA', error: 'Destino no configurado en Google Geo Suite.' };
    }

    if (enableGoogle3D) {
      if (!currentConfig.prevalidation || currentConfig.prevalidation.status !== 'APROBADO_PILOTO') {
        return {
          success: false,
          currentVisualProvider: 'PID_OPEN_DATA',
          error: 'No se puede activar Google Photorealistic 3D sin una prevalidación institucional previa aprobada.',
        };
      }

      // Generar sobre de evidencia
      const evidence = this.buildEvidenceEnvelope(
        destinationId,
        tenantId,
        'photorealistic_3d_tiles',
        'ACTIVACION_VISUALIZACION_FOTORREALISTA_CESIUM',
        operator,
        currentConfig.prevalidation.fingerprintSha256
      );

      // Actualizar estado en PostGIS
      await GoogleGeoSuitePostgisExtension.updateConnectorState(
        tenantId,
        destinationId,
        'ACTIVO_VERIFICADO',
        'GOOGLE_PHOTOREALISTIC_3D',
        ['photorealistic_3d_tiles']
      );

      // Registrar auditoría
      await GoogleGeoSuitePostgisExtension.recordAuditQuery({
        id: `aud_gg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        tenantId,
        destinationId,
        moduleId: 'photorealistic_3d_tiles',
        operatorId: operator.id,
        operatorName: operator.displayName,
        purpose: 'ACTIVACION_FOTORREALISTA_3D',
        status: 'AUTORIZADO',
        evidenceSha256: evidence.evidenceSha256,
        attributionRendered: evidence.attributionRequired,
        requestedAt: new Date().toISOString(),
        payloadSummary: {
          traceabilityId: evidence.traceabilityId,
          activeModules: ['photorealistic_3d_tiles'],
        },
      }, tenantId, destinationId);

      return {
        success: true,
        currentVisualProvider: 'GOOGLE_PHOTOREALISTIC_3D',
        evidence,
      };
    } else {
      // Desactivar y volver a PID Open Data
      await GoogleGeoSuitePostgisExtension.updateConnectorState(
        tenantId,
        destinationId,
        'APROBADO_PILOTO',
        'PID_OPEN_DATA',
        []
      );

      // Registrar auditoría
      const now = new Date();
      const rawEvidence = `REVOCACION|${destinationId}|${tenantId}|${operator.id}|${now.toISOString()}`;
      const revSha = crypto.createHash('sha256').update(rawEvidence).digest('hex');

      await GoogleGeoSuitePostgisExtension.recordAuditQuery({
        id: `aud_gg_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        tenantId,
        destinationId,
        moduleId: 'photorealistic_3d_tiles',
        operatorId: operator.id,
        operatorName: operator.displayName,
        purpose: 'DESACTIVACION_RETORNO_FALLBACK_PID_ABIERTO',
        status: 'FALLBACK_PID_ABIERTO',
        evidenceSha256: revSha,
        attributionRendered: 'IGN / Catastro / PNOA LiDAR',
        requestedAt: now.toISOString(),
        payloadSummary: {
          action: 'FALLBACK_PID_ABIERTO',
          reason: 'Operador desactivó el visor fotorrealista de Google o conmutó a datos abiertos.',
        },
      }, tenantId, destinationId);

      return {
        success: true,
        currentVisualProvider: 'PID_OPEN_DATA',
      };
    }
  }
}
