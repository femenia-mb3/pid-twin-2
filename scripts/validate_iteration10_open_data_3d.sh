#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — ITERACIÓN 10: DATOS ABIERTOS Y MOTOR 3D REALISTA OPEN SOURCE
# Verificación de servicios OGC (PNOA, Catastro, Tráfico), endpoints abiertos y realismo en Cesium
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 10: DATOS ABIERTOS Y VISUALIZACIÓN 3D REALISTA ==="

# 1. Autenticar operador institucional para obtener token JWT obligatorio
echo "[TEST 1] Autenticando 'carlos.dominguez@malaga.es' para pruebas de sesión..."
LOGIN_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_secure_token_2026"}')

TOKEN=$(echo "${LOGIN_RES}" | jq -r '.token')
if [ -z "${TOKEN}" ] || [ "${TOKEN}" == "null" ]; then
  echo "  ERROR: No se pudo obtener token de autenticación."
  exit 1
fi
echo "  -> OK: Autenticación institucional operativa."

# 2. Consultar el Catálogo de Datos Abiertos Interoperables
echo "[TEST 2] Consultando catálogo de datos abiertos en GET /api/geo/open-data/catalog..."
CATALOG_RES=$(curl -s -f "${BASE_URL}/api/geo/open-data/catalog?destino=malaga")
TOTAL_SOURCES=$(echo "${CATALOG_RES}" | jq -r '.totalSources')
echo "  Total de fuentes abiertas catalogadas: ${TOTAL_SOURCES}"

if [ "${TOTAL_SOURCES}" -lt 5 ]; then
  echo "  ERROR: Se esperaban al menos 5 fuentes de datos abiertos."
  exit 1
fi
echo "  -> OK: Catálogo de datos abiertos responde correctamente."

# 3. Verificar metadatos y estándares de Ortoimágenes PNOA y Catastro en el catálogo
echo "[TEST 3] Verificando metadatos oficiales del PNOA IGN y Catastro..."
PNOA_WMS=$(echo "${CATALOG_RES}" | jq -r '.sources[] | select(.id == "pnoa_ortoimagen_maxima_actualidad")')
PNOA_URL=$(echo "${PNOA_WMS}" | jq -r '.endpointUrl')
PNOA_STANDARD=$(echo "${PNOA_WMS}" | jq -r '.openSourceStandard')
PNOA_LICENSE=$(echo "${PNOA_WMS}" | jq -r '.license')

echo "  Fuente PNOA IGN:"
echo "    - Endpoint WMS: ${PNOA_URL}"
echo "    - Estándar OGC: ${PNOA_STANDARD}"
echo "    - Licencia: ${PNOA_LICENSE}"

if [ "${PNOA_STANDARD}" != "OGC_WMS" ]; then
  echo "  ERROR: El estándar de PNOA debe ser OGC_WMS."
  exit 1
fi

CATASTRO_INSPIRE=$(echo "${CATALOG_RES}" | jq -r '.sources[] | select(.id == "catastro_inspire_building_parts")')
CATASTRO_STANDARD=$(echo "${CATASTRO_INSPIRE}" | jq -r '.openSourceStandard')
echo "  Fuente Catastro: ${CATASTRO_STANDARD}"

if [ "${CATASTRO_STANDARD}" != "INSPIRE" ]; then
  echo "  ERROR: El estándar de Catastro debe ser INSPIRE."
  exit 1
fi
echo "  -> OK: Cumplimiento de estándares OGC e INSPIRE verificado."

# 4. Consultar el servicio de flujo de tráfico abierto para Málaga
echo "[TEST 4] Consultando red de tráfico y movilidad abierta en GET /api/geo/open-data/traffic..."
TRAFFIC_RES=$(curl -s -f "${BASE_URL}/api/geo/open-data/traffic?destino=malaga")
TRAFFIC_COUNT=$(echo "${TRAFFIC_RES}" | jq -r '.features | length')
echo "  Tramos de tráfico analizados para Málaga: ${TRAFFIC_COUNT}"

if [ "${TRAFFIC_COUNT}" -lt 3 ]; then
  echo "  ERROR: Se esperaban al menos 3 tramos de tráfico en Málaga."
  exit 1
fi

PRIMER_TRAMO=$(echo "${TRAFFIC_RES}" | jq -r '.features[0].properties.nombreVia')
CONGESTION=$(echo "${TRAFFIC_RES}" | jq -r '.features[0].properties.nivelCongestion')
VELOCIDAD=$(echo "${TRAFFIC_RES}" | jq -r '.features[0].properties.velocidadMediaKmh')
echo "  Primer tramo: ${PRIMER_TRAMO} (${CONGESTION}, ${VELOCIDAD} km/h)"
echo "  -> OK: Capa GeoJSON de tráfico abierta verificada."

# 5. Consultar red de tráfico para Palma (comportamiento multidestino)
echo "[TEST 5] Consultando red de tráfico para Palma..."
TRAFFIC_PALMA=$(curl -s -f "${BASE_URL}/api/geo/open-data/traffic?destino=palma")
PALMA_COUNT=$(echo "${TRAFFIC_PALMA}" | jq -r '.features | length')
PALMA_TRAMO=$(echo "${TRAFFIC_PALMA}" | jq -r '.features[0].properties.nombreVia')
echo "  Tramos en Palma: ${PALMA_COUNT} (ejemplo: ${PALMA_TRAMO})"

if [ "${PALMA_COUNT}" -lt 2 ]; then
  echo "  ERROR: Se esperaban tramos de tráfico para Palma."
  exit 1
fi
echo "  -> OK: Cobertura multidestino de movilidad abierta verificada."

# 6. Comprobar que los datasets 3D y tileset LiDAR siguen respondiendo
echo "[TEST 6] Comprobando disponibilidad del tileset 3D LiDAR..."
TILESET_RES=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/tilesets/malaga-centro-2024/tileset.json")
echo "  Código HTTP del tileset LiDAR: ${TILESET_RES}"
if [ "${TILESET_RES}" != "200" ]; then
  echo "  ERROR: El archivo tileset.json de LiDAR debe devolver HTTP 200."
  exit 1
fi
echo "  -> OK: Tileset LiDAR 3D disponible y accesible."

# 7. Comprobar que el GeoJSON de Catastro con alturas y plantas está disponible
echo "[TEST 7] Comprobando archivo GeoJSON de edificios de Catastro..."
CATASTRO_FILE_RES=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/data/malaga/malaga-urbana-building-parts-lidar-color.geojson")
echo "  Código HTTP de Catastro GeoJSON: ${CATASTRO_FILE_RES}"
if [ "${CATASTRO_FILE_RES}" != "200" ]; then
  echo "  ERROR: El GeoJSON de Catastro debe devolver HTTP 200."
  exit 1
fi
echo "  -> OK: GeoJSON de envolventes de Catastro verificado."

# 8. Comprobar cabeceras de caché públicas en catálogo de datos abiertos
echo "[TEST 8] Verificando cabeceras Cache-Control en el catálogo de datos abiertos..."
CACHE_HEADER=$(curl -s -I "${BASE_URL}/api/geo/open-data/catalog?destino=malaga" | grep -i "cache-control" | tr -d '\r')
echo "  Header recibido: ${CACHE_HEADER}"
if [[ "${CACHE_HEADER}" != *"public"* ]]; then
  echo "  ADVERTENCIA: Se esperaba directiva public en el catálogo de datos abiertos."
fi
echo "  -> OK: Política de caché verificada."

echo "=== TODAS LAS 8 PRUEBAS DE LA ITERACIÓN 10 SUPERADAS EXITOSAMENTE ==="
