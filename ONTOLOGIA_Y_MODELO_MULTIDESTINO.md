# Ontología SEGITTUR y Modelo Multidestino del Gemelo Digital Turístico

El Gemelo Digital Turístico se ha ampliado con un **perfil de interoperabilidad multidestino**. Su objetivo es que un municipio incorpore datos propios de turismo, territorio, movilidad, IoT y 3D sin modificar el motor de simulación ni la aplicación. Cada entidad se identifica, se atribuye a un destino y tenant, declara su contexto semántico, y conserva evidencia de procedencia, calidad y actualización.

> Este perfil **no sustituye ni se presenta como una copia oficial** de la ontología de SEGITTUR. Es una capa de implementación que enlaza con su vocabulario público de referencia y añade las entidades operativas necesarias para un gemelo geoespacial.

## Evidencia y alineamiento

SEGITTUR publica un modelo conceptual para una Red de Ontologías del Sector Turístico y señala que la PID integrará ese vocabulario para crear capas de información turística interoperables entre destinos. El modelo sitúa en el núcleo la interacción turística y contempla clases, relaciones, identificadores de negocio, tesauros y casos de uso [1].

La PID plantea una colección de casos de uso que parten de un problema, identifican datos, los modelizan con nomenclatura y relaciones comunes, determinan la tecnología de captura y concretan las capacidades de intervención [2]. El perfil del gemelo adopta precisamente esta separación entre **vocabulario turístico común** y **configuración operativa propia de cada destino**.

NGSI-LD aporta la representación de entidades, propiedades, relaciones, propiedades geográficas y temporales; su estándar incluye además soporte para multi-tenancy, tipos y scopes [3]. Por eso se usa JSON-LD para el intercambio y PostGIS para las geometrías y consultas espaciales.

## Artefactos incorporados

| Artefacto | Propósito | Ruta |
|---|---|---|
| Contexto JSON-LD v1 | Define prefijos, tipos y propiedades que reciben los conectores | [`ontology/segittur-pid-context-v1.jsonld`](ontology/segittur-pid-context-v1.jsonld) |
| Perfil RDF/Turtle | Documenta clases, propiedades y mapeo con `estur:`/`pid:` | [`ontology/segittur-multidestino-profile.ttl`](ontology/segittur-multidestino-profile.ttl) |
| Restricciones SHACL | Declara atributos mínimos para perfiles, destinos, zonas, recursos, sensores y datasets | [`ontology/segittur-multidestino-shapes.ttl`](ontology/segittur-multidestino-shapes.ttl) |
| Contexto publicado | Activo que consumen las entidades JSON-LD | [`/ontology/segittur-pid-context-v1.jsonld`](/ontology/segittur-pid-context-v1.jsonld) |
| Migración PostGIS | Crea tenants, perfiles, registro semántico y contratos de ingestión | [`database/migrations/003_ontologia_multidestino.sql`](database/migrations/003_ontologia_multidestino.sql) |

## Modelo de dominio

El modelo separa tres capas para que la personalización de una ciudad no fracture el producto común.

```text
Tenant municipal / organismo operador
             │ 1:N
             ▼
Perfil semántico del destino ───────────────────────────────────────────────────┐
  namespace, contexto, política, nivel cartográfico, dominios, evidencias        │
             │ 1:1                                                               │
             ▼                                                                   │
Destino turístico (estur:TouristDestination)                                    │
  ├─ zonas operativas de capacidad de carga (pid:TourismZone)                    │
  ├─ recursos turísticos (estur:TouristEntity)                                  │
  ├─ eventos (estur:Event)                                                       │
  ├─ sensores y observaciones (pid:TourismSensor)                                │
  ├─ escenarios / resultados de simulación                                       │
  ├─ datasets geoespaciales 3D                                                   │
  └─ fuentes, contratos de ingestión y trazabilidad                              │
                                                                                │
Todos los datos se filtran por tenant_id + destino_id y mantienen su evidencia. ┘
```

### Entidades comunes y extensiones operativas

