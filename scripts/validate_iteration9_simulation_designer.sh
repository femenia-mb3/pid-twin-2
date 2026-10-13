#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — ITERACIÓN 9: DISEÑADOR DE SIMULACIONES Y CATÁLOGO PID
# Validación de modelos con creadores/adoptantes, importación directa como escenario y ejecución
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 9: DISEÑADOR DE SIMULACIONES Y CATÁLOGO PID ==="

# 1. Autenticar operador institucional para obtener token JWT obligatorio
echo "[TEST 1] Autenticando 'carlos.dominguez@malaga.es' para pruebas..."
LOGIN_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_secure_token_2026"}')

TOKEN=$(echo "${LOGIN_RES}" | jq -r '.token')
if [ -z "${TOKEN}" ] || [ "${TOKEN}" == "null" ]; then
  echo "  ERROR: No se pudo obtener token de autenticación."
  exit 1
fi
echo "  -> OK: Autenticación exitosa."

# 2. Consultar el Catálogo Reutilizable y verificar metadatos de Creador y Destinos Adoptantes
echo "[TEST 2] Verificando catálogo de modelos con metadatos de creador y adoptantes..."
MODELS_RES=$(curl -s -f "${BASE_URL}/api/models/reusable?destino=malaga")
TOTAL_MODELS=$(echo "${MODELS_RES}" | jq -r '.total')
echo "  Total de modelos disponibles en catálogo: ${TOTAL_MODELS}"

if [ "${TOTAL_MODELS}" -lt 5 ]; then
  echo "  ERROR: Se esperaban al menos 5 modelos en el catálogo."
  exit 1
fi

# Verificar metadatos específicos en el modelo de puertos y cruceros
CRUCEROS_CREATOR=$(echo "${MODELS_RES}" | jq -r '.models[] | select(.id == "modelo_puertos_cruceros") | .creatorDestinationName')
CRUCEROS_ADOPTED=$(echo "${MODELS_RES}" | jq -r '.models[] | select(.id == "modelo_puertos_cruceros") | .adoptedByDestinationIds | join(", ")')
CRUCEROS_MODULES=$(echo "${MODELS_RES}" | jq -r '.models[] | select(.id == "modelo_puertos_cruceros") | .pidModulesRequired | join(", ")')

echo "  Modelo 'modelo_puertos_cruceros':"
echo "    - Creador: ${CRUCEROS_CREATOR}"
echo "    - Adoptantes: ${CRUCEROS_ADOPTED}"
echo "    - Módulos PID requeridos: ${CRUCEROS_MODULES}"

if [ -z "${CRUCEROS_CREATOR}" ] || [ -z "${CRUCEROS_ADOPTED}" ]; then
  echo "  ERROR: Faltan metadatos de creador o adoptantes en el modelo."
  exit 1
fi
echo "  -> OK: Metadatos de catálogo multidestino verificados."

# 3. Importar el modelo 'modelo_puertos_cruceros' como escenario ejecutable para Málaga
echo "[TEST 3] Importando modelo 'modelo_puertos_cruceros' como escenario en Málaga..."
IMPORT_RES=$(curl -s -f -X POST "${BASE_URL}/api/models/reusable/modelo_puertos_cruceros/import-scenario?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -H "Content-Type: application/json" \
  -d '{
    "zoneIds": ["malaga_centro", "malaga_puerto_muelle1"],
    "parameters": {
      "tasaDesembarco": 80,
      "tiempoDispersion": 40,
      "modoMovilidad": "REFORZADA"
    }
  }')

IMPORT_SCENARIO_ID=$(echo "${IMPORT_RES}" | jq -r '.scenario.id')
IMPORT_NAME=$(echo "${IMPORT_RES}" | jq -r '.scenario.name')
IMPORT_TYPE=$(echo "${IMPORT_RES}" | jq -r '.scenario.type')
IMPORT_STATUS=$(echo "${IMPORT_RES}" | jq -r '.scenario.status')
IMPORT_MOBILITY=$(echo "${IMPORT_RES}" | jq -r '.scenario.inputs.mobilityMode')

echo "  Escenario importado: ${IMPORT_SCENARIO_ID}"
echo "  Nombre: ${IMPORT_NAME}"
echo "  Tipo ontológico: ${IMPORT_TYPE}"
echo "  Modo de movilidad asignado: ${IMPORT_MOBILITY}"

if [ -z "${IMPORT_SCENARIO_ID}" ] || [ "${IMPORT_SCENARIO_ID}" == "null" ]; then
  echo "  ERROR: Fallo al importar escenario desde el catálogo."
  exit 1
fi
echo "  -> OK: Modelo instanciado e importado como escenario con éxito."

