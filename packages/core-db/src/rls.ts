import { sql } from 'drizzle-orm';

import type { PoolDatabase } from './pool';

/**
 * ── Row-Level Security session context ─────────────────────────────────────
 *
 * Postgres RLS on the mode-scoped tables isolates by the `app.mode` (and
 * optionally `app.org`) GUCs — the policies read `current_setting('app.mode')`
 * and only expose rows for that mode. This helper is the ONE choke point that
 * sets those GUCs for a unit of work: it opens a transaction, `SET LOCAL`s the
 * settings (so they are scoped to — and rolled back with — this transaction, and
 * never leak to the next borrower of a pooled connection), and runs `fn` against
 * the transaction handle.
 *
 * `SET LOCAL` (via `set_config(_, _, true)`) is parameterised, so `mode`/`org`
 * cannot inject SQL. An unset GUC reads as `''` → the policies `NULLIF` it to NULL
 * → **fail-closed** (zero rows), so a query that forgets this wrapper leaks nothing.
 *
 * NOTE on the current runtime: the API connects as the table OWNER, which BYPASSES
 * RLS — so today RLS is armed-but-dormant defence-in-depth beneath the query-layer
 * `WHERE mode = ctx.mode` filters. Production hardening flips the app's DB role to
 * a NON-owner (e.g. `nombaone_rls`) and routes mode-scoped work through here; at
 * that point RLS becomes the enforced boundary with no code changes to the domain.
 */
export interface ModeContext {
  mode: string;
  organizationId?: string | null;
}

export async function runWithModeContext<T>(
  db: PoolDatabase,
  ctx: ModeContext,
  fn: (tx: Parameters<Parameters<PoolDatabase['transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(name, value, is_local=true) === SET LOCAL — transaction-scoped,
    // reset on commit/rollback. Empty org is fine: the org policy (where present)
    // treats an empty GUC as "no tenant filter" for cross-tenant sweeps.
    await tx.execute(
      sql`SELECT set_config('app.mode', ${ctx.mode}, true), set_config('app.org', ${ctx.organizationId ?? ''}, true)`
    );
    return fn(tx);
  });
}
