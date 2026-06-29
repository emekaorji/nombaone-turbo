'use server';

import { z } from 'zod';

import { createApiKeyBody, createWebhookEndpointBody } from '@nombaone/core-contracts/validations';
import { NOMBAONE_ERROR_CODES, type ApiFieldErrors } from '@nombaone/errors';
import { createApiKey, revokeApiKey } from '@nombaone/sara/api-keys';
import { createWebhookEndpoint, disableWebhookEndpoint } from '@nombaone/sara/webhooks';
import type { PoolDatabase } from '@nombaone/core-db/pool';

import { db } from './db';
import { txDb } from './db-tx';
import { getOrgDomainCtx, requireCapability } from './auth-context';
import { withAction, fail, ok, type ActionResult } from './actions';

/**
 * Developer-surface mutations (API keys + webhook endpoints). Each one:
 *   1. enforces the RBAC capability SERVER-SIDE (`requireCapability`) — the UI
 *      hiding the button is a courtesy, this is the gate;
 *   2. resolves the pinned scope from the session (`getOrgDomainCtx`) — the
 *      client never supplies org/environment;
 *   3. validates with the contracts zod schema, mapping issues to `fields`;
 *   4. delegates to `@nombaone/sara`, returning the secret (shown once) on create.
 *
 * `createApiKey`/`createWebhookEndpoint` open interactive transactions, so they
 * take the concrete `PoolDatabase`; `txDb()` is one at runtime.
 */

function zodFields(error: z.ZodError): ApiFieldErrors {
  const fields: ApiFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

const referenceSchema = z.string().trim().min(1).max(128);

/* ── API keys ───────────────────────────────────────────────────────────────── */

/** On success carries the full secret (`secret`) — surfaced once, never stored. */
export type CreateApiKeyResult = ActionResult<{
  reference: string;
  secret: string;
  keyPrefix: string;
}>;

export async function createApiKeyAction(raw: unknown): Promise<CreateApiKeyResult> {
  return withAction(
    async () => {
      const user = await requireCapability('apiKeys:manage');
      const parsed = createApiKeyBody.safeParse(raw);
      if (!parsed.success) {
        return fail(
          NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
          'Please correct the highlighted fields.',
          zodFields(parsed.error)
        );
      }

      const ctx = await getOrgDomainCtx();
      const created = await createApiKey(txDb() as PoolDatabase, ctx, {
        name: parsed.data.name,
        scopes: parsed.data.scopes,
        createdByUserId: user.id,
      });
      return ok({
        reference: created.reference,
        secret: created.secret,
        keyPrefix: created.keyPrefix,
      });
    },
    { revalidate: '/developers' }
  );
}

export async function revokeApiKeyAction(reference: string): Promise<ActionResult> {
  return withAction(
    async () => {
      await requireCapability('apiKeys:manage');
      const parsed = referenceSchema.safeParse(reference);
      if (!parsed.success) {
        return fail(NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED, 'Invalid API key reference.');
      }
      const ctx = await getOrgDomainCtx();
      await revokeApiKey(db, ctx, parsed.data);
      return ok(undefined);
    },
    { revalidate: '/developers' }
  );
}

/* ── Webhook endpoints ────────────────────────────────────────────────────────── */

/** On success carries the signing secret (shown once). */
export type CreateWebhookResult = ActionResult<{
  reference: string;
  signingSecret: string;
  signingSecretPrefix: string;
}>;

export async function createWebhookEndpointAction(raw: unknown): Promise<CreateWebhookResult> {
  return withAction(
    async () => {
      await requireCapability('webhooks:manage');
      const parsed = createWebhookEndpointBody.safeParse(raw);
      if (!parsed.success) {
        return fail(
          NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
          'Please correct the highlighted fields.',
          zodFields(parsed.error)
        );
      }

      const ctx = await getOrgDomainCtx();
      const created = await createWebhookEndpoint(txDb() as PoolDatabase, ctx, {
        url: parsed.data.url,
        enabledEvents: parsed.data.enabledEvents,
      });
      return ok({
        reference: created.reference,
        signingSecret: created.signingSecret,
        signingSecretPrefix: created.signingSecretPrefix,
      });
    },
    { revalidate: '/developers/webhooks' }
  );
}

export async function disableWebhookEndpointAction(reference: string): Promise<ActionResult> {
  return withAction(
    async () => {
      await requireCapability('webhooks:manage');
      const parsed = referenceSchema.safeParse(reference);
      if (!parsed.success) {
        return fail(NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED, 'Invalid endpoint reference.');
      }
      const ctx = await getOrgDomainCtx();
      await disableWebhookEndpoint(db, ctx, parsed.data);
      return ok(undefined);
    },
    { revalidate: '/developers/webhooks' }
  );
}
