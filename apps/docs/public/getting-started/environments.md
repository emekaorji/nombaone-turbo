---
title: "Environments"
type: tutorial
summary: "nombaone has two environments — test and live. Your secret key's prefix pins every request to exactly one of them."
canonical: https://docs.nombaone.xyz/getting-started/environments
---

# Environments

nombaone has exactly two environments:

| Environment | Key prefix | Purpose |
|---|---|---|
| `test` | `nbo_test_` | A sandbox with isolated data. Safe to experiment; nothing here touches real money. |
| `live` | `nbo_live_` | Production. Real organizations, real money movement. |

## One key, one environment

You do not pass an environment parameter. The environment is **embedded in the
secret key** and verified on every request: an `nbo_test_` key reaches only test
data, and an `nbo_live_` key reaches only live data. The two are fully isolated
— separate data, separate balances, separate webhook endpoints.

This is why you can hold both keys at once: a request can never cross from one
environment into the other, no matter how it is constructed.

```bash
# Test — sandbox data only
curl https://sandbox.api.nombaone.xyz/v1/examples \
  -H "Authorization: Bearer nbo_test_…"

# Live — production data only
curl https://api.nombaone.xyz/v1/examples \
  -H "Authorization: Bearer nbo_live_…"
```

> **Resources carry their environment**
>
> Every resource the API returns includes its `environment` field, so you can
> always confirm which side a record belongs to.

## Working across environments

A clean integration keeps the two strictly separate:

- **Configuration** — load the key from an environment variable
(`NOMBAONE_SECRET_KEY`) so the same code runs against test in staging and live
in production with no code change.
- **Data** — test references and live references are distinct; an id minted in
test will never resolve in live.
- **Webhooks** — register endpoints per environment. A test event is delivered
only to your test endpoint.

> **Promote deliberately**
>
> Build and verify against `test`, then swap the key to `nbo_live_` to go live.
> Re-run your end-to-end checks after the swap: live has its own data, its own
> balances, and moves real money.
