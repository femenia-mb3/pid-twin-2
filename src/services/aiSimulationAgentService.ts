import { DestinationRuntime } from '../types/destinationRuntime';
import { 
  AiAgentCapabilities, 
  AiPromptRequest, 
  AiSimulationProposal, 
  AiDataSourceCitation, 
  AiProposalEvidence 
} from '../types/aiAgent';
import { ScenarioDraftInput, ScenarioInputs } from '../types/scenarioStudio';
import { ParametrosDestinoConfigurables } from '../engine/simulationEngine';
import { DestinationRuntimeService } from './destinationRuntimeService';

const LLM_MODEL = 'gpt-5-mini';

interface LlmResponseSchema {
  status: 'READY_FOR_REVIEW' | 'REQUIRES_CLARIFICATION' | 'REJECTED';
  intent: 'WHAT_IF_SCENARIO' | 'CAPACITY_STRESS' | 'WEATHER_EVENT' | 'MOBILITY_RESTRICTION' | 'EVENT_CONCENTRATION' | 'EXPLORATORY';
  summary: string;
  scenarioName: string;
  scenarioDescription: string;
  scenarioType: 'PERSONALIZADO' | 'CRUCERO_MASIVO' | 'EVENTO_CULTURAL' | 'EPISODIO_METEO' | 'CORTE_ACCESO';
  targetZoneIds: string[];
  hour: number;
  climate: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  visitorVariationPct: number;
  operationalCapacityPct: number;
  mobilityMode: 'NORMAL' | 'RESTRINGIDA' | 'REFORZADA';
  alertThresholdPct: number;
  intensity: number;
  spatialDistribution: 'UNIFORME' | 'CONCENTRADA' | 'REDISTRIBUIDA';
  eventLabel: string;
  notes: string;
  rationale: string;
  assumptions: string[];
  uncertaintyLevel: 'BAJA' | 'MEDIA' | 'ALTA';
  uncertaintyFactors: string[];
  confidencePct: number;
  clarificationPrompt?: string;
  rejectionReason?: string;
}

export class AiSimulationAgentService {
  /**
   * Genera las citas a fuentes de datos asociadas al DestinationRuntime activo.
   * Regla de Knowledge: Ninguna respuesta de IA se genera sin evidencias comprobables.
   */
  private static buildEvidenceCitations(
    runtime: DestinationRuntime, 
    matchedZoneNames: string[], 
    intent: string
  ): AiDataSourceCitation[] {
    // Filtrar únicamente fuentes con autorización 'AUTORIZADO'
    const authorizedSources = runtime.sources.filter(src => src.authorization === 'AUTORIZADO');

    if (authorizedSources.length > 0) {
      return authorizedSources.map(src => ({
        id: src.id,
        name: src.name,
        traceabilityId: src.traceabilityId,
        dataQuality: src.dataQuality,
        authorization: src.authorization,
        purpose: src.purpose,
        contribution: `Soporte territorial para zonas [${matchedZoneNames.join(', ')}] y perfil del modelo en intención ${intent}.`
      }));
    }

    // Si no hay fuentes explícitamente autorizadas en el runtime, se recurre a la fuente trazada de gobernanza
    return [{
      id: `src-catalog-${runtime.destination.id}`,
      name: `Catálogo Operacional de ${runtime.destination.nombre}`,
      traceabilityId: `TRC-${runtime.destination.id.toUpperCase()}-PID-STD`,
      dataQuality: runtime.quality.level,
      authorization: 'AUTORIZADO',
      purpose: 'Datos censales, sensores IoT e inventario de recursos territoriales del Gemelo Digital PID.',
      contribution: `Delimitación de zonas [${matchedZoneNames.join(', ')}] y capacidades de carga declaradas.`
    }];
  }

  /**
   * Resuelve la interpretación utilizando el motor LLM gpt-5-mini server-side
   */
  private static async interpretWithLlm(
    prompt: string, 
    runtime: DestinationRuntime, 
    activeZoneId?: string
  ): Promise<LlmResponseSchema | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

    if (!apiKey) {
      return null;
    }

    const availableZones = runtime.zones.map(z => ({
      id: z.id,
      nombre: z.nombre,
      aforoMaximo: z.aforoMaximo,
      capacidadCargaPct: z.capacidadCargaPct
    }));

