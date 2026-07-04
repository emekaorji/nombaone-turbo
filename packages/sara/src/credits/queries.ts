import { and, asc, eq } from 'drizzle-orm';

import { creditGrantsTable, customersTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { serializeCreditGrant } from './serialize';

import type { DomainContext, InfraDb } from '../context';
import type { CreditGrantResponseData } from './types';

export async function resolveCustomerId(
  db: InfraDb,
  ctx: DomainContext,
  customerRef: string
): Promise<string> {
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.reference, customerRef)
      )
    )
    .limit(1);
  if (!customer) {
    throw AppError.NotFound(
      'customer not found',
      { reference: customerRef },
      NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND
    );
  }
  return customer.id;
}

/** All grants for a customer, oldest-first (the application order). */
export async function listCreditGrants(
  db: InfraDb,
  ctx: DomainContext,
  customerRef: string
): Promise<CreditGrantResponseData[]> {
  const customerId = await resolveCustomerId(db, ctx, customerRef);
  const rows = await db
    .select()
    .from(creditGrantsTable)
    .where(
      and(
        eq(creditGrantsTable.organizationId, ctx.organizationId),
        eq(creditGrantsTable.mode, ctx.mode),
        eq(creditGrantsTable.customerId, customerId)
      )
    )
    .orderBy(asc(creditGrantsTable.createdAt), asc(creditGrantsTable.id));
  return rows.map((r) => serializeCreditGrant(r, customerRef));
}
