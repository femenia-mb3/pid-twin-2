# Iteración 3 — Runtime multidestino y SimulationRun v1

## Resultado

El motor de simulación ya no recibe ni resuelve una ciudad por defecto. Cada operación utiliza un **`destinationId` explícito** y se apoya en un `DestinationRuntime` que puede proceder de:

| Origen | Uso | Persistencia en la demo |
|---|---|---|
| `DEMO_CATALOG` | Destinos demostradores incluidos en el proyecto | Datos de referencia en código, aislados como adaptador |
| `CONTEXT_PACKAGE_V1` | Destino dado de alta mediante ContextPackage v1 | Memoria del proceso; se pierde al reiniciar |

El motor, el normalizador de resultados, la predicción sintética y la API de ejecución no contienen nombres, IDs, recomendaciones ni bifurcaciones vinculadas a una ciudad concreta.

## DestinationRuntime

`DestinationRuntimeService` resuelve el contexto mínimo común que necesita cualquier destino:

- destino y tenant;
- zonas, recursos y sensores, siempre validados contra el mismo `destinationId`;
- perfil de modelo, dominios y umbral de capacidad;
- fuentes, calidad, fecha de corte y autorizaciones;
- procedencia (`DEMO_CATALOG` o `CONTEXT_PACKAGE_V1`);
- huella determinista del contexto.

El runtime se rechaza si no existen zonas, si hay entidades cruzadas entre destinos, capacidades no válidas o fuentes no autorizadas.

## Escenarios de biblioteca y editor propio

Los tres escenarios de biblioteca se construyen para las zonas del runtime actual, no contra IDs predefinidos:

1. `presion-alta-demanda` — intensifica las zonas del destino que ya presentan mayor carga.
2. `evento-local` — modela actividad/programación con crecimiento distribuido y foco operacional.
3. `episodio-meteorologico` — representa redistribución de flujos bajo una condición meteorológica.

El editor no-code de la Iteración 2 conserva la capacidad de crear sus propios escenarios. Al ejecutarlo, el escenario validado se transforma en el mismo contrato `SimulationRun v1`, con versión, autor y definición de escenario vinculados.

## SimulationRun v1

Una corrida se registra en memoria con el siguiente recorrido:

```text
DestinationRuntime + escenario validado + parámetros congelados
                              │
                              ▼
                    ejecución BASE
                              │
                              ▼
                  ejecución ESCENARIO
                              │
                              ▼
   indicadores y capas derivadas BASE / ESCENARIO / DELTA
                              │
                              ▼
        SimulationRun v1 + evidencia + incertidumbre
```

Cada `SimulationRun` contiene:

- `destinationId`, `tenantId`, actor, timestamp y semilla determinista;
- perfil y versión de modelo;
- snapshot de escenario y parámetros;
- `comparison.base`, `comparison.scenario` y `comparison.delta`;
- capas GeoJSON derivadas de zonas, recursos y sensores;
- alertas y recomendaciones;
- ContextPackage/huella, origen, calidad, entidad de entrada e incertidumbre.

> La situación **BASE** reproduce el contexto observado (variación cero), antes de aplicar la hipótesis de escenario.

Los resultados siguen siendo **paramétricos**. Si el runtime usa datos sintéticos, el resultado lo declara explícitamente y no se presenta como predicción calibrada.

## API

Todas las respuestas de ejecución llevan `Cache-Control: no-store`.

| Método | Endpoint | Finalidad |
|---|---|---|
| `POST` | `/api/runs/simulations` | Ejecuta una corrida normalizada. Requiere `destinationId` y un `scenario` completo o `scenarioId` de biblioteca. |
| `GET` | `/api/runs?destino={id}` | Lista únicamente las corridas del destino. |
| `GET` | `/api/runs/{runId}?destino={id}` | Consulta una corrida con aislamiento por destino. |
| `GET` | `/api/runs/{runId}/export?destino={id}&format=geojson` | Exporta sólo las capas derivadas `SIMULATION_DERIVED`. |
| `POST` | `/api/simulacion/ejecutar` | Adaptador temporal de compatibilidad; adjunta `run` y recomienda el endpoint normalizado. |

Las rutas de ejecución y lectura de corridas exigen además `X-PID-Tenant`, que debe coincidir con el tenant resuelto para el destino. En esta demo es un **guard de alcance**, no un sustituto de autenticación: el piloto debe obtenerlo de los claims de una sesión autenticada y no de entrada controlada por cliente. CORS se mantiene cerrado salvo una allowlist configurada con `ALLOWED_ORIGINS`.

`POST /api/runs/simulations` no aplica escenarios ni parámetros implícitos: requiere un escenario completo o un `scenarioId` válido del catálogo del destino, más el objeto completo de parámetros. Valores fuera de rango, tipos no numéricos o escenarios desconocidos devuelven `422`.

Las capas operativas `/api/geo/capas/{zonas|recursos|sensores}` y los catálogos 3D también requieren `?destino={id}`. Una petición sin alcance recibe `422`; una corrida o un manifiesto consultado desde otro destino recibe `404`.

## Persistencia piloto

La migración `database/migrations/007_simulation_runs.sql` prepara:

- `simulation_runs`: snapshots, comparación, modelo, huella, calidad y evidencia;
- `simulation_run_layers`: una colección GeoJSON derivada por capa;
- claves compuestas de tenant/destino;
- RLS obligatorio basado en `app.tenant_id` y `app.destino_id`;
- restricción para que las colecciones persistidas sean exclusivamente resultados `SIMULATION_DERIVED`.

En el piloto PostGIS, la capa de aplicación debe ejecutar por transacción:

```sql
SET LOCAL app.tenant_id = '<tenant-autorizado>';
SET LOCAL app.destino_id = '<destino-autorizado>';
```

antes de guardar o consultar una corrida.

El `docker-compose` del piloto monta en orden `schema_postgis.sql` y las migraciones `002` a `007` cuando se inicializa **un volumen PostGIS nuevo**. Para un volumen ya existente se necesita una ejecución controlada de migraciones, no basta con reiniciar el contenedor. En esta Iteración 3 el runtime de aplicación continúa siendo `STANDALONE_MEMORY_DEMO`: las tablas y RLS quedan preparadas y validadas sintácticamente, pero el escritor PostGIS transaccional será la siguiente entrega del piloto. Por tanto, no se debe presentar esta versión como persistencia operativa.

## Validación ejecutada

1. Compilación TypeScript y Vite correcta.
2. Ejecución de la misma API para dos runtimes demostradores y un destino importado por ContextPackage.
3. Confirmación de BASE con variación cero, generación de ESCENARIO y DELTA normalizados.
4. Comprobación de aislamiento: consultar una corrida de otro destino devuelve `404`.
5. Rechazo de scope sin tenant (`401`), tenant cruzado (`403`), escenario/parametrización ausente o inválida (`422`) y activos 3D cruzados (`404`).
6. Exportación GeoJSON: todas las features llevan `resultKind = SIMULATION_DERIVED`.
7. Auditoría estática: no aparecen referencias de Sevilla, Málaga ni Palma en el motor, runtime, factoría de escenarios, normalizador, forecast ni API de ejecución.
