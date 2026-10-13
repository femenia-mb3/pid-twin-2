# INFORME TÉCNICO — ITERACIÓN 10
## Capas de Datos Abiertos Verificables (IGN/PNOA/Catastro) y Motor de Visualización 3D Realista Open Source

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 10 de 10  
**Fecha:** 8 de octubre de 2026  
**Estado:** Implementado, Validado y Verificado mediante Pruebas Automatizadas (8/8 superadas).

---

## 1. Resumen Ejecutivo de la Iteración 10

La **Iteración 10** culmina el desarrollo del MVP del Gemelo Digital Turístico dotando al sistema de:
1. **Un catálogo interoperable de capas de datos abiertos** fundamentado en servicios oficiales del Instituto Geográfico Nacional (IGN), el Centro Nacional de Información Geográfica (CNIG), la Dirección General del Catastro y redes municipales de tráfico.
2. **Un motor 3D realista basado exclusivamente en tecnologías y estándares abiertos** (CesiumJS, OGC WMS/WMTS, OGC 3D Tiles 1.1 y glTF/GLB con compresión `meshopt`), evitando dependencias propietarias o APIs cerradas.

---

## 2. Componentes y Capacidades Implementadas

### 2.1. Catálogo Oficial de Datos Abiertos (`src/services/openDataService.ts`)
Se integran 5 familias de datos abiertos con atribución, estándar OGC y licencia pública:
- **Ortoimágenes PNOA Máxima Actualidad (IGN)**: Servicio oficial WMS 1.3.0 (`https://www.ign.es/wms-inspire/pnoa-ma`, capa `OI.OrthoimageCoverage`, licencia CC-BY 4.0 scne.es).
- **Cartografía Base Gris Oficial (IGN)**: Servicio TMS (`https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg`) optimizado para legibilidad analítica y visualizaciones temáticas.
- **Nube de Puntos LiDAR PNOA 3D**: Teselado oficial OGC 3D Tiles 1.1 con 375 teselas jerárquicas GLB con color RGBI (densidad 6,2 puntos/m²).
- **Edificación Urbana INSPIRE (Catastro)**: 9.192 piezas reales de edificios con alturas calculadas por plantas y coloración combinada con LiDAR.
- **Red de Aforos y Tráfico Abierto**: Tramos viarios con nivel de congestión (`FLUIDO`, `MODERADO`, `DENSO`, `CONGESTIONADO`), velocidades medias e intensidades horarias para Málaga y Palma.

### 2.2. Mejoras de Realismo en el Visor 3D (`Real3DTilesViewer.tsx`)
- **Iluminación Solar y Sombras**: Activación de iluminación astronómica en tiempo real (`scene.globe.enableLighting = true`) sincronizada con el reloj de simulación.
- **Atmósfera y Niebla**: Efecto de niebla volumétrica y cielo atmosférico para proporcionar profundidad y realismo escénico.
- **Selector de Mapa Base Inmediato**: Conmutación en caliente entre Ortofoto Aérea Satelital PNOA y Base Gris IGN.
- **Capa 3D de Flujos de Tráfico**: Renderizado tridimensional de tramos de tráfico codificados por color e intensidad de aforo.
- **Presets de Cámara de Inspección Turística**:
  - *Cenital / Nadir*: Inspección territorial y de capacidad de carga desde arriba.
  - *Oblicua (45°)*: Perspectiva volumétrica para analizar cubiertas y patrimonio.
  - *Peatonal*: Nivel de calle para simular accesos y dispersión peatonal.

### 2.3. Modal del Repositorio de Datos Abiertos (`OpenDataLayersModal.tsx`)
- Acceso directo desde la cabecera mediante el botón **«Datos Abiertos IGN»**.
- Pestaña de fuentes OGC oficiales con fichas técnicas, resolución, frecuencia de actualización y licencias.
- Pestaña de tramos de tráfico en tiempo real por destino.

---

## 3. Resultados de la Suite Automatizada de Pruebas

La suite reproducible [`scripts/validate_iteration10_open_data_3d.sh`](/home/ubuntu/gemelotur/scripts/validate_iteration10_open_data_3d.sh) ha superado los 8 casos de prueba:

| Test | Caso de Prueba | Resultado | Detalle |
| :--- | :--- | :---: | :--- |
| **TEST 1** | Autenticación institucional JWT del operador | **PASS** | Sesión verificada para `carlos.dominguez@malaga.es`. |
| **TEST 2** | Catálogo de datos abiertos (`GET /api/geo/open-data/catalog`) | **PASS** | 5 fuentes abiertas catalogadas y disponibles. |
| **TEST 3** | Cumplimiento de estándares OGC e INSPIRE | **PASS** | PNOA verificado como `OGC_WMS` (CC-BY 4.0) y Catastro como `INSPIRE`. |
| **TEST 4** | Red de tráfico y movilidad abierta de Málaga | **PASS** | 4 tramos verificados (ej. Corredor Puerto-Centro a 24 km/h). |
| **TEST 5** | Cobertura multidestino de tráfico (Palma) | **PASS** | 3 tramos verificados (ej. Paseo Marítimo Gabriel Roca). |
| **TEST 6** | Disponibilidad del tileset 3D LiDAR | **PASS** | Endpoint `/tilesets/malaga-centro-2024/tileset.json` responde HTTP 200. |
| **TEST 7** | Disponibilidad de GeoJSON de Catastro con alturas | **PASS** | Archivo `/data/malaga/...geojson` responde HTTP 200. |
| **TEST 8** | Cabecera de caché en datos abiertos | **PASS** | Servido con `Cache-Control: public, max-age=300`. |

---

## 4. Archivos Creados y Modificados en la Iteración 10

1. **[`PLAN_ITERACION_10_DATOS_ABIERTOS_3D.md`](/home/ubuntu/gemelotur/PLAN_ITERACION_10_DATOS_ABIERTOS_3D.md)**: Plan maestro de implementación.
2. **[`src/types/openData.ts`](/home/ubuntu/gemelotur/src/types/openData.ts)**: Tipos de datos para fuentes abiertas y tráfico.
3. **[`src/services/openDataService.ts`](/home/ubuntu/gemelotur/src/services/openDataService.ts)**: Servicio con catálogo OGC y tramos de movilidad.
4. **`server.ts`**: Endpoints `/api/geo/open-data/catalog` y `/api/geo/open-data/traffic`.
5. **[`src/components/Real3DTilesViewer.tsx`](/home/ubuntu/gemelotur/src/components/Real3DTilesViewer.tsx)**: Controles de realismo (sol, niebla, presets, mapa base PNOA y tráfico 3D).
6. **[`src/components/OpenDataLayersModal.tsx`](/home/ubuntu/gemelotur/src/components/OpenDataLayersModal.tsx)**: Modal de exploración de fuentes abiertas.
7. **`src/App.tsx`**: Botón «Datos Abiertos IGN» y renderizado del modal.
8. **[`scripts/validate_iteration10_open_data_3d.sh`](/home/ubuntu/gemelotur/scripts/validate_iteration10_open_data_3d.sh)**: Suite de validación automatizada de 8 casos.
9. **[`ITERACION_10_DATOS_ABIERTOS_3D.md`](/home/ubuntu/gemelotur/ITERACION_10_DATOS_ABIERTOS_3D.md)**: El presente informe técnico.
