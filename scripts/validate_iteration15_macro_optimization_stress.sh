#!/usr/bin/env bash
# =============================================================================
# SUITE DE VALIDACIÓN AUTOMATIZADA — ITERACIÓN 15
# Simulación Macroeconómica, Optimización de Flujos y Pruebas de Estrés
# =============================================================================

set -euo pipefail
umask 077

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
DESTINO="malaga"

# Credenciales de demostración: se inyectan solo por entorno, nunca se versionan.
: "${PID_TEST_MALAGA_USERNAME:?Falta PID_TEST_MALAGA_USERNAME}"
: "${PID_TEST_MALAGA_API_KEY:?Falta PID_TEST_MALAGA_API_KEY}"
: "${PID_TEST_PALMA_USERNAME:?Falta PID_TEST_PALMA_USERNAME}"
: "${PID_TEST_PALMA_API_KEY:?Falta PID_TEST_PALMA_API_KEY}"

if [[ "$BASE_URL" != "http://127.0.0.1:3001" ]]; then
  echo "ERROR: Este validador mutante solo admite el backend local de demostración." >&2
  exit 2
fi
if [[ "${ALLOW_MUTATING_DEMO_TESTS:-}" != "1" ]]; then
  echo "ERROR: Esta suite crea decisiones y realiza intentos controlados de escritura. Ejecutar solo con ALLOW_MUTATING_DEMO_TESTS=1 en una base de demostración aislada." >&2
  exit 2
fi
PASS=0
FAIL=0

echo "=== INICIANDO VALIDACIÓN DE LA ITERACIÓN 15 ==="

# Helper de aserción
assert_equals() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" == "$actual" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc -> Esperado: '$expected', Obtenido: '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc -> No se encontró '$needle' en la respuesta"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Login institucional y obtención de Token JWT
login_institutional() {
  local username="$1"
  local api_key="$2"
  jq -cn --arg username "$username" --arg apiKey "$api_key" '{username: $username, apiKey: $apiKey}' | \
    curl -s -f -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" --data-binary @-
}

echo "TEST 1: Autenticación de Operador Institucional de Málaga"
LOGIN_MALAGA=$(login_institutional "$PID_TEST_MALAGA_USERNAME" "$PID_TEST_MALAGA_API_KEY")

JWT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.token')
TENANT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.operator.tenantId')

assert_contains "Token JWT obtenido" "eyJ" "$JWT_MALAGA"
assert_equals "Tenant correcto" "tenant_ayto_malaga" "$TENANT_MALAGA"

# Login de Operador de Palma
LOGIN_PALMA=$(login_institutional "$PID_TEST_PALMA_USERNAME" "$PID_TEST_PALMA_API_KEY")

JWT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.token')
TENANT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.operator.tenantId')

# 2. Simulación de Impacto Macroeconómico
echo "TEST 2: Simulación de Impacto Macroeconómico (+25% afluencia)"
MACRO_RES=$(curl -s -f -X POST "$BASE_URL/api/macro/simulate?destino=$DESTINO" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"scenarioTitle": "Pico Turístico de Fin de Semana", "visitorDeltaPct": 25.0}')

assert_equals "Modelo macroeconómico PID" "mod_impacto_macroeconomico_pid" "$(echo "$MACRO_RES" | jq -r '.modelId')"
assert_contains "Tiene VAB escenario calculado" "grossValueAddedEuros" "$(echo "$MACRO_RES" | jq -r '.metrics.scenario | keys | join(",")')"
assert_contains "Tiene retorno fiscal" "totalFiscalRevenueEuros" "$(echo "$MACRO_RES" | jq -r '.metrics.scenario.fiscalReturnEuros | keys | join(",")')"
assert_contains "Tiene externalidades evaluadas" "totalExternalitiesCostEuros" "$(echo "$MACRO_RES" | jq -r '.metrics.scenario.externalitiesCostEuros | keys | join(",")')"

DELTA_SPEND=$(echo "$MACRO_RES" | jq -r '.metrics.delta.spendDiffEuros')
if (( $(echo "$DELTA_SPEND > 0" | bc -l) )); then
  echo "  [PASS] Delta de gasto directo positivo ($DELTA_SPEND €)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Delta de gasto directo no es positivo ($DELTA_SPEND)"
  FAIL=$((FAIL + 1))
fi

# 3. Propuesta de Optimización de Flujos
echo "TEST 3: Generación de Propuesta de Balanceo de Flujos"
OPT_PROP=$(curl -s -f -X POST "$BASE_URL/api/optimization/proposals/generate?destino=$DESTINO" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"criticalThresholdPct": 80}')