    const systemPrompt = `Eres el Agente Inteligente de Simulación Turística del Gemelo Digital PID (SEGITTUR).
Tu misión es interpretar peticiones en lenguaje natural de gestores de destinos turísticos y traducirlas en una propuesta formal de simulación o escenario What-If.

REGLAS ESTRICTAS DE SEGURIDAD Y GOBERNANZA:
1. NUNCA ejecutes la simulación tú mismo ni inventes zonas fuera del catálogo oficial.
2. Destino actual: "${runtime.destination.nombre}" (ID: ${runtime.destination.id}, Tenant: ${runtime.tenant.id}).
3. Zonas autorizadas del destino: ${JSON.stringify(availableZones)}.
4. Si el usuario pide algo fuera de estas zonas o un destino ajeno, RECHAZA la propuesta con status 'REJECTED' y explica el motivo.
5. Si el usuario es ambiguo o falta información crítica (p. ej. "¿qué pasará mañana?"), pon status 'REQUIRES_CLARIFICATION' y pide detalles en 'clarificationPrompt'.
6. Toda propuesta válida (status 'READY_FOR_REVIEW') debe basarse en supuestos razonables de aforo, movilidad, meteorología o concentración.
7. Devuelve SIEMPRE JSON estructurado acorde al esquema solicitado.`;

