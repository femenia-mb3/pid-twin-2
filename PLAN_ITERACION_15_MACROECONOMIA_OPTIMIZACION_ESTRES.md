# Plan Maestro — Iteración 15: Simulación Macroeconómica, Optimización de Flujos y Prueba de Estrés

## 1. Contexto y Objetivos

La **Iteración 15** amplía las capacidades analíticas y operacionales del Gemelo Digital Turístico PID/SEGITTUR mediante:
1. **Módulo de Impacto Macroeconómico y Rendimiento Turístico**:
   - Modelado de gasto turístico medio diario por visitante (`Gasto Directo`).
   - Estimación de valor añadido bruto local (VAB) mediante multiplicador keynesiano/insumo-producto territorial acotado (`Efecto Indirecto e Inducido`).
   - Retorno fiscal municipal estimado (tasa turística, IBI comercial, IVA prorrateado municipal).
   - Coste de externalidades territoriales (limpieza viaria extraordinaria, refuerzo de seguridad, huella de carbono valorada a precio de derechos de emisión ETS).
   - Salida estructurada de balance neto socioeconómico (`BASE / ESCENARIO / DELTA`).
2. **Motor de Optimización Automática y Desvío Dinámico de Flujos**:
   - Detección algorítmica de zonas saturadas frente a zonas con capacidad ociosa (capacidad de carga remanente).
   - Generación de propuestas de balanceo territorial (rutas alternativas, incentivos de dispersión horaria/espacial).
   - Cálculo del alivio de saturación proyectado y preservación de trazabilidad con huella criptográfica SHA-256.
   - Sometimiento de las medidas de desvío a **revisión y confirmación humana obligatoria**.
3. **Prueba de Estrés (Stress Testing) sobre Horizontes T+1 h, T+4 h y T+24 h**:
   - Inyección controlada de picos de afluencia masiva (+30%, +60%, +100%) sobre la calibración activa.
   - Monitorización del comportamiento de zonas críticas, tiempo hasta superación del umbral de alerta (85%) y colapso de capacidad física.
   - Cálculo del impacto macroeconómico y degradación ambiental bajo condiciones extremas.
   - Preservación de la distinción estricta entre predicción (observada) y simulación de estrés (hipótesis severa).

---

## 2. Principios de Diseño y Seguridad Institucional

1. **Aislamiento Multitenant con RLS Bicomponente**:
   - Toda tabla nueva de impacto y optimización incorporará `tenant_id` y `destino_id` con políticas PostGIS forzadas (`FORCE ROW LEVEL SECURITY`).
2. **Gobernanza y Evidencia Verificable**:
   - Ninguna proyección económica afirmará causalidad sin vincularse a la calibración vigente (`ActiveDestinationCalibration`), fuentes aprobadas y huella SHA-256.
   - Los datos sintéticos o paramétricos se etiquetarán explícitamente (`uncertaintyType: PARAMETRICA_SINTETICA` / `CALIBRADA_EMPIRICA`).
3. **Firma Humana en Propuestas de Optimización**:
   - Las recomendaciones de desvío no se ejecutarán autónomamente en sistemas externos; requerirán aprobación formal de un operador institucional con justificación (`rationale`).
4. **Diseño Visual Claro y Coherente**:
   - Fondo blanco institucional, tipografía limpia, paleta SEGITTUR/PID (rojos/ámbares/azules) y componentes modales accesibles desde la cabecera y el panel de simulación.

---

## 3. Arquitectura de Datos y Componentes

### 3.1 Contratos TypeScript (`src/types/macroOptimizationStress.ts`)
- `MacroeconomicImpactResult`: Gasto directo, VAB inducido, retorno fiscal, costes de externalidades y balance neto socioeconómico.
- `FlowOptimizationProposal`: Zonas saturadas origen, zonas receptoras destino, porcentaje de desvío sugerido, reducción de saturación prevista y huella SHA-256.
- `OptimizationDecisionRecord`: Registro de aprobación/rechazo por operador con claims JWT inmutables.
- `StressTestHorizonResult`: Evaluación comparativa en T+1, T+4 y T+24 bajo shock de afluencia masiva.

### 3.2 Migración PostGIS (`database/migrations/018_macroeconomia_optimizacion_estres.sql`)
- `simulaciones_impacto_macroeconomico`: Registro de balances económicos asociados a corridas de simulación.
- `propuestas_optimizacion_flujos`: Propuestas de balanceo zonal generadas con huella criptográfica.
- `decisiones_optimizacion_flujos`: Decisiones humanas de aplicación de medidas de desvío.
- `pruebas_estres_horizontes`: Registro de ejecuciones de estrés sobre predicciones T+1/T+4/T+24.

### 3.3 Servicios Lógicos
- `src/services/macroeconomicImpactService.ts`: Modelado cuantitativo de gasto, fiscalidad y externalidades.
- `src/services/flowOptimizationService.ts`: Algoritmo de dispersión de flujos y generación de rutas alternativas.
- `src/services/stressTestingService.ts`: Orquestador de picos de afluencia masiva sobre los horizontes T+1, T+4 y T+24.
- `src/services/macroPostgisExtension.ts`: Extensión de persistencia transaccional bajo contexto RLS.

### 3.4 Interfaz de Usuario
- `src/components/MacroOptimizationModal.tsx`: Modal con pestañas para Impacto Macroeconómico, Optimización de Flujos y Banco de Pruebas de Estrés.
- Enlace en la cabecera y en el panel lateral de `src/App.tsx`.

---

## 4. Plan de Validación y Verificación

1. **Compilación y Linteo**: `pnpm lint && pnpm build` sin errores de tipos.
2. **Suite Automatizada** (`scripts/validate_iteration15_macro_optimization_stress.sh`):
   - TEST 1: Login de operadores y verificación JWT institucional.
   - TEST 2: Evaluación de impacto macroeconómico BASE vs ESCENARIO vs DELTA.
   - TEST 3: Generación de propuesta de optimización de flujos con huella SHA-256.
   - TEST 4: Firma y aprobación humana de la propuesta de optimización por operador con justificación.
   - TEST 5: Prueba de estrés en T+1 h con shock de afluencia (+50%).
   - TEST 6: Prueba de estrés en T+4 h con pico severo (+80%).
   - TEST 7: Prueba de estrés en T+24 h con afluencia extrema (+100%).
   - TEST 8: Comparativa analítica de resiliencia territorial y zonas colapsadas.
   - TEST 9: Aislamiento RLS estricto multitenant (403 Forbidden para operador cruzado).
   - TEST 10: Auditoría inmutable de decisiones de optimización.
3. **Revisión Independiente de Código**: Subagente read-only verificando RLS, inmutabilidad y límites de gobernanza.
4. **Sincronización Canónica**: Traslado a `workspace-f27814b6f0ee90fd80de962a030015ed` y commit git.
