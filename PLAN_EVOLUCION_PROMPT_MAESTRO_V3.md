# Evolución del Gemelo Digital Turístico SEGITTUR

**Referencia funcional:** adenda de objetivo multidestino y *Prompt Maestro de Evolución del Gemelo Digital SEGITTUR* recibidos el 8 de octubre de 2026.

## Decisión de producto

El producto no se limita a un visor ni a una biblioteca de escenarios cerrados. Debe permitir que cada destino, dentro de límites de gobierno y calidad, pueda:

1. alimentar el motor con sus datos;
2. definir y versionar escenarios propios;
3. ejecutar simulaciones parametrizadas;
4. comparar **base / escenario / delta** sobre el territorio;
5. consultar predicciones diferenciadas de las simulaciones;
6. guardar evidencia, trazabilidad y resultados;
7. reutilizar de forma gobernada modelos o plantillas de otros destinos.

La meta operativa demostrable es:

> Un destino selecciona una zona, define un escenario propio, ejecuta una simulación, visualiza el resultado geográfico, compara la situación base con el escenario y su delta, y consulta en paralelo una predicción de las próximas horas.

## Estado tras integrar GemeloTur v3

### Capacidades disponibles en el MVP

| Capacidad | Estado actual | Alcance real |
|---|---|---|
| Visor territorial | Implementado | Niveles 2D/2.5D y representación 3D/4D para Málaga; vista alternativa para otros destinos. |
| Capas GIS y KPIs | Implementado | Zonas, recursos, sensores, rutas, mapa de calor y métricas agregadas. |
| Motor de escenario | Implementado como demostración | Reglas y parámetros configurables, con escenarios predefinidos y controles de tiempo, clima, cruceros, aforo y alertas. |
| Comparativa | Implementado como demostración | Actual / escenario / delta en paneles y capas operativas. |
| Predicción | Implementado con datos sintéticos | Serie, intervalo e indicadores de error reproducibles; no es aún un modelo entrenado con históricos reales. |
| Modelo multidestino | Implementado como contrato MVP | Perfiles Málaga y Palma, ontología/NGSI-LD, aislamiento conceptual por destino y catálogo de conectores/modelos. |
| Modelo propio reutilizable | Implementado como contrato MVP | Crear, validar, publicar e instanciar borradores en memoria; pendiente de persistencia y gobierno productivo. |
| Contexto 3D Málaga | Implementado | Catastro, MDT, LiDAR PNOA y Cesium cuando existe WebGL; vista contextual compatible cuando no existe aceleración WebGL. |

### Integración v3 aplicada

La versión v3 aporta mejoras de cartografía, sensores, motor temporal, datos de demostración, presentación de los niveles 3D/4D y una base de Cesium con cartografía IGN. La integración conserva deliberadamente dos mecanismos que v3 no incluía:

- respaldo visual del Nivel 3/4 para equipos sin WebGL, evitando una pantalla en blanco;
- enlace directo de validación mediante `?nivel=2`, `?nivel=3` o `?nivel=4`.

## Entregas incrementales propuestas

### Iteración 1 — Context Package y alta de un nuevo destino

**Objetivo:** eliminar dependencias de un destino concreto y definir la entrada estándar del motor.

- Crear `ContextPackage v1` versionado con perfil de destino, geometrías, fuentes, variables, series temporales, calidad, permisos y mapeos semánticos.
- Validar el paquete antes de incorporarlo: CRS, cobertura, fechas, unidades, completitud, privacidad, procedencia y compatibilidad con el modelo.
- Añadir el asistente de alta de destino: nombre, ámbito, zonas, perfil de capacidad, conectores y capas GIS.
- Persistir perfiles, fuentes, mapeos y versiones en PostGIS.
- Demostrar la carga de un segundo destino sin tocar código de simulación.

**Resultado de aceptación:** un nuevo destino puede aparecer en el selector tras importar y validar un paquete de contexto, conservando aislamiento de sus datos y configuración.

### Iteración 2 — Editor de escenarios por destino

**Objetivo:** dar autonomía al destino sin entregar escenarios rígidos ni requerir cambios de código.

- Crear, editar, duplicar, archivar y versionar escenarios privados del destino.
- Permitir elegir zona, ventana temporal, variables de entrada, distribución espacial, eventos, clima, movilidad, capacidad y reglas del modelo autorizado.
- Validar rangos, unidades, fuentes requeridas y compatibilidad con el perfil del destino.
- Mantener plantillas PID opcionales; ningún destino queda limitado a escenarios predefinidos.
- Añadir estados `BORRADOR`, `VALIDADO`, `EJECUTADO`, `ARCHIVADO` y control de autor/fecha.

