# INFORME TÉCNICO DE IMPLEMENTACIÓN — ITERACIÓN 12
## Simulación Multidestino Federada y Visualización 3D/4D Avanzada Open Source

**Plataforma:** Gemelo Digital Turístico PID — SEGITTUR  
**Versión:** Iteración 12 de 12 (Cierre de Capacidades de Simulación y Visualización)  
**Fecha:** 9 de octubre de 2026  
**Entorno de Ejecución:** Sandbox Ubuntu 24.04 LTS · PostgreSQL 16 + PostGIS 3.4 · Node.js 22 · Express 5 · React 18 · Vite · CesiumJS 1.145  

---

## 1. Resumen Ejecutivo de Capacidades Entregadas

La **Iteración 12** culmina la evolución del Gemelo Digital Turístico resolviendo de forma integral los requerimientos más avanzados de interoperabilidad multidestino y visualización territorial solicitados para la Plataforma Inteligente de Destinos (PID):

1. **Simulación Multidestino Federada con Soberanía del Dato**:
   - Capacidad para que un destino coordinador (ej. Málaga) y destinos participantes (ej. Palma) simulen conjuntamente sobre un mismo modelo declarativo homologado.
   - **Cero cruce de datos crudos**: cada destino computa de forma autónoma su situación local (BASE / ESCENARIO / DELTA) a partir de sus propios conectores y datasets aislados por Row Level Security (RLS).
   - **Evaluación previa y obligatoria de compatibilidad**: antes de autorizar una federación, el motor evalúa variables obligatorias, frecuencias, umbrales de calidad, CRS territorial y políticas de privacidad, clasificando a cada participante en `COMPATIBLE`, `COMPATIBLE_CON_CONDICIONES`, `INCOMPLETO` o `NO_COMPATIBLE`.
   - **Bloqueo estricto de ejecución (HTTP 422)** si alguno de los participantes presenta variables incompletas o no autorizadas.
   - **Métricas agregadas comparables**: consolidación de visitantes base, visitantes simulados, delta conjunto, porcentaje ponderado de saturación global, alertas conjuntas y estimación de emisiones de CO₂.
   - **Auditoría inmutable append-only**: registro en PostGIS de la decisión humana explícita del operador para aprobar o difundir los resultados federados (`decisiones_federadas_audit`), protegida por triggers anti-manipulación.

2. **Visualización 3D y 4D Avanzada con Tecnologías Exclusivamente Open Source**:
   - Consolidación de los 4 niveles de representación territorial sin depender de APIs comerciales de terceros (cero Google Maps, cero tokens de pago de Cesium ion):
     - **Nivel 1 (2D Operativo):** Ortofoto PNOA del IGN vía WMS OGC oficial (`https://www.ign.es/wms-inspire/pnoa-ma`) y Cartografía Base Gris IDEE vía TMS (`https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{y}.jpeg`), con capas vectoriales de afluencia, calor y sensores.
     - **Nivel 2 (2.5D Territorial):** Huellas de Catastro INSPIRE con elevación y cotas de altura estimadas por LiDAR para simulación de densidad urbana.
     - **Nivel 3 (3D Realista Abierto):** Nubes de puntos PNOA LiDAR 3D Tiles 1.1 OGC autohospedadas (`/tilesets/malaga-centro-2024/tileset.json`), modelos glTF/GLB locales, presets de cámara (cenital, oblicua, nivel calle) e iluminación astronómica solar en tiempo real.
     - **Nivel 4 (4D Analítica Temporal):** Timeline dinámico de simulación horaria, congestión de tráfico y desvíos inteligentes.
   - **Catálogo unificado de activos 3D/4D (`/api/3d/catalog/assets`):** Inventario transparente con organismo publicador, licencia abierta (CC-BY 4.0 IGN-CNIG, ODbL INSPIRE, CC0), CRS oficial, resolución/densidad y huella criptográfica SHA-256.
   - **Degradación segura y resiliencia:** Ante ausencia de GPU o caída de contexto WebGL, el visor conmuta limpiamente a `Static3DContextViewer` preservando KPIs y controles, sin pantallas blancas.

