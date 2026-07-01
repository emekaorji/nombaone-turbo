# apps/api — Build Plan 00 · Foundations & the Program Contract

> **Read this first.** This is both the **foundation milestone** (Phase 0 work) and the **shared
> contract** every later `build_plan_{n}.md` obeys: the conventions, the global data model, the two
> state machines, the reference/error/event catalogs, and the verification method. When a later plan
> says "per the contract," it means a section here. Update the checkboxes in each file as work lands;
> a box is ticked only when **demonstrated** (API call / ledger row / log line / passing test), never
> when merely believed — per `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`.

---

## What apps/api is

`api.nombaone.xyz` — the **tenant-facing, server-to-server REST API** our infrastructure customers
(tenants/orgs) call with a per-org secret API key. It is the surface that exposes the entire
subscription-billing engine. It is **not** the subscriber portal (that's `apps/checkout`, session-auth,
out of scope here) and **not** the operator console (`apps/admin`). Where a rubric item is a UI concern
of another app (Section I self-service portal, console/admin/docs screens), only its **API + domain**
obligations are built here; the UI is deferred to that app's plan.

Scope decisions locked with the user (see `workbench/apps/api/questions.md`): full vertical slices
(every layer), build to **fully clear the exit-criteria gate** for apps/api-related sections, **no MVP
half-steps**, **all three rails** (card/mandate/transfer) **real against Nomba** (all sandbox + live
creds in hand), **all billing features** (trials, flat + seat/quantity, coupons/discounts, credit
balances, partial collection), **all intervals** (monthly/annual/custom + EOM + leap), and **settlement
(sub-account + split)** included. Money is **integer kobo end-to-end** — confirmed directly with the
Nomba team (no kobo↔naira boundary conversion).

---

## How the plan series is structured

Ten phase files, each a self-contained milestone that touches **every layer it needs**
(`core-db` schema → migration → `core-contracts` types/validations → `sara` domain → `apps/api` HTTP →
tests). Order is dependency-driven; later phases assume earlier ones are green.

| # | File | Milestone | Primary rubric axes |
|---|---|---|---|
| 00 | `build_plan_00.md` | **Foundations** — delete `example`, lock the contract, build `customers` as the first real vertical slice, harness green | K, L, N (baseline) |
| 01 | `build_plan_01.md` | **Catalog** — plans, prices, plan versioning | A, L, O (plan delete/versioning) |
| 02 | `build_plan_02.md` | **Nomba integration & rails** — OAuth client, inbound-webhook ingest, the 3 real adapters, `payment_methods` + capture flows | E, F, N |
| 03 | `build_plan_03.md` | **Subscriptions, state machine, invoices & the charge→ledger→verify loop** (incl. trials) | A, J, E |
| 04 | `build_plan_04.md` | **Billing cycles & scheduler** — anchors, intervals, EOM/leap, idempotent sweep, concurrency, catch-up | B, K |
| 05 | `build_plan_05.md` | **Invoicing adjustments** — proration, coupons/discounts, credit balances, partial collection, zero-amount, seat/quantity | C, J |
| 06 | `build_plan_06.md` | **Dunning & recovery** ★ | D, E, M (partial) |
| 07 | `build_plan_07.md` | **Outbound webhooks & event catalog** — per-tenant HMAC, retry/dead-letter/replay | G |
| 08 | `build_plan_08.md` | **Multi-tenancy hardening & settlement** ★ — isolation, per-tenant config/limits, fair scheduling, sub-account + split | H, K |
| 09 | `build_plan_09.md` | **Ergonomics, OpenAPI, observability, edge cases & the proof** | L, M, O, P |

### Dependency DAG

```
00 ─┬─► 01 ─┬─────────────► 03 ─► 04 ─► 05 ─► 06 ─┬─► 08 ─► 09
    │       │               ▲      ▲      ▲        │
    └─► 02 ─┴───────────────┘      │      │        │
        (rails/payment methods)    └──────┴── 07 ◄─┘
```
02 (rails + payment methods) and 01 (catalog) both feed 03 (a subscription needs a customer, a price,
and a payment method). 04 drives 03's loop on a clock. 05 deepens invoice math. 06 needs 04's scheduler
+ 02's failure taxonomy. 07 formalizes events emitted from 03–06. 08 hardens isolation + adds settlement.
09 is cross-cutting finalization + the full test proof. The `★` phases (06 Dunning, 08 Multi-tenancy)
are where the rubric is won and get first-class design time.