**Resultado de aceptación:** un usuario autorizado puede crear un escenario propio, modificar sus parámetros y ejecutarlo sin tocar código.

### Iteración 3 — Flujo de ejecución y salidas normalizadas

**Objetivo:** cerrar el recorrido completo y hacer comparables los resultados de cualquier modelo.

- Flujo único: **definir → validar → ejecutar → visualizar → comparar → guardar → exportar**.
- Registrar `SimulationRun` con versión de modelo, escenario, ContextPackage, entradas, timestamp, usuario, semillas, estado y evidencia.
- Normalizar salidas: indicadores, series temporales, capas GeoJSON/MVT, alertas, recomendaciones, incertidumbre y metadatos de calidad.
- Separar visualmente y por API **BASE**, **ESCENARIO** y **DELTA**.
- Exportar resultados para GIS/API sin mezclar los datos originales con los derivados.

**Resultado de aceptación:** una ejecución guardada puede reproducirse y comparar su delta con la base en el mapa y en KPIs.

### Iteración 4 — Predicción real, calibración y validación

**Objetivo:** convertir la predicción sintética en una capacidad basada en datos observados.

- Ingestar históricos y datos en tiempo real por conector autorizado.
- Entrenar y versionar modelos por destino/dominio cuando haya datos suficientes.
- Entregar predicción T+1/T+4/T+24, intervalos de confianza y calidad de datos.
- Evaluar predicción frente a observado: MAE, MAPE, sesgo, cobertura de intervalos y deriva.
- Distinguir siempre:
  - **Predicción:** qué se espera que ocurra con las condiciones observadas/proyectadas.
  - **Simulación:** qué ocurriría bajo una intervención o hipótesis definida por el destino.

**Resultado de aceptación:** cada predicción conserva su fecha de corte, modelo y comparación automática con el dato real disponible después.

### Iteración 5 — Catálogo gobernado de modelos reutilizables

**Objetivo:** escalar entre destinos sin copiar implementaciones ni perder control local.

- Convertir borradores propios validados en plantillas reutilizables con revisión PID.
- Declarar contrato de entrada/salida, variables, unidades, fuentes mínimas, límites de aplicabilidad y métricas de validación.
- Permitir instalar una plantilla en otro destino, vincular sus fuentes y ajustar únicamente los parámetros declarados.
- Mantener versiones, dependencias, compatibilidad y reversión.

**Resultado de aceptación:** un destino instala un modelo publicado, lo configura con sus fuentes y obtiene salidas normalizadas sin acceso a datos de otro destino.

### Iteración 6 — Asistente de IA controlado

**Objetivo:** facilitar la creación de previsiones y simulaciones en lenguaje natural sin ejecutar acciones opacas.

- Convertir la petición en un borrador de escenario o previsión estructurada.
- Mostrar zona, horizonte, fuentes, parámetros, supuestos, incertidumbre y coste antes de ejecutar.
- Requerir validación humana para ejecutar, compartir o publicar resultados.
- Conservar la conversación como apoyo, no como sustituto del contrato, las reglas de negocio ni la trazabilidad.

**Resultado de aceptación:** un usuario puede pedir una simulación en lenguaje natural y revisar/editar un formulario estructurado antes de su ejecución.

## Principios no negociables

1. **Multidestino real:** ninguna regla, ID, umbral o fuente de Málaga/Sevilla puede estar fijada en el motor común.
2. **Autonomía gobernada:** los destinos pueden crear escenarios y modelos, pero con roles, validación, límites de datos y trazabilidad.
3. **Predicción y simulación no son lo mismo:** se etiquetan, almacenan y validan de forma diferenciada.
4. **Evidencia reproducible:** cada resultado declara entradas, versiones, fecha, calidad, incertidumbre y procedencia.
5. **Interoperabilidad desde el contrato:** ContextPackage, entidades NGSI-LD, PostGIS y salidas geográficas deben poder evolucionar sin acoplar el producto a una fuente concreta.
6. **Degradación segura:** la ausencia de WebGL o de una capa 3D no bloquea el uso operativo del gemelo.

## Próximo corte recomendado

La siguiente implementación debe ser la **Iteración 1: ContextPackage y alta de destino**. Es el prerrequisito que desacopla el producto antes de ampliar el editor de escenarios, los modelos predictivos o la IA.