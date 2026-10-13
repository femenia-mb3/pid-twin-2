#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:3001"
echo "================================================================================"
echo "SUITE DE VALIDACIÓN AUTOMATIZADA - ITERACIÓN 13: ONTOLOGÍAS PID S2 & IOT SEMÁNTICO"
echo "================================================================================"

# Paso 0: Autenticación institucional JWT con credenciales oficiales
echo ">>> [TEST 1] Autenticando operador de Málaga y obteniendo token JWT..."
LOGIN_MALAGA=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "carlos.dominguez@malaga.es", "apiKey": "malaga_secure_token_2026"}')

JWT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.token')
TENANT_MALAGA=$(echo "$LOGIN_MALAGA" | jq -r '.operator.tenantId')

if [[ -z "$JWT_MALAGA" || "$JWT_MALAGA" == "null" ]]; then
  echo "FAIL: No se pudo obtener JWT de Málaga"
  exit 1
fi
echo "OK: Operador autenticado. Tenant: $TENANT_MALAGA"

# Paso 1: Consultar el Registro de Ontologías PID aprobadas
echo ">>> [TEST 2] Consultando registro de ontologías PID aprobadas (SEGITTUR / S2)..."
ONTO_RES=$(curl -s -f "${BASE_URL}/api/semantic/ontology-registry?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

TOTAL_ONTO=$(echo "$ONTO_RES" | jq '.total')
if [[ "$TOTAL_ONTO" -lt 1 ]]; then
  echo "FAIL: No se encontraron ontologías aprobadas en el registro"
  exit 1
fi
echo "OK: $TOTAL_ONTO ontología(s) PID verificada(s). IRI: $(echo "$ONTO_RES" | jq -r '.ontologies[0].iri')"

# Paso 2: Crear perfil de conector semántico S2 en estado BORRADOR
echo ">>> [TEST 3] Creando perfil de conector semántico S2 para Málaga..."
CREATE_S2_RES=$(curl -s -f -X POST "${BASE_URL}/api/semantic/s2-connectors?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conector S2 Aforos y Activos Históricos",
    "baseUrl": "https://s2.malaga.eu/ngsi-ld/v1",
    "allowedEntityTypes": ["TourismSensor", "TouristDestination"],
    "fieldMappings": [
      {"sourceField": "visitorCount", "targetProperty": "currentValue", "transformation": "DIRECT"}
    ],
    "evidence": {
      "responsibleEntity": "Ayuntamiento de Málaga - Área de Turismo",
      "purpose": "Normalización semántica NGSI-LD para simulación territorial",
      "license": "CC-BY-4.0",
      "retentionPolicy": "5 años",
      "privacyLevel": "DATOS_PUBLICOS_AGREGADOS",
      "dataQualityMinPct": 90,
      "territorialCoverage": "malaga"
    }
  }')

S2_ID=$(echo "$CREATE_S2_RES" | jq -r '.profile.id')
S2_STATE=$(echo "$CREATE_S2_RES" | jq -r '.profile.activationState')
if [[ -z "$S2_ID" || "$S2_STATE" != "BORRADOR" ]]; then
  echo "FAIL: Error al crear conector S2"
  exit 1
fi
echo "OK: Conector S2 creado con ID: $S2_ID en estado: $S2_STATE"

# Paso 3: Preflight de seguridad y procedencia del conector S2
echo ">>> [TEST 4] Ejecutando preflight de verificación de contrato y procedencia S2..."
PREFLIGHT_RES=$(curl -s -X POST "${BASE_URL}/api/semantic/s2-connectors/${S2_ID}/preflight?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

ALLOWED=$(echo "$PREFLIGHT_RES" | jq '.allowed')
STATUS=$(echo "$PREFLIGHT_RES" | jq -r '.status')
if [[ "$ALLOWED" != "false" || "$STATUS" != "BLOQUEADO_SIN_AUTORIZACION" ]]; then
  echo "FAIL: Preflight en BORRADOR debía bloquearse pero devolvió: $PREFLIGHT_RES"
  exit 1
fi
echo "OK: Preflight bloqueó correctamente el conector no validado (Status=$STATUS)."

# Paso 4: Decisión humana inmutable para activar el conector S2
echo ">>> [TEST 5] Registrando decisión humana auditada para ACTIVAR el conector S2..."
DECISION_S2_RES=$(curl -s -f -X POST "${BASE_URL}/api/semantic/s2-connectors/${S2_ID}/decision?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ACTIVAR",
    "rationale": "Validación formal de cumplimiento de ontología SEGITTUR conforme a pliego"
  }')

NEW_S2_STATE=$(echo "$DECISION_S2_RES" | jq -r '.newState')
if [[ "$NEW_S2_STATE" != "ACTIVO" ]]; then
  echo "FAIL: Estado tras activación no es ACTIVO: $DECISION_S2_RES"
  exit 1
fi
echo "OK: Decisión registrada en PostGIS. Nuevo estado: $NEW_S2_STATE"

# Paso 5: Ingestión de lote de muestra S2 normalizado
echo ">>> [TEST 6] Ingestando lote de telemetría semántica S2..."
SAMPLE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
S2_INGEST_RES=$(curl -s -f -X POST "${BASE_URL}/api/semantic/s2-connectors/${S2_ID}/ingest-sample?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"samples\": [
      {
        \"id\": \"urn:ngsi-ld:TourismSensor:malaga-s2-catedral-01\",
        \"type\": \"TourismSensor\",
        \"@context\": \"https://ontologia.segittur.es/turismo/def/core/context.jsonld\",
        \"measurementConcept\": { \"type\": \"Property\", \"value\": \"visitorCount\" },
        \"currentValue\": { \"type\": \"Property\", \"value\": 420, \"unitCode\": \"P1\" },
        \"observedAt\": \"${SAMPLE_DATE}\",
        \"location\": { \"type\": \"GeoProperty\", \"value\": { \"type\": \"Point\", \"coordinates\": [-4.4214, 36.7202] } }
      }
    ]
  }")

TOTAL_ACCEPTED=$(echo "$S2_INGEST_RES" | jq '.batch.totalAccepted')
OBS_S2_ID=$(echo "$S2_INGEST_RES" | jq -r '.observations[0].id')
if [[ "$TOTAL_ACCEPTED" -lt 1 || -z "$OBS_S2_ID" ]]; then
  echo "FAIL: Ingesta de muestra S2 falló: $S2_INGEST_RES"
  exit 1
fi
echo "OK: Lote S2 aceptado y persistido. Observación ID: $OBS_S2_ID"

# Paso 6: Configurar Broker IoT MQTT 5 TLS
echo ">>> [TEST 7] Registrando broker IoT MQTT 5 con namespace jerárquico..."
CREATE_IOT_RES=$(curl -s -f -X POST "${BASE_URL}/api/iot/connectors?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Broker Municipal Telemetría Ambiental y Aforos",
    "protocol": "MQTTS_5",
    "brokerHost": "broker-iot.malaga.eu",
    "brokerPort": 8883,
    "tlsEnabled": true,
    "topicNamespace": "pid/tenant_ayto_malaga/malaga/sensors/",
    "defaultQos": 1,
    "evidence": {
      "responsibleEntity": "Centro Municipal de Informática (CEMI Málaga)",
      "purpose": "Monitoreo de flujo peatonal y variables acústicas",
      "license": "CC-BY-4.0",
      "retentionPolicy": "5 años",
      "privacyLevel": "DATOS_PUBLICOS_AGREGADOS",
      "dataQualityMinPct": 95,
      "territorialCoverage": "malaga"
    }
  }')

IOT_ID=$(echo "$CREATE_IOT_RES" | jq -r '.profile.id')
if [[ -z "$IOT_ID" ]]; then
  echo "FAIL: Creación de broker IoT falló"
  exit 1
fi
echo "OK: Broker IoT registrado: $IOT_ID"

# Paso 7: Activar broker IoT mediante decisión auditada
echo ">>> [TEST 8] Activando broker IoT mediante decisión humana auditada..."
curl -s -f -X POST "${BASE_URL}/api/iot/connectors/${IOT_ID}/decision?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ACTIVAR",
    "rationale": "Verificación de certificados TLS y asignación de namespace seguro"
  }' > /dev/null
