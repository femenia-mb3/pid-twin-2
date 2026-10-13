# Iteración 17 — Google Geo Suite Gobernado: Tareas y Compromisos

- [ ] **1. Contratos de Datos TypeScript (`src/types/googleGeoSuite.ts`)**
  - Definir tipos de módulos (`photorealistic_3d_tiles`, `google_3d_maps`, `routes_api`, `places_api`, `maps_grounding`).
  - Definir estados del conector (`DESHABILITADO`, `EN_PREVALIDACION`, `APROBADO_PILOTO`, `ACTIVO_VERIFICADO`, `SIN_CREDENCIALES`, `REVOCADO`).
  - Definir el sobre de evidencia obligatorio `GoogleGeoEvidenceEnvelope` con huellas SHA-256 y atribución de fuentes.
  - Definir el protocolo de prevalidación institucional `GoogleGeoPrevalidationRequest`.

- [ ] **2. Esquema PostGIS con RLS e Inmutabilidad (`database/migrations/022_google_geo_suite_gobernanza.sql`)**
  - Tabla `google_geo_conectores` con RLS forzado (`tenant_id`, `destino_id`).
  - Tabla `google_geo_prevalidaciones` para registrar dictámenes de gobernanza.
  - Tabla `google_geo_auditoria_consultas` append-only para trazabilidad estricta de llamadas y evidencias.
  - Triggers de inmutabilidad y funciones PL/pgSQL de comprobación de prevalidación.

- [ ] **3. Servicios de Lógica y Persistencia**
  - `src/services/googleGeoSuitePostgisExtension.ts`: Persistencia segura con `postgisClient.withTenantContext`.
  - `src/services/googleGeoSuiteService.ts`: Lógica de prevalidación, estado del conector, gestión de evidencias y proxy seguro.

- [ ] **4. Endpoints REST en `server.ts`**
  - `GET /api/google-geo/status`: Estado del conector por destino y disponibilidad de credenciales.
  - `POST /api/google-geo/prevalidate`: Prevalidación formal firmada por operador.
  - `POST /api/google-geo/toggle`: Activación/desactivación del visor fotorrealista.
  - `GET /api/google-geo/modules`: Catálogo de capacidades y módulos preparados.
  - `GET /api/google-geo/audit`: Registro inmutable de consultas y evidencias.
  - `GET /api/google-geo/tileset-proxy`: Proxy seguro para teselas Cesium 3D con atribución obligatoria.

- [ ] **5. Interfaz Gráfica y Visor**
  - `src/components/GoogleGeoSuiteModal.tsx`: Modal con pestañas de gobernanza, prevalidación, módulos, visor Cesium fotorrealista y auditoría.
  - `src/components/Real3DTilesViewer.tsx`: Selector de procedencia (PID PNOA/Catastro vs Google Fotorrealista 3D Tiles) con fallback garantizado.
  - `src/App.tsx`: Botón en la cabecera dentro del menú de Datos & PID y montaje del modal.

- [ ] **6. Suite de Validación Automatizada (`scripts/validate_iteration17_google_geo_suite.sh`)**
  - 8 casos de prueba rigurosos cubriendo login, estados, prevalidación, evidencia SHA-256, RLS 403, revocación y fallback.

- [ ] **7. Revisión Independiente y Documentación Técnica**
  - Ejecutar revisión independiente de código, generar informe `ITERACION_17_GOOGLE_GEO_SUITE.md`, sincronizar con el repositorio canónico y verificar compilación limpia.
