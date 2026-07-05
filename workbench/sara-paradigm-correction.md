# sara paradigm correction — dissolve the domain, make sara primitives-only

## The rule (from @acute/sara, confirmed by the user)
`sara = product-agnostic PRIMITIVES only. Every WORKFLOW lives in the app that owns it.`
- Each `apps/api` module owns its domain in `modules/<m>/services/` (the money-movers).
- A service used by >1 module (still in api) graduates to `apps/api/src/shared/services/`.
- Only genuinely cross-**app** primitives/clients go to `@nombaone/sara`.
- **No `engine` package.** (The rename was reverted — it just re-created the monolith.)

## Locked decisions
- Nomba **client** → `sara/services` (like acute's `anchor`). Nomba **workflows** (rails/collect/settle/requery) → `apps/api`. ✅ user-confirmed.
- **auth**: workflows (signup/login/session/RBAC/password-reset/org-users) → `apps/console` (merchant) — api uses NONE in prod (API keys only); admin already owns operator auth (`admin-auth`). Only crypto PRIMITIVES (hashPassword/verifyPassword/TOTP) → sara. ✅ user-confirmed.

## Classification (measured by cross-app import usage)

### CROSS-APP (7) — split: primitive→sara, workflow→owning app
| module | non-api users | disposition |
|---|---|---|
| `auth` (9) | console, admin | workflows→console; primitives(hash/verify/totp)→sara; admin keeps operator auth |
| `example` (6) | console, checkout | demo resource → keep as a sara sample OR trim; low stakes |
| `webhooks` (3) | console | endpoint-MGMT→console; delivery/signing PRIMITIVES→sara; inbound domain→api |
| `api-keys` (3) | console | verify→api middleware; mint/manage→console; key-string PRIMITIVES→sara |
| `audit` (2) | admin | write=api shared; read=admin; the append helper is a primitive→sara |
| `org` (1) | console | settings-mgmt→console; per-request tenant read→api |
| `money` (1) | admin | PRIMITIVE → sara (clean) |

### api-only (25) — dissolve into apps/api
- **→ module `services/`** (1:1 domain): customers, invoices, subscriptions, subscription-schedules, plans, prices, coupons, discounts, credits, dunning, settlement, payment-methods, proration, tenant-config, events.
- **→ `apps/api/src/shared/services/`** (cross-module in-api): billing (collect/runCycle), ledger, rails, nomba-workflows, reconciliation, scheduling.
- **→ sara PRIMITIVES** (product-agnostic, even if only api uses them today — so other apps CAN): context types, crypto, money, reference, pagination, observability, config, idempotency, metrics, the Nomba **client**.

## Staged execution (green at every step)
- **A — Relocate the api-only DOMAIN block** out of `packages/sara/src` into `apps/api/src/domain/` (temporary cohesive home); rewrite its primitive imports (`../context`→`@nombaone/sara/context`); rewire api consumers. sara now = primitives + the 7 cross-app modules. Green.
- **B — Reorganize** `apps/api/src/domain/*` into `modules/<m>/services/` + `shared/services/`. Green.
- **C — Split the 7 cross-app modules**: workflows→console/admin, primitives→sara. Green.
- **D — Move api infra** (`apps/api/src/shared/{http,middlewares,config,observability,openapi}`) → sara so sara is the reusable foundation; wire into console/admin/website/docs server sides. Green.
- **E — Full verification**: type-check, build, api/sara tests, docs gates; behaviour unchanged.

## Invariant
Every stage ends green: `pnpm type-check` (10/10), `pnpm build`, `@nombaone/api` + `@nombaone/sara` tests, docs 4 gates. No behaviour change — pure restructuring.
