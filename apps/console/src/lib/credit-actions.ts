'use server';

import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { revalidatePath } from 'next/cache';

import { ApiError, callApi } from '@/lib/api-client';
import { getSession } from '@/lib/auth';

export type GrantCreditState = { error?: string; ok?: boolean };

/** Grant account credit to a customer via apps/api (POST /v1/customers/:ref/credit). Ledger-only, no external call. */
export async function grantCreditAction(customerReference: string, _prev: GrantCreditState, formData: FormData): Promise<GrantCreditState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) {
    return { error: 'Only owners can grant credit.' };
  }

  const naira = Number(formData.get('amount'));
  if (!Number.isFinite(naira) || naira <= 0) return { error: 'Enter an amount greater than zero.' };
  const amountInKobo = Math.round(naira * 100);
  const source = String(formData.get('source') ?? 'manual') === 'goodwill' ? 'goodwill' : 'manual';
  const sourceReference = String(formData.get('note') ?? '').trim() || undefined;

  try {
    await callApi(session, `/customers/${encodeURIComponent(customerReference)}/credit`, {
      method: 'POST',
      body: { amountInKobo, source, ...(sourceReference ? { sourceReference } : {}) },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not grant credit. Try again.' };
  }

  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/customers');
  return { ok: true };
}
