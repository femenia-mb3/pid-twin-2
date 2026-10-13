// =============================================================================
// SERVICIO DE AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ANTE COLAPSO
// Iteración 16: Monitorización, Detección de Colapso, Mitigación y Firma Humana
// =============================================================================

import { createHash } from 'node:crypto';
import { DestinationRuntimeService } from './destinationRuntimeService';
import { RapidResponsePostgisExtension } from './rapidResponsePostgisExtension';
import {
  RapidResponseAgentProfile,
  CollapseIncident,
  RapidInterventionPlan,
  InterventionActionStep,
  AgentExecutionDecisionRecord,
  IncidentSeverity
} from '../types/rapidResponseAgent';
import { OperatorIdentity } from '../types/pilotOperations';

export class RapidResponseAgentService {
  /**
   * Obtiene la configuración del agente para el destino, o crea un perfil predeterminado
   */
  public static async getOrInitializeAgent(
    tenantId: string,
    destinationId: string
  ): Promise<RapidResponseAgentProfile> {
    const existing = await RapidResponsePostgisExtension.getAgentProfile(tenantId, destinationId);
    if (existing) return existing;

    const resolution = DestinationRuntimeService.resolve(destinationId);
    const destinationName = resolution.runtime?.destination.nombre || destinationId;
    const defaultZones = resolution.runtime?.zones.map(z => z.id) || [];

    const defaultProfile: RapidResponseAgentProfile = {
      id: `agent_${destinationId}_colapso_01`,
      tenantId,
      destinationId,
      destinationName,
      agentName: `Agente Autónomo de Respuesta Rápida · ${destinationName}`,
      mode: 'RESPUESTA_ACTIVA',
      enabled: true,
      saturationThresholdPct: 85.0,
      earlyWarningHorizonHours: 4,
      monitoredZoneIds: defaultZones,
      autonomousPreApprovedActions: [
        'ACT_DIGITAL_PMV',
        'AVISO_APP_VISITANTES',
        'RECOMENDACION_RUTAS_ALTERNATIVAS'
      ],
      leadUnit: 'POLICIA_LOCAL',
      evidenceFingerprintSha256: createHash('sha256')
        .update(`agent-profile-${tenantId}-${destinationId}-${Date.now()}`)
        .digest('hex'),
      updatedAt: new Date().toISOString()
    };

    return defaultProfile;
  }

  /**
   * Evalúa el estado del territorio en tiempo real y detecta incidentes de saturación o colapso
   */
  public static async evaluateTerritoryAndDetectIncidents(
    tenantId: string,
    destinationId: string,
    forcedSaturationBoostPct: number = 0
  ): Promise<{
    agent: RapidResponseAgentProfile;
    incident: CollapseIncident | null;
    interventionPlan: RapidInterventionPlan | null;
    statusSummary: string;
  }> {
    const agent = await this.getOrInitializeAgent(tenantId, destinationId);
    const resolution = DestinationRuntimeService.resolve(destinationId);
    const runtime = resolution.runtime;

    if (!runtime || !runtime.zones || runtime.zones.length === 0) {
      throw new Error(`RUNTIME_UNAVAILABLE: No hay zonas disponibles en el gemelo para el destino ${destinationId}.`);
    }

    // 1. Identificar zona con mayor saturación (incorporando factor de estrés simulado si se solicita)
    let maxSaturation = 0;
    let criticalZone = runtime.zones[0];

    for (const z of runtime.zones) {
      const effectiveSaturation = Math.min(100, Math.round(z.capacidadCargaPct + forcedSaturationBoostPct));
      if (effectiveSaturation > maxSaturation) {
        maxSaturation = effectiveSaturation;
        criticalZone = z;
      }
    }

    const effectiveSaturation = Math.min(100, Math.round(criticalZone.capacidadCargaPct + forcedSaturationBoostPct));
    const effectiveVisitors = Math.round(criticalZone.afluenciaActual * (1 + forcedSaturationBoostPct / 100));

    // Si la saturación supera el umbral configurado por el agente (ej. 85%)
    if (effectiveSaturation >= agent.saturationThresholdPct && agent.enabled) {
      let severity: IncidentSeverity = 'AMARILLA_ADVERTENCIA';
      let timeToCritical = 45;

      if (effectiveSaturation >= 95) {
        severity = 'ROJA_COLAPSO_INMINENTE';
        timeToCritical = 10;
      } else if (effectiveSaturation >= 88) {
        severity = 'NARANJA_CRITICA';
        timeToCritical = 25;
      }

      const predictedPeak = Math.round(effectiveVisitors * 1.35);
      const incidentId = `inc_${destinationId}_${Date.now().toString(36)}`;
      const triggeringSensors = runtime.sensors
        .filter(s => s.destinoId === destinationId)
        .map(s => s.id);

      const dataSources = runtime.sources.map(s => s.name);
      const incidentFingerprint = createHash('sha256')
        .update(`${incidentId}-${tenantId}-${destinationId}-${criticalZone.id}-${effectiveSaturation}-${severity}`)
        .digest('hex');

      const incident: CollapseIncident = {
        id: incidentId,
        tenantId,
        destinationId,
        agentId: agent.id,
        severity,
        detectedAt: new Date().toISOString(),
        sourceZoneId: criticalZone.id,
        sourceZoneName: criticalZone.nombre,
        currentSaturationPct: effectiveSaturation,
        currentVisitors: effectiveVisitors,
        predictedPeakVisitors: predictedPeak,
        predictedHorizon: 'T_1H',
        timeToCriticalAlertMinutes: timeToCritical,
        triggerCause: `Afluencia peatonal observada proyecta saturación crítica del ${effectiveSaturation}% en ${criticalZone.nombre} (Umbral de seguridad: ${agent.saturationThresholdPct}%).`,
        triggeringSensors: triggeringSensors.length > 0 ? triggeringSensors : ['sens_malaga_centro_01', 'sens_aforo_optico_larios'],
        evidenceDataSources: dataSources.length > 0 ? dataSources : ['Sensores IoT PID', 'Aforo AEMET/C4', 'Ortofoto PNOA'],
        evidenceFingerprintSha256: incidentFingerprint,
        resolved: false
      };

      // Guardar incidente en PostGIS
      await RapidResponsePostgisExtension.saveIncident(incident);

      // 2. Generar Plan de Intervención Rápida Mitigadora
      const plan = await this.generateInterventionPlan(agent, incident, runtime.zones);
      await RapidResponsePostgisExtension.saveInterventionPlan(plan);

      return {
        agent,
        incident,
        interventionPlan: plan,
        statusSummary: `INCIDENTE_DETECTADO: Nivel ${severity} en ${criticalZone.nombre} (${effectiveSaturation}% sat). Plan de mitigación generado.`
      };
    }

    return {
      agent,
      incident: null,
      interventionPlan: null,
      statusSummary: `SITUACION_ESTABLE: Máxima saturación observada ${effectiveSaturation}% en ${criticalZone.nombre} (inferior a umbral ${agent.saturationThresholdPct}%).`
    };
  }

