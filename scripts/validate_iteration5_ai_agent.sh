#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3001}"
echo "================================================================================"
echo "SUITE DE VALIDACIÓN: ITERACIÓN 5 — AGENTE IA PARA SIMULACIONES EN LENGUAJE NATURAL"
echo "Destino: Multidestino PID (Málaga, Palma, Destino Demostrador ContextPackage)"
echo "Gobernanza: Vinculación Obligatoria a Evidencias Comprobables (Knowledge Guard)"
echo "API Base: ${API_URL}"
echo "================================================================================"

pass_count=0
fail_count=0

assert_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" == "$expected" ]; then
    echo "  [PASS] $label: $actual"
    pass_count=$((pass_count + 1))
  else
    echo "  [FAIL] $label: esperado '$expected', obtenido '$actual'"
    fail_count=$((fail_count + 1))
  fi
}

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  [PASS] $label contiene '$needle'"
    pass_count=$((pass_count + 1))
  else
    echo "  [FAIL] $label no contiene '$needle' (valor: $haystack)"
    fail_count=$((fail_count + 1))
  fi
}

assert_gt() {
  local label="$1"
  local actual="$2"
  local min="$3"
  if [ "$actual" -gt "$min" ]; then
    echo "  [PASS] $label ($actual > $min)"
    pass_count=$((pass_count + 1))
  else
    echo "  [FAIL] $label ($actual no es mayor que $min)"
    fail_count=$((fail_count + 1))
  fi
}

echo ""
echo "--- 1. Salud del sistema y capacidades del Agente IA ---"
health_resp=$(curl -fsS "${API_URL}/api/health")
health_mode=$(echo "$health_resp" | jq -r '.mode')
assert_eq "Modo del servicio" "$health_mode" "POSTGIS_PERSISTED_PILOT"

# Capabilities requiere X-PID-Tenant correspondiente
http_cap_no_tenant=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/ai/capabilities?destino=malaga")
assert_eq "Capacidades sin tenant rechazada (401)" "$http_cap_no_tenant" "401"

http_cap_wrong_tenant=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/ai/capabilities?destino=malaga" -H "X-PID-Tenant: tenant_ayto_palma")
assert_eq "Capacidades con tenant cruzado rechazada (403)" "$http_cap_wrong_tenant" "403"

cap_resp=$(curl -fsS "${API_URL}/api/ai/capabilities?destino=malaga" -H "X-PID-Tenant: tenant_ayto_malaga")
cap_status=$(echo "$cap_resp" | jq -r '.status')
cap_prompts=$(echo "$cap_resp" | jq '.destinationPrompts | length')
assert_eq "Estado del agente IA" "$cap_status" "ACTIVE"
assert_gt "Número de sugerencias para Málaga" "$cap_prompts" 0

echo ""
echo "--- 2. Gobernanza y control de Scope / Tenant en simulate-prompt ---"
# Petición sin encabezado X-PID-Tenant debe retornar 401
http_no_tenant=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -d '{"destinationId": "malaga", "prompt": "Simular crucero masivo"}')
assert_eq "Rechazo sin tenant (401)" "$http_no_tenant" "401"

# Petición con tenant incorrecto debe retornar 403
http_wrong_tenant=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_palma" \
  -d '{"destinationId": "malaga", "prompt": "Simular crucero masivo"}')
assert_eq "Rechazo con tenant cruzado (403)" "$http_wrong_tenant" "403"

# Petición con prompt demasiado corto debe retornar 422
http_short_prompt=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{"destinationId": "malaga", "prompt": "hola"}')
assert_eq "Rechazo prompt insuficiente (422)" "$http_short_prompt" "422"

