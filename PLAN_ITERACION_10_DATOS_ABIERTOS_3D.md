# PLAN DE IMPLEMENTACIÓN — ITERACIÓN 10
## Capas de Datos Abiertos Verificables (IGN/PNOA/Catastro) y Motor de Visualización 3D Realista Open Source

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 10 de 10  
**Objetivo Principal:** Culminar el MVP industrial del gemelo turístico integrando un catálogo explícito de capas de datos abiertos interoperables (ortoimágenes aéreas PNOA, modelo digital de elevaciones MDT, edificios INSPIRE de Catastro y tráfico/movilidad abierta) y reforzando el motor de visualización 3D en Cesium/WebGL con controles realistas (iluminación solar horaria, sombras, niebla atmosférica, selector de mapa base satelital/topográfico PNOA y presets de cámara de inspección), manteniendo una política estricta de componentes y servicios 100% open source e interoperables.

---

## 1. Alcance y Decisiones Arquitectónicas

1. **Cumplimiento estricto de tecnologías Open Source**:
   - En lugar de recurrir a APIs propietarias con claves cerradas (como Google Photorealistic 3D o TomTom privativo), la arquitectura se asienta sobre estándares OGC abiertos:
     - **Ortoimágenes PNOA IGN**: Servicio oficial WMS/WMTS del Plan Nacional de Ortofotografía Aérea (`https://www.ign.es/wms-inspire/pnoa-ma`, licencia CC-BY 4.0).
     - **Cartografía Topográfica y Base Gris IGN**: TMS oficial (`https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg`).
     - **Edificación 3D y Catastro**: Datos abiertos INSPIRE Building (D.G. del Catastro) ya pre-procesados en GeoJSON/3D Tiles.
     - **Nube de puntos LiDAR PNOA**: 3D Tiles 1.1 OGC abiertos con compresión `meshopt`.
     - **Flujos de movilidad y tráfico abierto**: Capa de aforos de tráfico municipal y corredores de transporte abiertos integrados mediante GeoJSON y OGC API.

2. **Mejoras del Motor 3D Realista en `Real3DTilesViewer.tsx`**:
   - **Iluminación solar dinámica**: Activación de iluminación solar astronómica en Cesium (`scene.globe.enableLighting = true`) sincronizada con el deslizador horario de la simulación.
   - **Niebla atmosférica y cielo realista**: `scene.fog.enabled = true`, `scene.skyAtmosphere.show = true` para dar profundidad escénica sin sobrecargar WebGL.
   - **Selector de mapa base cartográfico/satelital**:
     - *Ortofoto Aérea Real PNOA (IGN)*: Máxima resolución fotográfica del territorio.
     - *Mapa Base Gris IGN*: Máxima legibilidad analítica de polígonos de simulación.
   - **Presets de cámara de inspección turística**:
     - Vista General Aérea (Nadir / Cenital).
     - Perspectiva Oblicua Patrimonial (45°).
     - Vista Peatonal / Nivel de Calle (acercamiento a accesos y recursos).
   - **Capa de Tráfico y Aforos de Movilidad Urbana**:
     - Rutas con estado de flujo visual codificado por colores e intensidad de saturación en tiempo real.

3. **Nueva Pestaña / Panel en Interfaz: «Datos Abiertos»**:
   - Acceso desde la barra lateral o modal de capas para inspeccionar:
     - Estado de conexión con el repositorio nacional de datos abiertos.
     - Metadatos de procedencia, fecha de vuelo, resolución y licencia CC-BY 4.0.
     - Interruptores para activar/desactivar ortofoto PNOA, tráfico abierto y catastro en el visor 2D y 3D.

4. **Endpoints en Servidor (`server.ts` & `src/services/geoServices.ts`)**:
   - `GET /api/geo/open-data/catalog`: Catálogo normalizado de fuentes de datos abiertos conectadas.
   - `GET /api/geo/open-data/traffic?destino={id}`: Capa GeoJSON de intensidad de tráfico urbano abierta por tramos viarios.

5. **Validación Automatizada (`scripts/validate_iteration10_open_data_3d.sh`)**:
   - Suite reproducible de 8 casos comprobando disponibilidad de endpoints de datos abiertos, integridad de capas WMS/GeoJSON, metadatos de licencias abiertas y rendimiento de Cesium.

---

## 2. Plan de Trabajo Paso a Paso

- [ ] Paso 1: Crear tipos y modelos para el catálogo de datos abiertos (`src/types/openData.ts`).
- [ ] Paso 2: Implementar servicio de datos abiertos y tráfico municipal simulado (`src/services/openDataService.ts`).
- [ ] Paso 3: Exponer endpoints en `server.ts` con control de scope institucional y caché adecuada.
- [ ] Paso 4: Enriquecer `Real3DTilesViewer.tsx` con controles de realismo (iluminación solar, selector satelital PNOA vs mapa base, presets de cámara y capa de tráfico).
- [ ] Paso 5: Añadir modal/panel de visualización de capas abiertas en la interfaz React (`OpenDataLayersModal.tsx` y enlace en `App.tsx`).
- [ ] Paso 6: Crear script de validación `scripts/validate_iteration10_open_data_3d.sh`.
- [ ] Paso 7: Compilar con `pnpm lint && pnpm build`, reiniciar servicios y ejecutar validación automatizada.
- [ ] Paso 8: Sincronizar hacia el repositorio canónico y registrar commit de la Iteración 10.
