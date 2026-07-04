import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { apiKeysTable, type ApiKeyRow } from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { DomainContext, Mode, InfraDb, InfraTxDb } from '../context';

/**
 * ── The per-org secret API key (public-API authentication) ─────────────────
 *
 * PARADIGM — *the secret is shown exactly once*. We never store the raw key; we
 * store only its SHA-256 hash (`keyHash`) plus a short, non-secret `keyPrefix`
 * for display. At mint we hand the caller the full secret and forget it. A lost
 * key cannot be recovered, only rotated — which is the security property we
 * want.
 *
 * Key string shape: `nbo_<env>_<random>`. The environment is encoded IN the key
 * (the `sandbox`|`live` prefix selects the mode — a `live` key is only accepted on production)
 * and ALSO denormalised onto the row. Verification re-derives the environment
 * from the prefix and rejects a mismatch before touching the database.
 *
 * Lookup is by deterministic hash (unique index on `keyHash`), so it is a single
 * indexed read. We still do a constant-time compare on the stored hash to keep
 * the comparison free of early-exit timing signal, and we throttle `lastUsedAt`
 * writes so a hot key does not turn every authenticated request into a write.
 *
 * Tenancy: writes are scoped by `ctx` (org + environment); reads filter by
 * `ctx.organizationId` AND `ctx.mode`. Handlers pass `ctx` derived from
 * the authenticated principal — never client input.
 */

/** Public secret prefix per environment. The verifier parses the env back out. */
const ENV_PREFIX: Record<Mode, string> = {
  sandbox: 'nbo_sandbox_',
  live: 'nbo_live_',
};

/** Bytes of randomness in the secret body (256 bits → 43 base64url chars). */
const SECRET_ENTROPY_BYTES = 32;

/** Chars of the full key kept (un-hashed) for display, e.g. `nbo_sandbox_a1b2c3d4`. */
const KEY_PREFIX_DISPLAY_LENGTH = 16;

/** Minimum gap between `lastUsedAt` writes for the same key (write throttle). */
const LAST_USED_THROTTLE_MS = 60_000;

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

/** Generate a fresh secret + its display prefix + storage hash for an env. */
const generateSecret = (
  mode: Mode
): { secret: string; keyPrefix: string; keyHash: string } => {
  const body = randomBytes(SECRET_ENTROPY_BYTES).toString('base64url');
  const secret = `${ENV_PREFIX[mode]}${body}`;
  return {
    secret,
    keyPrefix: secret.slice(0, KEY_PREFIX_DISPLAY_LENGTH),
    keyHash: sha256Hex(secret),
  };
};

/** Derive the environment a raw key claims from its prefix, or `null`. */
const environmentFromKey = (rawKey: string): Mode | null => {
  if (rawKey.startsWith(ENV_PREFIX.sandbox)) return 'sandbox';
  if (rawKey.startsWith(ENV_PREFIX.live)) return 'live';
  return null;
};

/** Constant-time string compare that never throws on length mismatch. */
const timingSafeEqualHex = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
};

export interface CreatedApiKey {
  reference: string;
  /** The full secret — returned ONCE, never stored, never recoverable. */
  secret: string;
  keyPrefix: string;
  scopes: string[];
}

export interface VerifiedApiKey {
  apiKeyId: string;
  organizationId: string;
  mode: Mode;
  scopes: string[];
}

/**
 * Mint a new key for `ctx`. The environment comes from `ctx`, so a key is born
 * pinned to exactly one environment. Returns the secret once; only the hash is
 * persisted.
 */
export async function createApiKey(
  txDb: InfraTxDb,
  ctx: DomainContext,
  params: { name: string; scopes: string[]; createdByUserId?: string }
): Promise<CreatedApiKey> {
  const reference = mintReference('KEY');
  const { secret, keyPrefix, keyHash } = generateSecret(ctx.mode);

  await txDb.insert(apiKeysTable).values({
    reference,
    organizationId: ctx.organizationId,
    mode: ctx.mode,
    name: params.name,
    keyPrefix,
    keyHash,
    scopes: params.scopes,
    createdByUserId: params.createdByUserId ?? null,
  });

  return { reference, secret, keyPrefix, scopes: params.scopes };
}

/**
 * Authenticate a raw key string. Steps, in order: parse the environment from the
 * prefix (reject unknown shapes early), hash, single indexed lookup, reject
 * revoked/unknown, constant-time compare against the stored hash, then reject an
 * environment mismatch between the key's encoded env and the row. On success,
 * throttle the `lastUsedAt` write (skip it if updated within the last minute).
 *
 * Throws `API_KEY_INVALID` for a bad/unknown/revoked key and
 * `API_KEY_ENVIRONMENT_MISMATCH` when the encoded env disagrees with the row.
 */
