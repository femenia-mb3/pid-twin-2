#!/usr/bin/env bash
# =============================================================================
# PRUEBA INTEGRADA — ITERACIONES 15 + 16
# Estrés macroeconómico, multihorizonte y agente autónomo de respuesta rápida
# =============================================================================
# Uso seguro:
#   PID_TEST_USERNAME=... PID_TEST_API_KEY=... \
#     ./scripts/run_combined_stress_iteration15_16.sh
#
# No guarda ni revela credenciales. El operador de prueba debe contar con permisos
# institucionales para el destino indicado.

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
DESTINO="${DESTINO:-malaga}"
: "${PID_TEST_USERNAME:?Falta PID_TEST_USERNAME en el entorno}"
: "${PID_TEST_API_KEY:?Falta PID_TEST_API_KEY en el entorno}"

if [[ "$BASE_URL" != "http://127.0.0.1:3001" ]]; then
  printf 'ERROR: El ejecutor integrado solo admite el backend local de demostración (http://127.0.0.1:3001).\n' >&2
  exit 2
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_TAG="i15-i16-$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT_DIR="${OUTPUT_DIR:-validation-artifacts/${RUN_TAG}}"
mkdir -p "$OUTPUT_DIR"

printf '=== PRUEBA INTEGRADA ITERACIONES 15 + 16 ===\n'
printf 'Escenario: COLAPSO_EVENTO_EXTRAORDINARIO / +110%% afluencia\n'
printf 'Destino: %s\nInicio UTC: %s\n\n' "$DESTINO" "$TIMESTAMP"

LOGIN_PAYLOAD=$(jq -cn --arg username "$PID_TEST_USERNAME" --arg apiKey "$PID_TEST_API_KEY" \
  '{username: $username, apiKey: $apiKey}')
LOGIN_RESPONSE=$(printf '%s' "$LOGIN_PAYLOAD" | curl -sS -f -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @-)

JWT=$(printf '%s' "$LOGIN_RESPONSE" | jq -r '.token')
TENANT_ID=$(printf '%s' "$LOGIN_RESPONSE" | jq -r '.claims.tenantId // .operator.tenantId')

if [[ -z "$JWT" || "$JWT" == "null" || -z "$TENANT_ID" || "$TENANT_ID" == "null" ]]; then
  printf 'ERROR: No se pudo obtener una sesión institucional válida.\n' >&2
  exit 1
fi

HEADERS=(
  -H "Authorization: Bearer $JWT"
  -H "X-PID-Tenant: $TENANT_ID"
  -H "Content-Type: application/json"
)

# Una marca de tiempo común permite correlacionar las tres ramas de estrés.
START_MS=$(date +%s%3N)

# Las tres evaluaciones se envían a la vez: impacto económico, resiliencia temporal y respuesta centinela.
(
  curl -sS -f -X POST "$BASE_URL/api/macro/simulate?destino=$DESTINO" "${HEADERS[@]}" \
    -d "$(jq -cn --arg title "${RUN_TAG}: escenario macroeconómico de colapso" --argjson delta 110 \
      '{scenarioTitle: $title, visitorDeltaPct: $delta}')" \
    > "$OUTPUT_DIR/macro.json"
) &
PID_MACRO=$!

(
  curl -sS -f -X POST "$BASE_URL/api/stress-test/execute?destino=$DESTINO" "${HEADERS[@]}" \
    -d '{"profile":"COLAPSO_EVENTO_EXTRAORDINARIO"}' \
    > "$OUTPUT_DIR/stress.json"
) &
PID_STRESS=$!

(
  curl -sS -f -X POST "$BASE_URL/api/rapid-response/evaluate?destino=$DESTINO" "${HEADERS[@]}" \
    -d '{"forcedSaturationBoostPct":110}' \
    > "$OUTPUT_DIR/agent.json"
) &
PID_AGENT=$!

wait "$PID_MACRO"
wait "$PID_STRESS"
wait "$PID_AGENT"
END_MS=$(date +%s%3N)

