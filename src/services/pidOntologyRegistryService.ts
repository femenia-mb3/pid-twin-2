import crypto from 'node:crypto';
import { PidOntologyRegistryRecord } from '../types/semanticIngestion';
import { postgisRepository } from './postgisRepository';

export const OFFICIAL_PID_CORE_ONTOLOGY: PidOntologyRegistryRecord = {
  id: 'ont_segittur_core_v1',
  iri: 'https://ontologia.segittur.es/turismo/def/core#',
  version: '1.0.0',
  title: 'Modelo Conceptual de Referencia para el Sector Turístico - SEGITTUR',
  provenance: 'Ontology created by SEGITTUR, with contributions from OEG-UPM, Gnoss and Globaldit (Widoco/LODE 2025-08-25)',
  creator: 'SEGITTUR (Sociedad Mercantil Estatal para la Gestión de la Innovación y las Tecnologías Turísticas)',
  license: 'CC-BY-4.0',
  documentationUrl: 'https://ontologia.segittur.es/turismo/def/core/',
  contextUrl: '/ontology/segittur-pid-context-v1.jsonld',
  fingerprintSha256: '9f81a7d65b1239c0fa48f8a2ef0442436d4076383e4c41490212a439281a8c3d',
  approved: true,
  reviewedAt: '2026-10-09T08:00:00.000Z'
};

export class PidOntologyRegistryService {
  public static async listApprovedOntologies(): Promise<PidOntologyRegistryRecord[]> {
    const fromDb = await postgisRepository.listApprovedOntologies();
    if (fromDb.length > 0) return fromDb;
    return [OFFICIAL_PID_CORE_ONTOLOGY];
  }

  public static async getOntologyByIri(iri: string): Promise<PidOntologyRegistryRecord | null> {
    const ontologies = await this.listApprovedOntologies();
    return ontologies.find(o => o.iri === iri || o.id === iri) || null;
  }

  public static computeContextFingerprint(contextPayload: string | Record<string, unknown>): string {
    const str = typeof contextPayload === 'string' ? contextPayload : JSON.stringify(contextPayload);
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
