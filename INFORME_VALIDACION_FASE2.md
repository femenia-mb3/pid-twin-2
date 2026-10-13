# Informe de Validación Independiente — Fase 2

**Proyecto:** Gemelo Digital Turístico — PID SEGITTUR  
**Ámbito inspeccionado:** `/home/ubuntu/gemelotur`  
**Fecha de la inspección:** 29 de septiembre de 2026  
**Modalidad:** estrictamente de solo lectura: inspección de código y consultas HTTP `GET`/`HEAD` a `http://127.0.0.1:3000`. No se editaron fuentes, no se reiniciaron servicios, no se compiló y no se alteraron dependencias ni datos de negocio.

> **Veredicto global: FAIL.** La migración y las rutas API están declaradas y las rutas responden, pero la cadena de datos y visualización de Fase 2 no es coherente de extremo a extremo: los datasets LOD2 y fotogramétricos se publican por API con la URL del LiDAR, sus rutas propias no existen, y el visor no carga tilesets de Fase 2 independientes.

## Criterio y alcance

La revisión sigue `references/validation.md` (guía del validador): se comprobaron los flujos que dependen de varias capas —migración/contratos, servicio/API, API/visor y publicaciones de tilesets—, no solo la presencia de literales o rutas.

El puerto 3000 corresponde a Vite y redirige `/api` a Express en el puerto 3001 (`vite.config.ts:9-19`). Por tanto, los resultados HTTP a 3000 prueban el recorrido proxy + backend. El backend directo 3001 respondió igualmente `200 application/json` para `GET /api/3d/datasets`.

## Resumen de veredictos

