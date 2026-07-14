import { AppError } from '@nombaone/errors';

import {
  addPayoutAccount,
  findDefaultPayoutAccount,
  listBanks,
  resolveAccountName,
} from '@shared/services/settlement';
import { db } from '@shared/config/db';
import { getNombaClient } from '@shared/config/nomba';
import { jsonHandler } from '@shared/http';

import type { AddPayoutAccountBody } from '@nombaone/core-contracts/validations';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

const ctxOf = (req: Parameters<RequestHandler>[0]): DomainContext => {
  if (!req.apiKey) throw AppError.Unauthorized('API key required');
  return { organizationId: req.apiKey.organizationId, mode: req.apiKey.mode };
};

/**
 * GET /v1/banks — the NIBSS bank list (code + name), straight from Nomba.
 *
 * The console renders this as a dropdown so a merchant PICKS their bank. The withdraw
 * form previously had a raw text input for the bank code, placeholder `000013` — a
 * 6-digit NIBSS code that no human knows about their own bank, and which silently sends
 * money to the wrong institution if fat-fingered.
 */
export const listBanksController: RequestHandler = jsonHandler(async (req) => {
  const ctx = ctxOf(req);
  return { data: { domain: 'bank_list' as const, banks: await listBanks(getNombaClient(ctx.mode)) } };
});

/**
 * POST /v1/payout-accounts/resolve — name enquiry, WITHOUT saving anything.
 *
 * This powers the "We found: ADEBAYO STORES LTD — is this you?" confirmation step. The
 * merchant sees who the bank thinks owns the account before they commit to it, which is
 * the difference between a typo being caught and a typo being paid.
 */
export const resolvePayoutAccountController: RequestHandler = jsonHandler(async (req) => {
  const ctx = ctxOf(req);
  const body = req.body as AddPayoutAccountBody;
  const accountName = await resolveAccountName(getNombaClient(ctx.mode), {
    bankCode: body.bankCode,
    accountNumber: body.accountNumber,
  });
  return {
    data: {
      domain: 'payout_account_resolution' as const,
      accountName,
      accountNumber: body.accountNumber,
      bankCode: body.bankCode,
    },
  };
});

/**
 * POST /v1/payout-accounts — register the bank account this merchant is paid into.
 *
 * Asked for at FIRST WITHDRAWAL, never at signup: a bank account is meaningless until
 * there is money to send to it, and demanding one at the door is friction for nothing.
 *
 * The holder's name is not in the body — we take it from the bank. An unverified
 * destination cannot be stored (`org_payout_accounts.account_name` is NOT NULL).
 */
export const addPayoutAccountController: RequestHandler = jsonHandler(async (req) => {
  const ctx = ctxOf(req);
  const body = req.body as AddPayoutAccountBody;
  const row = await addPayoutAccount(db, ctx, getNombaClient(ctx.mode), body);
  return {
    data: {
      domain: 'payout_account' as const,
      reference: row.reference,
      bankCode: row.bankCode,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      status: row.status,
      verifiedAt: row.verifiedAt.toISOString(),
    },
    statusCode: 201,
  };
});

/** GET /v1/payout-accounts — the merchant's current destination (null before they add one). */
export const getPayoutAccountController: RequestHandler = jsonHandler(async (req) => {
  const ctx = ctxOf(req);
  const row = await findDefaultPayoutAccount(db, ctx);
  return {
    data: row
      ? {
          domain: 'payout_account' as const,
          reference: row.reference,
          bankCode: row.bankCode,
          bankName: row.bankName,
          accountNumber: row.accountNumber,
          accountName: row.accountName,
          status: row.status,
          verifiedAt: row.verifiedAt.toISOString(),
        }
      : null,
  };
});
