# Capa de Interoperabilidad y Catálogo de Modelos Reutilizables PID

## Propósito

El **Gemelo Digital Turístico** se configura como un módulo transversal de la Plataforma Inteligente de Destinos (PID). Su valor no se limita al visor 2D/3D: organiza datos heterogéneos por destino, conserva su evidencia y permite que un mismo motor de contexto y simulación use modelos configurables y reutilizables.

> Esta entrega implementa contratos, catálogos, APIs y una interfaz demostradora. No establece una conexión efectiva con S1, S2, C4, S7, S11, S15, S16, S17 o S18; esa activación exige contratos de servicio, autorización técnica, credenciales y evaluación de privacidad de la PID y de cada destino.

## Arquitectura funcional

```text
Fuentes PID + fuentes nacionales + fuentes propias del destino
                         │
                         ▼
Capa de integración, normalización e interoperabilidad
          ┌──────────────┴──────────────┐
          ▼                             ▼
Carril ontológico               Carril no ontológico / histórico
S2, S1, recursos, activos       C4, APIs locales, CSV, MQTT, ocupación,
NGSI-LD, GeoJSON semántico       movilidad, aparcamientos, comercio
          └──────────────┬──────────────┘
                         ▼
Modelo semántico y geoespacial del destino
                         ▼
Motor común de contexto y simulación
                         ▼
Modelos preconfigurados + propios + reutilizables
                         ▼
S11 / S18 / visor geoespacial / APIs / dashboards
```

Los tres niveles cartográficos se mantienen sin cambios:

1. **Nivel 1 — Base 2D/2.5D:** cartografía abierta y capas contextuales.
2. **Nivel 2 — Edificios + MDT/MDS:** mayor detalle territorial cuando estén disponibles los activos.
3. **Nivel 3 — 3D Tiles/LiDAR/Fotogrametría:** representación avanzada basada en datasets validados por destino.

## Los dos carriles de datos

| Carril | Contenido | Proceso obligatorio | Resultado |
|---|---|---|---|
| **Ontológico** | S2, S1, recursos, activos y datos ya normalizados | Validación JSON-LD/NGSI-LD, mapeo SEGITTUR/PID, relación con destino, control de calidad y trazabilidad | Entidades semánticas para S11, S18, APIs y visor |
| **No ontológico / histórico** | C4, APIs municipales, CSV, MQTT, ocupación, movilidad, aparcamientos, playas y comercio | Validación del esquema de origen, periodo, unidad, frecuencia, metadatos, agregación/anonimización y mapeo progresivo | Series y datasets trazables, sin perder el esquema original |

Un dato no ontológico **no se descarta ni se fuerza artificialmente** a una clase semántica. Primero se conserva con su procedencia y calidad; después se mapea al contexto solo si el contrato y la finalidad lo justifican.

## Conectores implementados en la demostración

Los conectores se consultan con `GET /api/interoperability/connectors?destino=<id>`. Cada registro incluye carril, formato, pasos de transformación, calidad, frecuencia, privacidad, estado y enlace de evidencia.

| Destino | Conector demostrador | Carril | Estado |
|---|---|---|---|
| Málaga | S2 · Recursos y activos turísticos | Ontológico | Contrato configurado |
| Málaga | C4 · Histórico de afluencia y ocupación | No ontológico/histórico | Contrato configurado |
| Málaga | IoT Calle Larios · Aforos y confort | No ontológico/histórico | Piloto validado |
| Málaga | GIS municipal/OGC · Zonas operativas | Ontológico | Contrato configurado |
| Palma | S2 · Activos y recursos turísticos | Ontológico | Contrato configurado |
| Palma | C4 · Histórico de cruceros y flujos | No ontológico/histórico | Contrato configurado |
| Palma | Agenda municipal · Eventos | No ontológico/histórico | Pendiente de autorización |
| Palma | Playas y calidad ambiental · GeoJSON | Ontológico | Pendiente de autorización |

Los estados son deliberadamente explícitos: **un contrato configurado no equivale a una conexión activa**. El MVP no simula acceso externo ni usa credenciales falsas.

## Relación con capacidades PID

| Servicio | Papel explícito en el gemelo | Condición de activación |
|---|---|---|
| **S2** | Incorporación/armonización de datos ontológicos | Contexto y contrato semántico compatibles |
| **C4** | Entrada de históricos y fuentes no ontológicas | Esquema fuente, calidad, periodo y finalidad declarados |
| **S11** | Explotación territorial y geoespacial | Geometrías, CRS, licencia y política de difusión válidos |
| **S18** | Explotación, previsión y simulación | Variables, reglas, evidencia y restricciones de uso declaradas |
| **S15/S16/S17/S1/S7** | Fuentes complementarias de comportamiento, percepción, empresas, activos o interacción | Autorización, minimización, privacidad, retención y calidad revisadas |

## Catálogo de modelos reutilizables

Un modelo se publica en el catálogo solo cuando separa claramente: **plantilla común**, **variables parametrizables**, **fuentes mínimas**, **reglas**, **evidencia** y **política de datos**. La plantilla nunca porta los datos de un municipio.

El catálogo dispone de estas plantillas iniciales:

| Plantilla | Dominio | Fuentes mínimas |
|---|---|---|
| Saturación turística | Capacidad de carga | zonas, afluencia/conteos y recursos |
| Playas | Litoral | geometrías, ocupación y meteorología/calidad |
| Eventos | Espacio público | agenda, zonas y movilidad/afluencia |
| Movilidad | Accesibilidad | conteos, red viaria y POIs |
| Patrimonio | Activos culturales | recursos, accesos, aforo o sensores |
| Puertos y cruceros | Flujos portuarios | escalas, desembarcos y rutas |
| Nieve | Montaña | condición de nieve, aforo y accesos |
| Espacios naturales | Senderos | zonas protegidas, itinerarios y conteos/reservas |
| Enoturismo | Turismo enológico | bodegas, reservas y eventos estacionales |
| Cicloturismo | Rutas activas | red ciclista, POIs y meteorología/movilidad |

### Ciclo de reutilización

```text
Modelo propio de un destino
  → variables y reglas parametrizadas
  → calidad, evidencia y política revisadas
  → plantilla publicada como reutilizable
  → otro destino vincula sus conectores y parámetros
  → instancia local validada
  → activación persistente tras autorización y QA
```

En el MVP se puede ejecutar el ciclo completo de demostración:

1. `POST /api/models/own` crea un **borrador propio** vinculado al destino propietario, con dominio, fuentes mínimas, variables tipadas, reglas y política de privacidad.
2. `POST /api/models/:id/publish` comprueba que el destino solicitante es el propietario del borrador y lo transforma en `REUTILIZABLE_PID` con estado `PUBLICADO`.
3. Otro destino recibe la plantilla publicada en `GET /api/models/reusable?destino=<id>` y la puede instanciar con sus conectores autorizados y sus propios parámetros.
4. `POST /api/models/reusable/:id/instantiate` valida el modelo, destino, carriles, conectores, claves de parámetros, tipos, valores obligatorios, listas permitidas y rangos configurados. Devuelve `VALIDATED_NOT_PERSISTED`: es una prueba de contrato sin escritura hasta que el piloto PostGIS esté conectado.

Los borradores y publicaciones de la demo se almacenan **solo en memoria del proceso** y se reinician al reiniciar el servidor. En el piloto persistente, estas acciones escriben las tablas PostGIS con un rol autorizado y trazabilidad de la revisión.

## Persistencia y aislamiento

La migración [`004_interoperabilidad_modelos.sql`](database/migrations/004_interoperabilidad_modelos.sql) crea:

- `fuentes_interoperabilidad_destino`: contratos de fuente por tenant/destino.
- `catalogo_modelos_reutilizables`: plantillas compartidas, versionadas y sin datos municipales.
- `instancias_modelo_destino`: parámetros y estado de cada uso local.
- `instancias_modelo_fuentes`: tabla puente con clave foránea compuesta para que cada conector vinculado exista y pertenezca al mismo tenant/destino de la instancia.

Las fuentes y las instancias usan clave foránea compuesta hacia el perfil de destino y políticas RLS basadas en `app.tenant_id` y `app.destino_id`. Antes de cualquier operación persistente, el rol de aplicación debe ejecutar:

```sql
SET LOCAL app.tenant_id = '<tenant-autorizado>';
SET LOCAL app.destino_id = '<destino-autorizado>';
```

## APIs y caché

| Endpoint | Función | Caché |
|---|---|---|
| `GET /api/interoperability/architecture` | Flujo, carriles y relación con servicios PID | `no-store` |
| `GET /api/interoperability/connectors?destino=malaga` | Contratos de conectores del destino | `no-store` |
| `GET /api/interoperability/connectors/:id` | Evidencia de un conector | `no-store` |
| `GET /api/models/reusable?destino=palma` | Catálogo de plantillas reutilizables | `no-store` |
| `GET /api/models/reusable/:id` | Ficha de plantilla y requisitos | `no-store` |
| `POST /api/models/own` | Crea y valida un borrador propio aislado por destino | `no-store`; en memoria en demo |
| `POST /api/models/:id/publish` | Publica un borrador propio tras comprobar su propiedad | `no-store`; en memoria en demo |
| `GET /api/models/own/:id?destino=...` | Consulta un borrador propio desde su destino propietario | `no-store` |
| `POST /api/models/reusable/:id/instantiate` | Validación de una instancia local | `no-store`; no persiste en demo |

Las APIs usan rutas relativas y no muestran secretos ni credenciales. Los enlaces de evidencia llevan siempre a un contrato consultable, a un endpoint del gemelo o a una fuente declarada.

## Activación de fuentes reales

Para activar una fuente real en producción se requiere, como mínimo:

1. Inventario de datos, responsable, licencia, frecuencia y ámbito geográfico.
2. Contrato de intercambio y método de autenticación gestionado como secreto, nunca en código o CSV.
3. Evaluación de finalidad, proporcionalidad, anonimización y retención si afecta a personas, empresas o comportamiento.
4. Mapeo al contexto JSON-LD cuando proceda; para históricos no ontológicos, conservar el esquema fuente y la trazabilidad.
5. Prueba de calidad y de aislamiento por tenant/destino antes de activar la sincronización.
6. Selección de mecanismo de actualización: evento/webhook cuando exista, o proceso periódico gestionado cuando no exista. La frecuencia y el alojamiento se decidirán con los contratos reales de cada proveedor.

## Conclusión

El Gemelo queda posicionado como una capacidad transversal de la PID: **reutiliza datos y servicios existentes, gobierna la heterogeneidad de cada destino y escala mediante plantillas configurables**, sin convertir la representación cartográfica en un requisito de entrada ni perder la identidad, las políticas y los datos locales de cada municipio.
