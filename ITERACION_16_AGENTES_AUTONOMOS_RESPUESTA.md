# Informe Técnico — Iteración 16: Agentes Autónomos de Respuesta Rápida ante Situaciones de Colapso
**Plataforma Inteligente de Destinos (PID / SEGITTUR)**  
**Fecha:** 9 de octubre de 2026  
**Entorno:** PostgreSQL 16 + PostGIS 3.4 / Node.js 22 / Express 5 / React 18 + Vite / Tailwind CSS  
**Estado:** Validación Completada (8/8 Pruebas Superadas)

---

## 1. Resumen Ejecutivo

La **Iteración 16** culmina la transformación del Gemelo Digital Turístico en un **sistema centinela proactivo y gobernado**, capaz de actuar de manera autónoma ante emergencias turísticas y sobrecargas territoriales severas, garantizando en todo momento la supervisión humana y la trazabilidad criptográfica.

El sistema incorpora:
1. **Agentes Centinelas Autónomos** configurables por destino que evalúan permanentemente la saturación zonal frente a umbrales de seguridad (ej. 85%).
2. **Detección Determinista de Incidentes de Colapso** con cálculo de tiempo límite a alerta crítica y vinculación estricta a sensores IoT, aforos y ortofotos.
3. **Planes de Intervención Rápida Escalonados** con clasificación de medidas por nivel de riesgo:
   - **Nivel 1 (Informativo y Digital)**: Paneles PMV, notificaciones en app de visitantes y recomendaciones de desvío cultural. Se ejecutan de inmediato de forma autónoma bajo directiva municipal.
   - **Nivel 2 (Físico y Policial)**: Filtros de acceso peatonal de Policía Local, cortes de tráfico y apertura de aparcamientos disuasorios con buses lanzadera. **Bloqueadas obligatoriamente en base de datos hasta firma humana formal**.
4. **Gobernanza Criptográfica Inmutable en PostGIS**:
   - Triggers PL/pgSQL que impiden modificar o borrar las decisiones de intervención.
   - Trigger que impide pasar un plan a `AUTORIZADO_EJECUTADO` si no existe la firma del operador en `decisiones_intervencion_agente`.
   - Aislamiento multitenant forzado mediante `FORCE ROW LEVEL SECURITY`.

---

## 2. Componentes Implementados

### 2.1. Contratos de Datos (`src/types/rapidResponseAgent.ts`)
- `RapidResponseAgentProfile`: Perfil, modo operativo (`VIGILANCIA_PASIVA`, `ALERTA_PREVENTIVA`, `RESPUESTA_ACTIVA`), umbrales y directivas.
- `CollapseIncident`: Registro estructurado del incidente con severidad (`AMARILLA`, `NARANJA`, `ROJA_COLAPSO_INMINENTE`), fuentes y huella SHA-256.
- `InterventionActionStep`: Acciones escalonadas clasificadas por nivel de autonomía (`NIVEL_1_INFORMATIVO_AUTONOMO`, `NIVEL_2_OPERATIVO_FIRMA_HUMANA`).
- `RapidInterventionPlan`: Plan con proyección de alivio territorial (-30% a -45%) y estimación presupuestaria.
- `AgentExecutionDecisionRecord`: Firma inmutable del operador institucional con justificación técnica obligatoria.

### 2.2. Esquema PostGIS con RLS e Inmutabilidad (`database/migrations/020_agentes_autonomos_respuesta_rapida.sql`)
- `agentes_respuesta_configuracion`: Configuración por destino con RLS bicomponente.
- `incidentes_colapso_detectados`: Incidentes registrados con indexación temporal.
- `planes_intervencion_rapida`: Planes asociados a incidentes protegidos por trigger.
- `decisiones_intervencion_agente`: Registro inmutable append-only con trigger `trg_decisiones_intervencion_immutable`.
- Función de verificación `fn_enforce_intervention_plan_transition()` que prohíbe autorizaciones sin firma previa.

### 2.3. Lógica Operativa y Persistencia
- `RapidResponseAgentService.ts`: Lógica de evaluación zonal, cálculo de incidentes, secuenciación de medidas escalonadas y verificación de firmas.
- `RapidResponsePostgisExtension.ts`: Métodos de consulta y mutación transaccional encapsulados en `postgisClient.withTenantContext`.

### 2.4. Endpoints de API REST (`server.ts`)
- `GET /api/rapid-response/agents`: Recupera el agente centinela activo del destino.
- `POST /api/rapid-response/evaluate`: Evalúa territorio en tiempo real (con opción de simulación de shock).
- `GET /api/rapid-response/incidents`: Historial de alertas detectadas.
- `GET /api/rapid-response/plans/:planId`: Inspección detallada del plan mitigador.
- `POST /api/rapid-response/plans/:planId/execute`: Firma formal humana con JWT y claims verificados.

### 2.5. Interfaz Gráfica (`src/components/RapidResponseAgentModal.tsx`)
- Radar centinela en tiempo real con botón de inspección y simulador de shocks de afluencia.
- Visualización de incidentes y desglose de medidas por nivel de riesgo con badges distintivos.
- Panel de firma institucional con formulario de justificación técnica y botón de autorización.
- Historial inmutable de incidentes y consulta de la directiva municipal.

---

## 3. Resultados de la Validación Automatizada (8/8 Superadas)

El script `scripts/validate_iteration16_rapid_response_agents.sh` ejecutó 8 pruebas rigurosas en el entorno real:

| Prueba | Caso Evaluado | Resultado |
| :--- | :--- | :--- |
| **TEST 1** | Login institucional de operadores (Málaga y Palma) con emisión de tokens JWT | **SUPERADO** (Tokens válidos y claims verificados) |
| **TEST 2** | Consulta y verificación del perfil del agente centinela de Málaga | **SUPERADO** (`agent_mlg_colapso_01`, umbral 85%) |
| **TEST 3** | Evaluación territorial con shock (+35%) y detección de colapso inminente | **SUPERADO** (`inc_malaga_*`, severidad `ROJA`, SHA-256 válida) |
| **TEST 4** | Inspección del plan: Nivel 1 autónomo vs Nivel 2 pendiente de firma | **SUPERADO** (PMV en `EJECUTADA_AUTONOMA`, Policía en `PENDIENTE`) |
| **TEST 5** | Firma humana de operador autorizando medidas de contingencia | **SUPERADO** (`dec_agent_*`, SHA-256 inmutable generada) |
| **TEST 6** | Bloqueo de re-autorización o alteración sobre plan ya resuelto | **SUPERADO** (HTTP 422 - Plan inmutable tras firma) |
| **TEST 7** | Aislamiento multitenant estricto (Operador de Palma intentando autorizar en Málaga) | **SUPERADO** (HTTP 403 Forbidden para operador cruzado) |
| **TEST 8** | Verificación de trigger inmutable contra alteración directa en SQL | **SUPERADO** (Trigger aborta `UPDATE` con `VIOLACION DE AUDITORIA`) |

---

## 4. Conclusión

La **Iteración 16** establece un estándar de vanguardia para la Plataforma Inteligente de Destinos: los destinos cuentan con centinelas digitales capaces de reaccionar en milisegundos mediante comunicaciones automáticas para evitar la congestión, mientras que las decisiones coercitivas o de despliegue de recursos públicos quedan salvaguardadas por una estricta gobernanza con firma humana inmutable.