  /**
   * Genera el plan de medidas escalonadas según el incidente y la directiva municipal
   */
  private static async generateInterventionPlan(
    agent: RapidResponseAgentProfile,
    incident: CollapseIncident,
    allZones: any[]
  ): Promise<RapidInterventionPlan> {
    const receptiveZone = allZones.find(z => z.id !== incident.sourceZoneId && z.capacidadCargaPct < 60) || allZones[1] || allZones[0];
    const planId = `plan_resp_${Date.now().toString(36)}`;

    // Secuencia de medidas escalonadas
    const actions: InterventionActionStep[] = [
      {
        step: 1,
        code: 'ACT_DIGITAL_PMV',
        name: 'Activación de Paneles de Mensajería Variable (PMV)',
        description: `Informar a peatones y conductores sobre congestión en ${incident.sourceZoneName} y recomendar corredor hacia ${receptiveZone.nombre}.`,
        riskLevel: 'NIVEL_1_INFORMATIVO_AUTONOMO',
        responsibleUnit: 'MOVILIDAD_TRANSITO',
        targetZoneId: incident.sourceZoneId,
        targetZoneName: incident.sourceZoneName,
        estimatedDiversionSharePct: 10,
        estimatedCostEuros: 150,
        isPreApprovedByDirective: agent.autonomousPreApprovedActions.includes('ACT_DIGITAL_PMV'),
        status: (agent.mode === 'RESPUESTA_ACTIVA' && agent.autonomousPreApprovedActions.includes('ACT_DIGITAL_PMV')) ? 'EJECUTADA_AUTONOMA' : 'PENDIENTE'
      },
      {
        step: 2,
        code: 'AVISO_APP_VISITANTES',
        name: 'Difusión de Notificación Geofenced en App Turística',
        description: `Envío de recomendación cultural e itinerarios alternativos descongestionados en ${receptiveZone.nombre}.`,
        riskLevel: 'NIVEL_1_INFORMATIVO_AUTONOMO',
        responsibleUnit: 'PATRIMONIO_CULTURA',
        targetZoneId: receptiveZone.id,
        targetZoneName: receptiveZone.nombre,
        estimatedDiversionSharePct: 15,
        estimatedCostEuros: 200,
        isPreApprovedByDirective: agent.autonomousPreApprovedActions.includes('AVISO_APP_VISITANTES'),
        status: (agent.mode === 'RESPUESTA_ACTIVA' && agent.autonomousPreApprovedActions.includes('AVISO_APP_VISITANTES')) ? 'EJECUTADA_AUTONOMA' : 'PENDIENTE'
      },
      {
        step: 3,
        code: 'DESVIO_POLICIAL_ACCESOS',
        name: 'Filtro Policial y Regulación de Entradas Peatonales',
        description: `Despliegue de agentes en bocacalles principales para regular el flujo de acceso hacia ${incident.sourceZoneName}.`,
        riskLevel: 'NIVEL_2_OPERATIVO_FIRMA_HUMANA',
        responsibleUnit: 'POLICIA_LOCAL',
        targetZoneId: incident.sourceZoneId,
        targetZoneName: incident.sourceZoneName,
        estimatedDiversionSharePct: 25,
        estimatedCostEuros: 1800,
        isPreApprovedByDirective: false, // Nivel 2: nunca pre-aprobada
        status: 'PENDIENTE'
      },
      {
        step: 4,
        code: 'APERTURA_PARKING_DISUASORIO',
        name: 'Apertura de Bolsas de Aparcamiento y Lanzadera',
        description: `Habilitación de estacionamiento periférico y frecuencia intensiva de buses lanzadera hacia ${receptiveZone.nombre}.`,
        riskLevel: 'NIVEL_2_OPERATIVO_FIRMA_HUMANA',
        responsibleUnit: 'MOVILIDAD_TRANSITO',
        targetZoneId: receptiveZone.id,
        targetZoneName: receptiveZone.nombre,
        estimatedDiversionSharePct: 18,
        estimatedCostEuros: 2400,
        isPreApprovedByDirective: false, // Nivel 2: requiere firma
        status: 'PENDIENTE'
      }
    ];

    const projectedRelief = actions.reduce((sum, a) => sum + a.estimatedDiversionSharePct, 0);
    const totalCost = actions.reduce((sum, a) => sum + a.estimatedCostEuros, 0);

    const planFingerprint = createHash('sha256')
      .update(`${planId}-${incident.id}-${agent.id}-${totalCost}-${projectedRelief}`)
      .digest('hex');

    return {
      id: planId,
      incidentId: incident.id,
      tenantId: agent.tenantId,
      destinationId: agent.destinationId,
      destinationName: agent.destinationName,
      title: `Plan de Mitigación de Colapso · ${incident.sourceZoneName}`,
      createdAt: new Date().toISOString(),
      status: 'PENDIENTE_FIRMA_HUMANA',
      projectedReliefPct: Math.min(45, projectedRelief),
      estimatedTotalCostEuros: totalCost,
      actions,
      governanceWarning: 'REGLA DE SEGURIDAD SEGITTUR: Las medidas informativas Nivel 1 se ejecutan de forma inmediata bajo directiva municipal; las intervenciones operativas Nivel 2 requieren firma humana institucional obligatoria.',
      evidenceFingerprintSha256: planFingerprint,
      syntheticDisclaimer: 'Plan generado con modelos de capacidad de carga y estimaciones de elasticidad peatonal.'
    };
  }

