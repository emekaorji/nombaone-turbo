import { and, eq } from 'drizzle-orm';

import { creditGrantsTable, customersTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { ensureAccount, postTransaction } from '../ledger';
import { mintReference } from '../reference';
import { serializeCreditGrant } from './serialize';
import { customerCreditAccountKey } from './types';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreditGrantResponseData, GrantCreditInput } from './types';

/**
 * Grant a customer credit (J5). Posts a balanced `adjustment` (debit
 * platform_revenue, credit the customer's `customer_credit` liability account) so
 * the balance is materialized in the LEDGER (read O(1)), and writes the
 * `credit_grants` audit/ordering row (`remaining = amount`).
 */
export async function grantCredit(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: GrantCreditInput
): Promise<CreditGrantResponseData> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw AppError.UnprocessableEntity(
      'credit amount must be a positive integer (kobo)',
      { amount: input.amount },
      NOMBAONE_ERROR_CODES.CREDIT_INVALID_AMOUNT
    );
  }

  const [customer] = await txDb
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.reference, input.customerRef)
      )
    )
    .limit(1);
  if (!customer) {
    throw AppError.NotFound(
      'customer not found',
      { reference: input.customerRef },
      NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
    );
  }

  const creditAccount = await ensureAccount(txDb, ctx, {
    key: customerCreditAccountKey(input.customerRef),
    kind: 'liability',
  });
  const revenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });
  const posted = await postTransaction(txDb, ctx, {
    kind: 'adjustment',
    memo: `grant credit ${input.customerRef}`,
    entries: [
      { accountId: revenue.id, direction: 'debit', amount: input.amount },
      { accountId: creditAccount.id, direction: 'credit', amount: input.amount },
    ],
  });

  const reference = mintReference('CRG');
  const [row] = await txDb
    .insert(creditGrantsTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      customerId: customer.id,
      amount: input.amount,
      remaining: input.amount,
      source: input.source,
      sourceReference: input.sourceReference ?? null,
      ledgerTransactionId: posted.transactionId,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist credit grant',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  return serializeCreditGrant(row, input.customerRef);
}