PROP_ID=$(echo "$OPT_PROP" | jq -r '.id')
assert_equals "Estado inicial de propuesta" "PENDIENTE_FIRMA" "$(echo "$OPT_PROP" | jq -r '.status')"
assert_contains "Contiene rutas sugeridas" "sourceZoneName" "$(echo "$OPT_PROP" | jq -r '.suggestedRoutes[0] | keys | join(",")')"

# 4. Decisión Humana sobre Optimización
echo "TEST 4: Firma y Aprobación Institucional de la Propuesta de Optimización"
DECISION_RES=$(curl -s -f -X POST "$BASE_URL/api/optimization/proposals/apply?destino=$DESTINO" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{\"proposalId\": \"$PROP_ID\", \"decision\": \"APROBADA_OPERADOR\", \"rationale\": \"Aprobación del plan de descongestión con desvío peatonal y señalética dinámica.\"}")

assert_equals "Decisión exitosa" "true" "$(echo "$DECISION_RES" | jq -r '.success')"
assert_equals "Decisión inmutable registrada" "APROBADA_OPERADOR" "$(echo "$DECISION_RES" | jq -r '.decisionRecord.decision')"

# 5. Prueba de Estrés: Pico Severo en T+1, T+4 y T+24
echo "TEST 5: Ejecución de Prueba de Estrés Multiescala (PICO_SEVERO_INMINENTE)"
STRESS_RES=$(curl -s -f -X POST "$BASE_URL/api/stress-test/execute?destino=$DESTINO" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"profile": "PICO_SEVERO_INMINENTE"}')

assert_equals "Perfil ejecutado" "PICO_SEVERO_INMINENTE" "$(echo "$STRESS_RES" | jq -r '.stressProfileName')"
assert_contains "Tiene horizonte T+1" "T+1" "$(echo "$STRESS_RES" | jq -r '.horizons | keys | join(",")')"
assert_contains "Tiene horizonte T+4" "T+4" "$(echo "$STRESS_RES" | jq -r '.horizons | keys | join(",")')"
assert_contains "Tiene horizonte T+24" "T+24" "$(echo "$STRESS_RES" | jq -r '.horizons | keys | join(",")')"

SCORE_T1=$(echo "$STRESS_RES" | jq -r '.horizons["T+1"].resilienceScorePct')
SCORE_T4=$(echo "$STRESS_RES" | jq -r '.horizons["T+4"].resilienceScorePct')
echo "  [INFO] Resiliencia T+1: $SCORE_T1/100, Resiliencia T+4: $SCORE_T4/100"

# 6. Prueba de Estrés Extrema: Colapso por Evento Extraordinario
echo "TEST 6: Prueba de Estrés Extrema (COLAPSO_EVENTO_EXTRAORDINARIO)"
STRESS_EXTREMO=$(curl -s -f -X POST "$BASE_URL/api/stress-test/execute?destino=$DESTINO" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{"profile": "COLAPSO_EVENTO_EXTRAORDINARIO"}')

VEREDICTO=$(echo "$STRESS_EXTREMO" | jq -r '.globalResilienceVerdict')
assert_contains "Veredicto refleja riesgo/colapso" "RIESGO_COLAPSO_INMINENTE" "$VEREDICTO"

# 7. Aislamiento Multitenant con RLS Bicomponente (403 Forbidden cruzado)
echo "TEST 7: Aislamiento RLS — Operador de Palma intentando simular estrés en Málaga"
CROSS_RES_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/stress-test/execute?destino=malaga" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA" \
  -H "Content-Type: application/json" \
  -d '{"profile": "PICO_SEVERO_INMINENTE"}')

assert_equals "Rechazo 403 Forbidden por claims de destino cruzado" "403" "$CROSS_RES_CODE"

# 8. Auditoría inmutable de decisiones de optimización (Triggers contra alteración)
echo "TEST 8: Auditoría Inmutable — Intento de UPDATE directo en decisiones de optimización bloqueado"
if [[ ! "$PROP_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "ERROR: Identificador de propuesta con formato no permitido." >&2
  exit 1
fi
PG_ERR=$(sudo -u postgres psql -d gemelotur -c "UPDATE decisiones_optimizacion_flujos SET decision = 'ALTERADO' WHERE proposal_id = '$PROP_ID';" 2>&1 || true)
assert_contains "Trigger bloquea manipulación de auditoría" "fn_prevent_audit_tampering" "$PG_ERR"

echo "=== RESULTADO FINAL DE LA VALIDACIÓN ==="
echo "Casos aprobados: $PASS"
echo "Casos fallados:  $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "TODAS LAS PRUEBAS DE LA ITERACIÓN 15 PASARON SATISFACTORIAMENTE."
  exit 0
else
  echo "SE DETECTARON FALLOS EN LA SUITE."
  exit 1
fi
