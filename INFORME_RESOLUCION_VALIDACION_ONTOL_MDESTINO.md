# Resolución de la validación — Ontología SEGITTUR y Modelo Multidestino

**Fecha:** 2026-09-30  
**Informe de origen:** `INFORME_VALIDACION_ONTOL_MDESTINO.md`  
**Resultado final:** **RESUELTO**

Este documento cierra los tres hallazgos materiales de la revisión independiente. La revisión original se conserva como evidencia histórica y no se ha modificado.

| Hallazgo original | Corrección aplicada | Evidencia de cierre |
|---|---|---|
| Formas SHACL incompletas y desacopladas del contexto | Se amplió `segittur-multidestino-shapes.ttl` con formas para `TourismEvent`, `SimulationScenario`, `SimulationResult`, `DataSource` e `IngestionContract`. Los objetivos `TouristDestination`, `TourismResource` y `TourismEvent` se alinean ahora con `estur:`; las extensiones operativas se mantienen en `pid:`. | Parser RDF: perfil **124 triples**, formas SHACL **183 triples**. Comprobación automatizada de cobertura: 9 clases objetivo requeridas, sin omisiones. |
| Vínculo tenant/destino no impuesto y RLS ausente | La migración introduce `UNIQUE (tenant_id, destino_id)` en el perfil de destino, FKs compuestas desde entidades y contratos, y políticas RLS sobre ambos ámbitos. | Parser SQL PostgreSQL: **21 sentencias válidas**. La migración contiene las dos FKs compuestas y políticas que comparan `app.tenant_id` y `app.destino_id`. |
| Respuestas de error sin JSON-LD/no-store | Se creó `semanticError()` y se aplicó a perfil inexistente, destino inexistente y tipo no soportado. | HTTP: los tres errores devuelven 404/400, `Content-Type: application/ld+json`, `Cache-Control: no-store`, `@context` y `type: SemanticError`. |

## Comprobaciones finales

```text
pnpm build                         PASS
RDF/Turtle parse                   PASS
Cobertura SHACL de 9 clases        PASS
Parse SQL PostgreSQL de migración  PASS
GET artefactos JSON-LD/RDF/SHACL   200
GET perfiles Málaga/Palma          PASS
GET entidades Dataset3D Málaga     PASS
GET error semántico                JSON-LD + no-store
```

## Alcance de la verificación

- La migración se validó sintácticamente, pero no se aplicó contra un PostgreSQL/PostGIS residente en el sandbox porque Docker no está instalado y no había un servidor PostgreSQL configurado. La ejecución real se realiza en el piloto persistente, donde el rol de aplicación debe ejecutar por transacción:

```sql
SET LOCAL app.tenant_id = '<tenant-autorizado>';
SET LOCAL app.destino_id = '<destino-autorizado>';
```

- La clave foránea compuesta impide un cruce estructural de tenant y destino independientemente de RLS. RLS añade aislamiento de lectura y escritura para el rol de aplicación.
- El modo demo valida y normaliza, pero no persiste entidades (`VALIDATED_NOT_PERSISTED`), tal como declara el endpoint. La escritura se habilita únicamente al conectar PostGIS con las políticas RLS de la migración.
