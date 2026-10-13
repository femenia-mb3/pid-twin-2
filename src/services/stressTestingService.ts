// =============================================================================
// SERVICIO DE PRUEBAS DE ESTRÉS TERRITORIAL (ITERACIÓN 15)
// Simulación de shocks de afluencia masiva sobre horizontes T+1, T+4 y T+24
// =============================================================================

import crypto from 'node:crypto';
import { 
  StressTestExecutionResult, 
  StressHorizonOutcome 
} from '../types/macroOptimizationStress';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { MacroPostgisExtension } from './macroPostgisExtension';

export class StressTestingService {
  /**
   * Ejecuta una prueba de estrés multiescala sobre los horizontes T+1, T+4 y T+24
   */
  public static async executeStressTest(
    tenantId: string,
    destinationId: string,
    profile: 'PICO_MASIVO_MODERADO' | 'PICO_SEVERO_INMINENTE' | 'COLAPSO_EVENTO_EXTRAORDINARIO' = 'PICO_SEVERO_INMINENTE'
  ): Promise<StressTestExecutionResult> {
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const runtime = resolution.runtime;
    const destName = runtime ? runtime.destination.nombre : destinationId;
    const zones = runtime ? runtime.zones : [];

    // Definición de multiplicadores de shock por perfil
    const shockConfig = {
      PICO_MASIVO_MODERADO: { 'T+1': 25, 'T+4': 40, 'T+24': 30 },
      PICO_SEVERO_INMINENTE: { 'T+1': 45, 'T+4': 75, 'T+24': 60 },
      COLAPSO_EVENTO_EXTRAORDINARIO: { 'T+1': 70, 'T+4': 110, 'T+24': 95 }
    }[profile];

    const evaluateHorizon = (
      horizon: 'T+1' | 'T+4' | 'T+24',
      hours: number,
      shockPct: number
    ): StressHorizonOutcome => {
      const baseTotal = zones.reduce((s, z) => s + (z.afluenciaActual || 1200), 0);
      const stressedTotal = Math.round(baseTotal * (1 + shockPct / 100));

      let saturatedCount = 0;
      let totalCapacity = 0;
      let totalStressedVisitors = 0;

      const criticalList = zones.map(z => {
        const cap = z.aforoMaximo || 3000;
        const afl = z.afluenciaActual || 1200;
        const stressedAfl = Math.round(afl * (1 + shockPct / 100));
        const sat = Number(((stressedAfl / cap) * 100).toFixed(1));
        const isOver = sat >= 100;

        totalCapacity += cap;
        totalStressedVisitors += stressedAfl;

        if (sat >= 85) saturatedCount++;

        return {
          zoneId: z.id,
          zoneName: z.nombre,
          saturationPct: sat,
          capacityLimit: cap,
          isOverflown: isOver
        };
      });

      const avgSat = totalCapacity > 0 ? Number(((totalStressedVisitors / totalCapacity) * 100).toFixed(1)) : 80;
      
      // Score de resiliencia: 100 menos penalización por saturación y desbordamientos
      const penalty = (saturatedCount * 12) + (avgSat > 100 ? 30 : avgSat > 85 ? 15 : 0);
      const resilienceScore = Math.max(10, Math.min(100, Math.round(100 - penalty)));

      // Tiempo estimado hasta que la primera zona alcance el 85% crítico
      const timeToAlert = avgSat >= 100 ? 15 : avgSat >= 85 ? 45 : hours * 60;

      // Sobrecoste en externalidades inducido por el pico
      const extraVisitors = stressedTotal - baseTotal;
      const externalitiesShock = Number((extraVisitors * 2.85).toFixed(2)); // Sobrecoste operativo de emergencia

      const recommendations: string[] = [];
      if (saturatedCount > 0) {
        recommendations.push(`Activar protocolo de prealerta en ${saturatedCount} zona(s) que superan el 85% de aforo.`);
      }
      if (avgSat > 100) {
        recommendations.push('Desplegar cortes perimetrales temporales y desvío de transporte público hacia aparcamientos disuasorios.');
      } else {
        recommendations.push('Reforzar frecuencias de metro/autobús y emitir recomendaciones de visita diferida en canales oficiales.');
      }

      return {
        horizon,
        horizonHours: hours,
        shockFactorPct: shockPct,
        baselineVisitors: baseTotal,
        stressedVisitors: stressedTotal,
        averageSaturationPct: avgSat,
        saturatedZonesCount: saturatedCount,
        criticalZonesList: criticalList,
        resilienceScorePct: resilienceScore,
        timeToCriticalAlertMinutes: timeToAlert,
        externalitiesShockEuros: externalitiesShock,
        recommendations
      };
    };

    const h1 = evaluateHorizon('T+1', 1, shockConfig['T+1']);
    const h4 = evaluateHorizon('T+4', 4, shockConfig['T+4']);
    const h24 = evaluateHorizon('T+24', 24, shockConfig['T+24']);

    // Veredicto global
    const minScore = Math.min(h1.resilienceScorePct, h4.resilienceScorePct, h24.resilienceScorePct);
    const globalVerdict: 'RESILIENTE_CON_HOLGURA' | 'VULNERABILIDAD_MODERADA' | 'RIESGO_COLAPSO_INMINENTE' = 
      minScore >= 75 ? 'RESILIENTE_CON_HOLGURA' : minScore >= 45 ? 'VULNERABILIDAD_MODERADA' : 'RIESGO_COLAPSO_INMINENTE';

    const testId = `stress_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const signaturePayload = JSON.stringify({
      testId,
      tenantId,
      destinationId,
      profile,
      globalVerdict,
      scores: [h1.resilienceScorePct, h4.resilienceScorePct, h24.resilienceScorePct]
    });
    const fingerprint = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const result: StressTestExecutionResult = {
      id: testId,
      tenantId,
      destinationId,
      destinationName: destName,
      executedAt: now,
      stressProfileName: profile,
      horizons: {
        'T+1': h1,
        'T+4': h4,
        'T+24': h24
      },
      globalResilienceVerdict: globalVerdict,
      evidenceFingerprintSha256: fingerprint,
      disclaimer: 'PRUEBA DE ESTRÉS TERRITORIAL: Simulación determinista de sobrecarga extrema para calibrar la resiliencia de la infraestructura turística. No constituye una predicción meteorológica ni estadística regular.'
    };

    await MacroPostgisExtension.saveStressTestExecution(result);
    return result;
  }
}
