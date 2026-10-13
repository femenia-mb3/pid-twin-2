import pg from 'pg';

const { Pool } = pg;

export interface PostGISConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface PersistenceHealth {
  driver: 'postgis' | 'memory';
  connected: boolean;
  database: string | null;
  serverVersion: string | null;
  postgisVersion: string | null;
  rlsEnabled: boolean;
  counts: {
    destinos: number;
    contextPackages: number;
    escenarios: number;
    simulationRuns: number;
    zonas: number;
  };
  error?: string;
}

class PostGISConnectionManager {
  private pool: pg.Pool | null = null;
  private isConfigured = false;
  private lastHealthCheck: PersistenceHealth = {
    driver: 'memory',
    connected: false,
    database: null,
    serverVersion: null,
    postgisVersion: null,
    rlsEnabled: false,
    counts: { destinos: 0, contextPackages: 0, escenarios: 0, simulationRuns: 0, zonas: 0 },
  };

  constructor() {
    this.initPool();
  }

  private initPool() {
    const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const host = process.env.PGHOST || '127.0.0.1';
    const port = Number(process.env.PGPORT || 5432);
    const user = process.env.PGUSER || 'gemelotur_app';
    const password = process.env.PGPASSWORD || 'gemelotur_app_pwd';
    const database = process.env.PGDATABASE || 'gemelotur';

    try {
      if (connStr) {
        this.pool = new Pool({
          connectionString: connStr,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 3000,
        });
        this.isConfigured = true;
      } else if (host && user && database) {
        this.pool = new Pool({
          host,
          port,
          user,
          password,
          database,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 3000,
        });
        this.isConfigured = true;
      }
    } catch (err) {
      console.warn('[PostGIS] No se pudo inicializar el pool de conexiones:', err);
      this.pool = null;
      this.isConfigured = false;
    }
  }

  public getPool(): pg.Pool | null {
    return this.pool;
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.pool !== null;
  }

  /**
   * Ejecuta una consulta o conjunto de operaciones dentro de un contexto de sesión RLS
   * fijando app.tenant_id y app.destino_id de forma local a la transacción.
   */
  public async withTenantContext<T>(
    tenantId: string,
    destinoId: string,
    fn: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('PostGIS no está disponible en este entorno');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Fijamos las variables locales de sesión para que actúen las directivas ROW LEVEL SECURITY
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query("SELECT set_config('app.destino_id', $1, true)", [destinoId]);

      const result = await fn(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ejecuta una transacción administrativa o de solo lectura que no requiere RLS
   */
  public async withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('PostGIS no está disponible');
    }
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  /**
   * Chequeo de salud y diagnóstico de conectividad PostGIS
   */
  public async checkHealth(): Promise<PersistenceHealth> {
    if (!this.pool) {
      this.lastHealthCheck = {
        driver: 'memory',
        connected: false,
        database: null,
        serverVersion: null,
        postgisVersion: null,
        rlsEnabled: false,
        counts: { destinos: 0, contextPackages: 0, escenarios: 0, simulationRuns: 0, zonas: 0 },
      };
      return this.lastHealthCheck;
    }

    try {
      const client = await this.pool.connect();
      try {
        const verRes = await client.query('SELECT version() AS pg_ver, postgis_version() AS postgis_ver, current_database() AS db_name');
        const metricsRes = await client.query('SELECT fn_gemelotur_persistence_health() AS metrics');
        const metrics = metricsRes.rows[0]?.metrics || {};

        this.lastHealthCheck = {
          driver: 'postgis',
          connected: true,
          database: verRes.rows[0]?.db_name || null,
          serverVersion: verRes.rows[0]?.pg_ver ? verRes.rows[0].pg_ver.split(' ')[1] : null,
          postgisVersion: verRes.rows[0]?.postgis_ver || null,
          rlsEnabled: metrics.rlsEnabled === true,
          counts: {
            destinos: Number(metrics.destinos || 0),
            contextPackages: Number(metrics.contextPackages || 0),
            escenarios: Number(metrics.escenarios || 0),
            simulationRuns: Number(metrics.simulationRuns || 0),
            zonas: Number(metrics.zonas || 0),
          },
        };
        return this.lastHealthCheck;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastHealthCheck = {
        driver: 'memory',
        connected: false,
        database: null,
        serverVersion: null,
        postgisVersion: null,
        rlsEnabled: false,
        counts: { destinos: 0, contextPackages: 0, escenarios: 0, simulationRuns: 0, zonas: 0 },
        error: msg,
      };
      return this.lastHealthCheck;
    }
  }
}

export const postgisClient = new PostGISConnectionManager();
