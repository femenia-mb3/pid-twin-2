# Informe de validación independiente — ContextPackage v1 (Iteración 1)

**Dictamen global: FAIL condicionado.** La cadena de alta y visualización está implementada y los activos/documentación están publicados, pero **CP-2** no cumple las validaciones comprometidas y **CP-4** no asegura la integridad referencial `tenant + destino` en la migración preparada.

## Alcance y método

Revisión de solo lectura de código, contrato, migraciones y documentación. Se hicieron únicamente solicitudes **GET** locales a los activos y API; no se ejecutaron `POST`, importaciones, builds, migraciones ni reinicios.

Las comprobaciones GET confirmaron:

- `GET /api/context-packages/schema`, `/examples` y `/destinations`: `200`, `Cache-Control: no-store`.
- El registro activo estaba vacío: `total: 0` y `persistence: MEMORY_DEMO_NOT_PERSISTED`.
- El esquema, ejemplo y guía se sirven desde la SPA; el contexto JSON-LD se sirve como `application/ld+json`.
- Los hashes de los tres activos públicos son idénticos a sus fuentes canónicas.

Las evidencias previas de build, validación Draft 2020-12, sintaxis SQL y pruebas HTTP con POST fueron aportadas, pero no se reprodujeron para respetar el alcance de solo lectura.

## Resultado por criterio

| Criterio | Estado | Hallazgo verificable |
|---|---|---|
| **CP-1 — Contrato** | **pass** | Existe contrato `1.0.0` Draft 2020-12, tipos TS, ejemplo sintético explícitamente etiquetado y cobertura de destino, perfil, entidades, fuentes, variables, gobernanza, semántica y evidencia. |
| **CP-2 — Validación** | **fail** | El validador de ejecución no aplica el JSON Schema y permite clases de paquete que el contrato publicado rechaza; en especial, no verifica referencias semánticas ni todos los valores de gobierno/fuentes. |
| **CP-3 — Alta funcional** | **pass** | Se trazó importación API → callback React → selector/estado → MapViewer y motor; además las capas GeoJSON y `/api/simulacion/ejecutar` consultan los datos importados. |
| **CP-4 — Gobierno y persistencia** | **fail** | La demo declara correctamente la memoria efímera y la migración incluye tablas/RLS, pero faltan FKs compuestas que garanticen que el par `tenant_id, destino_id` de paquete, informe y fuente corresponde entre sí. |
| **CP-5 — Interoperabilidad** | **pass** | Contrato/ejemplo/guía están publicados en rutas relativas, las APIs no almacenan en caché y el JSON-LD PID/SEGITTUR contiene los tipos usados por el ejemplo. |
| **CP-6 — Documentación** | **pass** | La guía explica activos, contrato, API, reglas, flujo y límites de iteración de forma clara, aunque debe ajustarse tras corregir CP-2 para no prometer validaciones inexistentes. |

## Hallazgos concretos

### Bloqueantes

1. **La API no usa ni reproduce por completo el JSON Schema publicado (CP-2).**
   - El schema prohíbe propiedades raíz adicionales (`context-package-v1.schema.json`, línea 7), pero `ContextPackageService.validate` no revisa claves desconocidas ni invoca un validador de schema (`src/services/contextPackageService.ts`, líneas 82–232).
   - Las entidades de zona/recurso/sensor solo reciben comprobaciones parciales en el servicio. Por ejemplo, recurso y sensor se limitan esencialmente a ID, destino, punto y gobernanza (líneas 159–173); no se validan los campos operativos completos que el visor/motor consumen (`categoria`, `visitantesHora`, `tipoSensor`, `umbralAlerta`, etc.).
   - La geometría se reduce a cardinalidad y rango de coordenadas (líneas 50–66): no comprueba anillo no degenerado, no autointersección, ni otras geometrías operativamente inválidas.
   - Las fechas usan `Date.parse` (líneas 20 y 45–47), no una comprobación estricta ISO-8601/date-time equivalente al contrato.

2. **Las referencias semánticas incorrectas no se rechazan (CP-2).**
   - `semanticMapping` solo exige textos no vacíos para `contextUrl` y `ontologyProfile`, y el prefijo `urn:ngsi-ld:` para `namespace` (servicio, líneas 206–213).
   - No compara `contextUrl` con `/ontology/segittur-pid-context-v1.jsonld`, no valida `ontologyProfile`, no comprueba la pertenencia/coherencia del namespace con tenant/destino, ni valida `entityMappings` contra `TouristDestination`, `TourismZone`, `TourismResource` y `TourismSensor`.
   - El schema exige las cuatro claves de `entityMappings`, pero sus valores son strings libres y el servicio ni siquiera inspecciona dicho objeto. Por tanto, una referencia semántica errónea puede importar aunque el plan exige rechazarla.

