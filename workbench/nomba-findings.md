# Nomba integration — live findings

Ground-truth learned from live/sandbox testing (real money). This is the reference the
`apps/api/scripts/` harness re-verifies. Keep it in sync when the account/behaviour changes.

## Money unit — NAIRA on the wire
Nomba amounts are **naira decimal strings**, not kobo. We store integer **kobo**
internally and convert at the boundary (`koboToNombaAmount` / `nombaAmountToKobo`,
`packages/sara/src/nomba/money.ts`). ₦100 = `"100.00"` = 10000 kobo. Sending kobo would
overcharge 100×.

## Webhook signature — byte-confirmed
HMAC-SHA256, header `nomba-signature`, over a **colon-joined field string** ending with
the **`nomba-timestamp` HEADER value** (not `data.transaction.time`). Confirmed
unambiguously by a Nomba *retry*, where the header timestamp ≠ the txn time and only the
header-timestamp variant matched. `verify.ts` threads the header timestamp. Genuine → 200,
tampered/bogus → 401.

## Webhook delivery — sub-account-scoped, LIVE-only
- A `payment_success`/`payment_failed` webhook fires only for payments scoped to our
  **sub-account** (`order.accountId`). Parent-pool payments never webhook.
- **Sandbox delivers NO transaction webhooks** — only a registration verification ping
  (`user-agent: Nomba System`, empty `{}`) and the browser `/callback` GET. Confirmed on
  two separate accounts. The token→recharge→settle flow is therefore **live-only**.
- Verify + requery, never trust the webhook body (E4). Requery keys on
  `data.transaction.transactionId` (our order/merchant ref 404s).

## Card tokenization + recharge — bank-gated
- Tokenization works: a hosted checkout with `tokenizeCard:true` mints a `tokenKey`
  (delivered in the `payment_success` webhook's `tokenizedCardData`, persisted to
  `payment_methods.token_key`).
- A merchant-initiated **recharge is NOT reliably silent** — the issuing bank forces
  OTP/3DS (CBN card-not-present step-up). Live evidence: OPay Verve → OTP required;
  Kuda Visa → decline; both never settled headlessly. The sync response of
  `POST /v1/checkout/tokenized-card-payment` carries the outcome in `data.status` +
  `data.message` ("Approved by Financial Institution" | "Kindly enter the OTP…" |
  "Tokenized charge failed"). There is **no documented headless OTP-submit** for the
  tokenized flow (`checkout-card-otp` belongs to the raw card flow and rejects the
  tokenized charge's ids).
- **Product handling** (built): the card rail returns three outcomes
  (`packages/sara/src/rails/card.ts`); an OTP/3DS reply becomes `requires_action` →
  dunning holds it (`card_update_required`, no blind retry) and emits
  `invoice.action_required` with a fresh hosted-checkout link (`${invoice.reference}-otp`)
  for the customer to complete; that completion webhook settles the same invoice.

## Direct debit (NIBSS mandate) — LIVE-only, provisioning-gated
`/v1/direct-debits/*` **404s in sandbox** (both accounts) — the mandate rail is only
enabled on production. The lifecycle is create → customer consent (₦50 NIBSS validation,
no consent webhook) → poll to ACTIVE (`mandate-activation-sweep`) → silent debit. This is
the reliable **silent recurring** rail (cards are bank-gated); the full live run is
pending live keys + a real bank account.

## Infra notes
- The managed Redis flapped mid-test; a queued webhook re-delivered + settled once it
  recovered — proving the async pipeline is resilient. Use a stable Redis (or local
  `redis-server` for testing).
- Separate DB per environment (test vs live).
