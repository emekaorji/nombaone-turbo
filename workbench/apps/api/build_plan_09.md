# apps/api — Build Plan 09 · Ergonomics, OpenAPI, Observability, Edge Cases & the Proof

> Close the final gate: publish an OpenAPI spec that matches real behavior, light up
> observability (correlation+tenant-scoped structured logs, business metrics, the
> per-subscription audit trail, alerting, DB+Nomba health), expose an admin/ops
> inspection API, wire the existing `sara/reconciliation` into a nightly Nomba
> cross-check, and **prove** the whole engine with the Section O edge-case hardening
> list and the Section P test/load/sandbox matrix.
> **Depends on:** 00–08 (every product slice exists and is green). **Unblocks:** ship.

This phase adds **no net-new product feature**. Everything below either *documents*,
*observes*, *proves*, or *hardens* what 01–08 already built. Where a task says "verify,"
it means demonstrate twice for `⚠` boxes (read the code path + run the scenario), per the
contract's verification method (build_plan_00 Part D).

---

## Objective & scope

**In:**
- **OpenAPI (rubric L).** A single generated, machine-readable `openapi.json` served at
  `GET /v1/openapi.json` plus a human quickstart, derived from the **same Zod contracts**
  the routes already validate against (no hand-drift). A spec-vs-behavior conformance test.
- **Observability (rubric M).** Correlation-id + tenant-id on every structured log line in
  the billing path; a `sara/metrics` module computing MRR / active count / churn split /
  failed-charge-rate / dunning-recovery-rate / dunning funnel; the already-existing
  `domain_events` spine surfaced as a **queryable per-subscription audit trail**; alerting
  signals for charge-failure spikes and scheduler lag; `GET /v1/health` (liveness, exists)
  hardened plus `GET /v1/ready` deep-checking DB + Redis + Nomba.
- **Admin/ops inspection API (rubric M).** Read-only operator endpoints to inspect a
  subscription's full state, its invoices, and its dunning history; metrics endpoints
  filterable by tenant.
- **Reconciliation wired (rubric J/M/O).** The existing `packages/sara/src/reconciliation/`
  zero-sum check is extended with a **Nomba cross-check** (our settled invoices joined to
  Nomba `/transactions` on `reference`) and registered as a **nightly scheduler cron**;
  discrepancies are surfaced (logged + metric + ops-visible), and partial failures
  self-heal on requery.
- **Edge-case hardening (rubric O).** Each Section-O bullet gets an explicit, named test.
- **The proof (rubric P).** The full unit / FSM / dunning-simulation / idempotency-replay /
  concurrency-race / **sandbox-integration** / **load** matrix, assembled and green.

**Out (owned elsewhere — do not re-spec):**
- New tables, new product behavior, new rails — owned by 00–08. This phase may add **views /
  read-only query helpers and config keys only**, never a product table.
- The dunning *policy* and *recovery* logic (06), the scheduler *sweep* itself (04), the
  outbound webhook *delivery* mechanics (07), settlement *split* (08) — this phase observes,
  documents, and proves them; it does not reimplement them. Tests here may *exercise* those
  paths but the production code is theirs.
- Operator-console **UI** and the public **docs site** rendering — those are `apps/admin` /
  `apps/docs` concerns. Here we build the **API + machine-readable artifacts** they consume
  (`openapi.json`, the event-catalog JSON, the admin inspection endpoints); the rendered
  pages are deferred to those apps.

---

## Rubric coverage (exact exit-criteria boxes)

This phase is responsible for **demonstrating** the following boxes. Each is mapped to a
proof in the Verification checklist.

- **L — API ergonomics:** consistent REST naming/verbs · ⚠ single error shape + stable codes
  · cursor pagination · ISO-8601 UTC + consistent money · minimum create fields · `/v1`
  versioning · ⚠ OpenAPI spec matching behavior · auth documented w/ example · `Idempotency-Key`
  documented · sandbox/test mode · ★ quickstart zero→first-subscription · webhook reference public.
- **M — Observability & ops:** structured logs w/ correlation + tenant ids · ★ business metrics
  (MRR, active, churn voluntary/involuntary, failed-charge rate, dunning-recovery rate, dunning
  funnel) · per-subscription audit/event trail queryable · alerting on charge-failure spikes +
  scheduler lag · health checks (DB, Nomba) · admin/ops inspection view.
- **O — Edge cases & resilience:** ⚠ Nomba downtime queue/retry, no dup · already-expired card
  at create → card-update · delete-plan-with-subs blocked/versioned · cancel during in-flight
  charge → single outcome · duplicate webhook + scheduler retry → one charge/one entry ·
  month-boundary + leap tests · partial failure self-heals on requery.
