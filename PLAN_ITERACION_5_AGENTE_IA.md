# PLAN ITERACIÓN 5: AGENTE DE IA PARA SIMULACIONES EN LENGUAJE NATURAL CON GOBERNANZA Y VINCULACIÓN OBLIGATORIA A EVIDENCIAS

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Objetivo:** Permitir a los operadores de cualquier destino turístico solicitar simulaciones What-If, escenarios y análisis prospectivos en lenguaje natural, traduciéndolos a propuestas estructuradas auditables con vinculación obligatoria a evidencias, sin ejecución ciega y bajo estricto control humano.  
**Fecha:** 8 de Octubre de 2026  
**Iteración:** 5 de 6

---

## 1. Principios de Diseño y Gobernanza

1. **Copiloto Controlado (Human-in-the-Loop)**:
   - La IA nunca ejecuta una simulación ni altera la base de datos de forma oculta.
   - La petición en lenguaje natural genera una **propuesta de simulación estructurada (`AiSimulationProposal`)** con desglose de parámetros, zonas afectadas, fuentes de datos vinculadas y justificación técnica.
   - El operador revisa la propuesta en el panel interactivo, puede editar cualquier parámetro y decide explícitamente si pulsa **"Validar y Ejecutar Simulación"** o **"Guardar como Borrador en Escenarios"**.

2. **Vinculación Obligatoria a Evidencias (Knowledge Guard)**:
   - Toda propuesta generada por el agente debe citar de forma explícita:
     - Fuentes de datos que respaldan los supuestos (p. ej. *Aforo IoT histórico*, *Datos de cruceros de la Autoridad Portuaria*, *AEMET*).
     - Id y huella criptográfica SHA-256 del `DestinationRuntime` o `ContextPackage` activo.
     - Justificación cuantitativa de cada multiplicador o variable derivada.
     - Nota de incertidumbre y advertencia de datos sintéticos si procede.

3. **Arquitectura Multidestino Estricta**:
   - El agente recibe el contexto del destino activo (`DestinationRuntime`: zonas, aforos, sensores, perfil del modelo, capacidades teóricas).
   - No contiene lógica ni conocimiento hardcodeado de ninguna ciudad en particular.
   - Opera bajo las mismas restricciones de tenant y RLS (`X-PID-Tenant`).

4. **Motor Híbrido con Soporte Offline / Fallback Determinista**:
   - Si `OPENAI_API_KEY` y `OPENAI_API_BASE` están disponibles, utiliza el modelo `gpt-5-mini` con respuesta estructurada JSON Schema (`strict: true`).
   - Si la API externa no estuviese configurada o fallase, el sistema activa un **motor heurístico semántico de reglas locales** que procesa la intención en lenguaje natural (palabras clave, porcentajes, zonas y eventos) garantizando que el usuario siempre obtiene una propuesta estructurada válida.

---

## 2. Contratos de Datos y Tipos TypeScript (`src/types/aiAgent.ts`)

- `AiPromptRequest`: Petición del usuario en lenguaje natural (`prompt`, `destinationId`, `tenantId`, `activeZoneId?`, `contextPreferences?`).
- `AiSimulationProposal`:
  - `id`: Identificador único de propuesta.
  - `scenarioDraft`: Estructura compatible con `ScenarioDraftInput` para edición directa.
  - `runtimeParameters`: Parámetros de simulación validados (`intensidad`, `clima`, `variacionVisitantesPct`, `capacidadOperativaPct`, `modoMovilidad`).
  - `evidence`:
    - `dataSources`: Lista de fuentes de datos invocadas con su id de trazabilidad.
    - `contextFingerprint`: Hash SHA-256 del runtime del destino.
    - `rationale`: Explicación en lenguaje natural de cómo se interpretó la solicitud.
    - `assumptions`: Supuestos adoptados (p. ej. "Se asume pico de afluencia entre 11:00 y 13:00").
    - `uncertainty`: Nivel y causas de incertidumbre.
  - `suggestedActions`: Recomendaciones operativas previas a la ejecución.

---

## 3. Endpoints API (`server.ts`)

1. `POST /api/ai/simulate-prompt`:
   - Valida el alcance del tenant y destino (`scenarioScope`).
   - Resuelve el `DestinationRuntime` del destino.
   - Invoca a `AiSimulationAgentService.interpretPrompt()`.
   - Devuelve `AiSimulationProposal` con cabeceras `no-store` y trazabilidad.

2. `GET /api/ai/capabilities`:
   - Reporta si el motor LLM está activo (`gpt-5-mini`), el catálogo de intenciones soportadas y ejemplos contextualizados para el destino seleccionado.

---

## 4. Componentes de Interfaz de Usuario (`src/components/AiSimulationDrawer.tsx`)

- **Botonera / Acceso Rápido**:
  - Botón "Asistente IA de Simulación" en el panel lateral del Simulador y en la cabecera.
- **Drawer / Panel Interactivo**:
  - Cuadro de entrada de lenguaje natural con sugerencias clicables adaptadas al destino activo (p. ej. *"Simular llegada simultánea de 2 cruceros y lluvia intensa"*, *"Evaluar cierre peatonal en el centro histórico durante festival"*).
  - Visualización estructurada de la propuesta generada:
    - Resumen ejecutivo y justificación del agente.
    - Tarjeta de **Evidencias y Fuentes Vinculadas**.
    - Desglose de parámetros sugeridos con badges de advertencia.
    - Botón de acción: **"Aplicar al Simulador y Ver Impacto"**.
    - Botón de acción: **"Abrir en Editor de Escenarios para Personalizar"**.

---

## 5. Verificación y Validación

- Script ejecutable `scripts/validate_iteration5_ai_agent.sh`.
- Pruebas de interpretación en lenguaje natural para Málaga, Palma y el Destino Demostrador.
- Verificación de la vinculación obligatoria a fuentes y huella de contexto.
- Revisión independiente mediante subagente de lectura según `SKILL.md`.
