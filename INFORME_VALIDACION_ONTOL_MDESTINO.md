# Informe independiente de validación — Ontología SEGITTUR y modelo multidestino

**Proyecto:** `/home/ubuntu/gemelotur`  
**Plan contrastado:** `plan.md`  
**Fecha de revisión:** 2026-09-29  
**Modo de revisión:** solo lectura. No se editaron artefactos del producto, no se instalaron dependencias, no se compiló ni se reinició ningún servicio. La única escritura derivada de la solicitud es este informe. Las llamadas `POST` se limitaron a los endpoints declarados como validación/normalización **sin persistencia**.

## Dictamen ejecutivo

**Resultado global: FAIL.**

Hay una implementación funcional demostrable para el flujo de descubrimiento, perfiles, entidades, validación y consulta UI. No obstante, existen tres incumplimientos materiales frente a los criterios completos:

1. Las restricciones SHACL no cubren `TourismEvent`, `SimulationScenario` ni `DataSource`/procedencia; además, varias formas apuntan a clases `pid:` distintas de las clases `estur:` que emite el contexto para las entidades de intercambio.
2. La migración guarda `tenant_id` y `destino_id`, pero no impone que ambos pertenezcan al mismo perfil; tampoco activa RLS. Por tanto, el aislamiento multidestino se declara pero no queda garantizado por la capa persistente.
3. Las respuestas exitosas de la API semántica cumplen `application/ld+json` y `Cache-Control: no-store`, pero las respuestas semánticas de error devuelven `application/json` y carecen de `Cache-Control: no-store`.

| Criterio | Estado | Conclusión breve |
|---|---|---|
| 1. Perfil ontológico SEGITTUR | **FAIL** | Artefactos y mapeo presentes, pero SHACL incompleto y con desacople de clases frente al contexto de intercambio. |
| 2. Modelo multidestino PostGIS | **FAIL** | La migración existe y no altera tablas previas, pero el aislamiento `tenant_id`/`destino_id` no está impuesto ni protegido con RLS. |
| 3. APIs NGSI-LD | **PASS** | Descubrimiento, perfiles, entidades normalizadas y validación mínima requeridos están implementados y comprobados. |
| 4. Control room | **PASS** | Existe acceso modal no invasivo, enlazado a APIs, con Málaga, Palma, capacidades, cobertura y evidencia. |
| 5. Documentación y validación | **FAIL** | Documentación y camino exitoso correctos; incumplimiento de cabeceras/medio en rutas semánticas de error. |

> El `pnpm build` se considera evidencia histórica permitida por la solicitud; no se ejecutó de nuevo. Además, `tsconfig.json:20` incluye solo `src`, por lo que no constituye por sí solo una comprobación de tipo de `server.ts`.

## Alcance y evidencia de ejecución

Se comprobó el flujo estático **perfil → API → entidades → UI** y se hicieron peticiones no persistentes contra el servidor fuente en `127.0.0.1:3001` (y, para el flujo integrado de desarrollo, mediante el proxy Vite en `127.0.0.1:3000`).

- El proxy UI→API está configurado en `vite.config.ts:14-19`: `/api` se reenvía a `http://127.0.0.1:3001`.
- Se observó el servidor Express en el puerto 3001 y Vite en el 3000. No fueron iniciados, detenidos ni reconfigurados durante esta revisión.
- Las tres copias del contexto —`ontology/`, `public/ontology/` y `dist/ontology/`— son JSON válido, contienen 76 términos y tienen el mismo SHA-256: `36f3bb4fc4a755cccab16a92a1457fccad849ab77f9a2d185cd934784e54b218`.

### Pruebas HTTP no persistentes realizadas

