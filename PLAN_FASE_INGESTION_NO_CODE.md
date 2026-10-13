# PLAN MAESTRO — FASE OPERATIVA
## Ingestión No-Code de Datos, Compatibilidad Multidestino y Carga Asistida de Modelos

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Objetivo:** Extender la plataforma para que los destinos puedan alimentar y gobernar sus propios datos reales y modelos de simulación de forma autónoma (sin programar), integrando:
1. **Ingestión No-Code de Datos**: Subida por arrastrar y soltar (Drag & Drop) de archivos CSV, GeoJSON y JSON con mapeo visual hacia entidades ontológicas S2 (activos turísticos) y series históricas C4 (aforos/sensores).
2. **Trazabilidad y Calidad de Fuente en la Pestaña Conectores**: Auditoría visual de qué dato exacto se utiliza, procedencia, URN, frecuencia, calidad, nivel de privacidad y módulo PID asociado.
3. **Módulo de Compatibilidad Multidestino**: Comparador algorítmico de compatibilidad entre destinos para determinar si pueden compartir y ejecutar modelos comunes bajo los mismos requerimientos de datos.
4. **Carga y Verificación Asistida de Modelos de Cálculo**: Importación estructurada de ficheros de modelos con análisis de dependencias PID y validación de variables.

---

## 1. Módulos y Arquitectura

### Módulo A: Asistente de Ingestión No-Code (`src/services/dataIngestionService.ts` & `DataIngestionModal.tsx`)
- Permite subir archivos locales en formatos estándar:
  - **CSV / GeoJSON de Activos y Recursos Turísticos (S2)**: Parsea registros, verifica columnas obligatorias (`nombre`, `categoria`, `latitud`/`longitud`, `aforoMaximo`), asigna identificador ontológico `urn:ngsi-ld:TourismResource:...` y los inyecta en el runtime del destino.
  - **CSV / JSON de Telemetría y Aforos Históricos (C4)**: Valida `sensorId`, `timestamp`, `valor`, `unidad` y rango de calidad.
- Asigna huella de integridad SHA-256, fecha de ingesta y metadatos de gobernanza.
- Endpoints en backend:
  - `POST /api/ingestion/datasets`: Procesa e incorpora datos ontológicos/históricos validados al runtime del destino.
  - `GET /api/ingestion/history?destino={id}`: Historial inmutable de ingestas del destino.

### Módulo B: Transparencia y Detalle de Conectores (`InteroperabilityModal.tsx`)
- Vista detallada por conector:
  - **Dato Utilizado**: Variables específicas extraídas de la fuente.
  - **Origen del Dato**: Endpoint municipal, cola MQTT o carril PID.
  - **Módulos PID Relacionados**: Vínculos directos con S1, S2, C4, S11, S18.
  - **Frecuencia y Nivel de Privacidad**.

### Módulo C: Analizador de Compatibilidad Multidestino (`src/services/multiDestinationCompatibilityService.ts` & `MultiDestinationModal.tsx`)
- Evalúa la viabilidad de compartir un modelo entre dos o más destinos:
  - Verifica si ambos destinos disponen de las fuentes requeridas por el modelo (ej. ¿Tiene Palma datos de cruceros y Málaga datos de ZBE?).
  - Calcula un **Índice de Compatibilidad (%)** desglosado en:
    - Compatibilidad de carriles ontológicos (S2/recursos).
    - Compatibilidad de series históricas (C4/sensores).
    - Compatibilidad de zonificación territorial (S11).
  - Emite informe técnico con requisitos faltantes y plan de adaptación sugerido.
- Endpoint en backend:
  - `POST /api/multidestino/compatibility-matrix`: Matriz de compatibilidad entre destinos seleccionados para un modelo concreto.

---

## 2. Plan de Implementación Paso a Paso

1. **Tipos de Datos y Contratos** (`src/types/dataIngestion.ts` & `src/types/compatibility.ts`).
2. **Servicio de Ingestión y Mapeo** (`src/services/dataIngestionService.ts`).
3. **Servicio de Matriz de Compatibilidad Multidestino** (`src/services/multiDestinationCompatibilityService.ts`).
4. **Endpoints en el Servidor (`server.ts`)** con control de roles y aislamiento por tenant.
5. **Componente de Ingestión No-Code (`src/components/DataIngestionModal.tsx`)**.
6. **Ampliación de `MultiDestinationModal.tsx`** con el analizador de compatibilidad de modelos.
7. **Integración en `App.tsx`**: Botón de acceso «Ingestión de Datos» y enlaces directos.
8. **Suite Automatizada de Pruebas** (`scripts/validate_data_ingestion_and_compatibility.sh`).
9. **Compilación, Despliegue y Verificación Final**.
