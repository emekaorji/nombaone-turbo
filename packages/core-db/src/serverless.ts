import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { schema } from './schema';

const resolveDatabaseUrl = (databaseUrl = process.env.INFRA_DATABASE_URL): string => {
  if (!databaseUrl) {
    throw new Error('INFRA_DATABASE_URL environment variable is required');
  }

  return databaseUrl;
};

export const createServerlessSql = (databaseUrl?: string) => neon(resolveDatabaseUrl(databaseUrl));

export const createServerlessDb = (databaseUrl?: string) =>
  drizzle(createServerlessSql(databaseUrl), { schema });

/**
 * Shared Neon HTTP client for serverless and edge runtimes.
 * Import from `@nombaone/core-db/serverless` in Next.js and other non-pooled runtimes.
 */
export const sql = createServerlessSql();

/**
 * Shared Drizzle database client for serverless and edge runtimes.
 * Import from `@nombaone/core-db/serverless` in Next.js and other non-pooled runtimes.
 */
export const db = createServerlessDb();

export type ServerlessDatabase = typeof db;
