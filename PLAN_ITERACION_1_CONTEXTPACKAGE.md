# Iteración 1 — ContextPackage v1 y alta de destinos

## Resultado de producto

Un operador puede cargar un archivo **ContextPackage v1**, validar su estructura y sus reglas de gobierno, incorporarlo al catálogo de destinos de la sesión y abrir el gemelo con sus zonas, recursos y sensores sin modificar el código del motor.

El paquete de ejemplo se identifica de forma explícita como **dato sintético de demostración**. La persistencia durable en PostGIS se prepara con una migración, pero la demo mantiene los paquetes importados en memoria hasta que el piloto persistente proporcione autenticación, tenant efectivo y una conexión PostGIS autorizada.

## Arquitectura y entrega

- **Frontend:** SPA React/Vite. El asistente de alta lee un archivo JSON local o carga el paquete de ejemplo, pide prevalidación al backend y actualiza el estado local tras una importación aceptada.
- **API:** Express gestiona `GET /api/context-packages/schema`, `GET /api/context-packages/examples`, `POST /api/context-packages/validate`, `POST /api/context-packages/import` y `GET /api/context-packages/destinations`.
- **Contrato:** JSON Schema Draft 2020-12 publicable, tipos TypeScript equivalentes y validador determinista sin dependencias de ejecución adicionales.
- **Persistencia futura:** migración PostGIS 005 con tablas versionadas de paquetes, validaciones, fuentes y relación tenant/destino. En la demo cada respuesta declara `MEMORY_DEMO_NOT_PERSISTED`.
- **Rutas y caché:** se conserva la única ruta de página `/`; las APIs y las importaciones no se almacenan en caché (`no-store`). El esquema y el ejemplo se sirven como activos públicos versionados en rutas relativas.

## Contrato ContextPackage v1

El paquete incluirá:

1. Identidad/versionado: `type`, `schemaVersion`, `id`, `createdAt`, `title` y `purpose`.
2. Titularidad: `tenant`, `destination` y namespace NGSI-LD.
3. Perfil de contexto: CRS obligatorio `EPSG:4326`, zona horaria, locale, dominios y nivel cartográfico inicial.
4. Entidades operativas: al menos una zona; recursos y sensores opcionales.
5. Fuentes: formato, frecuencia, calidad, finalidad, trazabilidad, clasificación de privacidad y estado de autorización.
6. Series y variables: catálogo de variables con unidad, observabilidad y origen; se declaran sin afirmar un modelo predictivo entrenado.
7. Mapeo semántico: URL del contexto JSON-LD y correspondencias a las entidades PID/SEGITTUR.
8. Evidencia: licencia, procedencia, fecha de corte y notas de cobertura.

## Validaciones de aceptación

- Rechazar versiones, CRS, IDs, geometrías, coordenadas, fechas, unidades, fuentes o referencias semánticas incorrectas.
- Rechazar un `destination.id` que colisione con un destino ya registrado.
- Requerir zona(s), fuente(s), gobernanza y un perfil de capacidad para la importación.
- Devolver advertencias —sin bloquear— para datos de demostración, calidad estimada o conectores pendientes de autorización.
- Tras una importación válida, el destino debe aparecer en el selector y sus datos alimentar el visor 2D y el motor base.
- Conservar aislamiento lógico por `tenant.id` y `destination.id` en API, modelo y migración SQL.

## Estructura prevista

| Ruta | Responsabilidad |
|---|---|
| `context-package/schema/context-package-v1.schema.json` | Esquema JSON canónico independiente del frontend. |
| `context-package/examples/` | Paquete demostrador sintético y legible. |
| `src/types/contextPackage.ts` | Contrato TypeScript compartido. |
| `src/services/contextPackageService.ts` | Validación, catálogo en memoria e importación segura. |
| `src/components/ContextPackageModal.tsx` | Asistente de revisión/importación para el operador. |
| `database/migrations/005_context_packages.sql` | Persistencia productiva futura con RLS. |
| `ESTANDAR_CONTEXTPACKAGE_V1.md` | Guía de implementación para los destinos. |

## Verificación

- Compilación estricta TypeScript y construcción Vite.
- Validación automática del JSON Schema y del paquete de ejemplo.
- Pruebas HTTP de paquete válido, inválido y colisión de destino.
- Prueba de la ruta de importación y del resultado consumido por el frontend.
- Revisión independiente de las conexiones: contrato → API → selector → motor/visor → migración.
