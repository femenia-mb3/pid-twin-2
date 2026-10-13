# Fase 2 — Edificios clave LOD2 y mallas 3D texturizadas

La Fase 2 debe construirse como **dos activos coordinados**, no como un único producto llamado “malla LOD2 texturizada”:

1. Un **modelo semántico LOD2** de cada edificio: geometría limpia de cubierta, fachadas y suelo, un identificador estable y atributos útiles para simulación, mantenimiento y consulta.
2. Una **malla fotogramétrica texturizada** para los inmuebles que justifican una experiencia visual próxima: patrimonio, hitos turísticos, accesos estratégicos y nodos de movilidad.

La primera capa responde a *qué es cada edificio y cómo se puede analizar*. La segunda responde a *cómo se ve*. CityGML define el LOD2 como una representación realista pero generalizada y permite separar semánticamente superficies como cubierta, pared y suelo. También admite apariencias en forma de materiales o texturas. [1] La especificación OGC 3D Tiles 1.1 permite publicar ambos productos como contenido glTF/GLB jerárquico, incluidas geometrías con textura y metadatos. [2]

> **Decisión de arquitectura:** el tileset LiDAR PNOA 2024 ya publicado seguirá siendo la capa territorial de contexto. Los nuevos tilesets LOD2 y fotogramétricos se incorporarán como datasets independientes, versionados e intercambiables; nunca se sustituirá ni se editará el PNOA original para cada escenario.

## Alcance inicial recomendado

Iniciar con un piloto de **5 a 8 inmuebles clave** dentro de la tesela actual Málaga Centro–Puerto. La selección debe salir de un taller de dos horas con Turismo, Urbanismo/GIS, Patrimonio, Movilidad y el responsable operativo del gemelo.

La puntuación de selección debe combinar cinco criterios: relevancia turística, valor para simulaciones de aforo o rutas, visibilidad desde espacio público, riesgo de deterioro o renovación próxima y viabilidad de captura. El resultado será una lista priorizada con un edificio suplente, su uso previsto en el gemelo, el propietario de los datos y las restricciones de publicación.

La primera entrega debe cubrir al menos tres tipologías distintas: un edificio patrimonial complejo, un equipamiento cultural de gran afluencia y un volumen urbano o portuario relevante. Esto permite comprobar que el flujo funciona más allá de una única cubierta sencilla.

### Oleadas acordadas para Málaga Centro–Puerto

La **primera oleada** comprenderá cuatro activos: **Catedral de Málaga, Alcazaba, Museo Picasso Málaga y Centre Pompidou Málaga**. Juntos validan cubiertas complejas, patrimonio con distintas restricciones de acceso, un equipamiento cultural de alta afluencia y la continuidad operativa entre el casco histórico y el frente portuario.

La aceptación de esta oleada será un hito obligatorio antes de ampliar el perímetro. Solo cuando se hayan aprobado precisión, permisos, calidad de textura, rendimiento web y la superposición con las simulaciones, se pondrá en marcha la **segunda oleada**: **Teatro Romano, Palacio de la Aduana / Museo de Málaga y activos portuarios**. Estos últimos se incorporarán únicamente después de cerrar con la Autoridad Portuaria la cobertura de captura, la titularidad y el nivel de publicación permitido.

El taller inicial deberá producir una ficha por activo con: `building_id` propuesto, organismo titular, finalidad en el gemelo, polígono de captura, responsable de autorización, clasificación de difusión (interna o pública), fuente de datos existente y riesgo técnico. Esta ficha pasa a ser el anexo de alcance contra el que se aceptará cada entrega.

## Arquitectura objetivo sobre el MVP desplegado

```text
PNOA LiDAR 2024 (contexto) ────────────────────────────┐
Huella catastral / municipal + atributos ──┐           │
Fotogrametría aérea y terrestre + GCP ─────┼─► QA ────┼─► PostGIS: catálogo, edificio_id, cobertura y trazabilidad
Escáner terrestre opcional ────────────────┘           │
                                                        ├─► Tileset A: edificios LOD2 semánticos
                                                        ├─► Tileset B: mallas fotogramétricas texturizadas
                                                        └─► Object Storage/CDN: /tilesets/malaga/{tipo}/{versión}/
                                                                             │
                                                                             ▼
                                                              CesiumJS + capas de aforo, IoT y rutas
```