| Prueba | Resultado observado |
|---|---|
| `GET /api/semantic/model` | `200`, `Content-Type: application/ld+json; charset=utf-8`, `Cache-Control: no-store`. |
| `GET /api/semantic/profiles` | `200`, JSON-LD/no-store; devuelve **2** perfiles: `malaga` y `palma`. |
| `GET /api/semantic/entities?destino=palma&type=TourismZone` | `200`, JSON-LD/no-store; devuelve **2** entidades, todas `TourismZone` y relacionadas con `urn:ngsi-ld:TouristDestination:palma`. |
| `GET /ontology/segittur-pid-context-v1.jsonld` | `200`, `Content-Type: application/ld+json`; contexto JSON válido. |
| `POST /api/semantic/validate` con zona Palma válida | `200`, `valid: true`; normaliza `@context` a arreglo. No persiste datos. |
| `POST /api/semantic/validate` con URN/contexto/destination/location inválidos | `422`, con errores explícitos para `id`, `@context`, `destination` y `location`. |
| `POST /api/semantic/normalize` con zona Palma válida | `201`, JSON-LD/no-store, `persistence: "VALIDATED_NOT_PERSISTED"`; consistente con el modo demo declarado. |
| `GET` de errores semánticos (`profiles/no-existe`, destino inexistente, tipo no soportado) | `404`/`400`, pero `Content-Type: application/json; charset=utf-8` y **sin** `Cache-Control: no-store`. |

## Resultado por criterio

## 1. Perfil ontológico SEGITTUR — **FAIL**

### Evidencia satisfactoria

- Existe un contexto JSON-LD versionado: `ontology/segittur-pid-context-v1.jsonld` y su copia publicada en `public/ontology/segittur-pid-context-v1.jsonld`.
- El prefijo oficial es explícito: `estur: "https://ontologia.segittur.es/turismo/def/core#"` (`ontology/segittur-pid-context-v1.jsonld:7`). El perfil RDF identifica como fuente la IRI base oficial sin fragmento (`ontology/segittur-multidestino-profile.ttl:12-18`).
- El contexto mapea explícitamente `TouristDestination`, `TourismResource`, `TourismEvent` y `Location` a `estur:` y las extensiones de zona, sensor, simulación, 3D y fuente a `pid:` (`ontology/segittur-pid-context-v1.jsonld:15-26`).
- El perfil RDF define destino, zona, recurso, sensor, evento, simulación, dataset 3D y fuente/procedencia (`ontology/segittur-multidestino-profile.ttl:25-66`), además de relaciones de destino y procedencia (`:68-84`).
- Existen formas SHACL para perfil de destino, destino, zona, recurso, sensor y dataset 3D (`ontology/segittur-multidestino-shapes.ttl:7-48`).

### Discrepancias materiales

1. **Cobertura SHACL incompleta.** No hay `sh:NodeShape` para:
   - `TourismEvent`;
   - `SimulationScenario` (ni resultado de simulación);
   - `DataSource`/procedencia.

   Esto incumple expresamente el alcance requerido de restricciones para evento, simulación y procedencia. El archivo SHACL termina tras `Dataset3DShape` (`ontology/segittur-multidestino-shapes.ttl:43-48`).

2. **Desacople entre clases que emite el contexto y objetivos SHACL.** El contexto de intercambio expande `TouristDestination` a `estur:TouristDestination` y `TourismResource` a `estur:TouristEntity` (`ontology/segittur-pid-context-v1.jsonld:15-17`). Sin embargo, las formas aplican a `pid:TouristDestination` y `pid:TourismResource` (`ontology/segittur-multidestino-shapes.ttl:15-19`, `:28-33`). Aunque el perfil RDF declara esas clases PID como subclases de las oficiales (`ontology/segittur-multidestino-profile.ttl:25-28`, `:35-37`), las entidades JSON-LD construidas por la aplicación usan los alias del contexto y, por ello, se expandirán a las IRIs `estur:`. Sin una triple adicional de tipo PID o formas que apunten también a `estur:`, esas restricciones no se activarían sobre dichas entidades de intercambio.

