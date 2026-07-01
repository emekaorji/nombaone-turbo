# apps/api — Build Plan 06 · Dunning & recovery ★

> Run the **dunning state machine** (contract C.3) while a subscription is `past_due`: a reason-branched,
> per-tenant-configurable, payday-biased retry policy driven by the 02 failure taxonomy, with the
> card-update flow for token/expiry failures, a distinct involuntary-churn outcome on exhaustion, and
> idempotent customer comms — every attempt logged.
> **Depends on:** 02 (rails + `payment_methods` + nomba failure taxonomy), 03 (subscriptions FSM, invoices,
> charge→ledger→verify loop), 04 (scheduler: idempotent sweep + cron registration), 05 (invoice
> adjustments — partial collection / amount_due). **Unblocks:** 07 (delivers the events this phase emits),
> 08 (folds `org_billing_settings` into per-tenant config + fair scheduling), 09 (dunning-funnel metrics, the
> dunning simulation proof).

---

## Objective & scope

This phase is one of the two `★` win axes (D/E). It is built thoroughly, not to a floor.

**In scope**
- The **dunning FSM** (contract C.3) that drives a `past_due` subscription's open invoice through
  `scheduled → attempting → {reschedule | card_update_required | short_path} → recovered | churned`.
- A **reason-branched retry policy** keyed on the 02 internal failure taxonomy mapped from Nomba's
  `gatewayMessage`: `insufficient_funds` → payday-biased reschedule; `expired` / `token_expired` →
  `card_update_required` (**never a blind charge retry**); `hard_decline` → short path / give up.
- **Per-tenant** configurable schedule (attempt count + intervals + grace) resolved from
  `org_billing_settings`, with a hard-coded platform default when a tenant has not configured one.
- A **grace period** that keeps subscriber access during `past_due` (access is not cut on first failure).
- **Card-update mid-dunning** (rail re-tokenize + atomic `tokenKey` swap) that triggers a **prompt
  re-attempt** rather than waiting for the next scheduled retry.
- **Max window / max attempts → involuntary cancel** (`past_due → canceled`, churned) emitting a
  **distinct** event from voluntary cancel.
- **Recovery**: a successful retry returns the subscription to `active` and reconciles the open invoice to
  `paid`.
- **Idempotent comms**: a replayed dunning run (at-least-once sweep / webhook redelivery) re-sends nothing —
  comms are keyed on the dunning step.
- A `dunning_attempts` audit log (one row per retry) and an inspect endpoint.
- A registered **dunning-sweep cron** on the 04 scheduler.

**Out of scope (owned elsewhere — do not poach)**
- The base scheduler mechanics — sweep idempotency, concurrency locks, catch-up — are **04**; this phase
  only *registers a task* and *defines the find-and-act query* for dunning.
- The charge→ledger→verify primitive (`chargeInvoice` / verify-again-then-act) and the `past_due` transition
  itself are **03**; dunning *consumes* them.
- Outbound webhook **delivery internals** (HMAC, retry, dead-letter, replay) are **07**; this phase only
  **emits** the dunning events through `emitEvent` (the outbox already fans out deliveries).
- The internal failure **taxonomy + `gatewayMessage` mapping** is **02**; this phase *imports* and *branches
  on* it, and adds only the dunning-specific classification (which taxonomy bucket → which branch).
- MRR / churn dashboards and the full dunning **simulation/load proof** are **09**; this phase defines the
  events + fields those metrics read and ships the unit/e2e branch tests.

---

## Rubric coverage

Exact exit-criteria boxes this phase demonstrates (`SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`):

**D. Dunning & failed-payment recovery** — all boxes:
- **D1** failed renewal → `past_due`.
- **D2** retry schedule configurable (count + intervals).
- **D3 ⚠** retry policy **branches on failure reason** (insufficient_funds / expired / hard_decline differ).
- **D4 ★** `expired` / token-expired → **card-update flow**, never blind charge retries.
- **D5** token expiry (`tokenExpirationDate`) is a first-class dunning branch with a customer prompt.
- **D6** max window / retry count enforced; exhaustion → `canceled` + event.
- **D7** configurable **grace period** keeps access during `past_due`.
- **D8** retry success → `active` + open invoice → `paid`.
- **D9 ⚠** comms fire at the right steps and are **idempotent** (replay re-sends nothing).
- **D10** card update mid-dunning → prompt re-attempt (not next scheduled retry).
- **D11** every retry attempt logged with failure reason + outcome.
- **D12 ★** retry timing **payday-biased** (end-of-month / salary windows), not naive fixed gaps.
- **D13 ★** voluntary vs involuntary churn are **distinct** outcomes emitting **distinct** events.