En el visor se añadirán tres controles independientes: **LiDAR PNOA**, **Edificios LOD2** y **Malla patrimonial texturizada**. Cuando una malla fotogramétrica cubra un edificio, el visor ocultará o reducirá la opacidad del LOD2 y de la nube de puntos dentro de su polígono de cobertura. Así se evitan geometrías duplicadas, parpadeo (*z-fighting*) y sobrecarga de GPU.

Cada elemento seleccionado mostrará fuente, fecha de captura, precisión, versión, licencia y un enlace a su ficha de calidad. Los resultados de simulación continuarán siendo capas independientes y se colocarán sobre la representación activa.

## Datos maestros y contrato de entrega

El ayuntamiento debe conservar siempre los originales y los modelos editables. El 3D Tiles será solo el formato de publicación web.

| Producto | Formato maestro | Formato de publicación | Uso principal |
|---|---|---|---|
| Edificios LOD2 | CityJSON 2.0 o CityGML 3.0, más huellas y atributos en PostGIS | 3D Tiles 1.1 con GLB | Consultas, simulación, análisis de cubiertas y visibilidad |
| Malla texturizada | OBJ/FBX/GLB de alta resolución, fotos originales, cámaras y proyecto de reconstrucción | 3D Tiles 1.1 con GLB y texturas KTX2 | Navegación visual y presentación patrimonial |
| Control geométrico | GCP/checkpoints, informe de ajuste y CRS | PDF/CSV y registro en PostGIS | Aceptación, auditoría y futuras actualizaciones |

CityJSON es una opción práctica para el activo maestro LOD2: soporta geometrías `Solid` y `MultiSurface`, un atributo de nivel de detalle, semántica por superficie y materiales o texturas. [3] El contrato municipal debe fijar un `building_id` único que conecte el CityJSON/CityGML, la huella PostGIS, el tileset web y cualquier ficha de inventario o mantenimiento.

Para cada versión se registrará en el catálogo `dataset_3d` ya previsto: `tipo` (`buildings_lod2` o `photogrammetry`), versión, fecha de captura, CRS horizontal, datum vertical, precisión, cobertura, checksum, licencia y URL del `tileset.json`. Se añadirá una tabla `edificio_3d` para vincular `building_id`, `dataset_3d_id`, huella, estado de QA y relación con el recurso turístico del gemelo.

## Captura y reconstrucción

### 1. Preparación y control topográfico — semanas 1 y 2

Antes de volar, se recopilan huellas municipales o catastrales, ortofoto, PNOA, planos disponibles, restricciones patrimoniales y posibles modelos BIM/IFC. Se delimita el área de exclusión de cada edificio y se definen puntos de control en tierra (GCP) y puntos de comprobación independientes.

El sistema de referencia maestro del proyecto será **ETRS89 / UTM 30N (EPSG:25830)**, coherente con el LiDAR actual. El contrato debe declarar de forma expresa el datum vertical y el método de transformación a la referencia elipsoidal usada por Cesium. No se aceptará una malla cuyo desplazamiento vertical se haya corregido solo “a ojo”.

Como umbrales iniciales de contratación, sujetos a una prueba de captura previa, propongo:

- GSD objetivo de **1–2 cm/píxel** en fachadas y cubiertas de los inmuebles prioritarios.
- Error RMSE de los checkpoints de **≤ 5 cm en XY** y **≤ 8 cm en Z** para el activo patrimonial; una tolerancia mayor deberá declararse por edificio y justificarse.
- Solape fotográfico alto: vuelos nadirales para cubierta y vuelos oblicuos orbitando cada fachada.
- Captura terrestre complementaria en patios, soportales, fachadas estrechas o zonas ocluidas desde el aire.

La operación con UAS en entorno poblado se planificará con un operador habilitado. AESA identifica el escenario europeo STS-01 para operaciones VLOS sobre zona terrestre controlada en entorno poblado con UAS C5; si el caso no encaja en categoría abierta ni escenario estándar, exige autorización operacional previa basada en evaluación de riesgo. [4] Antes de cualquier campaña se validarán también permisos del titular del inmueble, autoridad portuaria cuando corresponda, Patrimonio y restricciones de privacidad.

