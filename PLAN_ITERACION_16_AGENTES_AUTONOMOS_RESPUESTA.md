# Plan Maestro — Iteración 16: Agentes Autónomos de Respuesta Rápida ante Situaciones de Colapso
**Plataforma Inteligente de Destinos (PID / SEGITTUR)**  
**Fecha:** 9 de octubre de 2026  
**Entorno:** PostgreSQL 16 + PostGIS 3.4 / Node.js 22 / Express 5 / React 18 + Vite / Tailwind CSS

---

## 1. Contexto y Objetivos

La **Iteración 16** dota al Gemelo Digital Turístico de un subsistema de **Agentes Autónomos de Respuesta Rápida ante Situaciones de Colapso**.  
El objetivo es transformar el gemelo de un sistema puramente observacional y predictivo en un **asistente activo y vigilante** que:
1. **Monitoriza continuamente los indicadores territoriales y predicciones multiescala (T+1 h, T+4 h, T+24 h)** frente a umbrales de seguridad preconfigurados y gobernados.
2. **Detecta patrones de saturación crítica o colapso inminente** (afluencia zonal ≥ umbral, capacidad excedida, tiempo a alerta crítica < 30 min, sobrecostes extraordinarios de servicios).
3. **Genera planes estructurados de intervención rápida** (escalonamiento de medidas de contingencia: activación de paneles PMV, desvío de transporte, apertura de bolsas de estacionamiento disuasorio, aviso a Policía Local y Protección Civil).
4. **Respeta estrictamente la regla obligatoria de evidencia comprobable y supervisión humana**:
   - Todo plan emitido por un agente autónomo queda vinculado a fuentes de datos certificadas (`S2`, `IoT`, `C4`, `AEMET`, calibración activa).
   - Huella criptográfica SHA-256 única por incidente y por plan de respuesta.
   - **Gobernanza de Dos Niveles de Actuación**:
     - *Nivel 1 (Acciones Informativas / Recomendaciones Digitales)*: Pre-autorizables mediante directiva municipal aprobada en tiempo de paz.
     - *Nivel 2 (Acciones Físicas / Restricción de Acceso / Desvío Policial)*: **Bloqueadas obligatoriamente hasta firma humana inmutable** (`AUTORIZACION_EXPRESA_OPERADOR`) con trazabilidad en PostGIS.

---

## 2. Arquitectura de Seguridad y Datos (PostGIS + RLS)

Se diseñará la migración `database/migrations/020_agentes_autonomos_respuesta_rapida.sql` con aislamiento estricto bicomponente (`tenant_id`, `destino_id`) y políticas RLS forzadas:

| Tabla PostGIS | Propósito | Reglas de Integridad y RLS |
| :--- | :--- | :--- |
| `agentes_respuesta_configuracion` | Configuración, estado y directivas de los agentes autónomos de cada destino | RLS bicomponente. Modos: `VIGILANCIA_PASIVA`, `ALERTA_PREVENTIVA`, `RESPUESTA_ACTIVA`. |
| `incidentes_colapso_detectados` | Registro inmutable de incidentes y picos críticos detectados por los agentes | RLS bicomponente. Huella SHA-256 de las observaciones detonantes y métricas de afluencia. |
| `planes_intervencion_rapida` | Planes de mitigación generados con secuencia de acciones clasificadas por nivel de riesgo | RLS bicomponente. Estados: `GENERADO`, `PRE_APROBADO_DIRECTIVA`, `PENDIENTE_FIRMA_HUMANA`, `EJECUTADO`, `RECHAZADO`. |
| `decisiones_intervencion_agente` | Registro de firma institucional inmutable (Append-only) sobre planes de respuesta | Trigger `trg_decisiones_intervencion_immutable` bloquea `UPDATE` y `DELETE`. |

---

## 3. Componentes Lógicos del Sistema

1. **Contratos TypeScript (`src/types/rapidResponseAgent.ts`)**:
   - `RapidResponseAgentProfile`: Definición del agente autónomo, ámbito territorial, reglas de umbral y directiva.
   - `CollapseIncident`: Incidente detectado con severidad (`AMARILLA`, `NARANJA`, `ROJA_COLAPSO`), zonas afectadas y evidencia.
   - `InterventionPlan`: Secuencia de acciones operativas, unidades responsables, nivel de autonomía y coste estimado.
   - `AgentExecutionDecision`: Auditoría de firma humana sobre el plan.

2. **Servicio Central (`src/services/rapidResponseAgentService.ts`)**:
   - Evaluación continua de zonas frente a afluencias actuales y proyecciones de estrés.
   - Detección determinista de colapso con vinculación obligatoria a evidencias (fuentes, huella de contexto y sensores).
   - Generación del plan de respuesta mitigadora hacia corredores de capacidad remanente.
   - Procesamiento seguro de decisiones humanas y transición protegida de estados.

3. **Extensión de Persistencia PostGIS (`src/services/rapidResponsePostgisExtension.ts`)**:
   - Operaciones transaccionales mediante `postgisClient.withTenantContext`.
   - Consulta y persistencia de incidentes, configuraciones y planes mitigadores.

4. **Endpoints REST (`server.ts`)**:
   - `GET /api/rapid-response/agents`: Listar agentes del destino.
   - `POST /api/rapid-response/evaluate`: Evaluar territorio y disparar detección de incidentes.
   - `GET /api/rapid-response/incidents`: Consultar historial de incidentes detectados.
   - `POST /api/rapid-response/plans/:planId/execute`: Autorizar y firmar ejecución del plan de respuesta (requiere JWT y claims).
   - Protegidos con `scenarioScope` y `verifyOperatorClaims`.

5. **Interfaz de Usuario (`src/components/RapidResponseAgentModal.tsx`)**:
   - Panel de control de agentes autónomos, estado de vigilancia, radar de incidentes en tiempo real y secuenciador de acciones de contingencia con botón de firma institucional.
   - Enlace directo desde el menú **Gobernanza & Operación** de `src/App.tsx`.

---

## 4. Plan de Validación y Verificación

1. **Compilación y Linteo**: `pnpm lint && pnpm build` limpios en `/home/ubuntu/gemelotur`.
2. **Suite Automatizada (`scripts/validate_iteration16_rapid_response_agents.sh`)**:
   - TEST 1: Login de operador institucional y verificación de tokens.
   - TEST 2: Consulta y activación de la configuración del agente autónomo en Málaga.
   - TEST 3: Detección controlada de incidente de saturación crítica (≥85%) con evidencia obligatoria.
   - TEST 4: Generación de plan de intervención rápida con huella SHA-256.
   - TEST 5: Firma humana de operador autorizando acciones de contingencia nivel 2.
   - TEST 6: Bloqueo de ejecución sin firma institucional previa.
   - TEST 7: Aislamiento RLS estricto multitenant (403 Forbidden para operador cruzado).
   - TEST 8: Auditoría inmutable de decisiones repelente a manipulaciones directas en SQL.
3. **Revisión Independiente de Código**: Subagente read-only verificando RLS, triggers inmutables y ausencia de bypasses.
4. **Sincronización Canónica**: Copia a `workspace-f27814b6f0ee90fd80de962a030015ed`, compilación y commit git.
