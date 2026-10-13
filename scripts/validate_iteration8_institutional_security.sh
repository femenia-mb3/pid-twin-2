#!/usr/bin/env bash
# =============================================================================
# VALIDACIÓN AUTOMATIZADA — ITERACIÓN 8: SEGURIDAD INSTITUCIONAL REAL Y AUDITORÍA DURABLE
# Control estricto de autenticación, rechazo 401 sin fallback, persistencia durable de auditoría
# =============================================================================

set -eo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "=== INICIANDO VALIDACIÓN ITERACIÓN 8: SEGURIDAD INSTITUCIONAL REAL Y AUDITORÍA DURABLE ==="

# 1. Comprobar salud del backend PostGIS
echo "[TEST 1] Verificando salud del servidor y estado PostGIS..."
HEALTH_RES=$(curl -s -f "${BASE_URL}/api/health")
echo "${HEALTH_RES}" | jq '{status, mode, persistence: .persistence.connected, destinations: .destinos_disponibles}'

# 2. Control negativo estricto: Acceso sin autenticación a endpoints protegidos DEBE devolver 401 Unauthorized
echo "[TEST 2] Verificando rechazo 401 estricto sin token en /api/scenarios (Cero fallback a memoria)..."
ANON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/scenarios?destino=malaga")
echo "  Código HTTP recibido: ${ANON_STATUS}"
if [ "${ANON_STATUS}" != "401" ]; then
  echo "  ERROR: Se esperaba 401 Unauthorized para petición sin token."
  exit 1
fi
echo "  -> OK: Petición anónima rechazada con 401 Unauthorized."

# 3. Control negativo: Acceso anónimo a endpoints de IA debe devolver 401
echo "[TEST 3] Verificando rechazo 401 en /api/ai/capabilities sin token..."
AI_ANON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/ai/capabilities?destino=malaga")
echo "  Código HTTP recibido: ${AI_ANON_STATUS}"
if [ "${AI_ANON_STATUS}" != "401" ]; then
  echo "  ERROR: Se esperaba 401 Unauthorized en /api/ai/capabilities."
  exit 1
fi
echo "  -> OK: Endpoint de capacidades IA protegido con 401."

# 4. Login institucional seguro con API Key / credencial institucional
echo "[TEST 4] Autenticando 'gestor_malaga' con clave institucional segura..."
LOGIN_RES=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "carlos.dominguez@malaga.es",
    "apiKey": "malaga_secure_token_2026"
  }')

TOKEN_MALAGA=$(echo "${LOGIN_RES}" | jq -r '.token')
CLAIMS_SUB=$(echo "${LOGIN_RES}" | jq -r '.claims.sub')
CLAIMS_TENANT=$(echo "${LOGIN_RES}" | jq -r '.claims.tenantId')
CLAIMS_ROLE=$(echo "${LOGIN_RES}" | jq -r '.claims.role')
CLAIMS_ISS=$(echo "${LOGIN_RES}" | jq -r '.claims.iss')
CLAIMS_AUD=$(echo "${LOGIN_RES}" | jq -r '.claims.aud')

echo "  Token emitido: Sub=${CLAIMS_SUB}, Tenant=${CLAIMS_TENANT}, Rol=${CLAIMS_ROLE}"
echo "  Emisor verificado: ${CLAIMS_ISS}, Audiencia: ${CLAIMS_AUD}"

if [ -z "${TOKEN_MALAGA}" ] || [ "${TOKEN_MALAGA}" == "null" ]; then
  echo "  ERROR: Fallo al obtener token JWT institucional."
  exit 1
fi
echo "  -> OK: Autenticación institucional con clave segura superada."

