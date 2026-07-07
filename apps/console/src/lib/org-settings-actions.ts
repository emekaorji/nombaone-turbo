'use server';

import { organizationsTable } from '@nombaone/core-db';
import { db as poolDb } from '@nombaone/core-db/pool';
import { db } from '@nombaone/core-db/serverless';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { getOrgBillingSettings, upsertOrgBillingSettings } from '@nombaone/sara/org/billing-settings';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

export type SaveResult = { ok: boolean; message?: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function saveOrgSettingsAction(formData: FormData): Promise<SaveResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired. Sign in again.' };
  if (!can(session.user.role as OrgUserRole, 'billing:write')) {
    return { ok: false, message: 'Your role cannot change organization settings.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const supportEmail = String(formData.get('supportEmail') ?? '').trim();
  let primaryColorHex = String(formData.get('primaryColorHex') ?? '').trim();
  const settlementMode = String(formData.get('settlementMode') ?? 'split_at_collection');

  if (!name) return { ok: false, message: 'Organization name cannot be empty.' };
  if (supportEmail && !EMAIL_RE.test(supportEmail)) return { ok: false, message: 'Enter a valid support email.' };
  if (primaryColorHex) {
    if (!primaryColorHex.startsWith('#')) primaryColorHex = `#${primaryColorHex}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColorHex)) return { ok: false, message: 'Primary color must be a hex like #0bdfa3.' };
  }
  if (settlementMode !== 'split_at_collection' && settlementMode !== 'collect_then_payout') {
    return { ok: false, message: 'Choose a settlement mode.' };
  }

  const ctx = { organizationId: session.organizationId, mode: session.mode };
  const current = await getOrgBillingSettings(db, ctx);

  await db.update(organizationsTable).set({ name }).where(eq(organizationsTable.id, session.organizationId));
  await upsertOrgBillingSettings(poolDb, ctx, {
    settlementMode,
    branding: {
      ...current.branding,
      supportEmail: supportEmail || undefined,
      primaryColorHex: primaryColorHex || undefined,
    },
  });

  revalidatePath('/settings');
  revalidatePath('/', 'layout'); // org name shows in the shell
  return { ok: true };
}
