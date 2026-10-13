# Plan de Implementación — Iteración 14: Calibración Real y Predicción Validable

## 1. Contexto y Objetivos

La Iteración 13 permitió que el Gemelo Digital Turístico incorpore ontologías PID desde S2 y telemetría de brokers IoT bajo estándares NGSI-LD y MQTT con firmas SHA-256 e inmutabilidad en PostGIS. La prueba federada demostró que las señales pueden capturarse y rastrearse limpiamente, pero también evidenció un límite fundamental: **ninguna observación puede recalibrar un modelo si no existe un vínculo formal aprobado por el destino que especifique cobertura, unidad, agregación y transformación**.

El objetivo de esta Iteración 14 es cerrar el ciclo metodológico y técnico que separa una demo paramétrica de un gemelo operativo institucional:

1. **Vínculos Formales de Calibración:**  
   `Fuente/Sensor` → `Cobertura Territorial (Geometría / Polígono / Radio)` → `Zona / Recurso` → `Variable de Modelo` → `Unidad` → `Transformación` → `Agregación Temporal` → `Frecuencia` → `Calidad Mínima` → `Vigencia`.
2. **Gobernanza y Bloqueo Anti-Deriva:**  
   El motor rechaza ajustes automáticos basados en muestras aisladas o fuentes sin vínculo aprobado. Si faltan datos obligatorios o la cobertura es insuficiente, la corrida se bloquea o degrada a modo no calibrado con advertencia de incertidumbre alta.
3. **Predicción Validable vs. Simulación:**  
   Diferenciación matemática y conceptual estricta:
   - **Predicción (Qué se espera):** Proyección temporal basada en condiciones observadas y calibradas para horizontes `T+1 h`, `T+4 h` y `T+24 h`.
   - **Simulación (Qué pasaría si):** Intervención hipotética o evento sobre la base (`BASE`, `ESCENARIO`, `DELTA`).
4. **Verificación Ex-Post de Precisión:**  
   Registro persistente de cada predicción emitida para cotejarla con las observaciones reales posteriores. Cálculo auditable de:
   - **MAE (Mean Absolute Error)**.
   - **MAPE (Mean Absolute Percentage Error)**.
   - **Sesgo / Bias (Sobrestimación vs. Subestimación)**.
   - **Rango de Incertidumbre Empírica**.
5. **Calibración con Decisión Humana (Human-in-the-Loop):**  
   Cálculo de factores de calibración zonal sugeridos (`factorCalibracion = afluenciaObservada / afluenciaModeladaBase`), sometidos obligatoriamente a revisión de operador institucional con justificación y registro append-only en PostGIS.
6. **Interfaz en la Pestaña Simulación:**  
   Visualización de vínculos activos, semáforo de cobertura territorial, panel de calibración de zonas y pestaña de evaluación de precisión predictiva histórica.

---

## 2. Decisiones de Arquitectura y Estándares

### 2.1 Esquema de Vínculo Formal (`ModelVariableBindingRule`)
Un vínculo operativo no es una simple asociación clave-valor, sino un contrato técnico verificable:
- `id`: `bind_rule_{destinationId}_{modelId}_{variableId}`
- `sourceType`: `PID_S2` | `IOT_MQTT` | `PID_C4` | `MUNICIPAL_API` | `INGESTED_DATASET`
- `sourceId` / `sensorUrn`: Identificador del conector, sensor o dataset.
- `targetZoneId`: Zona geográfica del destino donde aplica la señal.
- `spatialCoverage`: `EXACT_ZONE` | `POINT_RADIUS` | `CORRIDOR` (con geometría o radio en metros).
- `modelVariableId`: Variable del paquete de modelo (ej. `visitantesHora`, `capacidadOperativaPct`).
- `unitConversion`: Factor multiplicador o función para normalizar a la unidad esperada (ej. `peatones/15min` a `peatones/hora` = factor `4.0`).
- `aggregationMethod`: `LATEST` | `TIME_WEIGHTED_AVERAGE` | `SUM_SENSORS` | `MEDIAN_MOVING_WINDOW`.
- `timeWindowMinutes`: Ventana de agregación (ej. 15, 60 minutos).
- `minQualityRequired`: `A_CERTIFICADA` | `B_ESTIMADA`.
- `approvalState`: `BORRADOR` | `APROBADO_OPERADOR` | `SUSPENDIDO`.
- `approvedBy`, `approvedAt`, `approvalRationale`.

### 2.2 Proceso de Calibración
1. El destino consulta las observaciones válidas y vigentes que caen dentro de las zonas vinculadas.
2. Si se cumple el requisito de cobertura (mínimo porcentaje de zonas críticas con señal activa), el motor calcula:
   $$\text{AfluenciaObservada}(z) = \text{Agregación}\Big(\sum \text{Señales}(z) \times \text{FactorConversión}\Big)$$
   $$\text{FactorCalibración}(z) = \frac{\text{AfluenciaObservada}(z)}{\text{AfluenciaBaseCatálogo}(z)}$$
3. El operador revisa la propuesta de calibración. Si la aprueba, se genera una `VersionCalibradaContexto` con huella SHA-256 única.
4. Las simulaciones posteriores pueden ejecutarse con bandera `usarCalibracionVigente=true`, quedando la huella del factor y del operador en la evidencia de la corrida.

