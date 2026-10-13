# Editor de Escenarios Interactivo v1

## Propósito

El editor de escenarios permite que un destino configure sus propias hipótesis de simulación sin modificar código ni depender de un catálogo cerrado de casos de uso. Las plantillas PID existentes son referencias opcionales; el operador puede crear escenarios privados para su propio contexto territorial.

## Flujo operativo

1. Seleccionar el destino en el control room.
2. Abrir **Simulación → Crear**.
3. Definir nombre, responsable, tipo, descripción y, opcionalmente, el evento o intervención.
4. Elegir una o más zonas del destino.
5. Configurar hora, clima, variación de visitantes, capacidad operativa, movilidad, umbral de alerta, intensidad y distribución espacial.
6. Guardar como `BORRADOR`.
7. Validar: el sistema devuelve errores y advertencias de contrato sin ejecutar el motor.
8. Ejecutar: el estado pasa a `EJECUTADO`, el motor calcula el resultado y el visor presenta **BASE / ESCENARIO / DELTA** mediante los indicadores, el mapa de calor y las zonas simuladas.
9. Duplicar para iniciar otra hipótesis o archivar para conservar la evidencia y bloquear la modificación/ejecución directa.

## Estados

| Estado | Significado | Acciones permitidas |
|---|---|---|
| `BORRADOR` | Definición guardada y editable. | Editar, validar, ejecutar, duplicar, archivar. |
| `VALIDADO` | Superó validaciones de rango, zona, destino y contrato. | Ejecutar, editar (crea nueva versión), duplicar, archivar. |
| `EJECUTADO` | Se ejecutó contra el contexto disponible. | Editar (crea nueva versión), duplicar, archivar. |
| `ARCHIVADO` | Evidencia conservada, no operativa. | Duplicar. |

## Validaciones aplicadas

- El escenario pertenece a un destino conocido, ya sea demostrador o incorporado por `ContextPackage v1`.
- Debe tener nombre, descripción, responsable y una o más zonas de ese mismo destino.
- Hora: 0–23; visitantes: −50% a +100%; capacidad operativa: 50% a 120%; umbral: 60% a 100%; intensidad: 0 a 1,5.
- Clima, movilidad, distribución espacial y tipo se restringen a enumeraciones conocidas.
- Un escenario archivado no se puede editar, validar ni ejecutar; debe duplicarse.

## API de demostración

Todas las respuestas usan `Cache-Control: no-store`.

| Operación | Endpoint |
|---|---|
| Listar | `GET /api/scenarios?destino={id}` |
| Crear | `POST /api/scenarios` |
| Consultar | `GET /api/scenarios/{id}?destino={id}` |
| Historial de snapshots | `GET /api/scenarios/{id}/versions?destino={id}` |
| Actualizar/versionar | `PUT /api/scenarios/{id}?destino={id}` |
| Validar | `POST /api/scenarios/{id}/validate?destino={id}` |
| Duplicar | `POST /api/scenarios/{id}/duplicate?destino={id}` |
| Archivar | `POST /api/scenarios/{id}/archive?destino={id}` |
| Ejecutar | `POST /api/scenarios/{id}/execute?destino={id}` |

## Límites explícitos del MVP

- Los escenarios se guardan en memoria del proceso (`MEMORY_DEMO_NOT_PERSISTED`); no sobreviven a un reinicio.
- `createdBy` es una declaración de autor, no una identidad autenticada. La autenticación y autorización real se incorporarán con el piloto persistente.
- El motor actual es un motor de reglas y parámetros. No debe confundirse con una predicción entrenada con históricos; la predicción real corresponde a la Iteración 4.
- La migración `006_editor_escenarios.sql` deja preparado PostGIS con definiciones, versiones, validaciones e aislamiento RLS por tenant/destino.
