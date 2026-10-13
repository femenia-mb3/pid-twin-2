# PLAN ITERACIÓN 6: OPERACIÓN, AUTENTICACIÓN, AUDITORÍA Y PREDICCIÓN CALIBRABLE

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Objetivo:** Transformar el MVP en un piloto operativo multidestino listo para producción institucional: autenticación por claims de sesión, auditoría transaccional de propuestas y decisiones en PostGIS con RLS, configurador de protocolos operativos ante saturación, registro para calibración de predicción vs observación real, y especificación de datos para el destino piloto.  
**Fecha:** 8 de Octubre de 2026  
**Iteración:** 6 de 6

---

## 1. Principios Rectores y Gobernanza Institucional

1. **Identidad Operativa y Autorización por Claims (Sustitución de Header Demostrador)**:
   - Proveer un middleware de sesión (`operatorSessionMiddleware`) que resuelva la identidad del operador (`operatorId`, `displayName`, `roles`, `tenantId`, `authorizedDestinations`).
   - El operador autenticado sólo puede operar y consultar destinos a los que su tenant le da derecho; cualquier intento de acceder a otro destino genera `403 Forbidden`.
   - Soporte para selector de perfiles de operador demostrador en UI para validar la conmutación entre Ayto. de Málaga (`gestor_turismo_malaga`), Ayto. de Palma (`operador_movilidad_palma`) y Administrador General SEGITTUR (`admin_segittur`).

2. **Auditoría Transaccional en PostGIS con RLS (Knowledge Guard: Evidencia Inmutable)**:
   - Toda interacción relevante de IA (consulta en lenguaje natural, propuesta estructurada, evidencias vinculadas, decisión humana del operador, fecha, tiempo de respuesta y corrida generada) se registra en la tabla `ai_proposals_audit`.
   - Cumplimiento de **Vinculación Obligatoria a Evidencias**: se guardan la huella SHA-256 del contexto, las fuentes de datos citadas, los supuestos, la incertidumbre y la firma del operador humano que autorizó la ejecución o descarte.
   - Aislamiento estricto con `FORCE ROW LEVEL SECURITY` por `tenant_id` y `destino_id`.

3. **Modelado de Protocolos Operativos ante Saturación**:
   - Responder al requerimiento de modelado de procesos del pliego: definir qué ocurre operacionalmente cuando una zona o recurso supera el umbral crítico.
   - Entidad `OperationalProtocol`:
     - Zona / recurso objetivo y umbral detonante (p. ej. saturación >= 85%).
     - Responsable operativo (Policía Local, Movilidad, Turismo, Protección Civil).
     - Secuencia de acciones operativas (p. ej. desvío peatonal, refuerzo de lanzaderas, alerta a navieras, control de aforo).
     - Recursos asignados y confirmación de ejecución.
   - Endpoint `/api/protocols` y persistencia en tabla `protocolos_operativos`.

4. **Registro de Calibración Predictiva (Predicción T+X vs Observación Real)**:
   - Tabla `forecast_calibrations`:
     - Predicción generada para un horizonte temporal (T+1h, T+4h, T+24h).
     - Valor real observado posteriormente mediante sensores IoT o conteos.
     - Error absoluto medio (MAE) y porcentaje de desvío calibrado.
   - Permite al destino evaluar la precisión del gemelo sobre datos históricos reales.

5. **Plantilla Canónica de Datos para el Destino Piloto**:
   - Documento `PLANTILLA_INGESTION_DESTINO_PILOTO.md` con los esquemas exactos de las tres fuentes mínimas necesarias para calibrar el modelo real:
     1. Afluencias y conteos (IoT/cámaras/ticketing).
     2. Movilidad y aparcamientos.
     3. Contexto (calendario de cruceros, eventos y AEMET).

---

## 2. Modelo de Base de Datos: Migración `009_auditoria_protocolos_calibracion.sql`

- Tablas a crear:
  1. `operadores_sesion`: Identidades, roles (`OPERADOR_TURISMO`, `SUPERVISOR_MOVILIDAD`, `ADMIN_DESTINO`) y tenants asociados.
  2. `ai_proposals_audit`: Registro transaccional de consultas en lenguaje natural, propuestas, evidencias (fuentes, huella SHA-256), estado de decisión (`PROPUESTO`, `APLICADO_SIMULADOR`, `EXPORTADO_ESTUDIO`, `RECHAZADO`), y enlace a `simulation_runs.id`.
  3. `protocolos_operativos`: Definiciones de secuencias de actuación ante saturación y emergencias turísticas.
  4. `protocolos_ejecuciones`: Registro de activación de protocolos durante una simulación o en tiempo real.
  5. `calibraciones_predictivas`: Histórico de predicción vs dato observado con cálculo de error.

- Directivas `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` para todas las tablas.
- Actualización de `fn_gemelotur_persistence_health()` para contabilizar las nuevas entidades.

---

## 3. Endpoints API REST (`server.ts`)

- `GET /api/auth/me`: Devuelve la sesión del operador actual, tenant y permisos.
- `POST /api/auth/switch-operator`: Permite conmutar entre operadores de prueba en entorno demo.
- `GET /api/ai/audit`: Historial de consultas y propuestas auditadas para el destino activo.
- `POST /api/ai/audit/decision`: Registra la decisión humana (aplicar/editar/rechazar) vinculándola a la evidencia.
- `GET /api/protocols`: Lista los protocolos operativos del destino.
- `POST /api/protocols`: Crea o actualiza un protocolo operativo.
- `GET /api/calibrations`: Métricas de calibración y exactitud predictiva del gemelo.

---

## 4. Componentes UI (`src/components/`)

1. `OperationalProtocolsModal.tsx`: Visualizador y editor de protocolos de actuación ante saturación.
2. `AiAuditHistoryModal.tsx`: Panel de auditoría de propuestas IA con evidencia de quién autorizó cada corrida.
3. Selector de Operador/Identidad en la cabecera para demostrar la conmutación de tenants con control de acceso real.
4. Integración en `OperationalSnapshotPanel.tsx` y `App.tsx`.

---

## 5. Verificación y Suite Automatizada

- Script `scripts/validate_iteration6_pilot_operations.sh`.
- Verificaciones:
  - Autenticación y claims: rechazo automático ante operador de tenant no autorizado.
  - Auditoría PostGIS: persistencia inmutable de la propuesta IA con huella SHA-256 y decisión humana.
  - Protocolos operativos: creación y activación ante zonas saturadas.
  - Calibración: cálculo de error predictivo T+4h.
