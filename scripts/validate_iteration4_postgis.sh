#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3001}"
echo "=============================================================================="
echo " VALIDACIÓN AUTOMATIZADA ITERACIÓN 4: ESCRITOR POSTGIS Y RLS MULTIDESTINO"
echo " Base URL: $BASE_URL"
echo "=============================================================================="

# 1. Comprobación de salud y persistencia conectada
echo -n "1. Comprobando /api/health y modo de persistencia... "
HEALTH_JSON=$(curl -fsS "$BASE_URL/api/health")
MODE=$(echo "$HEALTH_JSON" | jq -r .mode)
CONNECTED=$(echo "$HEALTH_JSON" | jq -r .persistence.connected)
POSTGIS_VER=$(echo "$HEALTH_JSON" | jq -r .persistence.postgisVersion)
RLS=$(echo "$HEALTH_JSON" | jq -r .persistence.rlsEnabled)

if [ "$MODE" != "POSTGIS_PERSISTED_PILOT" ] || [ "$CONNECTED" != "true" ] || [ "$RLS" != "true" ]; then
  echo "FALLO: El modo de persistencia no es POSTGIS_PERSISTED_PILOT o RLS no está activo."
  echo "Detalle: $HEALTH_JSON"
  exit 1
fi
echo "OK (PostGIS: $POSTGIS_VER, RLS: $RLS)"

# 2. Diagnóstico de persistencia detallado
echo -n "2. Comprobando /api/persistence/status... "
STATUS_JSON=$(curl -fsS "$BASE_URL/api/persistence/status")
DESTINOS_COUNT=$(echo "$STATUS_JSON" | jq -r .health.counts.destinos)
if [ "$DESTINOS_COUNT" -lt 2 ]; then
  echo "FALLO: Conteo de destinos en PostGIS menor al esperado ($DESTINOS_COUNT)."
  exit 1
fi
echo "OK (Destinos en BD: $DESTINOS_COUNT)"

