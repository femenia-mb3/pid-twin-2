# Integración de PNOA LiDAR y 3D Tiles para un Nivel 3 real

El **Nivel 3 real** no consiste en enviar un fichero LAZ al navegador ni en dibujar prismas de edificios genéricos. Debe entregar geometría georreferenciada y con nivel de detalle adaptativo: nube de puntos, terreno, edificios o malla fotogramétrica. El visor solo carga los fragmentos necesarios para la cámara actual. Esa es precisamente la finalidad de **3D Tiles**, un estándar OGC para transmitir contenido geoespacial 3D masivo —nubes de puntos, modelos de edificios, BIM/CAD y fotogrametría— mediante una jerarquía de teselas. [4]

El PNOA-LiDAR es una fuente adecuada para iniciar esta capa. La tercera cobertura nacional se realizó entre 2022 y 2025, llega a 5 puntos/m² y declara un RMSE Z de hasta 10 cm. El CNIG distribuye las nubes en ficheros LAZ RGBI de 1 × 1 km, con clasificación de suelo, vegetación, edificios y solapes en los niveles NPC01/NPC02; el NPC03 incorpora clases adicionales. [1] [3] La disponibilidad exacta debe confirmarse por área de interés en el Centro de Descargas antes de diseñar el alcance de cada municipio.

## Arquitectura objetivo dentro del MVP actual

La arquitectura ya contiene los elementos adecuados para el modelo de destino y los servicios OGC: PostGIS, GeoServer, la API de ingestión y el visor web. Para Nivel 3 deben añadirse dos piezas separadas: un **proceso de teselado 3D** y un **repositorio de activos 3D inmutables**. No conviene procesar LiDAR en el contenedor de la API ni guardar millones de puntos como geometrías operativas de PostGIS.

PostGIS sigue siendo el registro de control. Debe almacenar el catálogo de versiones, la cobertura espacial, el sistema de referencia, la fecha de captura, la licencia, el estado de publicación y la relación con el destino. GeoServer continúa publicando las capas 2D y 2.5D: límites, zonas de aforo, recursos, sensores, resultados de simulación y raster de apoyo. El contenido 3D teselado se almacena en almacenamiento de objetos compatible con S3 o en un volumen HTTP versionado y se sirve mediante CDN o Nginx. El visor reemplaza la actual demostración WebGL por un cliente 3D Tiles, por ejemplo CesiumJS, manteniendo los paneles de simulación y las API existentes.

El resultado queda así:

```text
PNOA LAZ / COG / 3D Tiles entregados por Ayuntamiento
             │
             ▼
  Validación + reproyección + control de calidad
             │
             ├──► PostGIS: catálogo, cobertura, metadatos, resultados analíticos
             ├──► GeoServer: WMS/WFS/OGC API de capas 2D y raster
             └──► Worker PDAL / teselador: terreno, nubes y edificios
                                      │
                                      ▼
                   Object Storage + CDN /tilesets/{destino}/{version}/
                                      │
                                      ▼
                     Visor CesiumJS + capas de simulación del gemelo
```

## Dos rutas de integración

### Si el ayuntamiento ya dispone de 3D Tiles

Esta es la ruta más corta. Se solicita una entrega versionada con un `tileset.json` raíz, todas las teselas referenciadas, metadatos de sistema horizontal y vertical, zona de cobertura, fecha de captura, precisión, licencia y una muestra de control. Un conjunto 3D Tiles se identifica por ese JSON de entrada; cada tesela define su volumen de cobertura, el error geométrico para seleccionar detalle y el contenido que debe solicitar el cliente. [6]

La recepción debe validar cuatro aspectos antes de publicar. Primero, que todas las URLs relativas de `tileset.json` se resuelven dentro de la misma versión y no apuntan a dominios del proveedor. Segundo, que el conjunto está correctamente georreferenciado y que su datum vertical es conocido. Tercero, que el presupuesto de detalle permite fluidez en ordenadores municipales normales. Cuarto, que los metadatos de edificios, cuando existan, no exponen información sensible innecesaria.

Una vez validado, se copia la carpeta sin modificar a una ruta inmutable, por ejemplo `s3://gemelo-3d/malaga/2026-01/`. La API registra una versión activa y entrega al cliente una URL relativa firmada o protegida por sesión. El navegador nunca debe acceder a credenciales de almacenamiento.

