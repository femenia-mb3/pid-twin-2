# Propuesta de acoplamiento de Google Geo Suite al Gemelo Digital Turístico PID

La evolución correcta es mantener el Gemelo Digital Turístico como un **módulo común, interoperable y soberano de la PID**, y añadir Google Maps Platform como una capa **opcional de enriquecimiento**. Google puede aumentar la calidad de la experiencia 3D, las recomendaciones de rutas y algunas consultas territoriales, pero no debe sustituir al modelo multidestino, la ontología PID, PostGIS, los conectores S2/C4/IoT ni las reglas de evidencia ya implantadas.

> El núcleo PID conserva los datos, el modelo, la trazabilidad, las decisiones humanas y la capacidad de operar sin Google. Google aporta una fuente externa bajo demanda, visible, atribuida y revocable.

Esta separación hace que el servicio siga siendo reutilizable para cualquier destino español, incluyendo los que no dispongan de presupuesto, cobertura o autorización para servicios Google.

## Qué puede aportar Google al módulo PID

### Visualización 3D fotorrealista

La integración más directa encaja con el visor `Real3DTilesViewer.tsx`, que ya utiliza CesiumJS, LiDAR PNOA, Catastro, modelos GLB, iluminación solar, capas abiertas IGN y mecanismos de degradación segura. Google Maps Platform ofrece **Photorealistic 3D Tiles**, una malla 3D texturizada de alta resolución para zonas pobladas. La propia documentación oficial muestra la carga de un `tileset.json` de Google mediante CesiumJS y exige que se muestren las atribuciones correspondientes. CesiumJS 1.91 o posterior es compatible. [1]

Esto permitiría que un operador cambie explícitamente entre:

- **Modo PID abierto:** PNOA, LiDAR, Catastro, LOD2, activos 3D propios y capas PID.
- **Modo Google fotorrealista:** escena de inspección o presentación con la malla 3D de Google, si existe cobertura y el destino lo ha autorizado.
- **Modo comparativo:** la misma cámara y las mismas capas operativas, pero con una etiqueta que diferencie qué geometría procede de PID/IGN/Catastro y cuál procede de Google Maps.

No se descargarían ni almacenarían las teselas de Google en PostGIS, GeoServer, S3 o el catálogo de activos PID. Las políticas de Map Tiles API prohíben el prefetch, la indexación, el almacenamiento y los usos no visuales de ese contenido. El uso quedaría limitado a renderizado en vivo, respetando sus cabeceras de caché. [2]

La cobertura publicada por Google marca España como disponible para Map Tiles 2D/3D, Maps JavaScript 3D, tráfico y rutas. Aun así, cada destino debe pasar una **prevalidación visual y contractual por ciudad/zona**, porque la tabla nacional no garantiza el detalle fotorrealista de cada calle, edificio o área rural. [6]

### Exploración 3D guiada para turismo y patrimonio

La alternativa de Google **3D Maps en Maps JavaScript API** proporciona un motor completo de visualización con mapas 3D, estilos de POI y carreteras, marcadores, popovers, polilíneas, modelos glTF y recorridos de cámara. [3]

No se recomienda mezclar este motor y Cesium dentro del mismo lienzo. La propuesta es ofrecerlo como una **vista de exploración independiente**, por ejemplo en un modal “Exploración 3D Google”, útil para una demostración patrimonial, una visita virtual o un análisis visual de accesos. El visor Cesium actual seguirá siendo la vista de operación, simulación, capas OGC y analítica territorial.

Así se evita perder las capacidades geoespaciales abiertas ya construidas, se reduce el riesgo de pantallas blancas por WebGL y se puede cerrar la experiencia Google sin afectar al trabajo diario del destino.

### Rutas y movilidad como recomendación operativa

La **Routes API** puede calcular rutas para coche, transporte público, bicicleta, moto y peatón, con opciones de tráfico, alternativas, duración, distancia y matrices de rutas. [4]

El Gemelo puede usarla en una fase posterior para complementar las propuestas del optimizador de flujos. Por ejemplo, ante saturación de una zona, el sistema podría comparar rutas de redistribución hacia recursos alternativos. La respuesta de Google no debe reemplazar la simulación PID ni activar acciones operativas por sí sola. Será una **alternativa externa de movilidad** que el operador revisa y aprueba.

Cada recomendación tendría un sobre de evidencia obligatorio con:

- fecha y hora de consulta;
- origen, destino, modo de transporte y parámetros de tráfico solicitados;
- identificador/hash de la petición y de la respuesta autorizada;
- proveedor `Google Maps Routes API`;
- cobertura territorial aplicada;
- atribución y condiciones de uso;
- vínculo con el escenario, la simulación BASE / ESCENARIO / DELTA y la decisión humana.

Por defecto se conservará el mínimo necesario para auditoría y se evitará persistir contenido de rutas de Google más allá de lo autorizado por sus términos. Antes de uso productivo, SEGITTUR y cada destino deberán validar legalmente la política de retención concreta aplicable.

### Inventario y contexto de recursos turísticos

Places API permite búsqueda de lugares, autocompletado, información de establecimiento, horarios, fotografías y detalles asociados a un `place ID`. [5]

