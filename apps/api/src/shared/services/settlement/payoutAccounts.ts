import { and, desc, eq } from 'drizzle-orm';

import { orgPayoutAccountsTable, type PayoutAccountRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { NOMBA_ENDPOINTS, type NombaClient } from '@nombaone/sara/nomba';
import { mintReference } from '@nombaone/sara/reference';

import type { DomainContext, InfraReadScope, InfraTxDb } from '@nombaone/sara/context';

export interface Bank {
  code: string;
  name: string;
}

/**
 * The NIBSS bank list, straight from Nomba. The console renders this as a dropdown so a
 * merchant PICKS their bank instead of hand-typing a 6-digit NIBSS code — the previous
 * withdraw form had a raw text input with the placeholder `000013`, which is not a thing
 * any human knows about their own bank.
 */
export async function listBanks(client: NombaClient): Promise<Bank[]> {
  const res = await client.request<{ data?: Array<{ code?: string; name?: string }> }>({
    method: 'GET',
    endpoint: NOMBA_ENDPOINTS.banks,
  });
  if (!res.ok) {
    throw AppError.ServiceUnavailable(
      'could not load the bank list',
      undefined,
      NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED
    );
  }
  const banks = Array.isArray(res.data?.data) ? res.data.data : [];
  return banks
    .filter((b): b is { code: string; name: string } => Boolean(b?.code && b?.name))
    .map((b) => ({ code: b.code, name: b.name }));
}

/**
 * NAME ENQUIRY — ask the bank who actually owns this account number.
 *
 * ⚠ POST with a body. As a GET this endpoint answers 500 (live-probed), which is how
 * every payout used to fail before it even reached the transfer.
 *
 * The returned name is the ONLY name we ever trust. We do not let a merchant tell us
 * whose account it is.
 */
export async function resolveAccountName(
  client: NombaClient,
  input: { bankCode: string; accountNumber: string }
): Promise<string> {
  const res = await client.request<{ data?: { accountName?: string } }>({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.bankLookup,
    body: { bankCode: input.bankCode, accountNumber: input.accountNumber },
  });

  const accountName = String(res.data?.data?.accountName ?? '').trim();
  if (!res.ok || !accountName) {
    // Nomba answers a genuinely unknown NUBAN with 404 "Account not found" — that is a
    // merchant typo, not an outage, so it must read as a validation error they can fix.
    throw AppError.UnprocessableEntity(
      'that account number could not be found at the selected bank',
      { bankCode: input.bankCode },
      NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED
    );
  }
  return accountName;
}

/**
 * Register (or re-confirm) the bank account a merchant's money is paid out to.
 *
 * The merchant supplies ONLY a bank + an account number. The holder's name comes from
 * the bank, never from them — so the console can show "We found: ADEBAYO STORES LTD —
 * is this you?" and the stored destination is bank-confirmed by construction.
 *
 * Idempotent on (org, mode, bank, accountNumber): re-adding the same account refreshes
 * the verification instead of erroring.
 */
export async function addPayoutAccount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  client: NombaClient,
  input: { bankCode: string; bankName: string; accountNumber: string }
): Promise<PayoutAccountRow> {
  const accountName = await resolveAccountName(client, input);

  return txDb.transaction(async (tx) => {
    // One default per (org, mode) is a UNIQUE index — demote the incumbent first, or
    // the insert below would collide.
    await tx
      .update(orgPayoutAccountsTable)
      .set({ isDefault: false })
      .where(
        and(
          eq(orgPayoutAccountsTable.organizationId, ctx.organizationId),
          eq(orgPayoutAccountsTable.mode, ctx.mode),
          eq(orgPayoutAccountsTable.isDefault, true)
        )
      );

    const [row] = await tx
      .insert(orgPayoutAccountsTable)
      .values({
        reference: mintReference('PAC'),
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        accountName,
        status: 'active',
        isDefault: true,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          orgPayoutAccountsTable.organizationId,
          orgPayoutAccountsTable.mode,
          orgPayoutAccountsTable.bankCode,
          orgPayoutAccountsTable.accountNumber,
        ],
        set: {
          accountName, // re-confirm the name — the account may have been renamed
          bankName: input.bankName,
          status: 'active',
          isDefault: true,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return row!;
  });
}

/** The destination a payout goes to, or `null` if the merchant hasn't added one yet. */
export async function findDefaultPayoutAccount(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<PayoutAccountRow | null> {
  const [row] = await db
    .select()
    .from(orgPayoutAccountsTable)
    .where(
      and(
        eq(orgPayoutAccountsTable.organizationId, ctx.organizationId),
        eq(orgPayoutAccountsTable.mode, ctx.mode),
        eq(orgPayoutAccountsTable.isDefault, true),
        eq(orgPayoutAccountsTable.status, 'active')
      )
    )
    .orderBy(desc(orgPayoutAccountsTable.verifiedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Like {@link findDefaultPayoutAccount} but throws — used by the payout path, where a
 * missing destination must stop the withdrawal rather than guess one.
 *
 * This is deliberately the FIRST moment a merchant is asked for a bank account. Not at
 * signup: a bank account is meaningless until there is money to send to it.
 */
export async function requirePayoutAccount(
  db: InfraReadScope,
  ctx: DomainContext
): Promise<PayoutAccountRow> {
  const account = await findDefaultPayoutAccount(db, ctx);
  if (!account) {
    throw AppError.UnprocessableEntity(
      'add the bank account you want to be paid into before withdrawing',
      { organizationId: ctx.organizationId },
      NOMBAONE_ERROR_CODES.PAYOUT_ACCOUNT_MISSING
    );
  }
  return account;
}
