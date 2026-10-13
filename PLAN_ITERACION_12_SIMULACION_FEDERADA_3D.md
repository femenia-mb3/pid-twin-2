# PLAN DE IMPLEMENTACIÓN — ITERACIÓN 12
## Simulación Multidestino Federada y Visualización 3D/4D Avanzada Open Source

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 12 de 12  
**Fecha:** 9 de octubre de 2026  
**Entorno de Ejecución:** Sandbox Ubuntu 24.04 LTS · PostgreSQL 16 + PostGIS 3.4 · Node.js 22 · Express 5 · React 18 · Vite · CesiumJS 1.145  

---

## 1. Principios no negociables y decisiones de diseño

1. **Uso exclusivo de tecnologías Open Source**:
   - Cartografía y capas: WMS/WMTS del IGN (Ortoimagen PNOA `https://www.ign.es/wms-inspire/pnoa-ma`, Cartografía Base Gris `https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg`).
   - 3D y LiDAR: CesiumJS libre, 3D Tiles 1.1 OGC autohospedados (`/tilesets/malaga-centro-2024/tileset.json`), modelos glTF/GLB locales, Catastro INSPIRE Building Parts (`/data/malaga/malaga-urbana-building-parts-lidar-color.geojson`).
   - Cero dependencias de Google Maps, Google Photorealistic 3D, Cesium ion tokenizado o APIs comerciales cerradas.
   - Respetar la identidad PID/SEGITTUR y el fondo claro/blanco del gemelo.
   - **Toda afirmación, resultado, indicador, recomendación o propuesta vinculada a evidencia comprobable (SHA-256, fuentes, operadores y fechas).**

2. **Simulación Multidestino Federada**:
   - Capacidad para que un destino coordinador (ej. Málaga) y destinos participantes (ej. Palma) configuren y ejecuten un modelo conjunto respetando la **soberanía del dato**:
     - No se copian ni mezclan datos crudos inter-tenant.
     - Evaluación previa y obligatoria de **compatibilidad semántica, territorial, de calidad y privacidad** (`COMPATIBLE`, `COMPATIBLE_CON_CONDICIONES`, `INCOMPLETO`, `NO_COMPATIBLE`).
     - Creación de configuración federada con snapshot de variables y conectores.
     - Ejecución federada: cálculo de BASE / ESCENARIO / DELTA para cada destino local y agregación comparativa homologada.
     - Bloqueo de ejecución si hay incompatibilidad o variables obligatorias desconectadas.
     - Registro inmutable de decisión humana de ejecución/compartición.

3. **Visor 3D/4D Avanzado con Degradación Segura**:
   - Consolidar los 4 niveles de visualización:
     - **Nivel 1 — 2D operativo:** Cartografía Leaflet, capas vectoriales GeoJSON/MVT, zonas de aforo, POIs y mapas de calor.
     - **Nivel 2 — 2.5D territorial:** Extrusiones de polígonos, elevación MDT50 y flujos.
     - **Nivel 3 — 3D realista abierto:** CesiumJS, ortofoto PNOA, nubes LiDAR 3D Tiles 1.1, edificios Catastro con colores de cubierta LiDAR, presets de cámara (cenital, oblicua, nivel calle) e iluminación solar astronómica.
     - **Nivel 4 — 4D temporal:** Timeline interactivo de evolución de flujos, demanda eléctrica/saturación horaria y rutas dinámicas.
   - **Catálogo de Activos 3D/4D:** Panel explícito que lista cada activo (PNOA WMS, Base Gris TMS, LiDAR 3D Tiles, Catastro INSPIRE, Tráfico Abierto, Villa Málaga LOD2), informando estado de carga, CRS, licencia abierta y huella SHA-256.
   - **Degradación segura:** Detección de incompatibilidad WebGL / pérdida de contexto con conmutación limpia a `Static3DContextViewer` sin pantalla blanca.

4. **Persistencia PostGIS con RLS Estricta y Auditoría Append-Only**:
   - Migración `014_simulacion_federada_3d_avanzado.sql`:
     - `configuraciones_federadas`: Modelos multidestino coordinados con RLS.
     - `participantes_federacion`: Destinos vinculados, scores de compatibilidad y estados.
     - `ejecuciones_federadas`: Resultados consolidados agregados y snapshots de evidencia.
     - `activos_3d_catalogo`: Registro de activos 3D/4D del destino, licencias y estados.
     - `decisiones_federadas_audit`: Tabla append-only protegida por trigger anti-tampering.

