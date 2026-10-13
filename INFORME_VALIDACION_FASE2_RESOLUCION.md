# Informe de Validación Independiente — Resolución de Hallazgos Fase 2

**Proyecto:** Gemelo Digital Turístico — PID SEGITTUR  
**Ámbito:** `/home/ubuntu/gemelotur`  
**Fecha de inspección:** 29 de septiembre de 2026  
**Servidor comprobado:** `http://127.0.0.1:3000`  
**Modalidad:** inspección estrictamente de solo lectura de fuentes y consultas HTTP `GET`. No se editaron fuentes, no se reiniciaron servicios, no se compiló ni se alteraron dependencias o datos de negocio. La única escritura de esta intervención es este informe, solicitado expresamente.

> **Veredicto final: PASS — los cinco hallazgos de Fase 2 sometidos a revisión están resueltos en el alcance comprobado.**
>
> La publicación HTTP de los tres tilesets y de **todos** sus GLB referenciados fue verificada en ejecución. La coherencia de contratos, la carga/visibilidad Cesium y el comportamiento de la ficha se verificaron mediante trazabilidad estática de la implementación hasta los puntos de integración correspondientes.

## Criterio y limitación de la guía

La ruta indicada en el encargo, `/home/ubuntu/gemelotur/references/validation.md`, no existe en el árbol inspeccionado. Se aplicó la guía de validación disponible en `/home/ubuntu/skills/webdev/references/validation.md`: comprobar conexiones extremo a extremo, usar el mínimo de comprobaciones runtime necesario y clasificar el resultado según la evidencia disponible.

No se realizó compilación, prueba automatizada de navegador ni prueba visual/performance, porque están fuera del alcance de solo lectura indicado. Por tanto, el PASS de los puntos de interfaz acredita la implementación y sus conexiones de código, no una certificación adicional de renderizado interactivo en navegador.

## Resumen de veredictos

| Hallazgo revisado | Resultado | Evidencia principal |
|---|---|---|
| 1. URLs de los tres tilesets y contenidos GLB | **PASS** | Los tres `tileset.json` responden `200 application/json`; las **383** URIs GLB referenciadas responden `200 model/gltf-binary` (375 LiDAR, 4 LOD2, 4 fotogrametría). |
| 2. Contratos: cuatro nombres y URLs independientes de datasets | **PASS** | Los cuatro nombres son idénticos en migración, servicio y API. `GET /api/3d/datasets` publica una URL propia y distinta para cada tipo. |
| 3. `Real3DTilesViewer.tsx`: tres tilesets Cesium y visibilidad | **PASS** | Se instancian LiDAR, LOD2 y fotogrametría mediante tres `Cesium3DTileset.fromUrl`, con referencias, estado y efectos de visibilidad independientes. |
| 4. `OleadaDetailModal.tsx`: QA dinámico y clasificación de difusión | **PASS** | Las insignias se resuelven desde `edificio.estadoQa` y `edificio.clasificacionDifusion`; no son texto fijo. |
| 5. Conexión `onFocusEdificio` en `App.tsx` | **PASS** | El modal recibe el callback que llama a `real3DViewerRef.current?.flyToEdificio(edificio)`; el visor expone dicho método por `useImperativeHandle`. |

## 1. Coherencia de URLs de tilesets y contenidos

Se hicieron `GET` contra el servicio existente, se analizaron los manifiestos JSON y se recorrieron las propiedades `content.uri`/`contents[].uri` con extensión `.glb`. Cada URI se resolvió de forma relativa a su manifiesto y se descargó mediante `GET` para comprobar código, tipo y disponibilidad real.

| Recurso | Resultado del manifiesto | GLB referenciados | Resultado de cada GLB |
|---|---:|---:|---|
| `/tilesets/malaga-centro-2024/tileset.json` | `200`, `application/json` | 375 | `375/375` con `200`, `model/gltf-binary` |
| `/tilesets/malaga-lod2-oleada1/tileset.json` | `200`, `application/json` | 4 | `4/4` con `200`, `model/gltf-binary` |
| `/tilesets/malaga-fotogrametria-oleada1/tileset.json` | `200`, `application/json` | 4 | `4/4` con `200`, `model/gltf-binary` |

**Resultado:** `383/383` URIs GLB únicas referenciadas están disponibles por HTTP con código `200`. Se cierra el hallazgo de rutas inexistentes, fallback HTML y contenidos no resolubles.

## 2. Contratos y coherencia de datos

### Nombres de la Primera Oleada

Los cuatro nombres exigidos son exactamente iguales —incluyendo acentos y la denominación `Centre`— en las tres capas verificadas:

| Fuente | Evidencia |
|---|---|
| `database/migrations/002_fase2_datasets_3d.sql` | Filas de semillas en líneas 151–188: `Catedral de Málaga`, `Alcazaba`, `Museo Picasso Málaga`, `Centre Pompidou Málaga`. |
| `src/services/catalog3DService.ts` | Constante `EDIFICIOS_OLEADA_1`, líneas 118–203, con los mismos cuatro valores en `nombre`. |
| `GET /api/3d/oleadas/primera` | `200 application/json`; `totalEdificios: 4` y los mismos cuatro valores en `edificios[].nombre`. |

### Datasets publicados por API

