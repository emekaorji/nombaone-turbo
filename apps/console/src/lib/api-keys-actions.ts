'use server';

import { createApiKey, revokeApiKey } from '@nombaone/sara/api-keys';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { db as poolDb } from '@nombaone/core-db/pool';
import { db } from '@nombaone/core-db/serverless';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

/** Broad default grant for a console-minted key — the tenant's standard scope vocabulary. */
const DEFAULT_SCOPES = [
  'customers:read',
  'customers:write',
  'plans:read',
  'plans:write',
  'prices:read',
  'prices:write',
  'subscriptions:read',
  'subscriptions:write',
  'invoices:read',
  'invoices:write',
  'payment_methods:read',
  'payment_methods:write',
  'coupons:read',
  'coupons:write',
  'webhooks:read',
  'webhooks:write',
  'metrics:read',
];

export type CreateKeyState =
  | { status: 'error'; message: string }
  | { status: 'success'; secret: string; keyPrefix: string };

export async function createKeyAction(formData: FormData): Promise<CreateKeyState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!can(session.user.role as OrgUserRole, 'apiKeys:manage')) {
    return { status: 'error', message: 'Your role cannot create API keys.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { status: 'error', message: 'Give the key a name.' };

  // createApiKey is typed for the node-postgres (pool) handle; revoke/list use neon-http.
  const created = await createApiKey(
    poolDb,
    { organizationId: session.organizationId, mode: session.mode },
    { name, scopes: DEFAULT_SCOPES, createdByUserId: session.userId },
  );

  revalidatePath('/developers');
  return { status: 'success', secret: created.secret, keyPrefix: created.keyPrefix };
}

export async function revokeKeyAction(reference: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!can(session.user.role as OrgUserRole, 'apiKeys:manage')) {
    return { ok: false, message: 'Your role cannot revoke API keys.' };
  }
  await revokeApiKey(db, { organizationId: session.organizationId, mode: session.mode }, reference);
  revalidatePath('/developers');
  return { ok: true };
}
