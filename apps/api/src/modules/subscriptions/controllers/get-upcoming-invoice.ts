import { AppError } from '@nombaone/errors';
import { getUpcomingInvoice } from '@nombaone/sara/billing';

import { db } from '../../../shared/config/db';
import { jsonHandler } from '../../../shared/http';

import type { UpcomingInvoiceResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/subscriptions/:reference/upcoming-invoice — preview the next invoice. */
export const getUpcomingInvoiceController: RequestHandler = jsonHandler<UpcomingInvoiceResponseData>(
  async (req) => {
    if (!req.apiKey) {
      throw AppError.Unauthorized('API key required');
    }
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      environment: req.apiKey.environment,
    };
    const data = await getUpcomingInvoice(db, ctx, req.params.reference ?? '');
    return { data };
  }
);
