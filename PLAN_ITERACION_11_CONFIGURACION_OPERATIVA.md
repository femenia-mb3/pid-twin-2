# Iteración 11 — Configuración Operativa de Conectores, Datos y Modelos de Simulación

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Fecha:** 9 de octubre de 2026  
**Estado:** En implementación  
**Alcance:** Preparar una plataforma no-code persistente para que cada destino configure fuentes, datasets y modelos propios sin tocar código ni activar integraciones externas no autorizadas.

## 1. Decisión de producto y límites explícitos

La Iteración 11 transforma los contratos y demostradores ya existentes en configuración operativa, versionada y trazable.

> No se conectará ni se presentará como real ninguna fuente externa sin acceso autorizado. Cada integración se declarará como **ACTIVO_VERIFICADO**, **PENDIENTE_CREDENCIALES** o **PLANTILLA_DISPONIBLE**.

No se pedirán secretos por chat ni se guardarán claves, tokens o contraseñas en frontend, logs o tablas funcionales. Los conectores solo conservarán una `secretReference` opaca para una futura configuración segura. La Iteración no ejecutará código, scripts ni binarios proporcionados por usuarios: los paquetes de modelo admitirán exclusivamente reglas declarativas JSON/YAML validadas por esquema.

Los datos de pruebas conservarán la etiqueta de demostración/sintético cuando corresponda y todas las entidades, modelos, conexiones, decisiones y resultados expondrán evidencia verificable: origen, responsable, fecha, calidad, licencia, finalidad, privacidad, estado de autorización, versión y SHA-256 cuando aplique.

## 2. Arquitectura funcional

### 2.1 Configurador no-code de conectores

Se incorporará un asistente **«+ Nuevo conector»** dentro de Interoperabilidad. Permitirá crear, editar y versionar configuraciones de tipo PID S2/NGSI-LD, PID C4/histórico, REST, MQTT, OGC API Features/WMS/WMTS, CSV, GeoJSON, JSON y SHP/ZIP.

Cada definición declarará destino propietario, responsable, carril PID, URL o entrada de archivo, frecuencia, licencia, privacidad, finalidad, retención, campos, cobertura, validaciones, calidad mínima, módulos PID, estado y evidencia. Los conectores configurados sin accesos quedarán expresamente como pendientes de autorización, sin solicitudes de red automáticas.

### 2.2 Cadena de evidencia: dato → conector → variable → modelo

Se añadirá un catálogo de vínculos declarativos entre los campos de dataset y las variables requeridas por un modelo. Cada vínculo conservará transformación declarativa permitida, unidad, frecuencia, regla de calidad, disponibilidad, evidencia de dataset y huella SHA-256. La preparación de un escenario o una ejecución validará que todas las variables obligatorias estén cubiertas por fuentes autorizadas y de calidad suficiente.

### 2.3 `SimulationModelPackage v1`

Se definirá un contrato y esquema AJV para un paquete declarativo JSON/YAML con identidad, versión, destino creador, dominio, variables/rangos, fuentes, conectores, carriles/módulos PID, reglas declarativas permitidas, indicadores, privacidad, licencia y evidencia.

El flujo de carga será: leer archivo → calcular SHA-256 → normalizar JSON/YAML → validar esquema y reglas permitidas → persistir borrador → editar/validar → registrar decisión humana → publicar o archivar. Los estados serán: **BORRADOR**, **VALIDADO**, **PUBLICADO_REUTILIZABLE** y **ARCHIVADO**.

### 2.4 Ingestión y capas del destino

La ingesta no-code consolidará CSV, JSON y GeoJSON, y añadirá ZIP de Shapefile mediante análisis seguro del paquete, comprobación de CRS, validación de geometría y normalización a EPSG:4326. Los datos y sus metadatos se conservarán en PostGIS como datasets versionados y características geoespaciales separadas del contenido de configuración.

La carga nunca activará por sí sola un modelo ni publicará datos: requerirá un vínculo de datos explícito y una decisión humana posterior. Los datasets pasarán al visor solo si su estado de publicación y política lo permiten.