| Entidad JSON-LD | Vocabulario | Uso en el gemelo | Claves mínimas |
|---|---|---|---|
| `TouristDestination` | `estur:TouristDestination` | Identidad del municipio o destino, código INE y perímetro | `id`, `name`, `ineCode`, `location` |
| `TourismZone` | `pid:TourismZone` | Polígono para aforo, saturación, calor y medidas | `destination`, `location`, `capacity`, `capacityLoad` |
| `TourismResource` | `estur:TouristEntity` | Monumentos, museos, playas, miradores, etc. | `destination`, `name`, `location`, `capacity` |
| `TourismEvent` | `estur:Event` | Eventos, agendas y picos de demanda | `destination`, `name`, `location` |
| `TourismSensor` | `pid:TourismSensor` | Aforos, aire, ruido, meteorología y tráfico | `destination`, `location`, `measurement`, `observedAt` |
| `SimulationScenario` | `pid:SimulationScenario` | Hipótesis What-If y reglas de intervención | `destination`, `scenarioType`, `scenarioParameters` |
| `Dataset3D` | `pid:Dataset3D` | LiDAR, LOD2, fotogrametría y cobertura | `destination`, `coverage`, `version`, `license` |
| `DataSource` | `prov:Entity` / `pid:DataSource` | Fuente, calidad, actualización y trazabilidad | `name`, `dataQuality`, `updateFrequency`, `traceabilityId` |

El uso de `pid:` no inventa una ontología paralela: identifica los conceptos operativos que no están en el núcleo turístico publicado, como una zona de capacidad de carga, la configuración de un escenario o un dataset 3D. Cada extensión se vincula al destino y mantiene un mapeo documentado a la ontología turística cuando existe una clase equivalente.

## Convención de identificación y contexto

Los identificadores son estables y legibles para una administración, un broker NGSI-LD y un consumidor GIS:

```text
urn:ngsi-ld:TouristDestination:malaga
urn:ngsi-ld:TourismZone:malaga:malaga-centro
urn:ngsi-ld:TourismResource:palma:rec-la-seu
urn:ngsi-ld:TourismSensor:palma:iot-palma-borne-01
urn:ngsi-ld:Dataset3D:malaga:ds3d-malaga-lidar-2024
```

Cada entidad incorpora:

```json
{
  "id": "urn:ngsi-ld:TourismZone:palma:palma-casco-antiguo",
  "type": "TourismZone",
  "@context": "/ontology/segittur-pid-context-v1.jsonld",
  "destination": {
    "type": "Relationship",
    "object": "urn:ngsi-ld:TouristDestination:palma"
  },
  "location": {
    "type": "GeoProperty",
    "value": { "type": "Polygon", "coordinates": [] }
  },
  "capacityLoad": {
    "type": "Property",
    "value": 80.0,
    "observedAt": "2026-09-29T00:00:00Z",
    "unitCode": "P1"
  },
  "dataQuality": { "type": "Property", "value": "A_CERTIFICADA" },
  "traceabilityId": { "type": "Property", "value": "PID-TR-PMI-001" }
}
```

## Perfiles ya configurados

El modelo incluye **Málaga** y **Palma** como destinos independientes. Cada uno posee tenant, namespace, código INE, política de datos, dominios habilitados y niveles geoespaciales distintos.

- **Málaga** habilita los tres niveles —2D/2.5D, edificios y 3D Tiles— y sus datasets LiDAR/LOD2/fotogrametría ya están catalogados.
- **Palma** funciona como segundo perfil demostrador con Nivel 1 y Nivel 2. No se le asigna un activo 3D ficticio: el Nivel 3 solo se activa cuando cuente con LiDAR/3D Tiles publicados y validados.

La API de perfiles es la evidencia directa de esta configuración: `GET /api/semantic/profiles`.

## APIs implementadas

| Endpoint | Resultado | Evidencia / seguridad |
|---|---|---|
| `GET /api/semantic/model` | Descripción versionada de entidades, mapeos y fuentes | `application/ld+json`, `Cache-Control: no-store` |
| `GET /api/semantic/profiles` | Perfiles semánticos de los destinos configurados | Incluye tenant, contexto, política y niveles |
| `GET /api/semantic/profiles/:id` | Un perfil por ID o destino | 404 si no existe |
| `GET /api/semantic/entities?destino=palma&type=TourismZone` | Entidades normalizadas del destino | Incluye contexto, URNs, procedencia y calidad |
| `POST /api/semantic/validate` | Validación de una entidad entrante | Rechaza `id`, `type`, `destination` o `@context` inválidos con 422 |
| `POST /api/semantic/normalize` | Validación y normalización antes de persistencia | Declara `VALIDATED_NOT_PERSISTED` en demo; en PostGIS escribirá en el registro semántico |

