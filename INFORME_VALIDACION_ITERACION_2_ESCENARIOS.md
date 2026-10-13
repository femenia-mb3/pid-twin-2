# Validación independiente — Iteración 2: Editor de escenarios

Fecha: 8 de octubre de 2026.

## Resultado

**PASS en los seis criterios de aceptación** de `PLAN_ITERACION_2_EDITOR_ESCENARIOS.md`.

| Criterio | Resultado | Evidencia |
|---|---|---|
| Crear sin código | PASS | `ScenarioEditorModal` se abre desde Simulación → Crear y usa `POST /api/scenarios`. |
| Variables configurables | PASS | El formulario contiene zonas, hora, clima, variación de visitantes, capacidad operativa, movilidad, umbral, intensidad y distribución espacial. |
| Ciclo de vida | PASS | API/UI para `BORRADOR`, `VALIDADO`, `EJECUTADO`, `ARCHIVADO`, duplicado y modificación versionada. |
| Rechazos de contrato | PASS | Zonas ausentes o de otro destino, rangos, nombre/descrición, enumeraciones y ejecución de archivados retornan `422` con códigos estructurados. |
| Multidestino y motor | PASS | El servicio toma primero el runtime de `ContextPackage`, transforma la definición al contrato del motor y entrega evidencia `BASE_ESCENARIO_DELTA`. |
| Persistencia futura explícita | PASS | Demo `MEMORY_DEMO_NOT_PERSISTED`; migración 006 añade definiciones, snapshots, validaciones, FKs compuestas y RLS. |

## Hallazgo de mejora aplicado antes del cierre

La revisión identificó que el contador de versión estaba implementado pero la demo no exponía snapshots de las versiones previas. Se corrigió antes del checkpoint:

- `ScenarioStudioService` conserva snapshots en memoria por versión.
- `GET /api/scenarios/{id}/versions?destino={id}` devuelve el historial aislado por destino.
- El editor muestra el número de snapshots existentes.
- La prueba final comprobó versiones 1 y 2, con los valores originales recuperables desde el historial.

## Pruebas realizadas

- Compilación `pnpm build`: correcta.
- Análisis SQL de `006_editor_escenarios.sql` con `pglast`: correcto.
- HTTP: rechazo de zonas ausentes/cruzadas; creación; validación; ejecución; actualización `v1 → v2`; historial de snapshots; duplicación; archivado; bloqueo de ejecución archivada; aislamiento Málaga/Palma; ejecución sobre destino importado mediante ContextPackage; proxy Vite hacia la API.

## Límites explícitos del MVP

- Escenarios y ContextPackages se mantienen en memoria y se eliminan al reiniciar el servicio.
- La autoría es declarativa, sin autenticación/roles reales todavía.
- El motor es de reglas/parametrización; no es una predicción entrenada con históricos.