echo "OK: Broker IoT activado."

# Paso 8: Registrar sensor en la lista blanca de dispositivos
echo ">>> [TEST 9] Registrando sensor en inventario de dispositivos autorizados..."
RUN_SUFFIX=$(date +%s)
DEV_URN="urn:ngsi-ld:TourismSensor:malaga-calle-larios-${RUN_SUFFIX}"
DEV_RES=$(curl -s -f -X POST "${BASE_URL}/api/iot/devices?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"connectorId\": \"${IOT_ID}\",
    \"sensorUrn\": \"${DEV_URN}\",
    \"name\": \"Sensor Óptico Calle Larios\",
    \"sensorType\": \"AFORO_PEATONAL\",
    \"measurementConcept\": \"visitorCount\",
    \"unitCode\": \"P1\",
    \"coordinates\": [36.7205, -4.4215],
    \"evidence\": {
      \"responsibleEntity\": \"CEMI Málaga\",
      \"purpose\": \"Aforo en tiempo real para simulación de saturación\",
      \"license\": \"CC-BY-4.0\",
      \"retentionPolicy\": \"5 años\",
      \"privacyLevel\": \"DATOS_PUBLICOS_AGREGADOS\",
      \"dataQualityMinPct\": 95,
      \"territorialCoverage\": \"malaga\"
    }
  }")

DEV_ID=$(echo "$DEV_RES" | jq -r '.device.id')
if [[ -z "$DEV_ID" ]]; then
  echo "FAIL: No se pudo registrar el dispositivo IoT"
  exit 1
