# INFORME TÉCNICO — ITERACIÓN 6: OPERACIONES DE PILOTO, AUDITORÍA Y CALIBRACIÓN

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Fecha:** 8 de Octubre de 2026  
**Iteración:** 6 de 6 — Cierre Operativo de Piloto Institucional  
**Autor:** Manus Dev Team  

---

## 1. Resumen Ejecutivo de la Entrega

La **Iteración 6** culmina la evolución del Gemelo Digital Turístico desde un demostrador interactivo avanzado hacia un **piloto institucional operativo** listo para su implantación en cualquier destino español de la Red DTI / SEGITTUR.

Se han incorporado cuatro pilares estratégicos requeridos por el pliego y la gobernanza PID:
1. **Identidad Operativa y Control de Acceso por Claims**: sustitución del header demostrador por autorización estricta en servidor según los roles y destinos asignados a cada operador (`gestor_malaga`, `gestor_palma`, `admin_pid`). Acceso denegado con `403 Forbidden` ante destinos cruzados.
2. **Auditoría Inmutable en PostGIS (Knowledge Guard: Evidencia Obligatoria)**: almacenamiento transaccional con RLS forzado (`FORCE ROW LEVEL SECURITY`) de cada propuesta generada por IA, su huella criptográfica SHA-256 de 64 caracteres, fuentes citadas, supuestos, incertidumbre y la decisión humana del operador responsable (`APLICADO_SIMULADOR`, `RECHAZADO`, etc.). Se implementa el trigger `trg_audit_immutable` que prohíbe cualquier mutación (`UPDATE`/`DELETE`) sobre los registros de auditoría.
3. **Modelado y Ejecución de Protocolos ante Saturación**: catálogo de secuencias de actuación operativa (desvíos peatonales, lanzaderas, avisos a navieras) activables ante sobrecargas territoriales ($\ge 85\%$).
4. **Calibración Predictiva Empírica**: registro continuo de predicciones frente a observaciones reales de sensores IoT y cálculo de error empírico (MAE y % de desvío) en horizontes T+1h, T+4h y T+24h.
5. **Guía y Especificación de Ingestión para el Destino Piloto**: contrato normalizado para integrar las 3 familias mínimas de datos reales (afluencia, movilidad y contexto/cruceros).

---

## 2. Componentes y Contratos Implementados

### 2.1 Base de Datos y Migraciones SQL
- `database/migrations/009_auditoria_protocolos_calibracion.sql`: creación de las tablas `operadores_sesion`, `ai_proposals_audit`, `protocolos_operativos` y `calibraciones_predictivas` con RLS y actualización de la métrica de salud `fn_gemelotur_persistence_health()`.
- `database/migrations/010_endurecimiento_auditoria_protocolos.sql`: revocación de privilegios `UPDATE/DELETE/TRUNCATE` al rol de aplicación `gemelotur_app`, trigger de inmutabilidad estricta y tabla `protocolos_ejecuciones`.

### 2.2 Servicios Backend (`server.ts`, `pilotOperationsService.ts`, `postgisRepository.ts`)
- `GET /api/auth/me`: resuelve la sesión del operador y sus destinos autorizados.
- `GET /api/auth/operators`: catálogo de identidades para la demo interactiva.
- `POST /api/auth/switch-operator`: conmutación entre perfiles demostradores.
- `GET /api/ai/audit`: consulta del log inmutable de auditoría para el destino activo.
- `POST /api/ai/audit/decision`: registro transaccional de la decisión humana con vinculación estricta a la propuesta previa.
- `GET /api/protocols`: consulta de protocolos de saturación con sus unidades coordinadoras y pasos.
- `GET /api/calibrations`: métricas empíricas de precisión predictiva y error por horizonte.

### 2.3 Interfaz de Usuario (`src/components/`, `App.tsx`)
- `OperationalProtocolsModal.tsx`: visor de protocolos con detalle de unidades (Policía Local, Movilidad, Puerto), recursos y tiempos de respuesta.
- `AiAuditHistoryModal.tsx`: visor de auditoría con huellas criptográficas SHA-256, fuentes autorizadas y trazabilidad de operadores.
- `ForecastCalibrationModal.tsx`: panel de contraste con métricas de error y tabla de mediciones recientes.
- Botones integrados en la cabecera del Gemelo Turístico respetando la paleta clara e institucional de SEGITTUR.

---

## 3. Matriz de Validación de la Suite Automatizada

Ejecutada mediante `scripts/validate_iteration6_pilot_operations.sh`:

| Prueba | Descripción | Resultado |
|---|---|---|
| **TEST 1** | Conectividad y salud PostGIS con métricas actualizadas | **PASS** (`POSTGIS_PERSISTED_PILOT`, 2 destinos) |
| **TEST 2** | Identidad del operador resuelta por claims | **PASS** (`gestor_malaga`, `GESTOR_TURISMO`) |
| **TEST 3** | Catálogo de operadores disponibles | **PASS** (3 operadores configurados) |
| **TEST 4** | Conmutación de operador demostrador | **PASS** (`gestor_palma` activo) |
| **TEST 4b** | Rechazo por claims cruzados (Palma sobre Málaga) | **PASS** (`HTTP 403 Forbidden`) |
| **TEST 5** | Recuperación de protocolos operativos | **PASS** (1 protocolo, `POLICIA_LOCAL`) |
| **TEST 6** | Propuesta IA + Registro inmutable de decisión humana | **PASS** (Huella SHA-256 verificada) |
| **TEST 7** | Métricas de calibración predictiva empírica | **PASS** (Desvío horizonte T+1h: 2.33%) |

---

## 4. Estado de Publicación y Código Canónico

Todos los archivos han sido compilados con TypeScript estricto (`pnpm lint`) y Vite (`pnpm build`).
El repositorio canónico ha recibido todas las modificaciones, garantizando el despliegue del contenedor Docker sin dependencias rotas y con todas las migraciones SQL documentadas.
