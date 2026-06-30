/**
 * ── Nomba endpoint surface (ADR) ────────────────────────────────────────────
 *
 * One place for every Nomba path, so T0's sandbox corrections touch a single
 * file, not every adapter. Defaults below favour the PUBLIC-docs paths (more
 * likely current) where they diverge from the team doc; each divergence is marked
 * `⚠ UNCONFIRMED` and MUST be pinned against a live sandbox in T0 before going
 * live. A CI grep for `⚠ UNCONFIRMED` is the gate: an unconfirmed path cannot
 * silently ship to the `live` ring.
 *
 * Divergence history (team doc → public docs → resolution):
 *   • tokenized-card charge:  /tokenized-card/charge  →  /checkout/tokenized-card-payment   ⚠
 *   • tokenized-card DELETE:  /tokenized-card/{id}     →  /checkout/tokenized-card-data       ⚠
 *   • mandate create/debit:   /mandates/*              →  /direct-debits/*                    ⚠
 *   • transfer (payout):      /transfers/bank          →  /v2/transfers/bank                  ⚠
 *   • txn requery:            /transactions/{ref}      →  /transactions/accounts/single?...   ⚠
 *   • money unit:             kobo (team-confirmed 2026-06-30) — re-confirm one round-trip    ⚠
 */
export const NOMBA_ENDPOINTS = {
  // Auth (confirmed against public docs).
  tokenIssue: '/auth/token/issue',
  tokenRefresh: '/auth/token/refresh',

  // Checkout + card tokenization.
  checkoutOrder: '/checkout/order',
  tokenizedCardCharge: '/checkout/tokenized-card-payment', // ⚠ UNCONFIRMED (team: /tokenized-card/charge)
  tokenizedCardList: '/checkout/tokenized-card-data', // ⚠ UNCONFIRMED
  tokenizedCardDelete: '/checkout/tokenized-card-data', // ⚠ UNCONFIRMED (team: /tokenized-card/{id})

  // Direct-debit mandates.
  mandateCreate: '/direct-debits', // ⚠ UNCONFIRMED (team: /mandates/create)
  mandateDebit: '/direct-debits/debit-mandate', // ⚠ UNCONFIRMED (team: /mandates/{id}/debit)
  mandateStatus: '/direct-debits/status', // ⚠ UNCONFIRMED
  mandateUpdateStatus: '/direct-debits/update-status', // ⚠ UNCONFIRMED (team: DELETE /mandates/{id})

  // Virtual accounts (transfer/push rail).
  virtualAccountCreate: '/accounts/virtual',

  // Verification / reconciliation.
  transactionRequery: '/transactions/accounts/single', // ⚠ UNCONFIRMED (team: /transactions/{merchantTxRef})

  // Payouts (used by settlement/refunds in 08).
  bankLookup: '/transfers/bank/lookup',
  bankTransfer: '/v2/transfers/bank', // ⚠ UNCONFIRMED (team: /transfers/bank)
} as const;

export type NombaEndpointKey = keyof typeof NOMBA_ENDPOINTS;
