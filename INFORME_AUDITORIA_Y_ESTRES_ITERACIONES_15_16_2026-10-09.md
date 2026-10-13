# Informe de auditoría y prueba conjunta — Iteraciones 15 y 16

**Fecha de ejecución:** 9 de octubre de 2026  
**Ámbito:** Gemelo Digital Turístico PID/SEGITTUR — backend local de demostración con PostgreSQL 16/PostGIS 3.4  
**Estado del backend durante la comprobación:** `ONLINE`, modo `POSTGIS_PERSISTED_PILOT`, persistencia conectada y RLS activa.

> **Alcance y cautela:** este documento acredita una prueba controlada con datos de prueba y un modelo paramétrico. No acredita la operación real de medidas físicas, policiales, de movilidad o de comunicación ciudadana; tampoco equivale a una predicción oficial ni a una validación económica oficial.

---

## 1. Alcance revisado

Se revisaron:

1. Los incidentes de colapso, planes de intervención y decisiones humanas inmutables creados por los agentes de respuesta rápida de la **Iteración 16**.
2. Los controles de persistencia PostGIS: relaciones de alcance `tenant_id + destino_id`, RLS forzada, privilegios de la cuenta de aplicación y disparadores de inmutabilidad.
3. La integración entre:
   - simulación macroeconómica de la **Iteración 15**;
   - prueba de estrés por horizontes **T+1, T+4 y T+24**;
   - detección y respuesta del agente autónomo de la **Iteración 16**.
4. El mantenimiento de la compuerta humana: el escenario combinado no firma ni autoriza medidas operativas de Nivel 2.

---

## 2. Resultado de la auditoría de registros inmutables

### Integridad persistida en PostGIS

| Elemento auditado | Registros | Huellas SHA-256 inválidas | Incoherencias de tenant/destino |
|---|---:|---:|---:|
| Incidentes de colapso | 6 | 0 | — |
| Planes de intervención | 6 | 0 | — |
| Decisiones humanas inmutables | 3 | 0 | 0 |

Las tres decisiones históricas existentes son decisiones de operador ya cerradas; están enlazadas con un plan e incidente del mismo tenant y destino. La prueba nueva no añadió ninguna decisión humana.

### Controles comprobados

| Control | Evidencia comprobada | Resultado |
|---|---|---|
| Inmutabilidad de decisiones | Trigger `trg_decisiones_intervencion_immutable` sobre `decisiones_intervencion_agente` antes de `UPDATE` o `DELETE`. | Activo |
| Transición gobernada de planes | Trigger `trg_enforce_intervention_plan_transition` antes de `INSERT`/`UPDATE` sobre `planes_intervencion_rapida`. | Activo |
| Consistencia territorial | Claves foráneas compuestas desde planes a incidentes y desde decisiones a planes: `(id, tenant_id, destino_id)`. | Activa |
| RLS | `relrowsecurity = true` y `relforcerowsecurity = true` en incidentes, planes y decisiones. | Activa |
| Mínimo privilegio | `gemelotur_app` no puede actualizar ni borrar decisiones inmutables. | Confirmado |

> Las decisiones humanas son **append-only**. El cierre de un plan exige un registro previo de decisión y un plan ya cerrado no puede volver a transicionar.

---

## 3. Prueba de estrés simultánea: macroeconomía + agente autónomo

### Condiciones de la ejecución

| Campo | Valor |
|---|---|
| Destino | Málaga (`tenant_ayto_malaga`) |
| Etiqueta de ejecución | `i15-i16-20261009T112429Z` |
| Escenario de prueba | `COLAPSO_EVENTO_EXTRAORDINARIO` |
| Choque macroeconómico | +110 % de afluencia modelada |
| Ramas ejecutadas en paralelo | Impacto macroeconómico, estrés territorial y evaluación del agente |
| Duración registrada | 47 ms |
| Acción física o externa | **No ejecutada** |
| Firma humana de Nivel 2 | **No realizada** |

### Resultado macroeconómico

| Métrica | Resultado |
|---|---:|
| Identificador | `sim_macro_mv0voew2_a0n8` |
| Estado de incertidumbre | `CALIBRADA_EMPIRICA` en el contrato de la ejecución |
| Delta de VAB estimado | 5.301.193,04 € |
| Delta de externalidades estimado | 83.769,40 € |
| Huella de evidencia | `3baf970831c572f1e4503fed8d79de0ee28c8dd106a51c09d02dc7c7535fa70e` |

> Los valores económicos son resultados del modelo paramétrico/calibrado disponible en el entorno de demostración. No deben utilizarse como valoración económica oficial sin validación con fuentes municipales, C4/S2 y metodología económica aprobada.

### Resultado del estrés territorial

| Horizonte | Puntuación de resiliencia |
|---|---:|
| T+1 | 61 / 100 |
| T+4 | 22 / 100 |
| T+24 | 46 / 100 |

- **Veredicto global:** `RIESGO_COLAPSO_INMINENTE`.
- **Identificador:** `stress_mv0voevk_cutg`.
- **Huella de evidencia:** `19585288fce2a75fedc948083710d3cc82b54735534c0889d3cc731ae44803f6`.