| Área / condición comprobada | Veredicto | Evidencia concreta |
|---|---|---|
| Esquema SQL requerido de `dataset_3d` y `edificio_3d` | **PASS** | La migración define ambas tablas y contiene CRS horizontal, datum vertical, fecha de captura, QA, titular, finalidad y clasificación de difusión (`002_fase2_datasets_3d.sql:32-57`, `63-85`). |
| Semillas SQL de la Primera Oleada | **FAIL** | Hay cuatro filas de oleada 1 (`:147-187`), pero la Alcazaba se denomina **«Conjunto Monumental de la Alcazaba y Gibralfaro»** (`:163`), ampliando el alcance acordado. El servicio/API usa otra variante, **«… Alcazaba y Murallas»** (`catalog3DService.ts:136`; respuesta HTTP), por lo que no coincide exactamente ni entre capas ni con el nombre acordado «Alcazaba». |
| Coherencia SQL → TypeScript → API → tipos del visor | **FAIL** | SQL registra URLs independientes LOD2/fotogrametría (`:124`, `:141`), mientras que el servicio asigna los tres datasets a `/tilesets/malaga-centro-2024/tileset.json` (`catalog3DService.ts:60`, `81`, `102`). Además, el enum SQL de estado y el tipo TS no son equivalentes; TS admite `en_captura`, valor inexistente en SQL, y omite estados SQL como `planificado`, `captura_pendiente`, `procesamiento` y `retirado` (`SQL:13-17`; `TS:8`). El campo SQL `requiere_permiso_especifico` tampoco se expone en `Edificio3DRecord`. |
| Rutas API Express comprometidas: disponibilidad y contratos básicos | **PASS** | `GET /api/3d/datasets` devolvió `200`, `destinoId: malaga`, `total: 3`; `GET /api/3d/datasets/:id/manifest` devolvió `200` para los tres IDs válidos, con `manifestVersion: "1.0"`; `GET /api/3d/oleadas/primera` devolvió `200`, `oleada: 1`, `totalEdificios: 4`. La rama no encontrada fue observada antes para un ID no existente: `404 {"error":"Dataset 3D no encontrado"}`. Rutas implementadas en `server.ts:126-170`. |
| API conectada a la migración/PostGIS | **UNVERIFIED** | Aunque `/api/health` declara `mode: PERSISTENT_POSTGIS`, `server.ts` importa y filtra arrays estáticos `DATASETS_3D_CATALOG` y `EDIFICIOS_OLEADA_1` (`:9`, `:127-129`, `:160-162`); no hay consulta a PostGIS en el camino inspeccionado. No se ejecutó la migración ni se modificó/consultó directamente la base de datos por el alcance de solo lectura HTTP/código. |
| Selector y carga efectiva de capas de Fase 2 en Cesium | **FAIL** | El control visual muestra LiDAR, Edificios 1.ª Oleada y Capacidad de aforo (`Real3DTilesViewer.tsx:295-332`), pero únicamente se crea un `Cesium3DTileset`, el LiDAR (`:234-264`). LOD2/fotogrametría solo agregan marcadores de entidades (`:156-182`) y su cambio reconstruye el visor; no cargan ni ocultan tilesets propios. El visor tampoco consulta los endpoints API: importa el array estático directamente (`:19`). |
| Interacción de edificios y ficha de gobernanza | **FAIL** | Las fichas de los cuatro edificios abren el modal mediante `onSelectEdificio` (`Real3DTilesViewer.tsx:345-355`; `App.tsx:286-292`, `321-325`), y se muestran titularidad, permiso con STS-01 y finalidad (`OleadaDetailModal.tsx:43-62`). Sin embargo, el estado QA se presenta siempre como texto fijo «QA Aprobado» (`:24-30`) en vez de usar `edificio.estadoQa`; no se muestra `clasificacionDifusion`; y `App.tsx` no entrega `onFocusEdificio`, por lo que la acción de centrar en el visor no queda disponible (`OleadaDetailModal.tsx:91-102`). No hay selección por clic de las entidades Cesium. |
| No regresión del tileset LiDAR PNOA 2024 — integridad/publicación | **PASS** | La URL del LiDAR se conserva en migración, servicio y visor (`SQL:105`, `service:60`, `viewer:54`). `GET /tilesets/malaga-centro-2024/tileset.json` devolvió `200 application/json` (1.205.611 bytes), con `asset.version: "1.1"`; se recorrieron 375 URI de contenido, todas únicas y presentes localmente, y una muestra GLB respondió `200 model/gltf-binary` (155.660 bytes). `git diff --name-only -- public/tilesets/malaga-centro-2024` y `git status --short -- public/tilesets/malaga-centro-2024` no reportaron cambios. |
| No regresión LiDAR — renderizado/performance interactivo | **UNVERIFIED** | No se realizó prueba visual en navegador ni medición de rendimiento; solo se validó la publicación, estructura y disponibilidad HTTP del tileset existente. |
| Documentación de dos oleadas y arquitectura de Fase 2 | **PASS** | `PLAN_FASE_2_LOD2_MALLAS_TEXTURIZADAS.md:20-25` identifica la primera oleada y la segunda (Teatro Romano, Palacio de la Aduana/Museo de Málaga y activos portuarios). `plan.md:12-27` documenta PostGIS, las tres rutas y la arquitectura React/Cesium. |

## Evidencia HTTP relevante

