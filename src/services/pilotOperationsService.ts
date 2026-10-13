import { postgisRepository } from './postgisRepository';
import { 
  OperatorIdentity, 
  AiProposalAuditRecord, 
  OperationalProtocol, 
  ForecastCalibrationRecord, 
  AiAuditDecision 
} from '../types/pilotOperations';
import { AiSimulationProposal } from '../types/aiAgent';

// Operadores en memoria como fallback de demostración
const DEMO_OPERATORS: OperatorIdentity[] = [
  {
    id: 'op_malaga_01',
    username: 'gestor_malaga',
    displayName: 'Carlos Domínguez (Gestor Turismo Málaga)',
    email: 'carlos.dominguez@malaga.es',
    tenantId: 'tenant_ayto_malaga',
    tenantName: 'Ayuntamiento de Málaga',
    role: 'GESTOR_TURISMO',
    authorizedDestinations: ['malaga'],
  },
  {
    id: 'op_palma_01',
    username: 'gestor_palma',
    displayName: 'Catalina Ribas (Movilidad Palma)',
    email: 'catalina.ribas@palma.es',
    tenantId: 'tenant_ayto_palma',
    tenantName: 'Ajuntament de Palma',
    role: 'SUPERVISOR_MOVILIDAD',
    authorizedDestinations: ['palma'],
  },
  {
    id: 'op_segittur_01',
    username: 'admin_pid',
    displayName: 'Dirección Técnica SEGITTUR (Supervisión PID)',
    email: 'gemelo.digital@segittur.es',
    tenantId: 'tenant_ayto_malaga',
    tenantName: 'SEGITTUR - Plataforma Inteligente de Destinos',
    role: 'ADMIN_SEGITTUR',
    authorizedDestinations: ['malaga', 'palma'],
  }
];

class PilotOperationsManager {
  private currentOperator: OperatorIdentity = DEMO_OPERATORS[0];
  private inMemoryAudits: AiProposalAuditRecord[] = [];
  private inMemoryProtocols: OperationalProtocol[] = [];
  private inMemoryCalibrations: ForecastCalibrationRecord[] = [];

  constructor() {
    this.seedInitialProtocols();
    this.seedInitialCalibrations();
  }

  private seedInitialProtocols() {
    this.inMemoryProtocols.push(
      {
        id: 'proto-mlg-01',
        tenantId: 'tenant_ayto_malaga',
        destinationId: 'malaga',
        name: 'Protocolo de Alta Concentración en Centro Histórico',
        description: 'Activación de control de aforos peatonales y desvíos recomendados ante saturación >= 85%.',
        triggerType: 'SATURACION_ZONA',
        triggerThresholdPct: 85,
        targetZoneIds: ['malaga_centro'],
        severity: 'CRITICA',
        leadUnit: 'POLICIA_LOCAL',
        active: true,
        createdBy: 'Plan Operativo Smart Tourism Málaga',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actionSteps: [
          {
            step: 1,
            action: 'Activación de paneles de mensajería variable y recomendación de rutas alternativas hacia Muelle Uno.',
            targetZoneId: 'malaga_centro',
            targetZoneName: 'Centro Histórico & Calle Larios',
            responsibleUnit: 'MOVILIDAD_TRANSITO',
            resourcesAssigned: ['PMV-01', 'PMV-02'],
            estimatedExecutionMinutes: 5,
          },
          {
            step: 2,
            action: 'Despliegue de patrullas peatonales en accesos Calle Larios y Plaza de la Constitución para regular ritmo de entrada.',
            targetZoneId: 'malaga_centro',
            targetZoneName: 'Centro Histórico & Calle Larios',
            responsibleUnit: 'POLICIA_LOCAL',
            resourcesAssigned: ['Patrulla Peatonal 1', 'Patrulla Peatonal 2'],
            estimatedExecutionMinutes: 10,
          },
          {
            step: 3,
            action: 'Apertura de refuerzo en lanzaderas de transporte público desde la estación María Zambrano.',
            targetZoneId: 'malaga_centro',
            targetZoneName: 'Centro Histórico & Calle Larios',
            responsibleUnit: 'MOVILIDAD_TRANSITO',
            resourcesAssigned: ['EMT Línea Refuerzo C1'],
            estimatedExecutionMinutes: 15,
          }
        ]
      },
      {
        id: 'proto-plm-01',
        tenantId: 'tenant_ayto_palma',
        destinationId: 'palma',
        name: 'Protocolo de Desembarco de Cruceros y Acceso a Casco Antiguo',
        description: 'Regulación de flujos peatonales y autobuses lanzadera desde el Puerto de Palma.',
        triggerType: 'CONCENTRACION_CRUCEROS',
        triggerThresholdPct: 80,
        targetZoneIds: ['palma_centro_historico'],
        severity: 'MODERADA',
        leadUnit: 'PUERTO_CRUCEROS',
        active: true,
        createdBy: 'Plan de Movilidad Sostenible de Palma',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actionSteps: [
          {
            step: 1,
            action: 'Escalonamiento de salidas de autocares turísticos desde Estación Marítima 2.',
            targetZoneId: 'palma_centro_historico',
            targetZoneName: 'Casco Antiguo y Catedral',
            responsibleUnit: 'PUERTO_CRUCEROS',
            resourcesAssigned: ['Dique de Poniente Control'],
            estimatedExecutionMinutes: 10,
          },
          {
            step: 2,
            action: 'Habilitación de carril reservado para residentes en Calle Palau Reial.',
            targetZoneId: 'palma_centro_historico',
            targetZoneName: 'Casco Antiguo y Catedral',
            responsibleUnit: 'POLICIA_LOCAL',
            resourcesAssigned: ['Filtro Policial Born'],
            estimatedExecutionMinutes: 15,
          }
        ]
      }
    );
  }

