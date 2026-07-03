import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { paymentMethodsTable } from '@nombaone/core-db/schema';

import { mintReference } from '../reference';
import { testBehaviorToken } from '../rails/test-sim';

import { resolveCustomer } from './internal';
import { serializePaymentMethod } from './serialize';

import type { PaymentMethodResponseData } from '@nombaone/core-contracts/types';
import type { CreateTestPaymentMethodBody } from '@nombaone/core-contracts/validations';
import type { DomainContext, InfraTxDb } from '../context';

export interface CreateTestPaymentMethodInput {
  customerRef: string;
  behavior: CreateTestPaymentMethodBody['behavior'];
  kind: CreateTestPaymentMethodBody['kind'];
}

/**
 * TEST-MODE ONLY. Insert a ready-to-use, deterministic payment method whose rail
 * identifier is a `test_*` sentinel the rail simulator (`maybeSimulateTestCollect`)
 * recognizes. The method is `active` immediately — no hosted-checkout round-trip,
 * because the sandbox delivers no capture webhook — so it can be made default and
 * charged by the test clock right away. The chosen `behavior` decides what happens
 * every time it is charged (paid / declined / OTP step-up), deterministically.
 */
export async function createTestPaymentMethod(
  db: InfraTxDb,
  ctx: DomainContext,
  input: CreateTestPaymentMethodInput
): Promise<PaymentMethodResponseData> {
  // Defence in depth — the route is also only mounted on a test deployment.
  if (ctx.environment !== 'test') {
    throw AppError.Forbidden(
      'Test payment methods can only be created in the test environment',
      undefined,
      NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN
    );
  }

  const customer = await resolveCustomer(db, ctx, input.customerRef);
  const reference = mintReference('PMT');
  const sentinel = testBehaviorToken(input.behavior);

  const [row] = await db
    .insert(paymentMethodsTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      customerId: customer.id,
      kind: input.kind,
      status: 'active',
      // The sentinel lives in the rail-identifier column for the method's kind.
      ...(input.kind === 'card'
        ? { tokenKey: sentinel, brand: 'TestCard', last4: '4242', expMonth: 12, expYear: 2999 }
        : { mandateId: sentinel }),
    })
    .returning();

  if (!row) throw new Error('createTestPaymentMethod: insert returned no row');
  return serializePaymentMethod(row, input.customerRef);
}
