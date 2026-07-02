# Nomba live/sandbox test harness

Reusable, re-runnable scripts that exercise the real Nomba integration end-to-end
against a live or sandbox account. These are **operator tools**, not part of the app
build — run them by hand with `npx tsx scripts/<name>.ts` from `apps/api/`.

Every script reads config from the process env via `src/shared/config/env` (dotenv
loads `.env`). To point at a specific account/env:

- **Live** — put live keys in `apps/api/.env` (the default `.env` dotenv loads).
- **Test/sandbox** — either put sandbox keys in `.env`, or override the `NOMBA_*`
  vars inline (dotenv's default `override:false` keeps inline values):
  `NOMBA_BASE_URL=https://sandbox.nomba.com NOMBA_CLIENT_ID=… … npx tsx scripts/nomba-checkout.ts`
  (a shell-safe `export …` snippet outside the repo is easiest — the DB URL's `&`
  breaks a naive `source .env.development`).

> ⚠ **Findings gate.** Read `workbench/nomba-findings.md` first. In particular: Nomba
> **sandbox delivers no transaction webhooks** and 404s direct-debit — the webhook /
> token / mandate flows are **live-only**. Amounts on the wire are **naira decimals**,
> not kobo. Card recharge is **bank-gated** (OTP/3DS).

## Rails — create/charge

| Script | Purpose |
|---|---|
| `nomba-checkout.ts [amountKobo] [--tokenize]` | Create a hosted checkout (optionally tokenizing). Prints the pay link. |
| `seed-invoice.ts [amountKobo] [--tokenize]` | Seed org+customer+finalized invoice in the DB, then a checkout whose `orderReference == invoice.reference` (so the webhook settles THAT invoice). |
| `nomba-recharge.ts <tokenKey> <email> [amountKobo]` | Merchant-initiated tokenized-card recharge of a saved token. |
| `raw-charge.ts [tokenKey] [email]` | Same, but dumps the FULL raw response (captures `orderId` + the OTP-required message). |
| `renew-charge.ts` | Prove automatic card RENEWAL via the card rail (no customer present). |
| `create-checkout.ts` | Minimal live ₦100 tokenizing checkout scoped to our sub-account. |

## OTP (tokenized-card step-up)

| Script | Purpose |
|---|---|
| `submit-otp.ts <orderRef> <transactionId> <otp>` | Submit an OTP to complete a charge. |
| `otp-combos.ts <ourRef> <orderId> <otp>` | Try every (orderReference, transactionId) combo for the OTP submit. |

## Probes / discovery

| Script | Purpose |
|---|---|
| `mandate-probe.ts` | Probe direct-debit (NIBSS mandate) provisioning (`/v1/direct-debits/*`). |
| `tx-inspect.ts [orderRef]` | Dump the sub-account's recent transactions (all id fields); full-dump one ref. |
| `tx-list.ts` | Dump the full recent transactions for our sub-account. |
| `sbx-verify.ts <orderRef> <orderId>` | Try every read path to retrieve a completed order's `tokenizedCardData`/token. |
| `diag.ts` | Diagnose a failed/pending checkout (order-status + requery). |
| `probe.ts` | Probe for a transaction-list + webhook-config endpoint. |

## Webhooks / signature

| Script | Purpose |
|---|---|
| `webhook-receiver.ts` | Receiver-only server (mounts ONLY the inbound webhook edge) for a byte-confirm run. |
| `crack-sig.ts` | Byte-confirm the signature scheme against a REAL captured webhook. |
| `replay.ts` | Replay a captured webhook against the (debug-off) receiver to prove `verify.ts` accepts/rejects. |
| `forge-failed.ts` | Test `payment_failed` handling with a genuinely-signed (real key) webhook. |

## Invoice / settlement inspection

| Script | Purpose |
|---|---|
| `check-invoice.ts <invoiceRef>` | Confirm an invoice settled (paidAt, amountPaid, ledger link, events). |
| `inspect-inv.ts [ref]` | Show invoice origin + paid state (hosted-checkout vs tokenized recharge). |

## End-to-end live recipe (the flow we ran)

1. **App + tunnel up.** `npm run dev` (port 8000) and `npm run tunnel` (cloudflared →
   `https://tunnel.nombaone.xyz` → `localhost:8000`). Ensure the tunnel URL is
   registered as the webhook on the Nomba account (dashboard; **live only** — sandbox
   won't deliver). For the first webhook, set `NOMBA_WEBHOOK_DEBUG=true` to log the raw
   body + candidate signatures without rejecting; turn it OFF to prove accept/reject.
2. **Card (hosted):** `npx tsx scripts/seed-invoice.ts 10000 --tokenize` → pay the link
   → the `payment_success` webhook settles the invoice; `check-invoice.ts <ref>`.
3. **Token capture:** the tokenizing webhook carries `tokenizedCardData.tokenKey`
   (also persisted to `payment_methods.token_key`). Grab it from the app log.
4. **Recharge:** `npx tsx scripts/nomba-recharge.ts <tokenKey> <email> 10000` → inspect
   the sync response (silent-approve / OTP-required / decline — all three are handled by
   the card rail, `packages/sara/src/rails/card.ts`).
5. **payment_failed:** `forge-failed.ts` (genuinely signed) → requery sees the real
   `PAYMENT_FAILED` → invoice stays open.
6. **Direct debit (live-only):** `mandate-probe.ts` to confirm provisioning, then create
   a mandate (`POST /v1/mandates`), consent, and let the mandate-activation sweep poll
   it to ACTIVE before a debit.
