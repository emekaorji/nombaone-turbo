# T0 live webhook + sandbox findings (2026-07-01)

Ran the live webhook byte-confirm against `sandbox.nomba.com` with the tunnel
(`tunnel.nombaone.xyz → localhost:8000`) up and `NOMBA_WEBHOOK_DEBUG=true`. Drove a real
hosted-checkout card payment end-to-end via Playwright. Summary: **our side is fully
ready; the sandbox does not exercise the async paths (webhook / callback / requery), so
the signature byte-confirm cannot be completed on sandbox.** Several important
discrepancies surfaced.

## ✅ What we confirmed

- **Card tokenize flow works** (hosted checkout SPA): test card `5434621074252808`, any
  future expiry (used `12/30`), CVV `123`, **PIN `0000`**, **OTP `000000`** → the page
  shows *"Your Payment was successful. Your transaction is complete."* (Sandbox PIN set:
  1234/0000/1111/5555; OTP set: 123456/000000/111111/555555.)
- **Our inbound edge is correct end-to-end.** A sample `payment_success` POST through the
  tunnel to `POST /webhooks/v1/nomba` returned `200 {received:true}` and the debug
  controller logged all four `[webhook][T0]` lines (headers, raw body b64, the
  `nomba-signature` header, and all 6 candidate signatures). Correlation logging (item 5)
  is live: every webhook line carries the same `correlationId`.
- **Verification path works (debug off).** A signature computed with our active scheme
  (`field_string_base64`) is **accepted (200)**; a bogus signature is **rejected (401)**.

## ⚠ Blockers / discrepancies (need a webhook-enabled account or Nomba confirmation)

1. **Sandbox delivers NO webhooks.** A genuinely successful ₦100 card payment produced
   **zero** inbound POSTs to our endpoint (verified: only our own curl sample ever hit the
   controller; no `okhttp`/`Go-http` client, no `POST /webhooks` in the access log). So the
   **exact `nomba-signature` scheme cannot be byte-confirmed here** — there is no real
   signed webhook to capture. Current default stays `field_string_base64` (colon-joined
   fields, HMAC-SHA256, base64), unconfirmed against a real sample.
2. **Money unit on `POST /v1/checkout/order` is NAIRA, not kobo.** We sent `order.amount =
   100` (intending 100 kobo = ₦1.00); the checkout page displayed **₦100**. This is the
   visual round-trip that was missing at T0, and it **contradicts the "integer kobo
   everywhere" assumption for this endpoint.** The requery stub likewise reports `amount:
   "4000.0"` — a **decimal string in naira**. 🔴 **Top priority to resolve before live:**
   confirm the unit the CHARGE endpoint (`POST /v1/checkout/tokenized-card-payment`, used on
   every renewal + dunning retry) expects. If it is naira while the billing engine sends
   integer kobo (e.g. `500000` for ₦5,000), every charge is **100× too large**.
3. **Nomba mints its own `orderReference` (a UUID) and does not echo ours.** We sent
   `orderReference = nbo…livewebhooktest`; the create response returned
   `data.orderReference = "36c62419-…"` (a Nomba UUID). So the reconciliation/inbound join
   field is NOT `orderReference`. Which field carries OUR reference (`merchantTxRef` /
   `merchantReference`?) can only be pinned from a real webhook/requery — unavailable on
   sandbox. (`extractOurReference` + the reconcile join depend on this.)
4. **Sandbox `transactionRequery` is a canned stub.** `GET /v1/transactions/accounts/single
   ?transactionRef=<X>` returns the **same fixed 2023 "POS-PHCN" electricity transaction for
   every reference** (ignores the param). So the requery join field + real amount cannot be
   confirmed on sandbox. It also exposed a **client bug**: the response transaction field is
   `amount` (decimal string), but `requeryTransaction` reads `txn.transactionAmount` (number)
   → it would return `amount: undefined` for the real shape. Fix once the real card-charge
   requery shape is confirmed (don't blind-fix off the stub).
5. **`callbackUrl` is ignored on sandbox.** After a successful payment the browser landed on
   `nomba.com` (marketing home), not our `callbackUrl` — so no redirect params to read.
6. **Nomba sub-account control (the escrow assumption)** — NOT confirmable via sandbox.
   Still needs Nomba-team confirmation that the parent can hold tenant funds, gate
   withdrawals, sweep, and pull back for refunds (see `apps/console/escrow-withdrawal-lock.md`).

## Environment note

The local dev DB is a few migrations behind: the lifecycle-sweep and webhook-maintenance
crons fail with missing columns (`subscriptions.trial_will_end_notified_at`,
`webhook_deliveries`). Run `db:migrate` against the dev DB before the next live run. (Did
not touch it here — migrations should be applied deliberately, not mid-test.)

## Recommendation

The signature byte-confirm and the reconciliation-join/money-unit confirmations all need a
**webhook-enabled Nomba account** (production, or a sandbox account with dashboard/webhook
delivery enabled). Our receiving + verification code is ready and correct; flip
`NOMBA_WEBHOOK_DEBUG=true`, trigger one real payment on a webhook-enabled account, and the
`[webhook][T0]` candidates pin the scheme in one shot. Until then, treat items 1–4 above as
the open ⚠ gating the `live` ring — **the naira-vs-kobo unit (#2) is the highest-risk.**