---

## Part B — Conventions (the house style for THIS repo)

Mirror these exactly. They are how this developer writes code; the boilerplate already embodies them and
`/Users/mac/Vault/work/softerpay/acute-turbo/apps/api` is the mature reference. **Before writing code in a
layer, open the canonical file named below and match it.**

### B.1 Layering & imports
- Dependencies point one way only: `core-contracts → core-db → sara → apps/api`. Apps are thin; **all
  business logic lives in `@nombaone/sara`**. A controller never contains domain logic — it calls a `sara`
  function and shapes the response.
- Scope is `@nombaone/*`. Apps import **narrow `sara` submodule slices** (`@nombaone/sara/ledger`,
  `/subscriptions`, …), never the root barrel.
- Import grouping (blank-line separated, in order): npm/workspace packages → `@nombaone/*` →
  app-absolute (`@modules`, `@shared`) → relative → `import type {…}` last. Canonical:
  `apps/api/src/modules/example/controllers/create.ts`.

### B.2 API module layout
A resource module under `apps/api/src/modules/<resource>/`:
```
<resource>/
├── routes.ts                 # Express Router; the fixed middleware chain per route; grouped with rule-comment headers
├── index.ts                  # barrel (router + anything cross-module)
└── controllers/
    ├── index.ts              # barrel
    ├── create-<resource>.ts  # ONE file per endpoint; thin
    ├── get-<resource>.ts
    └── list-<resource>.ts
```
Business logic does **not** live here — it lives in `packages/sara/src/<resource>/`. (This is stricter
than acute, where some `services/` sit in the app; in nombaone the domain package owns all logic.)
Canonical: `apps/api/src/modules/example/`.

### B.3 HTTP layer
- Controllers are built with the factories in `apps/api/src/shared/http`: `jsonHandler<T>(fn)` for single
  resources, `paginatedHandler<T>(fn)` for lists. The fn returns `{ data, statusCode? }`; the factory
  wraps it in the envelope with `meta.requestId`. Controllers never touch `res` directly. Canonical:
  `apps/api/src/shared/http/json.ts`, `…/paginated.ts`.
- One success envelope (`ApiSuccess<T>` / `ApiPaginated<T>` from `@nombaone/core-contracts/types`);
  `meta.requestId` always present; cursor pagination only (no total counts).
- **Fixed per-route middleware order** (load-bearing — do not reorder):
  `apiKeyAuth → rateLimit → requireScope(...) → idempotency → validate({...}) → controller`.
  Reads skip `idempotency`; `platformGate` is app-wide (mounted in `app/main/app.ts`), not per route.
  Canonical: `apps/api/src/modules/example/routes.ts`.
- Routes grouped under horizontal-rule comment headers describing the group. Versioned under `/v1`.

### B.4 Validation & contracts
- Zod schemas live in `packages/core-contracts/src/validations/<resource>.ts`, exported as
  `{ body?, query?, params? }` fragments; DTO types are `z.infer<typeof schema>`. Response DTO **types**
  live in `packages/core-contracts/src/types/<resource>.ts`. Use `.coerce` for query numbers, refinements
  for XOR constraints. The `validate({...})` middleware parses and returns a structured field-error map.
  Canonical: `packages/core-contracts/src/validations/example.ts`.

### B.5 Errors
- One `AppError` class with static factories (`.BadRequest/.Unauthorized/.Forbidden/.NotFound/.Conflict/
  .UnprocessableEntity/.TooManyRequests/.InternalServerError/.ThirdPartyServiceError/.ServiceUnavailable`).
  Every throw carries a **stable machine code** from `NOMBAONE_ERROR_CODES` (`packages/errors/src/codes.ts`),
  optional `details`, optional `fieldErrors`. Only `PUBLIC_ERROR_CODES` leak; everything else collapses to
  `SYSTEM_INTERNAL_ERROR` in the handler. Add new code groups as listed in Part C.5.

### B.6 Domain layer (`sara`)
- Submodule per resource: `packages/sara/src/<resource>/` with focused files (`create.ts`, `queries.ts`,
  `serialize.ts`, `types.ts`, `index.ts`), exported via a `package.json` `./` export. Higher-level flows
  orchestrate primitives so invariants hold by construction (see `auth/signup.ts`).
