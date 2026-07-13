
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { NOMBA_ENDPOINTS } from './endpoints';
import { nombaAmountToKobo } from './money';

import type { Redis } from 'ioredis';
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
  /**
   * True only when the HTTP status AND Nomba's body envelope both say success.
   *
   * ⚠ Nomba returns **HTTP 200 with a failure envelope** for validation errors —
   * live-confirmed 2026-07-13: `POST /v1/accounts/virtual` with an `accountName`
   * containing a digit answers `200 {"code":"400","status":false,"message":
   * "Account name must not contain special characters."}`. Trusting `res.ok`
   * alone made every caller's `if (!res.ok)` guard pass and then read an absent
   * `data` — the transfer rail handed payers a NUBAN of `undefined`. So `ok`
   * folds the envelope in: an explicit `status:false` is a failure, whatever the
   * HTTP code said.
   */
  ok: boolean;
  /**
   * Nomba ACCEPTED the request but has not finished it — the async lane. A payout
   * answers `{code:"201", description:"PROCESSING", status:false}` for a transfer
   * that IS in flight and WILL settle; the outcome arrives by webhook.
   *
   * 🔴 `pending` is NOT `failed`. Treating it as failure and compensating (e.g.
   * crediting the merchant's ledger back) while Nomba sends the money is a
   * DOUBLE-SPEND. Nomba's own doc: "Mark the transaction as pending and do not
   * retry with a new reference."
   */
  pending: boolean;
  data: T;
  /** Nomba's body `code` ("00" success, "201" processing, "400" rejected…). Branch on this, not on HTTP. */
  providerCode?: string;
  /** Nomba's human-readable reason, when it sent one. Log it; never show it raw to a payer. */
  providerMessage?: string;
}

/**
 * Does this envelope mean "accepted, still working on it" rather than "rejected"?
 * Nomba signals both with `status:false`, so the ONLY discriminators are the body
 * `code` (201) and the PROCESSING wording.
 */
function isPendingEnvelope(
  code: string | undefined,
  message: string | undefined,
  description: unknown
): boolean {
  if (code === '201') return true;
  const text = `${typeof description === 'string' ? description : ''} ${message ?? ''}`.toUpperCase();
  return text.includes('PROCESSING') || text.includes('PENDING');
}

export interface RequeryResult {
  found: boolean;
  status?: string;
  /** Amount in integer KOBO — converted from Nomba's naira decimal at the boundary (D.1). */
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
  const tokenCacheKey = `nomba:token:${config.mode}`;
  const refreshLockKey = `nomba:token:refresh:${config.mode}`;

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
    // Fold Nomba's body envelope into `ok` — see NombaResponse.ok.
    const envelope = (data ?? {}) as {
      status?: unknown;
      code?: unknown;
      message?: unknown;
      description?: unknown;
    };
    const providerCode = typeof envelope.code === 'string' ? envelope.code : undefined;
    const providerMessage =
      typeof envelope.message === 'string'
        ? envelope.message
        : typeof envelope.description === 'string'
          ? envelope.description
          : undefined;

    // ⚠ Nomba overloads `status:false` for TWO opposite meanings:
    //   REJECTED  — `{code:"400", status:false, message:"Account name must not…"}`
    //   ACCEPTED, IN FLIGHT — a payout answers
    //     `{code:"201", description:"PROCESSING", status:false,
    //       message:"Unable to process response, please rely on web hook"}`
    //     …for a transfer that IS being sent and WILL settle.
    // Collapsing both to "failed" is a double-spend: the payout path reverses the
    // merchant's ledger while Nomba is actually moving the money, so they receive
    // the naira AND keep the balance. `pending` is NOT `failed` — never conflate
    // them. Callers must branch on `providerCode`/`pending`, not on `ok` alone.
    const pending = isPendingEnvelope(providerCode, providerMessage, envelope.description);
    const bodySaysFailed = envelope.status === false && !pending;

    return {
      status: res.status,
      ok: res.ok && !bodySaysFailed,
      pending,
      data: data as T,
      ...(providerCode !== undefined && { providerCode }),
      ...(providerMessage !== undefined && { providerMessage }),
    };
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
    // Nomba reports the amount as a NAIRA decimal (live: field `amount`, e.g. "100.0";
    // older shapes used `transactionAmount`). Convert to our integer kobo (D.1).
    const rawAmount = txn.amount ?? txn.transactionAmount ?? data.amount;
    return {
      found: res.ok,
      status,
      amount: rawAmount != null ? nombaAmountToKobo(rawAmount as string | number) : undefined,
      succeeded,
      gatewayMessage:
        typeof txn.gatewayMessage === 'string'
          ? txn.gatewayMessage
          : typeof data.gatewayMessage === 'string'
            ? data.gatewayMessage
            : undefined,
      // The Nomba transaction id (live field `id`, e.g. "API-VACT_TRA-…"; older `transactionId`).
      providerReference:
        typeof txn.id === 'string'
          ? txn.id
          : typeof txn.transactionId === 'string'
            ? txn.transactionId
            : undefined,
    };
  };

  return { getToken, request, requeryTransaction };
}
