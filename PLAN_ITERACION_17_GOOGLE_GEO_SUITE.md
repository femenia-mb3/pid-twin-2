# Plan de Implementación — Iteración 17: Google Geo Suite Gobernado para Enriquecimiento 3D y Territorial

## 1. Contexto, Objetivos y Decisiones de Arquitectura

La **Iteración 17** integra las capacidades de la suite geoespacial de Google como una **capa opcional, complementaria y gobernada** para enriquecer el Gemelo Digital Turístico PID/SEGITTUR, preservando de forma estricta los principios de soberanía de datos, tecnologías abiertas, vinculación obligatoria a evidencias y supervisión humana.

### 1.1. Principios Rectores y Gobernanza
1. **Soberanía del Módulo Común PID**: El núcleo de datos, ontología SEGITTUR, NGSI-LD, PostGIS, GeoServer/OGC, S2, C4, IoT, ContextPackages y modelos de simulación/predicción sigue siendo 100% independiente de Google. Un destino sin Google opera exactamente con el mismo rigor.
2. **Preferencia por Tecnologías Open Source**: Las capacidades geoespaciales base se sustentan en CesiumJS, Leaflet, PostGIS, LiDAR PNOA, Catastro y estándares abiertos OGC. Google solo actúa como proveedor externo bajo demanda para fotorrealismo o contexto complementario.
3. **Vinculación Obligatoria a Evidencias**: Toda interacción, consulta o propuesta con Google genera un sobre de evidencia (`GoogleGeoEvidenceEnvelope`) con huella SHA-256, atribución visible de fuentes, propósito declarado, fecha/hora y registro inmutable en auditoría PostGIS.
4. **Seguridad y Cero Exposición de Secretos**: No se exponen credenciales en el cliente ni se transmiten secretos por chat. Las llamadas sensibles se canalizan por backend mediante proxy autenticado con JWT institucional y roles verificados.
5. **No Automatismo Operativo**: Ninguna llamada a Google puede alterar por sí sola simulaciones, calibraciones, protocolos o agentes Centinela sin validación humana expresa.
6. **No Persistencia Ilícita de Cartografía**: De acuerdo con las políticas oficiales de Google Maps Tile API, no se almacenan ni indexan teselas 3D en PostGIS ni S3. Solo se visualizan en vivo respetando cabeceras de caché.

---

## 2. Estructura de Módulos y Ficheros

```
/home/ubuntu/gemelotur/
├── database/migrations/
│   └── 022_google_geo_suite_gobernanza.sql         # Tablas RLS, prevalidaciones, auditoría y conector Google
├── src/types/
│   └── googleGeoSuite.ts                          # Tipos TypeScript, contratos de módulos, sobres de evidencia y prevalidación
├── src/services/
│   ├── googleGeoSuitePostgisExtension.ts          # Extensión de persistencia transaccional PostGIS con RLS
│   └── googleGeoSuiteService.ts                   # Lógica de prevalidación, conector, estado de módulos y proxy seguro
├── src/components/
│   ├── GoogleGeoSuiteModal.tsx                    # Modal de gestión, prevalidación, auditoría y módulos de Google Geo Suite
│   └── Real3DTilesViewer.tsx                      # Selector de procedencia visual (PID Abierto vs Google 3D Fotorrealista)
├── server.ts                                      # Endpoints REST protegidos por JWT, claims y X-PID-Tenant
└── scripts/
    └── validate_iteration17_google_geo_suite.sh   # Suite de validación automatizada de 8 casos
```

---

## 3. Contratos y Especificación Funcional

### 3.1. Estado de Módulos Google
- `photorealistic_3d_tiles`: Módulo principal implementado con CesiumJS y Google 3D Tileset API.
- `google_3d_maps`: Preparado como visor de exploración complementario.
- `routes_api`: Preparado como recomendación de desvíos, no activo operativamente.
- `places_api`: Preparado para contexto y descubrimiento de POIs, no activo como inventario oficial.
- `maps_grounding`: Preparado para el Copiloto IA con citas explícitas, en modo piloto experimental.

### 3.2. Estados del Conector por Destino
`DESHABILITADO` (por defecto) | `EN_PREVALIDACION` | `APROBADO_PILOTO` | `ACTIVO_VERIFICADO` | `RESTRINGIDO` | `SIN_CREDENCIALES` | `REVOCADO`.

### 3.3. Prevalidación Institucional
Antes de permitir el cambio a `ACTIVO_VERIFICADO`, el sistema exige:
1. Autorización formal de la entidad responsable (Ayuntamiento o SEGITTUR).
2. Zona territorial delimitada (ej. `malaga_centro_puerto`).
3. Finalidad operativa lícita (`VISUALIZACION_FOTORREALISTA`, `INSPECCION_PATRIMONIAL`, etc.).
4. Compromiso de no persistencia y atribución visual obligatoria.
5. Firma y matrícula de operador autenticado vía JWT.

---

## 4. Plan de Verificación

Se ejecutará una suite de pruebas automatizadas con 8 casos rigurosos:
1. Login institucional de operadores (Málaga y Palma) con emisión de tokens JWT.
2. Consulta del conector Google Geo Suite (nace `DESHABILITADO` y `SIN_CREDENCIALES`).
3. Prevalidación formal de Málaga con firma de operador generando veredicto `APROBADO_PILOTO`.
4. Activación de Google 3D fotorrealista con registro de sobre de evidencia criptográfica.
5. Verificación de aislamiento multitenant RLS (Palma no puede leer ni modificar Málaga -> HTTP 403).
6. Revocación inmediata del conector y caída garantizada al visor PID Abierto (`FALLBACK_PID_ABIERTO`).
7. Consulta del catálogo de módulos preparados (`routes_api`, `places_api`, `maps_grounding` marcados como `PREPARADO_NO_ACTIVO`).
8. Comprobación de integridad inmutable en PostgreSQL/PostGIS.