  private seedInitialCalibrations() {
    const now = Date.now();
    const horizons: Array<{ h: 'T_1H' | 'T_4H' | 'T_24H'; offsetMs: number }> = [
      { h: 'T_1H', offsetMs: 3600000 },
      { h: 'T_4H', offsetMs: 14400000 },
      { h: 'T_24H', offsetMs: 86400000 },
    ];

    ['malaga', 'palma'].forEach(dest => {
      const tenant = dest === 'malaga' ? 'tenant_ayto_malaga' : 'tenant_ayto_palma';
      const zoneId = dest === 'malaga' ? 'malaga_centro' : 'palma_centro_historico';
      const zoneName = dest === 'malaga' ? 'Centro Histórico & Calle Larios' : 'Casco Antiguo y Catedral';

      horizons.forEach((hz, idx) => {
        const predicted = 12000 + idx * 800;
        const observed = predicted + Math.round((Math.random() - 0.45) * 600);
        const absErr = Math.abs(observed - predicted);
        const pctErr = Number(((absErr / observed) * 100).toFixed(2));

        this.inMemoryCalibrations.push({
          id: `calib-${dest}-${hz.h}`,
          tenantId: tenant,
          destinationId: dest,
          zoneId,
          zoneName,
          horizon: hz.h,
          predictedAt: new Date(now - hz.offsetMs * 2).toISOString(),
          targetTimestamp: new Date(now - hz.offsetMs).toISOString(),
          predictedVisitors: predicted,
          observedVisitors: observed,
          absoluteError: absErr,
          percentageError: pctErr,
          calibratedConfidencePct: Number((100 - pctErr).toFixed(1)),
          modelId: 'modelo_afluencia_predictiva_v1',
          sensorVerificationId: `sens-iot-${dest}-01`,
        });
      });
    });
  }

  public getCurrentOperator(): OperatorIdentity {
    return this.currentOperator;
  }

  public async switchOperator(username: string): Promise<OperatorIdentity> {
    const dbOp = await postgisRepository.getOperatorByUsername(username);
    if (dbOp) {
      this.currentOperator = dbOp;
      return dbOp;
    }

    const found = DEMO_OPERATORS.find(op => op.username === username);
    if (!found) {
      throw new Error(`Operador '${username}' no encontrado.`);
    }
    this.currentOperator = found;
    return found;
  }

  public async listOperators(): Promise<OperatorIdentity[]> {
    const dbList = await postgisRepository.listDemoOperators();
    if (dbList.length > 0) return dbList;
    return DEMO_OPERATORS;
  }

  /**
   * Registra automáticamente una propuesta generada por el servidor en PostGIS
   */
  public async registerServerProposal(
    proposal: AiSimulationProposal,
    operator: OperatorIdentity
  ): Promise<AiProposalAuditRecord> {
    return this.auditProposal(proposal, operator, 'PROPUESTO');
  }

