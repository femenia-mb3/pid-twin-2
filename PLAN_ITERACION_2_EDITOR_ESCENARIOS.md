# Iteración 2 — Editor de escenarios interactivo por destino

## Objetivo de producto

Permitir que un operador de un destino defina, valide, ejecute, compare, duplique, archive y versiona escenarios de simulación **sin tocar código**. Los escenarios PID predefinidos se conservan como referencias opcionales, pero no son el único modo de simular.

> Flujo demostrable: seleccionar destino → crear escenario → elegir zonas y parámetros → validar → ejecutar → visualizar BASE / ESCENARIO / DELTA en el visor → conservar la definición y su evidencia en la sesión.

## Decisiones de implementación

### Arquitectura y entrega

- Se mantiene la arquitectura actual **SPA React/Vite + API Express**. El editor y el mapa se renderizan en el navegador; las operaciones de escenario se validan y ejecutan a través de `/api/scenarios/*` en el backend.
- El frontend se publica como salida estática y las rutas `/api/*` siguen resolviendo en el servidor configurado por el proyecto. Los activos versionados mantienen la política de caché existente; las respuestas del editor se devuelven con `Cache-Control: no-store`, ya que incluyen borradores y resultados mutables.
- Se usan exclusivamente componentes y bibliotecas **open source** ya presentes en el proyecto: React, TypeScript, Express, Ajv, Tailwind, Lucide y PostGIS para el destino persistente.
- La demo conserva escenarios en memoria del proceso y lo declara explícitamente. La migración PostGIS deja preparado el almacenamiento de definiciones, versiones y validaciones para el piloto persistente.

### Modelo de escenario

Un escenario editable contiene:

- identidad privada por destino, versión, autor declarado y fechas;
- estados `BORRADOR`, `VALIDADO`, `EJECUTADO`, `ARCHIVADO`;
- nombre, descripción, tipo y ventana horaria;
- zonas afectadas y distribución espacial (`UNIFORME`, `CONCENTRADA`, `REDISTRIBUIDA`);
- variación de visitantes, clima, capacidad operativa, movilidad, umbral de alerta e intensidad;
- metadatos de evento y fuentes/limitaciones de la ejecución;
- una conversión explícita al contrato `EscenarioSimulacion` del motor actual, sin introducir reglas dependientes de Málaga o Palma.

### Validación

La API rechaza escenarios que no pertenezcan al destino de la operación, carezcan de zonas válidas, excedan rangos de entrada, tengan horarios inválidos o pretendan usar estados transitorios de manera incorrecta. La validación devuelve errores y advertencias estructurados para la interfaz.

### Interfaz

- Un botón **Crear escenario** abre el editor no-code desde la pestaña Simulación.
- El formulario permite crear o modificar borradores, seleccionar una o varias zonas, configurar variables y ver los rangos permitidos.
- La lista de escenarios propios permite abrir, duplicar, archivar, validar y ejecutar cada definición.
- La ejecución activa el escenario en el gemelo y conserva una ficha de evidencia con versión, variables y estado, mientras los indicadores existentes muestran base/escenario/delta.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `src/types/scenarioStudio.ts` | Contratos de definición, validación, ejecución, estados y mapeo al motor. |
| `src/services/scenarioStudioService.ts` | Catálogo en memoria, control de versiones, validaciones y conversión de entradas. |
| `src/components/ScenarioEditorModal.tsx` | Editor visual sin código, lista por destino y acciones del ciclo de vida. |
| `server.ts` | API `/api/scenarios/*`, ejecución contextual y cabeceras no-cache. |
| `database/migrations/006_editor_escenarios.sql` | Tablas persistentes, integridad tenant/destino y RLS para piloto PostGIS. |
| `src/App.tsx` | Activación de la definición ejecutada en el motor y evidencia visible en el control room. |

## Criterios de aceptación

1. Desde un destino se puede crear un escenario propio sin editar archivos de código.
2. El formulario permite elegir zonas, hora, clima, variación de visitantes, capacidad operativa, movilidad, umbral, intensidad y distribución espacial.
3. El escenario puede guardarse como borrador, validarse, ejecutarse, duplicarse, archivarse y conservar una versión creciente por modificación.
4. La API rechaza rangos inválidos, zonas de otro destino, nombre vacío y operaciones no permitidas sobre escenarios archivados.
5. La ejecución usa los datos del destino (incluidos los cargados mediante ContextPackage), alimenta el motor existente y actualiza BASE / ESCENARIO / DELTA sin depender de IDs de Málaga o Palma.
6. El alcance de demo en memoria y la ruta de persistencia PostGIS quedan expresamente documentados.

## Verificación

- Compilación TypeScript/Vite.
- Pruebas HTTP de creación, validación, ejecución, duplicación, archivado, aislamiento de destino y rechazos de contrato.
- Análisis sintáctico PostgreSQL de la migración 006.
- Revisión independiente de las conexiones API → catálogo → motor → estado del visor, conforme a la guía Webdev.
