# Resolución de validación — ContextPackage v1

Fecha: 8 de octubre de 2026

Este documento cierra los hallazgos de la revisión independiente `INFORME_VALIDACION_CONTEXTPACKAGE_V1.md` para la Iteración 1.

## Hallazgos corregidos

| Hallazgo | Corrección aplicada | Evidencia |
|---|---|---|
| La API no aplicaba por completo el JSON Schema publicado. | `ContextPackageService` compila el esquema canónico Draft 2020-12 mediante `Ajv2020` + `ajv-formats` antes de las reglas de negocio. | Paquete canónico: `200`; propiedad raíz adicional: `422` con `SCHEMA_ADDITIONALPROPERTIES`. |
| Semántica, fuentes y gobierno validados solo parcialmente. | Se añadieron validaciones deterministas del contexto PID, perfil, namespace derivado del destino, cuatro mapeos de entidad, carril, formato, frecuencia, calidad, privacidad, autorización, finalidad y enumeraciones de gobierno. | Mutaciones semánticas y de calidad devuelven `422` con códigos específicos. |
| La geometría permitía polígonos inválidos. | La validación añade área no degenerada, normalización de anillo y detección de autointersección, además de rangos EPSG:4326. | Polígono autointersecado: `422` con `GEOMETRY_SELF_INTERSECTION`. |
| Las fechas eran permisivas. | Las fechas exigidas deben ser ISO-8601 UTC canónicas con milisegundos y se validan también por Draft 2020-12. | Fecha no canónica: `422` con `CREATED_AT_INVALID`. |
| La migración permitía cruces tenant/destino. | `005_context_packages.sql` incorpora FKs compuestas entre perfil semántico, paquete, validaciones, fuentes y variables; activa además `FORCE ROW LEVEL SECURITY`. | Sintaxis de migración validada con `pglast`. |

## Verificación posterior a la corrección

1. `pnpm build` completó correctamente con TypeScript estricto y Vite.
2. El ejemplo canónico valida contra el esquema Draft 2020-12.
3. La migración 005 supera análisis sintáctico PostgreSQL (`pglast`).
4. Las pruebas HTTP verificaron:
   - validación canónica `200`;
   - propiedad no permitida `422`;
   - semántica incoherente `422`;
   - calidad de gobernanza desconocida `422`;
   - polígono autointersecado `422`;
   - fecha no canónica `422`;
   - importación válida `201`;
   - salida GeoJSON de dos zonas;
   - ejecución base de simulación con visitantes positivos.

## Límite que se mantiene explícito

La importación es de demostración y queda en memoria. El selector React conserva el nuevo destino durante la sesión de interfaz; una recarga completa requiere volver a cargar el paquete. Las entidades NGSI-LD no se materializan todavía en el registro semántico: esa ingestión se ejecutará en el piloto persistente cuando exista PostGIS y autenticación tenant/destino.
