# PLAN DE IMPLEMENTACIÓN — ITERACIÓN 9
## Diseñador de Simulaciones Autónomo, Catálogo Reutilizable de Modelos e Importación No-Code en la Pestaña Simulación

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 9 de 10  
**Objetivo Principal:** Dotar al destino de autonomía total para diseñar, parametrizar, validar e importar simulaciones sin tocar código, conectando directamente la pestaña **Simulación** con el **Catálogo de Modelos Reutilizables** y el **Editor No-Code**.

---

## 1. Requerimientos del Usuario para la Iteración 9

1. **Evolución de la Pestaña SIMULACIÓN**:
   - Pasar de un conjunto cerrado de presets estáticos a un espacio de trabajo configurable por el operador del destino.
   - Botón destacado **«+ Nueva simulación»** que permita:
     - Diseñar una simulación desde cero en el editor.
     - O explorar el **Catálogo de Modelos Reutilizables de la PID** para elegir e importar una plantilla (cruceros, playas, eventos, patrimonio, movilidad, etc.).
   - Añadir más parámetros operacionales directos:
     - Modos de movilidad: Normal, Restringida, Reforzada.
     - Capacidad operativa del destino (% de personal y servicios activos).
     - Umbral de alerta de saturación configurable en tiempo real.
     - Factor de sensibilidad ambiental y condiciones de confort.
2. **Catálogo de Modelos con Metadatos Multidestino**:
   - Cada modelo del catálogo debe reflejar con claridad:
     - **Destino creador** (quién diseñó la plantilla originalmente).
     - **Destinos que lo utilizan actualmente**.
     - **Conectores y carriles de datos requeridos** (S2, C4, IoT, etc.).
     - **Requisitos de fuentes y variables parametrizables**.
     - **Evidencia verificable y versión**.
3. **Acción «Importar modelo al simulador»**:
   - Al seleccionar un modelo del catálogo y validar sus parámetros y conectores locales, debe existir la opción directa de **«Importar e Instanciar en el Simulador»**.
   - La instancia se traduce automáticamente en un escenario validado que aparece de inmediato en la lista de escenarios de la pestaña **Simulación**, listo para ser ejecutado en el motor.
4. **Diseñador de Modelos Propios**:
   - Capacidad para crear un modelo propio declarativo: título, dominio, fuentes requeridas, variables de cálculo, reglas de impacto y política de privacidad.
   - Posibilidad de subir/arrastrar ficheros de configuración o descripción de modelo (*drag and drop* simulado/asistido con validación de contrato).
5. **Gobernanza y Evidencia Institucional**:
   - Preservar la exigencia de seguridad de la Iteración 8: toda petición autenticada por JWT/Cookie con validación de tenant y registro auditable.
   - Todo modelo e instancia debe incluir trazabilidad de evidencias (`evidenceRef`).

---

## 2. Componentes y Arquitectura de la Solución

1. **Ampliación de Contratos (`src/types/interoperability.ts` y `src/types/scenarioStudio.ts`)**:
   - Incorporar metadatos `creatorDestinationId`, `adoptedByDestinationIds` y `pidModules` en `ReusableModelTemplate`.
   - Soporte para conversión bidireccional entre `ModelInstantiationPreview` y `ScenarioDraftInput` / `ScenarioDefinition`.
2. **Servicio de Catálogo e Instanciación (`src/services/interoperabilityCatalogService.ts`)**:
   - Enriquecer el catálogo con modelos preconfigurados detallados:
     - *Puertos y Cruceros* (Creador: Palma · Utilizado por: Málaga, Palma, Barcelona).
     - *Saturación y Capacidad de Carga* (Creador: SEGITTUR · Utilizado por: Málaga, Palma, Santiago).
     - *Playas y Litoral Inteligente* (Creador: Palma · Utilizado por: Palma, Benidorm, Málaga).
     - *Patrimonio y Flujos Históricos* (Creador: Málaga · Utilizado por: Málaga, Palma, Toledo).
     - *Movilidad y Zonas de Bajas Emisiones* (Creador: Málaga · Utilizado por: Málaga, Palma, Sevilla).
   - Método `importModelToScenario(modelId, input)`: convierte la plantilla parametrizada en un `ScenarioDefinition` operativo registrado en el destino.
3. **Nuevos Endpoints en Servidor (`server.ts`)**:
   - `POST /api/models/reusable/:modelId/import-scenario`: Instancia y registra un escenario en el repositorio para que sea ejecutable en el simulador.
   - `GET /api/models/reusable`: Filtros por dominio, compatibilidad de destino y enriquecimiento con destinos adoptantes.
4. **Nuevo Componente `SimulationDesignerModal.tsx`**:
   - Modal asistido que se abre desde el botón **«+ Nueva Simulación»** en la pestaña Simulación.
   - Dos caminos guiados:
     - **Opción A:** Diseñar simulación personalizada (zonas, horas, afluencia, movilidad).
     - **Opción B:** Explorar el Catálogo PID, ver compatibilidad con el destino actual, parametrizar variables e **Importar al Simulador**.
5. **Enriquecimiento del Panel Lateral en `App.tsx`**:
   - Botón destacado **«+ Nueva Simulación»** junto al selector de escenarios.
   - Badge indicador de procedencia del escenario (Modelo Propio, Plantilla PID Importada, Copiloto IA o Preset Base).
   - Nuevos controles directos de movilidad y capacidad operativa.
6. **Suite Automatizada de Pruebas (`scripts/validate_iteration9_simulation_designer.sh`)**:
   - 8 casos de prueba verificando listado de modelos con creadores/adoptantes, importación al simulador, ejecución del escenario importado, aislamiento de tenant y validación de parámetros.
