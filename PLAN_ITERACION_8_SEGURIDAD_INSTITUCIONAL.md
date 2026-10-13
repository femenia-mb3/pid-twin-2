# PLAN DE IMPLEMENTACIÓN — ITERACIÓN 8
## Seguridad Institucional Real, Proveedor OIDC / Manus OAuth, Claims Obligatorios y Auditoría Durable sin Fallback

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 8 de 10 (Seguridad institucional integral, autenticación obligatoria por petición, vinculación con IdP institucional y persistencia estricta de auditoría)  
**Principios:** Estándares abiertos (OIDC, OAuth2 RFC 6749, JWT RFC 7519, PostGIS RLS), eliminación de puertas traseras demostradoras, copilotaje auditable con humano en el circuito.

---

## 1. Diagnóstico y Objetivos de la Iteración 8

El dictamen independiente de la Iteración 7 identificó áreas que debían ser endurecidas antes de una puesta en piloto con datos reales:
1. **Fallback a Operador Global**: Si un cliente no enviaba token, el servidor utilizaba el operador en memoria global, omitiendo el `401 Unauthorized`.
2. **Login Demostrador por Nombre de Usuario**: Cualquiera podía solicitar un token para `admin_pid` sin comprobar secreto ni credencial.
3. **Auditoría con Fallback Silencioso a Memoria**: Si la base de datos PostGIS fallaba, el servidor respondía `200 OK` almacenando la propuesta en un array volátil en lugar de fallar de manera segura.
4. **Validación Incompleta de Claims**: El servicio JWT solo validaba la firma y la fecha de expiración, sin verificar obligatoriamente `iss`, `aud`, `tenantId`, `role` ni estructura de claims.
5. **Configuración de Cookies y CORS**: La cookie no tenía la directiva `HttpOnly` para proteger el token contra XSS.

### Objetivos Clave de la Iteración 8:
- **Autenticación Institucional Real OIDC / Manus OAuth**:
  - Habilitar el flujo de autorización estándar: redirección a `$MANUS_OAUTH_PORTAL_URL/app-auth`, intercambio de código mediante `$MANUS_OAUTH_API_URL/webdev.v1.WebDevAuthPublicService/ExchangeToken` y consulta de usuario a `GetUserInfo`.
  - Crear la tabla `operadores_institucionales` vinculando los `openId` institucionales con los tenants (`tenant_ayto_malaga`, `tenant_ayto_palma`), roles y destinos autorizados.
  - Almacenar la sesión institucional en la cookie oficial `webdev_app_session` con `HttpOnly; Secure; SameSite=None` para compatibilidad total con Preview en iframe y despliegue publicado.
  - Para pruebas automatizadas y soporte de APIs entre administraciones, proveer un mecanismo autenticado con clave de servicio (`X-PID-API-Key` o credencial firmada), eliminando cualquier bypass sin contraseña.
- **Middleware `requireInstitutionalAuth` Obligatorio**:
  - Eliminar el estado mutable `currentOperator` del proceso. Cada petición resuelve la identidad exclusivamente del token JWT verificado o de la sesión OAuth válida.
  - Peticiones sin autenticación a endpoints protegidos (`/api/scenarios`, `/api/runs`, `/api/ai/*`, `/api/protocols`, `/api/calibrations`) responden indefectiblemente `401 Unauthorized`.
  - Intento de acceso a un destino no contemplado en los claims del token responde `403 Forbidden`.
- **Auditoría Durable sin Fallback a Memoria**:
  - Si PostGIS no está disponible o rechaza el registro de la propuesta IA o de la decisión humana, el servidor **falla de forma segura con `503 Service Unavailable`** y no confirma al cliente una acción que no ha sido auditada.
- **Validación Estricta de Claims**:
  - Validación de emisor (`iss`), audiencia (`aud`), expiración estricta y formato de claims territoriales.

---

## 2. Plan de Módulos y Cambios

1. **Migración SQL 012 (`database/migrations/012_seguridad_institucional_oidc.sql`)**:
   - Tabla `operadores_institucionales` con `open_id`, `email`, `tenant_id`, `rol`, `destinos_autorizados` y clave API institucional cifrada.
   - Restricción de FK compuesta en `ai_decisions_audit` hacia `(proposal_id, tenant_id, destino_id)` para garantizar coherencia territorial integral.
   - Asignación de permisos mínimos estrictos a `gemelotur_app`.

2. **Tipos TypeScript (`src/types/institutionalAuth.ts`)**:
   - Extensión con contratos de respuesta OAuth, intercambio de tokens e identidades vinculadas a OpenID.

3. **Servicio OAuth y JWT (`src/services/jwtAuthService.ts` & `src/services/oauthService.ts`)**:
   - Validación estricta de claims (`iss`, `aud`, `exp`).
   - Cliente de intercambio de autorización para Manus OAuth / OIDC.
   - Emisión de cookies `webdev_app_session` con `HttpOnly: true`.

4. **Refactorización de Servidor (`server.ts`)**:
   - Middleware `requireInstitutionalAuth` que inyecta `req.auth` con el operador validado.
   - Eliminación de operadores globales compartidos entre usuarios.
   - Endpoints `/api/oauth/authorize-url`, `/api/oauth/callback` y `/api/auth/me`.
   - Endpoint de login con credencial segura para entornos de pruebas automatizadas.
   - Auditoría con garantía de persistencia: error `503` si la BD no confirma el guardado.

5. **Actualización de la Interfaz (`src/components/InstitutionalAuthModal.tsx` & `src/App.tsx`)**:
   - Soporte para inicio de sesión mediante Manus OAuth oficial y selector de credenciales autorizadas.
   - Visualización del estado autenticado en la barra superior con desconexión segura.

6. **Suite de Validación Automatizada (`scripts/validate_iteration8_institutional_security.sh`)**:
   - 10 casos de prueba comprobando rechazo 401 sin token, rechazo 403 por claims, firma inválida, flujo OAuth/JWT, persistencia obligatoria de auditoría y rechazo ante fallo de BD.
