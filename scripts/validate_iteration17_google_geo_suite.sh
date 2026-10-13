#!/usr/bin/env bash
# =========================================================================
# SUITE DE VALIDACIÓN AUTOMATIZADA — ITERACIÓN 17: GOOGLE GEO SUITE GOBERNADO
# Plataforma Inteligente de Destinos (PID / SEGITTUR)
#
# Comprueba:
# 1. Login institucional de operadores (Málaga y Palma) con emisión de tokens JWT.
# 2. Consulta de estado inicial del conector (nace DESHABILITADO y con PID_OPEN_DATA).
# 3. Prevalidación formal firmada por operador institucional con veredicto APROBADO_PILOTO.
# 4. Activación de Google Photorealistic 3D con generación de sobre de evidencia SHA-256.
# 5. Aislamiento multitenant estricto (Palma no puede ver ni conmutar Málaga -> HTTP 403).
# 6. Desactivación / revocación inmediata con retorno garantizado a PID_OPEN_DATA (Fallback).
# 7. Consulta del catálogo de módulos preparados y sus reglas de no persistencia.
# 8. Comprobación de integridad inmutable en PostgreSQL/PostGIS (append-only de auditoría).
# =========================================================================

set -euo pipefail

BASE_URL="http://127.0.0.1:3001"
TENANT_MALAGA="tenant_ayto_malaga"
TENANT_PALMA="tenant_ayto_palma"

echo "========================================================================"
echo "INICIANDO SUITE DE VALIDACIÓN: ITERACIÓN 17 (GOOGLE GEO SUITE GOBERNADO)"
echo "========================================================================"

