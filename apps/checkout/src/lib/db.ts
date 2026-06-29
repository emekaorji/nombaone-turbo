import 'server-only';

import { db as poolDb } from '@nombaone/core-db/pool';
import { db as serverlessDb } from '@nombaone/core-db/serverless';

import type { InfraDb } from '@nombaone/sara/context';

/**
 * The checkout's read DB handle — reads only (the public page renders a payment;
 * the lone write, settling a payment, goes through the interactive-tx handle in
 * `./db-tx`). Mirrors apps/console's `db.ts`: production points at Neon and uses
 * the HTTP driver; LOCAL dev/testing points at a plain Postgres and uses the
 * pooled pg driver instead (the HTTP driver can't speak to it). Both satisfy
 * `InfraDb`, so domain reads are unaffected. Selection is by URL host only.
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
