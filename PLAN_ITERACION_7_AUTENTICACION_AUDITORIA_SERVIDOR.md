# PLAN DE IMPLEMENTACIÓN — ITERACIÓN 7
## Autenticación Institucional Abierta, Tokens/Claims y Auditoría de Propuestas en Servidor

**Proyecto:** Gemelo Digital Turístico PID — SEGITTUR  
**Ámbito:** Iteración 7 (Seguridad institucional, tokens de sesión, autorización por claims y ciclo cerrado de auditoría IA server-side)  
**Principios:** Estándares abiertos (Open Source / OIDC / JWT / PostGIS RLS), evidencia obligatoria verificable, copilotaje con humano en el circuito.

---

## 1. Objetivos de la Iteración 7

1. **Autenticación Institucional Basada en Estándares Abiertos**:
   - Crear un subsistema de autenticación institucional mediante tokens JWT firmados (HS256) con claims estandarizados: `sub` (ID de operador), `username`, `tenantId`, `role` y `authorizedDestinations`.
   - Implementar un mecanismo de inicio de sesión institucional demostrador (`POST /api/auth/login`) y verificación de sesión (`GET /api/auth/me`), compatible con el encabezado estándar `Authorization: Bearer <token>` y con cookies seguras (`SameSite=None; Secure`).
   - Reemplazar completamente la confianza ciega en `X-PID-Tenant`: el servidor deriva el `tenantId` y los permisos territoriales exclusivamente de los claims del token institucional verificado. Si se recibe `X-PID-Tenant`, este solo se admite si coincide exactamente con el claim del token; de lo contrario, se rechaza con `403 Forbidden`.

2. **Auditoría de Propuestas Gestionada Íntegramente por el Servidor (Server-Side Proposal Registry)**:
   - Eliminar el riesgo de manipulación de propuestas en el cliente: cuando el usuario consulta al Agente IA (`POST /api/ai/simulate-prompt`), el servidor no solo genera la propuesta, sino que **la persiste de inmediato en estado `PROPUESTO` en la tabla inmutable `ai_proposals_audit`**, con su huella criptográfica SHA-256 de contexto, citas a fuentes autorizadas y el ID del operador autenticado.
   - La respuesta devuelve la propuesta con su `proposalId` oficial registrado.
   - La posterior decisión humana (`POST /api/ai/audit/decision`) **no acepta el objeto de la propuesta desde el cliente**: recibe únicamente el `proposalId`, la decisión (`APLICADO_SIMULADOR`, `EXPORTADO_ESTUDIO`, `RECHAZADO`, `MODIFICADO_Y_EJECUTADO`), el `decisionRationale` y opcionalmente el escenario o corrida enlazados. El servidor valida la existencia previa de la propuesta en la base de datos, comprueba los claims del operador y registra el evento de decisión sin permitir alteración de los datos originales.

3. **Migración SQL 011: Separación de Eventos de Propuesta y Decisión (Append-Only Puro)**:
   - Añadir tabla `ai_decisions_audit` para registrar cada decisión humana como un evento append-only inmutable enlazado a `ai_proposals_audit(id)`.
   - Reforzar índices y políticas RLS para garantizar que un operador solo audite y decida sobre propuestas de su propio tenant.

4. **Integración en la Interfaz de Usuario**:
   - Actualizar el componente `AiSimulationDrawer.tsx` para que al aplicar o rechazar una propuesta solo envíe el `proposalId` al endpoint seguro de decisión.
   - Incorporar en la cabecera un selector/indicador de sesión institucional activa que muestre el operador, su tenant oficial y sus claims territoriales.

5. **Validación Automatizada**:
   - Crear la suite `scripts/validate_iteration7_institutional_auth.sh` comprobando:
     - Login y emisión de token JWT institucional.
     - Acceso denegado (401) sin token a endpoints protegidos.
     - Acceso denegado (403) a un destino no autorizado en los claims del token.
     - Registro automático de propuesta en servidor con huella SHA-256 y verificación de persistencia.
     - Registro de decisión humana referenciando únicamente el `proposalId` del servidor (rechazo de propuestas arbitrarias inyectadas).
     - Comprobación de que la tabla de auditoría rechaza mutaciones no autorizadas.