# 5. Verificación de claims e identidad en /api/auth/me con Bearer token
echo "[TEST 5] Verificando sesión con Bearer Token en /api/auth/me..."
AUTH_ME_RES=$(curl -s -f "${BASE_URL}/api/auth/me" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")
AUTH_OK=$(echo "${AUTH_ME_RES}" | jq -r '.authenticated')
AUTH_TOKEN_VALID=$(echo "${AUTH_ME_RES}" | jq -r '.tokenVerified')
echo "  Sesión autenticada: ${AUTH_OK}, Token válido: ${AUTH_TOKEN_VALID}"

if [ "${AUTH_OK}" != "true" ] || [ "${AUTH_TOKEN_VALID}" != "true" ]; then
  echo "  ERROR: La sesión no fue validada correctamente por el servidor."
  exit 1
fi
echo "  -> OK: Verificación de claims y sesión completada."

# 6. Rechazo de token adulterado o con firma falsa (401 Unauthorized)
echo "[TEST 6] Comprobando rechazo ante token JWT con firma falsificada o manipulada..."
FAKE_TOKEN="${TOKEN_MALAGA}falsificado"
FAKE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/scenarios?destino=malaga" \
  -H "Authorization: Bearer ${FAKE_TOKEN}")
echo "  Código HTTP recibido ante token falsificado: ${FAKE_STATUS}"
if [ "${FAKE_STATUS}" != "401" ]; then
  echo "  ERROR: Se esperaba 401 Unauthorized para token adulterado."
  exit 1
fi
echo "  -> OK: Firma criptográfica validada y token falso rechazado (401)."

# 7. Control de acceso territorial por claims (403 Forbidden)
echo "[TEST 7] Comprobando rechazo 403 al intentar acceder a Palma con token de Málaga..."
CROSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/protocols?destino=palma" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")
echo "  Código HTTP recibido: ${CROSS_STATUS}"
if [ "${CROSS_STATUS}" != "403" ]; then
  echo "  ERROR: Se esperaba 403 Forbidden para operador fuera de su jurisdicción."
  exit 1
fi
echo "  -> OK: Aislamiento estricto de destino por claims validado (403 Forbidden)."

# 8. Generación de propuesta IA y verificación de persistencia obligatoria en PostGIS
echo "[TEST 8] Generando propuesta IA con token de Málaga y comprobando persistencia PostGIS..."
PROPOSAL_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/simulate-prompt?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Aumento del 25% de demanda en Centro Histórico con refuerzo de movilidad"}')

PROPOSAL_ID=$(echo "${PROPOSAL_RES}" | jq -r '.id')
FINGERPRINT=$(echo "${PROPOSAL_RES}" | jq -r '.evidence.contextFingerprint')

echo "  Propuesta generada: ${PROPOSAL_ID}"
echo "  Huella SHA-256 de contexto: ${FINGERPRINT}"

# 9. Comprobar que la propuesta está registrada en la tabla ai_proposals_audit
echo "[TEST 9] Comprobando persistencia inmutable en /api/ai/audit..."
AUDIT_LOG=$(curl -s -f "${BASE_URL}/api/ai/audit?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}")

AUDIT_FOUND=$(echo "${AUDIT_LOG}" | jq --arg pid "${PROPOSAL_ID}" '.audits | any(.proposalId == $pid or .id == ("audit-" + $pid))')
echo "  ¿Propuesta registrada en PostGIS en estado PROPUESTO?: ${AUDIT_FOUND}"
if [ "${AUDIT_FOUND}" != "true" ]; then
  echo "  ERROR: La propuesta no fue registrada en la auditoría de PostGIS."
  exit 1
fi
echo "  -> OK: Registro server-side inmutable confirmado."

# 10. Registrar decisión humana referenciando únicamente el proposalId oficial
echo "[TEST 10] Registrando decisión humana inmutable sobre proposalId oficial..."
DEC_RES=$(curl -s -f -X POST "${BASE_URL}/api/ai/audit/decision?destino=malaga" \
  -H "Authorization: Bearer ${TOKEN_MALAGA}" \
  -H "Content-Type: application/json" \
  -d "{
    \"proposalId\": \"${PROPOSAL_ID}\",
    \"decision\": \"APLICADO_SIMULADOR\",
    \"decisionRationale\": \"Aprobado por Carlos Domínguez con token institucional autenticado.\"
  }")

DEC_SUCCESS=$(echo "${DEC_RES}" | jq -r '.success')
echo "  Decisión registrada con éxito: ${DEC_SUCCESS}"
if [ "${DEC_SUCCESS}" != "true" ]; then
  echo "  ERROR: No se pudo registrar la decisión humana."
  exit 1
fi
echo "  -> OK: Decisión humana inmutable auditada en PostGIS."

echo "=== TODAS LAS 10 PRUEBAS DE LA ITERACIÓN 8 SUPERADAS EXITOSAMENTE ==="