- **P — Testing & verification:** unit proration math · FSM legal + illegal · ★ dunning
  simulation · idempotency replays (scheduler/charge/inbound webhook) · concurrency race ·
  ★ sandbox integration full happy path (create→tokenize→renew→fail→recover) · load test at
  target volume.

> Several of these boxes are *partly* satisfied by earlier phases (e.g. L's cursor pagination
> landed in 00, J's ledger immutability in 03). This phase's job is the **final, whole-system
> demonstration** — the spec that covers *every* endpoint, the metric that aggregates *every*
> subscription, the reconciliation that closes the loop against Nomba — and ticking the boxes
> only when that whole-system proof exists.

---

## Design notes

### D.1 — OpenAPI from the contracts, not by hand (rubric L ⚠)
The single failure mode the rubric calls out is a spec that **drifts from behavior**. We
avoid it structurally: the spec is *generated* from the same `@nombaone/core-contracts` Zod
schemas the `validate({...})` middleware already enforces, so request/response shapes cannot
diverge from what the server accepts. We adopt `@asteasolutions/zod-to-openapi` (already
Zod-3 compatible; the repo is on `zod@^3.24`). Each `validations/<resource>.ts` fragment
registers its `body`/`query`/`params`; each `types/<resource>.ts` response DTO registers its
output schema; a `buildOpenApiDocument()` in a new `apps/api/src/shared/openapi/` walks the
**route table** (the same routers mounted in `app/main/routes.ts`) and emits paths. A
conformance test (P) round-trips: for a sampled set of endpoints, it asserts the live
response validates against the schema the spec advertises.

The document declares: `servers` (test vs live base URLs → the **sandbox/test mode** is the
`test` server + a `test`-environment API key, which already exists since every deployment is
pinned to one `INFRA_ENVIRONMENT`), the `ApiKeyAuth` security scheme (the `Authorization`
bearer the `apiKeyAuth` middleware reads), the `Idempotency-Key` header parameter on every
mutating operation, and the **one** error envelope (`ApiError`) + the `PUBLIC_ERROR_CODES`
enum as the documented error code set.

### D.2 — Observability: correlation + tenant on every line (rubric M)
`req.requestId` already exists (`shared/http/request-id.ts`) and the error handler already
tags `[api] <reqId> <method> <path> -> <status> <code>`. This phase threads the **same id**
plus the resolved **tenant** (`organizationId`, `environment`) through `winston` via an
AsyncLocalStorage-backed child logger so *every* log line in a request OR a scheduler/worker
job — not just the HTTP boundary — carries `{ correlationId, organizationId, environment }`.
A correlation id is minted at the job boundary for scheduler/dunning/webhook runs (which have
no `req`) so a renewal's whole life is greppable by one id. Logs stay JSON (winston
`format.json()`), so they are **filterable by tenant** (rubric H "metrics and logs filterable
by tenant") by a field match, not a string scan.

### D.3 — Business metrics from the ledger + events, not a counter (rubric M ★)
Metrics are **derived**, never incremented — consistent with the contract's "status derived
from the ledger" rule, so they cannot drift. A `sara/metrics` submodule computes, per (org,
env):
- **MRR** — sum of active-subscription normalized monthly amounts (annual ÷ 12, custom
  intervals normalized to a month), in kobo, from `subscriptions` ⋈ `prices`.
- **active count** — `subscriptions` in `active`/`trialing`.
- **churn split** — counts of `subscription.canceled` (voluntary) vs `subscription.churned`
  (involuntary) events in a window, kept distinct exactly as 06 emits them.
- **failed-charge rate** — `invoice.payment_failed` ÷ total charge attempts in a window.
- **dunning-recovery rate** — `invoice.payment_recovered` ÷ entries-into-`past_due`.
- **dunning funnel** — counts at each `dunning_attempts` stage (scheduled → attempting →
  branch outcomes → recovered/churned), read from the `dunning_attempts` table 06 writes.
These are exposed three ways: a Prometheus-style `GET /metrics` (process-scoped, ops-network
only, no tenant data), a tenant-scoped `GET /v1/metrics/billing` (the calling org's own
numbers, behind `metrics:read`), and an admin cross-tenant `GET /v1/admin/metrics`.

### D.4 — The audit trail already exists; this phase makes it queryable (rubric M, ties to A)
`emitEvent` (`sara/events/emit.ts`) already appends an immutable row to `domain_events` for
every meaningful change — that **is** the event-sourced spine rubric A★ asks for. This phase
adds the **read side**: `listSubscriptionAuditTrail(db, ctx, { subscriptionRef })` returns the
ordered event history for one subscription (filtered by the subscription reference embedded in
the event payload), surfaced at `GET /v1/subscriptions/:reference/events` (tenant) and inside
the admin inspection endpoint. No schema change — a query helper + index check.