Su uso adecuado dentro del Gemelo sería de **descubrimiento y contraste de contexto**, no de sustitución del inventario S2/PID. Un usuario podría buscar un recurso cercano, comparar un activo municipal con una ficha externa o iniciar una propuesta de alta. La entidad PID se crea solo tras una revisión humana, un mapeo ontológico y una fuente de verdad definida por el destino.

Los datos procedentes de Places se mostrarán como `EXTERNOS · GOOGLE MAPS`, con su atribución y fecha de consulta. No se usarán como calibración de afluencia, capacidad de carga o impacto macroeconómico sin un vínculo formal aprobado que especifique cobertura, variable, unidad, transformación, frecuencia, calidad y autorización, tal como ya exige la Iteración 14.

### Copiloto IA geoespacial con fuentes visibles

Google ha incorporado **Grounding with Google Maps** para que Gemini pueda responder consultas geográficas con fuentes actuales de Google Maps. El resultado incluye anotaciones de fuente con nombre y URL, que deben mostrarse inmediatamente después del contenido generado. [7]

Esto encaja con la regla del Gemelo: **ninguna respuesta de asistente sin evidencia comprobable**. La integración se limitaría inicialmente a consultas como:

- “¿Qué recursos accesibles hay a 15 minutos a pie de esta zona?”
- “¿Qué opciones de desplazamiento existen entre dos recursos bajo un escenario de lluvia?”
- “¿Qué POI complementarios hay alrededor de un activo turístico?”

No se utilizará para declarar causalidad, producir predicciones, modificar parámetros, activar agentes de respuesta ni ejecutar simulaciones. El Copiloto PID deberá mantener la separación entre:

1. **evidencia interna PID:** S2, C4, IoT, archivos validados, modelos y vínculos aprobados;
2. **evidencia externa Google Maps:** apoyo de contexto, siempre etiquetada, enlazada y fechada;
3. **propuesta humana:** borrador revisable, nunca ejecución automática.

La documentación actual indica que el grounding con Google Maps solo admite prompts y respuestas en inglés, aunque su ámbito geográfico sea global. Por tanto, no se recomienda activarlo aún como función principal de atención en español; se propone un piloto técnico controlado o esperar a soporte lingüístico adecuado. [7]

## Arquitectura de integración recomendada

Se creará una familia de adaptadores desacoplados, activados por destino y por servicio, nunca una dependencia global de Google:

```text
PID / Gemelo Digital
│
├── Núcleo soberano
│   ├── Ontología PID · S2 · C4 · NGSI-LD · IoT
│   ├── PostGIS + RLS · GeoServer/OGC · ContextPackage
│   ├── Motor de simulación/predicción · BASE / ESCENARIO / DELTA
│   ├── Calibración, auditoría inmutable y decisiones humanas
│   └── Visor Cesium + PNOA + LiDAR + Catastro + activos propios
│
└── Adaptadores opcionales Google Geo Suite
    ├── GooglePhotorealistic3DAdapter
    ├── Google3DExplorationAdapter
    ├── GoogleRoutesEvidenceAdapter
    ├── GooglePlacesContextAdapter
    └── GoogleMapsGroundingEvidenceAdapter
```

Cada adaptador debe exponer una ficha de capacidad con: proveedor, API/version, destino autorizado, zona permitida, finalidad, estado, coste/limitación conocida, fecha de última comprobación, licencia/términos, huella de petición, atribuciones y evidencia de aprobación humana.

La configuración irá en el catálogo de conectores ya construido, con estado inicial `DESHABILITADO`. Solo un administrador institucional podrá cambiarla a `EN_PRUEBA` o `ACTIVO`, tras registrar el propósito, el ámbito territorial, el responsable y la evidencia de autorización.

## Cambios concretos en el producto

La siguiente iteración de integración no debe empezar por mostrar un mapa Google sin controles. Debe construir primero una **puerta de gobernanza de proveedor externo** y después los adaptadores.

En la interfaz:

- En **Datos & PID → Conectores**, aparecerá “Google Geo Suite” como conector opcional, con módulos seleccionables: 3D Tiles, 3D Maps, Routes, Places y Maps Grounding.
- En **Representación geoespacial → Nivel 3**, un selector mostrará “PID abierto” y “Google fotorrealista (piloto)”. El segundo estará deshabilitado hasta que la prevalidación contractual, técnica y de cobertura sea favorable.
- En **Copiloto IA**, las respuestas apoyadas en Google aparecerán en un bloque separado “Fuentes Google Maps”, con enlaces de fuente inmediatamente visibles y una advertencia de que no son evidencia de calibración.
- En **Simulación**, la opción de usar una ruta Google quedará como recomendación adjunta, no como parámetro automático. Requerirá clic de aprobación antes de incorporarla al borrador.
- En **Auditoría**, se consultará toda activación, consulta, fuente, decisión, coste estimado, aprobación y revocación del conector.

En el servidor:

- Las llamadas de rutas, Places y grounding se harán siempre **server-side** mediante un proxy específico; ninguna clave de servicio se expondrá al navegador.
- Las claves de renderizado web, si fueran necesarias, serán independientes y limitadas por dominio. Las claves server-side tendrán limitación por IP o pasarán por el proxy; Google recomienda separar claves y aplicar tanto restricción de aplicación como de API. [8]
- Las respuestas `no-store` y los datos de Google no pasarán automáticamente al almacén de modelos, datasets o calibración.
- El `GoogleMapsEvidenceEnvelope` será obligatorio para todas las respuestas o propuestas que hagan uso de un adaptador Google.

## Límites que debemos mantener

Google puede mejorar la experiencia, pero no debe alterar los principios del módulo común PID:

- **No dependencia obligatoria:** un destino sin Google conserva el mismo flujo completo de alta, ingestión, modelo, simulación, predicción y auditoría.
- **No datos opacos en modelos:** una imagen 3D, una recomendación de Places o una ruta externa no se convierten en señal de calibración sin vínculo formal aprobado.
- **No automatismo operacional:** ni las rutas ni el Copiloto externo pueden activar protocolos, agentes Centinela, publicación o ejecución sin revisión humana.
- **No extracción de cartografía Google:** las teselas solo se visualizan en vivo; no se usan para entrenamiento, detección de objetos, digitalización, productos derivados ni distribución offline. [2]
- **Atribución visible:** los créditos de Google Maps y de terceros se conservan en escena, no se tapan con el logotipo PID/Cesium y se diferencian visualmente de las fuentes PID/IGN/Catastro. [2]
- **Privacidad y finalidad:** no se enviarán a Google datos personales, identificadores de visitantes, telemetría granular no anonimizada ni datos reservados del destino. Las peticiones usarán el mínimo contexto territorial necesario.

## Hoja de ruta propuesta

### Fase A — Prevalidación y prueba controlada

Se habilita un conector de prueba para Málaga, sin afectar al visor actual. Se verifica cobertura, términos EEE, costes, claves restringidas, atribuciones, rendimiento WebGL, fallback al modo PID abierto y el comportamiento de la escena Cesium. No se introducen datos PID privados ni se habilita retención de contenido Google.

El resultado es una decisión auditable: `APROBADO_PILOTO`, `RESTRINGIDO` o `NO_APTO`, con evidencia técnica y contractual.

### Fase B — Valor visible en 3D

Si la prueba es apta, se activa el conmutador de “Google 3D fotorrealista” en un área piloto, con créditos en pantalla y un panel de procedencia. Los activos propios, capas de simulación y objetos 3D de Málaga se superponen solo si no se derivan de las teselas Google y se identifica claramente su procedencia. [2]

Este es el mejor primer caso de uso para una presentación institucional: mejora la lectura del territorio sin sustituir los datos oficiales abiertos ni el motor de simulación.

### Fase C — Rutas como apoyo a la decisión

Se integra Routes API detrás de un adaptador de evidencia para comparar rutas de desvío propuestas por el motor PID. Las alternativas se presentan como recomendaciones, con tiempo de consulta, condiciones de tráfico y decisión humana. La simulación conserva su cálculo interno BASE / ESCENARIO / DELTA.

### Fase D — Contexto de recursos y Copiloto geoespacial

Se evalúan Places y Maps Grounding para consultas contextuales. Solo se habilitan cuando el uso en español, los términos EEE, las fuentes y el presupuesto estén aprobados. Sus respuestas se conservan como evidencia externa enlazada, no como verdad institucional ni dato de calibración.

## Decisión recomendada

La recomendación es iniciar una **Iteración 17 — Google Geo Suite como enriquecimiento opcional y gobernado** con foco exclusivo en la Fase A y la Fase B: prevalidación, control de activación por destino, `GooglePhotorealistic3DAdapter`, atribución obligatoria, proxy/gestión de secretos, auditoría y fallback al visor PID abierto.

No se deben activar aún Routes, Places ni Maps Grounding como datos operativos hasta disponer de credenciales, condiciones de uso aceptadas por SEGITTUR/destino y una revisión específica de privacidad, retención, cobertura y coste. Así se obtiene un salto visible de calidad 3D y se mantiene intacto el principio que hace valioso al módulo para la PID: **un núcleo común, evidenciable y reutilizable, no un visor dependiente de un proveedor**.

## References

[1]: https://developers.google.com/maps/documentation/tile/3d-tiles "Photorealistic 3D Tiles — Google Maps Tile API"

[2]: https://developers.google.com/maps/documentation/tile/policies "Map Tiles API Policies"

[3]: https://developers.google.com/maps/documentation/javascript/3d/overview "3D Maps in Maps JavaScript API Overview"

[4]: https://developers.google.com/maps/documentation/routes/overview "Google Maps Routes API Compute Routes Overview"

[5]: https://developers.google.com/maps/documentation/places/web-service/overview "Places API New Overview"

[6]: https://developers.google.com/maps/coverage "Google Maps Platform Coverage Details"

[7]: https://ai.google.dev/gemini-api/docs/maps-grounding "Grounding with Google Maps in the Gemini API"

[8]: https://developers.google.com/maps/api-security-best-practices "Google Maps Platform API Security Best Practices"
