# Informe independiente de validación — Interoperabilidad PID y catálogo de modelos

**Proyecto:** `/home/ubuntu/gemelotur`  
**Plan contrastado:** `plan.md`  
**Fecha de comprobación:** 2026-09-30  
**Modo de trabajo:** solo lectura sobre código y configuración; peticiones HTTP locales no persistentes exclusivamente contra la API ya en ejecución. No se editó implementación, no se instalaron dependencias, no se compiló y no se reiniciaron servicios.

> **Dictamen global: FAIL para aceptación completa.** La capa de contratos, los dos carriles, la relación PID, la UI transversal y la migración están implementados de forma coherente como demostrador. Sin embargo, el requisito de ciclo reutilizable (crear/publicar una plantilla propia) no está implementado y la validación de instancias acepta parámetros ajenos a la plantilla. Por ello no puede afirmarse que el flujo completo valide conectores y parámetros correctos.

## Resumen de criterios

| # | Criterio | Estado | Conclusión breve |
|---:|---|---|---|
| 1 | Capa explícita de interoperabilidad, conectores y dos carriles | **PASS** | Implementada como **contratos demo no conectados**, con separación, calidad, frecuencia, normalización, evidencia y ámbito de destino. |
| 2 | Catálogo reutilizable y ciclo crear → publicar → instalar → parametrizar | **FAIL** | Hay 10 plantillas y se pueden previsualizar/validar instancias, pero no existe creación ni publicación de modelos propios, ni parametrización conforme a variables de cada plantilla. |
| 3 | Relación explícita S2/C4/S11/S18/S15/S16/S17/S1/S7 | **PASS** | Los nueve servicios están declarados, con rol, tratamiento y privacidad. |
| 4 | Gemelo como módulo PID transversal, sin modificar los tres niveles | **PASS** | El control room abre un modal independiente y mantiene el selector de niveles cartográficos; la documentación describe su alcance transversal y sus límites. |
| 5 | Flujo fuente/carril → normalización → plantilla/instancia → API → modal → migración | **FAIL** | El flujo está trazado y la UI consulta/instancia correctamente en lo básico, pero la normalización es declarativa y la API no valida el esquema de parámetros de la plantilla; acepta uno arbitrario con `201`. |

---

## Evidencia y dictamen detallado

### 1. Capa explícita de interoperabilidad

**Estado: PASS (en el alcance declarado de contratos/configuración demo).**

**Evidencia de código**

- Los dos carriles están tipados en `src/types/interoperability.ts:1` como `ONTOLOGICO` y `NO_ONTOLOGICO_HISTORICO`.
- La arquitectura declara ambos carriles, fuentes, procesamiento y salida en `src/services/interoperabilityCatalogService.ts:82-120`:
  - Ontológico: S2, S1, recursos/activos normalizados, NGSI-LD y GeoJSON semántico (`:94-103`).
  - No ontológico/histórico: C4, API municipales, CSV, MQTT, ocupación y movilidad; conserva esquema fuente y metadatos (`:104-112`).
- Cada contrato de conector incluye destino/tenant, carril, tipo/formato, dominios, pasos de normalización, frecuencia, regla de calidad, estado, privacidad, finalidad y evidencia (`src/types/interoperability.ts:33-50`).
- Hay contratos concretos de S2, C4, MQTT e API municipal OGC para Málaga, y de S2, C4/CSV, CSV municipal y GeoJSON municipal para Palma (`src/services/interoperabilityCatalogService.ts:122-178`).
- La API expone arquitectura y conectores en `server.ts:199-233`, valida el carril solicitado en `:207-225` y fuerza `Cache-Control: no-store`/JSON en `:183-197`.

**Comprobación HTTP local no persistente**

- `GET http://127.0.0.1:3001/api/interoperability/architecture` respondió **200**, `Cache-Control: no-store`, JSON, dos carriles, flujo de 6 pasos y los nueve IDs PID.
- `GET .../connectors?destino=malaga` respondió `destinationId=malaga`, `tenantId=tenant_ayto_malaga`, 4 contratos, ambos carriles y tipos `PID_SERVICE`, `MQTT`, `OGC_API`.
- `GET .../connectors?destino=palma` respondió `destinationId=palma`, `tenantId=tenant_ayto_palma`, 4 contratos, ambos carriles y tipos `PID_SERVICE`, `CSV`, `GEOJSON`.
- Ambos resultados declaran `persistence: CONFIGURATION_DEMO_NOT_CONNECTED`.

**Matiz / limitación:** se materializa una **API municipal OGC**, no una instancia concreta de `REST_API`: aunque `REST_API` existe en el tipo (`src/types/interoperability.ts:2`), no aparece en los contratos efectivos. Si el requisito distingue API municipal REST de OGC API, falta un contrato `REST_API` explícito. OGC API cuenta razonablemente como API municipal geoespacial, pero esta equivalencia debe quedar decidida contractualmente.

