#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA ITERACIÓN 14: CALIBRACIÓN REAL Y PREDICCIÓN VALIDABLE
# 10 comprobaciones de gobernanza, RLS, factores acotados y verificación ex-post
# =============================================================================

set -euo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 14: CALIBRACIÓN Y PREDICCIÓN ==="

# 1. Login institucional para Málaga y Palma
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

echo "✓ TEST 1: Operadores autenticados correctamente con tokens JWT institucionales."

# 2. Diagnóstico inicial de cobertura territorial (debe ser SIN_COBERTURA_FORMAL o COBERTURA_PARCIAL)
COV_RES=$(curl -s -f "$BASE_URL/api/calibration/coverage?destino=malaga&modelId=mod_afluencia_peatonal_ejes" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

COV_PCT=$(echo "$COV_RES" | jq -r '.coveragePct')
echo "✓ TEST 2: Cobertura territorial evaluada para Málaga: $COV_PCT% de zonas cubiertas."

# 3. Creación de una regla formal de vínculo fuente -> zona -> variable (Estado BORRADOR)
RULE_CREATE=$(curl -s -f -X POST "$BASE_URL/api/calibration/rules?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "mod_afluencia_peatonal_ejes",
    "modelVariableId": "visitantesHora",
    "modelVariableLabel": "Afluencia Peatonal Horaria",
    "sourceType": "IOT_MQTT",
    "sourceConnectorId": "conn_iot_malaga_pedestrian",
    "sensorUrn": "urn:ngsi-ld:Device:malaga:counter:larios:01",
    "targetZoneId": "malaga_centro_historico",
    "targetZoneName": "Centro Histórico",
    "spatialCoverageType": "EXACT_ZONE",
    "expectedSourceUnit": "peatones/15min",
    "targetModelUnit": "personas/hora",
    "unitMultiplier": 4.0,
    "aggregationMethod": "TIME_WEIGHTED_AVERAGE",
    "aggregationWindowMinutes": 15,
    "minQualityRequired": "B_ESTIMADA"
  }')

RULE_ID=$(echo "$RULE_CREATE" | jq -r '.rule.id')
RULE_STATE=$(echo "$RULE_CREATE" | jq -r '.rule.approvalState')
RULE_FP=$(echo "$RULE_CREATE" | jq -r '.rule.evidenceFingerprintSha256')

if [ "$RULE_STATE" != "BORRADOR" ] || [ ${#RULE_FP} -ne 64 ]; then
  echo "ERROR en TEST 3: Regla no creada en borrador o huella SHA-256 no válida."
  exit 1
fi
echo "✓ TEST 3: Regla formal de vínculo creada en BORRADOR con ID $RULE_ID y huella SHA-256."

# 4. Aprobación formal humana de la regla por operador institucional
RULE_APPROVAL=$(curl -s -f -X POST "$BASE_URL/api/calibration/rules/$RULE_ID/approval?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "APROBADO_OPERADOR",
    "rationale": "Verificado sensor físico de la calle Larios frente a inventario municipal."
  }')

NEW_RULE_STATE=$(echo "$RULE_APPROVAL" | jq -r '.rule.approvalState')
if [ "$NEW_RULE_STATE" != "APROBADO_OPERADOR" ]; then
  echo "ERROR en TEST 4: No se actualizó la regla a APROBADO_OPERADOR."
  exit 1
fi
echo "✓ TEST 4: Regla formal aprobada por el operador institucional ($NEW_RULE_STATE)."

# 5. Generación de propuesta técnica de calibración (factores sugeridos y clamping de seguridad)
CAL_PROPOSAL=$(curl -s -f -X POST "$BASE_URL/api/calibration/proposals/generate?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"modelId": "mod_afluencia_peatonal_ejes", "windowMinutes": 60}')

PROP_ID=$(echo "$CAL_PROPOSAL" | jq -r '.id')
AVG_FACTOR=$(echo "$CAL_PROPOSAL" | jq -r '.averageFactor')
PROP_FP=$(echo "$CAL_PROPOSAL" | jq -r '.evidenceFingerprintSha256')

if [ -z "$PROP_ID" ] || [ ${#PROP_FP} -ne 64 ]; then
  echo "ERROR en TEST 5: Propuesta de calibración inválida o sin huella SHA-256."
  exit 1
fi
echo "✓ TEST 5: Propuesta de calibración generada ($PROP_ID), factor promedio ×$AVG_FACTOR."

# 6. Decisión formal humana inmutable: Firma y activación de la calibración
CAL_APPLY=$(curl -s -f -X POST "$BASE_URL/api/calibration/proposals/apply?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"proposalId\": \"$PROP_ID\",
    \"decision\": \"APROBADA\",
    \"rationale\": \"Calibración de afluencia zonal ratificada formalmente con firma institucional de Málaga.\"
  }")

ACTIVE_ID=$(echo "$CAL_APPLY" | jq -r '.activeCalibration.id')
ACTIVE_STATUS=$(echo "$CAL_APPLY" | jq -r '.activeCalibration.status')

if [ "$ACTIVE_STATUS" != "ACTIVA_VIGENTE" ]; then
  echo "ERROR en TEST 6: Calibración no activada como ACTIVA_VIGENTE."
  exit 1
fi
echo "✓ TEST 6: Calibración firmada y activada como ACTIVA_VIGENTE ($ACTIVE_ID)."

# 7. Emisión y registro formal de predicción para horizonte T+4
FC_RUN=$(curl -s -f -X POST "$BASE_URL/api/forecast/runs?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"modelId": "mod_afluencia_peatonal_ejes", "horizon": "T+4"}')

FC_ID=$(echo "$FC_RUN" | jq -r '.forecast.id')
PRED_VISITORS=$(echo "$FC_RUN" | jq -r '.forecast.predictedVisitorTotal')
FC_STATUS=$(echo "$FC_RUN" | jq -r '.forecast.status')

if [ "$FC_STATUS" != "PENDIENTE_EVALUACION" ] || [ -z "$FC_ID" ]; then
  echo "ERROR en TEST 7: Predicción no registrada o estado incorrecto."
  exit 1
fi
echo "✓ TEST 7: Predicción T+4 registrada con éxito ($FC_ID, $PRED_VISITORS pax)."

# 8. Reconciliación ex-post con valor real y cálculo de error MAE, MAPE y Sesgo
ACTUAL_OBSERVED=$((PRED_VISITORS - 80)) # Simulación de observación real posterior
RECONCILE_RES=$(curl -s -f -X POST "$BASE_URL/api/forecast/evaluations/reconcile?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"forecastRunId\": \"$FC_ID\",
    \"actualObservedValue\": $ACTUAL_OBSERVED,
    \"rationale\": \"Cotejo formal con estación de aforo físico tras el cierre del periodo T+4.\"
  }")

EVAL_ID=$(echo "$RECONCILE_RES" | jq -r '.evaluation.id')
ABS_ERROR=$(echo "$RECONCILE_RES" | jq -r '.evaluation.absoluteError')
PCT_ERROR=$(echo "$RECONCILE_RES" | jq -r '.evaluation.percentageErrorPct')
BIAS=$(echo "$RECONCILE_RES" | jq -r '.evaluation.bias')

if [ -z "$EVAL_ID" ] || [ "$BIAS" != "SOBREESTIMACION" ]; then
  echo "ERROR en TEST 8: Reconciliación ex-post fallida o sesgo erróneo."
  exit 1
fi
echo "✓ TEST 8: Predicción reconciliada ex-post: Error Absoluto=$ABS_ERROR pax, Error Relativo=$PCT_ERROR%, Sesgo=$BIAS."

# 9. Consulta de precisión histórica acumulada por horizonte
ACC_SUMMARY=$(curl -s -f "$BASE_URL/api/forecast/accuracy?destino=malaga&modelId=mod_afluencia_peatonal_ejes" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

TOTAL_EVALS=$(echo "$ACC_SUMMARY" | jq -r '.totalEvaluations')
if [ "$TOTAL_EVALS" -lt 1 ]; then
  echo "ERROR en TEST 9: El resumen estadístico no registra la evaluación recién creada."
  exit 1
fi
echo "✓ TEST 9: Precisión histórica acumulada consultada ($TOTAL_EVALS evaluaciones registradas)."

# 10. Aislamiento RLS Multidestino Estricto: Operador de Palma no puede operar reglas ni calibraciones de Málaga (403)
CROSS_TENANT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/calibration/rules/$RULE_ID/approval?destino=malaga" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA" \
  -H "Content-Type: application/json" \
  -d '{"state": "SUSPENDIDO", "rationale": "Ataque cruzado indebido"}')

if [ "$CROSS_TENANT_STATUS" -ne 403 ]; then
  echo "ERROR en TEST 10: Se esperaba 403 Forbidden para operador cruzado, pero se obtuvo $CROSS_TENANT_STATUS."
  exit 1
fi
echo "✓ TEST 10: Aislamiento RLS multidestino forzado y verificado (403 Forbidden para operador cruzado)."

echo "=== VALIDACIÓN COMPLETADA CON ÉXITO: 10/10 CASOS SUPERADOS ==="
