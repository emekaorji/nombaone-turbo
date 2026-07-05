import { AppError } from '@nombaone/errors';
import { listPaymentMethods } from '@shared/services/payment-methods';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { PaymentMethodResponseData } from '@nombaone/core-contracts/types';
import type { ListPaymentMethodQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/payment-methods — keyset-paginated, optional `customerRef` filter. */
export const listPaymentMethodsController: RequestHandler = paginatedHandler<PaymentMethodResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const query = req.query as unknown as ListPaymentMethodQuery;

    const page = await listPaymentMethods(db, ctx, {
      customerRef: query.customerRef,
      limit: query.limit,
      cursor: query.cursor,
    });

    return { data: page.data, nextCursor: page.nextCursor, hasMore: page.hasMore, limit: query.limit };
  }
);
