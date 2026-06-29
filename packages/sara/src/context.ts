import type { PoolDatabase } from '@nombaone/core-db/pool';
import type { ServerlessDatabase } from '@nombaone/core-db/serverless';

/** Every deployment serves exactly one environment; the request's key/session
 * supplies it and it is threaded through the call chain (no env conditionals
 * inside handlers). */
export type Environment = 'test' | 'live';

/**
 * A read / single-statement-write handle. In production a Next.js app uses the
 * Neon HTTP driver and the API uses the pool; both satisfy domain reads.
 */
export type InfraDb = PoolDatabase | ServerlessDatabase;

/**
 * The interactive-transaction handle (pooled pg). Required for atomic
 * multi-statement writes — ledger posting, atomic signup. The HTTP driver
 * cannot run an interactive transaction.
 */
export type InfraTxDb = PoolDatabase;

/**
 * The handle a `txDb.transaction(async (tx) => …)` callback receives — i.e. the
 * inner `PgTransaction`. It carries the full query surface (select/insert/update/
 * delete) and can itself open nested transactions (savepoints), but it is NOT the
 * top-level pool (`$client` is absent), so it is a distinct type from `InfraTxDb`.
 *
 * Derived from `PoolDatabase['transaction']` so it stays in lockstep with the
 * driver: the contract is "whatever the pool hands its transaction callback".
 */
export type InfraTx = Parameters<Parameters<PoolDatabase['transaction']>[0]>[0];

/**
 * A handle a transaction-SCOPED helper accepts: either the top-level pooled
 * handle (`InfraTxDb`) or an already-open transaction (`InfraTx`). Callers inside
 * a `transaction(async (tx) => …)` block pass `tx`; callers that own the unit of
 * work pass the pool. Both expose the same query + nested-transaction surface, so
 * a helper written against this type composes either way.
 */
export type InfraTxScope = InfraTxDb | InfraTx;

/**
 * A read / single-statement-write handle that ALSO accepts an open transaction.
 * Repository reads (`findUserByEmail`, …) are called both at the top level (with
 * `InfraDb`) and from inside an atomic write (with `InfraTx`); this union is the
 * contract that lets one helper serve both without widening to `any`.
 */
export type InfraReadScope = InfraDb | InfraTx;

/**
 * Pinned scope, threaded into every domain read/write. The caller (API key or
 * session) supplies it; a handler NEVER trusts org/environment from the client.
 */
export interface DomainContext {
  organizationId: string;
  environment: Environment;
}
