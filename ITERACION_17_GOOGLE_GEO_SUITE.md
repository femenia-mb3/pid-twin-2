# Informe Técnico — Iteración 17: Integración Gobernada de Google Geo Suite para Enriquecimiento 3D y Territorial
**Plataforma Inteligente de Destinos (PID / SEGITTUR)**  
**Fecha:** 9 de octubre de 2026  
**Entorno:** PostgreSQL 16 + PostGIS 3.4 / Node.js 22 / Express 5 / React 18 + Vite / CesiumJS  
**Estado:** Validación Completada (8/8 Pruebas Superadas)

---

## 1. Resumen Ejecutivo

La **Iteración 17** implementa con éxito la integración de la nueva **suite geoespacial de Google** (Google Maps Platform) en el Gemelo Digital Turístico, estableciendo un **modelo de gobernanza institucional pionero** que conjuga fotorrealismo de última generación con la soberanía estricta de los datos de la Plataforma Inteligente de Destinos (SEGITTUR).

El diseño garantiza:
1. **Soberanía del Módulo Común PID**: Ni la ontología turística, ni el almacenamiento territorial en PostGIS, ni los motores de predicción/simulación ni los conectores IoT/S2 dependen de Google. El gemelo opera de forma autónoma con cartografía abierta del IGN (PNOA LiDAR y Catastro).
2. **Capa Opcional y Complementaria**: Google actúa exclusivamente bajo demanda para fotorrealismo 3D (Photorealistic 3D Tiles) y contextualización externa.
3. **Prevalidación Institucional Previa**: Prohibido el encendido del servicio sin una prevalidación firmada por un operador cualificado con justificación de interés público, zona delimitada y aceptación de compromisos normativos.
4. **Sobres de Evidencia Criptográfica**: Toda consulta genera un sobre de evidencia (`GoogleGeoEvidenceEnvelope`) con huella SHA-256 inmutable, identificación del supervisor humano y atribución de fuentes.
5. **No Persistencia de Mallas 3D**: Estricto cumplimiento de las políticas de Google Maps Platform: no se almacenan ni indexan geometrías 3D en servidores locales ni bases de datos de la PID.
6. **Fallback Automático Garantizado**: En caso de indisponibilidad o revocación del conector, el sistema conmuta instantáneamente al visor PID Open Data sin interrupción operativa.

---

## 2. Componentes Implementados

### 2.1. Contratos de Datos (`src/types/googleGeoSuite.ts`)
- `GoogleGeoModuleId`: Identificadores de módulos (`photorealistic_3d_tiles`, `google_3d_maps`, `routes_api`, `places_api`, `maps_grounding`).
- `GoogleGeoConnectorStatus`: Ciclo de vida (`DESHABILITADO`, `EN_PREVALIDACION`, `APROBADO_PILOTO`, `ACTIVO_VERIFICADO`, `SIN_CREDENCIALES`, `REVOCADO`).
- `GoogleGeoEvidenceEnvelope`: Estructura sellada con huella SHA-256, trazabilidad, finalidad y atribución visible.
- `GoogleGeoPrevalidationRecord`: Dictamen formal de operador institucional con vigencia de 90 días para pruebas piloto.
- `GoogleGeoAuditQueryRecord`: Registro de auditoría append-only para cada invocación o conmutación.

### 2.2. Esquema PostGIS con Aislamiento RLS e Inmutabilidad (`database/migrations/022_google_geo_suite_gobernanza.sql`)
- `google_geo_conectores`: Configuración por destino con RLS forzado (`tenant_id`, `destino_id`).
- `google_geo_prevalidaciones`: Registro formal de autorizaciones piloto con RLS forzado.
- `google_geo_auditoria_consultas`: Tabla append-only con trigger inmutable `trg_google_geo_auditoria_immutable` que prohíbe `UPDATE` y `DELETE`.
- Concesión de permisos de mínimo privilegio para el rol no-superusuario `gemelotur_app`.

