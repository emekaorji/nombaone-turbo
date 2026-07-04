---
title: "Go quickstart"
type: tutorial
summary: "Reach a real 201 with Go — create your first plan on the Nomba One sandbox in a few lines."
canonical: https://docs.nombaone.xyz/getting-started/quickstart/go
---

# Go quickstart

Create your first plan on the Nomba One sandbox with **Go**. This is a real
call that returns a `201`; only the key (`nbo_test_…`) and the host change when
you go live.

## 1 · Get a test key

Grab a `nbo_test_…` key — see [authentication](/getting-started/authentication).
Standard library only — `net/http`, no dependency. Read the key from `os.Getenv("NOMBAONE_SECRET_KEY")`.

## 2 · Create a plan

A `201` comes back with the plan's `data.id` — its public reference. Amounts on
its [prices](/guides/create-plans-and-prices) are **integer kobo**.

## Next

- **[Your first subscription](/getting-started/your-first-subscription)** — 
The full plan → price → customer → subscription flow to a live 201.
- **[Authentication](/getting-started/authentication)** — 
The secret-key rules and how the prefix pins the environment.
