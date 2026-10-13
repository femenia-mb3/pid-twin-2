# Plan de implementación — Iteración 13
## Ontologías PID desde S2 y conectores IoT semánticos

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Fecha:** 9 de octubre de 2026  
**Estado:** Planificado; no inicia conexiones externas hasta recibir configuración y autorización del destino.

## Resultado buscado

La Iteración 13 convertirá la capacidad actualmente declarativa de **S2/NGSI-LD** y **MQTT** en una integración operativa, gobernada y auditable. Un destino podrá registrar una fuente semántica S2 y una fuente IoT, mapear sus campos a la ontología, validar la entrada y activar la ingestión únicamente después de una revisión humana.

No se conectará a servicios reales ni se inventarán URLs, credenciales, tópicos, dispositivos o payloads. En este momento no hay un conector S2, NGSI-LD o MQTT configurado para el proyecto, ni está instalada la dependencia MQTT. La capacidad se implementará como **plantilla activable y verificable**, no como una conexión fingida.

> Toda entidad normalizada, lectura de sensor, error de ingestión, indicador y resultado de simulación conservará evidencia comprobable: origen, huella SHA-256, momento de recepción, contrato y versión de mapeo, versión de ontología, calidad, autorización y decisión humana que habilitó la fuente.

## Base comprobada antes de construir

El Gemelo ya dispone de una base compatible sobre la que extenderse:

- El contexto JSON-LD local ya mapea `TouristDestination`, `TourismResource`, `TourismEvent`, `TourismSensor`, `DataSource`, `Property`, `Relationship`, `GeoProperty`, `observedAt`, calidad y trazabilidad.
- Las formas SHACL locales exigen destino, medición, instante de observación y procedencia para `TourismSensor`.
- La migración de ontología multidestino ya conserva entidades NGSI-LD normalizadas en `registro_entidades_contexto`, contratos de ingestión semántica y políticas RLS por `tenant_id` y `destino_id`.
- La configuración operativa ya reconoce `PID_SERVICE_S2` y `MQTT`, declara `secretReference` opaca —nunca secretos— y exige evidencia de cada conector.
- El endpoint actual `POST /api/ingestion/telemetria` solo reconoce un payload básico y devuelve una confirmación; no valida ontología, no deduplica, no persiste una lectura ni está enlazado a un broker. Será sustituido por el carril gobernado descrito aquí, manteniendo solo compatibilidad explícita si fuese necesaria.

La ontología publicada por SEGITTUR incluye, entre otros, las clases de destino turístico, entidad turística, evento y localización; su procedencia identifica a SEGITTUR como creadora. Esto respalda usar su IRI de núcleo como referencia, pero el perfil de cada conector debe fijar una versión concreta y verificable antes de activarse. [1] [2]

## Decisiones de arquitectura

### 1. Dos adaptadores independientes con una salida común

Se crearán dos adaptadores servidor a servidor:

- **Adaptador S2/NGSI-LD.** Consumirá una fuente semántica autorizada mediante REST y normalizará entidades NGSI-LD. Solo permitirá los tipos, `@context`, atributos y filtros que se hayan declarado en el contrato del destino.
- **Colector MQTT IoT.** Mantendrá una suscripción de larga duración a un broker autorizado, validará cada mensaje y lo traducirá a una entidad/observación NGSI-LD de `TourismSensor` u otro tipo permitido.

Ambos producirán el mismo objeto interno `NormalizedContextObservation`. Antes de almacenar o exponer cualquier observación se aplicarán: validación de esquema, mapeo versionado, validación semántica, comprobación de alcance tenant/destino, calidad, autorización, deduplicación y evidencia.

NGSI-LD define una representación para propiedades geoespaciales, temporales y multitenant; por tanto, `observedAt`, geometría y el alcance del destino se tratarán como datos de primera clase, no como texto libre. [3]

### 2. S2 se integrará por contrato, no por suposición

No se presupone una URL, autenticación ni forma de respuesta concreta de S2. La configuración mínima de cada fuente S2 será:

