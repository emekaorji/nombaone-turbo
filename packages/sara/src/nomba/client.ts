import type { Redis } from 'ioredis';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { NOMBA_ENDPOINTS } from './endpoints';

import type { DomainContext } from '../context';
import type { NombaConfig, NombaToken } from './types';

/**
 * ── The Nomba OAuth client — the ONE place that holds a Nomba bearer ─────────
 *
 * `client_credentials` → token, cached in Redis under `nomba:token:<env>`. On
 * every request we read the cached token and **refresh when within the margin of
 * `expiresAt`** (never per call; integration-ref §2.8 — public docs say 30-min
 * TTL, so we trust `expiresAt`, not a hard 55-min). A Redis `SET NX` lock prevents
 * a thundering-herd refresh. `requeryTransaction` is the server-side verification
 * primitive (E4 — never trust a sync reply or a webhook alone).
 *
 * Constructed by the app from env (like `createIdempotencyStore(redis)`); the
 * adapters and capture flows receive the built `NombaClient`. `fetchImpl` is
 * injectable so adapters/tests run with a fake — no network in unit/e2e (B.10).
 */
export interface NombaRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** The Nomba path (from `NOMBA_ENDPOINTS`). */
  endpoint: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** OUR stable reference — for logging + Nomba-side idempotency. */
  idempotencyRef?: string;
}

export interface NombaResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

export interface RequeryResult {
  found: boolean;
  status?: string;
  /** Amount in kobo, as Nomba returns it. */
  amount?: number;
  succeeded: boolean;
  gatewayMessage?: string;
  providerReference?: string;
}

export interface NombaClient {
  getToken(): Promise<string>;
  request<T = unknown>(req: NombaRequest): Promise<NombaResponse<T>>;
  requeryTransaction(ctx: DomainContext, input: { reference: string }): Promise<RequeryResult>;
}

export interface NombaClientDeps {
  redis: Redis;
  config: NombaConfig;
  /** Injectable for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/** PURE: does a cached token need refreshing now (within margin of `expiresAt`)? */
export function nombaTokenNeedsRefresh(
  token: NombaToken | null,
  nowMs: number,
  marginSec: number
): boolean {
  if (!token) return true;
  const expiresMs = Date.parse(token.expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return nowMs >= expiresMs - marginSec * 1000;
}

export function createNombaClient(deps: NombaClientDeps): NombaClient {
  const { redis, config } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const tokenCacheKey = `nomba:token:${config.environment}`;
  const refreshLockKey = `nomba:token:refresh:${config.environment}`;

  const readCachedToken = async (): Promise<NombaToken | null> => {
    const raw = await redis.get(tokenCacheKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NombaToken;
    } catch {
      return null;
    }
  };

  const issueToken = async (): Promise<NombaToken> => {
    const res = await fetchImpl(`${config.baseUrl}${NOMBA_ENDPOINTS.tokenIssue}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accountId: config.parentAccountId },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!res.ok) {
      throw AppError.ThirdPartyServiceError(
        'nomba token issue failed',
        { status: res.status },
        NOMBAONE_ERROR_CODES.NOMBA_UNAUTHORIZED
      );
    }
    const body = (await res.json()) as {
      data?: { access_token?: string; refresh_token?: string; expiresAt?: string };
    };
    const data = body.data ?? {};
    if (!data.access_token) {
      throw AppError.ThirdPartyServiceError(
        'nomba token issue returned no access_token',
        undefined,
        NOMBAONE_ERROR_CODES.NOMBA_UNAUTHORIZED
      );
    }
    const token: NombaToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expiresAt ?? new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    };
    const ttlSec = Math.max(60, Math.floor((Date.parse(token.expiresAt) - Date.now()) / 1000));
    await redis.set(tokenCacheKey, JSON.stringify(token), 'EX', ttlSec);
    return token;
  };

  const getTokenObject = async (): Promise<NombaToken> => {
    const cached = await readCachedToken();
    if (!nombaTokenNeedsRefresh(cached, Date.now(), config.tokenRefreshMarginSec)) {
      return cached as NombaToken;
    }
    // Single-flight: only the lock winner mints; others briefly wait + re-read.
    const won = await redis.set(refreshLockKey, '1', 'PX', 10_000, 'NX');
    if (won !== 'OK') {
      await new Promise((r) => setTimeout(r, 250));
      const after = await readCachedToken();
      if (after && !nombaTokenNeedsRefresh(after, Date.now(), config.tokenRefreshMarginSec)) {
        return after;
      }
    }
    try {
      return await issueToken();
    } finally {
      await redis.del(refreshLockKey).catch(() => undefined);
    }
  };

  const getToken = async (): Promise<string> => (await getTokenObject()).accessToken;

  const request = async <T = unknown>(req: NombaRequest): Promise<NombaResponse<T>> => {
    const token = await getToken();
    const url = new URL(`${config.baseUrl}${req.endpoint}`);
    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetchImpl(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        accountId: config.parentAccountId,
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    return { status: res.status, ok: res.ok, data: data as T };
  };

  const requeryTransaction = async (
    _ctx: DomainContext,
    input: { reference: string }
  ): Promise<RequeryResult> => {
    const res = await request<Record<string, unknown>>({
      method: 'GET',
      endpoint: NOMBA_ENDPOINTS.transactionRequery,
      query: { transactionRef: input.reference },
      idempotencyRef: input.reference,
    });
    const data = ((res.data as Record<string, unknown>)?.data ?? res.data ?? {}) as Record<
      string,
      unknown
    >;
    const txn = (data.transaction ?? data) as Record<string, unknown>;
    const status = String(txn.status ?? data.status ?? '').toUpperCase();
    const succeeded = res.ok && (status.includes('SUCCESS') || status === '00');
    return {
      found: res.ok,
      status,
      amount: typeof txn.transactionAmount === 'number' ? txn.transactionAmount : undefined,
      succeeded,
      gatewayMessage: typeof data.gatewayMessage === 'string' ? data.gatewayMessage : undefined,
      providerReference: typeof txn.transactionId === 'string' ? txn.transactionId : undefined,
    };
  };

  return { getToken, request, requeryTransaction };
}