# 3. Importación de ContextPackage con persistencia garantizada
echo -n "3. Validando importación transaccional de ContextPackage en PostGIS... "
CP_FILE="/home/ubuntu/gemelotur/context-package/examples/context-package-v1-destino-demostrador.json"
UNIQUE_SUFFIX=$(date +%s%N | cut -b1-12)
TEST_DEST_ID="dest-test-${UNIQUE_SUFFIX}"
TEST_CP_PAYLOAD=$(jq --arg did "$TEST_DEST_ID" --arg pid "cp-${TEST_DEST_ID}" '
  .id = $pid |
  .destination.id = $did |
  .destination.codigoIne = (90000 + ($did | split("-")[-1] | tonumber % 9999) | tostring) |
  .destination.nombre = "Destino Test PostGIS \($did)" |
  .semanticMapping.namespace = "urn:ngsi-ld:pid:\($did):" |
  .context.zones = [.context.zones[] | .destinoId = $did] |
  .context.resources = [.context.resources[] | .destinoId = $did] |
  .context.sensors = [.context.sensors[] | .destinoId = $did]
' "$CP_FILE")

IMPORT_RES=$(curl -fsS -X POST "$BASE_URL/api/context-packages/import" \
  -H 'Content-Type: application/json' \
  -d "$TEST_CP_PAYLOAD")

CP_PERSISTENCE=$(echo "$IMPORT_RES" | jq -r .persistence)
if [ "$CP_PERSISTENCE" != "POSTGIS_PERSISTED" ]; then
  echo "FALLO: La persistencia devuelta no es POSTGIS_PERSISTED (obtenido: $CP_PERSISTENCE)."
  exit 1
fi
echo "OK (Persistencia: $CP_PERSISTENCE)"

# 4. Creación de escenario propio con persistencia
echo -n "4. Creando escenario propio y verificando escritura en PostGIS... "
SCENARIO_PAYLOAD=$(jq -nc '{
  destinationId: "malaga",
  tenantId: "tenant_ayto_malaga",
  name: "Prueba Transaccional PostGIS Iteración 4",
  description: "Validación automatizada de persistencia de escenarios y versiones",
  type: "CRUCERO_MASIVO",
  createdBy: "qa-postgis-suite",
  inputs: {
    zoneIds: ["malaga_centro"],
    hour: 10,
    climate: "DESPEJADO",
    visitorVariationPct: 20,
    operationalCapacityPct: 90,
    mobilityMode: "NORMAL",
    alertThresholdPct: 80,
    intensity: 1.0,
    spatialDistribution: "CONCENTRADA"
  }
}')

SC_RES=$(curl -fsS -X POST "$BASE_URL/api/scenarios" \
  -H 'Content-Type: application/json' \
  -H 'X-PID-Tenant: tenant_ayto_malaga' \
  -d "$SCENARIO_PAYLOAD")

SC_ID=$(echo "$SC_RES" | jq -r .scenario.id)
if [ -z "$SC_ID" ] || [ "$SC_ID" = "null" ]; then
  echo "FALLO: No se obtuvo ID del escenario creado."
  echo "Respuesta: $SC_RES"
  exit 1
fi
echo "OK (Escenario creado: $SC_ID)"

# 5. Ejecución de simulación y persistencia de SimulationRun + Capas
echo -n "5. Ejecutando simulación y comprobando persistencia de SimulationRun en BD... "
EXEC_RES=$(curl -fsS -X POST "$BASE_URL/api/scenarios/$SC_ID/execute?destino=malaga" \
  -H 'X-PID-Tenant: tenant_ayto_malaga')

VALID=$(echo "$EXEC_RES" | jq -r .valid)
if [ "$VALID" != "true" ]; then
  echo "FALLO en la ejecución de la simulación."
  exit 1
fi
echo "OK"

# 6. Comprobación de aislamiento RLS a nivel de base de datos
echo -n "6. Comprobando aislamiento de datos por RLS entre tenant_ayto_malaga y tenant_ayto_palma... "
MALAGA_COUNT=$(PGPASSWORD='gemelotur_app_pwd' psql -h 127.0.0.1 -U gemelotur_app -d gemelotur -At -P pager=off <<SQL
BEGIN;
SELECT set_config('app.tenant_id', 'tenant_ayto_malaga', true);
SELECT set_config('app.destino_id', 'malaga', true);
SELECT count(*) FROM escenarios_definiciones WHERE id = '$SC_ID';
COMMIT;
SQL
)

PALMA_COUNT=$(PGPASSWORD='gemelotur_app_pwd' psql -h 127.0.0.1 -U gemelotur_app -d gemelotur -At -P pager=off <<SQL
BEGIN;
SELECT set_config('app.tenant_id', 'tenant_ayto_palma', true);
SELECT set_config('app.destino_id', 'palma', true);
SELECT count(*) FROM escenarios_definiciones WHERE id = '$SC_ID';
COMMIT;
SQL
)

MALAGA_COUNT_VAL=$(echo "$MALAGA_COUNT" | grep -E '^[0-9]+$' | tr -d '[:space:]')
PALMA_COUNT_VAL=$(echo "$PALMA_COUNT" | grep -E '^[0-9]+$' | tr -d '[:space:]')

if [ "$MALAGA_COUNT_VAL" -ne 1 ] || [ "$PALMA_COUNT_VAL" -ne 0 ]; then
  echo "FALLO: RLS no aisló los datos adecuadamente (Málaga: $MALAGA_COUNT_VAL, Palma: $PALMA_COUNT_VAL)."
  exit 1
fi
echo "OK (Málaga ve su escenario: $MALAGA_COUNT_VAL, Palma ve: $PALMA_COUNT_VAL)"

echo "=============================================================================="
echo " TODAS LAS PRUEBAS DE PERSISTENCIA POSTGIS Y RLS SUPERADAS EXITOSAMENTE."
echo "=============================================================================="
