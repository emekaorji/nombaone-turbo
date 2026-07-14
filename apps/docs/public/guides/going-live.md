---
title: "Going live"
type: how-to
summary: "The checklist to move from a sandbox key to real money: swap the key and host, re-register webhooks, verify signatures live, and confirm idempotency and the money unit before the first charge."
canonical: https://docs.nombaone.xyz/guides/going-live
---

# Going live

Going live is deliberately small: swap your `nbo_sandbox_` key for `nbo_live_` and
your host from `sandbox.api.nombaone.xyz` to `api.nombaone.xyz`. But the two
modes share nothing (separate data, balances, and webhook endpoints), so
run this checklist before the first real charge.

## The switch

The key prefix pins everything. There is no mode parameter: a `nbo_live_`
key reaches only live, a `nbo_sandbox_` key only sandbox. See
[environments](/getting-started/environments).

```bash
# Sandbox
https://sandbox.api.nombaone.xyz/v1   +   nbo_sandbox_…

# Live
https://api.nombaone.xyz/v1           +   nbo_live_…
```

Load the key from an environment variable so the same code runs against both:

```ts
const base = process.env.NOMBAONE_BASE_URL;   // sandbox vs prod
const key  = process.env.NOMBAONE_API_KEY; // nbo_sandbox_ vs nbo_live_
```

## Pre-launch checklist

### Re-create your plans and prices in live

Sandbox and live data are fully isolated: a plan id minted in sandbox does not
exist in live. Re-create your plans, prices, and coupons with the live key
(or run your seed script pointed at the live base).

### Register live webhook endpoints

Webhooks are per-mode. Register your production endpoint with the live
key and store the new `whsec_…` secret. It is different from your sandbox
secret. Verify signatures against the live secret.

### Confirm signature verification against the live secret

Fire a real event and confirm your handler verifies it: HMAC over the raw
body, constant-time compare. A handler that passed in sandbox with the sandbox
secret will reject live events until you point it at the live secret. See
[handle webhooks](/guides/handle-webhooks).

### Verify the money unit end to end

Every amount is **integer kobo**. Before the first charge, confirm a known
price shows the right naira figure in your UI (`250000` → ₦2,500.00). This is
the one check that prevents a 100× overcharge. See
[money is integer kobo](/concepts/money-is-integer-kobo).

### Set an Idempotency-Key on every money-moving call

Network retries are inevitable in production. Confirm every `POST` that moves
money sends a unique `Idempotency-Key`, so a retry never double-charges.

### Handle the unhappy paths

Confirm your webhook handler branches on `invoice.payment_failed`,
`invoice.action_required`, and `invoice.payment_recovered`, not just
`invoice.paid`. In Nigeria the unhappy paths are the common paths.

> **Live moves real money on the first charge**
>
> There is no dry-run in live. Your first live subscription collects real funds
> over a real rail. Run one end-to-end transaction with a small amount and a real
> method you control before onboarding customers.

## After launch

- **Reconcile.** The [ledger](/concepts/the-ledger) is the source of truth; if a
webhook is missed, re-fetch the resource rather than reconstructing state.
- **Watch dunning.** Real balances are thin: expect `past_due` and let
[dunning](/guides/dunning-and-recovery) recover before cutting access.
- **Payouts.** Settled net accrues to the organization's balance behind an escrow
hold, and sweeps to their bank account daily. Add that bank account before your
first withdrawal — see [payouts](/guides/refunds-payouts-settlement).

- **[Handle webhooks](/guides/handle-webhooks)**: 
The receive → verify → dedupe → act pattern, live.
- **[Dunning and recovery](/guides/dunning-and-recovery)**: 
What "past_due" really means on a thin balance.
