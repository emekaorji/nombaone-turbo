'use server';

import { db as poolDb } from '@nombaone/core-db/pool';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { upsertOrgBillingSettings } from '@nombaone/sara/org/billing-settings';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

export type SaveResult = { ok: boolean; message?: string };

export async function saveBillingSettingsAction(formData: FormData): Promise<SaveResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired. Sign in again.' };
  if (!can(session.user.role as OrgUserRole, 'billing:write')) {
    return { ok: false, message: 'Your role cannot change billing settings.' };
  }

  const intField = (key: string, min: number): number | null => {
    const n = Number(String(formData.get(key) ?? '').trim());
    return Number.isInteger(n) && n >= min ? n : null;
  };

  const dunningMaxAttempts = intField('dunningMaxAttempts', 1);
  const gracePeriodHours = intField('gracePeriodHours', 0);
  const dunningMaxWindowHours = intField('dunningMaxWindowHours', 1);
  const paydayPullForwardDays = intField('paydayPullForwardDays', 0);

  if (
    dunningMaxAttempts === null ||
    gracePeriodHours === null ||
    dunningMaxWindowHours === null ||
    paydayPullForwardDays === null
  ) {
    return { ok: false, message: 'Enter valid whole numbers for the retry and payday fields.' };
  }

  await upsertOrgBillingSettings(
    poolDb,
    { organizationId: session.organizationId, mode: session.mode },
    {
      dunningMaxAttempts,
      gracePeriodHours,
      dunningMaxWindowHours,
      paydayPullForwardDays,
      paydayBiasEnabled: formData.get('paydayBiasEnabled') === 'on',
      partialCollectionEnabled: formData.get('partialCollectionEnabled') === 'on',
      commsEnabled: formData.get('commsEnabled') === 'on',
      defaultCollectionMethod:
        formData.get('defaultCollectionMethod') === 'send_invoice' ? 'send_invoice' : 'charge_automatically',
    },
  );

  revalidatePath('/settings/billing');
  return { ok: true };
}