3. **Gobernanza y fuentes se validan solo en parte (CP-2).**
   - `validateGovernance` comprueba presencia y fecha, pero no enumera `tipoFuente`, `calidad` ni `frecuenciaActualizacion` (líneas 37–48).
   - Para fuentes, se valida formato, ID, trazabilidad y `NO_AUTORIZADO`, pero no se valida el carril, frecuencia, privacidad, finalidad, ni que `dataQuality`/`authorization` sean valores admitidos (líneas 176–201). Esto contradice el mensaje del modal de que se valida la privacidad y todas las referencias de gobierno (`ContextPackageModal.tsx`, línea 158).
   - **Correcto:** `PENDIENTE` y calidad estimada/en validación generan advertencias (líneas 187–190), y `syntheticDemoData: true` también (línea 222). El modal las muestra explícitamente (líneas 199–203), por lo que estas advertencias no quedan ocultas.

4. **La migración no preserva de forma referencial el par tenant–destino (CP-4).**
   - `context_packages` tiene FKs separadas a `tenants_gemelo` y `destinos` (migración 005, líneas 9–32), pero no una FK compuesta a `destino_perfiles_semanticos(tenant_id, destino_id)`. Puede vincular un tenant válido con un destino de otro tenant.
   - `context_package_validaciones` referencia por separado el paquete, tenant y destino (líneas 34–45). Nada obliga a que tenant/destino sean los del `context_package_id` informado.
   - Fuentes y variables sí referencian el perfil semántico compuesto (líneas 63–67 y 85–89), pero tampoco tienen una FK compuesta al paquete padre; pueden asociarse a otro par tenant/destino válido distinto del del paquete.
   - Existen `ENABLE ROW LEVEL SECURITY` y políticas por par (líneas 100–125), lo que es una buena preparación. No obstante, RLS no corrige esas inconsistencias de modelo y no se usa `FORCE ROW LEVEL SECURITY`; el propietario de tabla la evita. Su ejecución real en PostgreSQL queda **unverified** por alcance.

### Conexiones verificadas

- **Contrato → API:** Express expone schema, ejemplos, validación, importación y destinos (`server.ts`, líneas 57–117); las respuestas ContextPackage llevan `no-store`.
- **API → React → selector:** el modal prevalida e importa contra la API (`ContextPackageModal.tsx`, líneas 34–113). Tras `201`, `App` guarda el paquete, selecciona su destino (líneas 348–356) y el selector renderiza `destinosDisponibles` (líneas 67–76 y 387–400).
- **Datos → visor/motor:** las colecciones importadas se filtran por destino (líneas 187–220) y se pasan al motor genérico. El `MapViewer` consume sus zonas, recursos y sensores; el endpoint de simulación hace el mismo enrutado mediante `getRuntimeData` (`server.ts`, líneas 164–184). Las rutas GeoJSON también convierten la convención `[latitud,longitud]` a GeoJSON `[longitud,latitud]` (`contextPackageService.ts`, líneas 277–322).
- **Límite operativo:** React no rehidrata `contextPackages` desde `GET /api/context-packages/destinations` al cargar. Tras recargar la SPA, el selector cliente pierde los paquetes aunque el proceso API no se haya reiniciado. Es compatible con la advertencia de memoria efímera, pero debe declararse expresamente como limitación de sesión de interfaz o rehidratarse.
- **Semántica/publicación:** el ejemplo usa la ruta relativa del JSON-LD y los cuatro tipos que el contexto publicado define (`TouristDestination`, `TourismZone`, `TourismResource`, `TourismSensor`). No se generan entidades NGSI-LD de un ContextPackage importado: `MultiDestinationModel` continúa basado en los destinos demo. No debe describirse esta iteración como ingestión semántica materializada.

## Recomendaciones priorizadas

1. **Corregir CP-2 antes de aceptación:** ejecutar el schema Draft 2020-12 en `/validate` y `/import`, o replicar exhaustivamente sus restricciones; añadir validación estricta ISO-8601, topología/degeneración de polígonos, campos operativos y enumeraciones de gobierno/fuentes.
2. **Validar semántica de forma determinista:** fijar el contexto y perfil admitidos en v1, exigir namespace derivado del destino y validar los cuatro `entityMappings` frente al contexto JSON-LD publicado. Rechazar valores desconocidos.
3. **Corregir 005:** añadir FK compuesta `(tenant_id, destino_id)` desde `context_packages` a `destino_perfiles_semanticos`; usar claves compuestas que vinculen informes, fuentes y variables al mismo paquete y par tenant/destino. Considerar `FORCE ROW LEVEL SECURITY`, roles no propietarios y pruebas de aislamiento.
4. **Alinear documentación/UI con la implementación:** hasta aplicar las validaciones, no afirmar que se valida privacidad o referencias semánticas; precisar que la importación visible en React no sobrevive una recarga de la SPA. Mantener el aviso de datos sintéticos, autorización pendiente y calidad no certificada ya implementado.
5. **Para el piloto persistente:** crear pruebas de integración no destructivas para schema/API, colisión concurrente, GeoJSON, rehidratación, relación tenant-destino, RLS con roles de aplicación y rechazo de cada caso adverso comprometido.
