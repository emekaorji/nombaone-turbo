import { AppError } from '@nombaone/errors';
import { listCustomers } from '@/domain/customers';

import { db } from '@shared/config/db';
import { paginatedHandler } from '@shared/http';

import type { CustomerResponseData } from '@nombaone/core-contracts/types';
import type { ListCustomerQuery } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * GET /v1/customers — keyset-paginated list within the caller's scope. The
 * validated query (coerced `limit`, optional `email`/`cursor`) is handed to sara,
 * which returns a `Page<CustomerResponseData>` unwrapped into the paginated
 * envelope.
 */
export const listCustomerController: RequestHandler = paginatedHandler<CustomerResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    const query = req.query as unknown as ListCustomerQuery;

    const page = await listCustomers(db, ctx, {
      email: query.email,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      data: page.data,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit: query.limit,
    };
  }
);
