// Contratos para el análisis de compatibilidad de destinos para compartir modelos de simulación

export interface DestinationRequirementCheck {
  requirementId: string;
  name: string;
  category: 'ONTOLOGICO_S2' | 'HISTORICO_C4' | 'GIS_S11' | 'TELEMETRIA';
  status: 'DISPONIBLE' | 'PARCIAL' | 'FALTANTE';
  evidenceDetails: string;
}

export interface DestinationModelFit {
  destinationId: string;
  destinationName: string;
  tenantId: string;
  compatibilityScorePct: number;
  readinessLevel: 'LISTO_PARA_OPERAR' | 'REQUIERE_CALIBRACION' | 'INCOMPATIBLE';
  checks: DestinationRequirementCheck[];
  missingElements: string[];
}

export interface MultiDestinationCompatibilityMatrix {
  modelId: string;
  modelTitle: string;
  timestamp: string;
  destinationsEvaluated: DestinationModelFit[];
  overallCrossDestinationFeasibility: 'ALTA' | 'MEDIA' | 'BAJA';
  sharedDataLanes: string[];
  recommendations: string[];
}