### 2. Producción del LOD2 — semanas 3 a 5

El LOD2 no se generará por mera extrusión automática. Partiendo de huellas validadas, nube densa, LiDAR PNOA y fotografías, el proveedor reconstruirá una envolvente cerrada y topológicamente correcta con:

- `RoofSurface`, `WallSurface` y `GroundSurface` identificables;
- cubiertas inclinadas, cúpulas o volúmenes singulares representados de forma simplificada pero reconocible;
- partes de edificio cuando haya cuerpos diferenciados;
- atributos de altura, fecha, fuente, precisión, `building_id` y nivel de confianza;
- sin interiores, mobiliario, ventanas modeladas una a una ni detalle LOD3 salvo que un caso operativo lo requiera.

La validación automática comprobará sólidos cerrados, ausencia de auto-intersecciones, orientación consistente, vértices duplicados y correspondencia con la huella. La aceptación visual se realizará contra ortofoto, fotografías de control y PNOA. CityGML admite distintas representaciones del mismo objeto en varios LOD y separa la semántica de la elección de geometría, por lo que el LOD2 será el gemelo analítico estable incluso si la malla visual se actualiza con más frecuencia. [1]

### 3. Producción de la malla texturizada — semanas 3 a 6

Con las mismas imágenes se ejecuta una reconstrucción fotogramétrica: alineación, nube densa, eliminación de cielo/vehículos/personas, malla, limpieza manual y atlas de textura. Las superficies brillantes, vegetación, tráfico y vidrios se revisarán de forma específica porque son las principales causas de ruido y huecos.

La malla debe quedar georreferenciada en el mismo marco de control que el LOD2. Antes de publicar se crea una versión optimizada para web: simplificación por niveles de detalle, textura KTX2, compresión geométrica Draco o Meshopt y teselado OGC 3D Tiles 1.1. El uso de KTX2 mejora el uso de GPU en ejecución; Cesium recomienda 3D Tiles 1.1 para nuevos modelos fotogramétricos y documenta KTX2, Draco y Meshopt como alternativas de compresión. [5]

Se puede utilizar un teselador gestionado, una instalación autocontenida o una cadena propia. La decisión depende de soberanía, presupuesto y capacidad operativa:

- **Gestionado:** menor plazo y menor carga de operación; exige revisar dónde se alojan originales y resultados.
- **Autocontenido:** mantiene los datos municipales dentro de la infraestructura contratada; exige licencia y operación especializada.
- **Cadena abierta:** da máximo control, pero el ayuntamiento debe asumir automatización, QA, actualizaciones y soporte de formatos.

## Publicación e integración

Se crearán rutas versionadas e inmutables:

```text
/tilesets/malaga/point-cloud/2024-pnoa-373-4065/tileset.json
/tilesets/malaga/buildings-lod2/2026-01/tileset.json
/tilesets/malaga/photogrammetry/2026-01/tileset.json
```

El catálogo PostGIS seleccionará qué versión está publicada; no se sobrescribirán ficheros activos. El visor consultará `GET /api/3d/datasets?destino=malaga` y cargará cada tileset según tipo, cobertura y nivel de zoom. 3D Tiles organiza el contenido en una jerarquía LOD y usa el error geométrico y el error de pantalla para decidir cuándo refinar; por ello cada tesela debe llevar un error geométrico medible y decreciente hasta las hojas. [2]

Las mallas patrimoniales no se publicarán como una sola descarga pesada. Se verificará que el primer nivel de detalle útil aparece en menos de cinco segundos bajo una red de referencia acordada y que el detalle fino se descarga únicamente al acercar la cámara. Para todo activo público se configurará CDN y `Cache-Control` largo e inmutable por versión. Para activos sensibles se aplicará catálogo autenticado y URL firmada.

## Criterios de aceptación

La aceptación requerirá cuatro pruebas y un acta por edificio:

1. **Control geométrico.** Se comparan GCP y checkpoints con la malla y el LOD2. El proveedor entrega residual individual, RMSE y metodología.
2. **Calidad de cobertura.** No habrá huecos significativos en fachadas o cubiertas visibles desde el área de operación. Los huecos inevitables se inventariarán como limitación, no se ocultarán con texturas artificiales.
3. **Calidad semántica.** Cada edificio aprobado tiene `building_id`, geometría válida, huella consistente, superficies básicas clasificadas y atributos completos.
4. **Rendimiento web.** Todos los contenidos de `tileset.json` resuelven, no existen referencias rotas, la escena se navega sin sustituciones bruscas de LOD y los tilesets no producen errores de consola en los equipos de referencia municipal.

Como prueba de usuario, se ejecutarán tres casos del gemelo: consulta de un inmueble y su ficha, simulación de aforo en su entorno y comparación entre LiDAR/LOD2/malla mediante selector de capas. El resultado esperado no es solo “que se vea bonito”, sino que la vista permita interpretar capacidad, accesos, zonas de sombra y rutas alrededor del edificio.

## Calendario propuesto

| Hito | Duración | Resultado verificable |
|---|---:|---|
| Arranque, selección y permisos | 2 semanas | Lista de inmuebles, caso de uso, matriz de permisos, contrato de datos |
| Control topográfico y captura | 1–2 semanas | Imágenes, GCP/checkpoints, metadatos de vuelo y registro de incidencias |
| Reconstrucción LOD2 y mallas | 3 semanas | CityJSON/CityGML, modelo fotogramétrico, informe de precisión preliminar |
| QA, optimización y teselado | 2 semanas | 3D Tiles 1.1 versionados, validación técnica y visual |
| Integración en Cesium y piloto interno | 2 semanas | Catálogo, selector de capas, fichas de activo y pruebas de rendimiento |
| Aceptación y publicación controlada | 1 semana | Actas de calidad, capacitación y plan de actualización |

El rango realista para un primer piloto es de **11 a 12 semanas** desde que se aprueben inmuebles, permisos y proveedor de captura. La captura aérea puede alterar el calendario por restricciones de vuelo o meteorología; por eso no debe comenzar la producción sin una ventana de contingencia.

## Riesgos que deben cerrarse antes de contratar

- **Duplicación visual:** se resuelve con cobertura poligonal por tileset y reglas de prioridad en Cesium; la malla debe prevalecer en primer plano, el LOD2 en análisis y el LiDAR como contexto.
- **Desplazamiento vertical:** se resuelve con GCP, datum vertical explícito y prueba de alineación contra PNOA antes del teselado.
- **Fotorrealismo sin semántica:** se evita exigiendo CityJSON/CityGML LOD2 como entregable independiente. Una malla sola no es suficiente para operaciones GIS.
- **Texturas pesadas o incompatibles:** se resuelve con atlas, LOD, KTX2 y prueba en el navegador municipal objetivo. glTF admite tanto mallas texturizadas como metadatos y 3D Tiles permite asociarlos a tiles, contenidos y entidades. [2]
- **Licencias, privacidad y patrimonio:** se documentan en el catálogo desde el inicio; las mallas no se harán públicas por defecto si muestran zonas restringidas o datos sensibles.
- **Dependencia de proveedor:** se evita exigiendo originales, proyectos de reconstrucción, formatos maestros abiertos, especificación de versión y derecho de reteselado.

## Próximo paso concreto

Convocar un taller de alcance con las cinco áreas municipales y cerrar en esa sesión: los 5–8 edificios candidatos, el caso de uso de cada uno, la política de publicación, la ruta de captura autorizada y el modelo de operación (gestionado, autocontenido o abierto). Con ese acta se puede preparar un pliego técnico que solicite entregables medibles y compatibles con el visor ya desplegado.

**Autor:** Manus AI

## References

[1]: https://docs.ogc.org/is/20-010/20-010.html "OGC CityGML 3.0 Conceptual Model"
[2]: https://docs.ogc.org/cs/22-025r4/22-025r4.html "OGC 3D Tiles 1.1 Community Standard"
[3]: https://www.cityjson.org/specs/ "CityJSON Specifications"
[4]: https://www.seguridadaerea.gob.es/es/ambitos/drones/operaciones-uas-drones/operaciones-con-uas-drones---categoria-especifica "AESA: operaciones UAS en categoría específica"
[5]: https://cesium.com/learn/3d-tiling/ion-tile-photogrammetry/ "Cesium: Tiling Photogrammetry Models"
