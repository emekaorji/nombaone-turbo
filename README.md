# nombaone

A **bare, paradigm-embodying boilerplate** for **Nomba One** — a managed, multi-tenant
**subscription-billing layer** (Stripe-Billing-style) built on top of Nomba's payment rails.

> This repo is a *launchpad*, not the product. It ships the topology, conventions, and the
> cross-cutting **primitives** a billing engine needs — and **none** of the billing product itself.
> You build plans, subscriptions, the lifecycle + dunning state machines, invoices/proration, the
> scheduler policy, the concrete rail adapters, and settlement **on top of this**. The places those
> plug in are marked as doc-commented seams. See `PRODUCT-OVERVIEW.md`.

## What's in the box (the paradigms)

- **Layered topology** (`contracts → db → domain → apps`, deps one direction only), `@nombaone/*` scope.
- **Identity spine**: organizations (tenants), per-org **secret API keys** (SHA-256, env-embedded
  `nbo_test_`/`nbo_live_`, scopes, rotation, timing-safe), console session/signup, operator auth + RBAC.
- **Money engine primitives**: double-entry **ledger** (balanced, atomic, reversals as new txns),
  money as **integer kobo (NGN)**, clamped **fee** engine, **reconciliation** (zero-sum + drift).
- **The rail abstraction**: a `RailAdapter` interface (push/pull-asymmetric) + registry + a `MockRail`.
  The core says "collect for this reference" and never learns a rail's name.
- **Event-driven spine**: an append-only **domain-event log** (audit + outbound source), **outbound
  webhooks** (per-org HMAC, retry, dead-letter), an **inbound** webhook receiver (verify→dedup→ack→enqueue),
  an idempotent, replay-safe **scheduler** skeleton, and BullMQ queues/workers.
- **HTTP framework**: `jsonHandler`/`paginatedHandler` factories, the fixed middleware order
  (auth → rate-limit → scope → idempotency → validate → handler), one response envelope, cursor
  pagination, request-id, internal→public error mapping.
- **Frontends**: console (tenant dashboard), admin (operator panel), docs (MDX engine), checkout
  (subscriber surface) — each with the chrome, common kit, and auth patterns, no product screens.
- **One deletable `example` slice** wired through every layer demonstrating the money-path paradigms
  (reference = idempotency + reconciliation key, ledger post, event emit, rail collect, webhook-confirm).
  See `DELETE-ME-EXAMPLE.md`.

## Apps & packages

| App | Domain | Stack | Port |
|---|---|---|---|
| `apps/api` | api.nombaone.xyz | Express | 9040 |
| `apps/console` | console.nombaone.xyz | Next.js | 9060 |
| `apps/admin` | admin.nombaone.xyz | Next.js | 9020 |
| `apps/docs` | docs.nombaone.xyz | Next.js + MDX | 9070 |
| `apps/checkout` | checkout.nombaone.xyz | Next.js | 9080 |

Packages: `core-contracts` (DTOs + zod + envelope) · `core-db` (Drizzle schema + handles + migrations) ·
`sara` (the domain) · `errors` · `queue` (BullMQ) · `utils` · `docs-db` · `ui` (shadcn) · `toolings/*`.

## Getting started

```bash
pnpm install
cp .env.example .env            # + cp apps/*/.env.example apps/*/.env, then fill in
pnpm db:migrate                 # never `drizzle-kit push` — generate + migrate only
pnpm dev                        # or: pnpm --filter @nombaone/api dev
```

## Scripts

`pnpm dev|build|lint|type-check|test` (turbo) · `pnpm db:generate|db:migrate` (Drizzle).

## Conventions

Environments are pinned per deployment (`test`|`live`, separate DB each). Public **references**
(`nbo{12}{domain}`) are the API `id`; UUIDs stay internal. Money is **integer kobo**, NGN only,
direction carries the sign. Cursor pagination only. One envelope, `meta.requestId` always present.
Reconcile by our own reference, never a provider's id. Migrations via generate + migrate, never push.