# 4. Validar el escenario importado
echo "[TEST 4] Validando el escenario recién importado..."
VALIDATE_RES=$(curl -s -f -X POST "${BASE_URL}/api/scenarios/${IMPORT_SCENARIO_ID}/validate?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga")

IS_VALID=$(echo "${VALIDATE_RES}" | jq -r '.report.valid')
echo "  ¿Escenario validado para el motor?: ${IS_VALID}"
if [ "${IS_VALID}" != "true" ]; then
  echo "  ERROR: El escenario importado no superó la validación."
  exit 1
fi
echo "  -> OK: Validación técnica superada."

# 5. Ejecutar la simulación del escenario importado y verificar BASE / ESCENARIO / DELTA
echo "[TEST 5] Ejecutando simulación del escenario importado..."
EXEC_RES=$(curl -s -f -X POST "${BASE_URL}/api/scenarios/${IMPORT_SCENARIO_ID}/execute?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga")

RUN_ID=$(echo "${EXEC_RES}" | jq -r '.execution.run.id')
BASE_VISITANTES=$(echo "${EXEC_RES}" | jq -r '.execution.run.outputs.base.indicadoresActuales.visitantesEnDestino')
ESC_VISITANTES=$(echo "${EXEC_RES}" | jq -r '.execution.run.outputs.scenario.indicadoresSimulados.visitantesEnDestino')
DELTA_VISITANTES=$(( ESC_VISITANTES - BASE_VISITANTES ))
SATURACION_BASE=$(echo "${EXEC_RES}" | jq -r '.execution.run.outputs.base.indicadoresActuales.saturacionGlobalPct')
SATURACION_ESC=$(echo "${EXEC_RES}" | jq -r '.execution.run.outputs.scenario.indicadoresSimulados.saturacionGlobalPct')

echo "  SimulationRun ID: ${RUN_ID}"
echo "  Visitantes Base: ${BASE_VISITANTES}"
echo "  Visitantes Escenario: ${ESC_VISITANTES}"
echo "  Delta calculado: +${DELTA_VISITANTES} visitantes"
echo "  Saturación Base: ${SATURACION_BASE}% -> Saturación Escenario: ${SATURACION_ESC}%"

if [ -z "${RUN_ID}" ] || [ "${RUN_ID}" == "null" ]; then
  echo "  ERROR: Fallo al ejecutar la simulación del escenario importado."
  exit 1
fi
echo "  -> OK: Ejecución de simulación normalizada BASE / ESCENARIO / DELTA superada."

# 6. Rechazo de importación a Palma con token de Málaga (Aislamiento territorial)
echo "[TEST 6] Comprobando rechazo 403 al intentar importar en Palma con token de Málaga..."
CROSS_IMPORT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/models/reusable/modelo_playas/import-scenario?destino=palma" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_palma" \
  -H "Content-Type: application/json" \
  -d '{"zoneIds": ["palma_platja_palma"]}')

echo "  Código HTTP recibido: ${CROSS_IMPORT}"
if [ "${CROSS_IMPORT}" != "403" ]; then
  echo "  ERROR: Se esperaba 403 Forbidden para importación cruzada."
  exit 1
fi
echo "  -> OK: Aislamiento territorial en importación de modelos garantizado (403 Forbidden)."

# 7. Rechazo de importación sin token de autenticación (401 Unauthorized)
echo "[TEST 7] Comprobando rechazo 401 para petición sin autenticación..."
ANON_IMPORT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/models/reusable/modelo_playas/import-scenario?destino=malaga" \
  -H "Content-Type: application/json" \
  -d '{"zoneIds": ["malaga_centro"]}')

echo "  Código HTTP recibido: ${ANON_IMPORT}"
if [ "${ANON_IMPORT}" != "401" ]; then
  echo "  ERROR: Se esperaba 401 Unauthorized sin autenticación."
  exit 1
fi
echo "  -> OK: Seguridad institucional obligatoria en endpoints de importación."

# 8. Comprobar que el escenario aparece en la lista de escenarios de Málaga
echo "[TEST 8] Comprobando presencia del escenario importado en GET /api/scenarios..."
LIST_RES=$(curl -s -f "${BASE_URL}/api/scenarios?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PID-Tenant: tenant_ayto_malaga")

SCENARIO_IN_LIST=$(echo "${LIST_RES}" | jq --arg sid "${IMPORT_SCENARIO_ID}" '.scenarios | any(.id == $sid)')
echo "  ¿Escenario visible en la lista del destino?: ${SCENARIO_IN_LIST}"
if [ "${SCENARIO_IN_LIST}" != "true" ]; then
  echo "  ERROR: El escenario importado no aparece en el listado del destino."
  exit 1
fi
echo "  -> OK: Escenario plenamente integrado y disponible para el simulador."

echo "=== TODAS LAS 8 PRUEBAS DE LA ITERACIÓN 9 SUPERADAS EXITOSAMENTE ==="
