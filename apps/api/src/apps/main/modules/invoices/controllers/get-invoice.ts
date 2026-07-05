import { AppError } from '@nombaone/errors';
import { getInvoiceByReference } from '@/domain/invoices';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { InvoiceResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/** GET /v1/invoices/:id — fetch one within scope (status derived). */
export const getInvoiceController: RequestHandler = jsonHandler<InvoiceResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const data = await getInvoiceByReference(db, ctx, (req.params.id ?? ''));
  return { data };
});
