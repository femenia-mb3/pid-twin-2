# Alineamiento del Gemelo Digital Turístico con el expediente PID 53/2023

> **Documento rector de contexto:** [Pliego de Prescripciones Técnicas — Expediente 53/2023](</home/ubuntu/upload/DOC20231204085151PPT+Expediente+532023.pdf>) — *Servicios de soporte para la implantación, consolidación y operación del Nodo Central de la Plataforma Inteligente de Destinos (PID)*.
>
> **Uso de esta nota:** mantener el desarrollo del Gemelo alineado con la arquitectura y los requisitos de la PID. No certifica conformidad contractual ni sustituye las validaciones, accesos, decisiones de SEGITTUR o integraciones reales que correspondan al piloto.

## 1. Lectura de referencia

El Gemelo Digital Turístico no debe presentarse como un visor aislado ni como una aplicación paralela a la PID. Dentro del expediente, debe entenderse como un **servicio común transversal y configurable por destino**, construido sobre la Plataforma de Conocimiento y conectado de forma gobernada con los servicios y capas del Nodo Central.

El encaje principal es:

| Elemento PID | Papel en el expediente | Encaje esperado del Gemelo |
|---|---|---|
| **S18 — Explotación de Datos, Previsión y Simulación** | Interfaz para proporcionar inputs al motor de análisis de C4, configurar parámetros, seleccionar capas/tablas y visualizar resultados mediante cuadros, gráficos, tablas y mapas. | Es el **marco funcional principal** del editor de escenarios, predicción, simulación, BASE/ESCENARIO/DELTA, optimización y resultados territoriales. |
| **C4 — Plataforma de Conocimiento** | El expediente indica que el motor de análisis se sitúa en C4; puede usar datos internos PID y fuentes externas autorizadas. | Debe ser el **motor institucional de ejecución/analítica** cuando exista acceso. El motor actual del MVP es una implementación demostradora y debe actuar como adaptador compatible, nunca como sustitución silenciosa de C4. |
| **S2 — CMS Semántico** | Fuente y gestor de contenidos/taxonomía semántica conforme a la ontología turística PID. | Aporta recursos, activos, POI, eventos y atributos semánticos como fuentes gobernadas de modelos y visualización. |
| **S11 — Inteligencia de Localizaciones** | Capacidades geoespaciales e integración de información espacial. | Encaja con la cartografía 2D/2.5D/3D/4D, consultas geográficas, capas OGC, rutas, capacidad territorial y visualización de resultados. |
| **Capa de Interoperabilidad** | Intercambio bidireccional, seguro, normalizado y API-first entre módulos PID, destinos, empresas y terceros. | Es la capa por la que deben entrar/salir conectores, ContextPackages, datasets, modelos, resultados y evidencias. |

## 2. Requisitos del pliego que gobiernan el diseño

### 2.1 S18: previsión y simulación

La sección **7.20** (págs. 287–290 del documento) exige que el módulo:

- unifique fuentes internas y externas del destino;
- permita a perfiles no analistas utilizar el dato de forma intuitiva;
- use una interfaz gráfica para definir entradas, parámetros y capas/tablas de análisis;
- visualice resultados mediante paneles, tablas, gráficos y mapas cuando exista componente espacial;
- permita analizar afluencia, flujos de visitantes, gasto, indicadores, alertas y acciones correctivas;
- soporte prognosis, escenarios turísticos y modelos predictivos.

**Decisión de producto:** la pestaña **Simulación** debe continuar evolucionando como el front configurable de S18: no escenarios precargados opacos, sino selección de datos, modelos, variables, parámetros, hipótesis, evidencias y aprobación humana antes de cada ejecución.

### 2.2 Gemelo Digital

La sección **8.3.2.2** (pág. 323) requiere:

- modelado de **datos** y de **procesos**;
- integración de diversas fuentes y APIs en tiempo real;
- una interfaz que permita simular escenarios y analizar comportamiento;
- IA/analítica y optimización;
- seguridad, privacidad, escalabilidad y rendimiento;
- documentación de diseño, datos utilizados y resultados de simulaciones;
- pruebas exhaustivas y validación frente a datos reales.

**Decisión de producto:** el gemelo debe mostrar siempre su cadena de evidencia: fuente → cobertura → zona → variable → transformación → resultado. Los modelos sintéticos o demostradores deben llevar una etiqueta visible y no pueden presentarse como una predicción real validada.

### 2.3 Interoperabilidad y ontología

Las secciones **5.20** (págs. 87–88) y **6.3.4** (págs. 99–101) establecen:

- adopción de la red de ontologías del sector turístico, sus extensiones y evoluciones;
- normalización semántica según el modelo ontológico turístico de SEGITTUR;
- interfaces abiertas y normalizadas, conectores bidireccionales y API-first;
- soporte para HTTP/S, REST, NGSI, SFTP, WFS/WFS-T, WMTS, WMS, eventos, pub/sub y ETL de archivos;
- JSON y JSON-LD, modos push/pull y consultas georreferenciadas;
- identidad, roles, seguridad, monitorización y trazabilidad sobre las APIs.

