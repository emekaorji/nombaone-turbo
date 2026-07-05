import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';

import { orgSessionsTable } from '@nombaone/core-db/schema';

import type { Mode, InfraDb, InfraTxScope } from '@nombaone/sara/context';

/**
 * PARADIGM — OPAQUE-TOKEN sessions. The raw token is a high-entropy random
 * string handed to the client (httpOnly cookie); the server stores ONLY its
 * SHA-256 hash. A stolen database therefore yields no usable tokens, and lookup
 * is an indexed equality on the hash. There is no JWT and no server-side signing
 * key to rotate — revocation is a row delete, which is the whole point: sessions
 * are server-authoritative and instantly killable.
 *
 * SHA-256 (not bcrypt) is correct here because the token is already 256 bits of
 * uniform randomness — there is nothing to brute-force, so a fast hash that
 * supports an exact-match index is exactly what we want.
 */

/** 32 bytes of entropy, base64url — what the client actually holds. */
const mintRawToken = (): string => randomBytes(32).toString('base64url');

/** The at-rest form: only this hash is ever persisted. */
const hashToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken).digest('hex');

/** Default session lifetime: 30 days. Overridable per call via `ttlMs`. */
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Open a session for an authenticated user and return the RAW token (the only
 * time it is ever materialized). The pinned `environment` is the console's
 * active sandbox/live mode, threaded into every subsequent request's DomainContext.
 */
export const createSession = async (
  txDb: InfraTxScope,
  params: {
    userId: string;
    organizationId: string;
    mode: Mode;
    ttlMs?: number;
  }
): Promise<{ token: string }> => {
  const token = mintRawToken();
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_SESSION_TTL_MS));

  await txDb.insert(orgSessionsTable).values({
    tokenHash: hashToken(token),
    userId: params.userId,
    organizationId: params.organizationId,
    mode: params.mode,
    expiresAt,
  });

  return { token };
};

/**
 * Resolve a raw token to its session context, or `null` if unknown/expired. The
 * expiry is enforced in SQL (`expiresAt > now()`) so a stale row never validates
 * even before a sweep deletes it. Returns the pinned scope the caller threads
 * into DomainContext — never trusting org/environment from the client.
 */
export const validateSession = async (
  db: InfraDb,
  rawToken: string
): Promise<{ organizationId: string; userId: string; mode: Mode } | null> => {
  if (!rawToken) return null;

  const [row] = await db
    .select({
      organizationId: orgSessionsTable.organizationId,
      userId: orgSessionsTable.userId,
      mode: orgSessionsTable.mode,
    })
    .from(orgSessionsTable)
    .where(
      and(
        eq(orgSessionsTable.tokenHash, hashToken(rawToken)),
        gt(orgSessionsTable.expiresAt, new Date())
      )
    )
    .limit(1);

  return row ?? null;
};

/** Revoke a session by deleting its row — immediate, server-authoritative logout. */
export const revokeSession = async (db: InfraDb, rawToken: string): Promise<void> => {
  if (!rawToken) return;
  await db.delete(orgSessionsTable).where(eq(orgSessionsTable.tokenHash, hashToken(rawToken)));
};