---

### 2. Catálogo de modelos reutilizables

**Estado: FAIL.**

**Parte implementada**

- El catálogo estático contiene las 10 plantillas solicitadas: saturación turística, playas, eventos, movilidad, patrimonio, puertos y cruceros, nieve, espacios naturales, enoturismo y cicloturismo (`src/services/interoperabilityCatalogService.ts:191-202`).
- Cada plantilla declara versión, estado, carriles requeridos, fuentes mínimas, variables, regla y política de datos (`:181-189`).
- `GET /api/models/reusable?destino=palma` devuelve 10 modelos; la ruta devuelve `tenantId`, `destinationId`, `no-store` y JSON (`server.ts:235-249`).
- La migración prevé catálogo versionado con los estados `PRECONFIGURADO_PID`, `MODELO_PROPIO` y `REUTILIZABLE_PID` (`database/migrations/004_interoperabilidad_modelos.sql:46-66`) y siembra las 10 referencias (`:95-116`).

**Incumplimientos que motivan FAIL**

1. **No existe el ciclo de creación/publicación.** Solo hay rutas `GET` de catálogo/ficha y `POST /instantiate` (`server.ts:199-268`). No existe API ni UI para:
   - crear un modelo propio de un destino;
   - validar/publicar/promoverlo a `REUTILIZABLE_PID`;
   - controlar quién puede publicar una plantilla.

   En consecuencia, el ciclo comprometido en el plan —modelo propio → reglas/variables/evidencia → plantilla publicada → otro destino instala— está **documentado** (`CAPA_INTEROPERABILIDAD_Y_CATALOGO_MODELOS_PID.md:93-105`) y parcialmente modelado en SQL, pero no es una capacidad ejecutable.

2. **La parametrización no usa las variables del modelo elegido.** El modal muestra `selectedModel.variables` solo de forma indirecta en la ficha, pero su payload siempre envía los campos genéricos `factorLocal` y `prioridadOperativa` (`src/components/InteroperabilityModal.tsx:108-121`). No renderiza entradas para variables como `umbralAlerta`, `horizonte`, `capacidadObjetivo`, etc.

3. **La API no valida parámetros contra la plantilla.** `instantiate()` únicamente valida existencia de modelo/destino y presencia de carriles de los conectores (`src/services/interoperabilityCatalogService.ts:225-264`); no comprueba claves, tipo, rango, obligatoriedad ni valores por defecto de `model.variables`.

**Prueba HTTP determinante**

Se envió, de forma permitida y no persistente, un `POST` a:

```text
/api/models/reusable/modelo_saturacion_turistica/instantiate
{
  "destinationId": "malaga",
  "connectorIds": ["conn_malaga_s2_recursos", "conn_malaga_c4_historicos"],
  "parameters": {"notTemplateVariable": true}
}
```

El resultado fue **HTTP 201**, `valid: true`, `persistence: VALIDATED_NOT_PERSISTED`, y devolvió el parámetro ajeno sin error. Para Saturación turística, las variables declaradas son `umbralAlerta` y `horizonte` (`src/services/interoperabilityCatalogService.ts:192`). Esta aceptación demuestra que la instancia no queda parametrizada ni validada conforme a la plantilla.

**Acción correctiva requerida**

- Añadir operaciones autenticadas de creación de modelo propio, revisión/publicación y despublicación, con trazabilidad del publicador y autorización tenant/destino.
- Construir los campos del modal desde `selectedModel.variables`, enviar exclusivamente esas claves y sus valores locales.
- En servidor, validar el payload contra el esquema/versionado de la plantilla: claves permitidas, campos requeridos, tipos, unidades/rangos y rechazo de parámetros desconocidos con `422`.

---

### 3. Relación explícita con servicios PID

**Estado: PASS.**

**Evidencia**

- El tipo restringe los IDs a `S1`, `S2`, `C4`, `S7`, `S11`, `S15`, `S16`, `S17`, `S18` (`src/types/interoperability.ts:25-30`).
- `PID_SERVICE_RELATIONS` define los nueve servicios en el orden S2, C4, S11, S18, S15, S16, S17, S1 y S7 (`src/services/interoperabilityCatalogService.ts:16-80`), con función, tratamiento de datos, regla de privacidad y evidencia:
  - **S2:** armonización ontológica y JSON-LD/NGSI-LD (`:17-23`).
  - **C4:** históricos/no ontológicos conservando esquema y metadatos (`:24-30`).
  - **S11:** explotación geoespacial/territorial (`:31-37`).
  - **S18:** previsión, simulación, alertas y recomendaciones (`:38-44`).
  - **S15/S16/S17/S1/S7:** fuentes complementarias con condiciones de finalidad, minimización, licencia, privacidad o autorización (`:45-79`).
