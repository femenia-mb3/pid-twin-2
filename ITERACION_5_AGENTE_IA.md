# INFORME TÉCNICO: ITERACIÓN 5 — AGENTE DE IA PARA SIMULACIONES EN LENGUAJE NATURAL CON GOBERNANZA Y VINCULACIÓN OBLIGATORIA A EVIDENCIAS

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Iteración:** 5 de 6  
**Fecha:** 8 de Octubre de 2026  
**Autor:** Manus Autonomous Agent  
**Estado:** VALIDADO E INTEGRADO (20/20 checks superados)

---

## 1. Resumen Ejecutivo

En cumplimiento de las directrices de SEGITTUR para la Plataforma Inteligente de Destinos (PID) y el principio normativo de **vinculación obligatoria a evidencias comprobables**, se ha desarrollado e integrado con éxito la **Iteración 5: Agente de IA para Simulaciones en Lenguaje Natural**.

El sistema capacita a los operadores y gestores públicos de cualquier destino turístico español para solicitar escenarios prospectivos, pruebas de estrés y simulaciones What-If mediante lenguaje natural ordinario (ej. *"¿Qué ocurriría si desembarcan 8.000 cruceristas y se concentran en el centro con tiempo caluroso a las 12:00?"*), traduciéndolas a **propuestas estructuradas auditables (`AiSimulationProposal`)**, acompañadas en todo momento de:
1. Citación explícita de **fuentes de datos autorizadas** con identificador de trazabilidad y nivel de calidad.
2. Huella criptográfica **SHA-256 (`contextFingerprint`)** del contexto territorial (`DestinationRuntime` / `ContextPackage`).
3. Justificación técnica cuantitativa (`rationale`) y desglose pormenorizado de **supuestos adoptados (`assumptions`)**.
4. Indicador de **incertidumbre y advertencia de datos sintéticos**, garantizando que el usuario comprenda el alcance de la simulación.
5. Control estricto de **supervisión humana (Human-in-the-Loop)**: el agente genera una propuesta editable y no ejecuta ni persiste de forma automática o ciega en base de datos.

---

## 2. Arquitectura de Gobernanza y Flujo de Datos

```
[ Petición Operador (Lenguaje Natural) ]
                   │
                   ▼
       [ Validación Scope & RLS ] ◄── (X-PID-Tenant + destinationId)
                   │
                   ▼
     [ DestinationRuntime Resolver ] ───► Huella SHA-256 + Fuentes Autorizadas
                   │
                   ▼
     ┌─────────────────────────────┐
     │ AiSimulationAgentService    │
     │ ├─ Motor Primario:          │
     │ │  gpt-5-mini (JSON Schema) │
     │ └─ Contingencia Determinista│
     │    Heurística Semántica PID │
     └─────────────┬───────────────┘
                   │
                   ▼
     [ AiSimulationProposal Auditada ]
       ├─ ScenarioDraftInput
       ├─ RuntimeParameters
       ├─ Evidencias (Fuentes, Huella, Calidad)
       └─ Supuestos e Incertidumbre
                   │
                   ▼
     [ Drawer Interactivo UI (App.tsx) ]
       ├─ [Aplicar al Simulador (What-If)]
       └─ [Abrir en Editor de Escenarios]
```

### Principios Clave Implementados:
- **Multidestino Estricto**: El agente desconoce la lógica particular de cualquier municipio; todo el razonamiento se realiza sobre el `DestinationRuntime` del destino activo (zonas, aforos, sensores, variables de capacidad y perfiles ontológicos).
- **Aislamiento Multitenant**: Las peticiones requieren el encabezado `X-PID-Tenant` coincidente con el destino. Intentos de acceso cruzado entre Málaga y Palma devuelven de forma estricta un error `403 Forbidden`.
- **Inmutabilidad y No-Ejecución Automática**: La llamada al endpoint `POST /api/ai/simulate-prompt` es de solo lectura predictiva. La suite de pruebas verifica que el número de corridas persistidas y escenarios almacenados se mantiene idéntico tras las consultas.

---

## 3. Componentes y Módulos Desarrollados

### 3.1 Contratos TypeScript (`src/types/aiAgent.ts`)
- `AiPromptRequest`: Estructura tipada de entrada (`destinationId`, `tenantId`, `prompt`, `activeZoneId?`, `contextPreferences?`).
- `AiDataSourceCitation`: Cita formal a cada fuente de datos (`id`, `name`, `traceabilityId`, `dataQuality`, `authorization`, `contribution`).
- `AiProposalEvidence`: Bloque de evidencias obligatorias vinculadas a la huella criptográfica SHA-256 del runtime.
- `AiSimulationProposal`: Propuesta estructurada completa con estado de revisión (`READY_FOR_REVIEW`, `REQUIRES_CLARIFICATION`, `REJECTED`), desglose territorial, borrador de escenario y parámetros de simulación.
- `AiAgentCapabilities`: Catálogo de intenciones soportadas y sugerencias adaptadas al destino activo.

