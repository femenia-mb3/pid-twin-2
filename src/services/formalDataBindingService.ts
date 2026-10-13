// =============================================================================
// SERVICIO DE GOBERNANZA DE VÍNCULOS FORMALES (ITERACIÓN 14)
// Comprobación de fuentes, cobertura espacial, unidades, agregación y aprobación humana
// =============================================================================

import crypto from 'node:crypto';
import { 
  ModelVariableBindingRule, 
  DestinationCoverageReport, 
  RuleApprovalState 
} from '../types/calibrationForecast';
import { CalibrationPostgisExtension } from './calibrationPostgisExtension';
import { DestinationRuntimeService } from './destinationRuntimeService';

export class FormalDataBindingService {
  /**
   * Crea una nueva regla formal de vínculo en estado BORRADOR.
   */
  public static async createBindingRule(
    input: Omit<ModelVariableBindingRule, 'id' | 'approvalState' | 'approvedBy' | 'approvedAt' | 'approvalRationale' | 'evidenceFingerprintSha256' | 'createdAt' | 'updatedAt'>
  ): Promise<{ valid: boolean; rule?: ModelVariableBindingRule; errors: string[] }> {
    const errors: string[] = [];

    if (!input.modelId || !input.modelVariableId) {
      errors.push('Debe especificar el modelo y la variable.');
    }
    if (!input.targetZoneId) {
      errors.push('Debe asociar una zona territorial válida de control.');
    }
    if (!input.sourceConnectorId) {
      errors.push('Debe especificar un conector de origen activo.');
    }
    if (input.unitMultiplier <= 0) {
      errors.push('El multiplicador de unidad debe ser positivo.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const id = `bind_rule_${input.destinationId}_${input.modelId}_${input.modelVariableId}_${input.targetZoneId}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      id,
      tenantId: input.tenantId,
      destinationId: input.destinationId,
      modelId: input.modelId,
      modelVariableId: input.modelVariableId,
      sourceType: input.sourceType,
      sourceConnectorId: input.sourceConnectorId,
      sensorUrn: input.sensorUrn,
      targetZoneId: input.targetZoneId,
      unitMultiplier: input.unitMultiplier,
      aggregationMethod: input.aggregationMethod
    });
    const fingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const rule: ModelVariableBindingRule = {
      ...input,
      id,
      approvalState: 'BORRADOR',
      evidenceFingerprintSha256: fingerprint,
      createdAt: now,
      updatedAt: now
    };

    const saved = await CalibrationPostgisExtension.saveBindingRule(rule);
    if (!saved) {
      return { valid: false, errors: ['Error persistiendo la regla formal en PostGIS.'] };
    }

    return { valid: true, rule, errors: [] };
  }

  /**
   * Aprobación o suspensión humana de una regla de vínculo.
   */
  public static async setRuleApprovalState(
    tenantId: string,
    destinationId: string,
    ruleId: string,
    state: RuleApprovalState,
    operator: { id: string; name: string; role: string },
    rationale: string
  ): Promise<{ success: boolean; rule?: ModelVariableBindingRule; error?: string }> {
    const rule = await CalibrationPostgisExtension.getBindingRuleById(tenantId, destinationId, ruleId);
    if (!rule) {
      return { success: false, error: 'Regla de vínculo no encontrada.' };
    }

    rule.approvalState = state;
    rule.approvedBy = `${operator.name} (${operator.role})`;
    rule.approvedAt = new Date().toISOString();
    rule.approvalRationale = rationale;
    rule.updatedAt = new Date().toISOString();

    const saved = await CalibrationPostgisExtension.saveBindingRule(rule);
    return { success: saved, rule: saved ? rule : undefined };
  }

  /**
   * Evalúa la cobertura territorial de fuentes para un destino y modelo.
   */
  public static async evaluateCoverage(
    tenantId: string,
    destinationId: string,
    modelId: string
  ): Promise<DestinationCoverageReport> {
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const zones = resolution.runtime ? resolution.runtime.zones : [];
    const destinationName = resolution.runtime ? resolution.runtime.destination.nombre : destinationId;

    const rules = await CalibrationPostgisExtension.listBindingRules(tenantId, destinationId, modelId);
    const activeRules = rules.filter(r => r.approvalState === 'APROBADO_OPERADOR');
    const pendingRules = rules.filter(r => r.approvalState === 'BORRADOR');

    const activeRulesByZone = new Map<string, ModelVariableBindingRule[]>();
    activeRules.forEach(r => {
      const list = activeRulesByZone.get(r.targetZoneId) || [];
      list.push(r);
      activeRulesByZone.set(r.targetZoneId, list);
    });

    let coveredZones = 0;
    const zoneDetails = zones.map(z => {
      const zoneRules = activeRulesByZone.get(z.id) || [];
      const hasActive = zoneRules.length > 0;
      if (hasActive) coveredZones++;

      return {
        zoneId: z.id,
        zoneName: z.nombre,
        hasActiveRule: hasActive,
        sensorCount: zoneRules.length,
        signalStatus: (hasActive ? 'OPTIMA' : 'SIN_SENAL') as 'OPTIMA' | 'DEGRADADA' | 'SIN_SENAL'
      };
    });

    const totalZones = Math.max(1, zones.length);
    const coveragePct = Math.round((coveredZones / totalZones) * 100);

    let status: DestinationCoverageReport['status'] = 'SIN_COBERTURA_FORMAL';
    if (coveragePct >= 80) {
      status = 'COBERTURA_COMPLETA';
    } else if (coveragePct > 0) {
      status = 'COBERTURA_PARCIAL';
    }

    return {
      destinationId,
      destinationName,
      modelId,
      totalZonesCount: zones.length,
      coveredZonesCount: coveredZones,
      coveragePct,
      status,
      activeRulesCount: activeRules.length,
      pendingApprovalRulesCount: pendingRules.length,
      zoneDetails,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Lista todas las reglas para un destino.
   */
  public static async listRules(tenantId: string, destinationId: string, modelId?: string): Promise<ModelVariableBindingRule[]> {
    return await CalibrationPostgisExtension.listBindingRules(tenantId, destinationId, modelId);
  }
}