### 2.3. Lógica de Servicio y Persistencia Transaccional
- `src/services/googleGeoSuitePostgisExtension.ts`: Consultas y mutaciones encapsuladas en `postgisClient.withTenantContext` asegurando aislamiento multitenant.
- `src/services/googleGeoSuiteService.ts`: Catálogo de 5 módulos, construcción de evidencias SHA-256, gestión del ciclo de prevalidación y conmutación con fallback a PID Open Data.

### 2.4. Endpoints de API REST (`server.ts`)
- `GET /api/google-geo/status`: Consulta el estado del conector y prevalidación vigente del destino.
- `GET /api/google-geo/modules`: Devuelve el catálogo de capacidades y las directrices de no persistencia.
- `POST /api/google-geo/prevalidate`: Formalización y firma de prevalidación por operador institucional con claims JWT.
- `POST /api/google-geo/toggle`: Conmutación entre PID Open Data y Google Photorealistic 3D con sobre de evidencia.
- `GET /api/google-geo/audit`: Histórico inmutable de consultas y evidencias del destino.

### 2.5. Interfaz de Usuario Ergonómica
- `src/components/GoogleGeoSuiteModal.tsx`:
  - Pestaña 1: Gobernanza, estado del conector, prevalidación vigente y conmutador visual con fallback.
  - Pestaña 2: Catálogo de capacidades preparadas con roles y reglas de no persistencia.
  - Pestaña 3: Formulario institucional de prevalidación con firma y aceptación de compromisos normativos.
  - Pestaña 4: Registro de auditoría inmutable en tiempo real con huellas criptográficas SHA-256.
- `src/components/Real3DTilesViewer.tsx`: Selector de procedencia de capa visual (PID Open Data vs Google Photorealistic 3D) en la tarjeta de controles.
- `src/App.tsx`: Acceso directo desde la cabecera institucional en el menú desplegable **Datos & PID**.

---

## 3. Resultados de la Validación Automatizada (8/8 Superadas)

El script reproducible `scripts/validate_iteration17_google_geo_suite.sh` superó todas las pruebas en el entorno activo:

| Prueba | Caso Evaluado | Resultado |
| :--- | :--- | :--- |
| **TEST 1** | Autenticación institucional JWT para operadores de Málaga y Palma | **SUPERADO** (Tokens válidos y claims verificados) |
| **TEST 2** | Consulta de estado inicial del conector (nace DESHABILITADO con PID Open Data) | **SUPERADO** (Estado `DESHABILITADO`, proveedor `PID_OPEN_DATA`) |
| **TEST 3** | Formalización de prevalidación institucional en PostGIS con firma | **SUPERADO** (`prev_gg_*`, estado `APROBADO_PILOTO`, SHA-256 de 64 caracteres) |
| **TEST 4** | Activación de Google Photorealistic 3D con sobre de evidencia criptográfica | **SUPERADO** (Proveedor `GOOGLE_PHOTOREALISTIC_3D`, evidencia SHA-256 verificada) |
| **TEST 5** | Aislamiento multitenant estricto (Operador de Palma intentando alterar Málaga) | **SUPERADO** (HTTP 403 Forbidden para operador cruzado) |
| **TEST 6** | Desactivación / revocación inmediata y retorno a PID Open Data (Fallback) | **SUPERADO** (Retorno confirmado a `PID_OPEN_DATA`) |
| **TEST 7** | Catálogo de módulos preparados y reglas de no persistencia | **SUPERADO** (5 módulos catalogados, soberanía `PID_SEGITTUR_SOVEREIGN`) |
| **TEST 8** | Verificación de auditoría inmutable en PostGIS y trigger append-only | **SUPERADO** (3 registros auditados sellados; Trigger aborta cualquier alteración directa) |

---

## 4. Conclusión

La **Iteración 17** demuestra cómo una plataforma pública y soberana puede beneficiarse de las capacidades más avanzadas de la tecnología fotorrealista comercial (Google Maps Platform) sin perder un ápice de control institucional, sin almacenar indebidamente datos ajenos y con plena transparencia frente a los gestores de los destinos turísticos españoles.