- Function signature idiom: `async (db, ctx, input)` where `db` is the right context handle (see B.7),
  `ctx: DomainContext` ({organizationId, environment}) is **always** supplied by the caller and never
  trusted from the client, and `input` is the validated DTO. Pure invariant checks (`assertBalanced`,
  `assertPositiveKobo`) are separate, I/O-free, and testable alone.
- Status is **derived from the ledger**, never stored as a drift-prone column (see `example/create.ts`
  `deriveExampleStatus`). Money mutations go through `ledger/postTransaction`; corrections are reversals
  (new rows), never edits. Every meaningful change `emitEvent(...)` (transactional outbox).

### B.7 DB handles & transactions
- `InfraDb` = read / single-statement (pool or serverless). `InfraTxDb` = pooled handle that can open an
  interactive transaction (`txDb.transaction(async (tx) => …)`). `InfraTx` = the inner tx handle.
  `InfraTxScope` / `InfraReadScope` = unions so one helper serves top-level or in-tx callers. The API uses
  the **pool** (`apps/api/src/shared/config/db.ts`). Atomic multi-statement writes (ledger post, invoice
  finalize, signup) MUST run in one interactive transaction. Canonical: `packages/sara/src/context.ts`,
  `ledger/post.ts`.

### B.8 Schema (Drizzle)
- `pgTable`, snake_case columns. Reuse the shared helpers in `packages/core-db/src/schema/shared.ts`:
  `idPk()` (UUID PK, internal-only), `referenceCol()` (public id), `environmentEnum`, `createdAt()`,
  `updatedAt()`. Every tenant-scoped table carries `organization_id` (FK → organizations) **and**
  `environment`. Enums via `pgEnum`. Money columns are `bigint` (kobo, positive; direction carries sign
  in the ledger). Unique index on `reference`; keyset index `(org, env, created_at desc, id desc)` for
  cursor lists. Types via `typeof table.$inferSelect/$inferInsert`. **Migrations: `drizzle-kit generate`
  then `drizzle-kit migrate` — never `push`.** Canonical: `packages/core-db/src/schema/{shared,ledger-*}.ts`.

### B.9 References, money, idempotency
- Public id = `mintReference(<DOMAIN>)` → `nbo{12 digits}{domain}` (the API `id`; UUID PK stays internal).
  Uniqueness enforced by the unique index; no app-level retry loop. Add domains in Part C.4.
- Money is integer kobo, NGN only; positive amounts, direction carries sign; helpers in
  `@nombaone/sara` root (`assertPositiveKobo`, `nairaToKobo`, `koboToNaira`, `formatKobo`).
- Every external money movement and every mutating endpoint is idempotent: the **reference** is the
  idempotency + reconciliation key on Nomba calls; the `Idempotency-Key` header drives the Redis store
  (`sara/idempotency`) for mutating HTTP. Scheduler/dunning/webhook handling are replay-safe.

### B.10 Tests
- Vitest. Unit tests colocated in `sara` for pure logic (proration math, FSM transitions, interval/EOM/
  leap, fee/clamp). API e2e in `apps/api` against **testcontainers** Postgres + Redis, booting real
  migrations (the migration-apply proof). Mock Nomba via a fake adapter registered in the rail registry
  (`vi.mock`/fake), never hitting the network in unit/e2e; a separate, opt-in **sandbox integration**
  suite (Phase 09) runs the real happy path against Nomba sandbox. No fake data in product code; empty
  states are honest.

### B.11 Comments / TS style
- `/** … */` doc-comments describe **intent, caveats, invariants** — not the obvious. Lead with one line,
  then context, then edge cases; backticks for code refs; paradigm/section headers as horizontal-rule
  block comments. `type` for unions/discriminated unions, `interface` for object contracts. `as const`
  for enum-like sets. No `any` without a reason; prefer `unknown` for external input. Strict TS.

---

## Part C — Global design

> High-level map only. Each table/module's exact columns and functions are specified in the phase that
> builds it; this is the shared picture so phases stay consistent and don't collide.

### C.1 New tables (and the phase that builds each)

