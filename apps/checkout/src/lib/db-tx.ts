import 'server-only';

import { db as poolDb } from '@nombaone/core-db/pool';
import { createEdgePoolDb } from '@nombaone/core-db/edge-pool';

import type { InfraTxDb } from '@nombaone/sara/context';

/**
 * Interactive-transaction-capable DB handle. Used ONLY for the checkout's lone
 * multi-statement atomic write: confirming + settling the resource via
 * `confirmExampleFromWebhook` (which posts a balanced ledger transaction inside
 * a `BEGIN … COMMIT`). Everything else reads through the cheaper `db` in `./db`.
 *
 * Mirrors apps/console's `db-tx.ts`. Driver by host: production uses the Neon
 * serverless Pool (WebSocket, interactive-tx capable); LOCAL dev/testing uses
 * the pooled pg driver (also interactive-tx capable, and the only one that can
 * speak to a plain Postgres). Both satisfy `InfraTxDb`. Memoised so one pool is
 * opened per server instance.
 */
function isLocalPostgresUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

let cached: InfraTxDb | null = null;

export function txDb(): InfraTxDb {
  if (!cached) {
    cached = isLocalPostgresUrl(process.env.INFRA_DATABASE_URL)
      ? (poolDb as InfraTxDb)
      : // The Neon serverless Pool and node-postgres Pool are interchangeable at
        // RUNTIME (both are interactive-tx-capable drizzle handles), but their
        // generated `$client` driver types don't structurally overlap (Neon's
        // `PoolClient.connect()` vs `@types/pg`'s), so a direct cast is rejected.
        // Assert through `unknown` — the documented escape for two runtime-equal
        // handles whose nominal types diverge — exactly what `InfraTxDb` abstracts.
        (createEdgePoolDb() as unknown as InfraTxDb);
  }
  return cached;
}
