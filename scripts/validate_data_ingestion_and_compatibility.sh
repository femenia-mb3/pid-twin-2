#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — FASE OPERATIVA: INGESTIÓN NO-CODE Y COMPATIBILIDAD MULTIDESTINO
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN: INGESTIÓN NO-CODE Y COMPATIBILIDAD MULTIDESTINO ==="

# 1. Autenticar operador institucional
echo "[TEST 1] Autenticando operador para pruebas de ingesta..."
LOGIN_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_secure_token_2026"}')

TOKEN=$(echo "${LOGIN_RES}" | jq -r '.token')
if [ -z "${TOKEN}" ] || [ "${TOKEN}" == "null" ]; then
  echo "  ERROR: No se pudo obtener token de autenticación."
  exit 1
fi
echo "  -> OK: Sesión autenticada."

# 2. Ingestión No-Code de Recursos Turísticos Ontológicos (Carril S2 vía CSV)
echo "[TEST 2] Ingestando lote CSV de recursos turísticos en carril S2..."
INGEST_RES=$(curl -s -f "${BASE_URL}/api/ingestion/datasets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{
    "destinationId": "malaga",
    "title": "Censo de Nuevos Miradores y Espacios",
    "lane": "ONTOLOGICO_S2",
    "fileFormat": "CSV",
    "rawPayload": "nombre,categoria,latitud,longitud,aforo\nMirador de Gibralfaro Este,MIRADOR,36.7235,-4.4090,300\nCentro de Interpretacion del Puerto,MUSEO,36.7165,-4.4160,450\nPlaza de la Merced Norte,ESPACIO_PUBLICO,36.7260,-4.4180,1200",
    "sourceName": "Área de Turismo Municipal",
    "licenseDeclared": "CC-BY 4.0 Datos Abiertos"
  }')

STATUS=$(echo "${INGEST_RES}" | jq -r '.status')
VALID_RECORDS=$(echo "${INGEST_RES}" | jq -r '.validRecords')
SHA_FINGERPRINT=$(echo "${INGEST_RES}" | jq -r '.fingerprintSha256')

echo "  Lote procesado: ${VALID_RECORDS} registros válidos."
echo "  Huella SHA-256 generada: ${SHA_FINGERPRINT}"

if [ "${STATUS}" != "APPLIED" ] || [ "${VALID_RECORDS}" -ne 3 ]; then
  echo "  ERROR: Se esperaba status APPLIED con 3 registros."
  exit 1
fi
echo "  -> OK: Ingesta ontológica S2 aplicada con éxito."

# 3. Ingestión No-Code de Telemetría Histórica (Carril C4 vía CSV)
echo "[TEST 3] Ingestando serie histórica de aforos en carril C4..."
INGEST_TEL_RES=$(curl -s -f "${BASE_URL}/api/ingestion/datasets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{
    "destinationId": "malaga",
    "title": "Aforos de Pasarela Peatonal",
    "lane": "HISTORICO_C4",
    "fileFormat": "CSV",
    "rawPayload": "sensorId,timestamp,valor,unidad\nsensor_puerto_01,2026-10-08T12:00:00Z,380,conteo_personas\nsensor_puerto_01,2026-10-08T13:00:00Z,520,conteo_personas",
    "sourceName": "Red de Sensores Urbanos",
    "licenseDeclared": "CC-BY 4.0 Datos Abiertos"
  }')

TEL_STATUS=$(echo "${INGEST_TEL_RES}" | jq -r '.status')
echo "  Status telemetría C4: ${TEL_STATUS}"
if [ "${TEL_STATUS}" != "APPLIED" ]; then
  echo "  ERROR: No se pudo aplicar el lote de telemetría."
  exit 1
fi
echo "  -> OK: Ingesta histórica C4 aplicada con éxito."

