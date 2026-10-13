import { DataLane, PidServiceRelation } from './interoperability';

export type ModelLifecycleState =
  | 'BORRADOR'
  | 'VALIDADO'
  | 'PUBLICADO_REUTILIZABLE'
  | 'ARCHIVADO';

export interface ModelPackageVariable {
  id: string;
  label: string;
  unit?: string;
  defaultValue: number | string | boolean;
  valueType: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  allowedValues?: string[];
  required: boolean;
  description?: string;
}

export interface ModelPackageOutputIndicator {
  id: string;
  label: string;
  unit: string;
  category: 'AFORO' | 'SATURACION' | 'MOVILIDAD' | 'MEDIOAMBIENTE' | 'ECONOMIA';
  targetEntity: 'ZONA' | 'RECURSO' | 'DESTINO_GLOBAL';
  formulaSummary: string;
}

export interface ModelDeclarativeRule {
  ruleId: string;
  name: string;
  conditionDescription: string;
  impactVariable: string;
  operator: 'MULTIPLY' | 'ADD' | 'SET' | 'CAP_AT';
  value: number;
  evidenceNotes: string;
}

export interface SimulationModelPackageV1 {
  schemaVersion: 'simulation-model-package-v1';
  id: string;
  version: string;
  name: string;
  domain: string;
  summary: string;
  creatorDestinationId: string;
  creatorDestinationName: string;
  lifecycleState: ModelLifecycleState;
  requiredLanes: DataLane[];
  pidModulesRequired: Array<PidServiceRelation['id']>;
  variables: ModelPackageVariable[];
  sourceRequirements: Array<{
    lane: DataLane;
    concept: string;
    minimumFrequency: string;
    recommendedFormat: string;
    mandatory: boolean;
  }>;
  declarativeRules: ModelDeclarativeRule[];
  outputIndicators: ModelPackageOutputIndicator[];
  privacyPolicy: {
    privacyLevel: 'PUBLICO' | 'INTERNO_AGREGADO' | 'REQUIERE_EVALUACION';
    allowsCrossDestinationUse: boolean;
    dataMinimizationRule: string;
  };
  evidence: {
    origin: string;
    responsibleAuthor: string;
    license: string;
    validationMethod: string;
    reviewedAt: string;
    packageFingerprintSha256?: string;
  };
}

export interface ModelPackageHumanDecision {
  id: string;
  packageId: string;
  version: string;
  tenantId: string;
  destinationId: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  decision: 'APROBAR_VALIDADO' | 'PUBLICAR_REUTILIZABLE' | 'RECHAZAR' | 'ARCHIVAR';
  rationale: string;
  decidedAt: string;
}

export interface PackageValidationResult {
  valid: boolean;
  packageId?: string;
  errors: string[];
  warnings: string[];
  normalizedPackage?: SimulationModelPackageV1;
  fingerprintSha256: string;
}
