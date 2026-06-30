import { ensureAccount, type LedgerAccountKind } from '../ledger/accounts';

import type { DomainContext, InfraTxScope } from '../context';

/**
 * ── Well-known system accounts paradigm ──
 *
 * Every tenant needs a small set of named ledger accounts to post against before
 * any product-specific account exists — somewhere to hold collected cash and
 * somewhere to recognize platform revenue. These are addressed by stable `key`
 * strings and provisioned idempotently at signup (and re-runnable any time).
 *
 * This is deliberately MINIMAL and generic: the boilerplate ships only the two
 * universally-needed accounts. Add your product's well-known accounts (e.g. a
 * settlement-payable account, an FX-suspense account) to this list — every entry
 * is created via `ledger.ensureAccount`, so adding one is a one-line change and
 * stays idempotent.
 */
export interface SystemAccountSpec {
  key: string;
  kind: LedgerAccountKind;
}

export const SYSTEM_ACCOUNTS: readonly SystemAccountSpec[] = [
  // Funds collected from payers and held by the platform on the tenant's behalf.
  { key: 'cash', kind: 'asset' },
  // Where platform fees / earned revenue are recognized.
  { key: 'platform_revenue', kind: 'revenue' },
];

/**
 * Ensure every well-known account exists for the caller's (org, environment).
 * Idempotent and safe to call repeatedly. Must run inside the caller's
 * interactive transaction — at signup this shares the same tx that creates the
 * organization and owner.
 */
export async function ensureSystemAccounts(
  txDb: InfraTxScope,
  ctx: DomainContext
): Promise<void> {
  for (const spec of SYSTEM_ACCOUNTS) {
    await ensureAccount(txDb, ctx, spec);
  }
}