- La relación aparece en la UI (`src/components/InteroperabilityModal.tsx:221-233`) y en la documentación (`CAPA_INTEROPERABILIDAD_Y_CATALOGO_MODELOS_PID.md:64-72`).
- La respuesta comprobada de arquitectura incluyó exactamente esos nueve IDs.

---

### 4. Gemelo como módulo transversal PID

**Estado: PASS.**

**Evidencia**

- El control room tiene una acción independiente **Interoperabilidad PID** (`src/App.tsx:244-253`) y monta el modal con el destino actualmente seleccionado (`src/App.tsx:819-823`).
- El modal se identifica expresamente como **Módulo transversal**, explica normalización por carriles y reutilización sin replicar el motor (`src/components/InteroperabilityModal.tsx:142-147`).
- El selector de destino de la aplicación continúa separado de los tres controles de representación geoespacial (`src/App.tsx:192-203` frente a `:207-241`). El modal no escribe `nivelVisualizacion`; por tanto, no modifica los niveles 1/2/3.
- La documentación confirma que los tres niveles cartográficos se mantienen sin cambios (`CAPA_INTEROPERABILIDAD_Y_CATALOGO_MODELOS_PID.md:32-36`) y posiciona el gemelo como capacidad transversal que gobierna heterogeneidad y escala con configuración local (`:146-148`).

**Limitación:** no se efectuó una prueba visual automatizada de interacción del navegador. La conclusión se funda en la composición React y en la respuesta HTTP del proxy de desarrollo, que confirmó que la ruta relativa `/api/interoperability/architecture` pasa de Vite a Express con 200/no-store (`vite.config.ts:14-19`).

---

### 5. Flujo fuente/carril → normalización → plantilla/instancia → API → modal → migración

**Estado: FAIL.**

**Eslabones confirmados**

1. **Fuente/carril y normalización declarada:** la arquitectura presenta seis pasos (`src/services/interoperabilityCatalogService.ts:85-93`); los conectores traen carril y pasos de normalización (`:122-178`).
2. **API:** el endpoint de instancia valida modelo, destino y que todos los carriles requeridos estén presentes (`src/services/interoperabilityCatalogService.ts:225-246`; `server.ts:258-268`). Una invocación equivalente a la que realiza el modal para Saturación/Málaga devolvió `201`, `VALIDATED_NOT_PERSISTED`, tenant, destino y los cuatro conectores de Málaga.
3. **Modal:** carga arquitectura, conectores y modelos en paralelo contra rutas relativas (`src/components/InteroperabilityModal.tsx:56-82`); al cambiar destino reinicia la selección y carga conectores/modelos para el nuevo `destino` (`:102-106`); el POST usa el ID del modelo seleccionado y el destino local (`:108-121`).
4. **Migración:** la transición propuesta está recogida por `004_interoperabilidad_modelos.sql`, revisada en el apartado siguiente.

**Defectos que impiden validar el flujo completo**

- La normalización del flujo es un contrato/descripción, no una tubería que produzca y asocie una salida normalizada a la instancia. No hay endpoint de ingestión/normalización por conector ni relación ejecutada desde esa salida al modelo; la API solo analiza IDs y carriles.
- El modal vincula **automáticamente todos** los conectores cuyo carril esté requerido (`src/components/InteroperabilityModal.tsx:95-100`). No permite escoger las fuentes mínimas concretas ni impide elegir implícitamente contratos `PENDIENTE_AUTORIZACION`.
- El error de validación de parámetros probado por HTTP permite aprobar una instancia que no contiene las variables de su plantilla. Esto invalida el requisito de “manda conectores/parámetros correctos”.
- Existe un riesgo menor de coherencia bajo cambios de destino muy rápidos: `load()` no cancela ni secuencia respuestas pendientes (`src/components/InteroperabilityModal.tsx:56-82,102-106`), por lo que una respuesta anterior podría sobrescribir el estado de una selección posterior.

**Acción correctiva requerida**

1. Representar y persistir/validar una salida de normalización por conector con origen, mapeo, calidad, frecuencia y trazabilidad.
2. Ofrecer selección explícita de conectores elegibles para cada requisito de fuente, filtrando estados no autorizados o solicitando una aceptación explícita de modo demo.
3. Implementar la validación de parámetros indicada en el criterio 2.
4. Usar `AbortController`, un contador de solicitud o comprobar `destinationId` al resolver `Promise.all` para evitar respuestas obsoletas.

---

## Revisión de migración y aislamiento

**Dictamen: PASS para consistencia estática con el aislamiento previo; UNVERIFIED en aplicación real de RLS.**

