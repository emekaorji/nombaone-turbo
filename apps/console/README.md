# Console (`@nombaone/console`)

The **merchant dashboard** for Nomba One — a Next.js 16 App-Router app where an organization manages
its account: plans, prices, customers, subscriptions, invoices, coupons/credits, settlements, webhooks,
API keys, and billing settings.

> **Status: clean skeleton.** This app is being built **from scratch**, 1:1 to the Pencil design
> (`workbench/NOMBAONE.pen`) and the plan docs (`workbench/apps/console/console-plan-00..10.md`).
> The previous contents were a ported boilerplate template and have been removed. Only framework/build
> config + workspace wiring remain.

## Topology (post-refactor)

- **Billing data:** read from Postgres directly via `@nombaone/core-db/pool` (server-only), or by calling
  `apps/api`. The console **never imports** the api-owned money engine (`apps/api/src/shared/services/*`) —
  a package/app boundary enforced by `pnpm check:boundaries`.
- **Auth:** the console **owns** its merchant/org auth in `src/lib/auth/`, built on `@nombaone/sara/auth`
  **primitives** (`hashPassword`, `verifyTotp`, `can`, …). Sessions are opaque, DB-backed, httpOnly-cookie.
- **Infra from `@nombaone/sara`:** `context`, `api-keys`, `webhooks`, `org`, `reference`, `crypto`, `money`,
  `pagination`, `idempotency`, `ledger`, `events`, `rails`.
- **UI:** primitives + design tokens come from `@nombaone/ui`. Money is integer kobo (render naira /100).

## Scripts

```bash
pnpm -F @nombaone/console dev          # http://localhost:8010
pnpm -F @nombaone/console build        # production build
pnpm -F @nombaone/console type-check   # tsc --noEmit
pnpm -F @nombaone/console lint         # eslint
```

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `INFRA_DATABASE_URL` | ✅ | Postgres (same DB as `apps/api`). |
| `INFRA_PII_ENCRYPTION_KEY` | ✅ | **MUST equal `apps/api`'s key** — PII (e.g. TOTP secrets) written by one app must be readable by the other. |
| `CONSOLE_SESSION_COOKIE_SECRET` | ✅ | Session cookie signing / CSRF secret. |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin. |
| `NEXT_PUBLIC_NOMBAONE_ENV` | ✅ | `local` \| `preview` \| `production` (drives the env pill). |
