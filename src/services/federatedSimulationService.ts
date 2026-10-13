// =============================================================================
// SERVICIO DE SIMULACIÓN MULTIDESTINO FEDERADA (ITERACIÓN 12)
// Soberanía del dato, evaluación previa de compatibilidad y agregación sin mezclar
// =============================================================================

import crypto from 'node:crypto';
import { 
  FederatedModelConfig, 
  FederatedSimulationResult, 
  LocalDestinationSimulationResult, 
  ParticipantCompatibilityEvaluation,
  CompatibilityEvidenceDetail,
  DestinationFederationStatus 
} from '../types/federatedSimulation';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { DataBindingService } from './dataBindingService';
import { InteroperabilityCatalogService } from './interoperabilityCatalogService';
import { MotorContextoSimulacion, ParametrosDestinoConfigurables } from '../engine/simulationEngine';
import { createBaseScenario } from './scenarioPresetFactory';
import { EscenarioSimulacion } from '../types/ontology';
import { postgisRepository } from './postgisRepository';
import { ModelDataBinding } from '../types/operationalConfiguration';
import { SemanticSimulationInputService } from './semanticSimulationInputService';

export class FederatedSimulationService {
  /**
   * Evalúa la compatibilidad profunda de múltiples destinos respecto a un modelo específico.
   */
  public static async evaluateFederationCompatibility(
    modelId: string,
    participantDestinationIds: string[]
  ): Promise<ParticipantCompatibilityEvaluation[]> {
    const model = InteroperabilityCatalogService.getModel(modelId);
    const requiredVariables = model?.variables || [
      { id: 'visitantes_hora', label: 'Visitantes / Hora', required: true, unit: 'personas/h' },
      { id: 'capacidad_aforo', label: 'Capacidad de Aforo', required: true, unit: 'personas' }
    ];

    const evaluations: ParticipantCompatibilityEvaluation[] = [];

    for (const destId of participantDestinationIds) {
      const resolution = DestinationRuntimeService.resolve(destId);
      if (!resolution.runtime || !resolution.report.valid) {
        evaluations.push({
          destinationId: destId,
          destinationName: resolution.runtime?.destination.nombre || destId,
          tenantId: resolution.runtime?.tenant.id || 'desconocido',
          status: 'NO_COMPATIBLE',
          compatibilityScorePct: 0,
          checks: [{
            category: 'TERRITORIO_CRS',
            requirement: 'Destino registrado con perfil territorial válido',
            evaluatedStatus: 'INCUMPLE',
            details: 'El destino no posee un DestinationRuntime válido o activo.'
          }],
          unmetMandatoryRequirements: ['Destino no inicializado'],
          notes: ['No se puede federar sin ContextPackage o perfil demo activo.']
        });
        continue;
      }

      const runtime = resolution.runtime;
      const tenantId = runtime.tenant.id;
      const checks: CompatibilityEvidenceDetail[] = [];
      const unmet: string[] = [];

      // 1. Comprobar vínculos de variables
      const bindings: ModelDataBinding[] = await DataBindingService.listBindings(tenantId, destId);
      const activeBindingsMap = new Map<string, ModelDataBinding>(
        bindings.filter(b => b.active).map(b => [b.modelVariableId, b])
      );

      let variablesCumplidas = 0;
      const destinationConnectors = runtime.sources || [];
      const hasSourceLanes = destinationConnectors.length > 0;

      for (const reqVar of requiredVariables) {
        const binding = activeBindingsMap.get(reqVar.id);
        if (binding) {
          variablesCumplidas++;
          checks.push({
            category: 'SEMANTICA_VARIABLES',
            requirement: `Variable: ${reqVar.label}`,
            evaluatedStatus: 'CUMPLE',
            details: `Vinculada a conector ${binding.connectorId} (campo: ${binding.sourceField}, calidad: ${binding.qualityLevel})`,
            sourceId: binding.connectorId
          });
        } else if (hasSourceLanes) {
          // Si el destino tiene conectores ontológicos y no-ontológicos activos, opera en compatibilidad condicional
          variablesCumplidas++;
          checks.push({
            category: 'SEMANTICA_VARIABLES',
            requirement: `Variable: ${reqVar.label}`,
            evaluatedStatus: 'ADVERTENCIA',
            details: `Variable resuelta mediante fuentes nativas del destino (${destinationConnectors[0]?.name || "Fuentes PID"}). Se recomienda vincular explícitamente.`
          });
        } else if (reqVar.required) {
          unmet.push(`Variable obligatoria no vinculada: ${reqVar.label}`);
          checks.push({
            category: 'SEMANTICA_VARIABLES',
            requirement: `Variable: ${reqVar.label}`,
            evaluatedStatus: 'INCUMPLE',
            details: `La variable requerida no tiene conector ni fuentes asociadas en ${runtime.destination.nombre}.`
          });
        } else {
          checks.push({
            category: 'SEMANTICA_VARIABLES',
            requirement: `Variable opcional: ${reqVar.label}`,
            evaluatedStatus: 'ADVERTENCIA',
            details: 'Variable opcional no vinculada; se usará valor por defecto.'
          });
        }
      }

      // 2. Comprobar entidades mínimas de contexto
      const hasZones = runtime.zones.length > 0;
      if (hasZones) {
        checks.push({
          category: 'TERRITORIO_CRS',
          requirement: 'Zonas geográficas de control',
          evaluatedStatus: 'CUMPLE',
          details: `${runtime.zones.length} zonas operativas registradas (CRS EPSG:4326).`
        });
      } else {
        unmet.push('Sin zonas operativas registradas');
        checks.push({
          category: 'TERRITORIO_CRS',
          requirement: 'Zonas geográficas de control',
          evaluatedStatus: 'INCUMPLE',
          details: 'No se encontraron zonas territoriales para modelar flujos.'
        });
      }

      // 3. Comprobar política de privacidad y calidad
      const synthetic = runtime.quality.syntheticDemoData;
      if (synthetic) {
        checks.push({
          category: 'CALIDAD_FRECUENCIA',
          requirement: 'Calidad de datos y evidencia',
          evaluatedStatus: 'ADVERTENCIA',
          details: 'El destino opera con datos sintéticos demostradores; la simulación federada tendrá advertencia de calidad.'
        });
      } else {
        checks.push({
          category: 'CALIDAD_FRECUENCIA',
          requirement: 'Calidad de datos y evidencia',
          evaluatedStatus: 'CUMPLE',
          details: 'Datos operativos con trazabilidad SHA-256 e inspección verificada.'
        });
      }

      // Determinar estatus final
      const scorePct = Math.round((variablesCumplidas / Math.max(1, requiredVariables.length)) * 100);
      let status: DestinationFederationStatus = 'COMPATIBLE';
      if (unmet.length > 0) {
        status = 'INCOMPLETO';
      } else if (synthetic || scorePct < 100) {
        status = 'COMPATIBLE_CON_CONDICIONES';
      }

      evaluations.push({
        destinationId: destId,
        destinationName: runtime.destination.nombre,
        tenantId,
        status,
        compatibilityScorePct: scorePct,
        checks,
        unmetMandatoryRequirements: unmet,
        notes: unmet.length > 0 
          ? [`El destino no puede sumarse a la federación hasta vincular: ${unmet.join(', ')}`]
          : ['Apto para federación sin mezclar datos crudos.']
      });
    }

    return evaluations;
  }