```ts
// Visor de producción: carga de un conjunto ya teselado
const tileset = await Cesium.Cesium3DTileset.fromUrl(
  '/api/3d/tilesets/malaga/2026-01/tileset.json',
  { maximumScreenSpaceError: 16 }
);
viewer.scene.primitives.add(tileset);
await viewer.zoomTo(tileset);
```

La API debe comprobar permisos antes de devolver la URL o el manifiesto. Para áreas públicas, la CDN puede servir las teselas directamente; para infraestructuras críticas, instalaciones municipales o modelos de alto detalle, es preferible un proxy de autorización o URLs firmadas de corta vida.

### Si solo se dispone de PNOA LiDAR

El fichero LAZ es la materia prima, no el formato de publicación web. PNOA entrega la tercera cobertura en LAZ RGBI, con ETRS89/UTM en Península e Illes Balears y alturas ortométricas. En este MVP hemos validado y ejecutado el flujo completo para el **área piloto Centro Histórico–Puerto de Málaga**:

1. **Descarga oficial y validación espacial**:
   - Fichero: `PNOA_2024_AND_373-4065_H30_NPC02.LAZ` (47,97 MB transferidos, 6.199.950 puntos, CRS 25830).
   - Cobertura comprobada: UTM 30N `X: 373000..374000`, `Y: 4064000..4064999.999`. Incluye Centro Histórico, Alcazaba, Muelle Uno y Puerto de Málaga.

2. **Conversión sin pérdida a LAS intermedio**:
   - Mediante `scripts/convert_laz_to_las.py`, conservando cabecera VLR, clasificaciones y coordenadas (225 MB).

3. **Teselado reproducible a OGC 3D Tiles 1.1**:
   - Ejecución mediante `tools/ptiler` (algoritmo open-source compilado en Rust/GLTF):
   ```bash
   ./tools/ptiler \
     --input data/lidar/malaga_centro/raw/PNOA_2024_AND_373-4065_H30_NPC02.las \
     --output ./public/tilesets/malaga-centro-2024 \
     --input-epsg 25830 --output-epsg 4979 \
     --min 15 --max 19 --threads 6 --quantize --meshopt
   ```
   - **Salida generada**: 375 archivos `.glb` jerárquicos (62,4 MB) y descriptor raíz `/tilesets/malaga-centro-2024/tileset.json`.

4. **Integración en el visor municipal**:
   - Cliente CesiumJS integrado mediante carga diferida (`Real3DTilesViewer`), superponiendo las capas analíticas del gemelo (zonas de capacidad, puntos IoT y rutas de desvío) directamente sobre la nube teselada georreferenciada.

1. **Terreno navegable.** Se filtran los puntos de suelo o se utiliza el MDT50 cm. Se genera un DEM/COG de referencia y un terreno teselado para el visor. Esto habilita pendientes, escorrentía, accesibilidad y simulaciones de visibilidad.

2. **Edificios LOD1/LOD2.** Se cruzan huellas de edificio municipales o catastrales con la clase de edificación o con un MDS normalizado. Con la diferencia entre suelo y cubierta se obtiene una altura; las huellas se extruyen a volúmenes reales. Si el municipio entrega CityGML, CityJSON, IFC o una escena I3S, se debe priorizar esa geometría sobre una extracción automática de LiDAR.

3. **Nube de puntos o malla de alta fidelidad.** La nube clasificada puede convertirse a 3D Tiles de tipo point cloud. Si existe fotogrametría o una malla texturizada, se publica como tileset independiente y se controla por nivel de detalle. El estándar 3D Tiles permite combinar diferentes representaciones y asociar metadatos de contenido. [4] [6]

Una implementación de referencia puede aceptar LAZ, COG, CityGML y modelos fotogramétricos, y teselarlos de forma gestionada. Las herramientas comerciales de teselado declaran soporte específico para nubes LAS/LAZ, terreno, fotogrametría, CityGML y modelos 3D; para entornos con restricciones de soberanía, el ayuntamiento debe decidir entre un servicio gestionado, una instalación autocontenida del proveedor o una cadena open source administrada internamente. [5]

## Modelo de datos mínimo

