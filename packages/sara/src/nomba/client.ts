
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
/**
 * Nomba's body `code` values that mean SUCCESS.
 *
 * `"00"` is Nomba's own success code and is the ONLY thing it is consistent about — its
 * `status` boolean is false even on a successful sandbox checkout order. `"200"` is
 * accepted defensively (some surfaces echo the HTTP status here).
 */
const SUCCESS_CODES = new Set(['00', '200']);

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

/** A card Nomba has tokenized and will let us charge again. */
export interface TokenizedCard {
  tokenKey: string;
  cardType?: string;
  /** Masked PAN, e.g. `454924**** ****3962`. */
  cardPan?: string;
  /** `MMYY`, e.g. `3008` = August 2030. */
  tokenExpiryDate?: string;
  customerEmail?: string;
}

export interface NombaClient {
  getToken(): Promise<string>;
  request<T = unknown>(req: NombaRequest): Promise<NombaResponse<T>>;
  requeryTransaction(ctx: DomainContext, input: { reference: string }): Promise<RequeryResult>;
  /**
   * The cards Nomba holds for a customer, PULLED rather than waited for.
   *
   * Tokenization normally reaches us on the `payment_success` webhook. When no webhook arrives —
   * and on a live account that has happened for every single payment — the token is simply lost,
   * so a `charge_automatically` subscription ends up with nothing to charge and every renewal
   * degrades into "please pay by hand". Nomba will hand the token over if we ask, so we ask.
   */
  listTokenizedCards(
    ctx: DomainContext,
    input: { customerEmail: string }
  ): Promise<TokenizedCard[]>;
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

    // ⚠ `status` IS NOT A RELIABLE SUCCESS FLAG. `code` is.
    //
    // Nomba's `status` boolean is false on outcomes that are unambiguously fine.
    // Live-probed on the SANDBOX checkout order — a request that succeeded and returned a
    // working payment link:
    //
    //   {"code":"00","description":"checkout order created successful",
    //    "status":false,                       ← on a SUCCESS
    //    "data":{"checkoutLink":"https://pay.nomba.com/sandbox/QMojVV…"}}
    //
    // An earlier version of this trusted `status:false` to mean failure. That demoted
    // every sandbox checkout order to `!ok`, so `mintInvoiceCheckoutLink` returned null
    // and a subscriber was handed NO link to pay on — the whole storefront entry, dead.
    //
    // So branch on `code`, which Nomba is consistent about:
    //   "00"  → success
    //   "201" → ACCEPTED, IN FLIGHT (a payout being sent; the outcome arrives by webhook).
    //           `pending` is NOT `failed`: reversing here while the money leaves would pay
    //           the merchant twice.
    //   else  → a real failure ("400" validation, "500", "403"…).
    //
    // `status` is consulted ONLY when there is no `code` at all, and even then a
    // `status:false` alongside a success `code` never wins.
    const pending = isPendingEnvelope(providerCode, providerMessage, envelope.description);

    const bodySaysFailed = pending
      ? false // accepted and in flight — not a failure
      : providerCode !== undefined
        ? !SUCCESS_CODES.has(providerCode) // trust `code`, ignore the unreliable `status`
        : envelope.status === false; // no code at all ⇒ fall back to `status`

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
    // 🔴 THE QUERY PARAM IS `orderReference`, NOT `transactionRef`.
    //
    // Pinned against LIVE on 2026-07-14 with a real ₦100 card payment. Nomba's answer to the same
    // transaction, by param:
    //   ?transactionRef=<our invoice ref>   → 404 {"description":"Transaction matching query not found"}
    //   ?orderReference=<our invoice ref>   → 200 {"code":"00","data":{"status":"SUCCESS","amount":"100.0",…}}
    //
    // We were sending `transactionRef`, so requery answered "no such transaction" for EVERY payment
    // Nomba had actually taken. That matters far more than it looks: requery is the safety net for a
    // webhook that never arrives (and on this account, none do). With the wrong param the net had a
    // hole the exact size of itself — a customer could be charged and the engine would insist,
    // forever and with total confidence, that no payment existed.
    //
    // `reference` here is OUR merchant reference (the invoice reference we hand Nomba as the order's
    // merchant ref at checkout), which is what `orderReference` matches on.
    const res = await request<Record<string, unknown>>({
      method: 'GET',
      endpoint: NOMBA_ENDPOINTS.transactionRequery,
      query: { orderReference: input.reference },
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

  const listTokenizedCards = async (
    _ctx: DomainContext,
    input: { customerEmail: string }
  ): Promise<TokenizedCard[]> => {
    // `?customerEmail=` filters server-side — verified on LIVE 2026-07-14: unfiltered the list is
    // every card on the account (paginated), filtered it returns exactly the one customer's cards.
    // Never fetch unfiltered and match locally: page 1 is not the whole list, so a customer whose
    // card sits on page 2 would silently look card-less.
    const res = await request<Record<string, unknown>>({
      method: 'GET',
      endpoint: NOMBA_ENDPOINTS.tokenizedCardList,
      query: { customerEmail: input.customerEmail },
      idempotencyRef: `tokens-${input.customerEmail}`,
    });
    if (!res.ok) return [];

    const data = ((res.data as Record<string, unknown>)?.data ?? {}) as Record<string, unknown>;
    const list = data.tokenizedCardDataList;
    if (!Array.isArray(list)) return [];

    return list
      .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      .map((row) => ({
        tokenKey: String(row.tokenKey ?? ''),
        ...(typeof row.cardType === 'string' && { cardType: row.cardType }),
        ...(typeof row.cardPan === 'string' && { cardPan: row.cardPan }),
        ...(typeof row.tokenExpiryDate === 'string' && { tokenExpiryDate: row.tokenExpiryDate }),
        ...(typeof row.customerEmail === 'string' && { customerEmail: row.customerEmail }),
      }))
      .filter((card) => card.tokenKey.length > 0);
  };

  return { getToken, request, requeryTransaction, listTokenizedCards };
}
