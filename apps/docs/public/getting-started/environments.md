---
title: "Environments"
type: tutorial
summary: "Two independent axes — the deployment environment (development or production) is our infrastructure, and the account mode (sandbox or live) is set by your key's prefix and partitions your data."
canonical: https://docs.nombaone.xyz/getting-started/environments
---

# Environments

Most APIs jam two unrelated ideas into one "test/live" switch. nombaone keeps
them separate, because they answer different questions:

- **Deployment environment** — *where* the code runs. Our infrastructure concern.
- **Account mode** — *which* data a request touches. Yours, chosen by your key.

| Axis | Values | Set by | Do you see it? |
|---|---|---|---|
| Deployment environment | `development` · `production` | Our infrastructure (`INFRA_ENVIRONMENT`) | No — it's ours |
| Account mode | `sandbox` · `live` | Your API key's prefix | Yes — you pick the key |

## Account mode is the one you choose

Mode is **derived from your secret key's prefix** and verified on every request.
You never pass a mode parameter:

- `nbo_sandbox_…` → **sandbox** mode. Isolated data, no real money. Safe to
experiment.
- `nbo_live_…` → **live** mode. Real organizations, real money movement.

The two are fully isolated — separate data, separate balances, separate webhook
endpoints — so you can hold both keys at once and a request can never cross from
one mode into the other.

```bash
# Sandbox — isolated data, no real money
curl https://sandbox.api.nombaone.xyz/v1/examples \
  -H "Authorization: Bearer nbo_sandbox_…"

# Live — real money movement
curl https://api.nombaone.xyz/v1/examples \
  -H "Authorization: Bearer nbo_live_…"
```

> **Resources record their mode**
>
> Every resource the API returns carries the mode it belongs to, so you can
> always confirm which side a record lives on.

## Deployment environment is infrastructure

The deployment environment is *where* nombaone itself runs, and it isn't
something you configure:

- **`development`** is local-only — the machine an engineer runs the service on.
- **`production`** is the single hosted deployment that serves every merchant.

One production deployment serves **both modes at once**. The mode comes from the
key on each request, not from a separate deployment — there is no "sandbox server"
and "live server" to point at. A `sandbox` key works everywhere; a `live` key
only works against the production deployment.

> **Live needs production**
>
> Real money only moves on the `production` deployment. A `live` key is rejected
> anywhere else, so you can't accidentally move funds from a local dev machine.

## Working across modes

A clean integration keeps the two modes strictly separate:

- **Configuration** — load the key from an environment variable
(`NOMBAONE_SECRET_KEY`) so the same code runs against sandbox in staging and
live in production with no code change.
- **Data** — sandbox references and live references are distinct; an id minted in
sandbox will never resolve in live.
- **Webhooks** — register endpoints per mode. A sandbox event is delivered only to
your sandbox endpoint.

> **Promote deliberately**
>
> Build and verify in sandbox, then swap the key to `nbo_live_` to go live. Re-run
> your end-to-end checks after the swap: live has its own data, its own balances,
> and moves real money.

- **[Authentication](/getting-started/authentication)** — 
How the key's prefix pins the mode, and how to keep it safe.
- **[Going live](/guides/going-live)** — 
The checklist to move from a sandbox key to real money.
