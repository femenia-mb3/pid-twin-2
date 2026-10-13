# INFORME TÉCNICO — ITERACIÓN 9
## Diseñador de Simulaciones Autónomo, Catálogo Reutilizable de Modelos e Importación No-Code en la Pestaña Simulación

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 9 de 10  
**Fecha:** 8 de octubre de 2026  
**Estado:** Implementado, Validado y Verificado mediante Pruebas Automatizadas (8/8 superadas).

---

## 1. Resumen Ejecutivo de la Iteración 9

La **Iteración 9** transforma la pestaña **Simulación** del Gemelo Digital Turístico de un visor con presets estáticos en un **espacio de trabajo completamente interactivo y autónomo para el gestor del destino**. 

Siguiendo las directrices acordadas, se ha cerrado la brecha entre la definición teórica de modelos y su operatividad en el motor de simulación mediante tres capacidades principales:

1. **Botón destacado «+ Nueva simulación» en la Pestaña Simulación**:
   - Da acceso directo al modal asistido `SimulationDesignerModal.tsx`.
   - Permite elegir entre diseñar un escenario a medida con el editor no-code o explorar el Catálogo Reutilizable de Modelos de la PID.
2. **Catálogo de Modelos con Metadatos Multidestino Completos**:
   - Cada plantilla refleja ahora explícitamente:
     - **Destino Creador**: Quién diseñó la plantilla originalmente (ej. *Ajuntament de Palma* para cruceros y litoral, *Ayuntamiento de Málaga* para patrimonio y ZBE, *SEGITTUR* para modelos transversales de capacidad de carga).
     - **Destinos Adoptantes**: Qué otros destinos de la red PID tienen activo dicho modelo.
     - **Módulos PID Requeridos**: Relación directa con los módulos estándar de la PID (`S2`, `C4`, `S11`, `S18`, `S7`, etc.).
     - **Variables Parametrizables**: Umbrales de alerta, tiempos de dispersión, tasas de desembarco, etc.
3. **Flujo Directo «Importar al Simulador»**:
   - Con un solo clic, la plantilla seleccionada se parametriza con el contexto del destino y se convierte en un escenario ejecutable registrado en el backend (`POST /api/models/reusable/:modelId/import-scenario`).
   - El escenario pasa inmediatamente a estar disponible en el selector de la pestaña Simulación y puede ejecutarse calculando la comparativa **BASE / ESCENARIO / DELTA**.
4. **Espacio de Carga Asistida (Drag & Drop)**:
   - Capacidad en interfaz para arrastrar archivos locales de definición de modelos (.json/.yaml) verificando su contrato antes de abrir el editor.

---

## 2. Arquitectura y Contratos de Datos

### 2.1. Metadatos Multidestino en `ReusableModelTemplate` (`src/types/interoperability.ts`)
```typescript
export interface ReusableModelTemplate {
  id: string;
  version: string;
  title: string;
  domain: string;
  publication: ModelPublication;
  lifecycle: ModelLifecycle;
  creatorDestinationName?: string;
  adoptedByDestinationIds?: string[];
  pidModulesRequired?: Array<'S1' | 'S2' | 'C4' | 'S7' | 'S11' | 'S15' | 'S16' | 'S17' | 'S18'>;
  summary: string;
  requiredLanes: DataLane[];
  variables: ModelVariableDefinition[];
  sourceRequirements: string[];
  ruleSummary: string;
  privacyRule: string;
  evidence: EvidenceRef;
}
```

### 2.2. Nuevo Endpoint de Importación Directa en `server.ts`
- **Ruta:** `POST /api/models/reusable/:modelId/import-scenario?destino={destinoId}`
- **Seguridad:** Requiere obligatoriamente autenticación JWT institucional (o cookie de sesión `webdev_app_session`) y cabecera `X-PID-Tenant`. Los operadores de un destino no pueden importar modelos en un destino ajeno (HTTP 403 Forbidden).
- **Proceso:** Traduce los parámetros del modelo en un `ScenarioDraftInput` compatible con la ontología SEGITTUR, valida los IDs de zonas y registra el escenario en `ScenarioStudioService`.

---

## 3. Resultados de la Suite Automatizada de Pruebas

La suite reproducible `./scripts/validate_iteration9_simulation_designer.sh` ha validado los 8 casos de prueba con éxito:

| Test | Caso de Prueba | Resultado | Detalle |
| :--- | :--- | :---: | :--- |
| **TEST 1** | Autenticación institucional JWT de operador | **PASS** | Token emitido para `carlos.dominguez@malaga.es` (tenant Málaga). |
| **TEST 2** | Catálogo con creadores y adoptantes | **PASS** | 10 modelos verificados. Modelo cruceros: Creador *Palma*, Adoptantes *Palma, Málaga*, Módulos PID *C4, S11, S18*. |
| **TEST 3** | Importar modelo como escenario ejecutable | **PASS** | `modelo_puertos_cruceros` importado como `esc-malaga-...` con movilidad `REFORZADA`. |
| **TEST 4** | Validación técnica del escenario importado | **PASS** | Reporte `valid: true` para el motor de simulación. |
| **TEST 5** | Ejecución de simulación BASE / ESCENARIO / DELTA | **PASS** | Base: 37.700 visitantes (56,3% sat.) → Escenario: 59.966 visitantes (89,5% sat.) → Delta: **+22.266 visitantes**. |
| **TEST 6** | Aislamiento territorial de importación | **PASS** | Intento de importar en Palma con credenciales de Málaga rechazado con **403 Forbidden**. |
| **TEST 7** | Rechazo sin autenticación previa | **PASS** | Petición anónima rechazada con **401 Unauthorized**. |
| **TEST 8** | Integración del escenario en el listado del simulador | **PASS** | El escenario importado aparece inmediatamente en `GET /api/scenarios`. |

---

## 4. Archivos Creados y Modificados en la Iteración 9

1. **`PLAN_ITERACION_9_SIMULACION_CATALOGO.md`**: Plan de trabajo detallado de la iteración.
2. **`src/types/interoperability.ts`**: Campos de destino creador, adoptantes y módulos PID.
3. **`src/services/interoperabilityCatalogService.ts`**: Enriquecimiento del catálogo con 10 modelos detallados y método `modelToScenarioDraft()`.
4. **`server.ts`**: Endpoint seguro `POST /api/models/reusable/:modelId/import-scenario`.
5. **`src/components/SimulationDesignerModal.tsx`**: Componente modal reactivo con catálogo, metadatos multidestino, parametrización, drag & drop e importación directa.
6. **`src/App.tsx`**: Botón destacado **«+ Nueva simulación»** en la pestaña Simulación y montaje del modal.
7. **`scripts/validate_iteration9_simulation_designer.sh`**: Suite de validación de 8 casos de prueba.
8. **`ITERACION_9_SIMULACION_CATALOGO.md`**: El presente informe técnico de entrega.