  /**
   * Registra una decisión humana sobre una propuesta generada en servidor previamente validada
   */
  public async recordServerProposalDecision(
    proposalId: string,
    tenantId: string,
    destinationId: string,
    operator: OperatorIdentity,
    decision: AiAuditDecision,
    decisionRationale?: string,
    linkedScenarioId?: string,
    linkedRunId?: string
  ): Promise<{ success: boolean; decisionId: string }> {
    // 1. Verificar existencia de la propuesta previa en PostGIS o memoria
    let proposal = await postgisRepository.getAiProposalById(proposalId, tenantId, destinationId);
    if (!proposal) {
      proposal = this.inMemoryAudits.find(a => (a.proposalId === proposalId || a.id === proposalId) && a.destinationId === destinationId) || null;
    }

    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: La propuesta '${proposalId}' no existe en el registro del servidor para el destino '${destinationId}'.`);
    }

    const decisionId = `dec-${proposalId}-${Date.now()}`;

    // 2. Registrar en la tabla inmutable append-only ai_decisions_audit
    const persisted = await postgisRepository.recordHumanDecision({
      id: decisionId,
      proposalId: proposal.id,
      tenantId,
      destinationId,
      operatorId: operator.id,
      operatorName: operator.displayName,
      operatorRole: operator.role,
      decision,
      decisionRationale,
      linkedScenarioId,
      linkedRunId,
    }).catch(err => {
      console.error('[PilotOperationsManager] Error persistiendo decisión en PostGIS:', err);
      return false;
    });

    if (!persisted) {
      throw new Error(`PERSISTENCE_FAILED: No se pudo garantizar el registro inmutable de la decisión en la base de datos PostGIS. Acción bloqueada por gobernanza.`);
    }

    return { success: true, decisionId };
  }

  public async auditProposal(
    proposal: AiSimulationProposal,
    operator: OperatorIdentity,
    decision: AiAuditDecision = 'PROPUESTO',
    decisionRationale?: string,
    linkedScenarioId?: string,
    linkedRunId?: string
  ): Promise<AiProposalAuditRecord> {
    const record: AiProposalAuditRecord = {
      id: `audit-${proposal.id}`,
      proposalId: proposal.id,
      tenantId: proposal.tenantId,
      destinationId: proposal.destinationId,
      operatorId: operator.id,
      operatorName: operator.displayName,
      prompt: proposal.promptEcho,
      intent: proposal.interpretation.intent,
      status: proposal.status,
      contextFingerprint: proposal.evidence.contextFingerprint,
      contextVersion: proposal.evidence.contextVersion,
      dataSources: proposal.evidence.dataSources,
      rationale: proposal.evidence.rationale,
      assumptions: proposal.evidence.assumptions,
      uncertaintyLevel: proposal.evidence.uncertainty.level,
      confidencePct: proposal.evidence.uncertainty.confidencePct,
      syntheticDemoData: proposal.evidence.syntheticDemoData,
      decision,
      decisionRationale,
      linkedScenarioId,
      linkedRunId,
      createdAt: proposal.generatedAt,
      decidedAt: decision !== 'PROPUESTO' ? new Date().toISOString() : undefined,
    };

    // En piloto institucional: persistencia PostGIS obligatoria
    const persisted = await postgisRepository.auditAiProposal(record).catch(err => {
      console.error('[PilotOperationsManager] Error persistiendo propuesta en PostGIS:', err);
      return false;
    });

    if (!persisted) {
      throw new Error(`PERSISTENCE_FAILED: El registro de auditoría de la propuesta IA no pudo ser persistido en PostGIS. Acción abortada.`);
    }

    const existingIdx = this.inMemoryAudits.findIndex(a => a.id === record.id);
    if (existingIdx >= 0) {
      this.inMemoryAudits[existingIdx] = record;
    } else {
      this.inMemoryAudits.unshift(record);
    }

    return record;
  }

  public async getAuditLog(tenantId: string, destinationId: string): Promise<AiProposalAuditRecord[]> {
    const dbAudits = await postgisRepository.getAiAuditLog(tenantId, destinationId);
    if (dbAudits.length > 0) return dbAudits;

    return this.inMemoryAudits.filter(a => a.tenantId === tenantId && a.destinationId === destinationId);
  }

  public async listProtocols(tenantId: string, destinationId: string): Promise<OperationalProtocol[]> {
    const dbProtocols = await postgisRepository.listProtocols(tenantId, destinationId);
    if (dbProtocols.length > 0) return dbProtocols;

    return this.inMemoryProtocols.filter(p => p.tenantId === tenantId && p.destinationId === destinationId);
  }

  public async getCalibrations(tenantId: string, destinationId: string) {
    const dbCalibs = await postgisRepository.getCalibrationStats(tenantId, destinationId);
    if (dbCalibs && dbCalibs.recentRecords.length > 0) return dbCalibs;

    const filtered = this.inMemoryCalibrations.filter(c => c.tenantId === tenantId && c.destinationId === destinationId);
    return {
      recentRecords: filtered,
      horizonMetrics: [
        { horizon: 'T_1H', avgAbsoluteError: 280.0, avgPercentageError: 2.33, sampleCount: 1 },
        { horizon: 'T_4H', avgAbsoluteError: 450.0, avgPercentageError: 3.51, sampleCount: 1 },
        { horizon: 'T_24H', avgAbsoluteError: 820.0, avgPercentageError: 6.02, sampleCount: 1 },
      ]
    };
  }
}

export const PilotOperationsService = new PilotOperationsManager();
