#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — ITERACIÓN 6: OPERACIONES DE PILOTO
# Autenticación, Auditoría de IA, Protocolos Operativos y Calibración
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 6: OPERACIONES DE PILOTO ==="

# 1. Comprobar salud del backend y métricas PostGIS actualizadas
echo "[TEST 1] Comprobando salud y métricas de persistencia..."
HEALTH_RES=$(curl -s -f "${BASE_URL}/api/health")
echo "${HEALTH_RES}" | jq '{status, mode, persistence: .persistence.connected, destinos: .destinos_disponibles}'

# 2. Comprobar identidad del operador por defecto
echo "[TEST 2] Verificando endpoint /api/auth/me..."
AUTH_ME=$(curl -s -f "${BASE_URL}/api/auth/me")
OP_USERNAME=$(echo "${AUTH_ME}" | jq -r '.username')
OP_ROLE=$(echo "${AUTH_ME}" | jq -r '.role')
echo "  Operador actual: ${OP_USERNAME} (Rol: ${OP_ROLE})"
if [ "${OP_USERNAME}" != "gestor_malaga" ]; then
  echo "  ERROR: Operador inicial inesperado."
  exit 1
fi
echo "  -> OK: Operador resuelto correctamente."

# 3. Comprobar lista de operadores demo
echo "[TEST 3] Listando operadores disponibles (/api/auth/operators)..."
OPERATORS_RES=$(curl -s -f "${BASE_URL}/api/auth/operators")
OP_COUNT=$(echo "${OPERATORS_RES}" | jq '.operators | length')
echo "  Total operadores encontrados: ${OP_COUNT}"
if [ "${OP_COUNT}" -lt 2 ]; then
  echo "  ERROR: Se esperaban al menos 2 operadores configurados."
  exit 1
fi
echo "  -> OK: Operadores disponibles confirmados."

# 4. Probar conmutación de operador
echo "[TEST 4] Conmutando operador a 'gestor_palma'..."
SWITCH_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/switch-operator" \
  -H "Content-Type: application/json" \
  -d '{"username": "gestor_palma"}')
NEW_OP=$(echo "${SWITCH_RES}" | jq -r '.operator.username')
echo "  Nuevo operador activo: ${NEW_OP}"
if [ "${NEW_OP}" != "gestor_palma" ]; then
  echo "  ERROR: Fallo al conmutar operador."
  exit 1
fi
echo "  -> OK: Conmutación de identidad exitosa."

# 4b. Comprobar que gestor_palma NO puede acceder a los protocolos de Málaga (HTTP 403)
echo "[TEST 4b] Comprobando rechazo 403 por claims de operador (Palma intentando acceder a Málaga)..."
DENIED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/protocols?destino=malaga" \
  -H "X-PID-Tenant: tenant_ayto_palma")
echo "  Código HTTP recibido: ${DENIED_STATUS}"
if [ "${DENIED_STATUS}" != "403" ]; then
  echo "  ERROR: Se esperaba 403 Forbidden para operador no autorizado sobre el destino."
  exit 1
fi
echo "  -> OK: Autorización por claims validada (acceso denegado con 403 Forbidden)."

# Restaurar operador Málaga
curl -s -f -X POST "${BASE_URL}/api/auth/switch-operator" \
  -H "Content-Type: application/json" \
  -d '{"username": "gestor_malaga"}' >/dev/null

# 5. Probar listado de protocolos operativos
echo "[TEST 5] Consultando protocolos operativos de Málaga (/api/protocols)..."
PROTOCOLS_RES=$(curl -s -f "${BASE_URL}/api/protocols?destino=malaga" \
  -H "X-PID-Tenant: tenant_ayto_malaga")
PROTO_COUNT=$(echo "${PROTOCOLS_RES}" | jq '.protocols | length')
echo "  Protocolos encontrados para Málaga: ${PROTO_COUNT}"
if [ "${PROTO_COUNT}" -lt 1 ]; then
  echo "  ERROR: Debe existir al menos 1 protocolo operativo para Málaga."
  exit 1
fi
LEAD_UNIT=$(echo "${PROTOCOLS_RES}" | jq -r '.protocols[0].leadUnit')
echo "  -> OK: Protocolo operativo recuperado (Unidad Líder: ${LEAD_UNIT})."

# 6. Probar registro de auditoría de IA vinculado a evidencia
echo "[TEST 6] Generando propuesta IA y registrando auditoría con decisión humana..."
# Paso A: Generar propuesta IA
PROPOSAL_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/simulate-prompt?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d '{"prompt": "Aumento del 25% de visitantes por evento cultural en el centro histórico"}')

PROPOSAL_ID=$(echo "${PROPOSAL_RES}" | jq -r '.id')
FINGERPRINT=$(echo "${PROPOSAL_RES}" | jq -r '.evidence.contextFingerprint')

echo "  Propuesta generada: ${PROPOSAL_ID} (Huella: ${FINGERPRINT:0:16}...)"

# Paso B: Auditar decisión humana
AUDIT_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/audit/decision?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "X-PID-Tenant: tenant_ayto_malaga" \
  -d "{
    \"proposal\": ${PROPOSAL_RES},
    \"decision\": \"APLICADO_SIMULADOR\",
    \"decisionRationale\": \"Aprobado por el gestor para evaluar saturación en Calle Larios.\"
  }")

AUDIT_RECORD_ID=$(echo "${AUDIT_RES}" | jq -r '.auditRecord.id')
DECISION_SAVED=$(echo "${AUDIT_RES}" | jq -r '.auditRecord.decision')
echo "  Registro de auditoría inmutable creado: ${AUDIT_RECORD_ID} (${DECISION_SAVED})"

if [ "${DECISION_SAVED}" != "APLICADO_SIMULADOR" ]; then
  echo "  ERROR: La decisión humana no fue auditada correctamente."
  exit 1
fi
echo "  -> OK: Auditoría inmutable registrada con éxito."

# 7. Probar consulta de calibración predictiva
echo "[TEST 7] Consultando métricas de calibración predictiva (/api/calibrations)..."
CALIB_RES=$(curl -s -f "${BASE_URL}/api/calibrations?destino=malaga" \
  -H "X-PID-Tenant: tenant_ayto_malaga")
RECORDS_COUNT=$(echo "${CALIB_RES}" | jq '.recentRecords | length')
echo "  Registros de calibración encontrados: ${RECORDS_COUNT}"
AVG_PCT_ERR=$(echo "${CALIB_RES}" | jq -r '.horizonMetrics[0].avgPercentageError')
echo "  Desvío medio horizonte T+1h: ${AVG_PCT_ERR}%"
echo "  -> OK: Calibraciones predictivas consultadas con éxito."

echo "=== TODAS LAS PRUEBAS DE LA ITERACIÓN 6 SUPERADAS EXITOSAMENTE ==="