No se cachean las respuestas de configuración ni las entidades operativas, pues pueden contener políticas, trazabilidad o telemetría mutable. El contexto JSON-LD versionado se publica como activo estático en `/ontology/`.

## Persistencia y aislamiento

La migración `003_ontologia_multidestino.sql` añade:

- `tenants_gemelo`: entidad responsable y política de datos.
- `destino_perfiles_semanticos`: configuración semántica única por destino.
- `registro_entidades_contexto`: payload JSON-LD íntegro con geometría PostGIS, tiempo de observación, calidad y evidencia.
- `contratos_ingestion_semantica`: configuración de mapeos desde NGSI-LD, GeoJSON, CSV, REST JSON o MQTT.
- `vista_contexto_multidestino`: consulta operacional conjunta, siempre filtrable por `tenant_id` y `destino_id`.

El aislamiento se aplica en dos niveles complementarios:

1. Las tablas de entidades y contratos disponen de una **clave foránea compuesta** `(tenant_id, destino_id)` contra el perfil semántico. Por ello, no se puede registrar una entidad del destino Palma bajo el tenant de Málaga, ni a la inversa.
2. La migración activa **Row-Level Security (RLS)** para perfiles, entidades y contratos. El API debe ejecutar `SET LOCAL app.tenant_id = '<tenant-autorizado>'` y `SET LOCAL app.destino_id = '<destino-autorizado>'` al abrir cada transacción; las políticas permiten leer o escribir únicamente las filas de ese par. El rol de aplicación no debe ser propietario de estas tablas ni disponer de `BYPASSRLS`.

El API Gateway debe seguir verificando el ámbito `tenant_id`/`destino_id` de cada credencial antes de establecer la variable de sesión; la clave foránea y RLS actúan como segunda barrera dentro de PostGIS.

## Alta de un nuevo destino

1. Crear el registro administrativo del destino, con código INE, perímetro, centro y capacidad de carga de referencia.
2. Crear el tenant y el perfil semántico: namespace `urn:ngsi-ld:pid:<destino>:`, idioma, zona horaria, política de datos y niveles cartográficos habilitados.
3. Declarar las zonas y recursos turísticos según las entidades del perfil. Cada dato debe enlazar con el destino y una fuente.
4. Registrar contratos de ingestión por proveedor y mapear sus columnas o atributos al contexto JSON-LD.
5. Usar `POST /api/semantic/validate` para comprobar el contrato antes de enviar datos operativos.
6. Publicar solo los datasets geoespaciales y 3D con cobertura, licencia, precisión, checksum y versión. El Nivel 3 no se habilita hasta que el `tileset.json` y sus contenidos pasen QA.
7. Aplicar controles de acceso por tenant y ejecutar una prueba de aislamiento: un token de un destino no puede consultar ni modificar datos de otro.

## Límite y proceso de actualización

El perfil se ha alineado con la IRI pública y las descripciones accesibles de SEGITTUR. Antes de declarar homologación oficial, debe compararse con las versiones y términos vigentes de la ontología publicada por SEGITTUR y validarse el mapeo con su equipo de gobernanza. El modelo se diseñó para que esa actualización afecte al contexto y a los mapeos, no a la aplicación completa.

**Autor:** Manus AI

## References

[1]: https://www.segittur.es/plataforma-inteligente/proyectos-plataforma-inteligente/modelo-conceptual-de-referencia-para-el-desarrollo-de-una-red-de-ontologias-del-sector-turistico/index.html "Red de Ontologías del Sector Turístico — SEGITTUR"
[2]: https://www.segittur.es/plataforma-inteligente/proyectos-plataforma-inteligente/casos-de-uso-plataforma-inteligente-de-destinos/index.html "Casos de Uso de la Plataforma Inteligente de Destinos"
[3]: https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_CIM009v010801p.pdf "ETSI GS CIM 009 NGSI-LD API"