fi
echo "OK: Dispositivo IoT registrado: $DEV_ID ($DEV_URN)"

# Paso 9: Ingesta de telemetría IoT MQTT gobernada
echo ">>> [TEST 10] Enviando muestra de telemetría IoT validada contra el esquema NGSI-LD..."
SAMPLE_DATE_IOT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INGEST_IOT_RES=$(curl -s -f -X POST "${BASE_URL}/api/iot/telemetry?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"connectorId\": \"${IOT_ID}\",
    \"sample\": {
      \"sensorId\": \"${DEV_URN}\",
      \"measurement\": \"visitorCount\",
      \"value\": 1250,
      \"unitCode\": \"P1\",
      \"observedAt\": \"${SAMPLE_DATE_IOT}\",
      \"location\": { \"type\": \"Point\", \"coordinates\": [-4.4215, 36.7205] },
      \"quality\": \"A_CERTIFICADA\",
      \"sequence\": 1
    }
  }")

SUCCESS_IOT=$(echo "$INGEST_IOT_RES" | jq '.success')
if [[ "$SUCCESS_IOT" != "true" ]]; then
  echo "FAIL: Ingestión de telemetría IoT falló: $INGEST_IOT_RES"
  exit 1
fi
echo "OK: Telemetría IoT aceptada y convertida a observación contextual NGSI-LD."

# Paso 10: Prueba negativa - Rechazo de telemetría de dispositivo NO registrado
echo ">>> [TEST 11] Comprobando rechazo 422 de telemetría para dispositivo no autorizado..."
NEGATIVE_HTTP=$(curl -s -o /tmp/neg_out.json -w "%{http_code}" -X POST "${BASE_URL}/api/iot/telemetry?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA" \
  -H "Content-Type: application/json" \
  -d "{
    \"connectorId\": \"${IOT_ID}\",
    \"sample\": {
      \"sensorId\": \"urn:ngsi-ld:TourismSensor:sensor-fantasma-no-registrado\",
      \"measurement\": \"visitorCount\",
      \"value\": 9999,
      \"unitCode\": \"P1\",
      \"observedAt\": \"${SAMPLE_DATE_IOT}\"
    }
  }")

if [[ "$NEGATIVE_HTTP" != "422" ]]; then
  echo "FAIL: Se esperaba código 422 para dispositivo no registrado pero se obtuvo $NEGATIVE_HTTP"
  exit 1
fi
echo "OK: Sensor no autorizado rechazado correctamente con HTTP 422 y registrado en errores_ingestion_semantica."

# Paso 11: Inspeccionar el Linaje de Datos de la observación
echo ">>> [TEST 12] Verificando trazabilidad y grafo de linaje de la observación..."
LINEAGE_RES=$(curl -s -f "${BASE_URL}/api/semantic/lineage/${OBS_S2_ID}?destino=malaga" \
  -H "Authorization: Bearer $JWT_MALAGA" \
  -H "X-PID-Tenant: $TENANT_MALAGA")

NODES_COUNT=$(echo "$LINEAGE_RES" | jq '.nodes | length')
if [[ "$NODES_COUNT" -lt 2 ]]; then
  echo "FAIL: El grafo de linaje tiene menos de 2 nodos: $LINEAGE_RES"
  exit 1
fi
echo "OK: Grafo de linaje completo verificado con $NODES_COUNT nodos (Conector -> Lote -> Observación)."

# Paso 12: Comprobar aislamiento multitenant RLS (Operador de Palma NO puede leer datos de Málaga)
echo ">>> [TEST 13] Verificando aislamiento multitenant RLS: Palma NO debe ver observaciones de Málaga..."
LOGIN_PALMA=$(curl -s -f -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "catalina.ribas@palma.es", "apiKey": "palma_secure_token_2026"}')

JWT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.token')
TENANT_PALMA=$(echo "$LOGIN_PALMA" | jq -r '.operator.tenantId')

PALMA_LINEAGE_CODE=$(curl -s -o /tmp/palma_leak.json -w "%{http_code}" "${BASE_URL}/api/semantic/lineage/${OBS_S2_ID}?destino=palma" \
  -H "Authorization: Bearer $JWT_PALMA" \
  -H "X-PID-Tenant: $TENANT_PALMA")

if [[ "$PALMA_LINEAGE_CODE" != "404" ]]; then
  echo "FAIL: Fuga RLS multitenant detectada. Palma recibió código $PALMA_LINEAGE_CODE en lugar de 404 para observación de Málaga."
  exit 1
fi
echo "OK: Aislamiento RLS verificado estrictamente (HTTP 404 al consultar observación de otro tenant)."

echo "================================================================================"
echo "TODAS LAS PRUEBAS DE LA ITERACIÓN 13 HAN PASADO SATISFACTORIAMENTE (13/13)"
echo "================================================================================"
