import { ParametrosDestinoConfigurables } from '../engine/simulationEngine';
import { ScenarioDraftInput } from './scenarioStudio';

export type AiProposalStatus = 'READY_FOR_REVIEW' | 'REQUIRES_CLARIFICATION' | 'REJECTED';

export interface AiPromptRequest {
  destinationId: string;
  tenantId?: string;
  prompt: string;
  activeZoneId?: string;
  contextPreferences?: {
    preferredHour?: number;
    preferredClimate?: 'DESPEJADO' | 'LLUVIA' | 'CALOR_EXTREMO';
  };
}

export interface AiDataSourceCitation {
  id: string;
  name: string;
  traceabilityId: string;
  dataQuality: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION';
  authorization: 'AUTORIZADO' | 'PENDIENTE' | 'NO_AUTORIZADO';
  purpose: string;
  contribution: string;
}

export interface AiProposalEvidence {
  contextPackageId?: string;
  contextFingerprint: string;
  contextVersion: string;
  origin: 'DEMO_CATALOG' | 'CONTEXT_PACKAGE_V1';
  syntheticDemoData: boolean;
  dataSources: AiDataSourceCitation[];
  rationale: string;
  assumptions: string[];
  uncertainty: {
    level: 'BAJA' | 'MEDIA' | 'ALTA';
    factors: string[];
    confidencePct: number;
    disclaimer: string;
  };
  governanceNotice: string;
}

export interface AiSimulationProposal {
  id: string;
  type: 'AiSimulationProposal';
  status: AiProposalStatus;
  destinationId: string;
  tenantId: string;
  generatedAt: string;
  model: {
    id: string;
    engine: 'BUILTIN_LLM' | 'HEURISTIC_RULE_ENGINE';
    version: string;
  };
  promptEcho: string;
  interpretation: {
    intent: 'WHAT_IF_SCENARIO' | 'CAPACITY_STRESS' | 'WEATHER_EVENT' | 'MOBILITY_RESTRICTION' | 'EVENT_CONCENTRATION' | 'EXPLORATORY';
    summary: string;
    targetZoneIds: string[];
    targetZoneNames: string[];
  };
  scenarioDraft: ScenarioDraftInput;
  runtimeParameters: ParametrosDestinoConfigurables;
  evidence: AiProposalEvidence;
  suggestedActions: Array<{
    action: 'APPLY_TO_SIMULATOR' | 'OPEN_IN_STUDIO' | 'CLARIFY_INPUT';
    label: string;
    description: string;
  }>;
  clarificationPrompt?: string;
  rejectionReason?: string;
}

export interface AiAgentCapabilities {
  status: 'ACTIVE';
  llmConfigured: boolean;
  llmModel: string;
  engineFallbackAvailable: boolean;
  supportedIntents: string[];
  destinationPrompts: Array<{
    id: string;
    label: string;
    prompt: string;
    intent: string;
  }>;
}
