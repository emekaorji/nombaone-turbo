import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  webhookEndpointsTable,
  type WebhookEndpointRow,
} from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { DomainContext, InfraDb, InfraTxDb } from '../context';

/**
 * PARADIGM — tenant-owned outbound endpoints with a hash-at-rest signing secret.
 *
 * An endpoint is a tenant's URL plus the subscription (`enabledEvents`) that
 * decides which event types fan out to it. Each endpoint owns an HMAC signing
 * secret. We follow the same secret-handling discipline as API keys: the
 * plaintext secret is generated once and RETURNED ONCE to the caller, and only
 * its sha256 hash is persisted (with a short display prefix). We therefore can
 * never leak the plaintext from the database.
 *
 * The signing KEY used by `./deliver` is the stored sha256 hash itself — a
 * 32-byte value derived deterministically from the plaintext. A tenant verifying
 * a delivery recomputes `sha256(plaintextSecret)` once, then verifies every
 * `t=<unix>,v1=<hex>` header with `HMAC-SHA256(thatHash, `${t}.${rawBody}`)`
 * (see `./sign`; the Node SDK does this hashing internally from the plaintext).
 * This keeps the at-rest secret a one-way hash (no reversible plaintext column)
 * while still letting both sides agree on the HMAC key. The prefix is for human
 * display only.
 *
 * Every read/write is pinned to `ctx.organizationId` AND `ctx.mode`; a
 * handler never passes a client-supplied scope.
 */

/** A signing secret is high-entropy random bytes, hex-encoded, brand-prefixed. */
const SIGNING_SECRET_PREFIX_LEN = 16;

const generateSigningSecret = (): string => `nbo_whsec_${randomBytes(24).toString('hex')}`;

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

export const createWebhookEndpoint = async (
  txDb: InfraTxDb,
  ctx: DomainContext,
  params: { url: string; enabledEvents: string[] }
): Promise<{ reference: string; signingSecret: string; signingSecretPrefix: string }> => {
  const reference = mintReference('WHK');
  const signingSecret = generateSigningSecret();
  const signingSecretPrefix = signingSecret.slice(0, SIGNING_SECRET_PREFIX_LEN);

  await txDb.insert(webhookEndpointsTable).values({
    reference,
    organizationId: ctx.organizationId,
    mode: ctx.mode,
    url: params.url,
    enabledEvents: params.enabledEvents,
    signingSecretHash: sha256Hex(signingSecret),
    signingSecretPrefix,
  });

  // The plaintext secret escapes exactly here, once. After this it lives only as
  // a hash in the column; the caller is responsible for surfacing it to the user.
  return { reference, signingSecret, signingSecretPrefix };
};

/** Load one endpoint by reference within scope; NotFound (never a cross-tenant leak). */
export const getWebhookEndpoint = async (
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<WebhookEndpointRow> => {
  const [row] = await db
    .select()
    .from(webhookEndpointsTable)
    .where(
      and(
        eq(webhookEndpointsTable.reference, reference),
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound(
      'Webhook endpoint not found',
      { reference },
      NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND
    );
  }
  return row;
};

/**
 * Patch an endpoint's `url` / `enabledEvents` / enabled-state (07). Scope-guarded
 * existence check first (NotFound on foreign/unknown). `disabled: true` stamps
 * `disabledAt`; `disabled: false` re-enables (clears it).
 */
export const updateWebhookEndpoint = async (
  db: InfraDb,
  ctx: DomainContext,
  reference: string,
  input: { url?: string; enabledEvents?: string[]; disabled?: boolean }
): Promise<WebhookEndpointRow> => {
  const existing = await getWebhookEndpoint(db, ctx, reference);
  const patch: Partial<typeof webhookEndpointsTable.$inferInsert> = {};
  if (input.url !== undefined) patch.url = input.url;
  if (input.enabledEvents !== undefined) patch.enabledEvents = input.enabledEvents;
  if (input.disabled !== undefined) patch.disabledAt = input.disabled ? new Date() : null;

  await db
    .update(webhookEndpointsTable)
    .set(patch)
    .where(
      and(
        eq(webhookEndpointsTable.id, existing.id),
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    );
  return getWebhookEndpoint(db, ctx, reference);
};

/**
 * Rotate an endpoint's signing secret (07): mint a new plaintext, overwrite the
 * hash + prefix, and return the plaintext ONCE (same discipline as create).
 * In-flight deliveries re-sign with the new key on their next drain.
 */
export const rotateWebhookSecret = async (
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<{ reference: string; signingSecret: string; signingSecretPrefix: string }> => {
  const existing = await getWebhookEndpoint(db, ctx, reference);
  const signingSecret = generateSigningSecret();
  const signingSecretPrefix = signingSecret.slice(0, SIGNING_SECRET_PREFIX_LEN);
  await db
    .update(webhookEndpointsTable)
    .set({ signingSecretHash: sha256Hex(signingSecret), signingSecretPrefix })
    .where(
      and(
        eq(webhookEndpointsTable.id, existing.id),
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    );
  return { reference, signingSecret, signingSecretPrefix };
};

export const listWebhookEndpoints = (
  db: InfraDb,
  ctx: DomainContext
): Promise<WebhookEndpointRow[]> =>
  db
    .select()
    .from(webhookEndpointsTable)
    .where(
      and(
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    )
    .orderBy(desc(webhookEndpointsTable.createdAt));

/**
 * Soft-disable: stamp `disabledAt` so `emitEvent` stops fanning out to it and
 * `deliverPending` skips its in-flight rows, while history is preserved.
 * Idempotent and scope-guarded; disabling an unknown/foreign endpoint is a
 * not-found, never a silent no-op that touches another tenant's row.
 */
export const disableWebhookEndpoint = async (
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<void> => {
  // Scope-guarded existence check FIRST. `.returning()` is unavailable on the
  // `InfraDb` union (the pg and Neon-HTTP update builders expose incompatible
  // `.returning` overloads, so the union collapses to the zero-arg form), so we
  // resolve "does this endpoint exist in this tenant's scope" with a plain read,
  // then issue an unconditional scoped update. Both drivers share an identical
  // select/update surface, so this stays driver-agnostic without any cast.
  const [existing] = await db
    .select({ id: webhookEndpointsTable.id })
    .from(webhookEndpointsTable)
    .where(
      and(
        eq(webhookEndpointsTable.reference, reference),
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    )
    .limit(1);

  if (!existing) {
    // Unknown within this scope — reported as not-found so we never leak
    // existence across tenants.
    throw AppError.NotFound(
      'Webhook endpoint not found',
      { reference },
      NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND
    );
  }

  // Stamp `disabledAt`, still re-pinned to (reference, org, environment) and
  // guarded on `isNull(disabledAt)`. If it was already disabled the WHERE matches
  // nothing — an idempotent no-op success, with no leak about the prior mutation.
  await db
    .update(webhookEndpointsTable)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(webhookEndpointsTable.reference, reference),
        eq(webhookEndpointsTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode),
        isNull(webhookEndpointsTable.disabledAt)
      )
    );
};