### 3.2 Servicio de Agente IA (`src/services/aiSimulationAgentService.ts`)
- **Integración con `gpt-5-mini`**: Consulta server-side mediante schema estructurado estricto (`additionalProperties: false`), garantizando que la salida del LLM coincida exactamente con los contratos de simulación sin alucinaciones de formato.
- **Motor Heurístico de Contingencia**: Algoritmo determinista que clasifica patrones de movilidad, presión de cruceros, eventos masivos y meteorología extrema, garantizando la operatividad continua en entornos aislados o sin conectividad externa.
- **Generación de Evidencias y Citas**: Enlaza automáticamente cada propuesta con las fuentes ontológicas de la PID (`SEGITTUR-TR-MLG-001`, catálogo operacional censal y telemetría IoT).

### 3.3 Endpoints API REST (`server.ts`)
- `GET /api/ai/capabilities?destino=:destino`: Informa del estado del motor IA, modelo activo y banco de sugerencias personalizadas para el destino seleccionado.
- `POST /api/ai/simulate-prompt`: Endpoint auditado protegido por `scenarioScope` y `X-PID-Tenant`. Resuelve el runtime, invoca la interpretación y emite la propuesta con cabeceras `Cache-Control: no-store`.

### 3.4 Interfaz de Usuario: `AiSimulationDrawer.tsx` y `App.tsx`
- **Diseño acorde a la identidad PID**: Fondo blanco institucional, acentos en rojo SEGITTUR y tipografía de control room geoespacial.
- **Botonera de Acceso Rápido**: Botón con degradado e icono de destello (*Sparkles*) tanto en la barra superior institucional como en el panel lateral del Simulador.
- **Pestaña de Evidencias y Fuentes**: Visualización detallada de la huella digital SHA-256, fuentes de datos citadas, nivel de incertidumbre y advertencias de datos sintéticos.
- **Acciones Directas**: Botón para *"Aplicar al Simulador y Ver Impacto"* (carga inmediata en el mapa) y *"Abrir en Editor de Escenarios"* (para afinación manual y persistencia en PostGIS).

---

## 4. Resultados de la Suite de Validación (`scripts/validate_iteration5_ai_agent.sh`)

La suite de pruebas automatizadas ejecutó 20 comprobaciones independientes en el entorno del Sandbox:

| # | Prueba / Verificación | Resultado | Detalle |
|---|----------------------|-----------|---------|
| 1 | `api/health` modo PostGIS | **PASS** | `POSTGIS_PERSISTED_PILOT` verificado |
| 2 | `api/ai/capabilities` estado | **PASS** | `status: ACTIVE`, modelo `gpt-5-mini` |
| 3 | Sugerencias contextuales Málaga | **PASS** | 4 prompts específicos generados |
| 4 | Rechazo sin cabecera tenant | **PASS** | Código HTTP `401 Unauthorized` |
| 5 | Rechazo con tenant cruzado | **PASS** | Código HTTP `403 Forbidden` |
| 6 | Rechazo de prompt insuficiente | **PASS** | Código HTTP `422 Unprocessable` (<5 chars) |
| 7 | Generación de ID propuesta IA | **PASS** | Prefijo `ai-prop-*` generado |
| 8 | Estado propuesta Málaga | **PASS** | `READY_FOR_REVIEW` verificado |
| 9 | Huella SHA-256 en evidencia | **PASS** | Hash criptográfico de 64 caracteres |
| 10 | Citación de fuentes autorizadas | **PASS** | Fuentes presentes con trazabilidad |
| 11 | Código de trazabilidad PID | **PASS** | `SEGITTUR-TR-MLG-001` verificado |
| 12 | Advertencia datos sintéticos | **PASS** | Flag `syntheticDemoData: true` verificado |
| 13 | Acciones Human-in-the-Loop | **PASS** | 2 acciones sugeridas (`APPLY` / `OPEN_STUDIO`) |
| 14 | Cálculo de nivel de confianza | **PASS** | Score cuantitativo de certeza emitido |
| 15 | Estado propuesta Palma | **PASS** | `READY_FOR_REVIEW` multidestino |
| 16 | Destino de la propuesta Palma | **PASS** | Identificado correctamente como `palma` |
| 17 | Detección climática de lluvia | **PASS** | Clima `LLUVIA` asignado en el escenario |
| 18 | Aislamiento de contexto criptográfico | **PASS** | Huellas SHA-256 distintas entre destinos |
| 19 | Verificación no auto-ejecución | **PASS** | Conteo de SimulationRuns inalterado |
| 20 | Verificación no auto-persistencia | **PASS** | Conteo de Escenarios inalterado |

---

## 5. Próximos Pasos (Hacia la Iteración 6 y Cierre del Piloto)

1. **Sincronización Canónica**: Copia y verificación de los cambios en el árbol canónico Git (`/home/ubuntu/workspace-f27814b6f0ee90fd80de962a030015ed`).
2. **Revisión Independiente de Código**: Ejecución del checklist de calidad y validación de build de producción sin advertencias críticas.
3. **Persistencia Opcional de Conversaciones**: Habilitar migración para histórico auditable de consultas de gestores turísticos si se requiere para analítica de demanda institucional.
