import 'server-only';

import { db as poolDb } from '@nombaone/core-db/pool';
import { createEdgePoolDb } from '@nombaone/core-db/edge-pool';

import type { InfraTxDb } from '@nombaone/sara/context';

/**
 * Interactive-transaction-capable infra DB handle. Use ONLY for console writes
 * that span multiple statements atomically: tenant signup (`signupOrganization`)
 * and the ledger-backed example create (`createExample`). Everything else uses
 * the cheaper `db` in `./db`.
 *
 * Driver by host: production uses the Neon serverless Pool (WebSocket,
 * interactive-tx capable); LOCAL dev/testing uses the pooled pg driver (also
 * interactive-tx capable, and the only one that can speak to a plain Postgres).
 * Both satisfy `InfraTxDb`. Memoised so one pool is opened per server instance.
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
    // Both drivers are interactive-transaction capable and expose the same
    // Drizzle query surface, so both satisfy `InfraTxDb` at runtime. The Neon
    // serverless `Pool` and pg `Pool` have structurally-distinct `$client`
    // types, so the edge-pool handle is narrowed through `unknown` (as the
    // pg `poolDb` is directly assignable). Selection is by URL host only.
    cached = isLocalPostgresUrl(process.env.INFRA_DATABASE_URL)
      ? (poolDb as InfraTxDb)
      : (createEdgePoolDb() as unknown as InfraTxDb);
  }
  return cached;
}
