// Contratos para el asistente de ingestión no-code de datos ontológicos y series históricas

export type IngestionDataLane = 'ONTOLOGICO_S2' | 'HISTORICO_C4';
export type IngestionFileFormat = 'CSV' | 'GEOJSON' | 'JSON';
export type IngestionStatus = 'PARSED' | 'VALIDATED' | 'APPLIED' | 'REJECTED';

export interface ColumnMappingDefinition {
  sourceColumn: string;
  targetField: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'coordinate';
}

export interface IngestedEntityRecord {
  id: string;
  entityType: 'TourismResource' | 'SensorTelemetry' | 'HistoricOccupancy';
  urn: string;
  data: Record<string, unknown>;
  validationErrors?: string[];
}

export interface DataIngestionBatchInput {
  destinationId: string;
  tenantId: string;
  title: string;
  lane: IngestionDataLane;
  fileFormat: IngestionFileFormat;
  rawPayload: string; // CSV text o JSON string
  sourceName: string;
  licenseDeclared: string;
  columnMapping?: Record<string, string>;
  actorEmail?: string;
}

export interface DataIngestionBatchResult {
  batchId: string;
  destinationId: string;
  lane: IngestionDataLane;
  status: IngestionStatus;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  fingerprintSha256: string;
  entitiesGenerated: IngestedEntityRecord[];
  errors: string[];
  appliedToRuntime: boolean;
  timestamp: string;
}
