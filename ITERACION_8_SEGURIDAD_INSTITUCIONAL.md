# INFORME TÉCNICO — ITERACIÓN 8
## Seguridad Institucional Real, Proveedor OIDC / Manus OAuth, Claims Obligatorios y Auditoría Durable sin Fallback

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Objetivo de la Iteración:** Transformar el prototipo de seguridad en un sistema de autenticación institucional riguroso, resolviendo las no conformidades del dictamen independiente de la Iteración 7:
1. Eliminación total de fallbacks a operadores globales en memoria.
2. Requisito de autenticación obligatoria por petición (`401 Unauthorized` ante cualquier petición no autenticada).
3. Integración con el proveedor OIDC institucional (flujo Manus OAuth: authorize, exchange token y get user info).
4. Persistencia durable obligatoria en auditoría PostGIS (cero fallbacks silenciosos a arrays volátiles).
5. Endurecimiento de la cookie de sesión a `HttpOnly; Secure; SameSite=None` y validación estricta de claims RFC 7519 (`iss`, `aud`, `exp`).  
**Fecha:** 8 de Octubre de 2026  
**Estado:** Superado y validado al 100% (10 de 10 casos en suite automatizada).

---

## 1. Principales Endurecimientos de Seguridad Implementados

### A. Autenticación Obligatoria y Eliminación de Estado Global Compartido
- **Middleware `scenarioScope` y `verifyOperatorClaims`**: Se ha erradicado el acceso anónimo con operador implícito. Si una petición no aporta un Bearer JWT válido o una cookie de sesión firmada, el servidor responde indefectiblemente **`401 Unauthorized`**.
- **Validación Criptográfica Estricta**: `JwtAuthService` valida con `crypto.timingSafeEqual`:
  - Firma HMAC-SHA256 mediante el secreto de plataforma `MANUS_JWT_SECRET`.
  - Expiración obligatoria (`exp > now`).
  - Emisor oficial (`iss: 'segittur-pid-auth'`) y audiencia (`aud: 'gemelo-digital-turistico'`).
  - Estructura de claims: `tenantId`, `role` y `authorizedDestinations`.
- **CORS Seguro**: Se incorpora `Authorization` en los encabezados permitidos y se activa `credentials: true` para orígenes explícitamente autorizados.

### B. Integración OIDC / Manus OAuth (`src/services/oauthService.ts`)
- Módulo cliente para interactuar con la infraestructura OIDC institucional:
  - `GET /api/oauth/authorize-url`: Generación de URLs de autorización con `nonce` criptográfico en base64.
  - `POST /api/oauth/callback`: Intercambio de código por `accessToken` mediante `$MANUS_OAUTH_API_URL/webdev.v1.WebDevAuthPublicService/ExchangeToken` y consulta de perfil a `GetUserInfo`.
  - Vinculación automática del `openId` con el operador institucional municipal o de SEGITTUR.
  - Emisión de la cookie oficial de sesión `webdev_app_session` con `HttpOnly; Secure; SameSite=None`.

### C. Auditoría Durable sin Fallback Silencioso a Memoria
- En `pilotOperationsService.ts`, se han eliminado los bloques que degradaban silenciosamente a arrays en memoria en caso de fallo de base de datos.
- Si PostGIS no está disponible o el rol `gemelotur_app` no puede insertar la propuesta o la decisión, la transacción es abortada y el servidor responde con error explícito, evitando que un cliente reciba una falsa confirmación de auditoría.

### D. Migración SQL `012_seguridad_institucional_oidc.sql`
- Creación de la tabla `operadores_institucionales` vinculando identidades OIDC, correos municipales y hashes bcrypt (`pgcrypto`) para claves de API entre administraciones.
- Inclusión de restricción única compuesta `(id, tenant_id, destino_id)` en `ai_proposals_audit`.
- Revocación explícita de privilegios destructivos (`DELETE`, `TRUNCATE`) al rol `gemelotur_app`.

---

## 2. Resultados de la Suite Automatizada de Validación

Se ejecutó la suite [validate_iteration8_institutional_security.sh](/home/ubuntu/gemelotur/scripts/validate_iteration8_institutional_security.sh) contra el servidor residente en puerto 3001:

| Caso | Verificación de Seguridad | Resultado Obtenido | Estado |
| :--- | :--- | :--- | :---: |
| **TEST 1** | Salud del servidor y persistencia PostGIS | `POSTGIS_PERSISTED_PILOT`, persistencia `true`, 2 destinos | **PASADO** |
| **TEST 2** | Petición anónima a `/api/scenarios` sin token | Rechazo estricto con `401 Unauthorized` | **PASADO** |
| **TEST 3** | Petición anónima a `/api/ai/capabilities` sin token | Rechazo estricto con `401 Unauthorized` | **PASADO** |
| **TEST 4** | Login institucional con clave segura | Emisión de token JWT con `iss`, `aud` y claims de tenant | **PASADO** |
| **TEST 5** | Verificación de sesión Bearer en `/api/auth/me` | Sesión validada con `tokenVerified: true` | **PASADO** |
| **TEST 6** | Petición con token manipulado / firma falsa | Rechazo estricto con `401 Unauthorized` | **PASADO** |
| **TEST 7** | Intento de acceso a Palma con token de Málaga | Rechazo estricto con `403 Forbidden` | **PASADO** |
| **TEST 8** | Generación de propuesta IA con token autenticado | Propuesta generada con huella SHA-256 de contexto | **PASADO** |
| **TEST 9** | Comprobación de persistencia obligatoria PostGIS | Propuesta registrada en `ai_proposals_audit` | **PASADO** |
| **TEST 10** | Registro de decisión humana sobre proposalId oficial | Evento append-only registrado con éxito en `ai_decisions_audit` | **PASADO** |

---

## 3. Estado de Despliegue y Checkpoints Git

1. Código sincronizado hacia el repositorio canónico en `/home/ubuntu/workspace-f27814b6f0ee90fd80de962a030015ed`.
2. Compilación completa verificada: `pnpm lint` y `pnpm build` sin errores.
3. Commit canónico registrado: `feat(security): iteracion 8 - seguridad institucional OIDC, claims obligatorios y auditoria durable`.
4. Push a `origin main` completado con éxito.