```ts
interface S2SemanticSourceProfile {
  id: string;
  tenantId: string;
  destinationId: string;
  baseUrl: string;                 // solo tras validación humana
  authReference: string;           // referencia a secreto, nunca el valor
  apiVersion: string;
  contextUrl: string;
  contextFingerprintSha256: string;
  allowedEntityTypes: string[];
  allowedQueryTemplates: string[]; // paginación, filtros y límites autorizados
  fieldMappings: ConnectorFieldMapping[];
  qualityPolicy: QualityPolicy;
  activationState: 'BORRADOR' | 'VALIDADO' | 'ACTIVO' | 'SUSPENDIDO';
  evidence: ConnectorEvidence;
}
```

El adaptador aceptará entidades NGSI-LD normalizadas o compactas solo si incluyen un `@context` permitido. Guardará el payload original en cuarentena lógica con su huella, generará la entidad normalizada y preservará ambos vínculos. No permitirá consultas arbitrarias construidas desde el navegador ni expandirá IRIs remotas no aprobadas.

### 3. MQTT se ejecutará como servicio colector persistente

Un broker publica eventos; por eso una suscripción MQTT no debe vivir en una petición HTTP de Express ni depender del proceso de Preview. El frontend y la API seguirán en el contenedor actual; el colector se desplegará como servicio Node independiente en infraestructura persistente, con la misma base PostGIS y una cuenta de aplicación de privilegio mínimo.

El contrato MQTT por conector definirá `brokerUrl`, puerto, TLS obligatorio, método de autenticación, referencias a CA/certificado si aplica, `clientId` gestionado, lista blanca de tópicos, QoS, límite de tamaño, límite de tasa, retención, payload y mapeos. MQTT 5 define QoS 0, 1 y 2 como «como máximo una vez», «al menos una vez» y «exactamente una vez» respectivamente; el diseño usará QoS 1 como valor inicial para telemetría y deduplicación propia, salvo que el destino justifique otro valor. [4]

Contrato inicial de tópico, únicamente como convención interna configurable:

```text
pid/{tenantId}/{destinationId}/sensors/{sensorId}/telemetry
```

Contrato inicial de mensaje:

```json
{
  "sensorId": "urn:ngsi-ld:pid:malaga:TourismSensor:aforo-calle-larios-01",
  "measurement": "visitorCount",
  "value": 184,
  "unitCode": "P1",
  "observedAt": "2026-10-09T08:30:00.000Z",
  "sequence": 10482,
  "location": { "type": "Point", "coordinates": [-4.4214, 36.7205] },
  "sourceTraceabilityId": "device-aforo-larios-01"
}
```

El JSON anterior es una **plantilla de prueba**, no un payload atribuido a S2 ni a un ayuntamiento. El contrato final se versionará por dispositivo o familia de sensores antes de conectar el broker.

### 4. Seguridad, gobierno y privacidad

- Credenciales, claves, certificados, tokens y contraseñas solo residirán en secretos del entorno de despliegue o en un conector autorizado. La interfaz mostrará exclusivamente `secretReference`, estado y fecha de comprobación.
- MQTT exigirá `mqtts://` o WebSocket seguro, validación del certificado del servidor, lista blanca de tópicos y de identificadores de dispositivo, tamaño máximo de mensaje, límite de tasa y reconexión exponencial.
- Las lecturas duplicadas se detectarán por una clave idempotente formada por conector, sensor, instante de observación, secuencia si existe y huella del payload. Las lecturas tardías, corruptas o fuera de rango no modificarán el estado operativo sin quedar registradas.
- No se habilitará control de actuadores ni tráfico southbound en esta iteración. El patrón FIWARE confirma que un IoT Agent traduce protocolos nativos hacia NGSI-LD y que los comandos sobre dispositivos son un carril distinto; aquí solo se incorpora el carril de mediciones northbound. [5]
- La activación de una fuente seguirá el flujo `BORRADOR → VALIDADO → ACTIVO` con una decisión humana append-only. Suspender una fuente detendrá nuevas ingestas, sin borrar evidencias históricas.
- Todas las tablas nuevas impondrán `FORCE ROW LEVEL SECURITY`. El colector establecerá `app.tenant_id` y `app.destino_id` dentro de cada transacción; nunca aceptará esos campos sin contrastarlos contra la configuración del conector.