---

## 2. Plan de Trabajo Detallado

### Fase A: Tipos y Contratos TypeScript
- `src/types/federatedSimulation.ts`:
  - Contratos `FederatedModelConfig`, `FederationParticipant`, `FederatedCompatibilityReport`, `FederatedSimulationResult`, `FederatedExecutionAudit`.
- `src/types/advanced3D.ts`:
  - Contratos `Asset3DRecord`, `Asset3DManifest`, `Visual4DTimelineState`, `TemporalSimulationFrame`.

### Fase B: Migración SQL 014 en PostgreSQL / PostGIS
- `database/migrations/014_simulacion_federada_3d_avanzado.sql`:
  - Tablas `configuraciones_federadas`, `participantes_federacion`, `ejecuciones_federadas`, `activos_3d_catalogo`, `decisiones_federadas_audit`.
  - Habilitación y forzado de `ROW LEVEL SECURITY` para el rol no-superusuario `gemelotur_app`.
  - Trigger de inmutabilidad append-only `trg_decisiones_federadas_immutable`.

### Fase C: Servicios Backend
- `src/services/federatedSimulationService.ts`:
  - Evaluación profunda de compatibilidad entre destino coordinador y participantes.
  - Creación de configuración federada con snapshots.
  - Motor de simulación federada: invoca el motor para cada destino con sus datos locales, compila BASE / ESCENARIO / DELTA por destino y calcula métricas agregadas federadas.
- Extensión de `src/services/postgisRepository.ts`:
  - Métodos transaccionales con `withTenantContext` para persistir configuraciones, participantes, ejecuciones y auditoría federada.
- Extensión de `src/services/openDataService.ts` / `src/services/catalog3DService.ts`:
  - Exposición de catálogo unificado de activos 3D/4D abiertos con metadatos de licencia y estado operativo.

### Fase D: Endpoints API en `server.ts`
- `GET /api/federation/configs`: Listar configuraciones federadas del tenant/destino.
- `POST /api/federation/evaluate-compatibility`: Evaluar compatibilidad multidestino para un modelo.
- `POST /api/federation/configs`: Crear configuración de modelo federado.
- `POST /api/federation/configs/:id/execute`: Ejecutar simulación federada con comprobación estricta de readiness y autorización.
- `GET /api/federation/runs/:runId`: Obtener resultados agregados y desgloses por destino.
- `POST /api/federation/runs/:runId/decision`: Registrar decisión humana inmutable sobre los resultados federados.
- `GET /api/3d/catalog/assets`: Consultar catálogo unificado de activos 3D/4D con licencias y estado.

### Fase E: Componentes de Interfaz de Usuario
- `src/components/FederatedSimulationModal.tsx`:
  - Asistente de simulación multidestino: selección de modelo, coordinador, participantes, matriz visual de compatibilidad con motivos de rechazo/aprobación, visualización de resultados BASE/ESCENARIO/DELTA comparativos y panel de aprobación humana.
- `src/components/Assets3DCatalogModal.tsx`:
  - Panel de gestión de capas y activos 3D/4D con licencias CC-BY 4.0 / INSPIRE, resoluciones, estado de carga y controles de activación.
- Integración en `src/App.tsx`:
  - Botones destacados en la cabecera: **«Simulación Federada»** y **«Catálogo 3D/4D»**.
  - Sincronización del timeline 4D y controles Cesium.

### Fase F: Validación Automatizada y Verificación de Calidad
- `scripts/validate_iteration12_federated_simulation_3d.sh`:
  - 10 pruebas exhaustivas cubriendo:
    1. Autenticación institucional JWT con claims.
    2. Evaluación positiva de compatibilidad Málaga-Palma.
    3. Rechazo de federación por variable obligatoria o calidad insuficiente.
    4. Creación y persistencia de configuración federada bajo RLS.
    5. Aislamiento RLS entre tenants.
    6. Ejecución federada produciendo BASE / ESCENARIO / DELTA locales y agregados.
    7. Bloqueo de simulación sin aprobación humana explícita.
    8. Registro inmutable append-only de decisión humana en PostGIS.
    9. Catálogo de activos 3D/4D con metadatos de licencias abiertas y huellas SHA-256.
    10. Degradación segura ante ausencia de WebGL sin pantallas blancas.
- Ejecución de `pnpm lint`, `pnpm build`, suite de pruebas y revisión independiente de integración.
- Sincronización al repositorio canónico Git y registro de checkpoint.