export async function verifyApiKey(db: InfraDb, rawKey: string): Promise<VerifiedApiKey> {
  const claimedEnvironment = environmentFromKey(rawKey);
  if (!claimedEnvironment) {
    throw AppError.Unauthorized(
      'Malformed API key',
      undefined,
      NOMBAONE_ERROR_CODES.API_KEY_INVALID
    );
  }

  const keyHash = sha256Hex(rawKey);
  const [row] = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyHash, keyHash))
    .limit(1);

  if (!row || row.revokedAt) {
    throw AppError.Unauthorized(
      'Invalid or revoked API key',
      undefined,
      NOMBAONE_ERROR_CODES.API_KEY_INVALID
    );
  }

  // Constant-time confirmation on the stored hash — defence in depth against a
  // timing oracle even though the lookup is already by exact hash.
  if (!timingSafeEqualHex(row.keyHash, keyHash)) {
    throw AppError.Unauthorized(
      'Invalid or revoked API key',
      undefined,
      NOMBAONE_ERROR_CODES.API_KEY_INVALID
    );
  }

  if (row.mode !== claimedEnvironment) {
    throw AppError.Unauthorized(
      'API key environment does not match',
      { claimed: claimedEnvironment },
      NOMBAONE_ERROR_CODES.API_KEY_ENVIRONMENT_MISMATCH
    );
  }

  await touchLastUsed(db, row);

  return {
    apiKeyId: row.id,
    organizationId: row.organizationId,
    mode: row.mode,
    scopes: row.scopes ?? [],
  };
}

/** Write-throttled `lastUsedAt` bump. A hot key must not write every request. */
const touchLastUsed = async (db: InfraDb, row: ApiKeyRow): Promise<void> => {
  const now = Date.now();
  if (row.lastUsedAt && now - row.lastUsedAt.getTime() < LAST_USED_THROTTLE_MS) {
    return;
  }
  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date(now) })
    .where(eq(apiKeysTable.id, row.id));
};

/**
 * Rotate a key: mint a NEW secret for the same key's org/env/name/scopes and
 * SWAP the stored hash + prefix in place. The OLD secret stops working the
 * instant the row is overwritten — there is no overlap window on the same row.
 * (If a caller wants a grace period, create a second key, migrate traffic, then
 * revoke the first.) Returns the new secret once.
 */
export async function rotateApiKey(
  txDb: InfraTxDb,
  ctx: DomainContext,
  apiKeyReference: string
): Promise<{ reference: string; secret: string; keyPrefix: string }> {
  const [existing] = await txDb
    .select()
    .from(apiKeysTable)
    .where(
      and(
        eq(apiKeysTable.reference, apiKeyReference),
        eq(apiKeysTable.organizationId, ctx.organizationId),
        eq(apiKeysTable.mode, ctx.mode)
      )
    )
    .limit(1);

  if (!existing || existing.revokedAt) {
    throw AppError.NotFound(
      'API key not found',
      { reference: apiKeyReference },
      NOMBAONE_ERROR_CODES.API_KEY_INVALID
    );
  }

  const { secret, keyPrefix, keyHash } = generateSecret(existing.mode);

  await txDb
    .update(apiKeysTable)
    .set({ keyPrefix, keyHash, lastUsedAt: null })
    .where(eq(apiKeysTable.id, existing.id));

  return { reference: existing.reference, secret, keyPrefix };
}

/**
 * Revoke a key (soft, set `revokedAt`). Idempotent: revoking an already-revoked
 * or unknown key in this org/env is a no-op rather than an error, so a retried
 * revocation is safe.
 */
export async function revokeApiKey(
  db: InfraDb,
  ctx: DomainContext,
  apiKeyReference: string
): Promise<void> {
  await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeysTable.reference, apiKeyReference),
        eq(apiKeysTable.organizationId, ctx.organizationId),
        eq(apiKeysTable.mode, ctx.mode)
      )
    );
}

/** List a tenant's keys (newest first), scoped to `ctx` org + environment. */
export async function listApiKeys(db: InfraDb, ctx: DomainContext): Promise<ApiKeyRow[]> {
  return db
    .select()
    .from(apiKeysTable)
    .where(
      and(
        eq(apiKeysTable.organizationId, ctx.organizationId),
        eq(apiKeysTable.mode, ctx.mode)
      )
    )
    .orderBy(desc(apiKeysTable.createdAt));
}
