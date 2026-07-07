---
title: "Dunning"
type: reference
summary: "Recovery attempts and state for a past-due subscription: read where recovery stands and the full attempt history. A sub-resource of the subscription."
canonical: https://docs.nombaone.xyz/reference/dunning
---

# Dunning

**Dunning** is the recovery loop that runs when a charge fails. It is a
sub-resource of the [subscription](/reference/subscriptions): read the current
recovery state and the full attempt history. The retry cadence and the card-OTP
branch are explained in [dunning and recovery](/guides/dunning-and-recovery).

## Operations

| Method | Path | What it does |
|---|---|---|
| `GET` | `/v1/subscriptions/{id}/dunning` | Current dunning state: where recovery stands. |
| `GET` | `/v1/subscriptions/{id}/dunning/attempts` | The full history of collection attempts. |

```bash
curl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/dunning \
  -H "Authorization: Bearer nbo_sandbox_…"
```

> **past_due is not canceled**
>
> On a thin balance a failed charge is usually "not yet." Read the dunning state
> before cutting access. Let recovery run. See
> [dunning for thin balances](/concepts/hard-parts/dunning-for-thin-balances).
