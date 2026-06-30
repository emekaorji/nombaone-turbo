/**
 * ── Nomba endpoint surface (ADR) ────────────────────────────────────────────
 *
 * One place for every Nomba path, so corrections touch a single file, not every
 * adapter. Paths are root-relative; the client joins them onto `NOMBA_BASE_URL`
 * (the host, e.g. `https://sandbox.nomba.com`), so the `/v1` version prefix lives
 * HERE, not in the env.
 *
 * ── T0 sandbox confirmation (2026-06-30, against https://sandbox.nomba.com) ───
 * The keys were provided and these were probed live:
 *   ✅ EVERY path needs the `/v1` prefix — the previous unversioned paths all
 *      404'd. (The single highest-impact correction; the adapters would have
 *      404'd in production. Fake rails never caught it.)
 *   ✅ CONFIRMED-on-sandbox (token-authed, non-404): tokenIssue, checkoutOrder,
 *      tokenizedCardCharge, tokenizedCard data (list/delete), virtualAccountCreate
 *      (`/v1/accounts/virtual`), transactionRequery (`/v1/transactions/accounts/single`),
 *      bankLookup.
 *   ✅ OAuth: `/v1/auth/token/issue` mints a bearer with an ISO `data.expiresAt`.
 *   ⚠ DIRECT-DEBIT (mandate rail): docs confirm `POST /v1/direct-debits` + the
 *      sub-paths below, but ALL of them 404 on the sandbox host even with a full
 *      body → the mandate rail is NOT enabled for this sandbox account/host. Paths
 *      are set to the docs surface; CONFIRM against an enabled account before the
 *      mandate rail is trusted live.
 *   ⚠ transactionRequery QUERY PARAM (`transactionRef` vs `sessionId`) and the
 *      reconciliation field still need pinning (the order create echoed a Nomba
 *      `orderReference`, not ours — docs say merchantReference/orderReference is
 *      merchant-controlled; confirm which field the requery joins on).
 *   ⚠ bankTransfer (`/v1/transfers/bank`) unverified (payouts are 08; the public
 *      `/v2` guess was dropped — no `/v2` surface seen).
 *   ⚠ money unit: team-confirmed kobo (2026-06-30); the sandbox checkout is a JS
 *      SPA so a visual round-trip re-confirm was not possible — a completed-payment
 *      requery is the remaining proof.
 * A CI grep for `⚠ UNCONFIRMED` gates the `live` ring.
 */
export const NOMBA_ENDPOINTS = {
  // Auth — confirmed live (token mints; ISO expiresAt).
  tokenIssue: '/v1/auth/token/issue',
  tokenRefresh: '/v1/auth/token/refresh',

  // Checkout + card tokenization — confirmed live on sandbox.
  checkoutOrder: '/v1/checkout/order',
  tokenizedCardCharge: '/v1/checkout/tokenized-card-payment',
  tokenizedCardList: '/v1/checkout/tokenized-card-data',
  tokenizedCardDelete: '/v1/checkout/tokenized-card-data',

  // Direct-debit mandates — docs-confirmed paths; ⚠ UNCONFIRMED on sandbox (the
  // whole `/v1/direct-debits` surface 404s here — rail not enabled for this account).
  mandateCreate: '/v1/direct-debits', // ⚠ UNCONFIRMED (sandbox 404; docs OK)
  mandateDebit: '/v1/direct-debits/debit-mandate', // ⚠ UNCONFIRMED (sandbox 404; docs OK)
  mandateStatus: '/v1/direct-debits/check-direct-debit-status', // ⚠ UNCONFIRMED
  mandateUpdateStatus: '/v1/direct-debits/update-direct-debit-status', // ⚠ UNCONFIRMED

  // Virtual accounts (transfer/push rail) — confirmed live on sandbox.
  virtualAccountCreate: '/v1/accounts/virtual',

  // Verification / reconciliation — path confirmed live; ⚠ query param + join field.
  transactionRequery: '/v1/transactions/accounts/single', // ⚠ UNCONFIRMED (param: transactionRef?)

  // Payouts (settlement/refunds in 08) — lookup confirmed live; transfer ⚠.
  bankLookup: '/v1/transfers/bank/lookup',
  bankTransfer: '/v1/transfers/bank', // ⚠ UNCONFIRMED (payouts are 08)
} as const;

export type NombaEndpointKey = keyof typeof NOMBA_ENDPOINTS;