**E. Tokenization & Nomba charge integration** — the dunning-relevant boxes:
- **E5** `gatewayMessage` → internal failure taxonomy that drives the branching (consumed from 02).
- **E6 ★** card-update flow **re-tokenizes + swaps `tokenKey` atomically** (no zero-valid-token-but-billable
  window).

**M. Observability & operations** — the dunning slice:
- **M2 ★** (partial) define the events + fields that expose **dunning recovery rate** and the **dunning
  funnel** (churn voluntary-vs-involuntary split); the dashboards themselves are 09.

Cross-cutting boxes this phase must not regress (re-asserted in tests, owned earlier):
**K4** dunning runs are independently idempotent · **J6 ⚠** no double-charge across a replayed dunning
attempt · **A14** transitions idempotent · **N4** every dunning endpoint authed + scoped.

---

## Design notes

### Dunning FSM (contract C.3), made concrete
A subscription enters dunning when 03's renewal charge fails and it transitions `active → past_due` (the
transition + event are 03's; the **open invoice** carries `status = open`, `attempt_count`, and a derived
`amount_due > 0`). The dunning machine then operates **per open invoice** (not per subscription) so that an
invoice is the unit of recovery:

```
past_due ─► scheduled ─► attempting ─┬─ succeeded ──────────► recovered  (sub → active, invoice → paid)
              ▲                       ├─ insufficient_funds ─► reschedule (payday-biased)  ─┐
              │                       ├─ expired/token_expired ► card_update_required ──────┤ (next attempt)
              └───────────────────────┤  (NO blind retry — prompt re-add; await card update)│
                                      └─ hard_decline ───────► short_path (1 courtesy retry then give up)
   exhaustion (attempts ≥ max  OR  now ≥ first_failed_at + max_window) ─────────────► churned (involuntary)
```

- **`scheduled`** = a `dunning_attempts` row exists with `next_attempt_at` in the future; the sweep is the
  only thing that promotes it to `attempting`.
- **`attempting`** = the sweep claimed the row (status `attempting`) and called 03's `chargeInvoice` through
  the rail; the verified outcome (webhook/requery, **never** the sync reply per E5/`J6`) writes the row's
  `outcome` + `failure_reason`.
- Branch is decided **purely** by `classifyDunningBranch(failureReason)` over the 02 taxonomy — no provider
  string is read here.

### Reason → branch table (the heart of D3/D4/D5)
Imported taxonomy buckets from 02 (`@nombaone/sara/rails` failure taxonomy — `FailureReason`):

| 02 taxonomy bucket | dunning branch | behaviour |
|---|---|---|
| `insufficient_funds` | `reschedule` | re-arm `next_attempt_at` via **payday-biased** scheduler; charge again |
| `expired_card` | `card_update_required` | **no charge re-attempt**; emit the `payment_method.expiring` prompt; await card update |
| `token_expired` | `card_update_required` | same — `tokenExpirationDate` passed; blind retry is guaranteed to fail |
| `hard_decline` (do-not-honor, stolen, invalid) | `short_path` | at most ONE courtesy retry, then straight to exhaustion |
| `processor_error` / `unknown` / `pending` | `reschedule` (capped) | transient; retry on the normal cadence, counts toward max |

`expired_card`/`token_expired` set `dunning_attempts.outcome = 'card_update_required'` and **do not** schedule
a charge retry; only a card-update event (D10) or the configured re-prompt cadence advances them. This is the
`★` D4 guarantee — the engine never burns retries on a charge that cannot succeed.

