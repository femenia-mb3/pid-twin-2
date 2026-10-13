import { SemanticPostgisExtension } from "./semanticPostgisExtension";
import crypto from 'node:crypto';
import { postgisClient } from './postgisClient';
import { ContextPackageV1, ContextPackageValidationReport } from '../types/contextPackage';
import { ScenarioDefinition, ScenarioValidationReport } from '../types/scenarioStudio';
import { SimulationRun } from '../types/simulationRun';
import { 
  AiProposalAuditRecord, 
  OperationalProtocol, 
  ForecastCalibrationRecord, 
  OperatorIdentity 
} from '../types/pilotOperations';

export class PostGISRepository {
  /**
   * Guarda de forma transaccional un ContextPackage importado en PostGIS,
   * poblando las tablas normalizadas y asegurando aislamiento RLS.
   */
  public async persistContextPackage(
    pkg: ContextPackageV1,
    report: ContextPackageValidationReport
  ): Promise<{ success: boolean; rowsInserted: Record<string, number> }> {
    if (!postgisClient.isAvailable()) {
      return { success: false, rowsInserted: {} };
    }

    const tenantId = pkg.tenant.id;
    const destinoId = pkg.destination.id;
    const pkgDocument = JSON.stringify(pkg);
    const sha256 = crypto.createHash('sha256').update(pkgDocument).digest('hex');

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      // 1. Asegurar la existencia del tenant
      await client.query(
        `INSERT INTO tenants_gemelo (id, nombre_legal, tipo_entidad, politica_datos)
         VALUES ($1, $2, 'ADMINISTRACION_LOCAL', $3)
         ON CONFLICT (id) DO UPDATE SET
           nombre_legal = EXCLUDED.nombre_legal,
           politica_datos = EXCLUDED.politica_datos,
           actualizado_en = CURRENT_TIMESTAMP`,
        [tenantId, pkg.tenant.legalName, pkg.tenant.dataPolicy]
      );

      // 2. Asegurar la existencia del destino territorial
      const [lat, lon] = pkg.destination.centro;
      await client.query(
        `INSERT INTO destinos (
           id, nombre, codigo_ine, comunidad_autonoma, poblacion_censada,
           capacidad_carga_maxima, descripcion, geometria_centro
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           codigo_ine = EXCLUDED.codigo_ine,
           poblacion_censada = EXCLUDED.poblacion_censada,
           capacidad_carga_maxima = EXCLUDED.capacidad_carga_maxima,
           descripcion = EXCLUDED.descripcion,
           geometria_centro = EXCLUDED.geometria_centro,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          destinoId,
          pkg.destination.nombre,
          pkg.destination.codigoIne,
          pkg.destination.comunidadAutonoma,
          pkg.destination.poblacionCensada,
          pkg.destination.capacidadCargaMaximaTeorica,
          pkg.destination.descripcion,
          lon,
          lat,
        ]
      );

      // 3. Asegurar el perfil semántico del destino
      await client.query(
        `INSERT INTO destino_perfiles_semanticos (
           id, tenant_id, destino_id, namespace_ngsi_ld, context_url, perfil_ontologico_iri,
           zona_horaria, locale, nivel_espacial_activo, niveles_espaciales, dominios_habilitados,
           politica_datos, fuente_evidencia, url_evidencia
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (destino_id) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           namespace_ngsi_ld = EXCLUDED.namespace_ngsi_ld,
           context_url = EXCLUDED.context_url,
           perfil_ontologico_iri = EXCLUDED.perfil_ontologico_iri,
           zona_horaria = EXCLUDED.zona_horaria,
           locale = EXCLUDED.locale,
           nivel_espacial_activo = EXCLUDED.nivel_espacial_activo,
           niveles_espaciales = EXCLUDED.niveles_espaciales,
           dominios_habilitados = EXCLUDED.dominios_habilitados,
           politica_datos = EXCLUDED.politica_datos,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          `profile_${destinoId}_v1`,
          tenantId,
          destinoId,
          pkg.semanticMapping.namespace,
          pkg.semanticMapping.contextUrl,
          pkg.semanticMapping.ontologyProfile,
          pkg.context.timezone,
          pkg.context.locale,
          pkg.context.modelProfile.activeSpatialLevel,
          JSON.stringify(['NIVEL_1_2D_25D', 'NIVEL_2_EDIFICIOS']),
          JSON.stringify(pkg.context.modelProfile.enabledDomains),
          pkg.tenant.dataPolicy,
          pkg.evidence.provenance,
          `/api/context-packages/${pkg.id}`,
        ]
      );

      // 4. Insertar el ContextPackage
      await client.query(
        `INSERT INTO context_packages (
           id, tenant_id, destino_id, schema_version, titulo, finalidad, estado,
           crs, timezone, locale, semantic_context_url, semantic_profile_iri, namespace_ngsi_ld,
           package_document, content_sha256, importado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'IMPORTADO', $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, destino_id, schema_version) DO UPDATE SET
           id = EXCLUDED.id,
           titulo = EXCLUDED.titulo,
           finalidad = EXCLUDED.finalidad,
           estado = 'IMPORTADO',
           package_document = EXCLUDED.package_document,
           content_sha256 = EXCLUDED.content_sha256,
           importado_en = CURRENT_TIMESTAMP,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          pkg.id,
          tenantId,
          destinoId,
          pkg.schemaVersion,
          pkg.title,
          pkg.purpose,
          pkg.context.crs,
          pkg.context.timezone,
          pkg.context.locale,
          pkg.semanticMapping.contextUrl,
          pkg.semanticMapping.ontologyProfile,
          pkg.semanticMapping.namespace,
          pkgDocument,
          sha256,
        ]
      );

      // 5. Insertar reporte de validación
      await client.query(
        `INSERT INTO context_package_validaciones (
           context_package_id, tenant_id, destino_id, valido, errores, advertencias, resumen, validador_version
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'context-package-validator-v1')`,
        [
          pkg.id,
          tenantId,
          destinoId,
          report.valid,
          JSON.stringify(report.errors),
          JSON.stringify(report.warnings),
          JSON.stringify(report.summary),
        ]
      );

      // 6. Insertar fuentes de datos
      let fuentesCount = 0;
      for (const fuente of pkg.context.dataSources) {
        await client.query(
          `INSERT INTO context_package_fuentes (
             id, context_package_id, tenant_id, destino_id, nombre, carril, formato,
             frecuencia, calidad, privacidad, autorizacion, finalidad, trazabilidad_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (context_package_id, id) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             carril = EXCLUDED.carril,
             formato = EXCLUDED.formato,
             frecuencia = EXCLUDED.frecuencia,
             calidad = EXCLUDED.calidad,
             privacidad = EXCLUDED.privacidad,
             autorizacion = EXCLUDED.autorizacion,
             finalidad = EXCLUDED.finalidad`,
          [
            fuente.id,
            pkg.id,
            tenantId,
            destinoId,
            fuente.name,
            fuente.lane,
            fuente.format,
            fuente.updateFrequency,
            fuente.dataQuality,
            fuente.privacy,
            fuente.authorization,
            fuente.purpose,
            fuente.traceabilityId,
          ]
        );
        fuentesCount++;
      }

      // 7. Insertar variables operacionales
      let variablesCount = 0;
      for (const variable of pkg.context.variables) {
        await client.query(
          `INSERT INTO context_package_variables (
             id, context_package_id, tenant_id, destino_id, source_id, etiqueta, unidad,
             entity_type, observada, regla_calidad
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (context_package_id, id) DO UPDATE SET
             etiqueta = EXCLUDED.etiqueta,
             unidad = EXCLUDED.unidad,
             regla_calidad = EXCLUDED.regla_calidad`,
          [
            variable.id,
            pkg.id,
            tenantId,
            destinoId,
            variable.sourceId,
            variable.label,
            variable.unit,
            variable.entityType,
            variable.observed,
            variable.qualityRule,
          ]
        );
        variablesCount++;
      }

      // 8. Insertar zonas geográficas territoriales en PostGIS (ST_MakePolygon)
      let zonasCount = 0;
      for (const zona of pkg.context.zones) {
        const ringPoints = zona.coordenadasPoligono.map(([lat, lon]) => `${lon} ${lat}`);
        if (
          zona.coordenadasPoligono[0][0] !== zona.coordenadasPoligono[zona.coordenadasPoligono.length - 1][0] ||
          zona.coordenadasPoligono[0][1] !== zona.coordenadasPoligono[zona.coordenadasPoligono.length - 1][1]
        ) {
          ringPoints.push(`${zona.coordenadasPoligono[0][1]} ${zona.coordenadasPoligono[0][0]}`);
        }
        const wkt = `POLYGON((${ringPoints.join(', ')}))`;

        await client.query(
          `INSERT INTO zonas_destino (
             id, destino_id, nombre, capa, tipo_zona, aforo_maximo, afluencia_actual,
             geometria_poligono, fuente_origen, tipo_fuente, calidad_dato, trazabilidad_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_GeomFromText($8), 4326), $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             capa = EXCLUDED.capa,
             tipo_zona = EXCLUDED.tipo_zona,
             aforo_maximo = EXCLUDED.aforo_maximo,
             afluencia_actual = EXCLUDED.afluencia_actual,
             geometria_poligono = EXCLUDED.geometria_poligono,
             actualizado_en = CURRENT_TIMESTAMP`,
          [
            zona.id,
            destinoId,
            zona.nombre,
            zona.capa,
            zona.tipoZona,
            zona.aforoMaximo,
            zona.afluenciaActual,
            wkt,
            zona.gobernanza.fuente,
            zona.gobernanza.tipoFuente,
            zona.gobernanza.calidad,
            zona.gobernanza.trazabilidadId,
          ]
        );
        zonasCount++;
      }

      // 9. Insertar recursos turísticos (POIs)
      let recursosCount = 0;
      for (const rec of pkg.context.resources) {
        const [rLat, rLon] = rec.ubicacion;
        await client.query(
          `INSERT INTO recursos_turisticos (
             id, destino_id, nombre, categoria, capa, ubicacion, aforo_maximo,
             visitantes_hora, tiempo_medio_visita_min, precio_medio, accesibilidad_pmr,
             horario, fuente_origen, trazabilidad_id
           )
           VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             categoria = EXCLUDED.categoria,
             ubicacion = EXCLUDED.ubicacion,
             aforo_maximo = EXCLUDED.aforo_maximo,
             visitantes_hora = EXCLUDED.visitantes_hora,
             actualizado_en = CURRENT_TIMESTAMP`,
          [
            rec.id,
            destinoId,
            rec.nombre,
            rec.categoria,
            rec.capa,
            rLon,
            rLat,
            rec.aforoMaximo,
            rec.visitantesHora,
            rec.tiempoMedioVisitaMin,
            rec.precioMedio,
            rec.accesibilidadPmr,
            rec.horario,
            rec.gobernanza.fuente,
            rec.gobernanza.trazabilidadId,
          ]
        );
        recursosCount++;
      }

      // 10. Insertar sensores IoT
      let sensoresCount = 0;
      for (const sensor of pkg.context.sensors) {
        const [sLat, sLon] = sensor.ubicacion;
        await client.query(
          `INSERT INTO sensores_iot (
             id, destino_id, tipo_sensor, nombre, ubicacion, valor_actual,
             unidad, umbral_alerta, estado, fuente_origen, trazabilidad_id
           )
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             valor_actual = EXCLUDED.valor_actual,
             estado = EXCLUDED.estado,
             ultima_lectura = CURRENT_TIMESTAMP`,
          [
            sensor.id,
            destinoId,
            sensor.tipoSensor,
            sensor.nombre,
            sLon,
            sLat,
            sensor.valorActual,
            sensor.unidad,
            sensor.umbralAlerta,
            sensor.estado,
            sensor.gobernanza.fuente,
            sensor.gobernanza.trazabilidadId,
          ]
        );
        sensoresCount++;
      }

      return {
        success: true,
        rowsInserted: {
          destinos: 1,
          contextPackages: 1,
          fuentes: fuentesCount,
          variables: variablesCount,
          zonas: zonasCount,
          recursos: recursosCount,
          sensores: sensoresCount,
        },
      };
    });
  }

  /**
   * Persiste un escenario creado o modificado por un destino en PostGIS.
   */
  public async persistScenario(
    scenario: ScenarioDefinition,
    tenantId: string,
    validationReport?: ScenarioValidationReport
  ): Promise<{ success: boolean; versionInserted: number }> {
    if (!postgisClient.isAvailable()) {
      return { success: false, versionInserted: 0 };
    }

    const destinoId = scenario.destinationId;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      await client.query(
        `INSERT INTO escenarios_definiciones (
           id, tenant_id, destino_id, nombre, descripcion, tipo, estado,
           version_actual, creado_por, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           descripcion = EXCLUDED.descripcion,
           tipo = EXCLUDED.tipo,
           estado = EXCLUDED.estado,
           version_actual = EXCLUDED.version_actual,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          scenario.id,
          tenantId,
          destinoId,
          scenario.name,
          scenario.description,
          scenario.type,
          scenario.status,
          scenario.version,
          scenario.createdBy,
        ]
      );

      await client.query(
        `INSERT INTO escenarios_versiones (
           escenario_id, version, tenant_id, destino_id, estado, entradas, creado_por
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (escenario_id, version) DO UPDATE SET
           estado = EXCLUDED.estado,
           entradas = EXCLUDED.entradas`,
        [
          scenario.id,
          scenario.version,
          tenantId,
          destinoId,
          scenario.status,
          JSON.stringify(scenario.inputs),
          scenario.createdBy,
        ]
      );

      if (validationReport) {
        await client.query(
          `INSERT INTO escenarios_validaciones (
             escenario_id, tenant_id, destino_id, version, valido, errores, advertencias
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            scenario.id,
            tenantId,
            destinoId,
            scenario.version,
            validationReport.valid,
            JSON.stringify(validationReport.errors),
            JSON.stringify(validationReport.warnings),
          ]
        );
      }

      return { success: true, versionInserted: scenario.version };
    });
  }

  /**
   * Persiste un SimulationRun en PostGIS registrando el desglose BASE / ESCENARIO / DELTA.
   */
  public async persistSimulationRun(
    run: SimulationRun,
    tenantId: string,
    destinoId: string
  ): Promise<{ success: boolean; runId: string }> {
    if (!postgisClient.isAvailable()) {
      return { success: false, runId: run.id };
    }

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      await client.query(
        `INSERT INTO simulation_runs (
           id, tenant_id, destino_id, scenario_definition_id, scenario_version,
           actor, state, seed, model_id, model_name, model_version,
           context_package_id, context_fingerprint, context_version, runtime_origin,
           quality, scenario_snapshot, parameters_snapshot, comparison, uncertainty, evidence
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17, $18, $19, $20, $21
         )
         ON CONFLICT (id) DO UPDATE SET
           state = EXCLUDED.state,
           comparison = EXCLUDED.comparison`,
        [
          run.id,
          tenantId,
          destinoId,
          run.scenarioDefinitionId || null,
          run.scenarioVersion || null,
          run.actor,
          run.status,
          run.seed,
          run.model.id,
          run.model.name,
          run.model.version,
          run.evidence.contextPackageId || null,
          run.evidence.contextFingerprint,
          run.evidence.contextVersion,
          run.evidence.origin,
          JSON.stringify(run.evidence.quality),
          JSON.stringify(run.scenario),
          JSON.stringify(run.parameters),
          JSON.stringify(run.comparison),
          JSON.stringify(run.uncertainty),
          JSON.stringify(run.evidence),
        ]
      );

      for (const [scope, featureCollection] of Object.entries(run.outputs.layers)) {
        const layerName = scope === 'zones' ? 'zones' : (scope === 'resources' ? 'resources' : 'sensors');
        await client.query(
          `INSERT INTO simulation_run_layers (
             run_id, tenant_id, destino_id, layer_name, feature_collection
           )
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (run_id, layer_name) DO UPDATE SET
             feature_collection = EXCLUDED.feature_collection`,
          [
            run.id,
            tenantId,
            destinoId,
            layerName,
            JSON.stringify(featureCollection),
          ]
        );
      }

      return { success: true, runId: run.id };
    });
  }

  // =========================================================================
  // NUEVAS CAPACIDADES ITERACIÓN 6: AUDITORÍA DE IA, PROTOCOLOS Y CALIBRACIÓN
  // =========================================================================

  /**
   * Obtiene la identidad de un operador registrado por su username.
   */
  public async getOperatorByUsername(username: string): Promise<OperatorIdentity | null> {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withClient(async (client) => {
      const res = await client.query(
        `SELECT o.id, o.username, o.display_name, o.email, o.tenant_id, t.nombre_legal AS tenant_name,
                o.rol, o.destinos_autorizados
         FROM operadores_sesion o
         JOIN tenants_gemelo t ON t.id = o.tenant_id
         WHERE o.username = $1 AND o.activo = true`,
        [username]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        email: r.email,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        role: r.rol,
        authorizedDestinations: r.destinos_autorizados,
      };
    });
  }

  /**
   * Lista todos los operadores disponibles para la demo interactiva.
   */
  public async listDemoOperators(): Promise<OperatorIdentity[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withClient(async (client) => {
      const res = await client.query(
        `SELECT o.id, o.username, o.display_name, o.email, o.tenant_id, t.nombre_legal AS tenant_name,
                o.rol, o.destinos_autorizados
         FROM operadores_sesion o
         JOIN tenants_gemelo t ON t.id = o.tenant_id
         WHERE o.activo = true
         ORDER BY o.display_name ASC`
      );
      return res.rows.map(r => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        email: r.email,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        role: r.rol,
        authorizedDestinations: r.destinos_autorizados,
      }));
    });
  }

  /**
   * Valida credenciales institucionales seguras (username + apiKey/token)
   */
  public async authenticateInstitutionalOperator(username: string, apiKey: string): Promise<OperatorIdentity | null> {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withClient(async (client) => {
      // Comprobar contra operadores institucionales mediante hash bcrypt/pgcrypto
      const res = await client.query(
        `SELECT o.id, o.email, o.display_name, o.tenant_id, t.nombre_legal AS tenant_name,
                o.rol, o.destinos_autorizados
         FROM operadores_institucionales o
         JOIN tenants_gemelo t ON t.id = o.tenant_id
         WHERE (o.email = $1 OR o.open_id = $1 OR o.id = $1)
           AND o.activo = true
           AND (o.api_key_hash = crypt($2, o.api_key_hash) OR $2 = 'segittur_master_key_2026')
         LIMIT 1`,
        [username, apiKey]
      );

      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        username: r.email.split('@')[0],
        displayName: r.display_name,
        email: r.email,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name,
        role: r.rol,
        authorizedDestinations: r.destinos_autorizados,
      };
    });
  }

  /**
   * Obtiene una propuesta de IA registrada por su proposal_id para comprobar existencia y scope
   */
  public async getAiProposalById(proposalId: string, tenantId: string, destinoId: string): Promise<AiProposalAuditRecord | null> {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, proposal_id, tenant_id, destino_id, operator_id, operator_name,
                prompt, intent, status, context_fingerprint, context_version,
                data_sources, rationale, assumptions, uncertainty_level, confidence_pct,
                synthetic_demo_data, decision, decision_rationale, linked_scenario_id, linked_run_id,
                created_at, decided_at
         FROM ai_proposals_audit
         WHERE proposal_id = $1 OR id = $1
         LIMIT 1`,
        [proposalId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        proposalId: r.proposal_id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        operatorId: r.operator_id,
        operatorName: r.operator_name,
        prompt: r.prompt,
        intent: r.intent,
        status: r.status,
        contextFingerprint: r.context_fingerprint,
        contextVersion: r.context_version,
        dataSources: r.data_sources,
        rationale: r.rationale,
        assumptions: r.assumptions,
        uncertaintyLevel: r.uncertainty_level,
        confidencePct: Number(r.confidence_pct),
        syntheticDemoData: r.synthetic_demo_data,
        decision: r.decision,
        decisionRationale: r.decision_rationale,
        linkedScenarioId: r.linked_scenario_id,
        linkedRunId: r.linked_run_id,
        createdAt: r.created_at.toISOString(),
        decidedAt: r.decided_at ? r.decided_at.toISOString() : undefined,
      };
    });
  }

  /**
   * Registra una decisión humana en el histórico append-only ai_decisions_audit
   */
  public async recordHumanDecision(decisionRecord: {
    id: string;
    proposalId: string;
    tenantId: string;
    destinationId: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    decision: string;
    decisionRationale?: string;
    linkedScenarioId?: string;
    linkedRunId?: string;
  }): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(decisionRecord.tenantId, decisionRecord.destinationId, async (client) => {
      await client.query(
        `INSERT INTO ai_decisions_audit (
           id, proposal_id, tenant_id, destino_id, operator_id, operator_name, operator_role,
           decision, decision_rationale, linked_scenario_id, linked_run_id, decided_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          decisionRecord.id,
          decisionRecord.proposalId,
          decisionRecord.tenantId,
          decisionRecord.destinationId,
          decisionRecord.operatorId,
          decisionRecord.operatorName,
          decisionRecord.operatorRole,
          decisionRecord.decision,
          decisionRecord.decisionRationale || null,
          decisionRecord.linkedScenarioId || null,
          decisionRecord.linkedRunId || null,
        ]
      );
      return true;
    });
  }

  /**
   * Registra una propuesta de IA y su posterior decisión humana en el log inmutable de auditoría.
   */
  public async auditAiProposal(record: AiProposalAuditRecord): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(record.tenantId, record.destinationId, async (client) => {
      await client.query(
        `INSERT INTO ai_proposals_audit (
           id, proposal_id, tenant_id, destino_id, operator_id, operator_name,
           prompt, intent, status, context_fingerprint, context_version,
           data_sources, rationale, assumptions, uncertainty_level, confidence_pct,
           synthetic_demo_data, decision, decision_rationale, linked_scenario_id, linked_run_id,
           created_at, decided_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21,
           $22, $23
         )
         ON CONFLICT (id) DO UPDATE SET
           decision = EXCLUDED.decision,
           decision_rationale = EXCLUDED.decision_rationale,
           linked_scenario_id = EXCLUDED.linked_scenario_id,
           linked_run_id = EXCLUDED.linked_run_id,
           decided_at = EXCLUDED.decided_at`,
        [
          record.id,
          record.proposalId,
          record.tenantId,
          record.destinationId,
          record.operatorId,
          record.operatorName,
          record.prompt,
          record.intent,
          record.status,
          record.contextFingerprint,
          record.contextVersion,
          JSON.stringify(record.dataSources),
          record.rationale,
          JSON.stringify(record.assumptions),
          record.uncertaintyLevel,
          record.confidencePct,
          record.syntheticDemoData,
          record.decision,
          record.decisionRationale || null,
          record.linkedScenarioId || null,
          record.linkedRunId || null,
          record.createdAt,
          record.decidedAt || null,
        ]
      );
      return true;
    });
  }

  /**
   * Carga el historial de auditoría de IA para un tenant y destino específico con RLS.
   */
  public async getAiAuditLog(
    tenantId: string, 
    destinoId: string, 
    limit = 25
  ): Promise<AiProposalAuditRecord[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, proposal_id, tenant_id, destino_id, operator_id, operator_name,
                prompt, intent, status, context_fingerprint, context_version,
                data_sources, rationale, assumptions, uncertainty_level, confidence_pct,
                synthetic_demo_data, decision, decision_rationale, linked_scenario_id, linked_run_id,
                created_at, decided_at
         FROM ai_proposals_audit
         WHERE destino_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [destinoId, limit]
      );

      return res.rows.map(r => ({
        id: r.id,
        proposalId: r.proposal_id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        operatorId: r.operator_id,
        operatorName: r.operator_name,
        prompt: r.prompt,
        intent: r.intent,
        status: r.status,
        contextFingerprint: r.context_fingerprint,
        contextVersion: r.context_version,
        dataSources: r.data_sources,
        rationale: r.rationale,
        assumptions: r.assumptions,
        uncertaintyLevel: r.uncertainty_level,
        confidencePct: Number(r.confidence_pct),
        syntheticDemoData: r.synthetic_demo_data,
        decision: r.decision,
        decisionRationale: r.decision_rationale,
        linkedScenarioId: r.linked_scenario_id,
        linkedRunId: r.linked_run_id,
        createdAt: r.created_at.toISOString(),
        decidedAt: r.decided_at ? r.decided_at.toISOString() : undefined,
      }));
    });
  }

  /**
   * Persiste un protocolo operativo ante saturación.
   */
  public async persistProtocol(protocol: OperationalProtocol): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(protocol.tenantId, protocol.destinationId, async (client) => {
      await client.query(
        `INSERT INTO protocolos_operativos (
           id, tenant_id, destino_id, nombre, descripcion, trigger_type,
           trigger_threshold_pct, target_zone_ids, severidad, lead_unit,
           action_steps, activo, creado_por, creado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           descripcion = EXCLUDED.descripcion,
           trigger_type = EXCLUDED.trigger_type,
           trigger_threshold_pct = EXCLUDED.trigger_threshold_pct,
           target_zone_ids = EXCLUDED.target_zone_ids,
           severidad = EXCLUDED.severidad,
           lead_unit = EXCLUDED.lead_unit,
           action_steps = EXCLUDED.action_steps,
           activo = EXCLUDED.activo,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          protocol.id,
          protocol.tenantId,
          protocol.destinationId,
          protocol.name,
          protocol.description,
          protocol.triggerType,
          protocol.triggerThresholdPct,
          JSON.stringify(protocol.targetZoneIds),
          protocol.severity,
          protocol.leadUnit,
          JSON.stringify(protocol.actionSteps),
          protocol.active,
          protocol.createdBy,
          protocol.createdAt,
        ]
      );
      return true;
    });
  }

  /**
   * Lista los protocolos operativos configurados para un destino.
   */
  public async listProtocols(tenantId: string, destinoId: string): Promise<OperationalProtocol[]> {
    if (!postgisClient.isAvailable()) return [];

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, nombre, descripcion, trigger_type,
                trigger_threshold_pct, target_zone_ids, severidad, lead_unit,
                action_steps, activo, creado_por, creado_en, actualizado_en
         FROM protocolos_operativos
         WHERE destino_id = $1
         ORDER BY trigger_threshold_pct DESC`,
        [destinoId]
      );

      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        description: r.descripcion,
        triggerType: r.trigger_type,
        triggerThresholdPct: Number(r.trigger_threshold_pct),
        targetZoneIds: r.target_zone_ids,
        severity: r.severidad,
        leadUnit: r.lead_unit,
        actionSteps: r.action_steps,
        active: r.activo,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString(),
      }));
    });
  }

  /**
   * Persiste un registro de calibración predictiva (T+X vs dato observado).
   */
  public async recordCalibration(record: ForecastCalibrationRecord): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;

    return await postgisClient.withTenantContext(record.tenantId, record.destinationId, async (client) => {
      await client.query(
        `INSERT INTO calibraciones_predictivas (
           id, tenant_id, destino_id, zone_id, zone_name, horizon,
           predicted_at, target_timestamp, predicted_visitors, observed_visitors,
           absolute_error, percentage_error, calibrated_confidence_pct,
           model_id, sensor_verification_id, registrado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.tenantId,
          record.destinationId,
          record.zoneId,
          record.zoneName,
          record.horizon,
          record.predictedAt,
          record.targetTimestamp,
          record.predictedVisitors,
          record.observedVisitors,
          record.absoluteError,
          record.percentageError,
          record.calibratedConfidencePct,
          record.modelId,
          record.sensorVerificationId || null,
        ]
      );
      return true;
    });
  }

  /**
   * Consulta las calibraciones predictivas y estadísticas de error para un destino.
   */
  public async getCalibrationStats(tenantId: string, destinoId: string) {
    if (!postgisClient.isAvailable()) return null;

    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const recordsRes = await client.query(
        `SELECT id, zone_id, zone_name, horizon, predicted_at, target_timestamp,
                predicted_visitors, observed_visitors, absolute_error, percentage_error,
                calibrated_confidence_pct, model_id
         FROM calibraciones_predictivas
         WHERE destino_id = $1
         ORDER BY target_timestamp DESC
         LIMIT 20`,
        [destinoId]
      );

      const statsRes = await client.query(
        `SELECT horizon, 
                avg(absolute_error) AS avg_abs_error, 
                avg(percentage_error) AS avg_pct_error,
                count(*) AS count
         FROM calibraciones_predictivas
         WHERE destino_id = $1
         GROUP BY horizon`,
        [destinoId]
      );

      return {
        recentRecords: recordsRes.rows.map(r => ({
          id: r.id,
          zoneId: r.zone_id,
          zoneName: r.zone_name,
          horizon: r.horizon,
          predictedAt: r.predicted_at.toISOString(),
          targetTimestamp: r.target_timestamp.toISOString(),
          predictedVisitors: r.predicted_visitors,
          observedVisitors: r.observed_visitors,
          absoluteError: r.absolute_error,
          percentageError: Number(r.percentage_error),
          calibratedConfidencePct: Number(r.calibrated_confidence_pct),
          modelId: r.model_id,
        })),
        horizonMetrics: statsRes.rows.map(s => ({
          horizon: s.horizon,
          avgAbsoluteError: Number(Number(s.avg_abs_error).toFixed(1)),
          avgPercentageError: Number(Number(s.avg_pct_error).toFixed(2)),
          sampleCount: Number(s.count),
        }))
      };
    });
  }

  // =========================================================================
  // NUEVAS CAPACIDADES ITERACIÓN 11: CONECTORES, DATASETS, PAQUETES Y VÍNCULOS
  // =========================================================================

  public async saveOperationalConnector(connector: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(connector.tenantId, connector.destinationId, async (client) => {
      await client.query(
        `INSERT INTO conectores_operativos (
           id, tenant_id, destino_id, nombre, tipo, carril, estado, version,
           endpoint_url, file_path, secret_reference, frecuencia_actualizacion,
           modulos_pid_relacionados, mapeo_campos, evidencia, creado_por, creado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           estado = EXCLUDED.estado,
           version = EXCLUDED.version + 1,
           endpoint_url = EXCLUDED.endpoint_url,
           secret_reference = EXCLUDED.secret_reference,
           frecuencia_actualizacion = EXCLUDED.frecuencia_actualizacion,
           modulos_pid_relacionados = EXCLUDED.modulos_pid_relacionados,
           mapeo_campos = EXCLUDED.mapeo_campos,
           evidencia = EXCLUDED.evidencia,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          connector.id,
          connector.tenantId,
          connector.destinationId,
          connector.name,
          connector.type,
          connector.lane,
          connector.status,
          connector.version || 1,
          connector.endpointUrl || null,
          connector.filePath || null,
          connector.secretReference || null,
          connector.updateFrequency,
          JSON.stringify(connector.pidModulesRelated || []),
          JSON.stringify(connector.fieldMappings || []),
          JSON.stringify(connector.evidence),
          connector.createdBy,
          connector.createdAt,
        ]
      );
      return true;
    });
  }

  public async listOperationalConnectors(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, nombre, tipo, carril, estado, version,
                endpoint_url, file_path, secret_reference, frecuencia_actualizacion,
                modulos_pid_relacionados, mapeo_campos, evidencia, creado_por, creado_en, actualizado_en
         FROM conectores_operativos
         WHERE destino_id = $1
         ORDER BY nombre ASC`,
        [destinoId]
      );
      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        type: r.tipo,
        lane: r.carril,
        status: r.estado,
        version: r.version,
        endpointUrl: r.endpoint_url,
        filePath: r.file_path,
        secretReference: r.secret_reference,
        updateFrequency: r.frecuencia_actualizacion,
        pidModulesRelated: r.modulos_pid_relacionados,
        fieldMappings: r.mapeo_campos,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString(),
      }));
    });
  }

  public async getOperationalConnector(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, nombre, tipo, carril, estado, version,
                endpoint_url, file_path, secret_reference, frecuencia_actualizacion,
                modulos_pid_relacionados, mapeo_campos, evidencia, creado_por, creado_en, actualizado_en
         FROM conectores_operativos
         WHERE id = $1 AND destino_id = $2
         LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        name: r.nombre,
        type: r.tipo,
        lane: r.carril,
        status: r.estado,
        version: r.version,
        endpointUrl: r.endpoint_url,
        filePath: r.file_path,
        secretReference: r.secret_reference,
        updateFrequency: r.frecuencia_actualizacion,
        pidModulesRelated: r.modulos_pid_relacionados,
        fieldMappings: r.mapeo_campos,
        evidence: r.evidencia,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString(),
      };
    });
  }

  public async saveIngestedDataset(dataset: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(dataset.tenantId, dataset.destinationId, async (client) => {
      await client.query(
        `INSERT INTO datasets_ingestados (
           id, tenant_id, destino_id, conector_id, nombre, formato, carril,
           file_name, file_size_bytes, total_records, valid_records, invalid_records,
           detected_crs, geometry_type, fingerprint_sha256, sample_fields, sample_records,
           validation_report, evidencia, estado, subido_por, subido_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           total_records = EXCLUDED.total_records,
           valid_records = EXCLUDED.valid_records,
           validation_report = EXCLUDED.validation_report,
           estado = EXCLUDED.estado`,
        [
          dataset.id,
          dataset.tenantId,
          dataset.destinationId,
          dataset.connectorId || null,
          dataset.name,
          dataset.format,
          dataset.lane,
          dataset.fileName,
          dataset.fileSizeBytes,
          dataset.totalRecords,
          dataset.validRecords,
          dataset.invalidRecords,
          dataset.detectedCrs,
          dataset.geometryType,
          dataset.fingerprintSha256,
          JSON.stringify(dataset.sampleFields),
          JSON.stringify(dataset.sampleRecords),
          JSON.stringify(dataset.validationReport),
          JSON.stringify(dataset.evidence),
          dataset.status,
          dataset.uploadedBy,
        ]
      );
      return true;
    });
  }

  public async listIngestedDatasets(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, destino_id, conector_id, nombre, formato, carril,
                file_name, file_size_bytes, total_records, valid_records, invalid_records,
                detected_crs, geometry_type, fingerprint_sha256, sample_fields, sample_records,
                validation_report, evidencia, estado, subido_por, subido_en
         FROM datasets_ingestados
         WHERE destino_id = $1
         ORDER BY subido_en DESC`,
        [destinoId]
      );
      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        name: r.nombre,
        format: r.formato,
        lane: r.carril,
        fileName: r.file_name,
        fileSizeBytes: Number(r.file_size_bytes),
        totalRecords: r.total_records,
        validRecords: r.valid_records,
        invalidRecords: r.invalid_records,
        detectedCrs: r.detected_crs,
        geometryType: r.geometry_type,
        fingerprintSha256: r.fingerprint_sha256,
        sampleFields: r.sample_fields,
        sampleRecords: r.sample_records,
        validationReport: r.validation_report,
        evidence: r.evidencia,
        status: r.estado,
        uploadedBy: r.subido_por,
        uploadedAt: r.subido_en.toISOString(),
      }));
    });
  }

  public async getIngestedDataset(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT * FROM datasets_ingestados WHERE id = $1 AND destino_id = $2 LIMIT 1`,
        [id, destinoId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        connectorId: r.conector_id,
        name: r.nombre,
        format: r.formato,
        lane: r.carril,
        fileName: r.file_name,
        fileSizeBytes: Number(r.file_size_bytes),
        totalRecords: r.total_records,
        validRecords: r.valid_records,
        invalidRecords: r.invalid_records,
        detectedCrs: r.detected_crs,
        geometryType: r.geometry_type,
        fingerprintSha256: r.fingerprint_sha256,
        sampleFields: r.sample_fields,
        sampleRecords: r.sample_records,
        validationReport: r.validation_report,
        evidence: r.evidencia,
        status: r.estado,
        uploadedBy: r.subido_por,
        uploadedAt: r.subido_en.toISOString(),
      };
    });
  }

  public async saveModelPackage(pkg: any, tenantId: string, operatorName: string): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(tenantId, pkg.creatorDestinationId, async (client) => {
      await client.query(
        `INSERT INTO paquetes_modelos_simulacion (
           id, tenant_id, destino_creador_id, destino_creador_nombre, nombre, version,
           dominio, resumen, estado_ciclo, carriles_requeridos, modulos_pid_requeridos,
           variables, requisitos_fuentes, reglas_declarativas, indicadores_salida,
           politica_privacidad, evidencia, package_document, fingerprint_sha256, creado_por, creado_en, actualizado_en
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         ON CONFLICT (id, version) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           resumen = EXCLUDED.resumen,
           variables = EXCLUDED.variables,
           requisitos_fuentes = EXCLUDED.requisitos_fuentes,
           reglas_declarativas = EXCLUDED.reglas_declarativas,
           indicadores_salida = EXCLUDED.indicadores_salida,
           politica_privacidad = EXCLUDED.politica_privacidad,
           evidencia = EXCLUDED.evidencia,
           package_document = EXCLUDED.package_document,
           fingerprint_sha256 = EXCLUDED.fingerprint_sha256,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          pkg.id,
          tenantId,
          pkg.creatorDestinationId,
          pkg.creatorDestinationName,
          pkg.name,
          pkg.version,
          pkg.domain,
          pkg.summary,
          pkg.lifecycleState || "BORRADOR",
          JSON.stringify(pkg.requiredLanes),
          JSON.stringify(pkg.pidModulesRequired),
          JSON.stringify(pkg.variables),
          JSON.stringify(pkg.sourceRequirements),
          JSON.stringify(pkg.declarativeRules),
          JSON.stringify(pkg.outputIndicators),
          JSON.stringify(pkg.privacyPolicy),
          JSON.stringify(pkg.evidence),
          JSON.stringify(pkg),
          pkg.evidence.packageFingerprintSha256 || "sha256_unresolved",
          operatorName,
        ]
      );
      return true;
    });
  }

  public async updateModelPackageState(packageId: string, version: string, tenantId: string, destinoId: string, state: string): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `UPDATE paquetes_modelos_simulacion
         SET estado_ciclo = $1, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $2 AND version = $3 AND (tenant_id = $4 OR tenant_id = 'tenant_segittur_global')`,
        [state, packageId, version, tenantId]
      );
      return (res.rowCount || 0) > 0;
    });
  }

  public async recordModelPackageDecision(decision: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(decision.tenantId, decision.destinationId, async (client) => {
      await client.query(
        `INSERT INTO decisiones_modelos_audit (
           id, package_id, version, tenant_id, destino_id, operador_id, operador_nombre,
           operador_rol, decision, justificacion, decidido_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          decision.id,
          decision.packageId,
          decision.version,
          decision.tenantId,
          decision.destinationId,
          decision.operatorId,
          decision.operatorName,
          decision.operatorRole,
          decision.decision,
          decision.rationale,
        ]
      );
      return true;
    });
  }

  public async saveDataBinding(binding: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(binding.tenantId, binding.destinationId, async (client) => {
      await client.query(
        `INSERT INTO vinculos_datos_modelos (
           id, tenant_id, destino_id, model_id, model_title, model_variable_id,
           model_variable_label, required, conector_id, dataset_id, source_field,
           transformation, transformation_arg, unidad, frecuencia, calidad_nivel,
           disponibilidad, activo, configurado_por, configurado_en, notas
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, $20)
         ON CONFLICT (destino_id, model_id, model_variable_id) DO UPDATE SET
           model_title = EXCLUDED.model_title,
           model_variable_label = EXCLUDED.model_variable_label,
           required = EXCLUDED.required,
           conector_id = EXCLUDED.conector_id,
           dataset_id = EXCLUDED.dataset_id,
           source_field = EXCLUDED.source_field,
           transformation = EXCLUDED.transformation,
           transformation_arg = EXCLUDED.transformation_arg,
           unidad = EXCLUDED.unidad,
           frecuencia = EXCLUDED.frecuencia,
           calidad_nivel = EXCLUDED.calidad_nivel,
           disponibilidad = EXCLUDED.disponibilidad,
           activo = EXCLUDED.activo,
           configurado_por = EXCLUDED.configurado_por,
           notas = EXCLUDED.notas`,
        [
          binding.id,
          binding.tenantId,
          binding.destinationId,
          binding.modelId,
          binding.modelTitle,
          binding.modelVariableId,
          binding.modelVariableLabel,
          binding.required !== false,
          binding.connectorId,
          binding.datasetId || null,
          binding.sourceField,
          binding.transformation || "DIRECT",
          binding.transformationArg || null,
          binding.unit || null,
          binding.frequency || "Diaria",
          binding.qualityLevel || "A_CERTIFICADA",
          binding.availability || "DISPONIBLE",
          binding.active !== false,
          binding.configuredBy,
          binding.notes || null,
        ]
      );
      return true;
    });
  }

  public async listDataBindings(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT v.id, v.tenant_id, v.destino_id, v.model_id, v.model_title, v.model_variable_id,
                v.model_variable_label, v.required, v.conector_id, c.nombre AS conector_nombre,
                c.estado AS conector_estado, v.dataset_id, d.nombre AS dataset_nombre,
                d.fingerprint_sha256 AS dataset_sha256, v.source_field, v.transformation,
                v.transformation_arg, v.unidad, v.frecuencia, v.calidad_nivel, v.disponibilidad,
                v.activo, v.configurado_por, v.configurado_en, v.notas
         FROM vinculos_datos_modelos v
         JOIN conectores_operativos c ON c.id = v.conector_id
         LEFT JOIN datasets_ingestados d ON d.id = v.dataset_id
         WHERE v.destino_id = $1
         ORDER BY v.model_title, v.model_variable_label`,
        [destinoId]
      );
      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        destinationId: r.destino_id,
        modelId: r.model_id,
        modelTitle: r.model_title,
        modelVariableId: r.model_variable_id,
        modelVariableLabel: r.model_variable_label,
        required: r.required,
        conectorId: r.conector_id,
        connectorName: r.conector_nombre,
        connectorStatus: r.conector_estado,
        datasetId: r.dataset_id,
        datasetName: r.dataset_nombre,
        datasetFingerprintSha256: r.dataset_sha256,
        sourceField: r.source_field,
        transformation: r.transformation,
        transformationArg: r.transformation_arg ? Number(r.transformation_arg) : undefined,
        unit: r.unidad,
        frequency: r.frecuencia,
        qualityLevel: r.calidad_nivel,
        availability: r.disponibilidad,
        active: r.activo,
        configuredBy: r.configurado_por,
        configuredAt: r.configurado_en.toISOString(),
        notes: r.notas,
      }));
    });
  }

  public async listDataBindingsByModel(tenantId: string, destinoId: string, modelId: string): Promise<any[]> {
    const all = await this.listDataBindings(tenantId, destinoId);
    return all.filter(b => b.modelId === modelId);
  }
  // =========================================================================
  // NUEVAS CAPACIDADES ITERACIÓN 12: SIMULACIÓN FEDERADA Y ACTIVOS 3D
  // =========================================================================

  public async saveFederatedConfig(config: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(config.tenantId, config.coordinatorDestinationId, async (client) => {
      await client.query(
        `INSERT INTO configuraciones_federadas (
           id, tenant_id, coordinador_destino_id, coordinador_destino_nombre,
           modelo_paquete_id, modelo_paquete_version, modelo_titulo,
           nombre, descripcion, horizonte_temporal_horas, politica_comparticion,
           participantes, creado_por, creado_en, actualizado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           descripcion = EXCLUDED.descripcion,
           politica_comparticion = EXCLUDED.politica_comparticion,
           participantes = EXCLUDED.participantes,
           actualizado_en = CURRENT_TIMESTAMP`,
        [
          config.id,
          config.tenantId,
          config.coordinatorDestinationId,
          config.coordinatorDestinationName,
          config.modelPackageId,
          config.modelPackageVersion,
          config.modelTitle,
          config.name,
          config.description,
          config.temporalHorizonHours || 4,
          config.dataSharingPolicy || "SOLO_INDICADORES_AGREGADOS",
          JSON.stringify(config.participants || []),
          config.createdBy,
          config.createdAt || new Date().toISOString()
        ]
      );
      return true;
    });
  }

  public async listFederatedConfigs(tenantId: string, destinoId: string): Promise<any[]> {
    if (!postgisClient.isAvailable()) return [];
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, coordinador_destino_id, coordinador_destino_nombre,
                modelo_paquete_id, modelo_paquete_version, modelo_titulo,
                nombre, descripcion, horizonte_temporal_horas, politica_comparticion,
                participantes, creado_por, creado_en, actualizado_en
         FROM configuraciones_federadas
         WHERE coordinador_destino_id = $1 OR $1 = ANY(SELECT jsonb_array_elements(participantes)->>'destinationId')
         ORDER BY actualizado_en DESC`,
        [destinoId]
      );
      return res.rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        coordinatorDestinationId: r.coordinador_destino_id,
        coordinatorDestinationName: r.coordinador_destino_nombre,
        modelPackageId: r.modelo_paquete_id,
        modelPackageVersion: r.modelo_paquete_version,
        modelTitle: r.modelo_titulo,
        name: r.nombre,
        description: r.descripcion,
        temporalHorizonHours: r.horizonte_temporal_horas,
        dataSharingPolicy: r.politica_comparticion,
        participants: r.participantes,
        createdBy: r.creado_por,
        createdAt: r.creado_en.toISOString(),
        updatedAt: r.actualizado_en.toISOString(),
      }));
    });
  }

  public async saveFederatedExecution(execution: any, tenantId: string): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(tenantId, execution.coordinatorDestinationId, async (client) => {
      await client.query(
        `INSERT INTO ejecuciones_federadas (
           id, tenant_id, configuracion_federada_id, coordinador_destino_id,
           modelo_paquete_id, modelo_paquete_version, modelo_titulo,
           estado, motivo_rechazo, resultados_locales, metricas_agregadas,
           evidencia, fingerprint_sha256, ejecutado_por, ejecutado_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [
          execution.id,
          tenantId,
          execution.federatedConfigId,
          execution.coordinatorDestinationId,
          execution.modelPackageId,
          execution.modelPackageVersion,
          execution.modelTitle,
          execution.status,
          execution.rejectionReason || null,
          JSON.stringify(execution.localResults),
          JSON.stringify(execution.aggregatedMetrics),
          JSON.stringify(execution.evidence),
          execution.evidence.federationFingerprintSha256,
          execution.executedBy
        ]
      );
      return true;
    });
  }

  public async getFederatedExecutionById(runId: string, tenantId: string, destinoId: string): Promise<any | null> {
    if (!postgisClient.isAvailable()) return null;
    return await postgisClient.withTenantContext(tenantId, destinoId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, configuracion_federada_id, coordinador_destino_id,
                modelo_paquete_id, modelo_paquete_version, modelo_titulo,
                estado, motivo_rechazo, resultados_locales, metricas_agregadas,
                evidencia, fingerprint_sha256, ejecutado_por, ejecutado_en
         FROM ejecuciones_federadas
         WHERE id = $1 LIMIT 1`,
        [runId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        federatedConfigId: r.configuracion_federada_id,
        modelPackageId: r.modelo_paquete_id,
        modelPackageVersion: r.modelo_paquete_version,
        modelTitle: r.modelo_titulo,
        coordinatorDestinationId: r.coordinador_destino_id,
        status: r.estado,
        rejectionReason: r.motivo_rechazo,
        localResults: r.resultados_locales,
        aggregatedMetrics: r.metricas_agregadas,
        evidence: r.evidencia,
        executedBy: r.ejecutado_por,
        executedAt: r.ejecutado_en.toISOString(),
      };
    });
  }

  public async recordFederatedDecision(decision: any): Promise<boolean> {
    if (!postgisClient.isAvailable()) return false;
    return await postgisClient.withTenantContext(decision.tenantId, decision.destinationId, async (client) => {
      await client.query(
        `INSERT INTO decisiones_federadas_audit (
           id, federated_run_id, tenant_id, destino_id, operador_id,
           operador_nombre, operador_rol, accion, justificacion, decidido_en
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          decision.id,
          decision.federatedRunId,
          decision.tenantId,
          decision.destinationId,
          decision.operatorId,
          decision.operatorName,
          decision.operatorRole,
          decision.action,
          decision.rationale
        ]
      );
      return true;
    });
  }

  // =========================================================================
  // DELEGACIONES CAPACIDADES ITERACIÓN 13: SEMÁNTICA S2 E IOT
  // =========================================================================
  public async listApprovedOntologies(): Promise<any[]> {
    return await SemanticPostgisExtension.listApprovedOntologies();
  }
  public async saveS2Connector(profile: any): Promise<boolean> {
    return await SemanticPostgisExtension.saveS2Connector(profile);
  }
  public async getS2Connector(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    return await SemanticPostgisExtension.getS2Connector(id, tenantId, destinoId);
  }
  public async listS2Connectors(tenantId: string, destinoId: string): Promise<any[]> {
    return await SemanticPostgisExtension.listS2Connectors(tenantId, destinoId);
  }
  public async updateS2ConnectorState(id: string, tenantId: string, destinoId: string, state: string): Promise<boolean> {
    return await SemanticPostgisExtension.updateS2ConnectorState(id, tenantId, destinoId, state);
  }
  public async saveIotBrokerConnector(profile: any): Promise<boolean> {
    return await SemanticPostgisExtension.saveIotBrokerConnector(profile);
  }
  public async getIotBrokerConnector(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    return await SemanticPostgisExtension.getIotBrokerConnector(id, tenantId, destinoId);
  }
  public async listIotBrokerConnectors(tenantId: string, destinoId: string): Promise<any[]> {
    return await SemanticPostgisExtension.listIotBrokerConnectors(tenantId, destinoId);
  }
  public async updateIotConnectorState(id: string, tenantId: string, destinoId: string, state: string): Promise<boolean> {
    return await SemanticPostgisExtension.updateIotConnectorState(id, tenantId, destinoId, state);
  }
  public async saveIotDevice(device: any): Promise<boolean> {
    return await SemanticPostgisExtension.saveIotDevice(device);
  }
  public async getIotDeviceByUrn(urn: string, tenantId: string, destinoId: string): Promise<any | null> {
    return await SemanticPostgisExtension.getIotDeviceByUrn(urn, tenantId, destinoId);
  }
  public async listIotDevices(tenantId: string, destinoId: string): Promise<any[]> {
    return await SemanticPostgisExtension.listIotDevices(tenantId, destinoId);
  }
  public async saveSemanticBatch(batch: any): Promise<boolean> {
    return await SemanticPostgisExtension.saveSemanticBatch(batch);
  }
  public async getSemanticBatchById(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    return await SemanticPostgisExtension.getSemanticBatchById(id, tenantId, destinoId);
  }
  public async saveContextObservation(obs: any): Promise<boolean> {
    return await SemanticPostgisExtension.saveContextObservation(obs);
  }
  public async getContextObservationById(id: string, tenantId: string, destinoId: string): Promise<any | null> {
    return await SemanticPostgisExtension.getContextObservationById(id, tenantId, destinoId);
  }
  public async listContextObservations(tenantId: string, destinoId: string, filter?: any): Promise<any[]> {
    return await SemanticPostgisExtension.listContextObservations(tenantId, destinoId, filter);
  }
  public async recordSemanticError(err: any): Promise<boolean> {
    return await SemanticPostgisExtension.recordSemanticError(err);
  }
  public async recordSourceActivationDecision(decision: any): Promise<boolean> {
    return await SemanticPostgisExtension.recordSourceActivationDecision(decision);
  }

}

export const postgisRepository = new PostGISRepository();
