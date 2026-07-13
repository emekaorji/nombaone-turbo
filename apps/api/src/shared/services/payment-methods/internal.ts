import { and, eq } from 'drizzle-orm';

import { customersTable, type CustomerRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

/** Unwrap a Nomba response body's inner `data` envelope (`{ code, description, data }`). */
export const nombaData = (res: { data: unknown }): Record<string, unknown> => {
  const top = (res.data ?? {}) as Record<string, unknown>;
  return (top.data ?? top) as Record<string, unknown>;
};

/** Resolve a customer by internal id within scope — `null` when absent. Shared by
 *  the rail-metadata builder and the checkout-link minter (one query, no drift). */
export async function loadCustomerById(
  db: InfraReadScope,
  ctx: DomainContext,
  id: string
): Promise<CustomerRow | null> {
  const [row] = await db
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.id, id)
      )
    )
    .limit(1);
  return row ?? null;
}

/** Resolve a customer REFERENCE to its row within scope (404 if not this tenant's). */
export async function resolveCustomer(
  db: InfraReadScope,
  ctx: DomainContext,
  reference: string
): Promise<CustomerRow> {
  const [row] = await db
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.reference, reference)
      )
    )
    .limit(1);

  if (!row) {
    throw AppError.NotFound(
      'customer not found',
      { reference },
      NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
    );
  }
  return row;
}