`GET /api/3d/datasets` respondió `200 application/json`, `total: 3`, y devuelve las rutas independientes esperadas:

| Tipo | ID | `tilesetUrl` devuelto |
|---|---|---|
| `point_cloud` | `ds3d_malaga_lidar_2024` | `/tilesets/malaga-centro-2024/tileset.json` |
| `buildings_lod2` | `ds3d_malaga_lod2_2026` | `/tilesets/malaga-lod2-oleada1/tileset.json` |
| `photogrammetry_mesh` | `ds3d_malaga_photo_2026` | `/tilesets/malaga-fotogrametria-oleada1/tileset.json` |

Estas rutas son distintas entre sí y coinciden con la migración (`002_fase2_datasets_3d.sql:105,124,143`) y el catálogo TypeScript (`catalog3DService.ts:67,88,109`).

## 3. Visor Cesium `Real3DTilesViewer.tsx`

La integración implementa tres capas 3D independientes:

| Condición | Evidencia de código |
|---|---|
| URLs específicas | Constantes LiDAR, LOD2 y fotogrametría en líneas 54–56. |
| Gestión de instancias | `tilesetLidarRef`, `tilesetLod2Ref` y `tilesetPhotoRef` en líneas 80–83. |
| Instanciación real | `Cesium3DTileset.fromUrl` para LiDAR (242), LOD2 (256) y fotogrametría (270). Cada resultado se añade a `viewer.scene.primitives`. |
| Estado independiente | `capas3D` contiene `lidarPnoa`, `lod2Buildings` y `photoMeshes` (89–94). |
| Visibilidad inicial | Cada tileset recibe su respectivo valor `.show` al cargar (249, 261, 275). |
| Visibilidad reactiva | Tres efectos independientes actualizan `.show` sin recargar el visor (300–317). |
| Controles de usuario | Botones separados modifican los tres campos de estado (342, 354 y 366). |

**Resultado:** el visor no reutiliza el LiDAR como sustituto: carga y controla LiDAR, LOD2 y mallas fotogramétricas de forma independiente.

## 4. Ficha `OleadaDetailModal.tsx`

| Condición | Evidencia de código | Resultado |
|---|---|---|
| QA dinámico | `renderQaBadge(estado)` ramifica para `APROBADO_QA`, `CAPTURADO` y el caso especificado (14–35); se invoca con `edificio.estadoQa` (73). | **PASS** |
| Clasificación de difusión visible | `renderDifusionBadge(difusion)` representa pública, restringida por seguridad e interna municipal (37–58); se invoca con `edificio.clasificacionDifusion` (74). | **PASS** |
| Focalización disponible desde la ficha | El botón condicionado a `onFocusEdificio` invoca el callback con el edificio actual y cierra el modal (136–146). | **PASS** |

La respuesta de `GET /api/3d/oleadas/primera` contiene tanto `estadoQa` como `clasificacionDifusion` en cada edificio, por lo que los datos consumidos por estas rutas de representación están presentes en el contrato runtime comprobado.

## 5. Conexión de foco en `App.tsx`

La ruta de interacción queda conectada de extremo a extremo en código:

1. `App.tsx:75` crea `real3DViewerRef` tipado como `Real3DTilesViewerHandle`.
2. `App.tsx:288–295` entrega esa referencia al visor y conecta la selección de edificio al estado del modal.
3. `App.tsx:325–331` entrega al modal `onFocusEdificio`; el callback invoca `real3DViewerRef.current?.flyToEdificio(edificio)`.
4. `Real3DTilesViewer.tsx:96–111` expone `flyToEdificio` por `useImperativeHandle` y ejecuta `viewer.camera.flyTo` con las coordenadas del edificio.

**Resultado:** la acción «Centrar en Visor 3D» de la ficha tiene un receptor válido y alcanza la operación Cesium de vuelo a la entidad solicitada.

## Evidencia runtime consolidada

| Consulta de solo lectura | Resultado observado |
|---|---|
| `GET /tilesets/malaga-centro-2024/tileset.json` | `200 application/json` |
| `GET /tilesets/malaga-lod2-oleada1/tileset.json` | `200 application/json` |
| `GET /tilesets/malaga-fotogrametria-oleada1/tileset.json` | `200 application/json` |
| GET de GLB referenciados por los tres manifiestos | `383/383` con `200 model/gltf-binary` |
| `GET /api/3d/oleadas/primera` | `200 application/json`; cuatro edificios y nombres canónicos |
| `GET /api/3d/datasets` | `200 application/json`; tres datasets con tres URLs independientes |

## Conclusión

Los defectos constatados en la validación anterior —manifiestos LOD2/fotogrametría ausentes o no JSON, URLs API que reutilizaban LiDAR, nombres no normalizados, falta de carga multicapa Cesium, QA fijo, difusión oculta y callback de foco desconectado— no se reproducen en esta revisión.

> **Aceptación recomendada para los cinco hallazgos de resolución de Fase 2: PASS.**
>
> Quedan fuera del alcance de este dictamen una prueba de navegador/renderizado y mediciones de rendimiento, así como la demostración de que una base PostGIS persistente sea la fuente efectiva de la API; ninguno de esos puntos forma parte de los cinco hallazgos solicitados en esta resolución.
