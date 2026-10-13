# Plan de Implementación — Interoperabilidad PID y Catálogo de Modelos Reutilizables

## Resultado comprometido

Convertir el Gemelo Digital Turístico en un **módulo transversal de la PID**, no limitado al visor. El producto incorporará una capa visible y una API de interoperabilidad que separan los datos ontológicos de los datos no ontológicos/históricos, registran contratos por fuente y destino, y muestran cómo el motor común puede reutilizar modelos entre municipios sin perder su configuración local.

> Las referencias S1, S2, C4, S7, S11, S15, S16, S17 y S18 se implementan como un **mapa de integración configurable y demostrador**, no como conectores en vivo. Una conexión efectiva requerirá los contratos, credenciales, autorizaciones y políticas de privacidad de cada servicio PID.

El producto entregará:

1. Una **capa explícita de integración, normalización e interoperabilidad** con conectores por fuente/tipo: S2, C4, API municipal, CSV, GeoJSON y MQTT.
2. Dos carriles visibles e independientes: **datos ontológicos** (S2, S1, recursos y activos normalizados) y **datos no ontológicos/históricos** (C4 y fuentes locales heterogéneas), con transformación, mapeo, calidad, metadatos, trazabilidad y frecuencia de actualización.
3. Una relación declarativa con los servicios PID: S2 como armonización, C4 como histórico/no ontológico, S11 como explotación territorial, S18 como previsión/simulación y S15/S16/S17/S1/S7 como fuentes complementarias sujetas a revisión de privacidad y finalidad.
4. Un **catálogo de modelos reutilizables** que incluya al menos saturación turística, playas, eventos, movilidad, patrimonio, puertos/cruceros, nieve, espacios naturales, enoturismo y cicloturismo, distinguiendo modelos preconfigurados, propios y reutilizables.
5. La capacidad demostrable de crear un modelo propio aislado en su destino, parametrizar variables tipadas, revisar sus fuentes mínimas, publicarlo como plantilla reutilizable y después instalarlo en Málaga o Palma. En modo demo estas operaciones se validarán en memoria y no se persistirán.
6. Una migración PostGIS para fuentes de interoperabilidad, versiones de modelos, instancias y una tabla puente de fuentes vinculadas por tenant/destino, conservando aislamiento RLS por el par `tenant_id`/`destino_id`.
7. Documentación de adopción que explique el papel transversal del gemelo, los límites de la demo y el camino para conectar fuentes reales sin cambiar el motor común.

## Decisiones de arquitectura

### Integración e interoperabilidad

- Cada fuente se describe por `destinationId`, carril (`ONTOLOGICO` o `NO_ONTOLOGICO_HISTORICO`), clase PID, tipo de conector, contrato de entrada, frecuencia, calidad, política de privacidad y trazabilidad.
- Los carriles convergen en un adaptador de normalización: los datos ontológicos se validan contra el contexto JSON-LD/NGSI-LD; los no ontológicos conservan su esquema de origen, histórico y metadatos hasta que exista un mapeo semántico apropiado.
- Los conectores del MVP son contratos informativos: no se almacenan secretos ni se invocan sistemas PID o municipales externos. El endpoint de alta/instanciación devuelve `VALIDATED_NOT_PERSISTED` hasta que el piloto PostGIS y las credenciales estén disponibles.
- Las respuestas bajo `/api/interoperability/*` y `/api/models/*` son configuración mutable y trazabilidad; por ello usarán `application/json` y `Cache-Control: no-store`.

### Modelos reutilizables

- Un modelo reutilizable se compone de plantilla, versión, dominio, variables parametrizables, fuentes mínimas, reglas y criterios de publicación.
- Una instancia pertenece a un destino y enlaza la plantilla con conectores elegidos explícitamente, parámetros validados por esquema y política de datos. El motor de contexto usa esa instancia como configuración; el núcleo de simulación no se duplica por municipio.
- Los modelos pueden nacer como propios del destino y avanzar a estado reutilizable solo cuando sus variables estén parametrizadas, cuenten con evidencia y no transfieran datos personales o restringidos. En demo la propiedad se comprueba por destino; en producción se exige autorización del rol y persistencia PostGIS.

### PID, datos y privacidad

| Grupo PID | Función en la arquitectura | Tratamiento |
|---|---|---|
| S2 / S1 | Armonización e incorporación de datos ontológicos | Validación JSON-LD/NGSI-LD y mapeo a perfil SEGITTUR |
| C4 | Históricos y datos no ontológicos | Conservación de esquema original, normalización gradual y series temporales |
| S11 | Explotación territorial/geoespacial | Publicación OGC, análisis espacial y capas del visor |
| S18 | Explotación, previsión y simulación | Entrada/salida del motor de contexto y recomendaciones |
| S15/S16/S17/S7 | Comportamiento, percepción, empresas e interacción | Revisión de finalidad, minimización y política de privacidad antes de activación |

### Frontend, rutas y despliegue

- Se conserva el actual **SPA React/Vite + API Express** en el mismo origen y no se añaden páginas: `public/manus-routes.json` mantiene `/`.
- El control room añade una acción no invasiva **Interoperabilidad PID**. Abre un modal con el flujo transversal, los dos carriles, conectores por destino, el mapa de servicios PID y el catálogo de modelos.
- Las consultas se realizan desde APIs propias relativas. En producción, `/api/*` llega al contenedor antes del fallback SPA, y los endpoints de configuración se marcan `no-store`.
- Los assets de frontend versionados continúan con el comportamiento actual de Vite; no se modifica la configuración de despliegue ni los niveles cartográficos.

## Estructura de archivos

```text
src/
  types/interoperability.ts                    Contratos de carriles, conectores y modelos
  services/interoperabilityCatalogService.ts   Catálogo demo de fuentes, servicios PID y plantillas
  components/InteroperabilityModal.tsx         Control visual de conectores y catálogo reutilizable
server.ts                                      APIs /api/interoperability/* y /api/models/*
App.tsx                                        Acceso al módulo de interoperabilidad
database/migrations/004_interoperabilidad_modelos.sql
CAPA_INTEROPERABILIDAD_Y_CATALOGO_MODELOS_PID.md
```

## Verificación

1. Ejecutar `pnpm build` y `git diff --check`.
2. Consultar `GET /api/interoperability/architecture`, `GET /api/interoperability/connectors?destino=malaga` y `GET /api/models/reusable?destino=palma`, comprobando la presencia de ambos carriles, servicios PID y modelos requeridos.
3. Crear un borrador con `POST /api/models/own`, publicarlo por su destino propietario con `POST /api/models/:id/publish` y comprobar que aparece para otro destino. Ejecutar `POST /api/models/reusable/:id/instantiate` con parámetros de la plantilla y conectores autorizados; comprobar `201` y `VALIDATED_NOT_PERSISTED`. Repetir con un parámetro ajeno, campos obligatorios ausentes y un conector pendiente; comprobar `422` y `no-store`.
4. Validar la sintaxis SQL de la migración y confirmar restricciones compuestas, tabla puente de fuentes y RLS por tenant/destino mediante inspección y parser PostgreSQL.
5. Ejecutar una revisión independiente de solo lectura sobre el flujo fuente/carril → normalización → modelo → API → modal → migración.