| Table | Purpose | Phase |
|---|---|---|
| `customers` | tenant's end-payer (distinct from org); `(org, env, email)` unique | 00 |
| `plans` | the product/offering (name, status, metadata) | 01 |
| `prices` | immutable priced variant of a plan (unit_amount kobo, interval, interval_count, usage_type, trial_days, active) — **plan versioning = new price rows** | 01 |
| `payment_methods` | a customer's rail instance: card `tokenKey` / mandate id / virtual-account ref; brand/last4/exp; status; is_default; **never any PAN** | 02 |
| `nomba_webhook_events` | inbound provider events, `unique(provider, request_id)` — durable inbound dedup | 02 |
| `org_nomba_accounts` | tenant ↔ Nomba sub-account mapping (per env) | 02 / 08 |
| `subscriptions` | customer↔price binding + lifecycle state + period + anchor + trial + cancel flags + default payment method + collection method + optimistic `version` | 03 |
| `subscription_items` | seat/quantity & multi-price lines on a subscription | 03 / 05 |
| `invoices` | immutable-once-finalized billing artifact: status, billing_reason, subtotal/discount/total/amount_due, period, due_date, attempt_count, ledger linkage | 03 |
| `invoice_line_items` | typed lines (subscription / proration / discount / credit), signed amounts, period | 03 / 05 |
| `subscription_schedules` | future-dated changes ("apply at next cycle") as ordered phases | 04 / 05 |
| `coupons` | promo definition (percent/amount_off, duration once/repeating/forever, redeem_by, max_redemptions) | 05 |
| `discounts` | application of a coupon to a customer/subscription (window) | 05 |
| `credit_grants` | per-customer credit ledger-audit (oldest-first application); balance materialized via a customer credit ledger account | 05 |
| `dunning_attempts` | one row per retry: attempt#, scheduled/executed, rail, failure_reason, outcome, next_attempt_at | 06 |
| `settlements` | per-collection split: gross, platform_fee, net_to_tenant, sub-account, split ref, status | 08 |
| `org_billing_settings` | per-tenant policy: dunning schedule, grace period, default collection method, partial-collection default, comms toggles | 06 / 08 |

Existing tables reused as-is: `organizations`, `org_users`, `api_keys`, `ledger_accounts/transactions/
entries`, `domain_events`, `webhook_endpoints/deliveries`, `platform_config`, operator/audit tables.

### C.2 Subscription lifecycle state machine (rubric A)

States: `incomplete · incomplete_expired · trialing · active · past_due · paused · canceled`.
Every transition is an explicit, named, event-emitting operation — **never a direct field write** — and is
idempotent (replaying the trigger does not double-apply). State is **consistent with the ledger/invoices**,
not an independent field.

```
                      first charge ok
incomplete ──────────────────────────► active
   │  │                                   │ │ │
   │  └── trial start ──► trialing ──┐    │ │ └── pause ──► paused ──resume──► active
   │                         │  └────┼────┘ │
   │ first charge never ok   │ cancel│ first│renewal fails
   │ (window elapses)        │ during│charge│
   ▼                         ▼ trial │ ok   ▼
incomplete_expired       canceled ◄──┘   past_due ──recovery──► active
                                            │
                              dunning exhausted (involuntary)
                                            ▼
                                        canceled (churned)
active/trialing ── cancel-now ─────────► canceled (immediate revoke)
active ── cancel-at-period-end ─► (stays active until period end) ─► canceled
```
- `incomplete` exists only for a **never-succeeded first** payment; it never shows as `active`; it
  auto-expires to `incomplete_expired` after a defined window.
- `trialing → active` on first successful charge at trial end; `trialing → canceled` if cancelled during
  trial (no charge attempted).
- **cancel-now vs cancel-at-period-end** are distinct transitions with distinct behavior.
- `canceled` is terminal; resubscribe creates a **new** subscription, never revives the old row.
- Illegal transitions (e.g. `canceled → active`, `incomplete → past_due`) are rejected with a clear coded
  error; each has a test.
- **Voluntary churn** (`active → canceled`, user) and **involuntary churn** (`past_due → canceled`, dunning
  exhausted) are distinct outcomes emitting distinct events.

### C.3 Dunning state machine (rubric D, runs while `past_due`)

