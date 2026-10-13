import { 
  ModelDataBinding, 
  ModelExecutionReadiness 
} from '../types/operationalConfiguration';
import { InteroperabilityCatalogService } from './interoperabilityCatalogService';
import { postgisRepository } from './postgisRepository';

export class DataBindingService {
  /**
   * Crea o actualiza un vínculo entre una variable de modelo y un conector/campo de dataset.
   */
  public static async createOrUpdateBinding(
    binding: Omit<ModelDataBinding, 'id' | 'configuredAt'>,
    configuredBy: string
  ): Promise<{ valid: boolean; binding?: ModelDataBinding; errors: string[] }> {
    const errors: string[] = [];

    if (!binding.modelId || !binding.modelVariableId) {
      errors.push('Debe especificar el modelo y la variable de destino.');
    }

    if (!binding.connectorId) {
      errors.push('Debe asociar un conector operativo válido.');
    }

    if (!binding.sourceField) {
      errors.push('Debe especificar el campo de origen del conector.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const now = new Date().toISOString();
    const id = `bind_${binding.destinationId}_${binding.modelId}_${binding.modelVariableId}`;

    const completeBinding: ModelDataBinding = {
      ...binding,
      id,
      configuredBy,
      configuredAt: now,
      active: true
    };

    const saved = await postgisRepository.saveDataBinding(completeBinding);
    if (!saved) {
      return { valid: false, errors: ['Error persistiendo el vínculo en PostGIS.'] };
    }

    return { valid: true, binding: completeBinding, errors: [] };
  }

  /**
   * Evalúa si un modelo cuenta con todos los vínculos requeridos para poder ejecutarse
   * de forma fiable y auditable en un destino concreto.
   */
  public static async evaluateModelReadiness(
    modelId: string,
    tenantId: string,
    destinationId: string
  ): Promise<ModelExecutionReadiness> {
    const model = InteroperabilityCatalogService.getModel(modelId);
    const modelTitle = model ? model.title : modelId;
    const requiredVariables = model ? model.variables.filter(v => v.required !== false) : [];
    const bindings = await postgisRepository.listDataBindingsByModel(tenantId, destinationId, modelId);

    const bindingMap = new Map<string, ModelDataBinding>();
    bindings.forEach(b => {
      if (b.active) bindingMap.set(b.modelVariableId, b);
    });

    const blockingIssues: ModelExecutionReadiness['blockingIssues'] = [];
    let satisfiedCount = 0;

    requiredVariables.forEach(v => {
      const b = bindingMap.get(v.id);
      if (!b) {
        blockingIssues.push({
          code: 'MISSING_MANDATORY_VARIABLE',
          variableId: v.id,
          message: `Variable obligatoria «${v.label}» (${v.id}) sin fuente o conector asignado.`
        });
      } else if (b.connectorStatus === 'PENDIENTE_CREDENCIALES') {
        blockingIssues.push({
          code: 'CONNECTOR_UNAUTHORIZED',
          variableId: v.id,
          message: `El conector «${b.connectorName}» asignado a «${v.label}» está pendiente de credenciales/autorización.`
        });
      } else if (b.availability === 'INCOMPATIBLE') {
        blockingIssues.push({
          code: 'QUALITY_BELOW_MINIMUM',
          variableId: v.id,
          message: `La fuente para «${v.label}» no cumple el umbral mínimo de calidad de datos requerido.`
        });
      } else {
        satisfiedCount++;
      }
    });

    const isReadyToExecute = requiredVariables.length > 0 && blockingIssues.length === 0;

    return {
      modelId,
      modelTitle,
      destinationId,
      isReadyToExecute,
      totalRequiredVariables: requiredVariables.length,
      satisfiedRequiredVariables: satisfiedCount,
      bindings,
      blockingIssues,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Lista todos los vínculos configurados para un destino.
   */
  public static async listBindings(tenantId: string, destinationId: string): Promise<ModelDataBinding[]> {
    return await postgisRepository.listDataBindings(tenantId, destinationId);
  }
}