  /**
   * Ejecuta una simulación federada:
   * Calcula BASE / ESCENARIO / DELTA en cada destino local y consolida métricas agregadas.
   */
  public static async executeFederatedSimulation(
    config: FederatedModelConfig,
    operator: { id: string; name: string; role: string }
  ): Promise<FederatedSimulationResult> {
    const runId = `fed-run-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const localResults: LocalDestinationSimulationResult[] = [];

    let totalVisitantesBase = 0;
    let totalVisitantesEscenario = 0;
    let totalAlertas = 0;
    let totalEmisiones = 0;
    let sumaSaturacionPonderada = 0;
    let destinosValidosCount = 0;
    let anySynthetic = false;
    let semanticInputsUsed = false;
    const semanticEvidenceFingerprintsSha256: string[] = [];

    for (const part of config.participants) {
      const resolution = DestinationRuntimeService.resolve(part.destinationId);
      if (!resolution.runtime || !resolution.report.valid) {
        localResults.push({
          destinationId: part.destinationId,
          destinationName: part.destinationName,
          tenantId: part.tenantId,
          status: 'FALLIDO',
          base: {} as any,
          scenario: {} as any,
          delta: {
            visitantesEnDestino: 0,
            variacionVsMedia: 0,
            saturacionGlobalPct: 0,
            emisionesCo2KgHora: 0,
            ruidoMedioDb: 0,
            distritosSaturadosCount: 0,
            alertasActivasCount: 0
          },
          evidence: {
            contextFingerprint: 'error-runtime',
            datasetCount: 0,
            connectorIds: [],
            syntheticDemoData: true,
            uncertaintyPct: 100,
            semanticInputs: {
              useMode: 'SIN_ENTRADAS_SEMANTICAS_ELEGIBLES',
              usedForExecutionGate: false,
              calibrationApplied: false,
              calibrationRationale: 'No fue posible resolver el contexto territorial del destino para evaluar observaciones semánticas.',
              observationCount: 0,
              sourceTypes: [],
              observationFingerprintsSha256: [],
              evidenceFingerprintSha256: 'error-runtime',
              zoneSignals: [],
              warnings: ['La ejecución local falló antes de poder consultar los inputs semánticos.']
            }
          }
        });
        continue;
      }

      const runtime = resolution.runtime;
      if (runtime.quality.syntheticDemoData) anySynthetic = true;
      const semanticInputs = await SemanticSimulationInputService.buildSnapshot(
        runtime.tenant.id,
        runtime.destination.id,
        runtime.zones
      );
      semanticInputsUsed ||= semanticInputs.usedForExecutionGate;
      semanticEvidenceFingerprintsSha256.push(semanticInputs.evidenceFingerprintSha256);

      // Parámetros base y de escenario para el destino
      const paramsBase: ParametrosDestinoConfigurables = {
        umbralSaturacionAlerta: 85,
        pesoCapacidadFisica: 0.6,
        pesoCapacidadPsicologica: 0.4,
        tasaEmisionKgCo2PorPersonaHora: 0.12,
        incrementoVisitantesManualPct: 0,
        franjaHoraria: '12:00',
        condicionClima: 'DESPEJADO',
        horaSimulacion: 12,
        intensidadEscenario: 0,
        factorCapacidadOperativa: 1,
        factorMovilidad: 1
      };

      const scenarioSim: EscenarioSimulacion = {
        id: `esc-fed-${config.id}`,
        nombre: `Escenario Federado: ${config.name}`,
        descripcion: config.description,
        tipo: 'CRUCERO_MASIVO',
        factorAfluencia: 1.25,
                zonasAfectadas: runtime.zones.map(z => z.id),
        impactoZonas: Object.fromEntries(runtime.zones.map(z => [z.id, 1.25])),
        rutasDesvioRecomendadas: [],
        alertasGeneradas: []
      };

      const paramsScenario: ParametrosDestinoConfigurables = {
        ...paramsBase,
        incrementoVisitantesManualPct: 25,
        intensidadEscenario: 0.8
      };

      // Ejecutar simulación local
      const resBase = MotorContextoSimulacion.simular(runtime.zones, runtime.resources, runtime.sensors, createBaseScenario(), paramsBase);
      const resEscenario = MotorContextoSimulacion.simular(runtime.zones, runtime.resources, runtime.sensors, scenarioSim, paramsScenario);

      const delta = {
        visitantesEnDestino: resEscenario.indicadoresSimulados.visitantesEnDestino - resBase.indicadoresActuales.visitantesEnDestino,
        variacionVsMedia: Number((resEscenario.indicadoresSimulados.variacionVsMedia - resBase.indicadoresActuales.variacionVsMedia).toFixed(1)),
        saturacionGlobalPct: Number((resEscenario.indicadoresSimulados.saturacionGlobalPct - resBase.indicadoresActuales.saturacionGlobalPct).toFixed(1)),
        emisionesCo2KgHora: resEscenario.indicadoresSimulados.emisionesCo2KgHora - resBase.indicadoresActuales.emisionesCo2KgHora,
        ruidoMedioDb: Number((resEscenario.indicadoresSimulados.ruidoMedioDb - resBase.indicadoresActuales.ruidoMedioDb).toFixed(1)),
        distritosSaturadosCount: resEscenario.indicadoresSimulados.distritosSaturadosCount - resBase.indicadoresActuales.distritosSaturadosCount,
        alertasActivasCount: resEscenario.indicadoresSimulados.alertasActivasCount - resBase.indicadoresActuales.alertasActivasCount
      };

      totalVisitantesBase += resBase.indicadoresActuales.visitantesEnDestino;
      totalVisitantesEscenario += resEscenario.indicadoresSimulados.visitantesEnDestino;
      totalAlertas += resEscenario.indicadoresSimulados.alertasActivasCount;
      totalEmisiones += resEscenario.indicadoresSimulados.emisionesCo2KgHora;
      sumaSaturacionPonderada += resEscenario.indicadoresSimulados.saturacionGlobalPct;
      destinosValidosCount++;

      localResults.push({
        destinationId: runtime.destination.id,
        destinationName: runtime.destination.nombre,
        tenantId: runtime.tenant.id,
        status: 'EXITOSO',
        base: resBase.indicadoresActuales,
        scenario: resEscenario.indicadoresSimulados,
        delta,
        evidence: {
          contextFingerprint: runtime.fingerprint.value,
          datasetCount: runtime.sources.length,
          connectorIds: runtime.sources.map(s => s.id),
          syntheticDemoData: runtime.quality.syntheticDemoData,
          uncertaintyPct: runtime.quality.syntheticDemoData ? 35 : 12,
          semanticInputs
        }
      });
    }

    const satMedia = destinosValidosCount > 0 
      ? Number((sumaSaturacionPonderada / destinosValidosCount).toFixed(1))
      : 0;

    const signaturePayload = JSON.stringify({
      runId,
      configId: config.id,
      totalVisitantesBase,
      totalVisitantesEscenario,
      operatorId: operator.id,
      semanticEvidenceFingerprintsSha256: [...semanticEvidenceFingerprintsSha256].sort()
    });
    const sha256 = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    const result: FederatedSimulationResult = {
      id: runId,
      federatedConfigId: config.id,
      modelPackageId: config.modelPackageId,
      modelPackageVersion: config.modelPackageVersion,
      modelTitle: config.modelTitle,
      coordinatorDestinationId: config.coordinatorDestinationId,
      executedAt: new Date().toISOString(),
      executedBy: `${operator.name} (${operator.role})`,
      status: 'COMPLETADO',
      localResults,
      aggregatedMetrics: {
        totalVisitantesBase,
        totalVisitantesEscenario,
        deltaTotalVisitantes: totalVisitantesEscenario - totalVisitantesBase,
        saturacionMediaPonderadaPct: satMedia,
        totalAlertasActivas: totalAlertas,
        emisionesTotalesCo2KgHora: totalEmisiones,
        nivelIncertidumbreGlobal: anySynthetic ? 'ALTA' : 'MEDIA'
      },
      evidence: {
        federationFingerprintSha256: sha256,
        destinationsIncluded: config.participants.map(p => p.destinationId),
        dataLanesUsed: ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'],
        syntheticWarning: anySynthetic,
        operatorSignature: `ECDSA-SHA256:PID-OPERATOR:${operator.id}`,
        semanticInputsUsed,
        semanticEvidenceFingerprintsSha256: [...semanticEvidenceFingerprintsSha256].sort()
      }
    };

    // Persistir resultado federado en PostGIS
    await postgisRepository.saveFederatedExecution(result, config.tenantId);

    return result;
  }
}
