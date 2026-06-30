import { Router } from 'express';

import { listInvoiceQuery, voidInvoiceBody } from '@nombaone/core-contracts/validations';

import { validate } from '../../shared/http';
import { apiKeyAuth, idempotency, rateLimit, requireScope } from '../../shared/middlewares';
import { getInvoiceController, listInvoicesController, voidInvoiceController } from './controllers';

/**
 * Invoices — issued by the billing loop, never created by the tenant (J2). The
 * surface is read + void only. Same fixed per-route chain; reads skip idempotency.
 */
export const invoicesRouter: Router = Router();

invoicesRouter.get(
  '/invoices/:reference',
  apiKeyAuth,
  rateLimit,
  requireScope('invoices:read'),
  getInvoiceController
);
invoicesRouter.get(
  '/invoices',
  apiKeyAuth,
  rateLimit,
  requireScope('invoices:read'),
  validate({ query: listInvoiceQuery }),
  listInvoicesController
);
invoicesRouter.post(
  '/invoices/:reference/void',
  apiKeyAuth,
  rateLimit,
  requireScope('invoices:write'),
  idempotency,
  validate({ body: voidInvoiceBody }),
  voidInvoiceController
);