# Verificaciones deterministas del contrato de cada motor.
MACRO_ID=$(jq -r '.id' "$OUTPUT_DIR/macro.json")
MACRO_FP=$(jq -r '.evidenceFingerprintSha256' "$OUTPUT_DIR/macro.json")
MACRO_DELTA_VAB=$(jq -r '.metrics.delta.vabDiffEuros' "$OUTPUT_DIR/macro.json")
MACRO_DELTA_EXT=$(jq -r '.metrics.delta.externalitiesDiffEuros' "$OUTPUT_DIR/macro.json")
MACRO_UNCERTAINTY=$(jq -r '.uncertaintyType' "$OUTPUT_DIR/macro.json")

STRESS_ID=$(jq -r '.id' "$OUTPUT_DIR/stress.json")
STRESS_FP=$(jq -r '.evidenceFingerprintSha256' "$OUTPUT_DIR/stress.json")
STRESS_VERDICT=$(jq -r '.globalResilienceVerdict' "$OUTPUT_DIR/stress.json")
STRESS_T1=$(jq -r '.horizons["T+1"].resilienceScorePct' "$OUTPUT_DIR/stress.json")
STRESS_T4=$(jq -r '.horizons["T+4"].resilienceScorePct' "$OUTPUT_DIR/stress.json")
STRESS_T24=$(jq -r '.horizons["T+24"].resilienceScorePct' "$OUTPUT_DIR/stress.json")

INCIDENT_ID=$(jq -r '.incident.id' "$OUTPUT_DIR/agent.json")
INCIDENT_SEVERITY=$(jq -r '.incident.severity' "$OUTPUT_DIR/agent.json")
INCIDENT_FP=$(jq -r '.incident.evidenceFingerprintSha256' "$OUTPUT_DIR/agent.json")
PLAN_ID=$(jq -r '.interventionPlan.id' "$OUTPUT_DIR/agent.json")
PLAN_STATUS=$(jq -r '.interventionPlan.status' "$OUTPUT_DIR/agent.json")
PLAN_FP=$(jq -r '.interventionPlan.evidenceFingerprintSha256' "$OUTPUT_DIR/agent.json")
L1_COUNT=$(jq '[.interventionPlan.actions[] | select(.riskLevel == "NIVEL_1_INFORMATIVO_AUTONOMO" and .status == "EJECUTADA_AUTONOMA")] | length' "$OUTPUT_DIR/agent.json")
L2_PENDING=$(jq '[.interventionPlan.actions[] | select(.riskLevel == "NIVEL_2_OPERATIVO_FIRMA_HUMANA" and .status == "PENDIENTE")] | length' "$OUTPUT_DIR/agent.json")
AVISO_AUTONOMOUS=$(jq '[.interventionPlan.actions[] | select(.code == "AVISO_APP_VISITANTES" and .riskLevel == "NIVEL_1_INFORMATIVO_AUTONOMO" and .isPreApprovedByDirective == true and .status == "EJECUTADA_AUTONOMA")] | length' "$OUTPUT_DIR/agent.json")

for id in "$MACRO_ID" "$STRESS_ID" "$INCIDENT_ID" "$PLAN_ID"; do
  if [[ ! "$id" =~ ^[A-Za-z0-9_-]+$ ]]; then
    printf 'ERROR: Identificador de evidencia con formato no permitido.\n' >&2
    exit 1
  fi
done

for fp in "$MACRO_FP" "$STRESS_FP" "$INCIDENT_FP" "$PLAN_FP"; do
  if [[ ! "$fp" =~ ^[a-f0-9]{64}$ ]]; then
    printf 'ERROR: Huella SHA-256 inválida en la respuesta integrada.\n' >&2
    exit 1
  fi
done