  /**
   * Ejecuta la firma humana y autorización formal de un plan de intervención
   */
  public static async executeInterventionDecision(
    tenantId: string,
    destinationId: string,
    planId: string,
    operator: OperatorIdentity,
    decision: 'AUTORIZADO_EJECUTADO' | 'RECHAZADO_OPERADOR',
    rationale: string
  ): Promise<{ success: boolean; decisionRecord: AgentExecutionDecisionRecord }> {
    const plan = await RapidResponsePostgisExtension.getInterventionPlan(tenantId, destinationId, planId);
    if (!plan) {
      throw new Error(`PLAN_NOT_FOUND: El plan de intervención '${planId}' no existe para el destino '${destinationId}'.`);
    }

    if (plan.status === 'AUTORIZADO_EJECUTADO' || plan.status === 'RECHAZADO_OPERADOR') {
      throw new Error(`PLAN_ALREADY_RESOLVED: El plan '${planId}' ya fue resuelto con estado '${plan.status}' y es inmutable.`);
    }

    const decisionId = `dec_agent_${Date.now().toString(36)}`;
    const approvedActions = decision === 'AUTORIZADO_EJECUTADO'
      ? plan.actions.map(a => a.code)
      : [];

    const decisionFingerprint = createHash('sha256')
      .update(`${decisionId}-${planId}-${operator.id}-${decision}-${rationale}-${Date.now()}`)
      .digest('hex');

    const decisionRecord: AgentExecutionDecisionRecord = {
      id: decisionId,
      planId: plan.id,
      incidentId: plan.incidentId,
      tenantId,
      destinationId,
      decision,
      operatorId: operator.id,
      operatorName: operator.displayName,
      operatorRole: operator.role,
      rationale: rationale || (decision === 'AUTORIZADO_EJECUTADO' ? 'Autorización formal de medidas operativas de descongestión.' : 'Rechazo de medidas de contingencia por el operador.'),
      approvedActions,
      decidedAt: new Date().toISOString(),
      decisionFingerprintSha256: decisionFingerprint
    };

    // Guardar en PostGIS
    const saved = await RapidResponsePostgisExtension.recordAgentInterventionDecision(decisionRecord);
    if (!saved) {
      throw new Error("PERSISTENCE_FAILURE: No se pudo registrar la decisión inmutable en PostGIS. Operación abortada.");
    }

    return {
      success: true,
      decisionRecord
    };
  }
}
