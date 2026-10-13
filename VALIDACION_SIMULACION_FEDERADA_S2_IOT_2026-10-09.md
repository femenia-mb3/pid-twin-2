# Validación funcional — Simulación federada con S2 e IoT

**Fecha de ejecución:** 9 de octubre de 2026, 07:59:16 UTC  
**Estado:** `COMPLETADO`  
**Alcance:** validación técnica de integración y trazabilidad; **no es una validación predictiva ni una conclusión operativa**.

## Objetivo

Comprobar que una ejecución federada Málaga–Palma puede incorporar de forma verificable las observaciones normalizadas provenientes de:

- **S2 / NGSI-LD** (`PID_S2`), y
- **telemetría IoT / MQTT** (`IOT_MQTT`),

sin mezclar datos crudos entre destinos, conservando huellas SHA-256, aislamiento por tenant y una advertencia explícita de cobertura/calidad.

## Configuración ejecutada

| Campo | Valor |
|---|---|
| Configuración federada | `fed_cfg_mv0m346s_6o8q` |
| Nombre | Federación Costera Málaga–Palma 2026 |
| Modelo | Capacidad de Carga y Presión en Playas Urbanas |
| Destino coordinador | Málaga |
| Participantes | Málaga y Palma |
| Política de intercambio | Solo indicadores agregados |
| Corrida | `fed-run-mv0ochu9-0x38` |

## Resultado federado

| Indicador agregado | BASE | ESCENARIO | DELTA |
|---|---:|---:|---:|
| Visitantes | 61.900 | 94.336 | +32.436 |
| Saturación media ponderada | — | 94,1 % | — |
| Alertas activas | — | 2 | — |
| Emisiones estimadas | — | 11.321 kg CO₂/h | — |
| Incertidumbre global | — | **ALTA** | — |

La incertidumbre es alta porque los contextos de los destinos continúan marcados como demostradores/sintéticos. El resultado permite comprobar el **flujo funcional** del gemelo, no validar una predicción sobre el territorio real.

## Evidencia semántica incorporada

### Málaga

| Elemento | Resultado comprobado |
|---|---|
| Modo de uso | `EVIDENCIA_OBSERVACIONAL_PARCIAL` |
| Compuerta de ejecución semántica | Activa (`true`) |
| Calibración cuantitativa de la base | No aplicada (`false`) |
| Observaciones elegibles y deduplicadas | 3 |
| Fuentes | `PID_S2`, `IOT_MQTT` |
| Zona asociada por geometría | `malaga_centro` |
| Señal observada agregada | 2.920 personas |
| Base territorial modelada de la zona | 14.200 personas |
| Cobertura de la señal frente a la base | 20,6 % |
| Observación más reciente | `2026-10-09T07:32:12.000Z` |

La instantánea incluye una señal S2 de recurso turístico y dos señales IoT de conteo de visitantes. Las observaciones se filtraron por: estado `VALIDADA`, elegibilidad para simulación, concepto `visitorCount`, unidad `P1`, vigencia máxima de 24 horas y asociación espacial a una zona del destino.

**Decisión de gobernanza:** el motor no sustituye automáticamente la afluencia de `malaga_centro` por 2.920. Esas señales tienen cobertura parcial y no existe todavía un vínculo aprobado que declare cobertura, unidad de agregación y transformación hacia la variable territorial del modelo. Por ello se utilizan como **compuerta de ejecución y evidencia observacional**, no como calibración numérica engañosa.

### Palma

No se detectaron observaciones S2/IoT elegibles y vigentes durante la ventana de 24 horas. La ejecución local de Palma se completó con su contexto demostrador, dejando la condición `SIN_ENTRADAS_SEMANTICAS_ELEGIBLES` en la evidencia.

## BASE / ESCENARIO / DELTA por destino

| Destino | BASE visitantes | ESCENARIO visitantes | DELTA | Saturación escenario |
|---|---:|---:|---:|---:|
| Málaga | 37.700 | 57.455 | +19.755 | 85,8 % |
| Palma | 24.200 | 36.881 | +12.681 | 102,4 % |

## Huellas de evidencia comprobable

| Evidencia | SHA-256 |
|---|---|
| Corrida federada | `0fa40f6be1de37325e99f8f6dfe07c892b1825be1df174119ae79db251e07831` |
| Instantánea semántica Málaga | `ca8d7f1f4b1d00954895db82531ce025b719ceb848ddd3ed3b42b17d5f518f64` |
| Instantánea Palma sin entradas elegibles | `9701fdbdc39a49cfd03195bfe941dfa89788edfeeac5acd8347229c0c9e0b8e0` |
| S2 Málaga | `b249598989b1ed9c4291f1fdc014e6e6f943eae90810c3639f4f2e4e7879f731` |
| IoT Málaga, sensor 1 | `a13ba6e588cb0f3d1b0c9b995a5e4c3210366c1eaf6ab952be03bcff591bdd98` |
| IoT Málaga, sensor 2 | `38eaac579a33ac444e2e00a729ece0d5141b4d2ab3097130ee7472afdb64c350` |

La corrida y sus evidencias fueron persistidas en PostGIS. Puede recuperarse para el destino coordinador mediante:

```text
GET /api/federation/runs/fed-run-mv0ochu9-0x38?destino=malaga
```

La consulta exige sesión institucional y scope de tenant; la API devuelve `Cache-Control: no-store`.

## Cambio técnico incorporado

Se ha añadido `SemanticSimulationInputService`, que construye una instantánea privada por destino antes de la ejecución federada. Esta instantánea:

1. consulta solo observaciones del tenant y destino local mediante RLS;
2. descarta datos no validados, no elegibles, no vigentes o con concepto/unidad incompatibles;
3. deduplica por fuente, sensor y concepto, usando la observación más reciente;
4. asocia la señal a la zona por geometría;
5. conserva identificadores y huellas de evidencia, sin exponer payloads crudos en el agregado federado;
6. incorpora la huella de los inputs a la huella de la corrida.

## Límites y siguiente requisito para calibración real

Esta ejecución **no demuestra precisión predictiva**. Para pasar de evidencia observacional a calibración cuantitativa se requiere, por cada fuente aplicada:

1. aprobación humana del conector y su finalidad de uso;
2. contrato de cobertura espacial y temporal por sensor o conjunto de sensores;
3. vínculo explícito de variable de modelo: campo, unidad, transformación y agregado;
4. datos históricos observados frente a predicciones por horizonte;
5. cálculo y publicación de error, sesgo e incertidumbre por destino;
6. telemetría real de Palma si se quiere que ambos participantes se calibren con señales semánticas.

> Las muestras utilizadas son demostradoras y el sistema las identifica como tales. No deben emplearse para decisiones operativas, informes de desempeño ni afirmaciones sobre afluencia real hasta que el destino conecte y autorice sus fuentes reales.
