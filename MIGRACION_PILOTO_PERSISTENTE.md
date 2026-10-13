# Guía de Despliegue y Migración al Piloto Persistente
**Gemelo Digital Turístico - Plataforma Inteligente de Destinos (SEGITTUR)**

Esta guía detalla los pasos exactos para trasladar este MVP desde la demo temporal hasta un servidor persistente con **PostgreSQL/PostGIS**, **GeoServer**, **Vector Tiles (MVT)** y el visor analítico en funcionamiento 24/7.

---

## 1. Arquitectura del Despliegue Persistente

```
+---------------------------------------------------------------------------------------------------------+
|                                    SERVIDOR PERSISTENTE (DOCKER HOST)                                    |
|                                                                                                         |
|  +-----------------------+     +-----------------------+     +---------------------------------------+  |
|  |     PostGIS 3.4       |     |    GeoServer 2.25     |     |       Aplicación Gemelo Digital       |  |
|  |  (PostgreSQL 16)      | <-> |  (WMS / WFS / OGC API)| <-> |  - Motor Simulación What-If           |  |
|  |  Puerto: 5432         |     |  Puerto: 8080         |     |  - Visor Web React 2D/2.5D/3D         |  |
|  +-----------------------+     +-----------------------+     |  - API Ingestión & GeoServices        |  |
|                                                              |  Puerto: 3000                         |  |
|                                                              +---------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
                                                ^
                                                | Conexión OGC / REST
                                                v
               +------------------------------------------------------------------+
               | Clientes GIS Corporativos (ESRI ArcGIS Online / Pro, QGIS, etc.) |
               +------------------------------------------------------------------+
```

---

## 2. Requisitos Previos en el Servidor
- Servidor Linux (Ubuntu 22.04 LTS o 24.04 LTS recomendado).
- Docker Engine (v24+) y Docker Compose (v2+).
- Mínimo 4 GB de RAM (recomendado 8 GB para GeoServer con extensiones de teselas vectoriales) y 20 GB de disco.

---

## 3. Despliegue en 3 Pasos

### Paso 1: Clonar o copiar el repositorio en el servidor
```bash
git clone <URL_REPOSITORIO> /opt/gemelotur
cd /opt/gemelotur/database
```

### Paso 2: Arrancar la infraestructura con Docker Compose
```bash
docker compose up -d
```
El archivo `database/docker-compose.yml` ejecutará automáticamente:
1. `postgis`: Inicializará la base de datos `gemelotur_db` y aplicará el script `schema_postgis.sql`.
2. `geoserver`: Arrancará el motor OGC configurado con conectores a PostGIS.
3. `gemelotur_app`: Compilará y levantará la aplicación web y sus APIs en el puerto 3000.

### Paso 3: Carga de datos semilla (opcional si se desea precargar Málaga y Palma)
```bash
docker exec -i gemelotur_postgis psql -U segittur_admin -d gemelotur_db < seed_data.sql
```

---

## 4. Endpoints y URLs Disponibles tras el Despliegue

| Servicio | URL Local | Descripción |
|---|---|---|
| **Visor Web y Control Room** | `http://<IP_SERVIDOR>:3000/` | Interfaz interactiva para gestores de destino. |
| **API de Salud del Sistema** | `http://<IP_SERVIDOR>:3000/api/health` | Estado del backend, PostGIS y simulación. |
| **API OGC Collections** | `http://<IP_SERVIDOR>:3000/api/geo/ogc/collections` | Metadatos conformes a OGC API Features. |
| **Capas GeoJSON** | `http://<IP_SERVIDOR>:3000/api/geo/capas/zonas` | Capas vectoriales dinámicas en tiempo real. |
| **Motor de Simulación** | `http://<IP_SERVIDOR>:3000/api/simulacion/ejecutar` | Endpoint POST para cálculo de escenarios What-If. |
| **Ingestión Telemetría** | `http://<IP_SERVIDOR>:3000/api/ingestion/telemetria` | Endpoint POST para ingesta IoT / NGSI-LD. |
| **Consola GeoServer** | `http://<IP_SERVIDOR>:8080/geoserver` | Panel de administración WMS/WFS/WMTS. |

---

## 5. Integración con ESRI ArcGIS & GIS Municipal Existente
Para federar este Gemelo Digital con la infraestructura SIG ya existente en el destino:
1. En **ArcGIS Pro** o **ArcGIS Online**, seleccionar *Añadir Capa desde la Web*.
2. Introducir la URL del servicio WFS de GeoServer:
   `http://<IP_SERVIDOR>:8080/geoserver/wfs?request=GetCapabilities`
   o consumir directamente el endpoint GeoJSON en vivo:
   `http://<IP_SERVIDOR>:3000/api/geo/capas/zonas?destino=malaga`
3. Las capas reflejarán automáticamente los cálculos de capacidad de carga, alertas y rutas de desvío generadas por el motor.
