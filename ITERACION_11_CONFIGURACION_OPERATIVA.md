# Informe Técnico — Iteración 11: Configuración Operativa de Conectores, Datasets y Paquetes de Modelos

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Fecha:** 9 de octubre de 2026  
**Entorno:** Ubuntu 24.04 LTS · PostgreSQL 16 + PostGIS 3.4 · Node.js 22 · Express 5 · React 18 · Vite · CesiumJS  
**Estado:** Implementado, Validado y Persistido con RLS Estricta  

---

## 1. Resumen Ejecutivo

La **Iteración 11** transforma el Gemelo Digital Turístico de una prueba de concepto con catálogo estático en una **plataforma operativa, auditable y gobernable sin código**, donde los destinos pueden:

1. **Configurar nuevos conectores operativos** (REST, MQTT, S2, C4, OGC API, CSV, GeoJSON, JSON y Shapefile en ZIP) con metadatos de gobernanza, calidad mínima exigida y sin exponer secretos.
2. **Ingestar datasets propios** (incluyendo Shapefiles comprimidos con inspección de geometrías y CRS), calculando su huella SHA-256 y persistiendo metadatos y registros en PostGIS.
3. **Cargar e importar paquetes seguros de modelos de simulación (`SimulationModelPackage v1`)** en formato JSON o YAML declarativo, validándolos contra un esquema canónico AJV 2020-12 sin ejecución de código arbitrario.
4. **Vincular explícitamente datos y variables (`Dato → Conector → Variable → Modelo`)**, garantizando que el motor de simulación bloquee la ejecución si faltan fuentes obligatorias o no cumplen con la calidad mínima.
5. **Registrar decisiones humanas inmutables (Append-Only)** para validar, promover o publicar modelos reutilizables hacia otros destinos de la PID.

---

## 2. Componentes Técnicos Implementados

### 2.1 Esquema Canónico `SimulationModelPackage v1`
- **Ubicación:** `/home/ubuntu/gemelotur/schemas/simulation-model-package-v1.schema.json`
- **Estándar:** Draft 2020-12 con `additionalProperties: false`.
- **Estructura obligatoria:** `schemaVersion`, `id`, `version`, `name`, `domain`, `summary`, `creatorDestinationId`, `creatorDestinationName`, `lifecycleState`, `requiredLanes`, `pidModulesRequired`, `variables`, `sourceRequirements`, `declarativeRules`, `outputIndicators`, `privacyPolicy` y `evidence`.

### 2.2 Migración SQL 013 (`013_configuracion_operativa_datos_modelos.sql`)
- **`conectores_operativos`:** Tabla con RLS forzado (`tenant_id`, `destino_id`). Guarda configuraciones, mapeos de campos y evidencia. `secret_reference` almacena punteros opacos (ej. `secret://vault/...`), nunca claves reales.
- **`datasets_ingestados`:** Almacenamiento con RLS de metadatos, formato, CRS, tipo geométrico, huella SHA-256 y muestra de registros.
- **`paquetes_modelos_simulacion`:** Catálogo de modelos con aislamiento multitenant. Permite visibilidad global únicamente a aquellos en estado `PUBLICADO_REUTILIZABLE` o al tenant supervisor de SEGITTUR.
- **`vinculos_datos_modelos`:** Mapeo formal entre variables de modelo y campos de conectores, con reglas de transformación y calidad.
- **`decisiones_modelos_audit`:** Auditoría append-only con trigger `trg_decisiones_modelos_immutable` que revoca y prohíbe `UPDATE` y `DELETE`.

### 2.3 Servicios Backend
- `SimulationModelPackageService`: Parser y validador de archivos YAML/JSON con `yaml` y `ajv/dist/2020.js`. Normaliza reglas declarativas y calcula huellas SHA-256.
- `ConnectorConfigurationService`: Validador de esquemas de conectores. Si el conector es REST o MQTT y carece de verificación previa en producción, se asigna automáticamente el estado `PENDIENTE_CREDENCIALES`.
- `DataBindingService`: Administra el mapa de vínculos y evalúa la preparación (`evaluateModelReadiness`). Detecta carencias bloqueantes (`MISSING_MANDATORY_VARIABLE`, `CONNECTOR_UNAUTHORIZED`, `QUALITY_BELOW_MINIMUM`).
- `DataIngestionService`: Soporte para ZIP conteniendo `.shp` + `.dbf` + `.prj` + `.shx`, extrayendo encabezados binarios sin ejecutar binarios externos.
- `PostGISRepository`: Métodos transaccionales RLS para persistir y consultar entidades en el contexto seguro del operador autenticado.

