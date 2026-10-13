# Estándar ContextPackage v1

## Propósito

`ContextPackage v1` es el contrato de entrada para dar de alta un destino en el Gemelo Digital Turístico PID sin introducir dependencias de un municipio concreto en el motor común.

No representa un escenario ni una predicción. Aporta el **contexto operativo y gobernado** sobre el que las iteraciones posteriores crearán escenarios, simulaciones y modelos predictivos.

## Artefactos canónicos

| Artefacto | Ruta |
|---|---|
| JSON Schema Draft 2020-12 | `/context-packages/context-package-v1.schema.json` |
| Paquete de ejemplo sintético | `/context-packages/context-package-v1-destino-demostrador.json` |
| Contratos TypeScript | `src/types/contextPackage.ts` |
| Validador de referencia | `src/services/contextPackageService.ts` |
| Migración PostGIS | `database/migrations/005_context_packages.sql` |

## Estructura mínima

```json
{
  "type": "ContextPackage",
  "schemaVersion": "1.0.0",
  "id": "context-mi-destino-v1",
  "tenant": { "id": "tenant-mi-destino", "legalName": "Entidad responsable", "dataPolicy": "MIXTA" },
  "destination": { "id": "mi-destino", "codigoIne": "00000", "centro": [40.4, -3.7] },
  "context": {
    "crs": "EPSG:4326",
    "modelProfile": { "capacityProfile": { "alertThresholdPct": 85, "theoreticalCapacity": 10000 } },
    "dataSources": [],
    "variables": [],
    "zones": [],
    "resources": [],
    "sensors": []
  },
  "semanticMapping": { "contextUrl": "/ontology/segittur-pid-context-v1.jsonld" },
  "evidence": { "license": "...", "provenance": "..." }
}
```

El archivo real debe completar todos los campos exigidos por el esquema publicado. Las coordenadas se expresan siempre como `[latitud, longitud]` en **EPSG:4326**; en las salidas GeoJSON se convierten a `[longitud, latitud]`.

## Contenido obligatorio

1. **Identidad y versión:** tipo, versión, identificador único, título, finalidad y fecha de creación.
2. **Tenant y destino:** entidad responsable, política de datos, código INE, centro, capacidad y descripción.
3. **Perfil operacional:** CRS, zona horaria, locale, dominios, nivel cartográfico y perfil de capacidad.
4. **Entidades:** mínimo una zona; recursos y sensores son opcionales, aunque recomendables.
5. **Fuentes:** carril de interoperabilidad, formato, frecuencia, calidad, privacidad, autorización, finalidad y trazabilidad.
6. **Variables:** unidad, origen, tipo de entidad y regla de calidad.
7. **Semántica:** contexto JSON-LD, perfil ontológico, namespace NGSI-LD y mapeo de entidades.
8. **Evidencia:** licencia, cobertura, fecha de corte y procedencia; los datos sintéticos se deben etiquetar explícitamente.

## Reglas de aceptación

El validador rechaza:

- otra versión de esquema o tipo de paquete;
- ID de destino ya existente;
- CRS distinto de `EPSG:4326`;
- geometrías o coordenadas inválidas;
- zona inexistente, capacidad no positiva o entidades asociadas a otro destino;
- fuentes sin trazabilidad, formatos no admitidos o autorización `NO_AUTORIZADO`;
- variables sin unidad u origen declarado;
- ausencia de mapeo semántico o evidencia de procedencia.

El validador admite con advertencia las fuentes `PENDIENTE`, calidad estimada/en validación y los datos sintéticos. Estas advertencias deben resolverse antes de utilizar el dato para una predicción real o una decisión operativa.

## API de onboarding

| Operación | Endpoint | Resultado |
|---|---|---|
| Consultar contrato | `GET /api/context-packages/schema` | Esquema y URL pública. |
| Consultar ejemplos | `GET /api/context-packages/examples` | Catálogo de paquetes demostradores. |
| Prevalidar | `POST /api/context-packages/validate` | Errores, advertencias y resumen sin incorporar datos. |
| Importar demo | `POST /api/context-packages/import` | Paquete validado, alta temporal y destino disponible. |
| Consultar altas activas | `GET /api/context-packages/destinations` | Destinos incorporados en la sesión. |

En la demo la importación devuelve `MEMORY_DEMO_NOT_PERSISTED`. No se debe afirmar que el paquete sea durable hasta que el piloto ejecute la migración 005 sobre PostGIS y active el flujo transaccional con autenticación y RLS. El selector de la SPA mantiene la alta mientras la sesión de interfaz continúa: una recarga completa de la página exige volver a cargar el paquete, aunque el proceso API aún no se haya reiniciado.

## Flujo de un destino

1. Preparar el JSON a partir del esquema y adjuntar fuentes autorizadas.
2. Ejecutar la prevalidación y corregir todos los errores.
3. Revisar advertencias de calidad, privacidad y autorización.
4. Importar el paquete: aparece en el selector y alimenta las capas 2D y el motor base.
5. Para producción, persistir el paquete y sus dependencias mediante la migración 005 dentro de una transacción tenant/destino.
6. En la Iteración 2, configurar escenarios propios usando este contexto validado.

## Límites de esta iteración

- No crea ni ejecuta escenarios personalizados: esto corresponde al editor de escenarios de la Iteración 2.
- No entrena modelos predictivos: las variables se declaran ahora para poder construir esa capacidad con históricos validados.
- No conecta credenciales ni fuentes municipales reales: el paquete solo declara sus contratos y gobierno.
- No materializa todavía entidades NGSI-LD en el registro semántico: valida las referencias y reserva ese paso para la ingestión persistente con PostGIS/NGSI-LD.