Añadiría a PostGIS un catálogo de activos 3D separado del dato transaccional del gemelo. La clave es que el visor consulte un catálogo pequeño y que las teselas se descarguen desde almacenamiento optimizado.

```sql
CREATE TABLE dataset_3d (
  id uuid PRIMARY KEY,
  destino_id varchar(64) NOT NULL REFERENCES destinos(id),
  tipo varchar(24) NOT NULL, -- terrain, point_cloud, buildings, photogrammetry
  version varchar(80) NOT NULL,
  estado varchar(20) NOT NULL, -- validado, publicado, retirado
  crs_horizontal varchar(32) NOT NULL,
  datum_vertical varchar(80) NOT NULL,
  fecha_captura date,
  precision_z_m numeric(8,3),
  cobertura geometry(MultiPolygon, 4326) NOT NULL,
  tileset_url text NOT NULL,
  checksum varchar(128),
  licencia text NOT NULL,
  atribucion text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(destino_id, tipo, version)
);
CREATE INDEX dataset_3d_cobertura_gix ON dataset_3d USING gist (cobertura);
```

La API puede exponer `GET /api/3d/datasets?destino=malaga` para el catálogo y `GET /api/3d/datasets/{id}/manifest` para la configuración de carga. La simulación se mantiene como hasta ahora: escribe indicadores y geometrías de impacto en PostGIS y el visor 3D las pinta como capas analíticas encima de las teselas reales. No se reescribe el dataset LiDAR por cada escenario.

## Paso del MVP al Nivel 3 verdadero

El cambio de la aplicación debe tener tres consecuencias. Primero, el botón actual **“Nivel 3 (Demo 3D)”** solo se habilita como **“Nivel 3 real”** cuando el catálogo devuelve un dataset publicado y compatible. Segundo, el componente `ThreeDViewer` debe sustituir sus bloques procedimentales por CesiumJS u otro cliente compatible con 3D Tiles. Tercero, la etiqueta de cada dataset visible debe mostrar fuente, fecha de captura, precisión y versión para impedir que una imagen de 2022 se interprete como situación actual.

La simulación de capacidad, rutas y sensores se puede conservar: las zonas se convierten a coordenadas de escena y se representan como polígonos o volúmenes semitransparentes; los puntos IoT se alimentan desde la misma API de telemetría. El motor de contexto no depende de que el fondo sea 2D o 3D.

## Requerimientos técnicos mínimos para producción municipal

### Datos y gobierno

El ayuntamiento debe designar un responsable funcional del gemelo y un responsable técnico de datos geoespaciales. Antes de desplegar, ambos deben aprobar el área de cobertura inicial, el objetivo de actualización, los datos autorizados y la regla de retirada de versiones antiguas. Cada activo 3D necesita una ficha con fuente, fecha, CRS horizontal, datum vertical, precisión, licencia, restricciones de uso y responsable.

Para un Nivel 3 inicial basta una zona prioritaria con LiDAR o 3D Tiles, un modelo de terreno y huellas de edificio. Para análisis de movilidad turística conviene añadir red viaria y peatonal, POIs, aforos y zonas de capacidad. Para fotogrametría o malla texturizada se requiere además autorización clara de publicación, porque el nivel de detalle puede revelar elementos que no deben hacerse públicos.

La integración debe preservar atribución CNIG cuando se utilice PNOA. El portal de la tercera cobertura indica que sus condiciones son compatibles con CC-BY 4.0 y exige reconocer el origen y la propiedad. [3]

### Servicios y software

La instalación mínima separa los siguientes roles: API/visor, PostGIS, GeoServer, worker de procesamiento y almacenamiento de objetos. El API/visor debe ser stateless. PostGIS conserva el dato operativo, la trazabilidad y el catálogo. GeoServer publica WMS/WFS/OGC API de las capas 2D y raster. El worker procesa descargas y genera nuevas versiones fuera del tráfico de usuarios. El almacenamiento de objetos sirve `tileset.json` y teselas con URLs estables por versión.

No se debe depender de GeoServer como servidor de 3D Tiles ni de PostGIS como repositorio principal de nube de puntos. Ambos son valiosos dentro de la arquitectura, pero un tileset 3D se entrega mejor como archivos jerárquicos desde object storage/CDN. La API solo autoriza, cataloga y devuelve la versión correcta.

