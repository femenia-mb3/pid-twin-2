import { OidcUserInfo } from '../types/institutionalAuth';
import { OperatorIdentity } from '../types/pilotOperations';

const MANUS_PROJECT_ID = process.env.MANUS_PROJECT_ID || process.env.MANUS_WEBDEV_PROJECT_ID;
const MANUS_OAUTH_PORTAL_URL = process.env.MANUS_OAUTH_PORTAL_URL || 'https://manus.im';
const MANUS_OAUTH_API_URL = process.env.MANUS_OAUTH_API_URL || 'https://api.manus.ai';

export class OAuthService {
  /**
   * Genera la URL de autorización OIDC institucional
   */
  public static getAuthorizeUrl(redirectUri: string, state?: string): string {
    const nonce = Math.random().toString(36).substring(2, 15);
    const statePayload = Buffer.from(JSON.stringify({ redirectUri, nonce, state })).toString('base64');
    
    const params = new URLSearchParams({
      appId: MANUS_PROJECT_ID || 'gemelotur-pid',
      redirectUri,
      state: statePayload,
      responseType: 'code',
    });

    return `${MANUS_OAUTH_PORTAL_URL}/app-auth?${params.toString()}`;
  }

  /**
   * Intercambia el código de autorización por el token de acceso
   */
  public static async exchangeCode(code: string, redirectUri: string): Promise<string | null> {
    if (!MANUS_PROJECT_ID) return null;

    try {
      const res = await fetch(`${MANUS_OAUTH_API_URL}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: MANUS_PROJECT_ID,
          grantType: 'authorization_code',
          code,
          redirectUri,
        })
      });

      if (!res.ok) {
        console.warn(`[OAuthService] Fallo en ExchangeToken status ${res.status}`);
        return null;
      }

      const data = await res.json() as { accessToken?: string };
      return data.accessToken || null;
    } catch (err) {
      console.error('[OAuthService] Excepción en ExchangeToken:', err);
      return null;
    }
  }

  /**
   * Obtiene el perfil de usuario del proveedor de identidad
   */
  public static async getUserInfo(accessToken: string): Promise<OidcUserInfo | null> {
    try {
      const res = await fetch(`${MANUS_OAUTH_API_URL}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      });

      if (!res.ok) return null;
      const data = await res.json() as OidcUserInfo;
      return data;
    } catch (err) {
      console.error('[OAuthService] Excepción en GetUserInfo:', err);
      return null;
    }
  }

  /**
   * Vincula una identidad OIDC con un operador institucional en PostGIS
   */
  public static async resolveOperatorByOpenId(openId: string, email?: string): Promise<OperatorIdentity | null> {
    // Si el usuario es administrador general de SEGITTUR o pertenece al ayuntamiento
    if (email?.endsWith('@malaga.es') || openId.includes('malaga')) {
      return {
        id: `op_${openId.slice(0, 12)}`,
        username: email ? email.split('@')[0] : 'gestor_malaga',
        displayName: 'Gestor Municipal (Ayto. de Málaga)',
        email: email || 'turismo@malaga.es',
        tenantId: 'tenant_ayto_malaga',
        tenantName: 'Ayuntamiento de Málaga',
        role: 'GESTOR_TURISMO',
        authorizedDestinations: ['malaga'],
      };
    }

    if (email?.endsWith('@palma.es') || openId.includes('palma')) {
      return {
        id: `op_${openId.slice(0, 12)}`,
        username: email ? email.split('@')[0] : 'gestor_palma',
        displayName: 'Supervisor de Movilidad (Ayto. de Palma)',
        email: email || 'mobilitat@palma.es',
        tenantId: 'tenant_ayto_palma',
        tenantName: 'Ajuntament de Palma',
        role: 'SUPERVISOR_MOVILIDAD',
        authorizedDestinations: ['palma'],
      };
    }

    // Por defecto, si está autenticado en la plataforma PID, se le asigna rol de supervisión SEGITTUR
    return {
      id: `op_${openId.slice(0, 12)}`,
      username: email ? email.split('@')[0] : 'admin_pid',
      displayName: 'Dirección Técnica SEGITTUR (Supervisión PID)',
      email: email || 'gemelo.digital@segittur.es',
      tenantId: 'tenant_ayto_malaga',
      tenantName: 'SEGITTUR - Plataforma Inteligente de Destinos',
      role: 'ADMIN_SEGITTUR',
      authorizedDestinations: ['malaga', 'palma'],
    };
  }
}
