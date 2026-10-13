# Iteración 13 — Ontologías PID desde S2, Conectores IoT Semánticos y Linaje de Datos

## 1. Resumen Ejecutivo y Alineación con el Pliego PID / SEGITTUR

La **Iteración 13** dota al Gemelo Digital Turístico de la capacidad de ingesta, normalización y gobernanza de datos procedente de los dos carriles troncales del ecosistema de la **Plataforma Inteligente de Destinos (PID)**:
1. **Carril Ontológico S2**: Datos estructurados conformes a la **Red de Ontologías del Sector Turístico de España (SEGITTUR)** bajo el estándar **ETSI GS CIM 009 NGSI-LD v1.8.1**, con enlace obligatorio a `@context` oficial, mapeo de propiedades y validación semántica.
2. **Carril IoT y Telemetría en Tiempo Real**: Protocolo **MQTTS 5 con cifrado TLS**, namespace jerárquico por tenant y destino (`pid/{tenantId}/{destinationId}/...`), inventario de lista blanca de dispositivos autorizados (`TourismSensor`) y reglas de idempotencia y obsolescencia temporal.
3. **Trazabilidad y Linaje Inmutable de Datos**: Todo dato persistido en PostgreSQL/PostGIS cuenta con huella criptográfica **SHA-256**, procedencia declarada, licencia de uso y grafo de linaje navegable que enlaza: Conector Fuente → Lote de Ingesta → Observación Contextual → Vínculo de Modelo de Simulación.
4. **Gobernanza y Supervisión Humana en el Circuito (Human-in-the-Loop)**: Ningún conector externo puede operar de forma autónoma en la red sin una fase de **Preflight de seguridad** y una **Decisión Humana Auditada** registrada en la tabla inmutable `decisiones_activacion_fuentes_audit`.

---

## 2. Arquitectura de Datos y Migración SQL 015 en PostGIS

Se implementó y aplicó la migración `database/migrations/015_semantica_s2_iot.sql` bajo las estrictas directrices de seguridad PostgreSQL 16 / PostGIS 3.4 con rol de aplicación no-superusuario `gemelotur_app` y políticas `FORCE ROW LEVEL SECURITY`:

| Tabla | Propósito y Contenido | Seguridad & RLS |
| :--- | :--- | :--- |
| `registros_ontologia_pid` | Registro maestro de ontologías oficiales aprobadas por SEGITTUR con IRI, versión, procedencia, licencia y huella SHA-256. | Catálogo global de lectura para todos los tenants autenticados. |
| `conectores_semanticos_s2` | Perfiles de conexión a la API S2 / NGSI-LD con tipos permitidos, mapeos, política de calidad y estado de activación (`BORRADOR`, `VALIDADO`, `ACTIVO`, `SUSPENDIDO`). | RLS por `tenant_id` y `destino_id`. |
| `conectores_iot_broker` | Perfiles de conexión a brokers MQTT con host, puerto seguro TLS, namespace jerárquico, QoS y límites de tasa. | RLS por `tenant_id` y `destino_id`. |
| `dispositivos_iot_registrados` | Lista blanca de sensores autorizados con URN NGSI-LD (`urn:ngsi-ld:TourismSensor:...`), concepto de medición, unidad UNECE y geometría espacial PostGIS (`ST_Point`). | RLS por `tenant_id` y `destino_id`. |
| `lotes_ingestion_semantica` | Registro de lotes de ingesta con totales recibidos, aceptados, rechazados y hash SHA-256 del lote. | RLS por `tenant_id` y `destino_id`. |
| `observaciones_contexto_iot` | Almacén geoespacial de observaciones normalizadas NGSI-LD con clave de idempotencia única, calidad y elegibilidad para el motor de simulación. | RLS por `tenant_id` y `destino_id`. |
| `errores_ingestion_semantica` | Registro de auditoría de telemetría rechazada (dispositivos no registrados, valores fuera de rango, timestamps obsoletos). | RLS por `tenant_id` y `destino_id`. |
| `decisiones_activacion_fuentes_audit` | Auditoría inmutable de decisiones humanas de activación o suspensión de fuentes con operador, rol y justificación. | RLS y append-only (sin UPDATE ni DELETE). |

---

## 3. Servicios Implementados en TypeScript

1. `src/services/pidOntologyRegistryService.ts`: Catálogo institucional de ontologías SEGITTUR con IRI canónico `https://ontologia.segittur.es/turismo/def/core#`, versión 1.0.0, licencia CC-BY-4.0 y huella SHA-256 verificable.
2. `src/services/s2SemanticConnectorService.ts`: Gestión del ciclo de vida de conectores S2, preflight de gobernanza, ingesta de lotes NGSI-LD, cálculo de huellas criptográficas y normalización semántica.
3. `src/services/iotTelemetryValidationService.ts`: Validación de brokers MQTT, registro de dispositivos con URN NGSI-LD, validación de coordenadas espaciales, idempotencia y límites temporales (rechazo de lecturas con más de 7 días o futuras).
4. `src/services/mqttCollectorService.ts`: Colector desacoplado y gobernado con métricas en tiempo real de procesamiento y rechazo.
5. `src/services/semanticDataLineageService.ts`: Constructor del grafo de linaje de datos de 4 niveles para auditar la cadena de custodia de cualquier observación territorial.
6. `src/services/semanticPostgisExtension.ts`: Extensión modular de repositorio PostGIS para desacoplar consultas semánticas y garantizar transaccionalidad aislada con `app.tenant_id` y `app.destino_id`.

