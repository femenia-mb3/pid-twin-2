// =============================================================================
// SERVICIO DE IMPACTO MACROECONÓMICO Y RENDIMIENTO TURÍSTICO (ITERACIÓN 15)
// Cuantificación de gasto directo, VAB inducido, retorno fiscal y externalidades
// =============================================================================

import crypto from 'node:crypto';
import { 
  MacroeconomicImpactMetrics, 
  MacroeconomicSimulationResult 
} from '../types/macroOptimizationStress';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { CalibrationEngineService } from './calibrationEngineService';
import { MacroPostgisExtension } from './macroPostgisExtension';

export class MacroeconomicImpactService {
  /**
   * Calcula el vector de métricas macroeconómicas para un volumen dado de visitantes y perfil del destino
   */
  public static calculateMetrics(
    totalVisitors: number,
    destinationMultiplier: number = 1.42,
    baseDailySpend: number = 148.50
  ): MacroeconomicImpactMetrics {
    const visitors = Math.max(0, totalVisitors);

    // Gasto directo distribuido por categorías sectoriales (encuestas INE / EGATUR)
    const directSpend = visitors * baseDailySpend;
    const spendByCategory = {
      alojamiento: Number((directSpend * 0.38).toFixed(2)),
      restauracion: Number((directSpend * 0.28).toFixed(2)),
      comercioMinorista: Number((directSpend * 0.16).toFixed(2)),
      culturaYActividades: Number((directSpend * 0.10).toFixed(2)),
      transporteLocal: Number((directSpend * 0.08).toFixed(2))
    };

    // Valor Añadido Bruto (VAB) directo e indirecto/inducido (matriz insumo-producto)
    const directVab = Number((directSpend * 0.58).toFixed(2));
    const totalVab = Number((directVab * destinationMultiplier).toFixed(2));
    const indirectAndInducedVab = Number((totalVab - directVab).toFixed(2));

    // Empleo equivalente a tiempo completo (aprox. 1 empleo anual por cada 62.000 € de VAB turístico)
    const equivalentJobs = Number((totalVab / 62000).toFixed(1));

    // Retorno fiscal municipal estimado
    const tasaTuristica = Number((visitors * 1.50).toFixed(2)); // Tasa estimada 1.50 €/visitante
    const impuestosComerciales = Number((directSpend * 0.022).toFixed(2)); // IBI e IAE imputable
    const ivaProrrateado = Number((directSpend * 0.035).toFixed(2)); // Participación municipal en tributos cedidos
    const totalFiscal = Number((tasaTuristica + impuestosComerciales + ivaProrrateado).toFixed(2));

    // Externalidades socioambientales estimadas
    const limpieza = Number((visitors * 0.45).toFixed(2)); // 0.45 €/visitante en sobrecoste de RSU y baldeo
    const seguridad = Number((visitors * 0.35).toFixed(2)); // Refuerzo policía y protección civil
    const huellaCarbono = Number((visitors * 0.012 * 85.0).toFixed(2)); // 12 kg CO2 eq a 85 €/tonelada ETS
    const degradacionEspacio = Number((visitors * 0.20).toFixed(2)); // Amortización acelerada de mobiliario y pavimento
    const totalExternalities = Number((limpieza + seguridad + huellaCarbono + degradacionEspacio).toFixed(2));

    // Balance neto
    const netBenefit = Number((totalFiscal - totalExternalities).toFixed(2));
    const netMarginPct = totalFiscal > 0 ? Number(((netBenefit / totalFiscal) * 100).toFixed(1)) : 0;

    return {
      directVisitorSpendEuros: directSpend,
      averageSpendPerVisitorDayEuros: baseDailySpend,
      spendByCategoryEuros: spendByCategory,
      grossValueAddedEuros: totalVab,
      directVabEuros: directVab,
      indirectAndInducedVabEuros: indirectAndInducedVab,
      multiplierUsed: destinationMultiplier,
      equivalentJobsGenerated: equivalentJobs,
      fiscalReturnEuros: {
        tasaTuristicaMunicipal: tasaTuristica,
        impuestosComercialesLocales: impuestosComerciales,
        ivaProrrateadoEfectivo: ivaProrrateado,
        totalFiscalRevenueEuros: totalFiscal
      },
      externalitiesCostEuros: {
        refuerzoLimpiezaResiduos: limpieza,
        seguridadYMovilidadExtraordinaria: seguridad,
        huellaCarbonoEtsEuros: huellaCarbono,
        degradacionEspacioPublico: degradacionEspacio,
        totalExternalitiesCostEuros: totalExternalities
      },
      netSocioeconomicBenefitEuros: netBenefit,
      netBenefitMarginPct: netMarginPct
    };
  }

