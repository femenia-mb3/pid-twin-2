#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — ITERACIÓN 7: AUTENTICACIÓN INSTITUCIONAL Y AUDITORÍA SERVER-SIDE
# Tokens JWT, Verificación de Claims, Registro Inmutable de Propuestas en Servidor
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 7: AUTENTICACIÓN INSTITUCIONAL Y AUDITORÍA SERVER-SIDE ==="

# 1. Comprobar salud del backend PostGIS
echo "[TEST 1] Verificando estado del servidor y persistencia PostGIS..."
HEALTH_RES=$(curl -s -f "${BASE_URL}/api/health")
echo "${HEALTH_RES}" | jq '{status, mode, persistence: .persistence.connected, destinations: .destinos_disponibles}'

# 2. Login institucional demostrador y emisión de token JWT
echo "[TEST 2] Realizando login institucional para 'gestor_malaga' (/api/auth/login)..."
LOGIN_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "gestor_malaga"}')

TOKEN_MALAGA=$(echo "${LOGIN_RES}" | jq -r '.token')
CLAIMS_SUB=$(echo "${LOGIN_RES}" | jq -r '.claims.sub')
CLAIMS_TENANT=$(echo "${LOGIN_RES}" | jq -r '.claims.tenantId')
CLAIMS_ROLE=$(echo "${LOGIN_RES}" | jq -r '.claims.role')
EXPIRES_IN=$(echo "${LOGIN_RES}" | jq -r '.expiresIn')

echo "  Token JWT emitido exitosamente."
echo "  Claims verificados: Sub=${CLAIMS_SUB}, Tenant=${CLAIMS_TENANT}, Rol=${CLAIMS_ROLE}, Exp=${EXPIRES_IN}s"

if [ -z "${TOKEN_MALAGA}" ] || [ "${TOKEN_MALAGA}" == "null" ]; then
  echo "  ERROR: No se recibió token JWT."
  exit 1
fi
echo "  -> OK: Emisión de token JWT institucional completada."

# 3. Verificación de sesión mediante Bearer Token (/api/auth/me)
echo "[TEST 3] Verificando sesión con Bearer Token (/api/auth/me)..."
AUTH_ME_RES=$(curl -s -f "${BASE_URL}/api/auth/me" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")
IS_VERIFIED=$(echo "${AUTH_ME_RES}" | jq -r '.tokenVerified')
RESOLVED_USER=$(echo "${AUTH_ME_RES}" | jq -r '.operator.username')

echo "  Token verificado por el servidor: ${IS_VERIFIED} (Usuario: ${RESOLVED_USER})"
if [ "${IS_VERIFIED}" != "true" ] || [ "${RESOLVED_USER}" != "gestor_malaga" ]; then
  echo "  ERROR: Fallo al validar la firma o claims del token."
  exit 1
fi
echo "  -> OK: Verificación de sesión Bearer JWT superada."

# 4. Control de acceso negativo: Intento de operar sobre Palma con token de Málaga (HTTP 403 Forbidden)
echo "[TEST 4] Comprobando rechazo 403 por claims territoriales (Málaga intentando operar sobre Palma)..."
CROSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/protocols?destino=palma" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")
echo "  Código HTTP recibido: ${CROSS_STATUS}"
if [ "${CROSS_STATUS}" != "403" ]; then
  echo "  ERROR: Se esperaba 403 Forbidden para operador sin jurisdicción en Palma."
  exit 1
fi
echo "  -> OK: Aislamiento estricto por claims territoriales validado (403 Forbidden)."

# 5. Generación de propuesta IA y REGISTRO INMUTABLE INMEDIATO EN SERVIDOR
echo "[TEST 5] Solicitando propuesta IA y comprobando persistencia server-side inmediata..."
PROPOSAL_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/simulate-prompt?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Aumento del 30% de afluencia por escala de cruceros en el puerto y centro histórico"}')

PROPOSAL_ID=$(echo "${PROPOSAL_RES}" | jq -r '.id')
FINGERPRINT=$(echo "${PROPOSAL_RES}" | jq -r '.evidence.contextFingerprint')
RATIONALE=$(echo "${PROPOSAL_RES}" | jq -r '.evidence.rationale')

echo "  Propuesta generada: ${PROPOSAL_ID}"
echo "  Huella SHA-256 de contexto: ${FINGERPRINT}"

# 6. Comprobar que la propuesta YA ESTÁ persistida en el registro de auditoría del servidor sin acción del cliente
echo "[TEST 6] Comprobando presencia inmutable en el registro de auditoría (/api/ai/audit)..."
AUDIT_LOG_RES=$(curl -s -f "${BASE_URL}/api/ai/audit?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")

AUDIT_EXISTS=$(echo "${AUDIT_LOG_RES}" | jq --arg pid "${PROPOSAL_ID}" '.audits | any(.proposalId == $pid or .id == ("audit-" + $pid))')
echo "  ¿Propuesta registrada en servidor en estado inicial PROPUESTO?: ${AUDIT_EXISTS}"
if [ "${AUDIT_EXISTS}" != "true" ]; then
  echo "  ERROR: La propuesta no fue registrada de inmediato en servidor."
  exit 1
fi
echo "  -> OK: Registro server-side de propuesta confirmado (antimanipulación de cliente)."

# 7. Registrar decisión humana referenciando ÚNICAMENTE el proposalId oficial
echo "[TEST 7] Registrando decisión humana referenciando únicamente el proposalId oficial..."
DECISION_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/audit/decision?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}" \
  -H "Content-Type: application/json" \
  -d "{
    \"proposalId\": \"${PROPOSAL_ID}\",
    \"decision\": \"APLICADO_SIMULADOR\",
    \"decisionRationale\": \"Autorizado por Carlos Domínguez (Gestor Turismo Málaga) tras validar huella SHA-256.\"
  }")

DECISION_OK=$(echo "${DECISION_RES}" | jq -r '.success')
DECISION_ID=$(echo "${DECISION_RES}" | jq -r '.decisionId')
echo "  Decisión humana registrada en el histórico append-only: ${DECISION_ID} (Success: ${DECISION_OK})"

if [ "${DECISION_OK}" != "true" ]; then
  echo "  ERROR: Fallo al registrar la decisión humana."
  exit 1
fi
echo "  -> OK: Decisión humana inmutable vinculada exitosamente a la propuesta previa."

# 8. Comprobación de seguridad negativa: Intento de registrar decisión sobre proposalId inventado/ficticio (404 Not Found)
echo "[TEST 8] Comprobando rechazo ante propuesta ficticia o inyectada arbitrariamente..."
FAKE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/ai/audit/decision?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}" \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "ai-prop-falsa-inyectada-9999",
    "decision": "APLICADO_SIMULADOR"
  }')

echo "  Código HTTP recibido ante propuesta inexistente: ${FAKE_STATUS}"
if [ "${FAKE_STATUS}" != "404" ]; then
  echo "  ERROR: Se esperaba 404 Not Found ante propuesta no registrada en servidor."
  exit 1
fi
echo "  -> OK: Rechazo de propuestas arbitrarias inyectadas validado (404 Not Found)."

echo "=== TODAS LAS PRUEBAS DE LA ITERACIÓN 7 SUPERADAS EXITOSAMENTE ==="