---

## 2. Arquitectura de Datos y Migración PostGIS 014

Se aplicó la migración `database/migrations/014_simulacion_federada_3d_avanzado.sql`, asegurando aislamiento multitenant y trazabilidad:

```sql
-- Tablas principales incorporadas en migración 014
1. configuraciones_federadas     -> Modelos federados coordinados con RLS por tenant/destino.
2. ejecuciones_federadas         -> Resultados consolidados agregados y snapshots de evidencia.
3. decisiones_federadas_audit    -> Registro inmutable append-only (bloqueo UPDATE/DELETE por trigger).
4. activos_3d_catalogo           -> Registro unificado de capas territoriales abiertas OGC.
```

---

## 3. Matriz de Validación Automatizada (10/10 Casos Superados)

La suite ejecutable `scripts/validate_iteration12_federated_simulation_3d.sh` superó todas las pruebas:

| Test | Caso de Validación | Resultado | Evidencia |
| :--- | :--- | :---: | :--- |
| **TEST 1** | Autenticación institucional JWT de operadores | **OK** | Emisión de tokens firmados y verificación de claims para Málaga y Palma. |
| **TEST 2** | Evaluación profunda de compatibilidad federada | **OK** | 2 destinos evaluados respecto a variables, calidad y CRS sin exponer datos crudos. |
| **TEST 3** | Rechazo de destino inexistente o no inicializado | **OK** | Destino no registrado marcado como `NO_COMPATIBLE` con informe de causas. |
| **TEST 4** | Creación y persistencia de configuración federada | **OK** | Configuración `fed_cfg_...` persistida en PostGIS con aislamiento RLS. |
| **TEST 5** | Aislamiento RLS en configuraciones federadas | **OK** | Los operadores solo acceden a configuraciones donde son coordinadores o participantes. |
| **TEST 6** | Ejecución federada (BASE / ESCENARIO / DELTA) | **OK** | Run `fed-run-...` completado (+32.436 visitantes globales, desglose local homologado y SHA-256). |
| **TEST 7** | Bloqueo estricto de ejecución (HTTP 422) | **OK** | Bloqueo automático si un participante presenta variables incompletas o no autorizadas. |
| **TEST 8** | Decisión humana inmutable append-only | **OK** | Registro de aprobación `dec_fed_...` en tabla inmutable con trigger de seguridad. |
| **TEST 9** | Catálogo de activos 3D/4D abiertos y licencias | **OK** | PNOA WMS, LiDAR 3D Tiles, Catastro INSPIRE y Tráfico con licencias y CRS oficiales. |
| **TEST 10** | Degradación segura del visor 3D | **OK** | Conmutación limpia sin pantallas blancas ni pérdida de controles ante fallos de GPU. |

---

## 4. Guía de Interacción en el Visor Web

1. **Botón «Simulación Federada» (Cabecera):**
   - Abre el asistente interactivo para elegir el modelo de simulación y los destinos participantes.
   - Permite pulsar **«Evaluar Compatibilidad»** para ver la matriz semántica de cada destino.
   - Guarda la configuración en PostGIS y, si todos los destinos están listos, habilita el botón **«Ejecutar Simulación Federada»**.
   - Muestra los resultados en paralelo (BASE vs ESCENARIO vs DELTA) y el formulario de firma y decisión humana inmutable.

2. **Botón «Catálogo 3D/4D» (Cabecera):**
   - Muestra el inventario unificado de capas cartográficas y 3D abiertas.
   - Filtros por nivel espacial (1 a 4) y formato OGC (3D Tiles, WMS, TMS, GeoJSON INSPIRE).
   - Ficha técnica completa con organismo publicador, enlace a licencia oficial, CRS y huella SHA-256.

3. **Selector de Niveles Geoespaciales (1 · 2 · 3 · 4):**
   - Conmuta entre Edificios Catastro 2D, Catastro + MDT50, 3D Tiles LiDAR fotorrealista y Analítica 4D temporal, con resiliencia activa.
