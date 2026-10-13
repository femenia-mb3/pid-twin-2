import { OperatorRole } from './pilotOperations';

/**
 * Claims del token JWT institucional conforme al estándar RFC 7519 / OIDC
 */
export interface InstitutionalJwtClaims {
  sub: string;                   // ID del operador o OpenID
  username: string;              // Nombre de usuario de acceso
  displayName: string;           // Nombre completo y cargo oficial
  email: string;                 // Correo institucional (@malaga.es, @palma.es, @segittur.es)
  tenantId: string;              // Tenant del municipio o entidad (ej. tenant_ayto_malaga)
  tenantName: string;            // Nombre legal del tenant
  role: OperatorRole;            // Rol del operador en la PID
  authorizedDestinations: string[]; // Destinos geográficos sobre los que tiene potestad
  iss: string;                   // Emisor institucional (ej. 'segittur-pid-auth')
  aud: string;                   // Audiencia (ej. 'gemelo-digital-turistico')
  iat: number;                   // Emitido en (timestamp UNIX en segundos)
  exp: number;                   // Expira en (timestamp UNIX en segundos)
  authMethod?: 'OIDC_MANUS' | 'INSTITUTIONAL_KEY' | 'SESSION_COOKIE';
}

/**
 * Petición de login institucional demostrador / API Key
 */
export interface InstitutionalLoginRequest {
  username: string;
  password?: string;
  apiKey?: string;
}

/**
 * Respuesta de login institucional
 */
export interface InstitutionalLoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  claims: InstitutionalJwtClaims;
}

/**
 * Información de usuario devuelta por el servicio de identidad OIDC
 */
export interface OidcUserInfo {
  openId: string;
  name?: string;
  email?: string;
  platforms?: unknown;
}

/**
 * Petición de decisión humana sobre una propuesta generada previamente por el servidor
 */
export interface RecordServerProposalDecisionRequest {
  proposalId: string;
  decision: 'APLICADO_SIMULADOR' | 'EXPORTADO_ESTUDIO' | 'RECHAZADO' | 'MODIFICADO_Y_EJECUTADO';
  decisionRationale?: string;
  linkedScenarioId?: string;
  linkedRunId?: string;
}
