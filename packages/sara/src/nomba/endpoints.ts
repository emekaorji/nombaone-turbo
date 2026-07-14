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
 *   ✅ transactionRequery QUERY PARAM — PINNED on LIVE 2026-07-14: it is `orderReference`
 *      (matching OUR merchant reference). `transactionRef` returns 404 "Transaction matching
 *      query not found" for a transaction Nomba has definitely taken. It joins on the merchant-
 *      controlled reference we send at order-create, so `reference` = our invoice reference.
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

  // Direct-debit mandates — PATHS CONFIRMED live against production (api.nomba.com,
  // 2026-06-30, T0 prod probe): all exist + accept the documented bodies (sandbox
  // 404s the whole surface — rail disabled there, confirmed by the Slack thread).
  // The llms.txt doc-slugs (check-/update-direct-debit-status, list-…) are doc-page
  // names, NOT routes — the probe proved the slugs hit the `/{mandateId}` catch-all.
  // ⚠ the full create→consent→ACTIVE→debit FLOW still needs one live mandate run.
  mandateCreate: '/v1/direct-debits', // POST — confirmed (422 on empty body)
  mandateDebit: '/v1/direct-debits/debit-mandate', // POST {mandateId, amount, merchantReference}
  mandateStatus: '/v1/direct-debits/status', // GET ?mandateId=<id> — reads the query param
  mandateGet: '/v1/direct-debits', // GET /v1/direct-debits/{mandateId}
  mandateList: '/v1/direct-debits/mandates', // GET — confirmed 200
  mandateUpdateStatus: '/v1/direct-debits/update-status', // PUT {mandateId, status}

  // Virtual accounts (transfer/push rail) — confirmed live on sandbox.
  virtualAccountCreate: '/v1/accounts/virtual',

  // Accounts — the platform's own account. There is deliberately NO sub-account
  // family here: live-probed 2026-07-13, `POST /v1/accounts/sub-accounts` 500s for
  // every body shape (including `{}`, and including a bogus sibling path — so it is
  // a catch-all, not payload rejection) and `GET /v1/accounts/sub-accounts` 403s
  // "Forbidden". Nomba will not mint a merchant an account, so we do not model one:
  // a merchant's money is a balance in OUR ledger (settlement/accounts.ts).
  accountsBalance: '/v1/accounts/balance', // GET — the platform's real naira balance (reconciler).

  // Verification / reconciliation — path confirmed live; ⚠ query param + join field.
  transactionRequery: '/v1/transactions/accounts/single', // ⚠ UNCONFIRMED (param: transactionRef?)

  // ── Payouts. This is how a merchant's money leaves us. All three live-probed
  // 2026-07-13 on api.nomba.com and ENTITLED on the parent account (no 403).
  /**
   * NIBSS name enquiry → `{accountName, accountNumber}`.
   * ⚠ POST with a BODY. As a `GET …?accountNumber=&bankCode=` it answers **500** —
   * which is how every payout used to die before it ever reached the transfer.
   */
  bankLookup: '/v1/transfers/bank/lookup',
  /** The bank list (code + name). Feeds the console's bank picker so no one hand-types a NIBSS code. */
  banks: '/v1/transfers/banks',
  /**
   * Outbound bank transfer. Required body (from its own 422):
   *   `{ amount, bankCode, accountNumber, accountName, merchantTxRef }`
   * `merchantTxRef` is BOTH our reference and Nomba's idempotency key — send the same
   * one on a retry or you send the money twice.
   * ⚠ Answers `{code:"201", description:"PROCESSING", status:false}` for a transfer
   * that IS in flight — see `NombaResponse.pending`. `status:false` is NOT a failure here.
   */
  bankTransfer: '/v1/transfers/bank',
} as const;

export type NombaEndpointKey = keyof typeof NOMBA_ENDPOINTS;
