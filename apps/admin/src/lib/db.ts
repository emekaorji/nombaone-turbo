import 'server-only';

import { createPoolDb, type PoolDatabase } from '@nombaone/core-db/pool';
import { createServerlessDb, type ServerlessDatabase } from '@nombaone/core-db/serverless';

/**
 * PARADIGM — TWO DB HANDLES PER APP (admin/operator panel edition).
 *
 * The admin panel talks to the SINGLE platform database via `INFRA_DATABASE_URL`
 * (one DB; operator auth reads `operators`, screens read `organizations` /
 * `examples` / the ledger / `admin_audit_log`). As elsewhere in the stack we keep
 * two handles, chosen by what a code path needs:
 *
 *   • `db` (read handle)  — used by RSC reads and single-statement writes such as
 *     `recordAudit`. In production this is the Neon HTTP driver (`@nombaone/core-db
 *     /serverless`), which is the right fit for a serverless Next.js runtime; for
 *     a LOCAL Postgres (`localhost`) the HTTP driver cannot be used, so we
 *     transparently fall back to the pooled `pg` driver.
 *
 *   • `dbTx` (interactive-tx handle) — used ONLY when a mutation needs an atomic
 *     multi-statement transaction. It is always the pooled `pg` driver because
 *     the HTTP driver cannot run an interactive `transaction()`.
 *
 * Both handles are MEMOIZED module-level singletons so a hot route does not open
 * a fresh pool per request. The operator panel never trusts a client-supplied
 * scope; every read re-filters server-side (see `src/lib/rbac.ts`).
 */

const INFRA_DATABASE_URL = process.env.INFRA_DATABASE_URL;

/** True when the configured DB is a local Postgres (no Neon HTTP edge). */
function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/** Lazily-built read handle. */
let readDb: PoolDatabase | ServerlessDatabase | undefined;

/**
 * The read / single-statement-write handle. Neon HTTP in production, pooled `pg`
 * against a local Postgres. Satisfies every domain reader's `InfraDb`.
 */
export function getDb(): PoolDatabase | ServerlessDatabase {
  if (readDb) return readDb;
  if (isLocalDatabase(INFRA_DATABASE_URL)) {
    readDb = createPoolDb({ databaseUrl: INFRA_DATABASE_URL }).db;
  } else {
    readDb = createServerlessDb(INFRA_DATABASE_URL);
  }
  return readDb;
}

/** Lazily-built interactive-transaction handle (always pooled). */
let txDb: PoolDatabase | undefined;

/**
 * The interactive-transaction handle. Required for atomic multi-statement
 * writes. Always the pooled `pg` driver (`InfraTxDb`).
 */
export function getDbTx(): PoolDatabase {
  if (txDb) return txDb;
  txDb = createPoolDb({ databaseUrl: INFRA_DATABASE_URL }).db;
  return txDb;
}
