---
title: "Nomba One"
type: reference
summary: "Turn moving money once into running a subscription business — plans, cycles, proration, dunning, reconciliation, and settlement over every rail, built for how money actually moves in Nigeria."
canonical: https://docs.nombaone.xyz/
---

# Nomba One

Nomba ships the primitives that move money. **Nomba One** is the layer that turns
moving money _once_ into running a subscription business — plans, cycles, proration,
dunning, reconciliation, and settlement — so no team rebuilds it again. It runs over
every rail (card, direct debit, transfer, crypto) and is built for how money actually
moves here: thin balances, transfer-first, where a failed charge usually means
_"not yet,"_ not _"no."_

These docs are **runnable and honest**. You can watch a subscription bill, fail on a
thin balance, and recover through dunning — against a real sandbox, in your own
devtools — before you write a line. Every error tells you exactly what to do, and the
hard parts (dunning, reconciliation, the double-charge trap) are documented in the open.

> **Money is integer kobo**
>
> Every amount in the API is an integer in **kobo** (₦1 = 100 kobo). `250000` is
> ₦2,500.00 — no floats, no decimal strings. Every money field is named `…InKobo`
> so the unit is impossible to mistake.

## Start here

- **[Quickstart](/getting-started/quickstart)** — 
Get a sandbox key and reach your first real subscription in minutes.
- **[Authentication](/getting-started/authentication)** — 
The per-organization `nbo_sandbox_` / `nbo_live_` secret key, and how it works.
- **[Environments](/getting-started/environments)** — 
Sandbox vs live, and how a key pins every request to one mode.

## Built to be verified, not trusted

The rest of these docs are on the way — the full guides, the interactive subscription
simulator, the error reference, and the honest **hard parts** — each one runnable
against the sandbox so you can prove it works rather than take our word for it. Start
with the quickstart above; you will hit a real `201` before you commit to anything.