### Resultado del agente de respuesta rápida

| Control | Resultado |
|---|---|
| Incidente | `inc_malaga_mv0voevs` |
| Severidad | `ROJA_COLAPSO_INMINENTE` |
| Plan generado | `plan_resp_mv0voevw` |
| Estado persistido del plan | `PENDIENTE_FIRMA_HUMANA` |
| Decisiones humanas asociadas al plan | 0 |
| Acciones informativas Nivel 1 | 2, marcadas como preaprobadas por directiva en la simulación |
| Medidas Nivel 2 | 2, ambas `PENDIENTE` de firma humana |
| Huella del incidente | `fd24d0c5a39d794ea93fd73c5d98cbfc4adcfeb128eff78d98aafd6d7cffb913` |
| Huella del plan | `2916f6d3972bacbfae4600ecaa6e70dab09be6b18a5031324d5b97ea09465dc0` |

La prueba confirma que las acciones de Nivel 1 se representan como respuesta informativa calculada dentro del plan; **no existe en este entorno ningún cliente HTTP, webhook o conector que haya activado PMV, app, Policía Local, movilidad o recursos físicos externos**. Las acciones de Nivel 2 no se autorizaron.

---

## 4. Evidencia reproducible

La evidencia de la ejecución endurecida se conserva en el directorio de validación:

| Artefacto | Contenido |
|---|---|
| `macro.json` | Resultado macroeconómico persistido y su huella de servicio. |
| `stress.json` | Resultado T+1/T+4/T+24 y veredicto global. |
| `agent.json` | Incidente, plan, acciones y controles human-in-the-loop. |
| `db-evidence.json` | Consulta de plan y decisiones bajo PostGIS. |
| `audit-database.json` | Integridad global, RLS y privilegios de aplicación. |
| `summary.json` | Resumen de negocio, huella compuesta y huellas de cada artefacto fuente. |
| `SHA256SUMS.txt` | Manifiesto SHA-256 de los seis ficheros anteriores. |

La huella compuesta de la ejecución es:

```text
e113027d6ffd8f98087e82d42981051118272303be3bf17f52736e806500fe54
```

La verificación `sha256sum -c SHA256SUMS.txt` devolvió **OK** para los seis artefactos.

---

## 5. Correcciones aplicadas durante la revisión

1. **Preaprobación correcta de aviso a visitantes.** Se corrigió el paso `AVISO_APP_VISITANTES` para que evalúe su propia directiva, no la del PMV. La prueba integrada exige ahora de forma explícita que ese aviso sea Nivel 1, preaprobado y autónomo.
2. **Credenciales fuera del código de validación.** Los validadores de las Iteraciones 15 y 16 ya no contienen credenciales literales: exigen variables de entorno de corta duración.
3. **Pruebas mutantes protegidas.** Los validadores históricos de I15/I16 requieren explícitamente `ALLOW_MUTATING_DEMO_TESTS=1` y únicamente admiten el backend local de demostración. Esto evita su ejecución accidental contra un entorno compartido.
4. **Evidencia reforzada.** El ejecutor combinado limita el destino al backend local, valida el formato de identificadores antes de la consulta SQL, no autoriza planes, conserva el resultado de base de datos y añade al manifiesto las huellas de cada artefacto fuente.

---

## 6. Hallazgos pendientes antes de un piloto institucional o producción

| Prioridad | Hallazgo | Acción necesaria |
|---|---|---|
| Alta | El servicio JWT conserva una clave de respaldo de demostración si no se inyecta una clave institucional. | Eliminar el respaldo, cargar `MANUS_JWT_SECRET` únicamente mediante secreto gestionado, rotar tokens y comprobar el arranque fallido si falta el secreto. |
| Alta | La migración histórica de operadores de demostración contiene claves de inicio de ejemplo. | Sustituir el bootstrap por provisión mediante secretos/identidad OIDC, rotar las claves locales y aplicar higiene de historial antes de una entrega externa. |
| Alta | Los validadores I15/I16 ejercitan decisiones y consultas de manipulación para verificar triggers. | Ejecutarlos solo contra una base efímera de CI o una instancia aislada; nunca contra una base compartida o productiva. |
| Media | Los resultados macroeconómicos y de estrés son un escenario de prueba, no una observación real de producción. | Conectar y aprobar vínculos formales de datos reales S2, IoT, C4 y fuentes municipales antes de declarar validez operativa. |
| Media | La evidencia local está protegida por SHA-256, no por firma institucional ni almacenamiento WORM. | Añadir firma institucional y almacenamiento inmutable/versionado para auditoría de producción. |

---

## Conclusión

La línea completa **Iteración 15 → Iteración 16** funciona en el entorno de demostración: el choque se modela en paralelo, el estrés alcanza el estado de colapso, el agente genera un incidente y un plan, y la compuerta de firma humana mantiene las medidas operativas en estado pendiente.

La evidencia persistida, el aislamiento RLS, las huellas SHA-256 y la inmutabilidad de decisiones quedan verificados para este caso. La prueba **no** ejecutó medidas físicas ni externas y debe presentarse como una validación técnica de demostración hasta cerrar los hallazgos de identidad, secretos y datos reales.
