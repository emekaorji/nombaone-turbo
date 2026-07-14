import { and, eq, sql } from 'drizzle-orm';

import { ledgerAccountsTable, ledgerEntriesTable, organizationsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

/**
 * SETTLEMENT IDENTITY — the key that says whose naira a naira is.
 *
 * Money collects into ONE platform Nomba account. It has to: Nomba will not mint a
 * sub-account for a merchant (create 500s on every body shape, list 403s — live-probed
 * 2026-07-13), a virtual account holds no balance and is owned by our parent, and
 * `splitRequest` routes to sub-account ids we cannot obtain. There is no fourth door.
 *
 * So a merchant's money is not a Nomba object at all — it is a balance in OUR
 * double-entry ledger, and `accountRef` is simply the STRING KEY that names it:
 * `tenant_settlement:{accountRef}` (a liability: what we owe them),
 * `settlements.sub_account_ref`, `payouts.sub_account_ref`.
 *
 * That key used to be read out of `org_nomba_accounts` — a row that existed only if a
 * merchant had pasted a Nomba sub-account id into our console. Which meant settlement
 * silently depended on an onboarding step no merchant could actually complete, and a
 * tenant with no row could not be paid at all. It is now DERIVED from the organization,
 * so every merchant has a settlement identity from the instant they sign up: no
 * provisioning, no Nomba round-trip, no way to be half-onboarded.
 *
 * ⚠ The ref must stay stable for the life of the org — it IS the ledger account key.
 * `organizations.reference` is immutable, which is the whole reason it is the input.
 * Never re-derive this from mutable data (a name, a slug): the balance would silently
 * move to a new ledger account and strand the merchant's funds in the old one.
 */
export const tenantAccountRef = (organizationReference: string): string =>
  `NBO-${organizationReference}`;

/** The ledger account key holding a tenant's settled balance. */
export const tenantSettlementAccountKey = (accountRef: string): string =>
  `tenant_settlement:${accountRef}`;

/**
 * The tenant's settlement identity. Derived, never provisioned — so for a real
 * organization this cannot fail, and settlement can never be blocked behind an
 * un-done setup step.
 */
export async function resolveTenantAccountRef(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<string> {
  const [org] = await db
    .select({ reference: organizationsTable.reference })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, ctx.organizationId))
    .limit(1);

  if (!org) {
    throw AppError.UnprocessableEntity(
      'organization not found; cannot settle',
      { organizationId: ctx.organizationId },
      NOMBAONE_ERROR_CODES.CLIENT_RESOURCE_NOT_FOUND
    );
  }
  return tenantAccountRef(org.reference);
}

/**
 * The tenant's settled balance — read O(1) from the materialized
 * `tenant_settlement:{accountRef}` ledger account (a liability CREDITED at settlement,
 * so its `balance` is POSITIVE = the funds we owe them). Zero before the first
 * settlement lands.
 *
 * This is the number the merchant sees as "your balance".
 *
 * ⚠ It is a CACHE. `balance` is a materialized counter maintained by `postTransaction`;
 * the authoritative truth is the sum of the append-only `ledger_entries`. They should
 * never disagree — but "should never" is not a guarantee you pay real money against.
 * Before any payout, {@link assertBalanceMatchesLedger} recomputes it from the entries.
 */
export async function getTenantSettlementBalance(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<number> {
  const accountRef = await resolveTenantAccountRef(db, ctx);
  const [account] = await db
    .select({ balance: ledgerAccountsTable.balance })
    .from(ledgerAccountsTable)
    .where(
      and(
        eq(ledgerAccountsTable.organizationId, ctx.organizationId),
        eq(ledgerAccountsTable.mode, ctx.mode),
        eq(ledgerAccountsTable.key, tenantSettlementAccountKey(accountRef))
      )
    )
    .limit(1);
  return account?.balance ?? 0;
}

/**
 * 🔒 THE PRE-PAYOUT PROOF: does the merchant genuinely have the money we are about to
 * send them?
 *
 * We do not take the materialized `ledger_accounts.balance` counter's word for it. We
 * recompute the balance from the APPEND-ONLY `ledger_entries` — `Σcredits − Σdebits`
 * over every leg ever posted to this account — and refuse to pay unless the two agree
 * to the kobo.
 *
 * Why this exists: a payout is the one irreversible act in the system. Every other bug
 * in this codebase has been recoverable because the money was still in the account. If
 * the counter has drifted above the entries (a bad migration, a hand-edited row, a
 * partially-applied write), paying against it means sending real naira the merchant never
 * earned — and it comes out of the pooled account, so it is *another merchant's money*.
 *
 * Called INSIDE the payout's `FOR UPDATE` lock, so no concurrent posting can move the
 * account between the check and the debit.
 */
export async function assertBalanceMatchesLedger(
  db: InfraReadScope,
  ctx: DomainContext,
  ledgerAccountId: string,
  materializedBalance: number
): Promise<void> {
  const [summed] = await db
    .select({
      // The ledger's sign convention: a credit adds, a debit subtracts (`balanceDelta`).
      balance: sql<number>`coalesce(sum(
        case when ${ledgerEntriesTable.direction} = 'credit'
             then ${ledgerEntriesTable.amount}
             else -${ledgerEntriesTable.amount}
        end
      ), 0)`,
    })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.accountId, ledgerAccountId));

  const fromEntries = Number(summed?.balance ?? 0);

  if (fromEntries !== materializedBalance) {
    throw AppError.UnprocessableEntity(
      'payout blocked: the account balance does not match the ledger',
      {
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        materializedBalance,
        balanceFromLedgerEntries: fromEntries,
        driftKobo: materializedBalance - fromEntries,
      },
      NOMBAONE_ERROR_CODES.SETTLEMENT_RECONCILE_DRIFT
    );
  }
}
