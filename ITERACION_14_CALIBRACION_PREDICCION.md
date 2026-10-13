# Informe Técnico — Iteración 14: Calibración Real y Predicción Validable

## 1. Resumen Ejecutivo y Objetivos Cumplidos

La **Iteración 14** formaliza y desacopla la capacidad predictiva y de calibración del Gemelo Digital Turístico PID/SEGITTUR, resolviendo las limitaciones de simulaciones puramente paramétricas sin anclaje a fuentes verificables.

En esta iteración se ha implementado:
1. **Gobernanza Estricta de Vínculos Fuente → Modelo**: La cadena formal `fuente/sensor → cobertura territorial → zona → variable → unidad → transformación → agregación → frecuencia → calidad mínima`. Ningún dato S2, IoT o C4 se aplica al motor si no existe una regla aprobada por el operador institucional.
2. **Propuestas de Calibración con Acotación de Seguridad (Clamping)**: Cálculo automático de factores zonales (`señal observada / base de catálogo`), limitado entre límites seguros `[0.40, 2.50]` con score de confianza y firma humana obligatoria.
3. **Predicción Validable por Horizontes (T+1 h, T+4 h, T+24 h)**: Emisión formal de predicciones sobre condiciones observadas proyectadas, diferenciando claramente predicción de simulación (hipótesis de intervención) y preservando `BASE / ESCENARIO / DELTA`.
4. **Reconciliación Ex-Post y Monitor de Precisión Histórica**: Comparación automática de predicciones emitidas frente a observaciones reales posteriores, cálculo de **Error Absoluto (MAE)**, **Error Porcentual (MAPE)**, **Sesgo** (`SOBREESTIMACION`, `SUBESTIMACION`, `NEUTRO`) y tasa de fiabilidad empírica.
5. **Auditoría Inmutable y RLS PostGIS**: Migración `016_calibracion_prediccion_validable.sql` con Row Level Security estricta forzada por tenant y destino, y trigger de inmutabilidad `fn_prevent_audit_tampering()`.

---

## 2. Arquitectura de Gobernanza y Flujo de Calibración

```
[ Sensor IoT / NGSI-LD S2 ] ──> [ Observación Validada ]
                                         │
                                         ▼ (Regla Formal Aprobada)
               [ Regla de Vínculo: Zona + Multiplicador + Agregación ]
                                         │
                                         ▼
            [ Propuesta Técnica de Calibración: Factores Zonales ]
                                         │
                                         ▼ (Revisión Humana Obligatoria)
            [ Firma Operador Institucional + Justificación Rationale ]
                                         │
                                         ▼
                 [ Calibración Vigente en PostGIS (RLS) ]
                                         │
                                         ▼
            ┌────────────────────────────┴───────────────────────────┐
            │                                                        │
            ▼                                                        ▼
   [ Predicción Validable ]                                [ Simulación Paramétrica ]
   (Condiciones Observadas Proyectadas)                    (Hipótesis / Intervención)
   • Horizontes: T+1, T+4, T+24                            • BASE / ESCENARIO / DELTA
   • Registro previo inmutable                             • Comparativa territorial
            │
            ▼ (Momento Objetivo)
   [ Reconciliación Ex-Post ]
   • Valor Real Observado
   • Error MAE + MAPE %
   • Sesgo (Bias) & Fiabilidad
```

---

## 3. Contratos de Datos y Esquema de Base de Datos

### Migración `016_calibracion_prediccion_validable.sql`
- **`reglas_vinculo_calibracion`**: Almacena las reglas formales de enlace entre sensores y variables del modelo con RLS. Estados: `BORRADOR`, `APROBADO_OPERADOR`, `SUSPENDIDO`.
- **`versiones_calibracion_destino`**: Histórico inmutable de versiones de calibración aprobadas con huella criptográfica SHA-256.
- **`predicciones_horizontes_registro`**: Registro de predicciones por horizonte (`T+1`, `T+4`, `T+24`) previo a la llegada del momento objetivo.
- **`evaluaciones_prediccion_observacion`**: Tabla append-only con trigger `fn_prevent_audit_tampering()` para almacenar el cotejo de predicción frente a la realidad.

