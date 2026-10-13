# Resolución de validación — Interoperabilidad PID y catálogo de modelos

**Fecha:** 2026-09-30  
**Informe de origen:** `INFORME_VALIDACION_INTEROPERABILIDAD_PID.md`  
**Alcance:** corrección de hallazgos confirmados en el flujo fuente/carril → plantilla → instancia y en el ciclo de reutilización de modelos.

## Hallazgos resueltos

| Hallazgo del validador | Corrección aplicada | Evidencia verificada |
|---|---|---|
| La instancia enviaba `factorLocal` y `prioridadOperativa` genéricos, no las variables del modelo elegido. | El modal construye sus controles desde `selectedModel.variables` y envía exactamente el objeto `parameters` resultante. | `pnpm build` correcto; prueba de Saturación con `umbralAlerta` y `horizonte` devolvió `201 VALIDATED_NOT_PERSISTED`. |
| La API aceptaba claves ajenas y no exigía las variables de la plantilla. | `InteroperabilityCatalogService.instantiate()` valida claves permitidas, obligatoriedad, tipos, rangos y valores permitidos, y normaliza el objeto de salida. | Un payload con `notTemplateVariable` y sin las variables requeridas devolvió `422` con los tres errores explícitos. |
| La UI vinculaba automáticamente todos los conectores de un carril, incluso contratos pendientes. | El panel muestra una selección explícita de conectores por plantilla; los `PENDIENTE_AUTORIZACION` aparecen inhabilitados. El servidor también los rechaza como defensa en profundidad. | Intento con `conn_malaga_api_municipal` pendiente devolvió `422` y el nombre del conector rechazado. |
| No existía creación/publicación de modelo propio. | Se añadieron `POST /api/models/own`, `POST /api/models/:id/publish`, propiedad por destino, consulta de borrador y visibilidad de una publicación para otros destinos. El modal permite crear el borrador y publicarlo. | Se creó un borrador de Málaga, se publicó por Málaga y Palma lo recibió en el catálogo e instanció correctamente. |
| Posible respuesta obsoleta al cambiar rápidamente de destino. | El modal usa un contador de secuencia de solicitudes y descarta respuestas que no correspondan a la última carga. | Inspección de `requestSequence` dentro de `load()` y cancelación lógica al cerrar el modal. |
| Las fuentes vinculadas a una instancia estaban previstas como JSONB sin FK. | La migración añade `instancias_modelo_fuentes` con clave foránea compuesta que asegura que cada fuente pertenece al mismo `tenant_id` y `destino_id`. | `pglast` analizó la migración: **17 sentencias**; se comprobaron `fk_instancia_fuente_mismo_destino`, la clave única compuesta y RLS. |

## Pruebas de aceptación ejecutadas

### 1. Parámetros específicos de plantilla

```json
POST /api/models/reusable/modelo_saturacion_turistica/instantiate
{
  "destinationId": "malaga",
  "connectorIds": ["conn_malaga_s2_recursos", "conn_malaga_c4_historicos"],
  "parameters": {"umbralAlerta": 88, "horizonte": 6}
}
```

Resultado: **201**, `valid: true`, `persistence: VALIDATED_NOT_PERSISTED` y parámetros normalizados exactamente a `umbralAlerta` y `horizonte`.

El caso negativo con `{ "notTemplateVariable": true }` devolvió **422** por clave no permitida y por ausencia de ambas variables obligatorias.

### 2. Ciclo propio → reutilizable → segundo destino

1. Se creó el borrador de Málaga **Turismo astronómico** con variable numérica `factorNocturno` y política de privacidad declarada.
2. Málaga publicó el borrador: `publication: REUTILIZABLE_PID`, `lifecycle: PUBLICADO`, versión `1.0.0`.
3. `GET /api/models/reusable?destino=palma` confirmó que la plantilla ya era visible para Palma.
4. Palma validó una instancia con sus conectores S2/C4 autorizados y `{ "factorNocturno": 1.5 }`.
5. Resultado: **201**, `VALIDATED_NOT_PERSISTED`, destino `palma` y plantilla del modelo publicado por Málaga.

También se creó un borrador privado de prueba: Palma recibió **404** al consultarlo y **422** al intentar publicarlo, confirmando el aislamiento por destino en el modo demostrador.

### 3. Restricciones de fuente y persistencia

- El conector municipal REST de Málaga fue incorporado explícitamente como contrato `REST_API` para cubrir la categoría API municipal sin pretender una conexión viva.
- Un conector en estado `PENDIENTE_AUTORIZACION` no puede ser seleccionado en la interfaz ni aceptado por la API.
- Las respuestas de configuración siguen respondiendo con `Cache-Control: no-store` y JSON.
- El conjunto de pruebas no escribió en PostGIS ni en sistemas PID externos. Los modelos de prueba residieron en memoria y se eliminan al reiniciar el backend.

## Estado final

Los hallazgos de implementación del informe independiente quedan **resueltos en el alcance de la demostración funcional**. Queda pendiente para un piloto persistente: aplicar la migración sobre PostgreSQL/PostGIS real, verificar RLS con un rol de aplicación no propietario y sustituir la autorización demostradora por identidad/roles de la PID.