### 2.4 Endpoints API Incorporados en `server.ts`
- `GET /api/connectors` y `POST /api/connectors`: Consulta y alta no-code de conectores.
- `POST /api/ingestion/datasets/file`: Ingesta multipart/base64 de archivos CSV, GeoJSON, JSON y SHP/ZIP.
- `GET /api/ingestion/datasets`: Consulta de datasets con trazabilidad SHA-256.
- `POST /api/models/packages/validate`: Validación previa de sintaxis y esquema YAML/JSON.
- `POST /api/models/packages/import`: Alta de paquete en estado `BORRADOR` con RLS.
- `POST /api/models/packages/:id/decision`: Registro inmutable de decisión humana (`APROBAR_VALIDADO`, `PUBLICAR_REUTILIZABLE`, `ARCHIVAR`).
- `GET /api/bindings` y `POST /api/bindings`: Consulta y configuración de vínculos campo → variable.
- `GET /api/models/:modelId/readiness`: Diagnóstico en tiempo real de viabilidad de simulación.

### 2.5 Interfaces de Usuario Actualizadas
- **`ConnectorConfigurationModal.tsx`:** Asistente visual paso a paso para dar de alta conectores con gobernanza, carril PID, política de privacidad y mapeo de campos.
- **`DataBindingModal.tsx`:** Visor de la cadena de evidencia que ilustra el estado de conexión del modelo y permite vincular variables con conectores.
- **`DataIngestionModal.tsx`:** Modal de carga de datos propios adaptado para admitir Shapefiles en ZIP y archivos tabulares con cálculo de CRS.
- **`SimulationDesignerModal.tsx`:** Pestaña para subir paquetes YAML/JSON con pre-validación de esquema y confirmación de persistencia.
- **`InteroperabilityModal.tsx`:** Integración del botón destacado «+ Nuevo conector» en la pestaña de conectores.

---

## 3. Matriz de Pruebas Automatizadas

La suite `scripts/validate_iteration11_operational_configuration.sh` ejecutó 9 pruebas completas en el sandbox:

| Test | Caso de Prueba | Resultado | Evidencia |
| :--- | :--- | :---: | :--- |
| **TEST 1** | Autenticación institucional JWT Málaga y Palma | **OK** | Emisión de tokens con claims de tenant y destino verificados. |
| **TEST 2** | Creación no-code de conector REST | **OK** | Estado `PENDIENTE_CREDENCIALES` asignado automáticamente. |
| **TEST 3** | Aislamiento RLS en conectores | **OK** | Palma no tiene visibilidad sobre conectores configurados por Málaga. |
| **TEST 4** | Ingesta de dataset CSV propio | **OK** | 2 registros procesados, huella SHA-256 generada y persistida. |
| **TEST 5** | Ingesta de Shapefile en ZIP | **OK** | Detección de CRS ETRS89 y geometría `Polygon`. |
| **TEST 6** | Importación de paquete YAML de modelo | **OK** | Esquema validado, guardado en PostGIS en estado `BORRADOR`. |
| **TEST 7** | Decisión humana de validación | **OK** | Decisión `APROBAR_VALIDADO` registrada inmutablemente en PostGIS. |
| **TEST 8** | Bloqueo por requisitos incompletos | **OK** | Detección de variables no vinculadas para simulación. |
| **TEST 9** | Creación de vínculo dato → variable | **OK** | Vínculo persistido en `vinculos_datos_modelos` bajo RLS. |

---

## 4. Conclusión

Con la Iteración 11, el Gemelo Digital Turístico PID/SEGITTUR dispone de una arquitectura robusta donde los destinos no dependen de programadores para configurar sus fuentes de datos ni para adoptar modelos de otros destinos. Toda la operación se realiza respetando la privacidad, con evidencia trazable y aislamiento estricto en PostGIS.