  /**
   * Ejecuta una simulación macroeconómica comparando situación BASE frente a un ESCENARIO
   */
  public static async executeMacroSimulation(
    tenantId: string,
    destinationId: string,
    scenarioTitle: string,
    visitorDeltaPct: number, // ej. +15% o -10%
    runId?: string
  ): Promise<MacroeconomicSimulationResult> {
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const runtime = resolution.runtime;
    const destName = runtime ? runtime.destination.nombre : destinationId;

    // Obtener calibración vigente si existe
    const activeCal = await CalibrationEngineService.getActiveCalibration(
      tenantId, 
      destinationId, 
      'mod_afluencia_peatonal_ejes'
    );

    // Visitantes base calculados del runtime o fallback calibrado
    const baseVisitors = runtime 
      ? runtime.zones.reduce((sum, z) => sum + (z.afluenciaActual || 1200), 0)
      : 12500;

    // Aplicar factor calibrado si existe
    const calFactor = activeCal 
      ? Object.values(activeCal.factorsByZone).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(activeCal.factorsByZone).length)
      : 1.0;

    const effectiveBaseVisitors = Math.round(baseVisitors * calFactor);
    const multiplier = destinationId === 'malaga' ? 1.45 : destinationId === 'palma' ? 1.48 : 1.38;
    const spendPerDay = destinationId === 'malaga' ? 152.0 : destinationId === 'palma' ? 168.0 : 135.0;

    const baseMetrics = this.calculateMetrics(effectiveBaseVisitors, multiplier, spendPerDay);

    const scenarioVisitors = Math.round(effectiveBaseVisitors * (1 + visitorDeltaPct / 100));
    const scenarioMetrics = this.calculateMetrics(scenarioVisitors, multiplier, spendPerDay);

    const delta = {
      spendDiffEuros: Number((scenarioMetrics.directVisitorSpendEuros - baseMetrics.directVisitorSpendEuros).toFixed(2)),
      spendDiffPct: Number((((scenarioMetrics.directVisitorSpendEuros - baseMetrics.directVisitorSpendEuros) / baseMetrics.directVisitorSpendEuros) * 100).toFixed(1)),
      vabDiffEuros: Number((scenarioMetrics.grossValueAddedEuros - baseMetrics.grossValueAddedEuros).toFixed(2)),
      jobsDiff: Number((scenarioMetrics.equivalentJobsGenerated - baseMetrics.equivalentJobsGenerated).toFixed(1)),
      fiscalRevenueDiffEuros: Number((scenarioMetrics.fiscalReturnEuros.totalFiscalRevenueEuros - baseMetrics.fiscalReturnEuros.totalFiscalRevenueEuros).toFixed(2)),
      externalitiesDiffEuros: Number((scenarioMetrics.externalitiesCostEuros.totalExternalitiesCostEuros - baseMetrics.externalitiesCostEuros.totalExternalitiesCostEuros).toFixed(2)),
      netBenefitDiffEuros: Number((scenarioMetrics.netSocioeconomicBenefitEuros - baseMetrics.netSocioeconomicBenefitEuros).toFixed(2))
    };

    const simId = `sim_macro_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      simId,
      tenantId,
      destinationId,
      scenarioTitle,
      effectiveBaseVisitors,
      scenarioVisitors,
      delta
    });
    const fingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const result: MacroeconomicSimulationResult = {
      id: simId,
      tenantId,
      destinationId,
      destinationName: destName,
      modelId: 'mod_impacto_macroeconomico_pid',
      runId,
      scenarioTitle,
      totalVisitorsModeled: scenarioVisitors,
      timestamp: now,
      metrics: {
        base: baseMetrics,
        scenario: scenarioMetrics,
        delta
      },
      uncertaintyType: activeCal ? 'CALIBRADA_EMPIRICA' : 'PARAMETRICA_SINTETICA',
      evidenceFingerprintSha256: fingerprint,
      methodologyDisclaimer: activeCal
        ? 'Estimación socioeconómica apoyada en calibración empírica vigente de aforos y matriz insumo-producto acotada.'
        : 'Estimación sintética paramétrica basada en multiplicadores estándar PID. Requiere calibración para validez oficial.'
    };

    await MacroPostgisExtension.saveMacroeconomicSimulation(result);
    return result;
  }
}