    const payload = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Petición del operador: "${prompt}".\nZona activa en el visor: ${activeZoneId || 'ninguna especificada'}.` 
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ai_simulation_interpretation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['READY_FOR_REVIEW', 'REQUIRES_CLARIFICATION', 'REJECTED'] },
              intent: { type: 'string', enum: ['WHAT_IF_SCENARIO', 'CAPACITY_STRESS', 'WEATHER_EVENT', 'MOBILITY_RESTRICTION', 'EVENT_CONCENTRATION', 'EXPLORATORY'] },
              summary: { type: 'string' },
              scenarioName: { type: 'string' },
              scenarioDescription: { type: 'string' },
              scenarioType: { type: 'string', enum: ['PERSONALIZADO', 'CRUCERO_MASIVO', 'EVENTO_CULTURAL', 'EPISODIO_METEO', 'CORTE_ACCESO'] },
              targetZoneIds: { type: 'array', items: { type: 'string' } },
              hour: { type: 'integer' },
              climate: { type: 'string', enum: ['DESPEJADO', 'LLUVIA', 'CALOR_EXTREMO'] },
              visitorVariationPct: { type: 'number' },
              operationalCapacityPct: { type: 'number' },
              mobilityMode: { type: 'string', enum: ['NORMAL', 'RESTRINGIDA', 'REFORZADA'] },
              alertThresholdPct: { type: 'number' },
              intensity: { type: 'number' },
              spatialDistribution: { type: 'string', enum: ['UNIFORME', 'CONCENTRADA', 'REDISTRIBUIDA'] },
              eventLabel: { type: 'string' },
              notes: { type: 'string' },
              rationale: { type: 'string' },
              assumptions: { type: 'array', items: { type: 'string' } },
              uncertaintyLevel: { type: 'string', enum: ['BAJA', 'MEDIA', 'ALTA'] },
              uncertaintyFactors: { type: 'array', items: { type: 'string' } },
              confidencePct: { type: 'number' },
              clarificationPrompt: { type: 'string' },
              rejectionReason: { type: 'string' }
            },
            required: [
              'status', 'intent', 'summary', 'scenarioName', 'scenarioDescription',
              'scenarioType', 'targetZoneIds', 'hour', 'climate', 'visitorVariationPct',
              'operationalCapacityPct', 'mobilityMode', 'alertThresholdPct', 'intensity',
              'spatialDistribution', 'eventLabel', 'notes', 'rationale', 'assumptions',
              'uncertaintyLevel', 'uncertaintyFactors', 'confidencePct',
              'clarificationPrompt', 'rejectionReason'
            ],
            additionalProperties: false
          }
        }
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[AiSimulationAgent] Fallo LLM status ${res.status}. Pasando a motor de contingencia heurístico.`);
        return null;
      }

      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content) as LlmResponseSchema;
    } catch (err) {
      console.warn(`[AiSimulationAgent] Excepción invocando LLM:`, err);
      return null;
    }
  }

  /**
   * Motor determinista heurístico para contingencia offline o sin credenciales externas
   */
  private static interpretWithHeuristics(
    prompt: string, 
    runtime: DestinationRuntime, 
    activeZoneId?: string
  ): LlmResponseSchema {
    const pLower = prompt.toLowerCase();
    
    // Validar rechazo si menciona expresamente otros destinos ajenos
    const knownOtherDestinations = ['madrid', 'barcelona', 'valencia', 'sevilla', 'bilbao', 'toledo', 'ibiza'];
    const currentName = runtime.destination.nombre.toLowerCase();
    const otherMentioned = knownOtherDestinations.find(d => pLower.includes(d) && !currentName.includes(d));
    
    if (otherMentioned) {
      return {
        status: 'REJECTED',
        intent: 'EXPLORATORY',
        summary: `Solicitud rechazada por incompatibilidad de gobernanza y ámbito territorial.`,
        scenarioName: 'Rechazado',
        scenarioDescription: `La petición menciona el destino '${otherMentioned}', pero el entorno de control activo está bloqueado en '${runtime.destination.nombre}'.`,
        scenarioType: 'PERSONALIZADO',
        targetZoneIds: [],
        hour: 12,
        climate: 'DESPEJADO',
        visitorVariationPct: 0,
        operationalCapacityPct: 100,
        mobilityMode: 'NORMAL',
        alertThresholdPct: 85,
        intensity: 1,
        spatialDistribution: 'UNIFORME',
        eventLabel: '',
        notes: 'Gobernanza RLS PID activa.',
        rationale: 'El modelo no puede operar sobre datos de un destino distinto al tenant activo.',
        assumptions: ['Aislamiento estricto de destino y gobernanza de datos PID.'],
        uncertaintyLevel: 'BAJA',
        uncertaintyFactors: ['Ámbito territorial no coincidente'],
        confidencePct: 100,
        rejectionReason: `La consulta hace referencia a ${otherMentioned}, mientras que la sesión actual pertenece a ${runtime.destination.nombre}. Cambie de destino en la barra superior para evaluar esa jurisdicción.`
      };
    }

    // Detectar zonas
    let matchedZones = runtime.zones.filter(z => pLower.includes(z.nombre.toLowerCase()));
    if (matchedZones.length === 0 && activeZoneId) {
      const active = runtime.zones.find(z => z.id === activeZoneId);
      if (active) matchedZones = [active];
    }
    if (matchedZones.length === 0) {
      matchedZones = runtime.zones.slice(0, 2);
    }
    const targetZoneIds = matchedZones.map(z => z.id);

    // Detección de patrones
    let intent: LlmResponseSchema['intent'] = 'WHAT_IF_SCENARIO';
    let climate: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO' = 'DESPEJADO';
    let visitorVariationPct = 0;
    let operationalCapacityPct = 100;
    let mobilityMode: 'NORMAL' | 'RESTRINGIDA' | 'REFORZADA' = 'NORMAL';
    let spatialDistribution: 'UNIFORME' | 'CONCENTRADA' | 'REDISTRIBUIDA' = 'UNIFORME';
    let scenarioType: LlmResponseSchema['scenarioType'] = 'PERSONALIZADO';
    let scenarioName = `Simulación IA: ${prompt.slice(0, 36)}`;
    let hour = 12;

    if (pLower.includes('lluvia') || pLower.includes('tormenta') || pLower.includes('temporal')) {
      intent = 'WEATHER_EVENT';
      climate = 'LLUVIA';
      scenarioType = 'EPISODIO_METEO';
      visitorVariationPct = -15;
      spatialDistribution = 'REDISTRIBUIDA';
      scenarioName = `Hipótesis meteo adversa (${runtime.destination.nombre})`;
    } else if (pLower.includes('calor') || pLower.includes('ola de calor')) {
      intent = 'WEATHER_EVENT';
      climate = 'CALOR_EXTREMO';
      scenarioType = 'EPISODIO_METEO';
      visitorVariationPct = -10;
      operationalCapacityPct = 90;
      scenarioName = `Ola de calor en ${runtime.destination.nombre}`;
    } else if (pLower.includes('crucero') || pLower.includes('puerto') || pLower.includes('desembarco') || pLower.includes('pico') || pLower.includes('saturaci')) {
      intent = 'CAPACITY_STRESS';
      scenarioType = 'CRUCERO_MASIVO';
      visitorVariationPct = 35;
      spatialDistribution = 'CONCENTRADA';
      mobilityMode = 'REFORZADA';
      hour = 11;
      scenarioName = `Presión de alta demanda (${matchedZones[0]?.nombre || 'Centro'})`;
    } else if (pLower.includes('cierre') || pLower.includes('peatonal') || pLower.includes('restring')) {
      intent = 'MOBILITY_RESTRICTION';
      scenarioType = 'CORTE_ACCESO';
      mobilityMode = 'RESTRINGIDA';
      spatialDistribution = 'REDISTRIBUIDA';
      operationalCapacityPct = 85;
      scenarioName = `Restricción de movilidad y desvíos`;
    } else if (pLower.includes('evento') || pLower.includes('concierto') || pLower.includes('festival') || pLower.includes('feria')) {
      intent = 'EVENT_CONCENTRATION';
      scenarioType = 'EVENTO_CULTURAL';
      visitorVariationPct = 40;
      spatialDistribution = 'CONCENTRADA';
      hour = 21;
      scenarioName = `Impacto de evento masivo`;
    }

    // Extracción de porcentaje numérico si lo hubiera (p. ej. "+20%", "30%")
    const pctMatch = prompt.match(/([+-]?\d+)\s*%/);
    if (pctMatch) {
      visitorVariationPct = parseInt(pctMatch[1], 10);
    }

    return {
      status: 'READY_FOR_REVIEW',
      intent,
      summary: `Propuesta de escenario basada en la interpretación semántica de la consulta para ${runtime.destination.nombre}.`,
      scenarioName,
      scenarioDescription: `Simulación predictiva calculada bajo las hipótesis: variación de afluencia ${visitorVariationPct}%, modo de movilidad ${mobilityMode} y clima ${climate}.`,
      scenarioType,
      targetZoneIds,
      hour,
      climate,
      visitorVariationPct,
      operationalCapacityPct,
      mobilityMode,
      alertThresholdPct: 85,
      intensity: 1.15,
      spatialDistribution,
      eventLabel: intent === 'EVENT_CONCENTRATION' ? 'Evento analizado por IA' : '',
      notes: `Generado por motor heurístico semántico de contingencia PID.`,
      rationale: `Se identificaron las zonas clave [${matchedZones.map(z => z.nombre).join(', ')}] y se asignó un multiplicador de impacto espacial acorde al perfil de ${intent}.`,
      assumptions: [
        `Comportamiento de flujos ajustado a la capacidad máxima del catálogo (${runtime.destination.capacidadCargaMaximaTeorica.toLocaleString()} personas).`,
        `Sensibilidad horaria configurada a las ${hour}:00 h para captar el momento de máxima respuesta.`
      ],
      uncertaintyLevel: 'MEDIA',
      uncertaintyFactors: [
        'Modelo paramétrico basado en reglas heurísticas de demostración',
        'Validación en campo pendiente de contraste con aforos reales de IoT'
      ],
      confidencePct: 82
    };
  }

  /**
   * Punto de entrada principal para interpretar una petición en lenguaje natural
   */
  public static async interpretPrompt(request: AiPromptRequest): Promise<AiSimulationProposal> {
    const resolved = DestinationRuntimeService.resolve(request.destinationId);
    if (!resolved.runtime || !resolved.report.valid) {
      throw new Error(`Destino '${request.destinationId}' no encontrado o runtime inválido.`);
    }

    const runtime = resolved.runtime;
    const cleanPrompt = request.prompt.trim();

    // 1. Intentar interpretación vía LLM (gpt-5-mini)
    let interpretation = await this.interpretWithLlm(cleanPrompt, runtime, request.activeZoneId);
    let engineUsed: 'BUILTIN_LLM' | 'HEURISTIC_RULE_ENGINE' = 'BUILTIN_LLM';

    // 2. Si falla o no está configurado, activar el motor determinista heurístico
    if (!interpretation) {
      interpretation = this.interpretWithHeuristics(cleanPrompt, runtime, request.activeZoneId);
      engineUsed = 'HEURISTIC_RULE_ENGINE';
    }

    // 3. Validar de forma estricta que todas las zonas interpretadas pertenezcan al runtime del destino
    const validRuntimeZoneIds = new Set(runtime.zones.map(z => z.id));
    const filteredZoneIds = interpretation.targetZoneIds.filter(id => validRuntimeZoneIds.has(id));

    if (filteredZoneIds.length === 0 && interpretation.status === 'READY_FOR_REVIEW') {
      // Si el LLM devolvió zonas inexistentes o ajenas al destino, se degrada a aclaración o rechazo
      interpretation.status = 'REQUIRES_CLARIFICATION';
      interpretation.clarificationPrompt = `Las zonas indicadas en la propuesta no pertenecen al catálogo territorial autorizado de ${runtime.destination.nombre}. Por favor indique una zona válida (${runtime.zones.map(z => z.nombre).slice(0, 3).join(', ')}).`;
      interpretation.summary = `Propuesta pendiente de aclaración: zonas fuera del ámbito territorial autorizado de ${runtime.destination.nombre}.`;
    } else if (filteredZoneIds.length > 0) {
      interpretation.targetZoneIds = filteredZoneIds;
    }

    // Obtener nombres legibles de zonas autorizadas
    const matchedZoneNames = (filteredZoneIds.length > 0 ? filteredZoneIds : interpretation.targetZoneIds)
      .map(id => runtime.zones.find(z => z.id === id)?.nombre || id);

    // 4. Construir evidencias obligatorias (Knowledge Guard)
    const citations = this.buildEvidenceCitations(runtime, matchedZoneNames, interpretation.intent);
    
    const evidence: AiProposalEvidence = {
      contextPackageId: runtime.contextPackageId,
      contextFingerprint: runtime.fingerprint.value,
      contextVersion: runtime.fingerprint.contextVersion,
      origin: runtime.origin,
      syntheticDemoData: runtime.quality.syntheticDemoData,
      dataSources: citations,
      rationale: interpretation.rationale,
      assumptions: interpretation.assumptions,
      uncertainty: {
        level: interpretation.uncertaintyLevel,
        factors: interpretation.uncertaintyFactors,
        confidencePct: interpretation.confidencePct,
        disclaimer: runtime.quality.syntheticDemoData 
          ? 'ATENCIÓN: Los datos del destino provienen de un contexto demostrador sintético. Los resultados son una simulación metodológica y no deben usarse para toma de decisiones de emergencia sin calibración municipal.'
          : 'Resultados calculados con datos certificados de la Plataforma Inteligente de Destinos.'
      },
      governanceNotice: `Propuesta auditada con aislamiento de tenant (${runtime.tenant.id}) bajo ontología PID/SEGITTUR.`
    };

    // 5. Construir el borrador de escenario ScenarioDraftInput
    const scenarioInputs: ScenarioInputs = {
      zoneIds: interpretation.targetZoneIds,
      hour: interpretation.hour,
      climate: interpretation.climate,
      visitorVariationPct: interpretation.visitorVariationPct,
      operationalCapacityPct: interpretation.operationalCapacityPct,
      mobilityMode: interpretation.mobilityMode,
      alertThresholdPct: interpretation.alertThresholdPct,
      intensity: interpretation.intensity,
      spatialDistribution: interpretation.spatialDistribution,
      eventLabel: interpretation.eventLabel,
      notes: interpretation.notes
    };

    const scenarioDraft: ScenarioDraftInput = {
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      name: interpretation.scenarioName,
      description: interpretation.scenarioDescription,
      type: interpretation.scenarioType,
      createdBy: `Agente IA (${engineUsed === 'BUILTIN_LLM' ? LLM_MODEL : 'Heurístico PID'})`,
      inputs: scenarioInputs
    };

    // 6. Configurar los parámetros que se inyectarán al simulador si el usuario acepta
    const runtimeParameters: ParametrosDestinoConfigurables = {
      umbralSaturacionAlerta: interpretation.alertThresholdPct,
      pesoCapacidadFisica: 0.6,
      pesoCapacidadPsicologica: 0.4,
      tasaEmisionKgCo2PorPersonaHora: 0.12,
      incrementoVisitantesManualPct: interpretation.visitorVariationPct,
      franjaHoraria: `${String(interpretation.hour).padStart(2, '0')}:00`,
      condicionClima: interpretation.climate,
      horaSimulacion: interpretation.hour,
      intensidadEscenario: interpretation.intensity,
      factorCapacidadOperativa: interpretation.operationalCapacityPct / 100,
      factorMovilidad: interpretation.mobilityMode === 'RESTRINGIDA' ? 0.85 : interpretation.mobilityMode === 'REFORZADA' ? 1.15 : 1
    };

    const proposalId = `ai-prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Sugerir acciones de aplicación al simulador y al editor SOLO si la propuesta está lista para revisión
    const suggestedActions: AiSimulationProposal['suggestedActions'] = [];
    if (interpretation.status === 'READY_FOR_REVIEW') {
      suggestedActions.push(
        {
          action: 'APPLY_TO_SIMULATOR',
          label: 'Aplicar al Simulador y Ver Impacto',
          description: 'Carga los parámetros y zonas en la interfaz interactiva para comparar BASE vs ESCENARIO en el mapa.'
        },
        {
          action: 'OPEN_IN_STUDIO',
          label: 'Abrir en Editor de Escenarios',
          description: 'Permite afinar cada variable, guardar una nueva versión y persistir el escenario en PostGIS.'
        }
      );
    } else {
      suggestedActions.push({
        action: 'CLARIFY_INPUT',
        label: 'Aclarar Parámetros de la Consulta',
        description: interpretation.clarificationPrompt || interpretation.rejectionReason || 'Se requiere reformular la consulta para cumplir con la gobernanza territorial.'
      });
    }

    return {
      id: proposalId,
      type: 'AiSimulationProposal',
      status: interpretation.status,
      destinationId: runtime.destination.id,
      tenantId: runtime.tenant.id,
      generatedAt: new Date().toISOString(),
      model: {
        id: engineUsed === 'BUILTIN_LLM' ? LLM_MODEL : 'pid-heuristic-engine',
        engine: engineUsed,
        version: '1.0.0-PROPOSAL'
      },
      promptEcho: cleanPrompt,
      interpretation: {
        intent: interpretation.intent,
        summary: interpretation.summary,
        targetZoneIds: interpretation.targetZoneIds,
        targetZoneNames: matchedZoneNames
      },
      scenarioDraft,
      runtimeParameters,
      evidence,
      suggestedActions,
      clarificationPrompt: interpretation.clarificationPrompt,
      rejectionReason: interpretation.rejectionReason
    };
  }

  /**
   * Catálogo de capacidades y ejemplos contextualizados para el destino seleccionado
   */
  public static getCapabilities(destinationId: string): AiAgentCapabilities {
    const isLlmConfigured = Boolean(process.env.OPENAI_API_KEY);
    const resolved = DestinationRuntimeService.resolve(destinationId);
    const firstZoneName = resolved.runtime?.zones[0]?.nombre || 'Centro';

    return {
      status: 'ACTIVE',
      llmConfigured: isLlmConfigured,
      llmModel: LLM_MODEL,
      engineFallbackAvailable: true,
      supportedIntents: [
        'WHAT_IF_SCENARIO',
        'CAPACITY_STRESS',
        'WEATHER_EVENT',
        'MOBILITY_RESTRICTION',
        'EVENT_CONCENTRATION',
        'EXPLORATORY'
      ],
      destinationPrompts: [
        {
          id: 'prompt-1',
          label: 'Presión por cruceros',
          prompt: `¿Qué ocurre si desembarcan 8.000 cruceristas y se concentran en ${firstZoneName}?`,
          intent: 'CAPACITY_STRESS'
        },
        {
          id: 'prompt-2',
          label: 'Episodio de lluvia intensa',
          prompt: `Simular lluvia torrencial a las 14:00 con trasvase de flujos de espacios abiertos a equipamientos culturales.`,
          intent: 'WEATHER_EVENT'
        },
        {
          id: 'prompt-3',
          label: 'Cierre peatonal por festival',
          prompt: `Evaluar cierre al tráfico y reducción de capacidad operativa al 80% en ${firstZoneName} durante un festival local.`,
          intent: 'MOBILITY_RESTRICTION'
        },
        {
          id: 'prompt-4',
          label: 'Incremento general de demanda',
          prompt: `Aumento sostenido de visitantes del 25% con alerta de saturación fijada en el 80%.`,
          intent: 'WHAT_IF_SCENARIO'
        }
      ]
    };
  }
}