# 4. Consultar historial de lotes ingestados
echo "[TEST 4] Consultando historial de ingestas en GET /api/ingestion/history..."
HIST_RES=$(curl -s -f "${BASE_URL}/api/ingestion/history?destino=malaga")
TOTAL_HIST=$(echo "${HIST_RES}" | jq -r '.total')
echo "  Total de lotes en historial: ${TOTAL_HIST}"

if [ "${TOTAL_HIST}" -lt 2 ]; then
  echo "  ERROR: Se esperaban al menos 2 lotes en el historial."
  exit 1
fi
echo "  -> OK: Historial de ingestas auditado."

# 5. Comprobar rechazo en ingesta cruzada de tenant
echo "[TEST 5] Verificando protección de tenant en ingesta (Palma con token de Málaga)..."
CROSS_TENANT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/ingestion/datasets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_palma" \
  -d '{
    "destinationId": "palma",
    "title": "Intento no autorizado",
    "lane": "ONTOLOGICO_S2",
    "fileFormat": "CSV",
    "rawPayload": "nombre,categoria,latitud,longitud,aforo\nRecurso,MUSEO,39.5,2.6,100"
  }')

echo "  Código HTTP devuelto: ${CROSS_TENANT_CODE}"
if [ "${CROSS_TENANT_CODE}" != "403" ]; then
  echo "  ERROR: Se esperaba 403 Forbidden para ingesta en tenant no autorizado."
  exit 1
fi
echo "  -> OK: Aislamiento por tenant respetado en ingestión."

# 6. Matriz de compatibilidad multidestino para modelo de saturación
echo "[TEST 6] Evaluando matriz de compatibilidad para 'modelo_saturacion_turistica'..."
MATRIX_RES=$(curl -s -f -X POST "${BASE_URL}/api/multidestino/compatibility-matrix" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "modelo_saturacion_turistica",
    "destinationIds": ["malaga", "palma"]
  }')

FEASIBILITY=$(echo "${MATRIX_RES}" | jq -r '.overallCrossDestinationFeasibility')
DEST_COUNT=$(echo "${MATRIX_RES}" | jq -r '.destinationsEvaluated | length')
echo "  Factibilidad multidestino: ${FEASIBILITY}"
echo "  Destinos evaluados: ${DEST_COUNT}"

if [ "${DEST_COUNT}" -ne 2 ]; then
  echo "  ERROR: Se esperaban 2 destinos evaluados."
  exit 1
fi
echo "  -> OK: Matriz de compatibilidad calculada."

# 7. Comprobar desglose de requisitos por destino
echo "[TEST 7] Verificando desglose de checks en Málaga y Palma..."
SCORE_MLG=$(echo "${MATRIX_RES}" | jq -r '.destinationsEvaluated[] | select(.destinationId=="malaga") | .compatibilityScorePct')
SCORE_PLM=$(echo "${MATRIX_RES}" | jq -r '.destinationsEvaluated[] | select(.destinationId=="palma") | .compatibilityScorePct')
echo "  Score Málaga: ${SCORE_MLG}%"
echo "  Score Palma: ${SCORE_PLM}%"

if [ "${SCORE_MLG}" -lt 50 ] || [ "${SCORE_PLM}" -lt 50 ]; then
  echo "  ERROR: Se esperaba un score de compatibilidad superior al 50%."
  exit 1
fi
echo "  -> OK: Desglose por destino verificado."

# 8. Comprobar que no se permite evaluar sin destinos
echo "[TEST 8] Verificando validación de entrada en la matriz de compatibilidad..."
ERR_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/multidestino/compatibility-matrix" \
  -H "Content-Type: application/json" \
  -d '{"modelId": "modelo_saturacion_turistica", "destinationIds": []}')

echo "  Código HTTP con array vacío: ${ERR_CODE}"
if [ "${ERR_CODE}" != "400" ]; then
  echo "  ERROR: Se esperaba HTTP 400 Bad Request."
  exit 1
fi
echo "  -> OK: Validación de entrada verificada."

echo "=== TODAS LAS 8 PRUEBAS DE INGESTIÓN Y COMPATIBILIDAD SUPERADAS EXITOSAMENTE ==="