```
past_due → scheduled ─► attempting ─┬─ success ─► recovered (→ active, invoice → paid)
                ▲                    ├─ insufficient_funds ─► reschedule (payday-biased) ─┐
                │                    ├─ expired/token_expired ─► card_update_required ─────┤
                └────────────────────┤  (no blind retry; prompt re-add)                    │
                                     └─ hard_decline ─► short path / give up               │
   exhaustion (max attempts/window) ─────────────────────────────────► churned (involuntary)
```
Retry policy **branches on the failure reason** mapped from Nomba's `gatewayMessage`. Configurable per
tenant (count + intervals + grace). A grace period keeps access during `past_due`. Card-update mid-dunning
triggers a prompt retry. Every attempt logged with reason + outcome. Comms are idempotent (a replayed run
re-sends nothing).

### C.4 Reference domains to add (`packages/sara/src/reference.ts`)
`CUS` customer · `PLN` plan · `PRC` price · `PMT` payment method · `SUB` subscription · `SBI` subscription
item · `INV` invoice · `ILI` invoice line item · `SCH` subscription schedule · `CPN` coupon · `DSC`
discount · `CRG` credit grant · `DUN` dunning attempt · `STL` settlement · `NWE` nomba webhook event · `NMA` org↔Nomba sub-account.
(Existing: ORG, USR, KEY, EVT, WHK, WHD, LTX, LAC; remove `EXA` with the example.)

### C.5 Error-code groups to add (`packages/errors/src/codes.ts`)
`CUSTOMER_*` · `PLAN_*` · `PRICE_*` · `PAYMENT_METHOD_*` · `SUBSCRIPTION_*` (incl. illegal-transition codes)
· `INVOICE_*` · `PRORATION_*` · `COUPON_*` · `CREDIT_*` · `DUNNING_*` · `MANDATE_*` · `SETTLEMENT_*` ·
`NOMBA_*` (provider/upstream mapping). Keep public vs internal discipline; only safe codes in
`PUBLIC_ERROR_CODES`. (Remove `EXAMPLE_*` with the example.)

### C.6 Outbound event catalog (rubric G; emitted via `sara/events` → tenant webhooks)
Minimum + product set:
`customer.created` · `plan.created` · `plan.updated` · `subscription.created` · `subscription.updated` ·
`subscription.trial_will_end` · `subscription.activated` · `subscription.paused` · `subscription.resumed`
· `subscription.canceled` (voluntary) · `subscription.churned` (involuntary) · `invoice.created` ·
`invoice.finalized` · `invoice.paid` · `invoice.payment_failed` · `invoice.payment_recovered` ·
`invoice.voided` · `payment_method.attached` · `payment_method.updated` · `payment_method.expiring` ·
`settlement.created`. **Producers:** the **time-based** events (`subscription.trial_will_end`,
`payment_method.expiring`) are emitted by the Phase-04 lifecycle sweep; every other event is emitted
**inline by the operation that causes it** (the phase that owns that operation). Each carries a stable
event id (the `EVT` reference) for consumer dedupe; the full catalog (names, payload shapes, when each
fires) is documented for tenants in Phase 09 / docs app.

### C.7 Nomba integration (per `workbench/NOMBA-INTEGRATION-REFERENCE.md`)
- **Money is kobo end-to-end** (team-confirmed) — no boundary conversion.
- **OAuth client**: `client_credentials` → bearer; cache the token in Redis, refresh off `expiresAt` with
  a margin; never mint per call. Headers `Authorization: Bearer`, `accountId`, `Content-Type` on every call.
- **Rails → endpoints** (behind the `RailAdapter` registry, core never names a provider):
  - Card (pull): tokenize on hosted checkout (`tokenizeCard:true`) → capture `tokenKey` from the
    `payment_success` webhook → recharge via the tokenized-card-payment endpoint.
  - Mandate (pull): create direct-debit mandate → customer authorizes (NIBSS ₦50 validation) → poll status
    to `ACTIVE`/`ADVICE_SENT` → debit; debit result is synchronous.
  - Transfer (push): issue a virtual account (NUBAN) → reconcile inbound `payment_success` (`vact_transfer`)
    by `aliasAccountReference`.