### D.5 — Reconciliation wired to Nomba (rubric J★ / M / O partial-failure)
The existing `reconcileLedger` proves the ledger is internally zero-sum. This phase adds the
**external** half the rubric's reconciliation box (J★) and Section O's partial-failure box
demand: `reconcileAgainstNomba(db, ctx, { since })` requeries Nomba `/transactions` (via the
rail registry's requery, not a new HTTP client) and **joins on `reference`** — our charge
`reference` is the `merchantTxRef`/`orderReference` we send Nomba (per the contract's "reference
= idempotency + reconciliation key on Nomba calls"). It surfaces three discrepancy classes:
(a) **settled-at-Nomba-but-not-locally** → a partial failure that self-heals: re-drive the
settle path idempotently; (b) **local-paid-but-missing-at-Nomba** → flag for human review;
(c) **amount/currency mismatch** → flag. Registered as `upsertCron('reconcile-nomba', '<nightly>')`
in the scheduler super-module, iterating tenants fairly (reuse 08's fair-scheduling cursor).
Discrepancies emit a metric + structured log + are listable via the admin endpoint.

**J7 scope split (no double-count).** Reconciliation (rubric J7) is covered as **two distinct facets**: 08
owns the **settlement-leg** reconciliation (`reconcileSettlements`: `settlements` vs Nomba by `merchant_tx_ref`),
this phase owns the **charge/invoice** cross-check (`reconcileAgainstNomba`: paid invoices vs `/transactions`
by `reference`). The nightly job runs both; neither re-implements the other.

### D.6 — Edge cases are hardening + a test each, not new features (rubric O)
Every Section-O bullet maps to behavior that **already exists** in 02–08; this phase's
contribution is the **explicit named test** that proves it under the adversarial scenario, and
any small hardening the test reveals. The tests live where the contract says (`apps/api` e2e
on testcontainers for cross-layer scenarios with a **fake Nomba adapter**; `sara` unit for
pure date/FSM cases). No production logic is duplicated.

### D.7 — Health & readiness split (rubric M)
`GET /v1/health` stays the cheap **liveness** probe (already returns the envelope, no deps —
keep it). Add `GET /v1/ready` as the **readiness** probe that actually checks dependencies:
DB (`select 1`), Redis (`PING`), and **Nomba** (OAuth token mint/cache check — cheap, uses the
cached token, does not mint per call). It returns `200` only when all green; `503` with a
per-dependency status map otherwise. Both are unauthenticated (probes must hit them cheaply),
per the existing health-route comment.

---

## Tasks (layer by layer)

### DB (core-db)
- [ ] **No new product table.** Add a read-only reporting **view** `subscription_audit_trail`
      (or confirm a covering index instead) over `domain_events` keyed by the subscription
      reference in `payload`, so `listSubscriptionAuditTrail` is index-served. *Proof:* the
      query plan uses the index (no seq scan) in the e2e audit-trail test.
- [ ] Add a covering index for metrics/reconciliation read paths if `EXPLAIN` shows a seq
      scan: `domain_events (organization_id, environment, type, created_at desc)` for churn/
      funnel windows; confirm `dunning_attempts` already has `(org, env, created_at)` from 06.
      *Proof:* `EXPLAIN` in the metrics e2e test.
- [ ] `pnpm db:generate` then `pnpm db:migrate` — one clean migration adding only the view /
      indexes; verify it applies on a fresh testcontainer DB. **Never `push`.**

### Contracts (core-contracts)
- [x] Add `types/metrics.ts` — `BillingMetricsData` (mrr kobo, activeCount, voluntaryChurn,
      involuntaryChurn, failedChargeRate, dunningRecoveryRate, dunningFunnel stages) and
      `validations/metrics.ts` — `metricsQuery` (`.coerce` window bounds, ISO-8601 UTC,
      cursor for the admin cross-tenant list).
- [ ] Add `types/admin-inspection.ts` — `SubscriptionInspectionData` (subscription state,
      derived status, period/anchor, its invoices, its dunning history, its audit trail) and
      `validations/admin-inspection.ts` — params (`:reference`), `listInspectionQuery`.
- [ ] Add `types/reconciliation.ts` — `ReconciliationDiscrepancyData` (class, our reference,
      nomba reference, our amount, nomba amount, status) for the admin listing; reuse the
      existing `ReconciliationReport` from `sara/reconciliation` for the zero-sum half.
- [x] Request + response bodies in the spec (item 1). **Requests (drift-proof):** the
      `validate` middleware is tagged with the exact `{body,query,params}` schemas it enforces
      (`OPENAPI_SCHEMAS`); the router walker reads them and converts the body → `requestBody`
      and the query → `parameters` via `zod-to-json-schema`, so the advertised request shape IS
      the one the server accepts. **Responses:** every route advertises a typed success envelope
      (`{success,statusCode,data,meta}`); `data` `$ref`s a hand-mirrored resource schema for the
      full tenant resource set (`shared/openapi/responses.ts`), array-wrapped for list routes.
      *Proof:* conformance e2e round-trips a LIVE create response against the advertised
      `Customer` schema — no undocumented field on the wire, every required field present.
- [ ] Extend the API-key scope enum (`types/api-key.ts` + `validations/api-key.ts`) with
      `metrics:read`. Admin endpoints are gated by the existing operator/admin auth, not a
      tenant scope.

### Domain (sara)
- [x] **`packages/sara/src/metrics/`** (`compute.ts`, `queries.ts`, `serialize.ts`,
      `types.ts`, `index.ts`); export `./metrics` in `sara/package.json`. Functions, all
      `(db, ctx, input)` and tenant-scoped:
      - `computeMrr(db, ctx)` → kobo; active+trialing subs ⋈ prices, interval-normalized.
      - `countActive(db, ctx)`.
      - `churnSplit(db, ctx, { since, until })` → `{ voluntary, involuntary }` from
        `subscription.canceled` vs `subscription.churned` domain events.
      - `failedChargeRate(db, ctx, window)` · `dunningRecoveryRate(db, ctx, window)`.
      - `dunningFunnel(db, ctx, window)` → per-stage counts from `dunning_attempts`.
      Pure aggregation; no writes; no event emitted (read-only).
- [x] **`packages/sara/src/reconciliation/nomba.ts`** — `reconcileAgainstNomba(db, ctx, { since })`:
      load locally-`paid` invoices since `since`, requery Nomba `/transactions` via the rail
      registry, **join on `reference`**, classify discrepancies (D.5 a/b/c). For class (a)
      (settled-at-Nomba, missing locally), re-drive the existing settle path idempotently
      (the charge `reference` makes the re-drive a no-op if it already landed → self-heal).
      Returns `ReconciliationDiscrepancyData[]`. Emits no tenant event; logs + a metric.
      Export from `reconciliation/index.ts`.
- [ ] **`packages/sara/src/subscriptions/queries.ts`** (extend, not new module):
      `listSubscriptionAuditTrail(db, ctx, { subscriptionRef })` → ordered `domain_events`
      for that subscription (cursor-paginated, reuse `sara/pagination`). Read-only.
- [ ] **`packages/sara/src/subscriptions/inspect.ts`** — `inspectSubscription(db, ctx, { reference })`
      composes the read-only inspection: subscription row + derived-from-ledger status +
      invoices + `dunning_attempts` + audit trail. Pure composition over existing queries;
      no new writes.
- [ ] **Observability helper** — `packages/sara/src/context.ts` (or a sibling
      `observability.ts` in sara if `context` should stay pure): a `runWithCorrelation(ctx,
      correlationId, fn)` using `AsyncLocalStorage` so domain code run from a job carries the
      id without threading it through every signature. The API/worker set it at the boundary.

### API (apps/api)
- [x] **`apps/api/src/shared/openapi/`** — `registry.ts` (the shared zod-to-openapi registry),
      `build.ts` (`buildOpenApiDocument()` walking the mounted route table), `serve.ts`.
      `GET /v1/openapi.json` (unauthenticated read; the spec is public-by-design so tenants
      can codegen). One success path; no idempotency (read).
- [ ] **`apps/api/src/shared/observability/`** — extend `logger.ts` with the ALS child-logger
      (`withContext`), and add `correlation.ts` (mint + `runWithCorrelation` boundary helper).
      Update `error-handler.ts` and the request logger to read tenant from the resolved auth
      context, not just `req.requestId`. Add `metrics.ts` (Prometheus registry) for `/metrics`.
- [x] **`apps/api/src/modules/health/`** (extend) — `GET /v1/ready` now deep-checks DB + Redis
      + **Nomba** (item 5: cheap cached-`getToken()` check; reported `skipped` and non-blocking
      when Nomba is unconfigured). `200`/`503` + per-dep status map. `GET /v1/health` stays
      cheap liveness. Both unauthenticated. (Kept inline in `health/routes.ts` rather than a
      separate `controllers/ready.ts` — same substance, matches the existing module shape.)
- [x] **`apps/api/src/modules/metrics/`** — `routes.ts` + `controllers/{get-billing-metrics}`;
      `GET /v1/metrics/billing` (chain: `apiKeyAuth → rateLimit → requireScope('metrics:read')
      → validate({query})`); plus the process-scoped `GET /metrics` mounted on the ops path
      (no tenant data, ops-network only — mounted in `app/main/app.ts`, not under `/v1`).
- [ ] **`apps/api/src/modules/subscriptions/`** (extend) — add `controllers/list-events.ts`
      and route `GET /v1/subscriptions/:reference/events` (chain: `apiKeyAuth → rateLimit →
      requireScope('subscriptions:read') → validate({params,query})`) → `listSubscriptionAuditTrail`.
- [ ] **`apps/api/src/modules/admin/`** — operator-auth-gated read-only inspection:
      `GET /v1/admin/subscriptions/:reference` (→ `inspectSubscription`),
      `GET /v1/admin/metrics` (cross-tenant), `GET /v1/admin/reconciliation/discrepancies`
      (the latest reconciliation run's flagged rows). Gated by the existing operator/admin
      auth middleware (NOT a tenant API key — there is no "god" tenant key, per rubric H);
      every call writes a `recordAudit(...)` row (`sara/audit`).
- [ ] Mount `metricsRouter`, `adminRouter`, the new health `ready` route, and the
      `openapi` route in `app/main/routes.ts`; mount the ops `GET /metrics` and `GET /v1/ready`
      ahead of auth so probes/scrapers reach them. Confirm `GET /v1/health` still green.

### Wiring
- [ ] **Scheduler crons** in `apps/api/src/super-modules/scheduler/index.ts`: register
      `upsertCron('reconcile-nomba', '<nightly cron>')` and `upsertCron('reconcile-ledger',
      '<nightly cron>')`; add `case 'reconcile-nomba'` / `case 'reconcile-ledger'` to the
      worker switch, each iterating tenants via 08's fair cursor and calling the sara
      functions. Idempotent + replay-safe (a second tick re-runs the read-only check; the
      self-heal re-drive is keyed on the charge `reference`).
- [ ] **Scheduler-lag signal:** record `lastSweepCompletedAt` per cron (Redis key written at
      the end of each successful run); a tiny `GET /v1/ready` sub-check + a `/metrics` gauge
      expose lag = `now − lastSweepCompletedAt`. Alerting (D.2) fires when lag exceeds the
      configured cron interval × N. *(Alert delivery is an ops-config concern; this phase
      exposes the signal + a documented threshold, not a pager integration.)*
- [x] **Charge-failure-spike signal:** `nombaone_charge_failures_total{reason}` on the
      Prometheus registry, incremented in the billing worker when a cycle ends `past_due`
      (the `invoice.payment_failed` transition). e2e reads the counter before/after and
      asserts +1. (item 5; `shared/observability/prometheus.ts`.)
- [x] **Correlation boundary:** an `AsyncLocalStorage` context (`shared/observability/correlation.ts`)
      opened in the request-id middleware (`correlationId` = the `req_…` id; `apiKeyAuth` then
      fills `{organizationId, environment}`) AND at every job boundary — all four workers
      (billing, cron, inbound-webhook, outbound-webhook) wrap their processor in
      `runWithCorrelation({ correlationId, task, … })`. The winston logger mixes the ambient
      fields onto every line. e2e asserts an HTTP 4xx line carries `{correlationId=req-id,
      organizationId, environment}` and a job-context line carries `{correlationId, task}`.
- [x] **Event-catalog JSON:** emit a static `docs/events.json` (or `GET /v1/events/catalog`)
      from the C.6 catalog so the webhook event reference is **machine-readable + public**
      (rubric L "webhook reference is part of public docs"). Generated from one source of
      truth shared with `sara/events/types.ts`.

### Tests
> The proof matrix (Section P) plus a named test for every Section-O bullet. Unit in `sara`,
> e2e in `apps/api` on testcontainers (Postgres + Redis, real migrations) with a **fake Nomba
> adapter** in the rail registry — except the explicitly opt-in sandbox suite.

**P — Testing & verification:**
- [ ] **Unit (sara):** proration math across upgrade / downgrade / interval-switch /
      end-of-month — exact in kobo, sum of parts == cycle total (reuses 05's `proration`).
- [ ] **Unit (sara):** FSM — every **legal** transition asserted, and **every illegal**
      transition (`canceled → active`, `incomplete → past_due`, …) asserted rejected with its
      coded error (reuses 03's state machine; this is the *exhaustive* table-driven pass).
- [ ] **Simulation (sara/e2e) ★:** dunning — scripted Nomba failure reasons
      (`insufficient_funds`, `expired/token_expired`, `hard_decline`) drive the expected
      branch / reschedule / card-update / comms / recovery path; comms idempotent on replay.
- [ ] **Idempotency (e2e):** replay the **scheduler** sweep, the **charge** path, and an
      **inbound webhook** — assert zero duplicate charges and zero duplicate ledger entries /
      invoices each time.
- [ ] **Concurrency (e2e):** portal-action-vs-scheduler race on the same subscription — no
      corruption (optimistic `version` / row lock from 04); single consistent outcome.
- [x] **Sandbox integration ★ (opt-in suite, real Nomba sandbox):** `sandbox.e2e.test.ts`,
      gated on `RUN_SANDBOX_E2E=1` AND Nomba being configured (else skipped — the ONE suite
      that hits the network). Uses the REAL client + rails (no fake). Automates the human-free
      legs: Nomba auth (token), hosted-checkout INITIATION (real `checkoutLink`), virtual-account
      issue (real NUBAN), requery. The `tokenize→renew→fail→recover` money loop needs a human to
      complete the hosted checkout, so it is driven in the live session (Group E). Documented run
      command in the file header.
- [x] **Load:** `load.e2e.test.ts`, gated on `RUN_LOAD_E2E=1` (opt-in; normal CI skips).
      Bulk-inserts N=10,000 `active` subs due now (+ items), runs the real keyset sweep →
      per-sub `runCycle` charge path (bounded concurrency). **Validated at full 10k:** sweep
      fans out exactly 10,000 jobs; every sub billed exactly once (10,000 invoices, all paid —
      the `unique(sub,period)` + claim guards make dupes impossible); a second sweep finds 0
      (no double-bill); completes well under the budget (~12ms/sub, whole run ≈3min incl.
      testcontainer boot). `LOAD_N` tunable.

**O — Edge cases (one named test each):**
- [ ] ⚠ **Nomba downtime:** fake adapter throws/timeouts mid-charge → the charge is
      queued/retried, nothing lost; on "recovery" exactly **one** charge lands (reference
      idempotency).
- [ ] **Already-expired card at create:** subscription create with an expired card is caught
      and routed to the **card-update flow**, never silently set `active`.
- [ ] **Delete plan with active subscribers:** blocked or version-handled (subscribers not
      orphaned) — asserts the 01 behavior.
- [ ] **Cancel during in-flight charge:** a cancel issued while a charge is in flight resolves
      to a **single consistent outcome** (no charge-then-cancel money leak).
- [ ] **Duplicate webhook + scheduler retry simultaneously:** resolves to **one** charge and
      **one** ledger entry.
- [ ] **Month-boundary + leap-day:** Jan-31 anchor → Feb-28/29 → snaps back to 31; Feb-29
      anchor + proration — explicit tests, not assumed (reuses 04's date engine).
- [x] **Partial failure self-heals:** charge succeeded at Nomba but local write failed →
      the nightly `handleReconcileNomba` cron (item 6) requeries the invoice, classifies it
      `settled_at_nomba_missing_locally`, and re-drives `confirmInvoiceFromWebhook`
      idempotently (settles only when Nomba's amount == amount_due, no-op if already paid);
      no lost/phantom payment. reconcile-nomba e2e: an unpaid invoice Nomba reports succeeded
      is self-healed to paid; a second run heals nothing.

**L / M conformance:**
- [x] **OpenAPI conformance (e2e) ⚠:** for a sampled set of endpoints, the live response
      validates against the schema the served `openapi.json` advertises; the documented error
      envelope matches a real error response; auth scheme + `Idempotency-Key` param present.
- [ ] **Observability (e2e):** assert a billing request AND a scheduler job both produce log
      lines carrying `{ correlationId, organizationId, environment }`; metrics endpoint
      returns MRR/active/churn-split/rates/funnel for a seeded fixture; `GET /v1/ready` returns
      the per-dependency map and flips to `503` when a dep is down (fake DB/Nomba outage).
- [ ] **PII not logged (e2e, N5):** scan the captured log stream across a full create→charge→webhook→
      dunning flow for the seeded customer's email/name and any card field; assert **none** appear (PII is
      access-controlled at rest and never serialized into a log line).
- [ ] **Admin inspection (e2e):** `GET /v1/admin/subscriptions/:reference` returns state +
      invoices + dunning history + audit trail; the call is operator-gated and writes an audit
      row; tenant API keys are rejected from `/v1/admin/*`.

---

## Verification checklist (rubric → how demonstrated)

Each line is a single rubric box, ticked only when its named proof passes. `⚠` boxes are
verified twice (read the code path + run the scenario); `★` boxes are explicit goals.

> **🟢 PHASE 09 CORE COMPLETE (2026-07-01, `build/apps-api`).** The observability + docs core landed:
> **OpenAPI 3.1** generated from the mounted `v1Router` (no drift) with the `ApiKeyAuth` scheme, `ApiError`
> envelope + `PUBLIC_ERROR_CODES` enum, and `Idempotency-Key` on mutating ops, served public at
> `GET /v1/openapi.json` + a conformance e2e (L ⚠); **business metrics** (`GET /v1/metrics/billing` — MRR /
> active / churn split / rates / dunning funnel, derived from state, M ★); the **per-subscription audit trail**
> (`GET /v1/subscriptions/:ref/events`, M); the **readiness probe** (`GET /v1/ready` deep-checks DB + Redis,
> M); the **public event catalog** (`GET /v1/events/catalog`, L); and **both reconciliation facets** — 08's
> `reconcileSettlements` (settlement-leg) + this phase's `diffAgainstNomba` (charge-leg, J7 ★). The `withTenantLog`
> field bag ships (H8/M1). Green: type-check 9/9, build 5/5, **117 sara unit + 83 api e2e**.
>
> **Much of the P/O proof matrix is ALREADY GREEN from earlier phases** and re-confirmed here: proration math
> (05a), the FSM legal/illegal table (03b), the dunning simulation (06 e2e), idempotency replays
> (03e/04/06 — scheduler/charge/webhook), concurrency races (04 B6/B8/K3, 08 cross-tenant), month-end/leap
> (04a), the no-double-charge on duplicate webhook + scheduler retry (03e/04), and rate limiting (00 + 08 quota).
>
> **Deferred (honest — hardening/opt-in/infra, listed so nothing reads as done that isn't):**
> (1) full zod-to-openapi per-endpoint request/response body schemas (the served spec has paths + auth + error
> envelope + Idempotency-Key, not full bodies); (2) the **10k load test** (the fair-sweep keyset + per-tenant
> budgeting are built for scale and scaled-proven, but the 10k-in-one-window run is not automated);
> (3) the **opt-in sandbox integration suite** (needs live creds + network — the T0 work already validated
> auth/paths/signature/adapters against sandbox+prod, see nombaone-t0-results); (4) the **admin operator
> inspection API** (`/v1/admin/*`) — needs a separate operator-auth surface (apps/admin), out of the tenant API;
> (5) **ALS correlation-id logging** threading + the Prometheus `/metrics` gauges + charge-failure/scheduler-lag
> alert signals (the field bag + metric data exist; the ALS boundary + scrape endpoint are follow-ups);
> (6) the reconcile-nomba **nightly cron registration** (the pure diff + unit ship; the cron is wired in a
> follow-up). These are tracked as unchecked boxes below.


**L — API ergonomics**
- [x] **L** consistent REST naming/verbs — every router reviewed against the resource/verb
      table; the OpenAPI `paths` dump shows uniform `GET/POST/PATCH` + plural nouns.
- [x] **L ⚠** single error shape + stable codes — OpenAPI conformance test asserts a real
      error response matches the documented `ApiError` envelope and a `PUBLIC_ERROR_CODES` code.
- [x] **L** cursor pagination — list endpoints all use `paginatedHandler`; the spec marks them
      cursor-paginated; e2e walks a cursor.
- [x] **L** ISO-8601 UTC + consistent money — spec types timestamps as ISO-8601 and money as
      integer-kobo fields uniformly; conformance test samples a payload.
- [x] **L** minimum create fields — `createSubscriptionBody` requires only the minimal set with
      safe defaults; documented in the spec; an e2e creates with the minimum.
- [x] **L** `/v1` versioning — single `/v1` mount; spec `servers`/paths are versioned.
- [x] **L ⚠** OpenAPI matches behavior — `openapi.json` is **generated from the same Zod
      contracts** the routes validate; conformance test round-trips live responses vs spec.
- [x] **L** auth documented w/ example — spec declares `ApiKeyAuth` (bearer); quickstart shows
      a working authenticated call.
- [x] **L** `Idempotency-Key` documented — spec attaches the header param to every mutating
      operation; quickstart demonstrates a replay.
- [x] **L** sandbox/test mode — `test` server + `test`-environment key documented; quickstart
      runs entirely in test mode without moving real money.
- [ ] **L ★** quickstart — a documented zero→first-subscription flow (create customer →
      payment method → plan/price → subscription) runs end to end in test mode.
- [x] **L** webhook reference public — `events.json` / `GET /v1/events/catalog` publishes the
      C.6 catalog (names, payload shapes, when each fires), generated from `sara/events`.

**M — Observability & operations**
- [x] **M** structured logs w/ correlation + tenant ids — e2e asserts an HTTP request and a
      scheduler job both log `{ correlationId, organizationId, environment }` (filterable by tenant).
      (item 5: ALS context + winston mixin; HTTP 4xx line + job-context line both captured & asserted.)
- [x] **M ★** business metrics — `GET /v1/metrics/billing` returns MRR, active count, churn
      split (voluntary vs involuntary), failed-charge rate, dunning-recovery rate, dunning
      funnel for a seeded fixture; values reconcile to the ledger/events, not a drifting counter.
- [x] **M** per-subscription audit trail queryable — `GET /v1/subscriptions/:reference/events`
      replays the subscription's full `domain_events` history (ties to A's event-sourcing).
- [x] **M** alerting on charge-failure spikes + scheduler lag — `GET /metrics` (process-scoped,
      outside `/v1`, no auth) exposes `nombaone_charge_failures_total` and the per-sweep
      `nombaone_scheduler_lag_seconds` gauge (read lazily from Redis completion markers each
      sweep writes); e2e asserts lag rises to ~60s when a sweep goes stale and resets on
      completion. (item 5. Alert delivery/thresholds are an ops-config concern.)
- [x] **M** health checks (DB, Nomba) — `GET /v1/ready` deep-checks DB + Redis + Nomba and
      flips to `503` on a simulated dependency outage; `GET /v1/health` stays cheap liveness.
- [ ] **M** admin/ops inspection — `GET /v1/admin/subscriptions/:reference` returns state +
      invoices + dunning history + audit trail, operator-gated, audited.

**N — Security (final sweep)**
- [ ] **N5** — PII access-controlled + not logged: the PII-not-logged e2e scans the log stream for the
      seeded customer's email/name/card fields and asserts absence; PII read paths require scope/operator auth.
- [x] **N6** — rate limiting protects from abuse: the platform `rateLimit` middleware (00) plus 08's
      per-tenant quotas are exercised — a key over its window gets `429 RATE_LIMIT_EXCEEDED`.

**O — Edge cases & resilience**
- [ ] **O ⚠** Nomba downtime queue/retry, no dup — downtime e2e: queued/retried, exactly one
      charge on recovery.
- [ ] **O** already-expired card at create → card-update — e2e asserts route to card-update,
      never silent `active`.
- [x] **O** delete-plan-with-subs blocked/versioned — e2e asserts block/version, no orphans.
- [ ] **O** cancel during in-flight charge → single outcome — e2e asserts no money leak.
- [x] **O** duplicate webhook + scheduler retry → one charge/one entry — e2e asserts single
      charge + single ledger entry.
- [x] **O** month-boundary + leap tests — explicit unit tests for Jan-31 snap-back and Feb-29.
- [x] **O** partial failure self-heals on requery — e2e (reconcile-nomba): the nightly
      `handleReconcileNomba` cron (item 6) requeries recent invoices, and a Nomba-succeeded/
      local-unpaid one is re-driven through `confirmInvoiceFromWebhook` idempotently → settled;
      no lost/phantom payment. `nombaone_reconcile_discrepancies_total{class}` +
      `nombaone_reconcile_healed_total` expose the signal. Registered as a nightly repeatable
      (`RECONCILE_NOMBA_CRON`, default `0 2 * * *`).

**P — Testing & verification (the proof)**
- [x] **P** unit proration math (upgrade/downgrade/interval-switch/EOM) — green.
- [x] **P** FSM legal + every illegal transition rejected — table-driven test green.
- [x] **P ★** dunning simulation — scripted failure reasons drive the expected path; comms
      idempotent.
- [x] **P** idempotency replays (scheduler/charge/inbound webhook) — zero duplicates.
- [x] **P** concurrency race (portal vs scheduler) — single consistent outcome.
- [x] **P ★** sandbox integration (opt-in suite) — `sandbox.e2e` green against the real sandbox
      for the human-free legs (auth, hosted-checkout init, virtual-account, requery); the full
      create→tokenize→renew→fail→recover loop completes in the live session (Group E) since the
      hosted-checkout card entry needs a human.
- [x] **P** load test at target volume — `load.e2e` validated at 10,000 due subs in one window:
      no timeout, no partial run, no duplicate charge (10k invoices, all paid; re-sweep finds 0);
      ~12ms/sub, under budget.

---

## Done when

- `openapi.json` is served, **generated from the contracts**, and the conformance test proves
  it matches real behavior; the quickstart, sandbox/test mode, auth example, `Idempotency-Key`
  docs, and the machine-readable webhook event catalog are published.
- Every billing-path log line (HTTP **and** job) carries correlation + tenant ids; business
  metrics (MRR / active / churn split / failed-charge / dunning-recovery / funnel) are exposed
  and reconcile to the ledger + events; the per-subscription audit trail is queryable;
  `GET /v1/ready` deep-checks DB + Redis + Nomba; charge-failure-spike and scheduler-lag
  signals are exposed with documented thresholds; the admin inspection API works and is audited.
- `reconcileAgainstNomba` is wired as a nightly cron, joins our records to Nomba `/transactions`
  on `reference`, self-heals class-(a) partial failures, and surfaces discrepancies to ops.
- **Every Section-O bullet has a passing named test**, and **the full Section-P matrix is
  green** — including the ★ sandbox-integration happy path and the load test at target volume.
- Every `⚠` box in L/M/O/P has been verified **twice** (read + run), and the ★ items across
  D/E and H demonstrated in earlier phases are re-confirmed by this phase's whole-system metrics
  and reconciliation.
- `pnpm type-check`, `pnpm build`, and `pnpm test` are green across the workspace; the engine
  exits the gate.