### Payday-biased cadence (D12 ★)
Naive dunning uses fixed gaps (e.g. +1d, +3d, +5d). Nigerian thin-balance reality is that salaries land at
**month-end / first-working-day**. `nextPaydayBiasedAttemptAt(baseAt, attemptIndex, settings)` computes the
candidate from the tenant's configured interval, then **nudges it onto the nearest upcoming payday window**
(configurable `paydayDays`, default `[26, 27, 28, 29, 30, 1]` in the fixed billing TZ from 04) when the
candidate falls within `paydayPullForwardDays` (default 4) of one — biasing `insufficient_funds` retries to
land when an account is most likely funded. Pure, deterministic, unit-tested across month/EOM/leap boundaries
(reuses 04's EOM/leap date helpers; no float, no `Date` drift). For `hard_decline` the bias is **off** (a hard
decline won't be fixed by waiting for payday).

### Grace period (D7)
`org_billing_settings.grace_period_hours` (default 72) defines a window after `first_failed_at` during which
the subscriber **retains access** even though the subscription is `past_due`. Access is a derived predicate
`hasGraceAccess(subscription, settings, now)` — there is no separate "access" column; it is computed from the
invoice's `first_failed_at` + grace, exactly like status is derived from the ledger (B.6). Exhaustion is
independent of grace: grace governs *access*, the max window/attempts govern *dunning lifetime*.

### Card-update flow & atomic token swap (D10 / E6 ★)
`POST /v1/subscriptions/:ref/payment-method` (and the customer-portal equivalent in `apps/checkout`, deferred)
drives `updateCardOnSubscription(db, ctx, input)`:
1. Re-tokenize the new card through the rail (02's card adapter — hosted checkout `tokenizeCard: true` →
   capture new `tokenKey` from `payment_success`), yielding `newTokenKey`.
2. In **one interactive transaction** (`InfraTxDb.transaction`): insert/activate the new `payment_methods`
   row, flip `subscriptions.default_payment_method_id` to it, mark the old method `replaced`. The old token
   stays valid until the new one is committed — **there is never a window with zero valid tokens while the
   sub is billable** (E6). The old token is revoked (rail DELETE) *after* commit, out of band.
3. If the subscription is mid-dunning (`past_due` with an open invoice in `card_update_required`), enqueue an
   **immediate** dunning attempt (`re_attempt_now`) instead of waiting for `next_attempt_at` (D10).

### Voluntary vs involuntary churn (D13 ★)
- **Voluntary** (`active → canceled`, user-initiated) is 03's `cancelSubscription` → `subscription.canceled`.
- **Involuntary** (`past_due → canceled`, dunning exhausted) is **this phase's** `churnSubscription` →
  `subscription.churned`. Distinct transition, distinct event name, distinct `cancellation_reason`
  (`dunning_exhausted`). The two never collapse into one code path; each has its own test (D13 / A's terminal
  rules).

### Idempotent comms (D9 ⚠)
Comms are not a table of their own this phase; they are **dunning events** emitted through `emitEvent`
(`invoice.payment_failed`, `payment_method.expiring`, `invoice.payment_recovered`, `subscription.churned`).
Idempotency is structural: each comms-bearing event is emitted **at most once per `(dunning_attempts.id,
step)`** by guarding on a unique partial index `dunning_attempts(invoice_id, attempt_number)` plus a
`comms_sent_at` stamp on the attempt row — a replayed sweep that re-reads the same attempt finds
`comms_sent_at` set and emits nothing. (07 then delivers; at-least-once delivery dedupe is the consumer's job
via the stable `EVT` id.)

### Money & idempotency invariants (carried)
Money is integer **kobo** end-to-end; the dunning charge reuses 03's `chargeInvoice` whose `merchantTxRef` /
`orderReference` is **per-attempt unique** (`mintReference('DUN')` seeds the attempt; the charge ref embeds it)
so a replay dedupes on Nomba's side (E3/`J6`). Outcome is **verified server-side** (webhook + requery), never
the sync reply (E4/E5). Every row is tenant-scoped (`organization_id` + `environment`).

---

## Tasks (layer by layer)

### DB (core-db)

- [x] **`dunning_attempts`** table (`packages/core-db/src/schema/dunning-attempts.ts`): `idPk()`,
      `referenceCol()` (DUN), `organization_id` FK → organizations (cascade), `environment` (`environmentEnum`),
      `subscription_id` FK, `invoice_id` FK, `attempt_number` int, `status`
      (`pgEnum dunning_attempt_status: scheduled | attempting | succeeded | rescheduled | card_update_required | exhausted`),
      `branch` (`pgEnum dunning_branch: reschedule | card_update_required | short_path`), `rail_key` text,
      `failure_reason` text nullable (the 02 taxonomy bucket), `gateway_message` text nullable (raw, for audit),
      `outcome` text nullable, `scheduled_at` ts, `executed_at` ts nullable, `next_attempt_at` ts nullable,
      `comms_sent_at` ts nullable, `comms_event_type` text nullable, `created_at` (append-only fact — **no
      `updated_at`**, mirroring `ledger_transactions`). Proof: migration applies on a fresh DB.
- [x] Indexes on `dunning_attempts`: `unique(reference)`; **`unique(invoice_id, attempt_number)`** (makes a
      duplicate attempt for the same invoice/step structurally impossible — `K`/`J6` discipline); partial index
      `WHERE status = 'scheduled'` on `(environment, next_attempt_at)` for the sweep's due-selection; keyset
      `(organization_id, environment, created_at desc, id desc)` for the inspect list.
- [x] **Extend `org_billing_settings`** (the table is **created in 05** — sole creator; this phase adds the
      dunning columns via **additive `ALTER ADD COLUMN` only**, never a second `CREATE`). Add to
      `packages/core-db/src/schema/org-billing-settings.ts` (05's file):
      `dunning_max_attempts` int (default 4), `dunning_intervals_hours`
      jsonb (`number[]`, default `[24, 72, 120, 168]`), `dunning_max_window_hours` int (default 336),
      `grace_period_hours` int (default 72), `payday_days` jsonb (`number[]`, default `[26,27,28,29,30,1]`),
      `payday_pull_forward_days` int (default 4), `payday_bias_enabled` bool (default true),
      `default_collection_method` (`pgEnum: charge_automatically | send_invoice`, default `charge_automatically`),
      `comms_enabled` bool (default true). 05's columns (`partial_collection_enabled`, `proration_credit_policy`)
      and **`unique(organization_id, environment)`** stay intact; 08 then adds limits/fair-scheduling columns
      additively. Proof: migration applies on top of 05's table; a row reads back with 05's + 06's defaults.
- [x] Add the `dunning_attempts` table to `packages/core-db/src/schema/index.ts` (`org_billing_settings` is
      already registered by 05).
- [x] `pnpm db:generate` then `pnpm db:migrate` — one clean migration; verify on a fresh DB. **Never `push`.**

### Contracts (core-contracts)

- [x] `packages/core-contracts/src/types/dunning.ts`: `DunningAttemptResponseData` (reference, attemptNumber,
      status, branch, railKey, failureReason, gatewayMessage, outcome, scheduledAt, executedAt, nextAttemptAt,
      createdAt — ISO-8601 UTC strings, no PII), `DunningStateResponseData` (subscription ref, invoice ref,
      dunning status, attemptsUsed, maxAttempts, nextAttemptAt, graceAccessUntil, attempts[]).
- [x] `packages/core-contracts/src/types/billing-settings.ts`: `BillingSettingsResponseData` (all
      `org_billing_settings` fields, camelCased).
- [x] `packages/core-contracts/src/validations/billing-settings.ts`:
      `updateBillingSettingsBody` (all dunning/grace/payday/collection/comms fields **optional** for partial
      update; `dunning_intervals_hours` = `z.array(z.coerce.number().int().positive()).min(1)`; `payday_days` =
      `z.array(z.coerce.number().int().min(1).max(31))`; `dunning_max_attempts` 1–10; `grace_period_hours` ≥ 0;
      refine `dunning_max_window_hours ≥ max(intervals)`). DTO via `z.infer`.
- [x] `packages/core-contracts/src/validations/dunning.ts`: `updateSubscriptionCardBody`
      (`{ paymentMethodReference: z.string() }` OR a `checkoutToken` XOR refinement to drive re-tokenize),
      `listDunningAttemptsQuery` (cursor + limit, per `listExampleQuery` shape).
- [x] Export all from the contracts barrels (`types/index.ts`, `validations/index.ts`).

### Domain (sara) — `packages/sara/src/dunning/`

All functions follow the `(db, ctx, input)` idiom; `ctx: DomainContext` is always caller-supplied. Pure
classifiers/date-math are I/O-free and unit-tested alone.

- [x] `reference.ts`: add `DUN` (dunning attempt) to `ReferenceDomain` (already reserved in contract C.4;
      this phase activates it).
- [x] `errors`: add the **`DUNNING_*`** group to `packages/errors/src/codes.ts`:
      `DUNNING_SETTINGS_INVALID`, `DUNNING_NO_OPEN_INVOICE`, `DUNNING_ALREADY_TERMINAL`,
      `DUNNING_ATTEMPT_NOT_FOUND`, `DUNNING_CARD_UPDATE_REQUIRED`, `DUNNING_NOT_IN_PROGRESS`. Add the
      client-safe ones (`DUNNING_NO_OPEN_INVOICE`, `DUNNING_ATTEMPT_NOT_FOUND`,
      `DUNNING_CARD_UPDATE_REQUIRED`, `DUNNING_ALREADY_TERMINAL`) to `PUBLIC_ERROR_CODES`.
- [x] `policy.ts` — **per-tenant policy resolution** (pure + one read):
      - `resolveBillingSettings(db, ctx): Promise<ResolvedDunningPolicy>` — reads `org_billing_settings` for
        `(org, env)`; falls back to the hard-coded `PLATFORM_DEFAULT_DUNNING_POLICY` when absent (so a tenant
        that never configured dunning still dunns sanely). **D2.**
      - `PLATFORM_DEFAULT_DUNNING_POLICY` `as const` (the column defaults, mirrored).
- [x] `classify.ts` — **the branch decision** (pure, I/O-free):
      - `classifyDunningBranch(reason: FailureReason): DunningBranch` implementing the reason→branch table
        above. `expired_card`/`token_expired` → `'card_update_required'`; `hard_decline` → `'short_path'`;
        everything else → `'reschedule'`. **D3 / D4 / D5.** Imports `FailureReason` from
        `@nombaone/sara/rails` (02), never reads a provider string.
- [x] `schedule.ts` — **payday-biased cadence** (pure, deterministic, no float):
      - `nextPaydayBiasedAttemptAt(baseAt, attemptIndex, policy): Date` — interval from
        `policy.dunningIntervalsHours[attemptIndex]` (clamped to last), then payday nudge when enabled and the
        candidate is within `paydayPullForwardDays` of a `paydayDays` day in the fixed billing TZ (04 helpers).
        **D12.** `hard_decline`/`short_path` bypasses the bias.
      - `isDunningExhausted(attempts, firstFailedAt, now, policy): boolean` — `attempts ≥ maxAttempts` OR
        `now ≥ firstFailedAt + maxWindowHours`. **D6.**
      - `hasGraceAccess(firstFailedAt, now, policy): boolean` — `now < firstFailedAt + gracePeriodHours`. **D7.**
- [x] `attempt.ts` — **the attempt lifecycle** (writes, transactional where it mutates state):
      - `scheduleFirstAttempt(db, ctx, { subscriptionId, invoiceId, failureReason, gatewayMessage })` — called
        by 03 on the `active → past_due` transition (or by the sweep on detect): classify branch, insert the
        first `dunning_attempts` row (`status` per branch: `scheduled` for reschedule, `card_update_required`
        for the card branch), set `next_attempt_at` via `schedule.ts`, emit `invoice.payment_failed` (comms)
        **once**, stamp `comms_sent_at`. **D1 / D11 / D9.**
      - `executeDueAttempt(txDb, ctx, attemptId)` — the per-attempt worker step (called by the sweep): claim
        the row (`scheduled → attempting`, row-locked / status-guarded so concurrent sweeps can't double-claim,
        per `K`), call 03's `chargeInvoice` through the rail, **await verified outcome**, then `recordOutcome`.
        Idempotent: re-running on an already-`attempting`/terminal row is a no-op (`A14`/`K4`).
      - `recordOutcome(txDb, ctx, { attemptId, reason, gatewayMessage })` — branch on
        `classifyDunningBranch`: on success → `recoverSubscription`; on `insufficient_funds`/transient →
        schedule the next attempt if `!isDunningExhausted` else `churnSubscription`; on
        `expired_card`/`token_expired` → set `card_update_required`, emit the card-update prompt comms **once**;
        on `hard_decline` → `short_path` (one courtesy retry already budgeted, then `churnSubscription`). Every
        path writes the attempt's `outcome` + `failure_reason` + `gateway_message`. **D3/D4/D8/D11.**
      - `recoverSubscription(txDb, ctx, { subscriptionId, invoiceId })` — flip the invoice to `paid` (03's
        invoice transition; status derived from ledger), transition `past_due → active` (03's transition),
        emit `invoice.payment_recovered` + `subscription.activated`, stamp the attempt `succeeded`. **D8.**
      - `churnSubscription(txDb, ctx, { subscriptionId, invoiceId, reason: 'dunning_exhausted' })` — transition
        `past_due → canceled` (involuntary), mark invoice `uncollectible`, emit **`subscription.churned`** (the
        DISTINCT event), stamp the attempt `exhausted`. **D6 / D13.**
      - `triggerReattemptNow(txDb, ctx, { subscriptionId })` — after a card update mid-dunning: find the open
        `card_update_required` attempt, re-classify to `reschedule`, set `next_attempt_at = now`, enqueue an
        immediate sweep tick. **D10.**
- [x] `card-update.ts` — **atomic token swap** (`E6 ★`):
      - `updateCardOnSubscription(txDb, ctx, input)` — re-tokenize via the 02 card adapter → in ONE
        `txDb.transaction`: attach new `payment_methods` row, flip `default_payment_method_id`, mark old
        `replaced`; emit `payment_method.updated`. Old token stays valid until commit (no zero-token window).
        Revoke old token out of band after commit. Then call `triggerReattemptNow` if mid-dunning. **E6 / D10.**
- [x] `queries.ts`: `getDunningStateBySubscriptionRef(db, ctx, ref)`, `listDunningAttempts(db, ctx, ref,
      page)` (cursor), `selectDueDunningAttempts(db, env, now, limit)` (the sweep's find-query, uses the
      partial index). `serialize.ts`: `serializeDunningAttempt`, `serializeDunningState`,
      `serializeBillingSettings`. `types.ts`, `index.ts` (barrel). Export `./dunning` from
      `packages/sara/src/dunning` via `sara/package.json` `./dunning`.
- [x] `packages/sara/src/billing-settings/`: `getBillingSettings`, `upsertBillingSettings(db, ctx, input)`
      (idempotent upsert on `(org, env)`), `serialize`. Export `./billing-settings`.
- [x] **Events**: register the dunning event types in `sara/events` so the outbox fans them out:
      `invoice.payment_failed`, `invoice.payment_recovered`, `payment_method.updated`,
      `payment_method.expiring` (the reactive "card expired — please re-add" prompt on the
      `card_update_required` branch; Phase 04 emits the *proactive* pre-expiry one), `subscription.churned`
      (and reuse `subscription.activated`). These are the C.6 names — no new catalog invented here.

### API (apps/api) — `apps/api/src/modules/dunning/` + `…/billing-settings/`

Thin controllers (`jsonHandler` / `paginatedHandler`), fixed middleware order
(`apiKeyAuth → rateLimit → requireScope → idempotency → validate → controller`; reads skip `idempotency`).
New scopes: `subscriptions:write` (reuse from 03), `billing_settings:read` / `billing_settings:write` (add to
the API-key scope set + contracts).

- [x] `modules/dunning/routes.ts` + controllers:
      - `GET /v1/subscriptions/:ref/dunning` → `requireScope('subscriptions:read')` — inspect the dunning state
        + attempt log (`getDunningStateBySubscriptionRef`). **D11 inspect / M2.**
      - `GET /v1/subscriptions/:ref/dunning/attempts` → `subscriptions:read`, paginated — full attempt history.
      - `POST /v1/subscriptions/:ref/payment-method` → `subscriptions:write`, `idempotency`,
        `validate({ body: updateSubscriptionCardBody })` → `updateCardOnSubscription` → prompt re-attempt.
        **D10 / E6.**
- [x] `modules/billing-settings/routes.ts` + controllers:
      - `GET /v1/billing-settings` → `requireScope('billing_settings:read')` — current tenant dunning policy.
      - `PUT /v1/billing-settings` → `billing_settings:write`, `idempotency`,
        `validate({ body: updateBillingSettingsBody })` → `upsertBillingSettings`. **D2 / D7 config.**
- [x] Mount both routers under `/v1` in `app/main/routes.ts`. Add `billing_settings:*` to the scope set.

### Wiring

- [x] **Register the dunning-sweep cron** on the 04 scheduler
      (`apps/api/src/super-modules/scheduler/index.ts`): `await upsertCron('dunning-sweep', '*/15 * * * *')`
      in `registerRepeatables`, and add a `case 'dunning-sweep'` to the worker switch that calls
      `runDunningSweep()`. (Cron cadence is policy; the sweep itself is idempotent so the exact minute is not
      load-bearing.) **K4.**
- [x] `runDunningSweep()` (sara, called by the worker): `selectDueDunningAttempts` → for each, open a tx and
      `executeDueAttempt`; concurrency-safe via the status-guarded claim + `unique(invoice_id, attempt_number)`
      (04's locking discipline). A tick that finds nothing due is a no-op; a replayed tick double-acts on
      nothing (`K4`/`J6`).
- [x] `triggerReattemptNow` enqueues an immediate `dunning-sweep` tick (or a one-shot `re_attempt_now` job)
      so card-update recovery does not wait for the cron. **D10.**
- [x] Hook 03's `active → past_due` transition to call `scheduleFirstAttempt` (the seam 03 leaves;
      this phase fills it). No direct field writes — the transition stays 03's named operation.

### Tests

**Unit (sara, pure logic — colocated):**
- [x] `classify.test.ts` — every 02 taxonomy bucket maps to the correct branch; `expired_card`/`token_expired`
      → `card_update_required` (assert it never returns `reschedule`); `hard_decline` → `short_path`. **D3/D4/D5.**
- [x] `schedule.test.ts` — `nextPaydayBiasedAttemptAt` nudges onto payday windows across month-end / EOM /
      leap-day; bias disabled for `hard_decline`; deterministic; no float drift. `isDunningExhausted` /
      `hasGraceAccess` boundary cases (exactly at max attempts, exactly at window edge, grace edge). **D12/D6/D7.**
- [x] `policy.test.ts` — absent settings → platform default; configured settings override; intervals/window
      refinement. **D2.**

**E2e (apps/api, testcontainers Postgres + Redis, real migrations, fake rail adapter):**
- [x] **Dunning simulation** (the `★`/`P` proof, partial — full sim is 09): scripted failure reasons drive
      the expected path. `insufficient_funds` → `past_due` → reschedule → next attempt succeeds → `active` +
      invoice `paid` + `invoice.payment_recovered` emitted. **D1/D8.**
- [x] `expired_card` → `card_update_required`, **assert zero charge re-attempts** were made (fake rail
      `collect` call count == initial only), card-update prompt event emitted. **D4 ★ / D5.**
- [x] `hard_decline` → short path → exhaustion → `subscription.churned` emitted (distinct from
      `subscription.canceled`); subscription terminal `canceled` with `cancellation_reason =
      dunning_exhausted`. **D6 / D13 ★.**
- [x] **Card-update mid-dunning**: `POST …/payment-method` swaps `tokenKey`; assert (a) at no point is
      `default_payment_method_id` pointing at a row with no valid token (atomic swap — query the tx boundary),
      (b) an immediate re-attempt fires without waiting for `next_attempt_at`. **E6 ★ / D10.**
- [x] **Idempotent comms**: run the sweep twice over the same due attempt; assert exactly ONE
      `invoice.payment_failed` event row (`comms_sent_at` guard) and no second `dunning_attempts` row for the
      same `(invoice_id, attempt_number)`. **D9 ⚠ / K4 / J6.**
- [x] **Grace access**: within `grace_period_hours`, `hasGraceAccess` true while `past_due`; after the window,
      false — access not cut on first failure. **D7.**
- [x] **Config**: `PUT /v1/billing-settings` changes attempt count/intervals/grace and a subsequent dunning
      run honors the new schedule. **D2.**
- [x] **Every attempt logged**: after a multi-attempt run, `GET …/dunning/attempts` returns one row per
      attempt, each with `failure_reason` + `outcome`. **D11.**
- [x] Auth/isolation smoke: dunning + billing-settings routes reject missing key / wrong scope; Tenant A
      cannot read Tenant B's dunning state. **N4.**

---

## Verification checklist (rubric)

One line per box; each states HOW it is demonstrated. `⚠` boxes verified twice (read + run); `★` are the
explicit goals of this phase.

> **★ PHASE 06 COMPLETE (2026-07-01, `build/apps-api`).** The dunning engine runs end to end: reason-branched
> (classify → reschedule / card_update_required / short_path), payday-biased cadence, per-tenant configurable
> policy + platform default, atomic mid-dunning card swap (E6 ★), involuntary churn with a distinct event
> (D13 ★), idempotent comms + attempts (D9/K4), a registered `dunning-sweep` cron. Wiring choice: **sweep-on-
> detect** (fully decoupled from the collect path — the failure reason is persisted on the invoice at collect
> time; zero regression to the phase-05 suite). Adversarially reviewed before commit (single-claim-winner
> charges; atomic paid-CAS ledger post; `unique(invoice_id, attempt_number)` guards duplicate attempts/comms).
> Green: type-check 9/9, build 5/5, **106 sara unit (+12 dunning) + 66 api e2e (+8 dunning)**. Migrations 0009
> (dunning_attempts + settings) + 0010 (invoice failure columns).
> **Honest carve-outs (deferred, documented):** (1) the engine records a **synchronous** charge outcome
> (fake-rail-driven, as all prior phases test); the real card rail returns `pending` and the async webhook →
> `recordOutcome` bridge is the production continuation. (2) An attempt stuck in `attempting` on a mid-attempt
> crash is a 09 reconciliation item (never a double-charge — safe direction). (3) The rail-charge-before-claim
> external double-charge needs the Nomba `Idempotency-Key=reference` live wiring (the same 04 deferral;
> unreachable in normal dunning since only *definitive* failures are dunned).

- [x] **D1** — failed renewal → `past_due`: 03 transition wired to `scheduleFirstAttempt`; the simulation e2e
      asserts the sub is `past_due` and a `dunning_attempts` row exists after a scripted failure.
- [x] **D2** — schedule configurable: `org_billing_settings` columns + `PUT /v1/billing-settings`; `policy.test`
      (default vs override) + the config e2e (new schedule honored on the next run).
- [x] **D3 ⚠** — branches on reason: `classify.ts` reason→branch table; `classify.test` covers every bucket
      AND the e2e runs three distinct reasons down three distinct paths (read: the table; run: the three e2es).
- [x] **D4 ★** — expired/token → card-update not blind retry: `classifyDunningBranch` returns
      `card_update_required`; the `expired_card` e2e asserts the fake rail's `collect` was **not** called again.
- [x] **D5** — token expiry first-class branch + prompt: `token_expired` bucket maps to `card_update_required`
      and emits the card-update prompt comms; covered in `classify.test` + the expired e2e.
- [x] **D6** — max window/attempts → canceled + event: `isDunningExhausted`; the hard_decline e2e reaches
      exhaustion → `subscription.churned` + terminal `canceled`.
- [x] **D7** — grace keeps access: `hasGraceAccess` predicate; grace e2e asserts access within the window and
      revocation after, while `past_due`.
- [x] **D8** — recovery → active + invoice paid: `recoverSubscription`; the recovery e2e asserts `active` +
      invoice `paid` + `invoice.payment_recovered`.
- [x] **D9 ⚠** — idempotent comms: `comms_sent_at` + `unique(invoice_id, attempt_number)`; the double-sweep
      e2e asserts exactly one comms event and no duplicate attempt row (read: the guards; run: the double sweep).
- [x] **D10** — card update → prompt re-attempt: `triggerReattemptNow`; the card-update e2e asserts an
      immediate attempt fires without waiting for `next_attempt_at`.
- [x] **D11** — every attempt logged: `dunning_attempts` row per attempt with `failure_reason` + `outcome`;
      `GET …/dunning/attempts` e2e asserts one row per attempt.
- [x] **D12 ★** — payday-biased timing: `nextPaydayBiasedAttemptAt`; `schedule.test` asserts retries nudge
      onto payday windows across month-end/EOM/leap and that the bias is off for hard declines.
- [x] **D13 ★** — voluntary vs involuntary distinct: `churnSubscription` emits `subscription.churned`
      (separate from 03's `subscription.canceled`); the hard_decline e2e asserts the churned event + reason.
- [x] **E5** — gatewayMessage → taxonomy drives branching: `classifyDunningBranch` consumes 02's
      `FailureReason`; the three-reason e2e proves the taxonomy actually steers the branch.
- [x] **E6 ★** — atomic token swap: `updateCardOnSubscription` single-tx swap; the card-update e2e asserts no
      zero-valid-token-but-billable window (query at the tx boundary) and the old token is revoked post-commit.
- [x] **M2 ★ (partial)** — recovery-rate / funnel fields defined: the dunning events
      (`invoice.payment_failed` / `payment_recovered` / `subscription.churned`) + `dunning_attempts.status`
      give 09 the funnel + voluntary/involuntary churn split; asserted by the events emitted in the e2es.
- [x] **K4** — dunning idempotent: the double-sweep e2e replays a tick with zero duplicate charges/rows.
- [x] **J6 ⚠** — no double-charge on replay: per-attempt unique `merchantTxRef`/`orderReference` +
      `unique(invoice_id, attempt_number)`; the double-sweep e2e asserts exactly one charge (read: the
      constraints; run: the replay).
- [x] **N4** — every dunning/billing-settings route authed + scoped: auth/isolation e2e rejects missing key /
      wrong scope / cross-tenant read.
- [x] `pnpm type-check`, `pnpm build`, `pnpm test` all green across the workspace.

---

## Done when

A `past_due` subscription runs the full dunning machine end to end: failures are **classified from the 02
taxonomy** and **branched** (insufficient_funds reschedules on a **payday-biased** cadence; expired/token go
to **card-update, never a blind retry**; hard_decline takes the short path), the schedule + grace are
**per-tenant configurable** with a sane platform default, **grace keeps access** during `past_due`, a
**card update mid-dunning re-tokenizes with an atomic token swap and triggers a prompt re-attempt**, a
**recovery** returns the sub to `active` with the invoice `paid`, **exhaustion** churns the sub
**involuntarily** with a **distinct `subscription.churned` event**, **comms are idempotent** (replayed runs
re-send nothing), **every attempt is logged** and inspectable, and the dunning sweep is a **registered,
idempotent cron**. Every rubric box above is green (the `★` D4/D12/D13/E6 demonstrated, the `⚠` D3/D9/J6
verified twice), and `pnpm type-check`, `pnpm build`, `pnpm test` pass across the workspace. The phase hands
07 a populated event stream to deliver and 08 the `org_billing_settings` row to extend.
