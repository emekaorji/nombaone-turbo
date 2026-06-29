import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import {
  webhookEndpointsTable,
  type WebhookEndpointRow,
} from '@nombaone/core-db/schema';

import type { DomainContext, InfraDb, InfraTxDb } from '../context';
import { mintReference } from '../reference';

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
 * payload with `HMAC-SHA256(thatHash, rawBody)`. This keeps the at-rest secret a
 * one-way hash (no reversible plaintext column) while still letting both sides
 * agree on the HMAC key. The prefix is for human display only.
 *
 * Every read/write is pinned to `ctx.organizationId` AND `ctx.environment`; a
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
    environment: ctx.environment,
    url: params.url,
    enabledEvents: params.enabledEvents,
    signingSecretHash: sha256Hex(signingSecret),
    signingSecretPrefix,
  });

  // The plaintext secret escapes exactly here, once. After this it lives only as
  // a hash in the column; the caller is responsible for surfacing it to the user.
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
        eq(webhookEndpointsTable.environment, ctx.environment)
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
        eq(webhookEndpointsTable.environment, ctx.environment)
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
        eq(webhookEndpointsTable.environment, ctx.environment),
        isNull(webhookEndpointsTable.disabledAt)
      )
    );
};
