import crypto from 'node:crypto';
import { InstitutionalJwtClaims } from '../types/institutionalAuth';
import { OperatorIdentity } from '../types/pilotOperations';

// Secreto de firma institucional: utiliza MANUS_JWT_SECRET si está presente o clave de entorno.
const JWT_SECRET = process.env.MANUS_JWT_SECRET || process.env.JWT_SECRET || 'segittur_pid_gemelotur_jwt_secret_2026_open_source';
const EXPECTED_ISSUER = 'segittur-pid-auth';
const EXPECTED_AUDIENCE = 'gemelo-digital-turistico';
const TOKEN_TTL_SECONDS = 86400; // 24 horas

export class JwtAuthService {
  private static base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  /**
   * Genera un token JWT institucional firmado con HMAC-SHA256 con claims estructurados
   */
  public static signToken(
    operator: OperatorIdentity, 
    authMethod: 'OIDC_MANUS' | 'INSTITUTIONAL_KEY' | 'SESSION_COOKIE' = 'INSTITUTIONAL_KEY'
  ): { token: string; claims: InstitutionalJwtClaims; expiresIn: number } {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + TOKEN_TTL_SECONDS;

    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const claims: InstitutionalJwtClaims = {
      sub: operator.id,
      username: operator.username,
      displayName: operator.displayName,
      email: operator.email,
      tenantId: operator.tenantId,
      tenantName: operator.tenantName,
      role: operator.role,
      authorizedDestinations: operator.authorizedDestinations,
      iss: EXPECTED_ISSUER,
      aud: EXPECTED_AUDIENCE,
      iat: now,
      exp,
      authMethod,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(claims));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${signatureInput}.${signature}`;
    return { token, claims, expiresIn: TOKEN_TTL_SECONDS };
  }

  /**
   * Verifica la firma y estructura estricta de claims conforme al estándar RFC 7519
   */
  public static verifyToken(token: string): InstitutionalJwtClaims | null {
    if (!token || typeof token !== 'string') return null;

    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, receivedSignature] = parts;

    try {
      // 1. Validar cabecera (algoritmo y tipo)
      const headerJson = JSON.parse(this.base64UrlDecode(encodedHeader));
      if (headerJson.alg !== 'HS256' || headerJson.typ !== 'JWT') {
        return null;
      }

      // 2. Validar firma criptográfica con timingSafeEqual
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(signatureInput)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      if (!crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
        return null;
      }

      // 3. Parsear y validar claims obligatorios
      const claims = JSON.parse(this.base64UrlDecode(encodedPayload)) as InstitutionalJwtClaims;
      const now = Math.floor(Date.now() / 1000);

      // Expiración obligatoria
      if (!claims.exp || claims.exp <= now) {
        return null;
      }

      // Emisor y audiencia obligatorios
      if (claims.iss !== EXPECTED_ISSUER || claims.aud !== EXPECTED_AUDIENCE) {
        return null;
      }

      // Validar presencia de tenant, rol y destinos
      if (!claims.tenantId || !claims.role || !Array.isArray(claims.authorizedDestinations)) {
        return null;
      }

      return claims;
    } catch (err) {
      return null;
    }
  }

  /**
   * Extrae el token del encabezado Authorization o de las cookies seguras de sesión
   */
  public static extractTokenFromRequest(req: { headers: Record<string, string | string[] | undefined> }): string | null {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    const cookieHeader = req.headers['cookie'];
    if (typeof cookieHeader === 'string') {
      // Priorizar cookie oficial de la plataforma webdev_app_session
      const matchOfficial = cookieHeader.match(/webdev_app_session=([^;]+)/);
      if (matchOfficial) return decodeURIComponent(matchOfficial[1]);

      const matchLegacy = cookieHeader.match(/institutional_session=([^;]+)/);
      if (matchLegacy) return decodeURIComponent(matchLegacy[1]);
    }

    return null;
  }
}
