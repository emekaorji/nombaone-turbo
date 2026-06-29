import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

import { schema } from './schema';

/**
 * Neon serverless **Pool** driver — the interactive-transaction-capable sibling
 * of `serverless.ts` (which is the HTTP one-shot driver). Unlike the Neon HTTP
 * client, a `Pool` keeps a WebSocket open and can run `BEGIN … COMMIT`
 * round-trips, so it satisfies Drizzle's `.transaction()` (`InfraTxDb`).
 *
 * Use this in Next.js (apps/console) for the few interactive-tx writes — signup
 * (`registerOwner`), KYB submit (`submitKyb`), invite/accept — and the pg `Pool`
 * elsewhere (apps/api). Reads + single-statement writes should keep using the
 * cheaper HTTP `db` from `@nombaone/core-db/serverless`.
 */

// In a Node runtime there's no global `WebSocket`, so the Neon driver needs one
// supplied. In edge/serverless runtimes that ship a native `WebSocket` this is a
// harmless no-op (we only set it when it's missing).
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const resolveDatabaseUrl = (databaseUrl = process.env.INFRA_DATABASE_URL): string => {
  if (!databaseUrl) {
    throw new Error('INFRA_DATABASE_URL environment variable is required');
  }

  return databaseUrl;
};

export const createEdgePoolDb = (databaseUrl?: string) => {
  const pool = new Pool({ connectionString: resolveDatabaseUrl(databaseUrl) });

  // CRITICAL (mirror pool.ts): an error on an idle pooled client — the hosted DB
  // dropping a connection after sleep, or a network blip — emits on the pool.
  // Without this listener it rethrows as an uncaught exception that crashes the
  // process. Log it; the pool evicts the dead client and the next query reconnects.
  pool.on('error', (error: Error) => {
    console.error(
      '[core-db] idle edge-pool client error (connection dropped; will reconnect):',
      error.message
    );
  });

  return drizzle(pool, { schema });
};

/**
 * Drizzle client over the Neon serverless `Pool`. Interactive-transaction
 * capable — assignable to `InfraTxDb`. Never pass the neon-http `db` where an
 * `InfraTxDb` is required; it can't open an interactive transaction.
 */
export type EdgePoolDatabase = ReturnType<typeof createEdgePoolDb>;