## 2. Modelo multidestino PostGIS — **FAIL**

### Evidencia satisfactoria

- La migración existe: `database/migrations/003_ontologia_multidestino.sql`.
- Crea `tenants_gemelo` (`:10-19`), `destino_perfiles_semanticos` (`:22-41`), `registro_entidades_contexto` (`:45-64`) y `contratos_ingestion_semantica` (`:74-90`).
- El registro semántico conserva el payload JSON-LD, geometría PostGIS, tiempo de observación, calidad y trazabilidad; dispone de índice compuesto `(tenant_id, destino_id, entity_type, observed_at)` y de índices GIST/GIN (`:43-71`).
- Se incluyen perfiles de referencia para Málaga y Palma (`:95-137`).
- No se modifican ni eliminan las tablas existentes; las tablas preexistentes ya usan `destino_id` —por ejemplo, `destinos`, `zonas_destino`, `recursos_turisticos` y `sensores_iot` en `database/schema_postgis.sql:20-95`—, por lo que la migración es aditiva a nivel DDL.

### Discrepancia material: aislamiento no impuesto

- En `registro_entidades_contexto`, `tenant_id` referencia independientemente a `tenants_gemelo` y `destino_id` independientemente a `destinos` (`database/migrations/003_ontologia_multidestino.sql:45-49`). El mismo patrón se usa en los contratos de ingestión (`:74-78`). No existe una FK compuesta, constraint o trigger que obligue a que el par `(tenant_id, destino_id)` coincida con el de `destino_perfiles_semanticos`.
- Tampoco se activa RLS. La propia migración indica que queda pendiente de un API Gateway y que “**No se activa RLS aquí**” (`database/migrations/003_ontologia_multidestino.sql:158-160`). La documentación lo confirma (`ONTOLOGIA_Y_MODELO_MULTIDESTINO.md:124-134`).
- Por tanto, aunque se almacenan ambos identificadores y la vista permite filtrarlos (`database/migrations/003_ontologia_multidestino.sql:139-156`), una escritura SQL con tenant Málaga y `destino_id` Palma es estructuralmente posible. No puede considerarse aislamiento preservado/enforced por el modelo persistente actual.

**Límite de verificación:** no se aplicó la migración ni se alteró una base de datos, conforme al modo solo lectura. El hallazgo procede de la semántica estática del DDL.

## 3. APIs NGSI-LD — **PASS**

### Implementación y flujo comprobado

- Descubrimiento: `GET /api/semantic/model` (`server.ts:187-194`) expone perfil, vocabulario oficial, contexto, tipos, mapeos y evidencia, construidos en `src/services/multiDestinationModel.ts:89-122`.
- Perfiles: colección y perfil individual en `server.ts:196-211`; Málaga y Palma se definen de forma independiente con tenant, namespace, INE, política, dominios y niveles (`src/services/multiDestinationModel.ts:42-86`).
- Entidades normalizadas: `GET /api/semantic/entities` filtra por destino y tipo (`server.ts:213-238`); el adaptador crea URN, `@context`, `destination`, `tenant`, GeoProperties y procedencia (`src/services/multiDestinationModel.ts:147-283`). El flujo Palma→zonas fue confirmado por HTTP.
- Validación: el servidor llama al adaptador y devuelve `200` o `422` (`server.ts:240-248`). Este rechaza objeto que no sea JSON-LD, `id` no URN, tipo no soportado, contexto incompatible y `destination` que no sea `Relationship` con `object` (`src/services/semanticAdapter.ts:39-67`). También aplica mínimos por tipo (`:68-96`).
- Normalización: `POST /api/semantic/normalize` valida antes de responder y declara explícitamente `VALIDATED_NOT_PERSISTED` en demo (`server.ts:250-268`). La prueba propia devolvió exactamente ese estado, sin escribir datos.