[[ "$STRESS_VERDICT" == "RIESGO_COLAPSO_INMINENTE" ]] || {
  printf 'ERROR: El estrés extremo no produjo el veredicto esperado.\n' >&2; exit 1;
}
[[ "$INCIDENT_SEVERITY" == "ROJA_COLAPSO_INMINENTE" ]] || {
  printf 'ERROR: El agente no detectó colapso inminente.\n' >&2; exit 1;
}
[[ "$PLAN_STATUS" == "PENDIENTE_FIRMA_HUMANA" ]] || {
  printf 'ERROR: El plan no quedó bloqueado en espera de firma humana.\n' >&2; exit 1;
}
[[ "$L1_COUNT" == "2" && "$L2_PENDING" == "2" && "$AVISO_AUTONOMOUS" == "1" ]] || {
  printf 'ERROR: No se conservó el contrato PMV/App de Nivel 1 y dos medidas Nivel 2 pendientes.\n' >&2; exit 1;
}

# Se verifica que el plan permanezca sin decisión humana y no se ejecuta ninguna medida física.
PLAN_DB_JSON=$(PAGER=cat sudo -u postgres psql -X -At -v ON_ERROR_STOP=1 -d gemelotur -c \
  "SELECT json_build_object(
     'planStatus', p.status,
     'tenantId', p.tenant_id,
     'destinationId', p.destino_id,
     'decisionCount', COUNT(d.id),
     'immutableDecisionFingerprint', COALESCE(MAX(d.decision_fingerprint_sha256), '')
   )
   FROM planes_intervencion_rapida p
   LEFT JOIN decisiones_intervencion_agente d ON d.plan_id = p.id
   WHERE p.id = '${PLAN_ID}'
   GROUP BY p.id, p.status, p.tenant_id, p.destino_id;")

DB_PLAN_STATUS=$(printf '%s' "$PLAN_DB_JSON" | jq -r '.planStatus')
DB_DECISION_COUNT=$(printf '%s' "$PLAN_DB_JSON" | jq -r '.decisionCount')
if [[ "$DB_PLAN_STATUS" != "PENDIENTE_FIRMA_HUMANA" || "$DB_DECISION_COUNT" != "0" ]]; then
  printf 'ERROR: La compuerta human-in-the-loop no se mantuvo durante la prueba.\n' >&2
  exit 1
fi

printf '%s\n' "$PLAN_DB_JSON" > "$OUTPUT_DIR/db-evidence.json"
MACRO_ARTIFACT_SHA=$(sha256sum "$OUTPUT_DIR/macro.json" | awk '{print $1}')
STRESS_ARTIFACT_SHA=$(sha256sum "$OUTPUT_DIR/stress.json" | awk '{print $1}')
AGENT_ARTIFACT_SHA=$(sha256sum "$OUTPUT_DIR/agent.json" | awk '{print $1}')
DB_ARTIFACT_SHA=$(sha256sum "$OUTPUT_DIR/db-evidence.json" | awk '{print $1}')

DURATION_MS=$((END_MS - START_MS))
COMPOSITE_SHA=$(printf '%s' "${RUN_TAG}|${TENANT_ID}|${DESTINO}|${MACRO_FP}|${STRESS_FP}|${INCIDENT_FP}|${PLAN_FP}|${PLAN_DB_JSON}" | sha256sum | awk '{print $1}')

