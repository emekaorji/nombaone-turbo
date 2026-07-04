import { AppError } from '@nombaone/errors';
import { getInvoiceByReference, voidInvoice } from '@nombaone/sara/invoices';

import { db } from '@shared/config/db';
import { jsonHandler } from '@shared/http';

import type { InvoiceResponseData } from '@nombaone/core-contracts/types';
import type { VoidInvoiceBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

/**
 * POST /v1/invoices/:id/void — void a draft/open invoice (J9). A paid
 * invoice is corrected by a ledger reversal, not a void. No create/update invoice
 * endpoint exists — invoices are issued by the billing loop (J2 immutability).
 */
export const voidInvoiceController: RequestHandler = jsonHandler<InvoiceResponseData>(async (req) => {
  if (!req.apiKey) {
    throw AppError.Unauthorized('API key required');
  }
  const ctx: DomainContext = {
    organizationId: req.apiKey.organizationId,
    mode: req.apiKey.mode,
  };
  const body = (req.body ?? {}) as VoidInvoiceBody;

  await voidInvoice(db, ctx, (req.params.id ?? ''), body.comment);
  const data = await getInvoiceByReference(db, ctx, (req.params.id ?? ''));
  return { data };
});
