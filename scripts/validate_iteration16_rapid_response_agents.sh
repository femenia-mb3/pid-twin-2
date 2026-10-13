#!/usr/bin/env bash
# =============================================================================
# SUITE DE VALIDACIÓN AUTOMATIZADA — ITERACIÓN 16
# Agentes Autónomos de Respuesta Rápida ante Situaciones de Colapso
# =============================================================================

set -euo pipefail
umask 077

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"

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
  echo "ERROR: Esta suite firma un plan Nivel 2 y prueba triggers mediante escritura controlada. Ejecutar solo con ALLOW_MUTATING_DEMO_TESTS=1 en una base de demostración aislada." >&2
  exit 2
fi
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
echo "=== VALIDACIÓN ITERACIÓN 16: AGENTES AUTÓNOMOS DE RESPUESTA RÁPIDA ==="
echo "Endpoint: $BASE_URL"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# -----------------------------------------------------------------------------
# TEST 1: Login de Operador Institucional de Málaga y Palma (JWT con claims)
# -----------------------------------------------------------------------------
login_institutional() {
  local username="$1"
  local api_key="$2"
  jq -cn --arg username "$username" --arg apiKey "$api_key" '{username: $username, apiKey: $apiKey}' | \
    curl -s -f -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" --data-binary @-
}

echo "--> TEST 1: Login institucional de operadores..."
LOGIN_MALAGA=$(login_institutional "$PID_TEST_MALAGA_USERNAME" "$PID_TEST_MALAGA_API_KEY")

JWT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.token')
TENANT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.claims.tenantId')

if [[ -z "$JWT_MALAGA" || "$JWT_MALAGA" == "null" ]]; then
  echo "❌ Fallo obteniendo JWT para Carlos Domínguez (Málaga)"
  exit 1
fi
echo "✓ Login Málaga exitoso (Tenant: $TENANT_MALAGA)"

LOGIN_PALMA=$(login_institutional "$PID_TEST_PALMA_USERNAME" "$PID_TEST_PALMA_API_KEY")

JWT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.token')
TENANT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.claims.tenantId')

if [[ -z "$JWT_PALMA" || "$JWT_PALMA" == "null" ]]; then
  echo "❌ Fallo obteniendo JWT para Catalina Ribas (Palma)"
  exit 1
fi
echo "✓ Login Palma exitoso (Tenant: $TENANT_PALMA)"
echo ""