### 2.3 Registro y Auditoría de Predicciones (`ModelForecastRecord`)
- Al emitir una predicción para un horizonte $H \in \{+1\text{h}, +4\text{h}, +24\text{h}\}$:
  - Se genera un registro con `forecastTimestamp` y `targetTimestamp`.
  - Se guardan los valores proyectados por zona e indicador.
- Pasado el horizonte, cuando se reciben observaciones reales correspondientes al `targetTimestamp`:
  - Se evalúa el error: $\text{ErrorAbsoluto} = |V_{\text{real}} - V_{\text{predicho}}|$, $\text{ErrorPct} = \frac{|V_{\text{real}} - V_{\text{predicho}}|}{V_{\text{real}}} \times 100$.
  - Se clasifica el sesgo: $\text{SOBREESTIMACION}$ si $V_{\text{predicho}} > V_{\text{real}}$, $\text{SUBESTIMACION}$ si $V_{\text{predicho}} < V_{\text{real}}$.
  - Se persiste en tabla `evaluaciones_prediccion_calibracion` con Row Level Security.

---

## 3. Plan de Cambios y Entregables

### 3.1 Base de Datos y Persistencia (`016_calibracion_prediccion_validable.sql`)
- Tabla `reglas_vinculo_calibracion`: Vínculos formales con geometría de cobertura, unidad, agregación, estado de aprobación y RLS.
- Tabla `versiones_calibracion_destino`: Instantáneas aprobadas de calibración con factores por zona, huella SHA-256 y firma de operador.
- Tabla `predicciones_horizontes_registro`: Proyecciones T+1, T+4 y T+24 con evidencia de calibración base.
- Tabla `evaluaciones_prediccion_observacion`: Cotejo ex-post de predicción vs dato real, con cálculo automático de MAE, MAPE y sesgo.

### 3.2 Contratos TypeScript
- `src/types/calibrationForecast.ts`: Definición rigurosa de reglas de vínculo, propuesta de calibración, decisión de operador, registro de predicción y métricas de error.

### 3.3 Servicios del Motor
- `src/services/formalDataBindingService.ts`: Gestor de reglas formales de vínculo, comprobación de cobertura territorial y calidad.
- `src/services/calibrationEngineService.ts`: Cálculo de propuestas de calibración, validación de tolerancias, aprobación humana y aplicación sobre `DestinationRuntime`.
- `src/services/forecastEvaluationService.ts`: Registro de predicciones por horizonte temporal y cálculo ex-post de calibración real frente a observaciones.
- Extensión del repositorio PostGIS (`postgisRepository.ts`) para soportar las consultas de la migración 016.

### 3.4 Endpoints en `server.ts`
- `GET /api/calibration/rules`: Lista de reglas formales de vínculo por destino y modelo.
- `POST /api/calibration/rules`: Creación de regla con validación de fuente y zona.
- `POST /api/calibration/rules/:id/approval`: Aprobación o suspensión humana de regla de vínculo.
- `POST /api/calibration/proposals/generate`: Generación de propuesta de calibración basada en telemetría reciente.
- `POST /api/calibration/proposals/apply`: Decisión de operador para aplicar y activar la calibración en el destino.
- `GET /api/calibration/active`: Consulta de la calibración vigente y su huella SHA-256.
- `POST /api/forecast/runs`: Ejecución y registro de predicción T+1h, T+4h o T+24h con desglose BASE/ESCENARIO/DELTA.
- `GET /api/forecast/evaluations`: Histórico de cotejo predicción vs real, MAPE, MAE y sesgo.
- `POST /api/forecast/evaluations/reconcile`: Ejecución del cálculo de discrepancia entre predicciones y observaciones.

### 3.5 Interfaz de Usuario
- `src/components/ModelCalibrationModal.tsx`:
  - Panel de Vínculos Formales y Cobertura Territorial por Zona.
  - Generador y Revisor de Propuestas de Calibración con aprobación humana explícita.
  - Monitor de Precisión Predictiva Histórica (gráficos/tablas de MAE, MAPE y sesgo).
- Botón de acceso en la barra superior y pestaña Simulación de `src/App.tsx`.

### 3.6 Suite de Validación Automatizada
- `scripts/validate_iteration14_calibration_forecast.sh`:
  1. Login y obtención de tokens JWT institucionales para Málaga y Palma.
  2. Creación de regla formal de vínculo fuente-variable-zona.
  3. Intento de uso de regla no aprobada (debe ser ignorada o degradada).
  4. Aprobación formal por operador institucional de Málaga.
  5. Generación de propuesta de calibración basada en observaciones reales S2 e IoT persistidas.
  6. Aprobación y persistencia de calibración con huella SHA-256.
  7. Ejecución de predicción para T+1h y T+4h con BASE/ESCENARIO/DELTA calibrados.
  8. Ingestión de observación real ex-post y reconciliación de error (MAE, MAPE y sesgo).
  9. Verificación de aislamiento estricto por RLS (Palma no puede acceder a las calibraciones de Málaga).

---

## 4. Compromisos de Transparencia y Datos
- **No Invención de Fuentes:** Toda calibración debe referenciar identificadores verificables de `conectores_semanticos_s2` o `conectores_iot_broker`.
- **Alerta de Incertidumbre:** Mientras las fuentes contengan datos de prueba o cobertura parcial (<80%), la incertidumbre global se mantendrá en `ALTA` o `MEDIA`.
- **RLS Forzada:** Cada regla y calibración estará protegida por `app.tenant_id` y `app.destino_id`.
