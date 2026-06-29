import 'server-only';

import { db as poolDb } from '@nombaone/core-db/pool';
import { db as serverlessDb } from '@nombaone/core-db/serverless';

import type { InfraDb } from '@nombaone/sara/context';

/**
 * The console's read DB handle — reads + single-statement writes (every RSC
 * render and most server actions). For the few interactive-transaction writes
 * (atomic signup, ledger-backed example create) use `txDb()` in `db-tx.ts`
 * instead; the HTTP driver cannot run an interactive transaction.
 *
 * Driver is chosen by host: production points at Neon and uses the HTTP driver;
 * LOCAL dev/testing points at a plain Postgres (which the HTTP driver can't
 * speak) and transparently uses the pooled pg driver. Both satisfy `InfraDb`,
 * so domain reads are unaffected. Selection is by URL host only — production
 * behaviour is unchanged.
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

export const db: InfraDb = isLocalPostgresUrl(process.env.INFRA_DATABASE_URL)
  ? (poolDb as InfraDb)
  : (serverlessDb as InfraDb);