## Cambios planificados

### Persistencia PostGIS: migración 015

Se añadirá `database/migrations/015_semantica_s2_iot.sql` con estas entidades, sus índices y sus políticas RLS:

- `registros_ontologia_pid`: IRI, versión, huella, licencia, procedencia, fecha de revisión y estado de aprobación.
- `conectores_semanticos_s2`: perfil de fuente, lista de entidades y contextos autorizados, política de calidad, referencia de secreto y estado de activación.
- `dispositivos_iot`: registro de dispositivos/sensores, conector, tipo de medida, unidad, zona, estado y evidencia de alta.
- `observaciones_iot`: lectura inmutable, payload original/normalizado, instante, geometría, clave idempotente, huella, calidad y resultado de validación.
- `lotes_ingestion_semantica`: trazabilidad de cada extracción S2 o ventana MQTT, contador aceptado/rechazado y manifiesto de evidencias.
- `errores_ingestion_semantica`: cuarentena de mensajes o entidades rechazadas, causa, huella y referencia a lote; sin reintentos silenciosos.
- `decisiones_activacion_fuentes_audit`: decisión humana inmutable para validar, activar, suspender o revocar fuentes.

Las observaciones serán consultables en PostGIS por geometría, entidad, sensor y `observed_at`. La estrategia de particionado temporal se activará cuando se disponga del volumen de mensajes real; no se impondrá una hipótesis de carga ficticia.

### Tipos y servicios del backend

Se incorporarán los siguientes módulos:

- `src/types/semanticIngestion.ts`: contratos de fuentes S2, registro de ontologías, entidades normalizadas, lotes, errores y evidencias.
- `src/types/iotTelemetry.ts`: perfil de broker, dispositivo, esquema de payload, observación, resultado de deduplicación y estado del colector.
- `src/services/pidOntologyRegistryService.ts`: registra y fija contexto/ontología aprobados mediante versión y SHA-256.
- `src/services/s2SemanticConnectorService.ts`: preflight, paginación controlada, validación NGSI-LD y normalización de S2.
- `src/services/iotTelemetryValidationService.ts`: aplica tamaño, estructura, unidades, timestamps, deduplicación, rango y mapeo ontológico.
- `src/services/mqttCollectorService.ts`: servicio persistente que conecta exclusivamente a perfiles activos y autorizados; no será importado por el navegador.
- Extensión de `src/services/postgisRepository.ts`: operaciones transaccionales RLS para perfiles, dispositivos, lotes, observaciones, cuarentena y auditoría.

Se evaluarán e incorporarán las dependencias necesarias en el checkpoint de implementación: cliente MQTT 5 para Node, procesador JSON-LD y validador SHACL/RDF. Ninguna dependencia se añadirá en el navegador; las dependencias semánticas y MQTT se ejecutarán solo en servidor.

### API autenticada

Los endpoints nuevos exigirán JWT institucional, claims del destino y `Cache-Control: private, no-store`:

- `GET /api/semantic/ontology-registry?destino=…`
- `POST /api/semantic/s2-connectors`
- `POST /api/semantic/s2-connectors/:id/preflight`
- `POST /api/semantic/s2-connectors/:id/decision`
- `GET /api/semantic/entities?destino=…&type=…&source=…`
- `GET /api/iot/connectors?destino=…`
- `POST /api/iot/connectors`
- `POST /api/iot/devices`
- `POST /api/iot/connectors/:id/decision`
- `GET /api/iot/observations?destino=…&sensorId=…&from=…&to=…`
- `GET /api/iot/ingestion-status?destino=…`

Las operaciones de *preflight* y activación no iniciarán conexiones mientras no exista referencia de secreto válida, ontología aprobada y decisión humana. Una solicitud de simulación solo podrá usar observaciones con estado válido y evidencia completa; las demás permanecerán visibles como excluidas, con su motivo.

### Interfaz de usuario

Se ampliará el área **Interoperabilidad** con una pestaña **Semántica e IoT** y sin alterar el diseño blanco/PID actual:

- Una tarjeta de fuente S2 mostrará tipos permitidos, contexto fijado, estado, cobertura, última sincronización, conteo aceptado/rechazado y enlace a evidencia.
- Una tarjeta MQTT mostrará dispositivos autorizados, tópico parcialmente oculto, estado del colector, latencia, QoS, frecuencia, calidad y lecturas descartadas; nunca mostrará credenciales.
- Un panel de **linaje del dato** permitirá seguir un dato desde conector → contrato → lote → entidad/observación → variable vinculada → modelo/simulación. Cada nodo expondrá su huella y fecha.
- Los formularios usarán mapeos explícitos de campos y un botón **«Validar configuración»**. El botón **«Solicitar activación»** crea una propuesta y requiere la decisión humana del responsable.
- El visor 2D/3D consumirá las observaciones ya normalizadas por API; nunca conectará directamente a MQTT ni a S2 desde el navegador.

La interacción seguirá la estética operativa clara: tarjetas blancas, estado semafórico accesible, avisos de fuente incompleta y una línea de evidencia visible junto a cada dato. No se añadirán animaciones ni visualizaciones decorativas que oculten el origen del indicador.

### Servicio persistente y despliegue

La aplicación actual seguirá siendo una SPA React con API Express y rutas privadas no cacheables. El colector MQTT se empaquetará como proceso separado, con healthcheck propio, registros estructurados y reinicio supervisado en una infraestructura persistente. Su despliegue será posterior a la entrega de acceso al broker; no se lanzará como proceso efímero dentro de la publicación Webdev.

La publicación web mantendrá `/api/*` en el servidor y los recursos del visor en estático. No se modificarán las rutas de páginas públicas ni se añadirá caché compartida a lecturas, telemetría, auditoría o resultados de simulación.

## Datos que debe facilitar el destino antes de activar una fuente

Para **S2**, se necesita el endpoint base, documentación o especificación de API, mecanismo de autenticación, tenant/ruta de destino, versión de NGSI-LD, URL de `@context`, tipos de entidad disponibles, payload de muestra anonimizado, límites de consulta y la finalidad/retención autorizadas.

Para **MQTT**, se necesita host y puerto, TLS/CA o esquema mTLS, mecanismo de autenticación, namespace de tópicos, QoS, política de retención, formato y unidades de los payloads, registro de dispositivos, volumen y frecuencia esperados, tratamiento de mensajes tardíos y responsable operativo.

Las claves, tokens y certificados no se enviarán por chat ni se versionarán. Cuando estén disponibles, se recogerán mediante el flujo seguro de secretos/configuración del despliegue.

## Límites explícitos de esta iteración

- No se atribuirán datos sintéticos a S2, a SEGITTUR ni a un destino.
- No se activará una fuente externa sin configuración del propietario y revisión humana.
- No se ejecutarán modelos ni recomendaciones sobre lecturas rechazadas, no autorizadas o carentes de evidencia.
- No se habilitará control de actuadores, escritura sobre sistemas fuente ni comandos MQTT hacia dispositivos.
- No se sustituirán las ontologías ni los contratos oficiales que proporcione SEGITTUR; los perfiles locales se versionarán para poder alinearse con ellos sin romper históricos.

## Evidencia y referencias

La URL institucional de SEGITTUR localizada inicialmente para la red de ontologías devuelve actualmente 404, por lo que no se tomará como contrato operativo. El plan se apoya en la documentación de ontología publicada y en los estándares técnicos siguientes:

[1]: https://ontologia.segittur.es/turismo/def/core/ "Ontología de turismo de SEGITTUR: clases y propiedades del modelo de referencia"
[2]: https://ontologia.segittur.es/turismo/def/core/provenance/provenance-en.html "Provenance for the reference conceptual model for tourism by SEGITTUR"
[3]: https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_CIM009v010801p.pdf "ETSI GS CIM 009 V1.8.1: NGSI-LD API"
[4]: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html "MQTT Version 5.0 OASIS Standard"
[5]: https://www.postman.com/fiware/fiware-foundation-ev-s-public-workspace/collection/yttnhff/ngsi-ld-iot-agent "FIWARE NGSI-LD IoT Agent: native device protocols translated to NGSI-LD"