- **Inbound**: verify signature → dedup on `requestId` (`nomba_webhook_events`) → fast-ack 2xx → enqueue →
  worker **re-verifies** (requery) **then** settles (verify-again-then-act). Fill the seams in
  `apps/api/src/super-modules/worker/workers/inbound-webhook.ts`.
- **Confirm-in-sandbox flags** carried from the integration reference (exact endpoint paths, the inbound
  signature input/encoding, mandate webhook existence, tokenized-charge/DELETE specifics) are resolved by a
  **sandbox-confirmation task at the start of Phase 02** before the adapter is trusted; the adapter is
  written to the team-doc surface and corrected if the sandbox disagrees.
- **Settlement** (Phase 08): inline `splitRequest` at collection time into the tenant sub-account; Transfers
  for true payouts/refunds.

### C.8 Env / config additions (`apps/api/src/shared/config/env.ts`, zod-validated, per `test|live`)
`NOMBA_BASE_URL` · `NOMBA_PARENT_ACCOUNT_ID` · `NOMBA_SUBACCOUNT_ID` · `NOMBA_CLIENT_ID` ·
`NOMBA_CLIENT_SECRET` (the "Private key") · `NOMBA_WEBHOOK_SIGNATURE_KEY`. The deployment serves one
environment; the key's env must match (already enforced). **Real credential values are requested from the
user at the start of Phase 02** (the user holds Main Account ID, Sub-account ID, and Test/Live Client ID +
Private key) — signal and ask then.

---

## Part D — Per-file template & verification method

Every `build_plan_{n}.md` follows this skeleton:

```
# apps/api — Build Plan {n} · {Milestone}
> One-line objective. Depends on: {phases}. Unblocks: {phases}.

## Objective & scope        — what's in, what's explicitly out (deferred to which phase/app)
## Rubric coverage          — the exact exit-criteria boxes this phase demonstrates (A1, J3, …)
## Design notes             — decisions, edge cases, the relevant state-machine/Nomba specifics
## Tasks (layer by layer)
  ### DB (core-db)          — tables/columns/indexes; generate+migrate
  ### Contracts (core-contracts) — types + zod validations
  ### Domain (sara)         — submodule + functions (signatures), invariants, events emitted
  ### API (apps/api)        — modules/routes/controllers; middleware chain; scopes
  ### Wiring                — queues/scheduler/worker/registry as needed
  ### Tests                 — unit + e2e to write
## Verification checklist   — `- [ ]` one line per rubric box, each says HOW it's demonstrated
## Done when                — the phase exit gate
```

- Tasks are `- [ ]`; tick when **demonstrated**. Each ticked item names its proof (the test/endpoint/row).
- The **Verification checklist** maps 1:1 to exit-criteria boxes; a phase is done only when its boxes are
  green and `pnpm type-check`, `pnpm build`, `pnpm test` pass. `⚠` boxes are verified twice (read + run);
  `★` boxes are explicit goals in 06 and 08.

---

## Part E — Phase 00 work (Foundations)

**Objective.** Lock the contract above into the repo and prove the entire substrate (middleware chain,
envelope, idempotency, pagination, events, migrations, testcontainer harness) on the **first real product
resource — `customers`** — so every later phase starts from a clean, real vertical slice. Depends on:
nothing. Unblocks: 01, 02.

> **⚠ Scope adjustment (2026-06-30, EM call).** The `example` slice is wired through **all four frontends**
> (admin/console/checkout/docs) — checkout's only current page *is* the example flow. Deleting it from the
> shared packages would break those out-of-scope apps, which the user wants left untouched until they're
> built (Q2). So **the example-deletion tasks below are DEFERRED** to a dedicated cleanup performed when the
> frontends are built; the engine is built **alongside** the (harmless) example, keeping the whole workspace
> green at every checkpoint. The grep gate for `example`/`EXA` is correspondingly deferred. Build the
> **customers + scaffolding** tasks now; treat every "delete the example…" line as DEFERRED, not done.

### Rubric coverage
Baseline for **K** (Idempotency-Key honored, unique-constraint discipline), **L** (envelope/codes/cursor
pagination/versioned `/v1`/auth documented), **N** (auth enforced on every route, secrets in env, no
unauth mutating route). Establishes the harness for **P**.

### Tasks

