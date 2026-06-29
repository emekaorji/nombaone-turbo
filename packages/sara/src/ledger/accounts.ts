import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { ledgerAccountsTable, type LedgerAccountRow } from '@nombaone/core-db/schema';
import { and, eq } from 'drizzle-orm';

import type { DomainContext, InfraTxScope } from '../context';
import { CURRENCY } from '../money';
import { mintReference } from '../reference';

export type LedgerAccountKind = 'asset' | 'liability' | 'revenue' | 'expense' | 'system';

export interface EnsureAccountParams {
  /** Well-known account name, unique per (org, environment). */
  key: string;
  kind: LedgerAccountKind;
}

/**
 * ── Get-or-create for well-known accounts ──
 *
 * System and well-known accounts (`cash`, `platform_revenue`, …) are addressed
 * by a stable string `key` that is unique per (org, environment) — enforced by a
 * partial unique index. `ensureAccount` is the idempotent gateway: it returns the
 * existing row if present, otherwise mints one. Callers may invoke it freely
 * (e.g. at signup, or lazily before a posting) without guarding for prior
 * existence.
 *
 * Idempotency under concurrency: two racing callers can both miss the SELECT and
 * both attempt the INSERT; the unique index lets exactly one win and rejects the
 * other, after which we re-read and return the winner's row. This must run inside
 * the caller's interactive transaction (`InfraTxDb`).
 */
export async function ensureAccount(
  txDb: InfraTxScope,
  ctx: DomainContext,
  params: EnsureAccountParams
): Promise<LedgerAccountRow> {
  const existing = await findByKey(txDb, ctx, params.key);
  if (existing) return existing;

  try {
    const [created] = await txDb
      .insert(ledgerAccountsTable)
      .values({
        reference: mintReference('LAC'),
        organizationId: ctx.organizationId,
        environment: ctx.environment,
        kind: params.kind,
        key: params.key,
        currency: CURRENCY,
        balance: 0,
      })
      .returning();

    if (created) return created;
  } catch {
    // Lost the insert race against a concurrent ensureAccount — fall through and
    // return the row the winner wrote.
  }

  const settled = await findByKey(txDb, ctx, params.key);
  if (settled) return settled;

  throw AppError.InternalServerError(
    'failed to ensure ledger account',
    { key: params.key },
    NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
  );
}

const findByKey = async (
  db: InfraTxScope,
  ctx: DomainContext,
  key: string
): Promise<LedgerAccountRow | undefined> => {
  const [row] = await db
    .select()
    .from(ledgerAccountsTable)
    .where(
      and(
        eq(ledgerAccountsTable.organizationId, ctx.organizationId),
        eq(ledgerAccountsTable.environment, ctx.environment),
        eq(ledgerAccountsTable.key, key)
      )
    )
    .limit(1);

  return row;
};
