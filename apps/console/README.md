# Console (`@nombaone/console`)

The **tenant dashboard** for Nomba One (`console.nombaone.xyz`) — a Next.js 16 App-Router app where a
downstream product team manages its account: **API keys**, **webhook endpoints**, and (in this bare
boilerplate) the deletable **example** resource. You build your real product screens (plans, subscriptions,
invoices, dunning…) alongside these.

**Topology:** the console imports `@nombaone/sara` **directly** (server-only, RSC) and reads/writes Postgres —
it never calls `api.nombaone.xyz`. Auth is an **opaque, DB-backed session** (httpOnly cookie, validated each
request), with optional TOTP modeled as a result value (`TOTP_REQUIRED`), not an error.

## Patterns (the paradigms this app demonstrates)

- **`(auth)` vs `(app)` route groups** as layout + error boundaries.
- **Host-aware DB handles** (`src/lib/db.ts` read, `src/lib/db-tx.ts` interactive-tx): Neon HTTP/edge-pool in
  prod, pooled `pg` for a local Postgres.
- **Org + environment pinned from the session** via `getOrgDomainCtx()` — the client never supplies scope.
- **`withAction()`** standardizing every mutation as `{ ok, code, message, fields? }` + `revalidatePath`.
- **react-hook-form + zodResolver** with the shared `@nombaone/core-contracts/validations` schemas;
  `useTransition` for pending state; root errors in an alert, field errors mapped back per-field.
- **`nuqs`** URL-driven list state; **TanStack Table** for state with a shared `DataTable` for rendering.
- **Secret-shown-once dialog** for API keys; **env switch** (cookie + server re-check + `revalidatePath('/')`).
- **Common kit** (`PageHeader`, `Reference`/`CopyButton`, `StatusPill`, `MoneyAmount` [₦, kobo],
  `ConfirmDialog`, `EmptyState`, `DetailLayout`, `KeyValueList`, `StatCard`) + `sonner` + `next-themes`.

## Screens

`(auth)`: signup (atomic org+owner+session), login, verify-2fa, forgot-password, reset-password.
`(app)`: overview, **developers** (API keys list + create-via-secret-dialog), **developers/webhooks**
(endpoints list + create), **examples** (DataTable + nuqs filters/cursor) and **examples/[reference]** (detail).

## Local development

```bash
# 1. Local Postgres (once)
docker run -d --name nombaone-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nombaone \
  -p 5432:5432 postgres:16-alpine

# 2. Apply migrations
INFRA_DATABASE_URL='postgres://postgres:postgres@localhost:5432/nombaone?sslmode=disable' \
  pnpm -F @nombaone/core-db db:migrate

# 3. cp .env.example .env (fill in), then seed demo data + run
pnpm -F @nombaone/console seed:local     # idempotent: org + API key + example rows
pnpm -F @nombaone/console dev            # http://localhost:8010
```

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `INFRA_DATABASE_URL` | ✅ | Postgres (Neon in prod; `localhost` routes to the pooled driver). |
| `INFRA_PII_ENCRYPTION_KEY` | ✅ | **MUST equal `apps/api`'s key** — PII (e.g. TOTP secrets) written by one app must be readable by the other. |
| `CONSOLE_SESSION_COOKIE_SECRET` | ✅ | Session cookie signing / CSRF secret. |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin (e.g. `https://console.nombaone.xyz`). |
| `NEXT_PUBLIC_NOMBAONE_ENV` | ✅ | `local` \| `preview` \| `production` (drives the env pill). |

No provider keys, no Redis — the console runs neither (it reads the domain directly).

## Security posture

- **Sessions:** opaque token in an `httpOnly` + `Secure` (prod) + `SameSite=Lax` cookie; SHA-256-hashed in the
  DB; validated on every request; instant revoke.
- **CSRF:** every mutation is a Server Action (same-origin enforced by Next.js).
- **RBAC:** `owner > admin > developer > viewer`, enforced server-side in every mutating action.
- **PII** encrypted at rest (`@nombaone/sara/crypto`); never in client bundles or logs.
