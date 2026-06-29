import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import { schema } from './schema';

const DEFAULT_POOL_BASE = {
  max: 20,
  idleTimeoutMillis: 30000,
  // Hosted Postgres (Neon) can cold-start from scale-to-zero; give it room.
  connectionTimeoutMillis: 10000,
  // Send TCP keepalives so a connection the DB/network silently dropped is
  // detected + evicted instead of being handed out dead (→ read ETIMEDOUT).
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
} satisfies Partial<PoolConfig>;

const resolveDatabaseUrl = (databaseUrl = process.env.INFRA_DATABASE_URL): string => {
  if (!databaseUrl) {
    throw new Error('INFRA_DATABASE_URL environment variable is required');
  }

  return databaseUrl;
};

/**
 * Local Docker/dev Postgres doesn't speak SSL. Hosted Postgres (Neon,
 * Supabase, Redislabs-alikes, etc.) generally requires it. Decide by host.
 */
const resolveSslOption = (connectionString: string): PoolConfig['ssl'] => {
  try {
    const host = new URL(connectionString).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }
  } catch {
    // Unparseable URL — fall through to the safe default for hosted Postgres.
  }

  return { rejectUnauthorized: false };
};

export interface PoolDatabaseOptions extends PoolConfig {
  databaseUrl?: string;
  connectionString?: string;
}

export const createPool = (options: PoolDatabaseOptions = {}): Pool => {
  const { databaseUrl, connectionString, ssl, ...poolConfiguration } = options;
  const resolvedConnectionString = connectionString || resolveDatabaseUrl(databaseUrl);

  const pool = new Pool({
    ...DEFAULT_POOL_BASE,
    ssl: ssl ?? resolveSslOption(resolvedConnectionString),
    ...poolConfiguration,
    connectionString: resolvedConnectionString,
  });

  // CRITICAL: an error on an *idle* pooled client (e.g. the hosted DB dropping a
  // connection after sleep / a network blip) emits on the pool. Without this
  // listener node-postgres rethrows it as an uncaught exception that crashes the
  // process. Log it; the pool evicts the dead client and the next query reconnects.
  pool.on('error', (error) => {
    console.error('[core-db] idle client error (connection dropped; will reconnect):', error.message);
  });

  return pool;
};

export const createPoolDb = (options: PoolDatabaseOptions = {}) => {
  const pool = createPool(options);
  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
  };
};

export const pool = createPool();

export const db = drizzle(pool, { schema });

export type PoolDatabase = typeof db;

export const checkDatabaseConnection = async (poolInstance: Pool = pool): Promise<void> => {
  const client = await poolInstance.connect();
  client.release();
};