| Consulta de solo lectura | Resultado observado |
|---|---|
| `GET /api/health` | `200`; declara `PERSISTENT_POSTGIS` (declaración de configuración, no prueba de uso por las rutas Fase 2). |
| `GET /api/3d/datasets` | `200`; catálogo de tres datasets. LiDAR: URL propia correcta. LOD2 y fotogrametría: ambos devuelven erróneamente la URL del LiDAR. |
| `GET /api/3d/datasets/ds3d_malaga_lidar_2024/manifest` | `200`; tileset LiDAR, `maximumScreenSpaceError: 12`. |
| `GET /api/3d/datasets/ds3d_malaga_lod2_2026/manifest` | `200`, pero `tilesetUrl: /tilesets/malaga-centro-2024/tileset.json` en lugar de la URL LOD2 declarada en SQL. |
| `GET /api/3d/datasets/ds3d_malaga_photo_2026/manifest` | `200`, pero la misma URL LiDAR en lugar de la URL fotogramétrica SQL. |
| `GET /api/3d/oleadas/primera` | `200`; cuatro registros, con IDs `b3d_catedral_malaga`, `b3d_alcazaba_malaga`, `b3d_museo_picasso`, `b3d_centre_pompidou`. |
| `GET /tilesets/malaga-centro-2024/tileset.json` | `200 application/json`; manifiesto 3D Tiles 1.1 válido para la comprobación estructural realizada. |
| `GET /tilesets/malaga-lod2-oleada1/tileset.json` y `GET /tilesets/malaga-fotogrametria-oleada1/tileset.json` | Responden `200 text/html` por el fallback SPA de Vite, **no** un manifiesto JSON. Las rutas versionadas alternativas documentadas tampoco entregan JSON. Por tanto, no existen tilesets Fase 2 publicables en esas rutas. |

## Hallazgos que bloquean la aceptación

1. **Rutas de publicación contradictorias y no existentes.** La SQL prescribe tilesets independientes para LOD2 y fotogrametría; servicio/API los sustituyen por el LiDAR y las rutas SQL responden HTML del SPA. Esto invalida el catálogo como fuente de carga de activos independientes y también confunde la semántica de los manifests.
2. **El visor no implementa la carga multicapa comprometida.** La única carga `Cesium3DTileset.fromUrl` es la del LiDAR. «Edificios 1.ª Oleada» son puntos/etiquetas, no LOD2 ni mallas fotogramétricas. El selector no puede demostrar comparación LiDAR/LOD2/malla ni evitar duplicidad visual como exige el plan.
3. **La fuente real de la API no es la migración.** Las rutas se alimentan de constantes TypeScript. Es necesario establecer un contrato único o un adaptador fiel a PostGIS antes de afirmar persistencia de catálogo; actualmente los cambios SQL no llegan al frontend mediante la API.
4. **Primera Oleada no es textual/semánticamente idéntica en las capas.** La representación SQL añade Gibralfaro y la TypeScript/API añade Murallas. Para una oleada acordada de forma cerrada, debe normalizarse al alcance aprobado o actualizarse formalmente el acuerdo y la documentación.
5. **La ficha no refleja todos los metadatos dinámicos requeridos.** QA es fijo y la clasificación de difusión no se visualiza; la acción de enfocar el activo no se conecta desde `App.tsx`.

## Condiciones mínimas para una nueva validación

1. Unificar las definiciones de dataset y edificio, incluidos enums, URLs y campos de gobernanza, y hacer que API y visor consuman ese contrato único.
2. Publicar manifiestos JSON 3D Tiles reales, distintos y resolubles para LOD2 y fotogrametría; conservar el LiDAR en su ruta actual sin reutilizarlo como sustituto.
3. Instanciar en Cesium los tilesets de cada dataset, enlazar el selector a su visibilidad/prioridad y comprobar por HTTP que todos los contenidos declarados resuelven.
4. Normalizar los cuatro nombres y el alcance de la oleada en SQL, servicio/API, visor y documentación.
5. Mostrar QA, difusión, permiso y STS-01 a partir de los campos del edificio, y conectar la focalización opcional del modal al manejador Cesium.
6. Aportar evidencia de que la migración se aplicó y que las rutas Fase 2 leen el catálogo persistido, además de una prueba visual/rendimiento para cerrar el punto LiDAR actualmente **UNVERIFIED**.

## Limitaciones explícitas de esta validación

No se ejecutaron `pnpm build`, `tsc`, migraciones SQL, tests, consultas directas a PostGIS, ni automatización de navegador, porque el encargo exige una inspección de solo lectura sin compilar, alterar dependencias, reiniciar servicios ni modificar datos. Los veredictos **UNVERIFIED** delimitan exactamente esos aspectos no demostrados; no son un PASS implícito.