---

## 4. Endpoints de la API REST Implementados

Todos los endpoints exigen autenticación institucional JWT y verificación de claims de operador mediante `scenarioScope` y `verifyOperatorClaims`:

- `GET /api/semantic/ontology-registry`: Consulta de ontologías oficiales SEGITTUR aprobadas.
- `GET /api/semantic/s2-connectors`: Lista de conectores semánticos S2 del destino activo.
- `POST /api/semantic/s2-connectors`: Creación de un nuevo conector S2 en estado `BORRADOR`.
- `POST /api/semantic/s2-connectors/:id/preflight`: Evaluación de seguridad que bloquea llamadas a red no autorizadas.
- `POST /api/semantic/s2-connectors/:id/decision`: Decisión humana auditada para validar, activar o suspender el conector.
- `POST /api/semantic/s2-connectors/:id/ingest-sample`: Ingesta controlada de muestras NGSI-LD.
- `GET /api/iot/connectors`: Lista de brokers MQTT del destino.
- `POST /api/iot/connectors`: Registro de broker MQTT con namespace jerárquico.
- `POST /api/iot/connectors/:id/decision`: Decisión humana auditada para activar o suspender el broker.
- `GET /api/iot/devices`: Inventario de dispositivos IoT registrados.
- `POST /api/iot/devices`: Registro de dispositivo en la lista blanca de sensores autorizados.
- `POST /api/iot/telemetry`: Ingesta de muestra de telemetría IoT contra el inventario autorizado.
- `GET /api/iot/ingestion-status`: Diagnóstico de salud y métricas del colector MQTT.
- `GET /api/iot/observations`: Consulta de observaciones contextuales normalizadas y georreferenciadas.
- `GET /api/semantic/lineage/:observationId`: Grafo completo de linaje y evidencia de una observación.

---

## 5. Interfaz Gráfica de Usuario (UI)

Se implementó el componente institucional `src/components/SemanticIotIntegrationModal.tsx`, accesible directamente desde la barra superior de la consola mediante el botón **Semántica S2 & IoT**:
- **Pestaña S2**: Visualización de conectores, estado de activación, botón de **Preflight**, y acciones humanas para **Validar / Activar / Suspender**. Formulario modal para alta de perfiles S2.
- **Pestaña IoT**: Supervisión de brokers MQTT, estado TLS, namespace y tabla de dispositivos registrados en lista blanca. Formularios modales para alta de broker y registro de sensor.
- **Pestaña Linaje**: Listado interactivo de observaciones persistidas en PostGIS y visualizador del grafo de linaje de 4 niveles (Conector fuente → Lote → Observación contextual → Vínculo de modelo de simulación).
- **Pestaña Ontología**: Catálogo de la ontología SEGITTUR con IRI, versión, procedencia institucional, licencia y enlace a la documentación oficial.

---

## 6. Resultados de la Suite de Validación Automatizada

La suite reproducible `scripts/validate_iteration13_semantic_s2_iot.sh` ejecutó 13 casos de prueba automatizados con respuestas reales del servidor:

| Caso de Prueba | Descripción | Resultado |
| :--- | :--- | :--- |
| **TEST 1** | Autenticación JWT de operador institucional de Málaga (`carlos.dominguez@malaga.es`) | **SUPERADO** (JWT emitido y claims validados) |
| **TEST 2** | Consulta al registro de ontologías PID aprobadas (SEGITTUR / S2) | **SUPERADO** (1 ontología verificada, IRI oficial) |
| **TEST 3** | Creación de perfil conector S2 en estado `BORRADOR` con evidencia de gobernanza | **SUPERADO** (Creado `s2_malaga_0b8195ea`) |
| **TEST 4** | Preflight de seguridad bloquea conector no validado (Regla de Oro) | **SUPERADO** (HTTP 422 `BLOQUEADO_SIN_AUTORIZACION`) |
| **TEST 5** | Decisión humana auditada para `ACTIVAR` el conector S2 en PostGIS | **SUPERADO** (Nuevo estado `ACTIVO`) |
| **TEST 6** | Ingesta de lote semántico S2 normalizado a NGSI-LD con huella SHA-256 | **SUPERADO** (Lote aceptado, observación `obs_s2_5d4619f99346`) |
| **TEST 7** | Registro de Broker IoT MQTT 5 con namespace jerárquico `pid/tenant_ayto_malaga/malaga/sensors/` | **SUPERADO** (Broker registrado `iot_malaga_8e61e6c6`) |
| **TEST 8** | Activación del Broker IoT mediante decisión humana auditada | **SUPERADO** (Estado `ACTIVO`) |
| **TEST 9** | Registro de sensor en inventario autorizado con URN NGSI-LD | **SUPERADO** (`urn:ngsi-ld:TourismSensor:malaga-calle-larios-01`) |
| **TEST 10** | Ingesta de telemetría IoT contra la lista blanca autorizada | **SUPERADO** (Normalizado a NGSI-LD y persistido en PostGIS) |
| **TEST 11** | Prueba negativa: Rechazo con HTTP 422 de telemetría para sensor NO registrado | **SUPERADO** (HTTP 422 y error registrado en auditoría) |
| **TEST 12** | Grafo de linaje de datos completo trazado desde el conector fuente | **SUPERADO** (3 nodos enlazados con huellas SHA-256) |
| **TEST 13** | Aislamiento Multitenant RLS: Operador de Palma recibe HTTP 404 al consultar datos de Málaga | **SUPERADO** (Cero fuga de información entre destinos) |
