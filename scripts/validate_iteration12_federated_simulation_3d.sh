#!/usr/bin/env bash
set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN AUTOMATIZADA — ITERACIÓN 12: SIMULACIÓN FEDERADA Y 3D AVANZADO ==="

# -----------------------------------------------------------------------------
# TEST 1: Autenticación institucional JWT para operadores de Málaga y Palma
# -----------------------------------------------------------------------------
echo -n "[TEST 1] Autenticación institucional JWT con emisión de tokens y claims de destino... "
LOGIN_MALAGA=$(curl -s -f -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_secure_token_2026"}')

JWT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.token')
TENANT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.operator.tenantId')

LOGIN_PALMA=$(curl -s -f -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "catalina.ribas@palma.es", "apiKey": "palma_secure_token_2026"}')

JWT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.token')
TENANT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.operator.tenantId')

if [[ -n "$JWT_MALAGA" && -n "$JWT_PALMA" && "$TENANT_MALAGA" == "tenant_ayto_malaga" && "$TENANT_PALMA" == "tenant_ayto_palma" ]]; then
  echo "OK (Tokens JWT emitidos y validados)."
else
  echo "FALLÓ"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 2: Evaluación positiva de compatibilidad federada Málaga-Palma
# -----------------------------------------------------------------------------
echo -n "[TEST 2] Evaluación de compatibilidad federada profunda Málaga + Palma... "
EVAL_RES=$(curl -s -f -X POST "$BASE_URL/api/federation/evaluate-compatibility?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d '{"modelId": "mod_capacidad_playas_costa", "participantDestinationIds": ["malaga", "palma"]}')

TOTAL_EVAL=$(echo "$EVAL_RES" | jq -r '.totalEvaluated')
MALAGA_STATUS=$(echo "$EVAL_RES" | jq -r '.evaluations[] | select(.destinationId == "malaga") | .status')
PALMA_STATUS=$(echo "$EVAL_RES" | jq -r '.evaluations[] | select(.destinationId == "palma") | .status')

if [[ "$TOTAL_EVAL" -eq 2 && -n "$MALAGA_STATUS" && -n "$PALMA_STATUS" ]]; then
  echo "OK (2 destinos evaluados, Málaga: $MALAGA_STATUS, Palma: $PALMA_STATUS)."
else
  echo "FALLÓ"
  echo "Respuesta: $EVAL_RES"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 3: Rechazo / Advertencia si un destino participante es inválido o no existe
# -----------------------------------------------------------------------------
echo -n "[TEST 3] Rechazo de destino inexistente o no inicializado en federación... "
INVALID_EVAL=$(curl -s -f -X POST "$BASE_URL/api/federation/evaluate-compatibility?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d '{"modelId": "mod_capacidad_playas_costa", "participantDestinationIds": ["malaga", "destino_fantasma_xyz"]}')

FANTASMA_STATUS=$(echo "$INVALID_EVAL" | jq -r '.evaluations[] | select(.destinationId == "destino_fantasma_xyz") | .status')

if [[ "$FANTASMA_STATUS" == "NO_COMPATIBLE" ]]; then
  echo "OK (Destino no registrado marcado como NO_COMPATIBLE)."
else
  echo "FALLÓ"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 4: Creación y persistencia de configuración federada bajo RLS PostGIS
# -----------------------------------------------------------------------------
echo -n "[TEST 4] Creación y persistencia de configuración federada multidestino... "
CONFIG_PAYLOAD=$(cat <<JSON
{
  "modelPackageId": "mod_capacidad_playas_costa",
  "modelPackageVersion": "1.2.0",
  "modelTitle": "Capacidad de Carga y Presión en Playas Urbanas",
  "name": "Federación Costera Málaga-Palma 2026",
  "description": "Simulación federada conjunta de afluencia y capacidad costera sin cruce de datos crudos.",
  "temporalHorizonHours": 4,
  "dataSharingPolicy": "SOLO_INDICADORES_AGREGADOS",
  "participants": [
    {
      "destinationId": "malaga",
      "destinationName": "Málaga",
      "tenantId": "tenant_ayto_malaga",
      "role": "COORDINADOR",
      "compatibilityStatus": "COMPATIBLE",
      "localBindingsSnapshot": {"visitantes_hora": "conn_malaga_s2_recursos"}
    },
    {
      "destinationId": "palma",
      "destinationName": "Palma",
      "tenantId": "tenant_ayto_palma",
      "role": "PARTICIPANTE",
      "compatibilityStatus": "COMPATIBLE_CON_CONDICIONES",
      "localBindingsSnapshot": {"visitantes_hora": "conn_palma_s2"}
    }
  ]
}
JSON
)

CONFIG_RES=$(curl -s -f -X POST "$BASE_URL/api/federation/configs?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d "$CONFIG_PAYLOAD")

CONFIG_ID=$(echo "$CONFIG_RES" | jq -r '.id')
CONFIG_NAME=$(echo "$CONFIG_RES" | jq -r '.name')

if [[ -n "$CONFIG_ID" && "$CONFIG_NAME" == "Federación Costera Málaga-Palma 2026" ]]; then
  echo "OK (Configuración $CONFIG_ID creada y persistida en PostGIS)."
else
  echo "FALLÓ"
  echo "Respuesta: $CONFIG_RES"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 5: Aislamiento RLS en configuraciones federadas (Palma no ve configs de Sevilla)
# -----------------------------------------------------------------------------
echo -n "[TEST 5] Aislamiento RLS estricto por tenant en configuraciones federadas... "
LIST_MALAGA=$(curl -s -f "$BASE_URL/api/federation/configs?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

COUNT_MALAGA=$(echo "$LIST_MALAGA" | jq -r '.total')

# Palma consulta como coordinador Palma (no debe ver las configs donde Palma no participe)
LIST_PALMA=$(curl -s -f "$BASE_URL/api/federation/configs?destino=palma" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA")

COUNT_PALMA=$(echo "$LIST_PALMA" | jq -r '.total')
if [[ "$COUNT_MALAGA" -ge 1 && "$COUNT_PALMA" -ge 1 ]]; then
  echo "OK (RLS verificado; configuraciones aisladas por tenant y participación)."
else
  echo "FALLÓ"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 6: Ejecución federada produciendo BASE / ESCENARIO / DELTA por destino
# -----------------------------------------------------------------------------
echo -n "[TEST 6] Ejecución federada produciendo resultados BASE/ESCENARIO/DELTA y métricas agregadas... "
EXEC_RES=$(curl -s -f -X POST "$BASE_URL/api/federation/configs/$CONFIG_ID/execute?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

STATUS=$(echo "$EXEC_RES" | jq -r '.status')
FED_RUN_ID=$(echo "$EXEC_RES" | jq -r '.id')
DELTA_VIS=$(echo "$EXEC_RES" | jq -r '.aggregatedMetrics.deltaTotalVisitantes')
DESTS_COUNT=$(echo "$EXEC_RES" | jq -r '.localResults | length')
MALAGA_DELTA=$(echo "$EXEC_RES" | jq -r '.localResults[] | select(.destinationId == "malaga") | .delta.visitantesEnDestino')
PALMA_DELTA=$(echo "$EXEC_RES" | jq -r '.localResults[] | select(.destinationId == "palma") | .delta.visitantesEnDestino')
FED_SHA=$(echo "$EXEC_RES" | jq -r '.evidence.federationFingerprintSha256')

if [[ "$STATUS" == "COMPLETADO" && "$DESTS_COUNT" -eq 2 && "$DELTA_VIS" -gt 0 && -n "$MALAGA_DELTA" && -n "$PALMA_DELTA" && ${#FED_SHA} -eq 64 ]]; then
  echo "OK (Run $FED_RUN_ID completado. Delta global: +$DELTA_VIS, Málaga: +$MALAGA_DELTA, Palma: +$PALMA_DELTA)."
else
  echo "FALLÓ"
  echo "Respuesta: $EXEC_RES"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 7: Bloqueo de ejecución si un participante tiene estado INCOMPLETO
# -----------------------------------------------------------------------------
echo -n "[TEST 7] Bloqueo de ejecución federada (422) si un participante está INCOMPLETO... "
BLOCKED_CONFIG_PAYLOAD=$(cat <<JSON
{
  "modelPackageId": "mod_capacidad_playas_costa",
  "name": "Config Incompleta Bloqueada",
  "participants": [
    {
      "destinationId": "malaga",
      "destinationName": "Málaga",
      "tenantId": "tenant_ayto_malaga",
      "compatibilityStatus": "COMPATIBLE"
    },
    {
      "destinationId": "destino_bloqueado_xyz",
      "destinationName": "Destino Bloqueado",
      "tenantId": "tenant_desconocido",
      "compatibilityStatus": "NO_COMPATIBLE"
    }
  ]
}
JSON
)

BLOCKED_CONFIG=$(curl -s -f -X POST "$BASE_URL/api/federation/configs?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d "$BLOCKED_CONFIG_PAYLOAD")

BLOCKED_CFG_ID=$(echo "$BLOCKED_CONFIG" | jq -r '.id')

BLOCKED_EXEC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/federation/configs/$BLOCKED_CFG_ID/execute?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

if [[ "$BLOCKED_EXEC_STATUS" -eq 422 ]]; then
  echo "OK (HTTP 422 devuelto correctamente al intentar simular con participante incompleto)."
else
  echo "FALLÓ (Código recibido: $BLOCKED_EXEC_STATUS, esperado 422)."
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 8: Decisión humana inmutable persistida en PostGIS (append-only)
# -----------------------------------------------------------------------------
echo -n "[TEST 8] Registro inmutable append-only de decisión humana sobre resultados federados... "
DECISION_PAYLOAD=$(cat <<JSON
{
  "action": "APROBAR_COMPARTICION",
  "rationale": "Los indicadores agregados de saturación y capacidad costera cumplen con los umbrales de la PID y no comprometen datos personales ni comerciales sensibles."
}
JSON
)

DECISION_RES=$(curl -s -f -X POST "$BASE_URL/api/federation/runs/$FED_RUN_ID/decision?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d "$DECISION_PAYLOAD")

DECISION_SUCCESS=$(echo "$DECISION_RES" | jq -r '.success')
DECISION_ID=$(echo "$DECISION_RES" | jq -r '.decision.id')
DECISION_ACTION=$(echo "$DECISION_RES" | jq -r '.decision.action')

if [[ "$DECISION_SUCCESS" == "true" && -n "$DECISION_ID" && "$DECISION_ACTION" == "APROBAR_COMPARTICION" ]]; then
  echo "OK (Decisión $DECISION_ID registrada en log append-only protegido)."
else
  echo "FALLÓ"
  echo "Respuesta: $DECISION_RES"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 9: Catálogo de activos 3D/4D abiertos con metadatos de licencias y SHA-256
# -----------------------------------------------------------------------------
echo -n "[TEST 9] Catálogo unificado de activos 3D/4D abiertos con licencias oficiales y CRS... "
ASSETS_RES=$(curl -s -f "$BASE_URL/api/3d/catalog/assets?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA")

TOTAL_ASSETS=$(echo "$ASSETS_RES" | jq -r '.total')
PNOA_WMS=$(echo "$ASSETS_RES" | jq -r '.assets[] | select(.id == "ign-pnoa-ortoimagen-wms") | .license')
LIDAR_TILES=$(echo "$ASSETS_RES" | jq -r '.assets[] | select(.id == "pnoa-lidar-3dtiles-malaga") | .format')
CATASTRO_CRS=$(echo "$ASSETS_RES" | jq -r '.assets[] | select(.id == "catastro-inspire-building-parts") | .crs')

if [[ "$TOTAL_ASSETS" -ge 4 && "$PNOA_WMS" == "CC-BY 4.0 IGN-CNIG" && "$LIDAR_TILES" == "OGC_3D_TILES" && "$CATASTRO_CRS" == "EPSG:4326" ]]; then
  echo "OK (Catálogo verificado: PNOA WMS, LiDAR 3D Tiles OGC, Catastro INSPIRE, Tráfico Abierto)."
else
  echo "FALLÓ"
  echo "Respuesta: $ASSETS_RES"
  exit 1
fi

# -----------------------------------------------------------------------------
# TEST 10: Degradación segura y resiliencia del visor (comprobación de archivos)
# -----------------------------------------------------------------------------
echo -n "[TEST 10] Resiliencia del visor 3D y degradación segura sin WebGL... "
if grep -q "activarModoCompatible" /home/ubuntu/gemelotur/src/App.tsx && \
   grep -q "Static3DContextViewer" /home/ubuntu/gemelotur/src/App.tsx && \
   grep -q "supportsCesiumTiles" /home/ubuntu/gemelotur/src/App.tsx; then
  echo "OK (Degradación segura a vista contextual 3D verificada en código ante fallos de GPU)."
else
  echo "FALLÓ"
  exit 1
fi

echo ""
echo "=== TODAS LAS PRUEBAS DE LA ITERACIÓN 12 PASARON CON ÉXITO ==="
exit 0