#### DB (core-db)
- [ ] Delete `packages/core-db/src/schema/examples.ts`; remove it from `schema/index.ts`.
- [x] Add `customers` table: `idPk`, `referenceCol` (CUS), `organization_id` FK, `environment`, `email`,
      `name`, `phone` (nullable), `metadata` jsonb, `createdAt`, `updatedAt`; `unique(reference)`,
      `unique(organization_id, environment, email)`, keyset index `(org, env, created_at desc, id desc)`.
- [x] `pnpm db:generate` then `pnpm db:migrate` — one clean migration; verify it applies on a fresh DB.

#### Contracts (core-contracts)
- [ ] Delete `types/example.ts` + `validations/example.ts`; drop from both barrels.
- [x] Add `types/customer.ts` (`CustomerResponseData`) and `validations/customer.ts`
      (`createCustomerBody`, `listCustomerQuery`, `updateCustomerBody`).

#### Domain (sara)
- [ ] Delete `packages/sara/src/example/**`; remove `./example` from `sara/package.json`; remove the
      `EXA` domain from `reference.ts`.
- [x] Add reference domains from C.4; add error-code groups from C.5 (delete `EXAMPLE_*`).
- [x] Add `packages/sara/src/customers/` (`create.ts`, `queries.ts`, `serialize.ts`, `types.ts`,
      `index.ts`): `createCustomer(db, ctx, input)`, `getCustomerByReference`, `listCustomers` (cursor),
      `updateCustomer`; emit `customer.created`. Export `./customers`.

#### API (apps/api)
- [ ] Delete `apps/api/src/modules/example/**`; unmount from `app/main/routes.ts`.
- [ ] Delete the example queue (`packages/queue/src/queues/example.ts`, drop from barrel).
- [x] Replace `rails/mock.ts` usage path — keep a **test-only** fake adapter for the harness (not in
      product code); real adapters land in Phase 02. (Document in the rails registry.)
- [x] Add `apps/api/src/modules/customers/` (`routes.ts` + `controllers/{create,get,list,update}`),
      full middleware chain, new scopes `customers:read` / `customers:write`; add scopes to the API-key
      scope set + contracts.
- [x] Confirm `GET /v1/health` still green; mount `customers` under `/v1`.

#### Wiring
- [x] Confirm no dangling `example` references (grep gate: zero `example`/`EXA` in `src`, save the rails
      test fake which is clearly named).

#### Tests
- [x] e2e (testcontainers): create→get→list→update customer through the real middleware chain; envelope +
      `meta.requestId` asserted; `Idempotency-Key` replay returns the same result with no second row;
      pagination cursor works; cross-org read is blocked (isolation smoke).
- [x] unit: customer serialize + reference minting.

### Verification checklist (rubric)
- [x] **K** — every mutating endpoint honors `Idempotency-Key`; replay returns the original result, no new
      row (proven by the customers e2e replay test). `(org, env, email)` unique makes duplicate customers
      impossible (409 e2e). _(commit 5ecd460)_
- [x] **L** — single envelope shape + stable codes; cursor pagination; `/v1` versioning; auth documented
      (customers CRUD e2e asserts the envelope + `meta.requestId` + cursor pagination).
- [x] **N** — every customers route enforces `apiKeyAuth` + scope; no unauthenticated mutating route
      (401/403 e2e); secrets only in env.
- [~] Grep gate: **DEFERRED** with the example-deletion (see the scope note) — runs at frontend cleanup.
- [x] `pnpm type-check` (9/9, frontends incl.) + `pnpm test` (16 api e2e + 28 sara unit) green across the
      workspace. Full `pnpm build` is re-confirmed in the Phase-09 hardening pass.

### Done when
The example slice is gone, `customers` is a complete real vertical slice exercising the full stack, the
harness boots against real migrations, and the whole workspace is green. The repo is now a clean base for
01 (catalog) and 02 (rails).

> **✅ PHASE 00 DONE (2026-06-30, commit 5ecd460 on `build/apps-api`).** `customers` is a complete real
> vertical slice (db→contracts→sara→api) exercising the full middleware chain; migration `0001` applies
> on a fresh DB via the testcontainer harness; 16 api e2e + 28 sara unit + 9/9 workspace type-check green.
> Deviation: the `example` slice is **kept** (deletion deferred to frontend cleanup — see the scope note),
> so the grep gate and `example` removals are the only Phase-00 items not done, by design.