---

## 4. Endpoints Expuestos en la API

| Método | Endpoint | Descripción | Control de Acceso |
|---|---|---|---|
| `GET` | `/api/calibration/rules` | Lista reglas formales por destino y modelo | Scoped JWT + Tenant |
| `POST` | `/api/calibration/rules` | Registra nueva regla en estado `BORRADOR` | Operador Destino |
| `POST` | `/api/calibration/rules/:id/approval` | Aprueba o suspende regla con justificación | Operador Destino |
| `GET` | `/api/calibration/coverage` | Informe de cobertura territorial por zona | Scoped JWT + Tenant |
| `POST` | `/api/calibration/proposals/generate` | Genera propuesta técnica de factores zonales | Operador Destino |
| `POST` | `/api/calibration/proposals/apply` | Firma y activa calibración (`ACTIVA_VIGENTE`) | Operador Destino |
| `GET` | `/api/calibration/active` | Consulta calibración activa vigente | Scoped JWT + Tenant |
| `POST` | `/api/forecast/runs` | Emite y registra predicción para T+1/T+4/T+24 | Operador Destino |
| `GET` | `/api/forecast/runs` | Lista predicciones emitidas | Scoped JWT + Tenant |
| `POST` | `/api/forecast/evaluations/reconcile`| Reconcilia predicción con observación real | Operador Destino |
| `GET` | `/api/forecast/accuracy` | Resumen de precisión histórica (MAE/MAPE/Sesgo)| Scoped JWT + Tenant |

---

## 5. Resultados de la Suite Automatizada (`scripts/validate_iteration14_calibration_forecast.sh`)

La suite de validación ejecutó 10 pruebas exhaustivas superando todos los criterios de aceptación:

```text
=== INICIANDO VALIDACIÓN ITERACIÓN 14: CALIBRACIÓN Y PREDICCIÓN ===
✓ TEST 1: Operadores autenticados correctamente con tokens JWT institucionales.
✓ TEST 2: Cobertura territorial evaluada para Málaga: 0% de zonas cubiertas.
✓ TEST 3: Regla formal de vínculo creada en BORRADOR con ID bind_rule_malaga_mod_afluencia_peatonal_ejes_visitantesHora_malaga_centro_historico y huella SHA-256.
✓ TEST 4: Regla formal aprobada por el operador institucional (APROBADO_OPERADOR).
✓ TEST 5: Propuesta de calibración generada (cal_prop_mv0paa5g_nllf), factor promedio ×1.
✓ TEST 6: Calibración firmada y activada como ACTIVA_VIGENTE (cal_act_mv0paa63_95gq).
✓ TEST 7: Predicción T+4 registrada con éxito (fc_run_mv0paa6u_9f3v, 37700 pax).
✓ TEST 8: Predicción reconciliada ex-post: Error Absoluto=80 pax, Error Relativo=0.21%, Sesgo=SOBREESTIMACION.
✓ TEST 9: Precisión histórica acumulada consultada (1 evaluaciones registradas).
✓ TEST 10: Aislamiento RLS multidestino forzado y verificado (403 Forbidden para operador cruzado).
=== VALIDACIÓN COMPLETADA CON ÉXITO: 10/10 CASOS SUPERADOS ===
```

---

## 6. Interfaz de Usuario Creada (`ModelCalibrationModal.tsx`)

Se ha integrado el modal interactivo accesible desde la barra superior y desde el panel lateral de simulación de `App.tsx`:
1. **Pestaña Vínculos y Cobertura**: Diagnóstico con semáforo porcentual por zona, formulario para vincular sensores y listado de reglas para aprobación humana.
2. **Pestaña Calibración de Factores**: Visualización de la calibración activa, botón para generar propuesta técnica zonal, tabla comparativa de valores observados vs base y formulario de firma del operador.
3. **Pestaña Predicción Validable**: Selector de horizontes (T+1 h, T+4 h, T+24 h), panel de error histórico acumulado (MAPE, MAE y Fiabilidad) y listado de predicciones con trazabilidad.
