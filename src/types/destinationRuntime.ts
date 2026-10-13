import {
  ContextPackageDataSource,
  ContextPackageModelProfile,
  ContextPackageTenant,
} from './contextPackage';
import { Destino, RecursoTuristico, SensorIoT, ZonaDestino } from './ontology';

export type DestinationRuntimeOrigin = 'DEMO_CATALOG' | 'CONTEXT_PACKAGE_V1';

export interface RuntimeDataQuality {
  level: 'A_CERTIFICADA' | 'B_ESTIMADA' | 'C_EN_VALIDACION';
  syntheticDemoData: boolean;
  sourceCount: number;
  pendingAuthorizationCount: number;
  cutOffDate: string;
}

export interface DestinationRuntimeFingerprint {
  algorithm: 'sha256';
  value: string;
  contextVersion: string;
}

export interface DestinationRuntime {
  id: string;
  destination: Destino;
  tenant: ContextPackageTenant;
  origin: DestinationRuntimeOrigin;
  contextPackageId?: string;
  modelProfile: ContextPackageModelProfile;
  timezone: string;
  locale: string;
  zones: ZonaDestino[];
  resources: RecursoTuristico[];
  sensors: SensorIoT[];
  sources: ContextPackageDataSource[];
  quality: RuntimeDataQuality;
  fingerprint: DestinationRuntimeFingerprint;
}

export interface RuntimeValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface RuntimeValidationReport {
  valid: boolean;
  errors: RuntimeValidationIssue[];
  warnings: RuntimeValidationIssue[];
  checkedAt: string;
}

export interface RuntimeResolution {
  runtime?: DestinationRuntime;
  report: RuntimeValidationReport;
}