# -----------------------------------------------------------------------------
# TEST 2: Consulta del perfil del agente autónomo centinela
# -----------------------------------------------------------------------------
echo "--> TEST 2: Consultar perfil del agente centinela de Málaga..."
AGENT_RES=$(curl -s -f "$BASE_URL/api/rapid-response/agents?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

AGENT_ID=$(echo "$AGENT_RES" | jq -r '.agent.id')
AGENT_MODE=$(echo "$AGENT_RES" | jq -r '.agent.mode')
AGENT_THRESH=$(echo "$AGENT_RES" | jq -r '.agent.saturationThresholdPct')

if [[ -z "$AGENT_ID" || "$AGENT_ID" == "null" || "$AGENT_MODE" != "RESPUESTA_ACTIVA" ]]; then
  echo "❌ Error recuperando agente centinela de Málaga: $AGENT_RES"
  exit 1
fi
echo "✓ Agente activo: $AGENT_ID | Modo: $AGENT_MODE | Umbral: $AGENT_THRESH%"
echo ""

# -----------------------------------------------------------------------------
# TEST 3: Detección de incidente de colapso con evidencia y sensores
# -----------------------------------------------------------------------------
echo "--> TEST 3: Evaluar territorio simulando pico de saturación (+35%)..."
EVAL_RES=$(curl -s -f -X POST "$BASE_URL/api/rapid-response/evaluate?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d '{"forcedSaturationBoostPct": 35}')

INCIDENT_ID=$(echo "$EVAL_RES" | jq -r '.incident.id')
INCIDENT_SEV=$(echo "$EVAL_RES" | jq -r '.incident.severity')
INCIDENT_FINGERPRINT=$(echo "$EVAL_RES" | jq -r '.incident.evidenceFingerprintSha256')
PLAN_ID=$(echo "$EVAL_RES" | jq -r '.interventionPlan.id')

if [[ -z "$INCIDENT_ID" || "$INCIDENT_ID" == "null" || "$INCIDENT_SEV" == "null" ]]; then
  echo "❌ No se detectó el incidente de saturación crítica: $EVAL_RES"
  exit 1
fi

if [[ ${#INCIDENT_FINGERPRINT} -ne 64 ]]; then
  echo "❌ Huella SHA-256 de evidencia de incidente inválida: $INCIDENT_FINGERPRINT"
  exit 1
fi

echo "✓ Incidente detectado: $INCIDENT_ID | Severidad: $INCIDENT_SEV"
echo "✓ Huella SHA-256 vinculada: $INCIDENT_FINGERPRINT"
echo "✓ Plan de intervención rápida generado: $PLAN_ID"
echo ""

# -----------------------------------------------------------------------------
# TEST 4: Inspección del plan generado y clasificación de riesgos Nivel 1 vs Nivel 2
# -----------------------------------------------------------------------------
echo "--> TEST 4: Verificar clasificación de riesgos en plan de mitigación..."
PLAN_RES=$(curl -s -f "$BASE_URL/api/rapid-response/plans/$PLAN_ID?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

PLAN_STATUS=$(echo "$PLAN_RES" | jq -r '.status')
ACTION_1_LEVEL=$(echo "$PLAN_RES" | jq -r '.actions[0].riskLevel')
ACTION_1_STATUS=$(echo "$PLAN_RES" | jq -r '.actions[0].status')
ACTION_2_CODE=$(echo "$PLAN_RES" | jq -r '.actions[1].code')
ACTION_2_LEVEL=$(echo "$PLAN_RES" | jq -r '.actions[1].riskLevel')
ACTION_2_APPROVED=$(echo "$PLAN_RES" | jq -r '.actions[1].isPreApprovedByDirective')
ACTION_2_STATUS=$(echo "$PLAN_RES" | jq -r '.actions[1].status')
ACTION_3_LEVEL=$(echo "$PLAN_RES" | jq -r '.actions[2].riskLevel')
ACTION_3_STATUS=$(echo "$PLAN_RES" | jq -r '.actions[2].status')

if [[ "$PLAN_STATUS" != "PENDIENTE_FIRMA_HUMANA" ]]; then
  echo "❌ Estado del plan inesperado: $PLAN_STATUS"
  exit 1
fi

if [[ "$ACTION_1_LEVEL" != "NIVEL_1_INFORMATIVO_AUTONOMO" || "$ACTION_1_STATUS" != "EJECUTADA_AUTONOMA" ]]; then
  echo "❌ Acción Nivel 1 no ejecutada de forma autónoma: $ACTION_1_LEVEL ($ACTION_1_STATUS)"
  exit 1
fi

if [[ "$ACTION_2_CODE" != "AVISO_APP_VISITANTES" || "$ACTION_2_LEVEL" != "NIVEL_1_INFORMATIVO_AUTONOMO" || "$ACTION_2_APPROVED" != "true" || "$ACTION_2_STATUS" != "EJECUTADA_AUTONOMA" ]]; then
  echo "❌ Aviso geolocalizado no cumple la directiva Nivel 1: $ACTION_2_CODE | $ACTION_2_LEVEL | aprobado=$ACTION_2_APPROVED | $ACTION_2_STATUS"
  exit 1
fi

if [[ "$ACTION_3_LEVEL" != "NIVEL_2_OPERATIVO_FIRMA_HUMANA" || "$ACTION_3_STATUS" != "PENDIENTE" ]]; then
  echo "❌ Acción Nivel 2 debería estar PENDIENTE de firma humana: $ACTION_3_LEVEL ($ACTION_3_STATUS)"
  exit 1
fi

echo "✓ Plan en estado: $PLAN_STATUS"
echo "✓ Medida 1 (PMV): $ACTION_1_LEVEL -> $ACTION_1_STATUS (Autónoma)"
echo "✓ Medida 2 (Aviso App): $ACTION_2_LEVEL -> $ACTION_2_STATUS (Autónoma y preaprobada)"
echo "✓ Medida 3 (Policía): $ACTION_3_LEVEL -> $ACTION_3_STATUS (Requiere firma humana)"
echo ""

# -----------------------------------------------------------------------------
# TEST 5: Firma humana institucional (Human-in-the-Loop) autorizando medidas Nivel 2
# -----------------------------------------------------------------------------
echo "--> TEST 5: Operador firma formalmente el plan de mitigación..."
EXEC_RES=$(curl -s -f -X POST "$BASE_URL/api/rapid-response/plans/$PLAN_ID/execute?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d '{
    "decision": "AUTORIZADO_EJECUTADO",
    "rationale": "Autorización formal tras reunión de coordinación con Policía Local y Movilidad."
  }')

EXEC_SUCCESS=$(echo "$EXEC_RES" | jq -r '.success')
DECISION_ID=$(echo "$EXEC_RES" | jq -r '.decisionRecord.id')
DEC_FINGERPRINT=$(echo "$EXEC_RES" | jq -r '.decisionRecord.decisionFingerprintSha256')

if [[ "$EXEC_SUCCESS" != "true" || -z "$DECISION_ID" || "$DECISION_ID" == "null" ]]; then
  echo "❌ Fallo registrando firma humana institucional: $EXEC_RES"
  exit 1
fi

if [[ ${#DEC_FINGERPRINT} -ne 64 ]]; then
  echo "❌ Huella SHA-256 de decisión inválida: $DEC_FINGERPRINT"
  exit 1
fi

echo "✓ Plan autorizado y ejecutado exitosamente por operador humano."
echo "✓ Registro de decisión inmutable: $DECISION_ID | SHA-256: $DEC_FINGERPRINT"
echo ""

# -----------------------------------------------------------------------------
# TEST 6: Bloqueo de re-autorización o alteración de plan ya resuelto
# -----------------------------------------------------------------------------
echo "--> TEST 6: Comprobar inmutabilidad del plan ya resuelto..."
REEXEC_RES=$(curl -s -w "%{http_code}" -o "$TMP_DIR/reexec.json" -X POST "$BASE_URL/api/rapid-response/plans/$PLAN_ID/execute?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -d '{"decision": "RECHAZADO_OPERADOR", "rationale": "Intento de alteración ilegal."}')

if [[ "$REEXEC_RES" == "422" || "$REEXEC_RES" == "400" ]]; then
  echo "✓ Correcto: Re-ejecución bloqueada con HTTP $REEXEC_RES (Plan inmutable tras firma)."
else
  echo "❌ Fallo: Se esperaba 422 y se obtuvo HTTP $REEXEC_RES"
  cat "$TMP_DIR/reexec.json"
  exit 1
fi
echo ""

# -----------------------------------------------------------------------------
# TEST 7: Aislamiento RLS Multidestino (Operador de Palma no puede autorizar Málaga)
# -----------------------------------------------------------------------------
echo "--> TEST 7: Comprobar aislamiento multitenant estricto (Palma intentando operar plan de Málaga)..."
CROSS_RES=$(curl -s -w "%{http_code}" -o "$TMP_DIR/cross.json" -X POST "$BASE_URL/api/rapid-response/plans/$PLAN_ID/execute?destino=malaga" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA" \
  -d '{"decision": "AUTORIZADO_EJECUTADO", "rationale": "Intento no autorizado."}')

if [[ "$CROSS_RES" == "403" || "$CROSS_RES" == "401" ]]; then
  echo "✓ Correcto: Aislamiento RLS enforced con HTTP $CROSS_RES (Acceso cruzado denegado)."
else
  echo "❌ Fallo de seguridad: Se obtuvo HTTP $CROSS_RES para operador cruzado"
  cat "$TMP_DIR/cross.json"
  exit 1
fi
echo ""

# -----------------------------------------------------------------------------
# TEST 8: Verificación de Inmutabilidad contra manipulación en base de datos
# -----------------------------------------------------------------------------
echo "--> TEST 8: Comprobar que los triggers impiden UPDATE/DELETE en decisiones de agentes..."
if [[ ! "$DECISION_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "ERROR: Identificador de decisión con formato no permitido." >&2
  exit 1
fi
SQL_TAMPER=$(sudo -u postgres psql -d gemelotur -c "UPDATE decisiones_intervencion_agente SET decision = 'RECHAZADO_OPERADOR' WHERE id = '$DECISION_ID';" 2>&1 || true)

if echo "$SQL_TAMPER" | grep -qE "VIOLACION DE AUDITORIA|AUDIT_TAMPERING_FORBIDDEN"; then
  echo "✓ Correcto: Trigger inmutable fn_prevent_audit_tampering() bloqueó la modificación directa en SQL."
else
  echo "❌ Fallo: La base de datos permitió alterar el registro inmutable de decisiones:"
  echo "$SQL_TAMPER"
  exit 1
fi
echo ""

echo "========================================================================="
echo "🎉 ¡TODAS LAS PRUEBAS DE LA ITERACIÓN 16 SE HAN COMPLETADO CON ÉXITO!"
echo "========================================================================="
