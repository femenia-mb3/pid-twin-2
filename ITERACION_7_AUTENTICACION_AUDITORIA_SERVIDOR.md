# INFORME TÉCNICO — ITERACIÓN 7
## Autenticación Institucional Abierta, Tokens JWT/Claims y Registro de Auditoría Server-Side

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Objetivo de la Iteración:** Cerrar el ciclo institucional de seguridad y trazabilidad: sustituir cabeceras demostradoras por tokens de sesión JWT verificados criptográficamente (HS256) con claims territoriales, e implantar un registro inmutable de auditoría donde las propuestas de IA se persisten de forma inmediata en el servidor y las decisiones humanas se asocian mediante un modelo append-only puro sobre identificadores oficiales.  
**Fecha:** 8 de Octubre de 2026  
**Estado:** Superado y verificado al 100% (8 de 8 casos en suite automatizada).

---

## 1. Arquitectura y Nuevas Capacidades Implementadas

### A. Autenticación Institucional Abierta Basada en Tokens JWT (RFC 7519)
- **Servicio `JwtAuthService`**: Implementación en TypeScript basada en criptografía estándar de Node.js (`crypto.createHmac`), sin dependencias pesadas propietarias ni vendor lock-in.
- **Claims Oficiales Verificados**:
  - `sub`: Identificador único del operador (ej. `op_malaga_01`).
  - `username`: Nombre de usuario institucional (`gestor_malaga`, `operador_palma`, `admin_segittur`).
  - `displayName`: Nombre completo y cargo del operador municipal.
  - `email`: Correo institucional (`@malaga.es`, `@palma.es`, `@segittur.es`).
  - `tenantId` y `tenantName`: Ámbito legal de gobernanza (`tenant_ayto_malaga`, `tenant_ayto_palma`, `tenant_segittur_global`).
  - `role`: Rol operativo (`GESTOR_TURISMO`, `OPERADOR_MOVILIDAD`, `ADMIN_SEGITTUR`).
  - `authorizedDestinations`: Array con los destinos sobre los que el operador dispone de potestad administrativa.
  - `iat` y `exp`: Timestamp de emisión y expiración (24 horas).
- **Transporte Seguro**: Soporte tanto para cabecera HTTP estándar `Authorization: Bearer <token>` como para cookies de sesión seguras (`SameSite=None; Secure`).
- **Control Estricto de Acceso Territorial (403 Forbidden)**: El middleware `scenarioScope` valida que el operador posea en sus claims el destino solicitado. Un intento de consulta o simulación fuera de su jurisdicción es bloqueado inmediatamente con `403 Forbidden`.

### B. Registro Inmutable de Auditoría en Servidor (Anti-Manipulación de Cliente)
- **Generación y Persistencia Atómica**: Cuando un usuario invoca el Agente IA (`POST /api/ai/simulate-prompt`), el servidor genera la propuesta formal vinculada a la huella criptográfica SHA-256 del contexto y **la persiste inmediatamente en la base de datos PostGIS en estado `PROPUESTO`**.
- **Contrato de Decisión Humana por `proposalId`**: El endpoint `POST /api/ai/audit/decision` ya no recibe objetos de propuesta arbitrarios enviados por el cliente. Requiere exclusivamente el `proposalId` oficial registrado previamente en el servidor.
- **Validación Negativa (404 Not Found)**: Si un cliente malicioso o defectuoso intenta inyectar una propuesta inexistente o alterada, el servidor rechaza la transacción con `404 Not Found`.

### C. Migración SQL `011_auditoria_server_side_jwt.sql` (Event Sourcing de Decisiones)
- Nueva tabla `ai_decisions_audit` con claves foráneas hacia `ai_proposals_audit(id)` y `destino_perfiles_semanticos(tenant_id, destino_id)`.
- Políticas `FORCE ROW LEVEL SECURITY` por tenant y destino.
- Disparador de inmutabilidad estricta `trg_decision_immutable`: prohíbe operaciones de `UPDATE` y `DELETE` sobre el histórico de decisiones humanas.
- Permisos asignados al rol de aplicación no-superusuario `gemelotur_app`.

---

## 2. Resultados de la Suite Automatizada de Validación

Se ejecutó la suite `scripts/validate_iteration7_institutional_auth.sh` contra el servidor residente en puerto 3001 respaldado por PostgreSQL 16 y PostGIS 3.4:

| Caso | Prueba de Validación | Resultado Obtenido | Estado |
| :--- | :--- | :--- | :---: |
| **TEST 1** | Verificación de salud y persistencia PostGIS | `POSTGIS_PERSISTED_PILOT`, persistencia `true`, 2 destinos | **PASADO** |
| **TEST 2** | Login institucional (`POST /api/auth/login`) | Token JWT HS256 generado con claims completos (`tenant_ayto_malaga`, 86400s) | **PASADO** |
| **TEST 3** | Verificación de sesión Bearer (`GET /api/auth/me`) | Token verificado con éxito, identidad resuelta (`gestor_malaga`) | **PASADO** |
| **TEST 4** | Control negativo de acceso territorial | Intento de acceso a Palma con token de Málaga bloqueado con `403 Forbidden` | **PASADO** |
| **TEST 5** | Petición de propuesta al Agente IA | Propuesta generada con huella SHA-256 de contexto | **PASADO** |
| **TEST 6** | Comprobación de persistencia inmediata server-side | Propuesta localizada en `ai_proposals_audit` sin acción previa del cliente | **PASADO** |
| **TEST 7** | Registro de decisión humana por `proposalId` | Evento append-only registrado exitosamente en `ai_decisions_audit` | **PASADO** |
| **TEST 8** | Rechazo de propuesta ficticia inyectada | Petición con `proposalId` inexistente rechazada con `404 Not Found` | **PASADO** |

---

## 3. Entregables de la Iteración 7

1. `src/types/institutionalAuth.ts`: Contratos de claims JWT, peticiones de login y decisiones de auditoría.
2. `src/services/jwtAuthService.ts`: Módulo Open Source de emisión y verificación criptográfica de tokens HS256.
3. `database/migrations/011_auditoria_server_side_jwt.sql`: Esquema SQL append-only con RLS e inmutabilidad estricta.
4. `src/services/postgisRepository.ts`: Métodos de consulta de propuestas previas y registro append-only de decisiones humanas.
5. `src/services/pilotOperationsService.ts`: Métodos `registerServerProposal` y `recordServerProposalDecision`.
6. `server.ts`: Endpoints protegidos por token Bearer JWT y validación automática de claims.
7. `src/components/InstitutionalAuthModal.tsx`: Modal visual para conmutación de operadores institucionales demostradores.
8. `src/components/AiSimulationDrawer.tsx`: Enrutamiento seguro de decisiones mediante `proposalId`.
9. `scripts/validate_iteration7_institutional_auth.sh`: Suite de validación automatizada de 8 casos.
