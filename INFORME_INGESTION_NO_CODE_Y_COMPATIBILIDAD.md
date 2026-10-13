# INFORME TÉCNICO OPERATIVO
## Ingestión No-Code de Datos Propios y Matriz de Compatibilidad Multidestino

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Fecha:** Octubre 2026  
**Estado:** Implementado, Validado y Operativo

---

## 1. Resumen Ejecutivo

Para dar cumplimiento a los requerimientos clave de SEGITTUR y permitir que cualquier destino español pueda operar su Gemelo Digital sin depender de desarrolladores ni de simulaciones estáticas prefabricadas, se ha implementado y puesto en marcha:
1. **Asistente No-Code de Ingestión de Datos Propios**: Capacidad de subir archivos CSV, GeoJSON y JSON mediante interfaz de arrastrar y soltar (drag & drop), con validación estructural automática y mapeo directo hacia los dos carriles oficiales de la Plataforma Inteligente de Destinos (PID):
   - **Carril S2 (Ontológico)**: Puntos de interés, monumentos, miradores y playas con generación automática de URNs normalizadas (`urn:ngsi-ld:TourismResource:...`), georreferenciación y cálculo de aforos teóricos.
   - **Carril C4 (Histórico/Telemetría)**: Series temporales de conteo de visitantes por aforador peatonal, sensores IoT o cámaras con sello de calidad y trazabilidad.
2. **Auditoría e Integridad Criptográfica**: Cada lote de datos ingestados recibe una huella SHA-256 única y queda registrado en el historial inmutable de ingestas del destino (`GET /api/ingestion/history`).
3. **Aislamiento Multi-Tenant Endurecido**: Se comprueba criptográficamente que ningún operador institucional de un destino pueda inyectar datos en otro destino no autorizado (rechazo `403 Forbidden`).
4. **Matriz Algorítmica de Compatibilidad Multidestino**: Nuevo analizador que evalúa si dos o más destinos disponen de la madurez de datos suficiente (S2 ontológico, C4 histórico y S11 territorial) para compartir y ejecutar un mismo modelo de simulación de forma homogénea.

---

## 2. Componentes y Contratos Implementados

### 2.1 Backend y Endpoints de API

- `POST /api/ingestion/datasets`: Ingestión transaccional y validación de datasets propios en formato CSV o GeoJSON. Requiere autenticación Bearer y coincidencia de claims con el tenant solicitado.
- `GET /api/ingestion/history?destino={id}`: Historial completo de lotes ingestados con huella SHA-256, recuento de registros válidos y estado de aplicación al runtime.
- `POST /api/multidestino/compatibility-matrix`: Evaluación algorítmica de viabilidad interterritorial para modelos de simulación compartidos (`overallCrossDestinationFeasibility: ALTA | MEDIA | BAJA`).

### 2.2 Frontend e Interfaz Visual

- `DataIngestionModal.tsx`: Asistente modal accesible desde la cabecera («Ingestión No-Code») con selector de carril PID, selector de formato, carga arrastrar-soltar, visor de previsualización de datos brutos y botón de carga de plantillas de ejemplo.
- `MultiDestinationModal.tsx`: Renovado con selector de pestañas:
  - *Perfiles y Ontología NGSI-LD*: Contratos semánticos y evidencia de estándares.
  - *Matriz de Compatibilidad de Modelos*: Selector de modelo, cálculo de índice porcentual de compatibilidad por destino (`%`), nivel de preparación operativa y recomendaciones técnicas interterritoriales.

---

## 3. Resultados de la Suite Automatizada de Validación

Ejecución de `scripts/validate_data_ingestion_and_compatibility.sh`:

| Caso de Prueba | Descripción | Resultado |
|---|---|---|
| **TEST 1** | Autenticación de operador institucional vía API Key | **OK (Token emitido)** |
| **TEST 2** | Ingesta no-code CSV en Carril S2 (3 recursos ontológicos) | **OK (APPLIED, SHA-256 generado)** |
| **TEST 3** | Ingesta no-code CSV en Carril C4 (telemetría y aforos) | **OK (APPLIED, 2 series)** |
| **TEST 4** | Consulta de historial de ingestas auditado | **OK (Total lotes >= 2)** |
| **TEST 5** | Comprobación de aislamiento: rechazo de token de Málaga en Palma | **OK (403 Forbidden)** |
| **TEST 6** | Evaluación de matriz multidestino para 'modelo_saturacion_turistica' | **OK (Factibilidad ALTA)** |
| **TEST 7** | Desglose de score por destino (Málaga 100% / Palma 100%) | **OK (Checks superados)** |
| **TEST 8** | Validación de entrada con array de destinos vacío | **OK (400 Bad Request)** |

---

## 4. Conclusión

El Gemelo Digital Turístico PID cuenta ahora con la capacidad real para que los ayuntamientos y destinos turísticos suban su propia información sin escribir código, verifiquen la compatibilidad antes de compartir simulaciones con otros municipios, y mantengan una trazabilidad estricta y auditable en todo momento.
