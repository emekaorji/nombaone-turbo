'use server';

import { db as poolDb } from '@nombaone/core-db/pool';
import { db } from '@nombaone/core-db/serverless';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { createWebhookEndpoint, disableWebhookEndpoint, rotateWebhookSecret, updateWebhookEndpoint } from '@nombaone/sara/webhooks';
import { revalidatePath } from 'next/cache';

import { ApiError, callApi } from '@/lib/api-client';
import { getSession } from '@/lib/auth';

export type CreateEndpointState =
  | { status: 'error'; message: string }
  | { status: 'success'; signingSecret: string };

export async function createEndpointAction(formData: FormData): Promise<CreateEndpointState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!can(session.user.role as OrgUserRole, 'webhooks:manage')) {
    return { status: 'error', message: 'Your role cannot manage webhook endpoints.' };
  }

  const url = String(formData.get('url') ?? '').trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'error', message: 'Enter a valid URL (https://…).' };
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    return { status: 'error', message: 'Webhook endpoints must use https.' };
  }

  const created = await createWebhookEndpoint(
    poolDb,
    { organizationId: session.organizationId, mode: session.mode },
    { url, enabledEvents: ['*'] },
  );

  revalidatePath('/developers/webhooks');
  return { status: 'success', signingSecret: created.signingSecret };
}

export async function disableEndpointAction(reference: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!can(session.user.role as OrgUserRole, 'webhooks:manage')) {
    return { ok: false, message: 'Your role cannot manage webhook endpoints.' };
  }
  await disableWebhookEndpoint(db, { organizationId: session.organizationId, mode: session.mode }, reference);
  revalidatePath('/developers/webhooks');
  return { ok: true };
}

/** Replay a delivery to its endpoint (POST /v1/webhooks/:ref/deliveries/:deliveryRef/replay) via the api bridge. */
export async function replayDeliveryAction(endpointReference: string, deliveryReference: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!can(session.user.role as OrgUserRole, 'webhooks:manage')) {
    return { ok: false, message: 'Your role cannot manage webhook endpoints.' };
  }
  try {
    await callApi(session, `/webhooks/${encodeURIComponent(endpointReference)}/deliveries/${encodeURIComponent(deliveryReference)}/replay`, { method: 'POST', body: {} });
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.message };
    return { ok: false, message: 'Could not replay the delivery.' };
  }
  revalidatePath('/developers/webhooks');
  return { ok: true };
}

/** Edit a webhook endpoint's URL (PATCH /v1/webhooks/:id). */
export async function updateEndpointAction(reference: string, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!can(session.user.role as OrgUserRole, 'webhooks:manage')) {
    return { ok: false, message: 'Your role cannot manage webhook endpoints.' };
  }
  const url = String(formData.get('url') ?? '').trim();
  if (!/^https?:\/\/.+/.test(url)) return { ok: false, message: 'Enter a valid https URL.' };
  try {
    await updateWebhookEndpoint(poolDb, { organizationId: session.organizationId, mode: session.mode }, reference, { url });
  } catch {
    return { ok: false, message: 'Could not update the endpoint.' };
  }
  revalidatePath('/developers/webhooks');
  return { ok: true };
}

export type RotateSecretState = { ok: true; signingSecret: string } | { ok: false; message: string };

/** Rotate an endpoint's signing secret — returns the new secret ONCE (never recoverable after). */
export async function rotateSecretAction(reference: string): Promise<RotateSecretState> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!can(session.user.role as OrgUserRole, 'webhooks:manage')) {
    return { ok: false, message: 'Your role cannot manage webhook endpoints.' };
  }
  try {
    const rotated = await rotateWebhookSecret(poolDb, { organizationId: session.organizationId, mode: session.mode }, reference);
    revalidatePath('/developers/webhooks');
    return { ok: true, signingSecret: rotated.signingSecret };
  } catch {
    return { ok: false, message: 'Could not rotate the secret.' };
  }
}
