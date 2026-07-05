import { and, eq } from 'drizzle-orm';

import { customersTable, type CustomerRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { serializeCustomer } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CustomerResponseData, UpdateCustomerInput } from './types';

/**
 * Update a customer's mutable contact fields (email is immutable — the natural
 * key). Resolves the row by reference within scope (404 if absent for this
 * tenant), applies only the provided fields, and emits `customer.updated`.
 * `updated_at` is bumped automatically by the schema's `$onUpdate`.
 */
export async function updateCustomer(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: UpdateCustomerInput
): Promise<CustomerResponseData> {
  const [existing] = await txDb
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.reference, reference)
      )
    )
    .limit(1);

  if (!existing) {
    throw AppError.NotFound(
      'customer not found',
      { reference },
      NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
    );
  }

  const patch: Partial<Pick<CustomerRow, 'name' | 'phone' | 'metadata'>> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const [row] = await txDb
    .update(customersTable)
    .set(patch)
    .where(eq(customersTable.id, existing.id))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to update customer',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'customer.updated',
    payload: { reference },
  });

  return serializeCustomer(row);
}