- La migración 003 define la clave única compuesta `uq_perfil_semantico_tenant_destino` sobre `(tenant_id, destino_id)` (`database/migrations/003_ontologia_multidestino.sql:22-42`).
- La 004 referencia correctamente esa clave desde contratos de fuente (`004...sql:35-38`) e instancias (`:82-85`), y referencia la versión de la plantilla mediante FK compuesta `(modelo_id, modelo_version)` (`:86-89`).
- La 004 habilita RLS para `fuentes_interoperabilidad_destino` e `instancias_modelo_destino` (`:118-120`) y ambas políticas restringen tanto lectura como escritura con el par `current_setting('app.tenant_id', true)` / `current_setting('app.destino_id', true)` (`:122-142`). El patrón es coherente con el ya usado en 003 (`003...sql:167-205`).
- La evidencia aportada por el solicitante indica que la migración pasó parser PostgreSQL; no se repitió el parser ni se aplicó SQL sobre una base de datos durante esta validación de solo lectura.

**Caveats y acciones correctivas de la migración**

1. `fuentes_vinculadas` de `instancias_modelo_destino` es `JSONB` (`004...sql:77-79`), no una tabla puente con FK hacia `fuentes_interoperabilidad_destino`. No puede garantizar por base de datos que cada fuente exista, pertenezca al mismo tenant/destino o cumpla carriles requeridos. Crear una tabla puente con `(instancia_id, tenant_id, destino_id, fuente_id)` y FKs compuestas eliminaría esta brecha.
2. `catalogo_modelos_reutilizables` es global y no tiene RLS (`:46-66`). Es razonable para plantillas ya publicadas y compartidas, pero no es suficiente para borradores `MODELO_PROPIO`: al habilitar CRUD deben separarse borradores privados, revisión/publicación y lectura pública/reutilizable mediante políticas o vistas.
3. RLS debe verificarse con un rol de aplicación no propietario —requisito ya documentado en 003 (`003...sql:167-169`)— y con pruebas cruzadas tenant/destino. PostgreSQL puede permitir bypass por propietarios/superusuarios; esta validación no tuvo una sesión SQL ni alteró datos, por lo que el comportamiento efectivo queda **UNVERIFIED**.

---

## Transparencia sobre conectores externos

**Conforme.** No se ha presentado evidencia de que S1/S2/C4/S7/S11/S15/S16/S17/S18, municipios o MQTT estén realmente conectados. Al contrario, la implementación lo declara de forma suficientemente transparente:

- El servidor afirma que ninguna ruta invoca servicios PID externos en demo (`server.ts:183-185`).
- Los resultados de conectores incluyen `CONFIGURATION_DEMO_NOT_CONNECTED` (`server.ts:217-225`).
- El modal advierte que los estados no prueban una conexión externa activa y exige autorización, credenciales, finalidad, calidad y privacidad (`src/components/InteroperabilityModal.tsx:183-188`).
- La documentación declara expresamente que la entrega no establece conexión efectiva y necesita contratos, credenciales y evaluación de privacidad (`CAPA_INTEROPERABILIDAD_Y_CATALOGO_MODELOS_PID.md:5-8, 47-62`).
- Una búsqueda de las unidades de interoperabilidad no halló clientes HTTP/MQTT externos; los únicos `fetch()` pertinentes son las rutas relativas propias del modal.

## Limitaciones de esta validación

- Se asumieron como evidencia permitida los resultados previos de `pnpm build`, `git diff --check` y parser PostgreSQL; no se ejecutaron compilaciones ni cambios de base de datos.
- Las peticiones HTTP se dirigieron al servidor local existente `127.0.0.1:3001` y, para una comprobación de enrutamiento, al proxy Vite ya en ejecución en `127.0.0.1:3000`. Todos los `POST` realizados respondieron `VALIDATED_NOT_PERSISTED`; no hubo escritura funcional de instancia.
- No se auditó ni se intentó conectar ningún sistema PID, municipal ni broker MQTT externo, porque la propia solución los declara inactivos y la misión exige modo solo lectura.
- No se ejecutaron pruebas de RLS contra PostgreSQL ni pruebas E2E de navegador; por ello se distingue entre la consistencia estática confirmada y el comportamiento operativo aún no verificado.

## Condición para convertir el dictamen global en PASS

Implementar y probar: **(1)** creación/revisión/publicación controlada de modelos propios, **(2)** editor de parámetros basado en cada `model.variables`, **(3)** validación de esquema/rangos y rechazo de parámetros desconocidos en servidor, **(4)** vinculación explícita y autorizada de fuentes, idealmente con FK relacional, y **(5)** pruebas cruzadas de RLS con rol no propietario. Tras ello, repetir la prueba de instanciación con parámetros correctos e incorrectos y comprobar `201`/`422` respectivamente.