echo ""
echo "--- 3. Petición válida en lenguaje natural (Málaga) y Vinculación Obligatoria a Evidencias ---"
prop_malaga=$(curl -fsS -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{
    "destinationId": "malaga",
    "prompt": "¿Qué impacto tendría la llegada de 8000 cruceristas al Centro Histórico con tiempo caluroso a las 12:00?"
  }')

prop_id=$(echo "$prop_malaga" | jq -r '.id')
prop_status=$(echo "$prop_malaga" | jq -r '.status')
prop_intent=$(echo "$prop_malaga" | jq -r '.interpretation.intent')
fingerprint=$(echo "$prop_malaga" | jq -r '.evidence.contextFingerprint')
sources_count=$(echo "$prop_malaga" | jq '.evidence.dataSources | length')
first_source_trace=$(echo "$prop_malaga" | jq -r '.evidence.dataSources[0].traceabilityId')
synthetic_warning=$(echo "$prop_malaga" | jq -r '.evidence.syntheticDemoData')
actions_count=$(echo "$prop_malaga" | jq '.suggestedActions | length')
confidence=$(echo "$prop_malaga" | jq -r '.evidence.uncertainty.confidencePct')

assert_contains "ID de propuesta generado" "$prop_id" "ai-prop-"
assert_eq "Estado de la propuesta" "$prop_status" "READY_FOR_REVIEW"
assert_eq "Longitud exacta de huella criptográfica SHA-256" "${#fingerprint}" "64"
assert_gt "Fuentes de datos autorizadas citadas" "$sources_count" 0
assert_contains "Trazabilidad de fuente de evidencia" "$first_source_trace" "SEGITTUR-TR-"
assert_eq "Advertencia de datos sintéticos presente" "$synthetic_warning" "true"
assert_gt "Acciones human-in-the-loop sugeridas" "$actions_count" 1
assert_gt "Nivel de confianza calculado" "$confidence" 0

echo ""
echo "--- 4. Multidestino: Petición en lenguaje natural para Palma de Mallorca ---"
prop_palma=$(curl -fsS -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_palma" \
  -d '{
    "destinationId": "palma",
    "prompt": "Simular lluvia intensa y reducción de movilidad en Casco Antiguo a las 15:00"
  }')

palma_status=$(echo "$prop_palma" | jq -r '.status')
palma_dest=$(echo "$prop_palma" | jq -r '.destinationId')
palma_fingerprint=$(echo "$prop_palma" | jq -r '.evidence.contextFingerprint')
palma_climate=$(echo "$prop_palma" | jq -r '.scenarioDraft.inputs.climate')

assert_eq "Estado propuesta Palma" "$palma_status" "READY_FOR_REVIEW"
assert_eq "Destino de la propuesta" "$palma_dest" "palma"
assert_eq "Clima detectado en escenario" "$palma_climate" "LLUVIA"

# Comprobar que la huella de Palma es diferente a la de Málaga (aislamiento estricto)
if [ "$fingerprint" != "$palma_fingerprint" ]; then
  echo "  [PASS] Aislamiento de contexto confirmado: huellas SHA-256 distintas entre destinos"
  pass_count=$((pass_count + 1))
else
  echo "  [FAIL] Las huellas de contexto deberían ser distintas entre destinos"
  fail_count=$((fail_count + 1))
fi

echo ""
echo "--- 5. Verificación de que la propuesta NO ejecuta ni persiste automáticamente ---"
runs_before=$(curl -fsS "${API_URL}/api/runs?destino=malaga" -H "X-PID-Tenant: tenant_ayto_malaga" | jq '.runs | length')
scenarios_before=$(curl -fsS "${API_URL}/api/scenarios?destino=malaga" -H "X-PID-Tenant: tenant_ayto_malaga" | jq '.scenarios | length')

# Volver a hacer otra consulta en lenguaje natural
curl -fsS -X POST "${API_URL}/api/ai/simulate-prompt" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{
    "destinationId": "malaga",
    "prompt": "Hipótesis de festival de música masivo en el Puerto"
  }' > /dev/null

runs_after=$(curl -fsS "${API_URL}/api/runs?destino=malaga" -H "X-PID-Tenant: tenant_ayto_malaga" | jq '.runs | length')
scenarios_after=$(curl -fsS "${API_URL}/api/scenarios?destino=malaga" -H "X-PID-Tenant: tenant_ayto_malaga" | jq '.scenarios | length')

assert_eq "Corridas de simulación no alteradas (no auto-ejecución)" "$runs_after" "$runs_before"
assert_eq "Escenarios guardados no alterados (no auto-persistencia)" "$scenarios_after" "$scenarios_before"

echo ""
echo "================================================================================"
echo "RESUMEN DE PRUEBAS ITERACIÓN 5:"
echo "Pruebas superadas (PASS): ${pass_count}"
echo "Pruebas fallidas  (FAIL): ${fail_count}"
echo "================================================================================"

if [ "$fail_count" -gt 0 ]; then
  echo "La suite ha detectado errores. Revisar."
  exit 1
fi

echo "¡Validación de Iteración 5 completada satisfactoriamente!"
exit 0
