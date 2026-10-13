// =============================================================================
// MOTOR DE CALIBRACIÓN REAL DE DESTINOS (ITERACIÓN 14 - ENDURECIDO)
// Persistencia server-side de propuestas, validación estricta de factores y firma con JWT
// =============================================================================

import crypto from 'node:crypto';
import { 
  CalibrationProposal, 
  CalibrationFactorProposal, 
  ActiveDestinationCalibration 
} from '../types/calibrationForecast';
import { CalibrationPostgisExtension } from './calibrationPostgisExtension';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { InteroperabilityCatalogService } from './interoperabilityCatalogService';
import { SemanticPostgisExtension } from './semanticPostgisExtension';
import { postgisClient } from './postgisClient';

export class CalibrationEngineService {
  /**
   * Genera y persiste una propuesta técnica de calibración del lado del servidor.
   */
  public static async generateCalibrationProposal(
    tenantId: string,
    destinationId: string,
    modelId: string,
    windowMinutes: number = 60,
    operatorClaims: { id: string; name: string; role: string }
  ): Promise<CalibrationProposal> {
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const runtime = resolution.runtime;
    const destinationName = runtime ? runtime.destination.nombre : destinationId;
    const model = InteroperabilityCatalogService.getModel(modelId);
    const modelTitle = model ? model.title : modelId;

    // 1. Obtener reglas de vínculo aprobadas
    const allRules = await CalibrationPostgisExtension.listBindingRules(tenantId, destinationId, modelId, 'APROBADO_OPERADOR');
    const rulesByZone = new Map<string, typeof allRules>();
    allRules.forEach(r => {
      const list = rulesByZone.get(r.targetZoneId) || [];
      list.push(r);
      rulesByZone.set(r.targetZoneId, list);
    });

    // 2. Obtener observaciones recientes validadas
    const observations = await SemanticPostgisExtension.listContextObservations(tenantId, destinationId, { limit: 200 });

    const proposalsByZone: CalibrationFactorProposal[] = [];
    let totalSignals = 0;
    let sumFactors = 0;
    let zonesWithSignals = 0;

    const zones = runtime ? runtime.zones : [];

    for (const z of zones) {
      const rules = rulesByZone.get(z.id) || [];
      const baseValue = z.afluenciaActual || 1000;
      let aggregateSignal = 0;
      let matchedCount = 0;

      for (const rule of rules) {
        // Filtrar observaciones validadas que correspondan al sensor_urn o connectorId
        const matched = observations.filter(o => 
          (rule.sensorUrn && o.sensorUrn === rule.sensorUrn) ||
          (!rule.sensorUrn && o.connectorId === rule.sourceConnectorId)
        );

        if (matched.length > 0) {
          const latest = matched[0];
          const rawValue = Number(latest.value) || 0;
          const multiplier = Math.max(0.01, Number(rule.unitMultiplier) || 1.0);
          const convertedValue = rawValue * multiplier;
          aggregateSignal += convertedValue;
          matchedCount++;
          totalSignals++;
        }
      }

      // Si no hay señales reales vinculadas, el factor es 1.0 (neutro)
      const rawFactor = matchedCount > 0 ? (aggregateSignal / Math.max(1, baseValue)) : 1.0;
      
      // Acotación forzada de seguridad en servidor [0.40, 2.50]
      const clampedFactor = Math.min(2.5, Math.max(0.4, Number(rawFactor.toFixed(3))));
      const isWithinBounds = rawFactor >= 0.4 && rawFactor <= 2.5;

      if (matchedCount > 0) {
        sumFactors += clampedFactor;
        zonesWithSignals++;
      }

      proposalsByZone.push({
        zoneId: z.id,
        zoneName: z.nombre,
        modeledBaseValue: baseValue,
        observedAggregateSignal: Math.round(aggregateSignal),
        suggestedFactor: Number(rawFactor.toFixed(3)),
        appliedMultiplierClamped: clampedFactor,
        observationsCount: matchedCount,
        sampleTimeRange: {
          from: new Date(Date.now() - windowMinutes * 60000).toISOString(),
          to: new Date().toISOString()
        },
        confidenceScorePct: matchedCount > 0 ? 85 : 40,
        isWithinSafetyBounds: isWithinBounds,
        notes: matchedCount > 0
          ? [`Calibrado con ${matchedCount} fuente(s) aprobada(s).`]
          : ['Sin señales vinculadas aprobadas; factor neutro (1.0).']
      });
    }

    const avgFactor = zonesWithSignals > 0 ? Number((sumFactors / zonesWithSignals).toFixed(3)) : 1.0;
    const proposalId = `cal_prop_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      proposalId,
      tenantId,
      destinationId,
      modelId,
      totalSignals,
      avgFactor,
      proposalsByZone: proposalsByZone.map(p => ({ z: p.zoneId, f: p.appliedMultiplierClamped }))
    });
    const fingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const proposal: CalibrationProposal = {
      id: proposalId,
      tenantId,
      destinationId,
      destinationName,
      modelId,
      modelTitle,
      generatedAt: now,
      dataWindowMinutes: windowMinutes,
      totalSignalsProcessed: totalSignals,
      averageFactor: avgFactor,
      proposalsByZone,
      evidenceFingerprintSha256: fingerprint,
      governanceWarning: totalSignals === 0
        ? 'AVISO: No se detectaron señales observacionales con reglas de vínculo aprobadas. La propuesta contiene factores neutros.'
        : 'PROPUESTA SUJETA A REVISIÓN HUMANA: Ningún factor se aplicará al simulador hasta ser formalmente firmado por un operador institucional.'
    };

    // Persistir propuesta en servidor (PostGIS) bajo contexto de tenant
    if (postgisClient.isAvailable()) {
      await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
        await client.query(
          `INSERT INTO propuestas_calibracion_servidor (
             id, tenant_id, destino_id, model_id, model_title, data_window_minutes,
             total_signals_processed, average_factor, proposals_by_zone,
             evidence_fingerprint_sha256, governance_warning, generado_por, generado_en, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDIENTE_FIRMA')
           ON CONFLICT (id) DO NOTHING`,
          [
            proposal.id,
            proposal.tenantId,
            proposal.destinationId,
            proposal.modelId,
            proposal.modelTitle,
            proposal.dataWindowMinutes,
            proposal.totalSignalsProcessed,
            proposal.averageFactor,
            JSON.stringify(proposal.proposalsByZone),
            proposal.evidenceFingerprintSha256,
            proposal.governanceWarning,
            `${operatorClaims.name} (${operatorClaims.role})`,
            now
          ]
        );
      });
    }

    return proposal;
  }

  /**
   * Aplica una calibración validando la propuesta persistida en el servidor por ID.
   * Evita inyección arbitraria de payloads y garantiza clamping estricto.
   */
  public static async applyCalibrationDecision(
    tenantId: string,
    destinationId: string,
    proposalId: string,
    decision: 'APROBADA' | 'RECHAZADA',
    operatorClaims: { id: string; name: string; role: string; email?: string },
    rationale: string
  ): Promise<{ success: boolean; activeCalibration?: ActiveDestinationCalibration; error?: string }> {
    if (!rationale || rationale.trim().length < 8) {
      return { success: false, error: 'Debe justificar la decisión de calibración con un mínimo de 8 caracteres.' };
    }

    // 1. Recuperar la propuesta registrada en servidor
    if (!postgisClient.isAvailable()) {
      return { success: false, error: 'PostGIS no disponible para validar la propuesta de calibración.' };
    }

    const storedProposal = await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      const res = await client.query(
        `SELECT * FROM propuestas_calibracion_servidor 
         WHERE id = $1 AND tenant_id = $2 AND destino_id = $3
         LIMIT 1`,
        [proposalId, tenantId, destinationId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    });

    if (!storedProposal) {
      return { 
        success: false, 
        error: `Propuesta de calibración '${proposalId}' no encontrada o no pertenece a este destino/tenant.` 
      };
    }

    if (storedProposal.status !== 'PENDIENTE_FIRMA') {
      return { 
        success: false, 
        error: `La propuesta '${proposalId}' ya ha sido procesada previamente (${storedProposal.status}).` 
      };
    }

    const proposalsByZone: CalibrationFactorProposal[] = typeof storedProposal.proposals_by_zone === 'string'
      ? JSON.parse(storedProposal.proposals_by_zone)
      : storedProposal.proposals_by_zone;

    // 2. Revalidar y forzar clamping estricto en servidor [0.40, 2.50]
    const factorsMap: Record<string, number> = {};
    proposalsByZone.forEach(p => {
      const val = Number(p.appliedMultiplierClamped);
      const clamped = Math.min(2.5, Math.max(0.4, Number.isFinite(val) ? val : 1.0));
      factorsMap[p.zoneId] = clamped;
    });

    const activeCalId = `cal_act_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      activeCalId,
      proposalId,
      tenantId,
      destinationId,
      modelId: storedProposal.model_id,
      decision,
      operatorId: operatorClaims.id,
      operatorRole: operatorClaims.role,
      factorsMap,
      rationale,
      decidedAt: now
    });
    const calFingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const activeCalibration: ActiveDestinationCalibration = {
      id: activeCalId,
      tenantId,
      destinationId,
      destinationName: destinationId,
      modelId: storedProposal.model_id,
      version: 1,
      proposalId,
      factorsByZone: factorsMap,
      decisionState: decision,
      operatorId: operatorClaims.id,
      operatorName: operatorClaims.name,
      operatorRole: operatorClaims.role,
      rationale,
      decidedAt: now,
      calibrationFingerprintSha256: calFingerprint,
      status: decision === 'APROBADA' ? 'ACTIVA_VIGENTE' : 'HISTORICA'
    };

    const saved = await CalibrationPostgisExtension.saveActiveCalibration(activeCalibration);
    if (!saved) {
      return { success: false, error: 'Error persistiendo la calibración activa en PostGIS.' };
    }

    // Actualizar estado de la propuesta en servidor
    await postgisClient.withTenantContext(tenantId, destinationId, async (client) => {
      await client.query(
        `UPDATE propuestas_calibracion_servidor SET status = $1 WHERE id = $2`,
        [decision, proposalId]
      );
    });

    return { success: true, activeCalibration };
  }

  /**
   * Obtiene la calibración vigente para un destino y modelo.
   */
  public static async getActiveCalibration(
    tenantId: string, 
    destinationId: string, 
    modelId: string
  ): Promise<ActiveDestinationCalibration | null> {
    return await CalibrationPostgisExtension.getActiveCalibration(tenantId, destinationId, modelId);
  }
}
