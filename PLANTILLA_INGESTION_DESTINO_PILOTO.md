# GUÍA Y ESPECIFICACIÓN DE INGESTIÓN DE DATOS PARA DESTINO PILOTO REAL
## Gemelo Digital Turístico PID — SEGITTUR

Este documento establece el contrato de datos mínimo, formatos, gobernanza y canales de ingestión requeridos para que un nuevo destino español —o el piloto de Málaga/Palma— alimente el gemelo digital con sus fuentes territoriales reales y pueda calibrar los modelos predictivos con error empírico contrastable.

---

## 1. Arquitectura de Ingestión en Dos Carriles

El gemelo digital implementa la separación arquitectónica de la Plataforma Inteligente de Destinos (PID):

1. **Carril Ontológico (Normalizado PID / S2)**:
   - Formato preferente: **NGSI-LD** o **GeoJSON normalizado**.
   - Entidades semánticas: `TouristDestination`, `TourismZone`, `TourismResource`, `TourismSensor`.
   - Uso: Alimentación estructural del mapa, perfiles y capacidades de carga fijas.

2. **Carril Histórico y Operativo (No Ontológico / C4)**:
   - Formato: **CSV tabulado**, **REST JSON** o **MQTT streaming**.
   - Series temporales: Conteos continuos, afluencias horarias, ocupación de aparcamientos y meteorología.
   - Uso: Calibración de modelos, entrenamiento de redes neuronales y contraste T+1h/T+4h.

---

## 2. Las 3 Fuentes Mínimas Necesarias para el Piloto Real

Para iniciar una calibración predictiva real no se requiere integrar todas las fuentes municipales desde el primer día. Basta con activar estas **tres familias de datos**:

### Familia 1: Afluencia y Capacidad de Carga (Conteos Peatonales / IoT)
- **Frecuencia mínima**: 15 a 60 minutos.
- **Tipos de sensores admitidos**:
  - Cámaras de conteo con analítica en el borde (solo métricas numéricas agregadas, sin captación de imágenes personales).
  - Sensores Wi-Fi / Bluetooth con hash salado no reversible de dirección MAC (cumplimiento estricto RGPD).
  - Tornos y conteos de ticketing en monumentos y museos (Catedral, Alcazaba, etc.).
- **Esquema de campos requerido**:
  ```json
  {
    "sensorId": "sens-afluencia-larios-01",
    "zoneId": "malaga_centro",
    "timestamp": "2026-10-08T14:00:00Z",
    "personasHora": 4250,
    "aforoMaximoZona": 15000,
    "calidadDato": "A_CERTIFICADA",
    "fuente": "Red de Sensores Smart City Málaga"
  }
  ```

### Familia 2: Movilidad, Accesos y Aparcamientos
- **Frecuencia mínima**: 15 a 30 minutos.
- **Fuentes típicas**:
  - Sensores de espira o cámaras en accesos viarios perimetrales.
  - Disponibilidad de plazas en aparcamientos públicos (rotación y libres).
  - Viajeros en paradas estratégicas de autobús/tranvía/metro.
- **Esquema de campos requerido**:
  ```json
  {
    "parkingId": "park-alcazaba-01",
    "plazasTotales": 450,
    "plazasLibres": 32,
    "ocupacionPct": 92.8,
    "timestamp": "2026-10-08T14:00:00Z"
  }
  ```

### Familia 3: Contexto y Factores Exógenos (Clima y Cruceros/Eventos)
- **Frecuencia**: Actualización diaria + previsión horaria.
- **Fuentes típicas**:
  - **AEMET / OpenMeteo**: Temperatura, precipitación prevista (mm/h), sensación térmica.
  - **Autoridad Portuaria**: Calendario oficial de escalas de cruceros (eslora, pasaje máximo, hora estimada de atraque y desatraque).
  - **Agenda Municipal**: Conciertos, procesiones, eventos deportivos con aforo estimado.
- **Esquema de cruceros**:
  ```json
  {
    "escalaId": "crucero-2026-10-08-01",
    "nombreBuque": "Symphony of the Seas",
    "pasajerosPrevistos": 5400,
    "horaAtraque": "2026-10-08T07:30:00Z",
    "horaDesatraque": "2026-10-08T18:00:00Z",
    "terminal": "Terminal de Cruceros Muelle de Levante"
  }
  ```

---

## 3. Protocolo de Calibración Predictiva (Validación Empírica)

Una vez ingeridas las fuentes anteriores, el gemelo opera en modo de **calibración supervisada**:

1. **Generación de Proyección**: A las `T=10:00`, el gemelo predice la afluencia esperada para las `11:00` (T+1h) y las `14:00` (T+4h) bajo las condiciones meteorológicas y de escalas registradas.
2. **Congelación de Evidencia**: La predicción se firma criptográficamente y se almacena en la tabla `calibraciones_predictivas` junto a la huella de contexto.
3. **Contraste Empírico**: Al llegar las `14:00`, se captura la lectura real del sensor o conteo y se calcula el error:
   $$\text{Error Absoluto} = |V_{\text{real}} - V_{\text{predicho}}|$$
   $$\text{Error Porcentual (\%)} = \frac{|V_{\text{real}} - V_{\text{predicho}}|}{V_{\text{real}}} \times 100$$
4. **Umbral de Calibración Óptima**:
   - Error $< 5\%$: **Modelo Calibrado (Apta para toma de decisiones operativas)**.
   - Error entre $5\%$ y $12\%$: **Modelo en Ajuste**.
   - Error $> 12\%$: **Alerta de Descalibración** (requiere reajuste de multiplicadores exógenos o revisión de sensores).

---

## 4. Requisitos de Seguridad y Gobernanza

- **Principio de Mínimo Privilegio**: Toda ingestión se autentica mediante token de API vinculado al `tenant_id` del municipio.
- **Anonimización en Origen**: Queda terminantemente prohibida la transmisión de identificadores de personas físicas, imágenes reconocibles o matrículas de vehículos.
- **Etiquetado de Calidad**: Toda serie debe declarar si es `A_CERTIFICADA` (sensor municipal verificado), `B_ESTIMADA` (algoritmo intermedio) o `C_EN_VALIDACION`.
