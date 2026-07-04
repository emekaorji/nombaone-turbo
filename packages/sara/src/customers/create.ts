import { and, eq } from 'drizzle-orm';

import { customersTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { mintReference } from '../reference';
import { serializeCustomer } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreateCustomerInput, CustomerResponseData } from './types';

/**
 * Create a tenant's customer (subscriber).
 *
 *  1. Email uniqueness within (org, env) is checked up front for a clean
 *     `409 CUSTOMER_EMAIL_TAKEN`; the `customers_org_env_email_unique` index is
 *     the real backstop against a race (a concurrent duplicate violates it).
 *  2. Mint the public reference (`nbo…cus`) — the stable API `id`.
 *  3. Insert the tenant-scoped row, then emit `customer.created` (the outbox fans
 *     it out to the tenant's webhooks).
 *
 * Tenancy is stamped from `ctx`; the handler never trusts org/env from the client.
 */
export async function createCustomer(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateCustomerInput
): Promise<CustomerResponseData> {
  const [existing] = await txDb
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.email, input.email)
      )
    )
    .limit(1);

  if (existing) {
    throw AppError.Conflict(
      'a customer with this email already exists',
      { email: input.email },
      NOMBAONE_ERROR_CODES.CUSTOMER_EMAIL_TAKEN
    );
  }

  const reference = mintReference('CUS');

  const [row] = await txDb
    .insert(customersTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist customer',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'customer.created',
    payload: { reference, email: row.email },
  });

  return serializeCustomer(row);
}