El despliegue debe incluir TLS, DNS, proxy inverso, límites de tasa, observabilidad de API y de tiles, registros de acceso, alertas de espacio, copia diaria de PostGIS y versionado o replicación de object storage. Se recomienda integrar el acceso de personal municipal con el proveedor de identidad corporativo y separar al menos los roles de administrador de datos, operador y consulta.

### Dimensionamiento de arranque

Para un piloto urbano de unos pocos kilómetros cuadrados y usuarios internos concurrentes, una base prudente es: API/visor con 2 vCPU y 4–8 GB de RAM; PostGIS con 4 vCPU, 16 GB de RAM y 200 GB NVMe; worker aislado con 8 vCPU, 32 GB de RAM y 300 GB de disco temporal rápido; y object storage con al menos 500 GB, versionado y espacio de crecimiento. El worker no debe compartir host ni volumen crítico con la base de datos.

Para una ciudad completa, fotogrametría de alta resolución o reteselado frecuente, el salto habitual es a un worker de 16 vCPU, 64 GB de RAM y 1 TB de espacio temporal, con almacenamiento de objetos ampliable por terabytes. No debe fijarse el tamaño final sin medir un área de prueba: los LAZ de 1 × 1 km publicados por CNIG pueden ocupar del orden de centenares de megabytes y el volumen publicado depende del filtrado, el nivel de detalle y las versiones que se retengan. [3]

El requisito de red no es solo ancho de banda del servidor. Las teselas deben tener CDN o caché de borde, compresión adecuada y cache-control inmutable por versión. El navegador descarga muchos ficheros pequeños durante la navegación 3D; por eso es preferible un tileset con jerarquía y error geométrico correctos frente a una sola descarga masiva. [6]

### Seguridad y continuidad

El ayuntamiento debe clasificar los modelos 3D antes de abrirlos al público. Es razonable publicar terreno y edificios simplificados; no es razonable exponer por defecto nubes de puntos detalladas de recintos sensibles, interiores, infraestructura crítica o datos asociados a dispositivos. Las capas de afluencia se deben agregar espacial y temporalmente cuando existan riesgos de identificación o de seguridad operativa.

Debe existir un backup verificable de PostGIS, recuperación de object storage, registro de la versión visible en cada sesión y rollback de tilesets mediante el cambio del puntero `dataset_3d.estado = 'publicado'`. La actualización de LiDAR o fotogrametría se publica como versión nueva después de pruebas de CRS, cobertura, carga web y atribución; nunca se sobrescribe una versión que esté en uso.

## Orden de implantación recomendado

Primero, se define una zona piloto y se obtiene una muestra PNOA o un tileset municipal. Segundo, se valida CRS, datum vertical, cobertura, licencia y calidad visual. Tercero, se construye el catálogo `dataset_3d`, el almacenamiento versionado y una carga 3D Tiles en un entorno no productivo. Cuarto, se conecta la simulación existente como capa analítica. Finalmente, se promueve el conjunto a producción con caché, monitorización, control de acceso y recuperación probada.

La decisión principal es sencilla: si el municipio ya tiene **3D Tiles o I3S**, hay que validarlos, versionarlos y conectarlos directamente. Si solo dispone de PNOA, se inicia con **terreno + edificios LOD1** a partir de LiDAR y huellas, y se añade nube de puntos o fotogrametría solo donde aporte valor operativo. Así se obtiene un Nivel 3 útil sin convertir toda la ciudad a un modelo pesado antes de tener un caso de uso claro.

**Autor:** Manus AI

## References

[1]: https://pnoa.ign.es/pnoa-lidar/presentacion "PNOA LiDAR: presentación oficial"
[2]: https://pnoa.ign.es/pnoa-lidar/productos-a-descarga "PNOA LiDAR: productos disponibles para descarga"
[3]: https://centrodedescargas.cnig.es/CentroDescargas/lidar-tercera-cobertura "CNIG: LiDAR tercera cobertura 2022-2025"
[4]: https://www.ogc.org/standards/3dtiles/ "OGC 3D Tiles Standard"
[5]: https://cesium.com/platform/cesium-ion/3d-tiling-pipeline/ "Cesium 3D Tiling Pipeline"
[6]: https://docs.ogc.org/cs/22-025r4/22-025r4.html "OGC 3D Tiles Specification 1.1"