El contrato requerido —rechazo de entidad sin `id`, `type`, `destination` o `@context` compatible— está cubierto por código y por prueba del caso inválido (`422`).

## 4. Control room — **PASS**

- La acción “Modelo Multidestino” abre un modal no invasivo (`src/App.tsx:241-250`) y el componente queda montado sin sustituir el control room (`src/App.tsx:797-806`).
- Al abrir, el modal consulta en paralelo `/api/semantic/model` y `/api/semantic/profiles` (`src/components/MultiDestinationModal.tsx:20-49`), enlazando directamente la UI a la evidencia API comprobada.
- Presenta contrato, perfil, enlace al contexto JSON-LD y enlace a la IRI de SEGITTUR (`:88-112`); lista cobertura ontológica y atributos exigidos (`:115-131`); representa los perfiles activos —incluidos Málaga y Palma— con tenant, INE, namespace, nivel, dominios, política y vínculo de evidencia (`:133-180`).

**Límite:** se validó la integración de forma estática y las APIs de las que depende; no se realizó interacción visual de navegador, en cumplimiento del alcance indicado para la comprobación estática.

## 5. Documentación y validación — **FAIL**

### Evidencia satisfactoria

- `ONTOLOGIA_Y_MODELO_MULTIDESTINO.md` explica el modelo SEGITTUR/PID y afirma explícitamente que el perfil no sustituye ni copia la ontología oficial (`:3-5`, `:49-62`, `:146-148`). Incluye mapeos, convenciones URN, perfiles Málaga/Palma, APIs, persistencia y referencias oficiales (`:64-143`, `:152-156`).
- En los caminos exitosos comprobados, las APIs semánticas usan `application/ld+json` y `Cache-Control: no-store`. Esto se implementa centralmente en `semanticNoStore` (`server.ts:181-185`) y se aplica antes de los `200` y `422` principales (`:187-203`, `:227-267`).

### Discrepancia material: contrato de cabeceras incompleto en errores semánticos

Las rutas de error devuelven antes de ejecutar `semanticNoStore`:

- perfil inexistente: `server.ts:206-209`;
- destino inexistente: `server.ts:213-218`;
- tipo no soportado: `server.ts:219-225`.

Se confirmó por HTTP que estos tres casos devuelven `404`/`400` con `Content-Type: application/json; charset=utf-8` y sin `Cache-Control: no-store`. En consecuencia, el requisito de que **las APIs semánticas** usen `application/ld+json` y `Cache-Control: no-store` no se cumple para todas sus respuestas.

## Recomendaciones de cierre

1. Añadir formas SHACL para `TourismEvent`, `SimulationScenario` (y, si aplica, `SimulationResult`) y `DataSource`; incluir las reglas de procedencia requeridas. Alinear los `sh:targetClass` con las IRIs realmente expandidas por el contexto (`estur:`) o emitir explícitamente las clases PID suplementarias.
2. Hacer cumplir el vínculo tenant-destino en la BD (constraint/FK compuesta o trigger validado contra el perfil) y activar RLS con políticas basadas en el ámbito de credenciales antes de declarar aislamiento efectivo. Validar también ese ámbito en la futura capa de escritura.
3. Aplicar `semanticNoStore` antes de cualquier retorno de error en `/api/semantic/*` y serializar esos errores como JSON-LD, para que el contrato de medio y caché sea uniforme.
4. Tras las correcciones, ejecutar una validación SHACL real sobre entidades producidas por `/api/semantic/entities`, una prueba de inserción cruzada tenant/destino que deba fallar y pruebas HTTP de rutas exitosas y de error.

## Trazabilidad de no persistencia

La entidad usada en las pruebas POST llevaba el identificador de auditoría `urn:ngsi-ld:TourismZone:palma:auditoria-…-no-persistente`. El propio endpoint de normalización respondió `VALIDATED_NOT_PERSISTED`; no se invocó ninguna operación de base de datos ni endpoint que declare persistencia.
