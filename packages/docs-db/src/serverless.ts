import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

import { schema } from './schema';

const resolveDatabaseUrl = (databaseUrl = process.env.DOCS_DATABASE_URL): string => {
  if (!databaseUrl) {
    throw new Error('DOCS_DATABASE_URL environment variable is required');
  }

  return databaseUrl;
};

/** Build a fresh Neon HTTP Drizzle client (optionally against an explicit URL). */
export const createServerlessDb = (databaseUrl?: string): NeonHttpDatabase<typeof schema> =>
  drizzle(neon(resolveDatabaseUrl(databaseUrl)), { schema });

export type ServerlessDatabase = NeonHttpDatabase<typeof schema>;

let cached: ServerlessDatabase | null = null;

/**
 * The shared docs Drizzle client, created LAZILY on first use (not at module
 * load) so importers and `next build` never require `DOCS_DATABASE_URL` to be
 * set: the env var is a runtime concern, needed only when a row is written.
 * Import from `@nombaone/docs-db/serverless` in Next.js route handlers.
 */
export const getDb = (): ServerlessDatabase => (cached ??= createServerlessDb()); // ? @claude i commented this out innitially because it was not resolving the db for some reasons and read and writes just never worked. due to my hard assignment below, the implementation is not lazy anymore, so once you catch this, fix it, cause i still need it to be lazy (i.e., a docs deployment should not require the DB URL to be set at build time).
// export const db = createServerlessDb();
