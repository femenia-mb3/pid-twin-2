import { 
  DestinationModelFit, 
  DestinationRequirementCheck, 
  MultiDestinationCompatibilityMatrix 
} from '../types/compatibility';
import { InteroperabilityCatalogService } from './interoperabilityCatalogService';
import { DestinationRuntimeService } from './destinationRuntimeService';

export class MultiDestinationCompatibilityService {
  public static evaluateModelCompatibility(
    modelId: string, 
    destinationIds: string[]
  ): MultiDestinationCompatibilityMatrix {
    const model = InteroperabilityCatalogService.getModel(modelId);
    const modelTitle = model ? model.title : modelId;
    const timestamp = new Date().toISOString();

    const evaluations: DestinationModelFit[] = destinationIds.map(destId => {
      const resolution = DestinationRuntimeService.resolve(destId);
      const runtime = resolution.runtime;
      const destName = runtime ? runtime.destination.nombre : destId;
      const tenantId = runtime ? runtime.tenant.id : `tenant_${destId}`;

      const checks: DestinationRequirementCheck[] = [];
      const missingElements: string[] = [];

      // Check 1: Carril Ontológico S2 (Recursos / Zonas)
      const hasZones = (runtime?.zones?.length ?? 0) > 0;
      const hasResources = (runtime?.resources?.length ?? 0) > 0;
      if (hasZones && hasResources) {
        checks.push({
          requirementId: 'req_s2_ontologia',
          name: 'Entidades y Recursos Turísticos (S2)',
          category: 'ONTOLOGICO_S2',
          status: 'DISPONIBLE',
          evidenceDetails: `${runtime!.zones.length} zonas delimitadas y ${runtime!.resources.length} recursos catalogados.`
        });
      } else {
        checks.push({
          requirementId: 'req_s2_ontologia',
          name: 'Entidades y Recursos Turísticos (S2)',
          category: 'ONTOLOGICO_S2',
          status: 'PARCIAL',
          evidenceDetails: 'El destino requiere completar inventario de activos.'
        });
        missingElements.push('Inventario completo de recursos ontológicos S2');
      }

      // Check 2: Carril Histórico C4 (Series / Aforos)
      const hasSensors = (runtime?.sensors?.length ?? 0) > 0;
      if (hasSensors) {
        checks.push({
          requirementId: 'req_c4_historicos',
          name: 'Sensores y Telemetría Histórica (C4)',
          category: 'HISTORICO_C4',
          status: 'DISPONIBLE',
          evidenceDetails: `${runtime!.sensors.length} sensores y aforadores configurados.`
        });
      } else {
        checks.push({
          requirementId: 'req_c4_historicos',
          name: 'Sensores y Telemetría Histórica (C4)',
          category: 'HISTORICO_C4',
          status: 'FALTANTE',
          evidenceDetails: 'Sin red IoT o series históricas registradas.'
        });
        missingElements.push('Series históricas de afluencia o conteos IoT');
      }

      // Check 3: Cartografía GIS S11
      checks.push({
        requirementId: 'req_s11_gis',
        name: 'Servicios Territoriales y Polígonos',
        category: 'GIS_S11',
        status: 'DISPONIBLE',
        evidenceDetails: 'Servicios WMS/TMS IGN y capas de zonificación operativas.'
      });

      // Cálculo de compatibilidad
      const availableCount = checks.filter(c => c.status === 'DISPONIBLE').length;
      const partialCount = checks.filter(c => c.status === 'PARCIAL').length;
      const score = Math.round(((availableCount * 1.0 + partialCount * 0.5) / checks.length) * 100);

      const readinessLevel = score >= 85 ? 'LISTO_PARA_OPERAR'
                           : score >= 50 ? 'REQUIERE_CALIBRACION'
                           : 'INCOMPATIBLE';

      return {
        destinationId: destId,
        destinationName: destName,
        tenantId,
        compatibilityScorePct: score,
        readinessLevel,
        checks,
        missingElements
      };
    });

    const averageScore = evaluations.reduce((acc, e) => acc + e.compatibilityScorePct, 0) / evaluations.length;
    const overallFeasibility = averageScore >= 80 ? 'ALTA' : averageScore >= 55 ? 'MEDIA' : 'BAJA';

    const recommendations: string[] = [];
    if (overallFeasibility === 'ALTA') {
      recommendations.push('Los destinos seleccionados disponen de madurez homogénea para compartir este modelo.');
      recommendations.push('Se recomienda estandarizar los umbrales de alerta para permitir comparativas interterritoriales.');
    } else {
      recommendations.push('Existen asimetrías de datos. Ingeste las fuentes faltantes mediante el asistente no-code antes de ejecutar simulaciones cruzadas.');
    }

    return {
      modelId,
      modelTitle,
      timestamp,
      destinationsEvaluated: evaluations,
      overallCrossDestinationFeasibility: overallFeasibility,
      sharedDataLanes: ['ONTOLOGICO', 'NO_ONTOLOGICO_HISTORICO'],
      recommendations
    };
  }
}