**Decisión de producto:** los conectores S2, C4, IoT, NGSI-LD, OGC y los ficheros de destino deben mantenerse como **adaptadores configurables**. Sin credenciales, autorización y contrato real de proveedor, solo se puede ofrecer prevalidación, simulación local o modo demostrador claramente marcado.

### 2.4 Calidad de predicción e IA

La sección **5.10.3** (pág. 65) exige que los modelos predictivos/ML:

- se ejecuten con metodología **CRISP-DM**;
- se automaticen y operen con prácticas **DevOps/MLOps**;
- definan métricas y umbrales de aceptación;
- documenten hipótesis de validez, mantenimiento y reentrenamiento;
- planteen y, cuando corresponda, obtengan aprobación de SEGITTUR.

**Decisión de producto:** las predicciones T+1 h, T+4 h y T+24 h solo se considerarán operativas cuando tengan vínculos aprobados a fuentes reales, cobertura suficiente, versión de modelo y de vínculos, observación posterior y error calculado. La IA conversacional es un copiloto: propone y explica; no ejecuta, comparte ni publica sin aprobación humana.

## 3. Situación actual del MVP frente al marco PID

| Capacidad | Estado actual del MVP | Límite que debe mantenerse explícito |
|---|---|---|
| Escenarios no-code, BASE/ESCENARIO/DELTA y SimulationRun | Implementado para demostración multidestino. | Debe conectarse al motor real de C4 al disponer de contrato y acceso. |
| Catálogo de modelos, importación y dependencias PID | Implementado como catálogo y paquete gobernado. | Requiere proceso institucional de validación/publicación para ser reutilizable entre destinos reales. |
| ContextPackage, RLS, evidencias y auditoría | Implementado en el piloto PostGIS local. | La identidad institucional y el almacenamiento deben desplegarse en infraestructura aprobada para un piloto productivo. |
| S2/NGSI-LD, IoT/MQTT y datos abiertos | Adaptadores, validación y rutas de integración preparados. | No hay conexión activa a S2, C4, brokers o APIs de terceros sin credenciales/autorización. |
| S11/visor GIS y 3D/4D | Visor territorial, OGC, LiDAR/3D Tiles y degradación segura preparados. | No equivale a una integración productiva con S11 ni habilita por sí sola servicios comerciales de terceros. |
| Predicción/calibración | Registro de horizontes, comparación ex-post y calidad implementados en modo piloto. | Necesita históricos y observaciones reales para medir precisión y fijar umbrales aprobados. |
| Agentes de respuesta rápida | Propuestas auditables, protocolos y compuerta humana implementados. | No deben ejecutar acciones externas reales sin un protocolo autorizado, identidad institucional y confirmación humana. |

## 4. Guía de terminología PID para el MVP

Esta guía cambia únicamente el **lenguaje de presentación y de documentación**. No añade funciones, no activa conectores, no altera permisos y no declara ninguna integración externa como operativa.

| Denominación en el Gemelo | Contexto PID que expresa | Alcance actual que conserva |
|---|---|---|
| **Simulación · S18** | Explotación de datos, previsión y simulación. | Escenarios, parámetros, BASE/ESCENARIO/DELTA, predicción y resultados del MVP. |
| **Territorio · S11** | Inteligencia de Localizaciones. | Visor territorial y capas 2D/2.5D/3D/4D del MVP, sin afirmar conexión activa a S11. |
| **S2 · Datos e interoperabilidad** | Semántica turística, activos, recursos y capa de interoperabilidad. | Ontología, ContextPackage, conectores preparados, ingesta y trazabilidad existentes. |
| **Datos e interoperabilidad** | Capa transversal PID. | Catálogo, conectores, fuentes y paquetes de datos/modelos ya disponibles en el producto. |
| **Operación y trazabilidad** | Gobierno de resultados, evidencia y revisión humana. | Protocolos, auditoría, calidad, identidad y decisiones ya implementadas. |
| **Asistente IA** | Apoyo explicable a S18. | Propone borradores revisables; no ejecuta, comparte ni publica por sí solo. |
| **Marco PID** | Alineamiento conceptual con la Plataforma Inteligente de Destinos. | No significa que S2, S11, C4, IoT, Google u otro proveedor estén conectados. |

## 5. Regla de alcance

El Expediente se utiliza para **alinear el contexto, la terminología y la explicación del Gemelo**. No crea un backlog nuevo, no obliga a construir capacidades no solicitadas y no transforma los adaptadores preparados en integraciones activas. Cada módulo mantiene exactamente sus funciones actuales y sus etiquetas de demostración, prevalidación o integración autorizada cuando correspondan.

---

## Referencias verificadas

- Expediente 53/2023, sección **5.10.3**: calidad de modelos predictivos e IA (pág. 65).
- Expediente 53/2023, sección **5.20**: red de ontologías del sector turístico (págs. 87–88).
- Expediente 53/2023, sección **6.3.4**: capa de interoperabilidad (págs. 99–101).
- Expediente 53/2023, sección **7.20 S18**: explotación de datos, previsión y simulación (págs. 287–290).
- Expediente 53/2023, sección **8.3.2.2**: gemelo digital (pág. 323).
