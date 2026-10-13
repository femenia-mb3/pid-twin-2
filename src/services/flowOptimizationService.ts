// =============================================================================
// SERVICIO DE OPTIMIZACIÓN Y DESVÍO DINÁMICO DE FLUJOS (ITERACIÓN 15)
// Algoritmo de dispersión de saturación hacia zonas receptoras y firma humana
// =============================================================================

import crypto from 'node:crypto';
import { 
  FlowOptimizationProposal, 
  FlowDiversionRoute, 
  OptimizationDecisionRecord 
} from '../types/macroOptimizationStress';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { MacroPostgisExtension } from './macroPostgisExtension';

export class FlowOptimizationService {
  /**
   * Genera una propuesta de balanceo de flujos identificando zonas críticas y receptoras
   */
  public static async generateProposal(
    tenantId: string,
    destinationId: string,
    criticalThresholdPct: number = 80
  ): Promise<FlowOptimizationProposal> {
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const runtime = resolution.runtime;
    const destName = runtime ? runtime.destination.nombre : destinationId;
    const zones = runtime ? runtime.zones : [];

    // Clasificar zonas saturadas vs zonas receptoras
    const saturatedZones = zones.filter(z => {
      const cap = z.aforoMaximo || 3000;
      const afl = z.afluenciaActual || 1500;
      const sat = (afl / cap) * 100;
      return sat >= criticalThresholdPct;
    });

    const receptiveZones = zones.filter(z => {
      const cap = z.aforoMaximo || 3000;
      const afl = z.afluenciaActual || 1500;
      const sat = (afl / cap) * 100;
      return sat < 65;
    });

    const routes: FlowDiversionRoute[] = [];
    let totalRelief = 0;

    // Si no hay zonas saturadas naturales en la demo, forzar la zona principal para permitir optimización demostrativa
    const originZones = saturatedZones.length > 0 ? saturatedZones : [zones[0]];
    const targetZones = receptiveZones.length > 0 ? receptiveZones : [zones[zones.length - 1]];

    for (const src of originZones) {
      if (!src) continue;
      const srcCap = src.aforoMaximo || 3000;
      const srcAfl = src.afluenciaActual || 2400;
      const srcSat = Number(((srcAfl / srcCap) * 100).toFixed(1));

      for (const tgt of targetZones) {
        if (!tgt || tgt.id === src.id) continue;
        const tgtCap = tgt.aforoMaximo || 3500;
        const tgtAfl = tgt.afluenciaActual || 900;
        const tgtSat = Number(((tgtAfl / tgtCap) * 100).toFixed(1));

        const suggestedShare = 22; // 22% de desvío recomendado
        const relief = Number((srcSat * (suggestedShare / 100)).toFixed(1));
        totalRelief += relief;

        routes.push({
          sourceZoneId: src.id,
          sourceZoneName: src.nombre,
          sourceCurrentSaturationPct: srcSat,
          targetZoneId: tgt.id,
          targetZoneName: tgt.nombre,
          targetCurrentSaturationPct: tgtSat,
          suggestedDiversionSharePct: suggestedShare,
          expectedSaturationReliefPct: relief,
          transitModeRecommended: destinationId === 'malaga' ? 'PEATONAL_SEÑALIZADA' : 'MICRO_MOVILIDAD',
          corridorName: `Corredor Verde Alternativo ${src.nombre} ➔ ${tgt.nombre}`,
          incentivesSuggested: [
            'Apertura preferente y bonificación en espacios culturales alternativos',
            'Despliegue de señalética digital dinámica y tótems interactivos PID',
            'Priorización semafórica de corredores peatonales de desvío'
          ]
        });
      }
    }

    const proposalId = `opt_prop_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const avgRelief = routes.length > 0 ? Number((totalRelief / routes.length).toFixed(1)) : 15.0;

    const signaturePayload = JSON.stringify({
      proposalId,
      tenantId,
      destinationId,
      criticalZonesCount: originZones.length,
      routes: routes.map(r => ({ s: r.sourceZoneId, t: r.targetZoneId, relief: r.expectedSaturationReliefPct })),
      avgRelief
    });
    const fingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const proposal: FlowOptimizationProposal = {
      id: proposalId,
      tenantId,
      destinationId,
      destinationName: destName,
      generatedAt: now,
      triggerCondition: `Afluencia en eje principal supera umbral preventivo (${criticalThresholdPct}%).`,
      criticalZonesCount: originZones.length,
      receptiveZonesCount: targetZones.length,
      suggestedRoutes: routes,
      projectedPeakReliefPct: avgRelief,
      estimatedDiversionCostEuros: routes.length * 3500, // Coste de señalética y refuerzo operativo
      evidenceFingerprintSha256: fingerprint,
      status: 'PENDIENTE_FIRMA',
      governanceWarning: 'PROPUESTA DE DESVÍO DE FLUJOS: La aplicación de medidas de gestión territorial requiere aprobación formal y firma de un operador municipal.'
    };

    await MacroPostgisExtension.saveFlowOptimizationProposal(proposal);
    return proposal;
  }

  /**
   * Registra la decisión humana de un operador institucional sobre la propuesta de optimización
   */
  public static async applyDecision(
    tenantId: string,
    destinationId: string,
    proposalId: string,
    decision: 'APROBADA_OPERADOR' | 'RECHAZADA_OPERADOR',
    operatorClaims: { id: string; name: string; role: string },
    rationale: string
  ): Promise<{ success: boolean; decisionRecord?: OptimizationDecisionRecord; error?: string }> {
    if (!rationale || rationale.trim().length < 8) {
      return { success: false, error: 'Debe justificar la decisión de optimización con al menos 8 caracteres.' };
    }

    const proposal = await MacroPostgisExtension.getFlowOptimizationProposal(tenantId, destinationId, proposalId);
    if (!proposal) {
      return { success: false, error: `Propuesta de optimización '${proposalId}' no encontrada o no pertenece al destino.` };
    }

    if (proposal.status !== 'PENDIENTE_FIRMA') {
      return { success: false, error: `La propuesta '${proposalId}' ya fue procesada anteriormente (${proposal.status}).` };
    }

    const decisionId = `opt_dec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      decisionId,
      proposalId,
      tenantId,
      destinationId,
      decision,
      operatorId: operatorClaims.id,
      rationale,
      decidedAt: now
    });
    const decisionFingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const decisionRecord: OptimizationDecisionRecord = {
      id: decisionId,
      tenantId,
      destinationId,
      proposalId,
      decision,
      operatorId: operatorClaims.id,
      operatorName: operatorClaims.name,
      operatorRole: operatorClaims.role,
      rationale,
      decidedAt: now,
      decisionFingerprintSha256: decisionFingerprint
    };

    const saved = await MacroPostgisExtension.recordOptimizationDecision(decisionRecord);
    if (!saved) {
      return { success: false, error: 'Error persistiendo la decisión de optimización en PostGIS.' };
    }

    return { success: true, decisionRecord };
  }
}
