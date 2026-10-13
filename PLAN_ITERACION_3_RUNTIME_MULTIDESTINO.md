# Iteración 3 — Runtime multidestino, ejecuciones reproducibles y salidas normalizadas

## Contexto y decisión

La auditoría de código no identifica dependencias activas de **Sevilla**. Sí identifica acoplamientos de demostración a Málaga/Palma en valores predeterminados de API, la predicción sintética, recomendaciones y configuración visual. El objetivo de esta iteración es que **el motor común, el runtime y las APIs operativas no dependan de ninguna ciudad concreta**; los datos de demostración y los recursos 3D pueden seguir existiendo como adaptadores/catálogos de un destino, nunca como reglas de producto.

Se completa el recorrido definido en el Prompt Maestro:

> seleccionar o importar un destino → resolver su contexto → definir/validar escenario → ejecutar → guardar la corrida → consultar BASE / ESCENARIO / DELTA → exportar únicamente resultados derivados.

## Arquitectura

### Resolución de runtime

Se introduce `DestinationRuntimeService` como único punto de entrada para el motor. Resuelve un `DestinationRuntime` por `destinationId` a partir de:

1. un adaptador de catálogo demostrador; o
2. un `ContextPackage v1` importado.

El runtime incluye destino, tenant, zonas, recursos, sensores, perfil de modelo, procedencia, calidad, fecha de corte y huella de contexto. El motor no importa datos de Málaga, Palma, Sevilla ni IDs de destino.

### Motor y predicción

- `MotorContextoSimulacion` conserva reglas genéricas por tipología, elimina recomendaciones con nombres de barrios/ciudades y deriva indicadores de ruido, alertas y variación desde el runtime recibido.
- Los escenarios de biblioteca se generan con una factoría para las zonas del runtime; no contienen listas fijas de IDs de ciudades.
- La predicción sintética usa una línea base cuantificada desde el runtime y una semilla hash estable de su huella. No contiene bifurcaciones por ciudad. Sigue marcada como **SINTÉTICA · DEMO**, sin confundirse con predicción real.

### SimulationRun v1

Cada ejecución se normaliza como `SimulationRun` con:

- identificadores de tenant/destino, modelo, escenario, ContextPackage y huella de contexto;
- versión, semilla determinista, fecha, actor declarado, estado, calidad y persistencia;
- entradas y parámetros congelados;
- indicadores `BASE`, `ESCENARIO` y `DELTA`;
- capas GeoJSON derivadas para zonas, recursos y sensores;
- alertas, recomendaciones, incertidumbre y evidencia.

La demo conserva corridas en memoria con `Cache-Control: no-store`. La migración PostGIS 007 deja preparados metadatos, indicadores, capas derivadas, integridad tenant/destino y RLS.

### API y entrega

- `POST /api/runs/simulations`: ejecuta contra un `destinationId` y una definición de escenario/parametrización explícita.
- `GET /api/runs?destino={id}` y `GET /api/runs/{id}?destino={id}`: consulta aislada por destino.
- `GET /api/runs/{id}/export?destino={id}&format=geojson`: exporta las capas **derivadas**, sin mezclar datos de entrada originales.
- El endpoint histórico `/api/simulacion/ejecutar` queda como adaptador de compatibilidad y devuelve además el `SimulationRun` normalizado.
- Las rutas geoespaciales dinámicas requieren `destino`; no adoptan una ciudad por defecto. La SPA y `/api/*` mantienen la separación estática/API y las respuestas mutables no se almacenan en caché.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `src/types/destinationRuntime.ts` | Contratos de runtime, huella, procedencia y validación. |
| `src/services/destinationRuntimeService.ts` | Resolución uniforme de catálogo demostrador y ContextPackage. |
| `src/services/scenarioPresetFactory.ts` | Escenarios de referencia generados desde zonas del runtime. |
| `src/types/simulationRun.ts` | Contratos BASE/ESCENARIO/DELTA y exportación derivada. |
| `src/services/simulationRunService.ts` | Ejecución, normalización, persistencia en memoria y exportación. |
| `src/engine/simulationEngine.ts` | Reglas genéricas y métricas derivadas del contexto. |
| `src/services/syntheticForecast.ts` | Forecast sintético parametrizado por runtime, sin IDs de ciudad. |
| `database/migrations/007_simulation_runs.sql` | Persistencia PostGIS y RLS de corridas y capas derivadas. |
| `server.ts` | API de runtime/runs, adaptación retrocompatible y validación de scope. |
| `src/App.tsx` | Presets dinámicos y ficha de evidencia de la corrida ejecutada. |

## Criterios de aceptación

1. Ningún archivo del motor común, runtime, normalizador, predicción ni API de ejecución contiene un ID, nombre, umbral o recomendación fijada a Málaga, Palma o Sevilla.
2. Un `DestinationRuntime` válido puede resolverse desde el catálogo demostrador o desde un ContextPackage, conservando destino, tenant, calidad, fuentes y huella de contexto.
3. El mismo contrato de escenario puede ejecutarse para al menos tres destinos heterogéneos —dos demostradores y uno importado— sin cambios de código ni cruces de datos.
4. Cada corrida genera un `SimulationRun` consultable con BASE, ESCENARIO, DELTA, modelo, escenario, ContextPackage/huella, parámetros, semilla, timestamp, calidad, alertas, recomendaciones e incertidumbre.
5. Las capas derivadas de zonas, recursos y sensores se exportan como GeoJSON y nunca incluyen los datos de entrada como si fueran resultado de simulación.
6. Las APIs dinámicas rechazan un `destinationId` ausente o ajeno; la consulta de una corrida desde otro destino responde 404.
7. La UI muestra que un escenario ejecutado conserva un identificador de corrida y evidencia normalizada, manteniendo la distinción BASE / ESCENARIO / DELTA.
8. La demo en memoria y la migración PostGIS/RLS se documentan de manera explícita.

## Verificación

- Compilación TypeScript/Vite y comprobación de sintaxis SQL de la migración 007.
- Pruebas HTTP de resolución de runtime, ejecución de los tres destinos, aislamiento, exportación GeoJSON derivada y rechazos de scope.
- Auditoría estática de archivos del motor común para excluir nombres/IDs de ciudades.
- Revisión independiente de las conexiones `ContextPackage/demo adapter → runtime → motor → SimulationRun → API/UI/exportación`.