jq -n \
  --arg runTag "$RUN_TAG" \
  --arg executedAt "$TIMESTAMP" \
  --arg tenantId "$TENANT_ID" \
  --arg destinationId "$DESTINO" \
  --arg macroId "$MACRO_ID" \
  --arg macroFingerprintSha256 "$MACRO_FP" \
  --arg macroUncertainty "$MACRO_UNCERTAINTY" \
  --argjson macroVabDelta "$MACRO_DELTA_VAB" \
  --argjson macroExternalitiesDelta "$MACRO_DELTA_EXT" \
  --arg stressId "$STRESS_ID" \
  --arg stressFingerprintSha256 "$STRESS_FP" \
  --arg stressVerdict "$STRESS_VERDICT" \
  --argjson resilienceT1 "$STRESS_T1" \
  --argjson resilienceT4 "$STRESS_T4" \
  --argjson resilienceT24 "$STRESS_T24" \
  --arg incidentId "$INCIDENT_ID" \
  --arg incidentSeverity "$INCIDENT_SEVERITY" \
  --arg incidentFingerprintSha256 "$INCIDENT_FP" \
  --arg planId "$PLAN_ID" \
  --arg planStatus "$PLAN_STATUS" \
  --arg planFingerprintSha256 "$PLAN_FP" \
  --argjson level1AutonomousActions "$L1_COUNT" \
  --argjson level2PendingHumanSignature "$L2_PENDING" \
  --arg macroArtifactSha256 "$MACRO_ARTIFACT_SHA" \
  --arg stressArtifactSha256 "$STRESS_ARTIFACT_SHA" \
  --arg agentArtifactSha256 "$AGENT_ARTIFACT_SHA" \
  --arg databaseArtifactSha256 "$DB_ARTIFACT_SHA" \
  --argjson decisionCount "$DB_DECISION_COUNT" \
  --arg compositeEvidenceFingerprintSha256 "$COMPOSITE_SHA" \
  --argjson elapsedMilliseconds "$DURATION_MS" \
  '{
    type: "CombinedStressValidationResult",
    testData: true,
    externalActionPerformed: false,
    scenario: "COLAPSO_EVENTO_EXTRAORDINARIO",
    runTag: $runTag,
    executedAt: $executedAt,
    tenantId: $tenantId,
    destinationId: $destinationId,
    macroeconomic: {
      simulationId: $macroId,
      evidenceFingerprintSha256: $macroFingerprintSha256,
      uncertaintyType: $macroUncertainty,
      deltaVabEuros: $macroVabDelta,
      deltaExternalitiesEuros: $macroExternalitiesDelta
    },
    territorialStress: {
      testId: $stressId,
      evidenceFingerprintSha256: $stressFingerprintSha256,
      globalVerdict: $stressVerdict,
      resilienceScore: {"T+1": $resilienceT1, "T+4": $resilienceT4, "T+24": $resilienceT24}
    },
    agentResponse: {
      incidentId: $incidentId,
      severity: $incidentSeverity,
      incidentFingerprintSha256: $incidentFingerprintSha256,
      planId: $planId,
      planFingerprintSha256: $planFingerprintSha256,
      planStatus: $planStatus,
      level1AutonomousActions: $level1AutonomousActions,
      level2PendingHumanSignature: $level2PendingHumanSignature,
      immutableDecisionCount: $decisionCount
    },
    sourceArtifactFingerprintsSha256: {
      macroJson: $macroArtifactSha256,
      stressJson: $stressArtifactSha256,
      agentJson: $agentArtifactSha256,
      databaseEvidenceJson: $databaseArtifactSha256
    },
    governance: {
      humanApprovalRequired: true,
      humanApprovalPerformed: false,
      physicalOrExternalMeasuresTriggered: false,
      statement: "La prueba calcula y registra respuestas. No ha autorizado ni ejecutado medidas físicas, policiales o externas."
    },
    compositeEvidenceFingerprintSha256: $compositeEvidenceFingerprintSha256,
    elapsedMilliseconds: $elapsedMilliseconds
  }' > "$OUTPUT_DIR/summary.json"

(
  cd "$OUTPUT_DIR"
  sha256sum macro.json stress.json agent.json db-evidence.json summary.json
) > "$OUTPUT_DIR/SHA256SUMS.txt"

printf '✓ Prueba integrada completada en %sms.\n' "$DURATION_MS"
printf '✓ Macro: %s | Estrés: %s | Incidente: %s | Plan: %s\n' "$MACRO_ID" "$STRESS_ID" "$INCIDENT_ID" "$PLAN_ID"
printf '✓ Plan conservado en %s sin firma humana (%s decisiones).\n' "$DB_PLAN_STATUS" "$DB_DECISION_COUNT"
printf '✓ Evidencia compuesta SHA-256: %s\n' "$COMPOSITE_SHA"
printf '✓ Artefactos: %s\n' "$OUTPUT_DIR"