### 2.5 Persistencia y seguridad

La migración **013** incorporará, con RLS forzado por `tenant_id` y `destino_id`:

- definiciones y versiones de conectores;
- datasets, versiones y características geoespaciales ingestadas;
- paquetes de modelo y versiones;
- vínculos `campo-origen → variable-modelo`;
- decisiones append-only de validación/publicación.

El backend extenderá `PostGISRepository` con transacciones en contexto de tenant. JWT institucional y las comprobaciones de destino existentes protegerán todos los endpoints. Las APIs privadas llevarán `Cache-Control: no-store`.

## 3. Experiencia e interfaz

Se preservará el diseño institucional actual: fondo blanco, jerarquía clara, PID/SEGITTUR, tarjetas de evidencia y avisos honestos de estado. La interacción se organizará en:

- **Interoperabilidad / Conectores:** botón «+ Nuevo conector», listado por estado, ficha de configuración, fuente y evidencia.
- **Ingestión de datos:** botón «Subir datos propios», arrastrar y soltar CSV/JSON/GeoJSON/SHP-ZIP, resumen de validación, CRS, cobertura y SHA-256.
- **Catálogo y Diseñador de Simulación:** botón «Subir paquete de modelo», importación real de `SimulationModelPackage v1`, estados de gobierno y revisión humana.
- **Vínculos de datos del modelo:** tabla y diagrama legible de dato → conector → variable → modelo, incluyendo carencias que bloquean ejecución.

La importación de modelos validados al simulador seguirá existiendo. Ejecutar, publicar o compartir continuará requiriendo acción humana explícita.

**Movimiento visual:** consola operacional institucional y auditable.  
**Principios:** claridad antes que ornamentación, procedencia visible, acciones reversibles y estados inequívocos.  
**Color:** blanco y grises técnicos como base; rojo PID para acciones principales; ámbar para pendientes; verde exclusivamente para evidencia verificada.  
**Interacción:** cada paso explica qué se valida, qué no se activa y qué evidencia queda registrada.

## 4. Estructura técnica prevista

```text
src/
  types/
    operationalConfiguration.ts       # Conectores, datasets, vínculos y decisiones
    simulationModelPackage.ts         # Contrato seguro del paquete v1
  services/
    connectorConfigurationService.ts  # Validación y ciclo de vida de conectores
    dataBindingService.ts             # Vínculos y precondiciones de ejecución
    simulationModelPackageService.ts  # JSON/YAML, schema y estados de paquete
    dataIngestionService.ts           # Ingesta persistente CSV/JSON/GeoJSON/SHP-ZIP
    postgisRepository.ts              # Métodos transaccionales RLS
  components/
    ConnectorConfigurationModal.tsx
    DataBindingModal.tsx
    DataIngestionModal.tsx
    SimulationDesignerModal.tsx
schemas/
  simulation-model-package-v1.schema.json
database/migrations/
  013_configuracion_operativa_datos_modelos.sql
scripts/
  validate_iteration11_operational_configuration.sh
```

## 5. Dependencias y despliegue

La aplicación seguirá siendo una SPA React/Vite más API Express en el mismo origen. Las APIs autenticadas, configuraciones, datasets, paquetes y resultados usarán `no-store`; los assets compilados conservarán caché versionada. No se modifica la arquitectura publicada ni se activa una publicación durante esta Iteración.

Para interpretar YAML y Shapefile comprimido se incorporarán librerías de parsing declarativo/geoespacial que no ejecuten código de usuario. Los conectores externos permanecerán en configuración local, sin credenciales ni llamadas remotas hasta recibir autorización.

## 6. Resultado esperado

Al finalizar, un gestor autenticado de Málaga o Palma podrá crear un conector pendiente de credenciales, cargar un dataset propio, importar un paquete seguro de modelo, enlazar datos a variables, validar el cumplimiento de requisitos y promoverlo mediante revisión humana, manteniendo aislamiento tenant, evidencia y persistencia PostGIS.
