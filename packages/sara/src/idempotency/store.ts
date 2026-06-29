import { createHash } from 'node:crypto';

import type { Redis } from 'ioredis';

/**
 * ── The idempotency state machine (Redis-backed) ──────────────────────────
 *
 * PARADIGM — *an idempotency key makes an unsafe write safe to retry*. A client
 * sends `Idempotency-Key: <key>` with a mutating request; if the network drops
 * the response and the client retries, the SAME effect must be returned, NOT a
 * second effect. We coordinate that with one Redis key per idempotency key,
 * moving through a tiny state machine:
 *
 *   (absent) --begin--> in_progress --complete--> done(data)
 *                            |
 *                            +-----abort--------> (absent, retryable)
 *
 *   begin() outcomes:
 *     • proceed     — we won the lock; the caller does the work, then complete().
 *     • in_progress — another request holds the lock right now; tell the client
 *                     to retry shortly (HTTP 409 IDEMPOTENCY_IN_PROGRESS).
 *     • replay      — the work already finished; return the cached INNER data
 *                     verbatim (no re-execution).
 *     • mismatch    — the SAME key arrived with a DIFFERENT request body; the
 *                     client is reusing a key for a different operation. Reject
 *                     (HTTP 422 IDEMPOTENCY_KEY_REUSED).
 *
 * The lock is taken with `SET key value NX PX <ttl>` — atomic test-and-set, so
 * exactly one concurrent request proceeds. We persist the request hash alongside
 * the state so a replay can prove the retry is the same operation. We cache only
 * the INNER data (the domain result), never an HTTP envelope — the transport
 * layer re-wraps it. The whole record is JSON in a single key; status lives on
 * the record, not in separate keys, so reads are one round-trip.
 *
 * This store holds NO domain logic and is tenant-agnostic: scoping is the
 * caller's responsibility (namespace the key, e.g. `idem:<org>:<env>:<key>`).
 */

/** Lifecycle of a single idempotency record. */
type RecordStatus = 'in_progress' | 'done';

interface IdempotencyRecord {
  status: RecordStatus;
  /** SHA-256 of the canonical request, to detect key reuse across operations. */
  requestHash: string;
  /** The cached INNER domain result; present only once `status === 'done'`. */
  data?: unknown;
}

export type BeginResult =
  | { state: 'proceed' }
  | { state: 'replay'; data: unknown }
  | { state: 'in_progress' }
  | { state: 'mismatch' };

export interface IdempotencyStore {
  /**
   * Attempt to claim `key` for a request fingerprinted by `requestHash`. See the
   * state-machine doc above for the four outcomes.
   */
  begin(key: string, requestHash: string): Promise<BeginResult>;
  /** Transition an in-progress record to done, caching the inner `data`. */
  complete(key: string, data: unknown): Promise<void>;
  /** Release the lock without recording a result (work failed → retryable). */
  abort(key: string): Promise<void>;
}

export interface IdempotencyStoreOptions {
  /**
   * Lifetime of the in-progress lock AND the cached result, in ms. The lock TTL
   * caps how long a crashed/abandoned request blocks retries; the result TTL
   * caps the replay window. Default 24h.
   */
  ttlMs?: number;
  /** Redis key namespace prefix. Default `idem:`. */
  keyPrefix?: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_KEY_PREFIX = 'idem:';

/** Stable fingerprint of a request payload, for the mismatch check. Callers may
 * use this or supply their own hash to `begin`. */
export const hashRequest = (payload: unknown): string =>
  createHash('sha256')
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload ?? null))
    .digest('hex');

/**
 * Build a {@link IdempotencyStore} bound to a Redis connection. The returned
 * object is stateless beyond the connection; share one per process.
 */
export const createIdempotencyStore = (
  redis: Redis,
  options: IdempotencyStoreOptions = {}
): IdempotencyStore => {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const redisKey = (key: string): string => `${keyPrefix}${key}`;

  const readRecord = async (key: string): Promise<IdempotencyRecord | null> => {
    const raw = await redis.get(redisKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as IdempotencyRecord;
    } catch {
      // A corrupt record cannot be trusted to replay; treat as absent so the
      // lock can be re-taken rather than wedging the key forever.
      return null;
    }
  };

  return {
    async begin(key: string, requestHash: string): Promise<BeginResult> {
      const record: IdempotencyRecord = { status: 'in_progress', requestHash };

      // Atomic claim: only the first concurrent caller sets the key.
      const claimed = await redis.set(
        redisKey(key),
        JSON.stringify(record),
        'PX',
        ttlMs,
        'NX'
      );
      if (claimed === 'OK') {
        return { state: 'proceed' };
      }

      // Lost the race — inspect the existing record to decide the outcome.
      const existing = await readRecord(key);
      if (!existing) {
        // The key vanished (TTL expired / aborted) between SET NX and GET. The
        // safest response is to ask the client to retry; the next begin() wins.
        return { state: 'in_progress' };
      }

      if (existing.requestHash !== requestHash) {
        return { state: 'mismatch' };
      }

      if (existing.status === 'done') {
        return { state: 'replay', data: existing.data ?? null };
      }

      return { state: 'in_progress' };
    },

    async complete(key: string, data: unknown): Promise<void> {
      const existing = await readRecord(key);
      // Preserve the original request hash so later retries still validate.
      const record: IdempotencyRecord = {
        status: 'done',
        requestHash: existing?.requestHash ?? '',
        data,
      };
      await redis.set(redisKey(key), JSON.stringify(record), 'PX', ttlMs);
    },

    async abort(key: string): Promise<void> {
      await redis.del(redisKey(key));
    },
  };
};
