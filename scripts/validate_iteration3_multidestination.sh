#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
PACKAGE="${PACKAGE:-context-package/examples/context-package-v1-destino-demostrador.json}"
PARAMETERS='{"umbralSaturacionAlerta":85,"pesoCapacidadFisica":0.6,"pesoCapacidadPsicologica":0.4,"tasaEmisionKgCo2PorPersonaHora":0.12,"incrementoVisitantesManualPct":0,"franjaHoraria":"12:00","condicionClima":"DESPEJADO","horaSimulacion":12,"intensidadEscenario":1,"factorCapacidadOperativa":1,"factorMovilidad":1}'

require() { command -v "$1" >/dev/null || { echo "Falta el comando requerido: $1" >&2; exit 1; }; }
require curl
require jq

for_status() {
  local expected="$1"; shift
  local actual
  actual=$(curl -s -o /tmp/iteration3-response.json -w '%{http_code}' "$@")
  test "$actual" = "$expected" || {
    echo "HTTP esperado ${expected}, recibido ${actual}" >&2
    cat /tmp/iteration3-response.json >&2
    exit 1
  }
}

tenant_for() {
  case "$1" in
    malaga) printf '%s' 'tenant_ayto_malaga' ;;
    palma) printf '%s' 'tenant_ayto_palma' ;;
    destino-demostrador) jq -r '.tenant.id' "$PACKAGE" ;;
    *) return 1 ;;
  esac
}

run() {
  local destination_id="$1"
  local scenario_id="$2"
  local tenant_id
  tenant_id=$(tenant_for "$destination_id")
  local body
  body=$(jq -nc --arg destinationId "$destination_id" --arg scenarioId "$scenario_id" --arg actor 'qa-iteration3' --argjson parameters "$PARAMETERS" '{destinationId:$destinationId,scenarioId:$scenarioId,actor:$actor,parameters:$parameters}')
  curl -fsS -X POST "$BASE_URL/api/runs/simulations" \
    -H 'Content-Type: application/json' \
    -H "X-PID-Tenant: ${tenant_id}" \
    -d "$body"
}

curl -fsS "$BASE_URL/api/health" | jq -e '.status == "ONLINE" and .mode == "STANDALONE_MEMORY_DEMO"' >/dev/null

for_status '422' -X POST "$BASE_URL/api/runs/simulations" -H 'Content-Type: application/json' -d '{}'
for_status '401' -X POST "$BASE_URL/api/runs/simulations" -H 'Content-Type: application/json' -d '{"destinationId":"malaga"}'
for_status '403' -X POST "$BASE_URL/api/runs/simulations" -H 'Content-Type: application/json' -H 'X-PID-Tenant: tenant_ayto_palma' -d '{"destinationId":"malaga"}'
for_status '422' -X POST "$BASE_URL/api/runs/simulations" -H 'Content-Type: application/json' -H 'X-PID-Tenant: tenant_ayto_malaga' -d '{"destinationId":"malaga","scenarioId":"presion-alta-demanda"}'
for_status '422' -X POST "$BASE_URL/api/runs/simulations" -H 'Content-Type: application/json' -H 'X-PID-Tenant: tenant_ayto_malaga' -d '{"destinationId":"malaga","scenarioId":"presion-alta-demanda","parameters":{"factorCapacidadOperativa":"invalido"}}'

first_run=$(run 'malaga' 'presion-alta-demanda')
printf '%s' "$first_run" | jq -e '
  .valid
  and .run.destinationId == "malaga"
  and .run.tenantId == "tenant_ayto_malaga"
  and .run.comparison.base.variacionVsMedia == 0
  and .run.comparison.base.alertasActivasCount == .run.outputs.base.indicadoresActuales.alertasActivasCount
  and .run.comparison.delta != null
  and (.run.evidence.contextFingerprint | length) == 64
  and (.run.evidence.sources | length) > 0
' >/dev/null
first_run_id=$(printf '%s' "$first_run" | jq -r '.run.id')

run 'palma' 'evento-local' | jq -e '.valid and .run.destinationId == "palma" and .run.tenantId == "tenant_ayto_palma"' >/dev/null

if ! curl -fsS "$BASE_URL/api/context-packages/destinations" | jq -e '.destinations[]?.destination.id == "destino-demostrador"' >/dev/null; then
  curl -fsS -X POST "$BASE_URL/api/context-packages/import" \
    -H 'Content-Type: application/json' \
    --data-binary "@${PACKAGE}" | jq -e '.type == "ContextPackageImportResult"' >/dev/null
fi

run 'destino-demostrador' 'episodio-meteorologico' | jq -e '
  .valid
  and .run.evidence.origin == "CONTEXT_PACKAGE_V1"
  and .run.comparison.delta != null
' >/dev/null

for_status '404' -H 'X-PID-Tenant: tenant_ayto_palma' "$BASE_URL/api/runs/${first_run_id}?destino=palma"
for_status '404' "$BASE_URL/api/3d/datasets/ds3d_malaga_lidar_2024/manifest?destino=palma"

curl -fsS -H 'X-PID-Tenant: tenant_ayto_malaga' "$BASE_URL/api/runs/${first_run_id}/export?destino=malaga&format=geojson" | jq -e '
  .type == "FeatureCollection"
  and .resultKind == "SIMULATION_DERIVED"
  and ([.features[].properties.resultKind] | unique) == ["SIMULATION_DERIVED"]
' >/dev/null

if rg -n -i 'sevilla|malaga|palma' \
  src/engine \
  src/services/destinationRuntimeService.ts \
  src/services/scenarioPresetFactory.ts \
  src/services/simulationRunService.ts \
  src/services/syntheticForecast.ts \
  server.ts; then
  echo 'Se encontraron referencias de ciudad en el flujo común.' >&2
  exit 1
fi

echo 'ITERATION_3_MULTIDESTINATION_VALIDATION_OK'