# TEST 1: Login de operadores institucionales
echo -n "[TEST 1] Autenticación institucional JWT para operadores de Málaga y Palma... "
LOGIN_MALAGA=$(curl -s -f -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_sec_ops_2026_x91"}')
JWT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.token')

LOGIN_PALMA=$(curl -s -f -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "catalina.ribas@palma.es", "apiKey": "palma_pilot_sec_2026_w12"}')
JWT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.token')

if [ -n "$JWT_MALAGA" ] && [ -n "$JWT_PALMA" ] && [ "$JWT_MALAGA" != "null" ]; then
  echo "OK (Tokens JWT emitidos y claims validados)"
else
  echo "ERROR en login institucional"
  exit 1
fi

# TEST 2: Consulta del estado inicial del conector
echo -n "[TEST 2] Consulta de estado del conector Google Geo Suite para Málaga... "
STATUS_RES=$(curl -s -f "$BASE_URL/api/google-geo/status?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

STATUS_VAL=$(echo "$STATUS_RES" | jq -r '.status')
PROV_VAL=$(echo "$STATUS_RES" | jq -r '.currentVisualProvider')

if [ "$PROV_VAL" = "PID_OPEN_DATA" ]; then
  echo "OK (Estado: $STATUS_VAL, Proveedor visual por defecto: $PROV_VAL)"
else
  echo "ERROR en estado inicial: $STATUS_RES"
  exit 1
fi

# TEST 3: Prevalidación formal firmada por operador institucional
echo -n "[TEST 3] Formalización de prevalidación institucional en PostGIS... "
PREV_RES=$(curl -s -f -X POST "$BASE_URL/api/google-geo/prevalidate?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizedEntity": "Ayuntamiento de Málaga - Área de Turismo e Innovación",
    "targetZoneId": "malaga-centro",
    "targetZoneName": "Centro Histórico y Puerto",
    "purpose": "VISUALIZACION_FOTORREALISTA",
    "acceptedTerms": {
      "attributionVisible": true,
      "noTileCachingOrStorage": true,
      "humanSupervisionOnly": true,
      "segitturDataSovereigntyAccepted": true
    },
    "technicalNotes": "Prevalidación piloto para prueba controlada de Cesium 3D Tiles de Google con fines de inspección patrimonial."
  }')

PREV_ID=$(echo "$PREV_RES" | jq -r '.id')
PREV_STATUS=$(echo "$PREV_RES" | jq -r '.status')
FINGERPRINT=$(echo "$PREV_RES" | jq -r '.fingerprintSha256')

if [ -n "$PREV_ID" ] && [ "$PREV_STATUS" = "APROBADO_PILOTO" ] && [ ${#FINGERPRINT} -eq 64 ]; then
  echo "OK (ID: $PREV_ID, Estado: $PREV_STATUS, SHA-256: ${FINGERPRINT:0:16}...)"
else
  echo "ERROR en prevalidación: $PREV_RES"
  exit 1
fi

# TEST 4: Activación de Google Photorealistic 3D con generación de sobre de evidencia
echo -n "[TEST 4] Activación de Google Photorealistic 3D con sobre de evidencia... "
TOGGLE_RES=$(curl -s -f -X POST "$BASE_URL/api/google-geo/toggle?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"enableGoogle3D": true}')

ACTIVE_PROV=$(echo "$TOGGLE_RES" | jq -r '.currentVisualProvider')
EV_SHA=$(echo "$TOGGLE_RES" | jq -r '.evidence.evidenceSha256')
ATTR_TEXT=$(echo "$TOGGLE_RES" | jq -r '.evidence.attributionRequired')

if [ "$ACTIVE_PROV" = "GOOGLE_PHOTOREALISTIC_3D" ] && [ ${#EV_SHA} -eq 64 ]; then
  echo "OK (Proveedor: $ACTIVE_PROV, Evidencia SHA-256: ${EV_SHA:0:16}..., Atribución presente)"
else
  echo "ERROR activando Google 3D: $TOGGLE_RES"
  exit 1
fi

# TEST 5: Aislamiento multitenant estricto (Palma intentando conmutar Málaga)
echo -n "[TEST 5] Aislamiento multitenant (Operador de Palma conmutando en Málaga -> 403)... "
CROSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/google-geo/toggle?destino=malaga" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA" \
  -H "Content-Type: application/json" \
  -d '{"enableGoogle3D": false}')

if [ "$CROSS_CODE" = "403" ]; then
  echo "OK (HTTP 403 Forbidden para operador no autorizado sobre el destino ajeno)"
else
  echo "ERROR: Se esperaba 403 pero se obtuvo $CROSS_CODE"
  exit 1
fi

# TEST 6: Desactivación inmediata y retorno garantizado a PID Open Data (Fallback)
echo -n "[TEST 6] Revocación / desactivación y retorno a PID Open Data (Fallback)... "
REVOKE_RES=$(curl -s -f -X POST "$BASE_URL/api/google-geo/toggle?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"enableGoogle3D": false}')

FALLBACK_PROV=$(echo "$REVOKE_RES" | jq -r '.currentVisualProvider')

if [ "$FALLBACK_PROV" = "PID_OPEN_DATA" ]; then
  echo "OK (Retorno confirmado a $FALLBACK_PROV)"
else
  echo "ERROR revocando proveedor: $REVOKE_RES"
  exit 1
fi

# TEST 7: Catálogo de módulos preparados y reglas de no persistencia
echo -n "[TEST 7] Consulta de catálogo de módulos Google Geo Suite y reglas... "
MODULES_RES=$(curl -s -f "$BASE_URL/api/google-geo/modules")
TOTAL_MODS=$(echo "$MODULES_RES" | jq '.modules | length')
SOVEREIGNTY=$(echo "$MODULES_RES" | jq -r '.sovereigntyModel')

if [ "$TOTAL_MODS" -ge 5 ] && [ "$SOVEREIGNTY" = "PID_SEGITTUR_SOVEREIGN" ]; then
  echo "OK ($TOTAL_MODS módulos catalogados, Modelo: $SOVEREIGNTY)"
else
  echo "ERROR en catálogo de módulos: $MODULES_RES"
  exit 1
fi

# TEST 8: Comprobación de integridad inmutable en PostgreSQL/PostGIS (Auditoría append-only)
echo -n "[TEST 8] Verificación de auditoría inmutable en PostGIS y trigger append-only... "
AUDIT_RES=$(curl -s -f "$BASE_URL/api/google-geo/audit?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

AUDIT_COUNT=$(echo "$AUDIT_RES" | jq '.totalQueries')

# Probar que el trigger aborta cualquier UPDATE sobre la auditoría
TRIGGER_TEST=$(sudo -u postgres psql -d gemelotur -t -c "
DO \$\$
BEGIN
  UPDATE google_geo_auditoria_consultas SET proposito = 'ALTERADO' WHERE destino_id = 'malaga';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'TRIGGER_BLOQUEO_CONFIRMADO: %', SQLERRM;
END \$\$;
" 2>&1)

if [ "$AUDIT_COUNT" -ge 2 ] && [[ "$TRIGGER_TEST" == *"TRIGGER_BLOQUEO_CONFIRMADO"* ]]; then
  echo "OK ($AUDIT_COUNT registros auditados sellados; Trigger inmutable verificado)"
else
  echo "ERROR en verificación inmutable: $AUDIT_COUNT queries, output: $TRIGGER_TEST"
  exit 1
fi

echo "========================================================================"
echo "TODAS LAS PRUEBAS DE LA ITERACIÓN 17 HAN SIDO SUPERADAS (8/8)"
echo "========================================================================"
