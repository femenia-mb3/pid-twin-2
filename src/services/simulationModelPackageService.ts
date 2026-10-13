import crypto from 'node:crypto';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { 
  SimulationModelPackageV1, 
  PackageValidationResult, 
  ModelLifecycleState, 
  ModelPackageHumanDecision 
} from '../types/simulationModelPackage';
import { postgisRepository } from './postgisRepository';
import packageSchema from '../../schemas/simulation-model-package-v1.schema.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(packageSchema);

export class SimulationModelPackageService {
  /**
   * Analiza un archivo cargado en formato JSON o YAML, valida su estructura contra
   * el esquema SimulationModelPackage v1 y devuelve el resultado normalizado.
   */
  public static parseAndValidate(rawContent: string): PackageValidationResult {
    const fingerprintSha256 = crypto.createHash('sha256').update(rawContent).digest('hex');
    let parsed: any = null;

    try {
      const trimmed = rawContent.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        parsed = JSON.parse(trimmed);
      } else {
        parsed = YAML.parse(trimmed);
      }
    } catch (err: any) {
      return {
        valid: false,
        errors: [`Error sintáctico al procesar el archivo: ${err.message}`],
        warnings: [],
        fingerprintSha256
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        errors: ['El contenido del paquete debe ser un objeto declarativo válido.'],
        warnings: [],
        fingerprintSha256
      };
    }

    // Inyectar o asegurar huella calculada
    if (!parsed.evidence) parsed.evidence = {};
    parsed.evidence.packageFingerprintSha256 = fingerprintSha256;

    const isValidSchema = validateSchema(parsed);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isValidSchema && validateSchema.errors) {
      validateSchema.errors.forEach(err => {
        const path = err.instancePath ? ` en ${err.instancePath}` : '';
        errors.push(`Violación de esquema${path}: ${err.message}`);
      });
    }

    // Validaciones semánticas adicionales de seguridad declarativa
    if (parsed.declarativeRules && Array.isArray(parsed.declarativeRules)) {
      parsed.declarativeRules.forEach((rule: any, idx: number) => {
        if (rule.value === undefined || Number.isNaN(Number(rule.value))) {
          errors.push(`Regla declarativa ${idx + 1} (${rule.ruleId || 'sin_id'}): el valor debe ser numérico.`);
        }
      });
    }

    if (errors.length > 0) {
      return {
        valid: false,
        packageId: parsed.id,
        errors,
        warnings,
        fingerprintSha256
      };
    }

    return {
      valid: true,
      packageId: parsed.id,
      errors: [],
      warnings,
      normalizedPackage: parsed as SimulationModelPackageV1,
      fingerprintSha256
    };
  }

  /**
   * Guarda o actualiza un paquete de modelo en PostGIS bajo el tenant y destino del operador.
   */
  public static async persistPackage(
    pkg: SimulationModelPackageV1,
    tenantId: string,
    operatorName: string
  ): Promise<{ success: boolean; packageId: string; version: string; error?: string }> {
    try {
      const result = await postgisRepository.saveModelPackage(pkg, tenantId, operatorName);
      return { success: result, packageId: pkg.id, version: pkg.version };
    } catch (err: any) {
      return { success: false, packageId: pkg.id, version: pkg.version, error: err.message };
    }
  }

  /**
   * Registra una decisión humana sobre el paquete (aprobar validación o publicar reutilizable).
   */
  public static async recordHumanDecision(
    decision: ModelPackageHumanDecision
  ): Promise<{ success: boolean; nextState?: ModelLifecycleState; error?: string }> {
    try {
      const recorded = await postgisRepository.recordModelPackageDecision(decision);
      if (!recorded) return { success: false, error: 'No se pudo registrar la decisión en auditoría PostGIS.' };

      let nextState: ModelLifecycleState = 'BORRADOR';
      if (decision.decision === 'APROBAR_VALIDADO') nextState = 'VALIDADO';
      else if (decision.decision === 'PUBLICAR_REUTILIZABLE') nextState = 'PUBLICADO_REUTILIZABLE';
      else if (decision.decision === 'ARCHIVAR') nextState = 'ARCHIVADO';
      else nextState = 'BORRADOR';

      const updated = await postgisRepository.updateModelPackageState(decision.packageId, decision.version, decision.tenantId, decision.destinationId, nextState);
      if (!updated) return { success: false, error: 'No se pudo actualizar el estado del paquete en PostGIS.' };
      return { success: true, nextState };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
