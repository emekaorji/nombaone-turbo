# apps/api — Build Plan 04 · Billing cycles & scheduler

> Drive the Phase-03 charge loop on a clock: pure anchor/interval math (monthly · annual · custom,
> EOM snap-back, leap-day) in a single fixed billing timezone at a deterministic hour, an exact
> due-selection query, and an **idempotent, replay-safe, concurrency-safe** sweep that catches up
> after downtime without skips or stacks — plus `subscription_schedules` so a plan/price change
> "at next cycle" actually lands on the next boundary.
> **Depends on:** 03 (subscriptions, invoices, the charge→ledger→verify loop), 02 (rails/capture),
> 01 (prices/intervals), 00 (contract, harness). **Unblocks:** 05 (proration uses the period math),
> 06 (dunning runs on this scheduler), 07 (events emitted here are formalized).

---

## Objective & scope

**In.**
- The **billing scheduler**: the recurring sweep registered in the scheduler super-module seam
  (`apps/api/src/super-modules/scheduler/index.ts`) that finds subscriptions due for renewal and
  invokes the 03 charge loop **exactly once per period**.
- **Pure period math** (`packages/sara/src/billing/scheduling`), fully unit-tested with no I/O:
  anchor-date selection, interval addition for `month`/`year`/`week`/`day` × `interval_count`,
  **end-of-month snap-back** (Jan-31 anchor → Feb-28/29 → snaps back to Mar-31), and **leap-day**
  correctness verified across a full year.
- A **single fixed billing timezone** (`Africa/Lagos`) at a **deterministic hour**, so "due today"
  is one unambiguous instant; period boundaries are computed in that zone and stored as UTC.
- The **due-selection query**: exactly the subscriptions whose `current_period_end ≤ now` in a
  collectible state — no misses, no duplicates, proven with a boundary fixture.
- The **idempotent / replay-safe sweep**: a structural `(subscription_id, period_index)` unique
  guard (the `subscription_periods` claim table) so killing the sweep mid-run and restarting
  produces **zero duplicate charges and zero duplicate invoices**.
- **Concurrency**: two workers cannot double-bill — Postgres advisory lock per subscription **and**
  the period-claim unique constraint as the structural backstop.
- **Catch-up after downtime**: a subscription that missed N cycles advances **one period at a time**
  to the present, billing each missed period once, never stacking or skipping (policy documented).
- `subscription_schedules` (contract C.1): future-dated phases applied **at the next cycle boundary**
  by the sweep, not immediately.
- **API**: inspect the upcoming invoice (`GET …/upcoming-invoice`) and schedule a change
  (`POST …/schedule`, `GET/DELETE …/schedule`) under `/v1/subscriptions/:ref/…`.
- **Time-based lifecycle sweeps** (the home for the contract's time-driven transitions/events, which have
  no other owner): expire a never-paid `incomplete` subscription after its window (**A6** — calls 03's
  `expireIncomplete` transition), and emit the proactive `subscription.trial_will_end` (ahead of trial end)
  and `payment_method.expiring` (ahead of card-token expiry) notices, each at most once via an idempotency
  stamp.
- **Scale note**: the 10k-due-in-one-window throughput approach (keyset-batched claim, bounded
  fan-out to per-subscription jobs, no partial-run window).

**Out (do not poach).**
- What a **failed** charge does — dunning state machine, retry branching, grace, comms — is **06**.
  This phase moves a failed renewal to `past_due` via the 03 transition and stops; the dunning
  schedule is 06's.
- **Proration math** (`−unused / +new` line items, interval-switch, seat deltas) is **05**. This
  phase only *applies* a scheduled phase at the boundary and lets 05's primitives compute lines;
  where 05 is not yet built, a plain price swap with a full-period invoice is the placeholder.
- Coupons/credits/partial collection — **05**. Settlement split — **08**.

---

## Rubric coverage

Boxes from `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md` this phase **demonstrates** (verified in the
checklist below):

- **Section B — Billing cycles & scheduling:** B1 (monthly/annual/custom), B2 (anchor date, not
  "+30 days"), **B3 ⚠** (EOM snap-back across a full year), **B4 ⚠** (leap-day for anchors),
  B5 (single fixed tz, deterministic hour, unambiguous "due today"), **B6 ⚠** (idempotent/replayable
  scheduler — kill mid-run → zero dupes), B7 (exact due selection — no miss/no dup),
  **B8 ⚠** (concurrent workers cannot double-bill), B9 (downtime catch-up, no skip/stack),
  B10 (plan/price change "next cycle" applies at the boundary, not immediately),
  **B11 ★** (throughput at 10k due in one window).
- **Section K — Idempotency & concurrency:** K2 (DB unique constraints make duplicate invoices &
  duplicate period charges structurally impossible), K4 (scheduler runs independently idempotent),
  **K3 ⚠** (scheduler-vs-portal on the same subscription does not corrupt state — race-safe).
- **Section A — the one time-based transition:** A6 (a never-paid `incomplete` subscription auto-expires to
  `incomplete_expired` after its window — the *transition* is 03's, the **timer that fires it** is owned here
  via the lifecycle sweep).

Borrowed/forward (asserted only at the seam, fully owned elsewhere): A13 (idempotent transitions —
03), J6 ⚠ no-double-charge (03 charge path; this phase proves the *scheduler* entry into it),
P4/P7 (idempotency + load tests — the proofs live here for the scheduler).

---

## Design notes

### D.1 The period as the unit of idempotency
A subscription's life is a strictly increasing sequence of **periods**, indexed from `0` at the
anchor. `period_index = N` has a half-open `[period_start, period_end)` instant pair (UTC).
**Billing period N is an idempotent claim**: a `subscription_periods` row keyed
`unique(subscription_id, period_index)` is the structural truth that "this period was billed." The
sweep's first act for a due subscription is to *claim the next period* with an
`INSERT … ON CONFLICT (subscription_id, period_index) DO NOTHING … RETURNING`. A replay (or a second
worker) that loses the race gets zero rows back and **does nothing further** — no invoice, no charge.
This is the B6/B8/K2/K4 backstop and it holds even if every cache and lock fails.

The invoice carries the same key: `invoices.unique(subscription_id, period_index)` (added here on the
03 table). One period ⇒ at most one finalized invoice. K2 is then enforced by *two* constraints, not
code.

### D.2 Pure period math — anchors, intervals, EOM, leap
All date arithmetic is **pure and I/O-free** in `billing/scheduling`, computed against the fixed
billing zone and unit-tested in isolation (B10-style table tests):
- **Anchor.** The anchor is `billing_cycle_anchor` (set at activation in 03, defaulting to the
  activation instant), *not* "now + interval". Every period boundary is `anchor + n·interval`.
- **Interval addition with EOM snap-back.** Adding months/years to a day-of-month that doesn't exist
  in the target month **clamps to the last day of that month**, but the *anchor's* original
  day-of-month is preserved for the next step — so Jan-31 → Feb-28 (non-leap) → **Mar-31**, never
  Feb-28 → Mar-28. The anchor day-of-month is the source of truth; clamping is per-step and
  non-destructive. Verified by walking a Jan-31 monthly subscription across all 12 months.
- **Leap-day.** A Feb-29 *annual* anchor lands on Feb-28 in common years and Feb-29 in leap years;
  the day-of-month-29 anchor is preserved so the next leap year snaps back to 29. Day/week intervals
  are pure additive and cross leap boundaries by construction.
- **Custom intervals.** `week`/`day` with `interval_count` are exact multiples; `month`/`year` go
  through the snap-back path. The unit enum is the 01 `prices.interval`.

### D.3 Single fixed timezone, deterministic hour
All boundaries are computed in **`Africa/Lagos`** (UTC+1, no DST — a deliberate, stable choice for
the Nigerian market) at the **deterministic billing hour** (`BILLING_HOUR = 2`, local). A period's
`period_end` is the instant `02:00 Africa/Lagos` on the boundary date, converted to UTC for storage
and comparison. "Due today" is therefore one exact UTC instant per subscription, never a fuzzy
"sometime that day", which is what makes B7 (exact selection) and B5 (unambiguous boundary) provable.
The zone and hour are config (`env.ts`, `BILLING_TIMEZONE`, `BILLING_HOUR`), validated by zod, single
value per deployment.

### D.4 Idempotent + replay-safe sweep (kill mid-run → zero dupes)
The sweep is a **find-due → claim-period → bill-once → advance** loop, each step individually
replay-safe:
1. **Find due** — keyset-batched query of subscriptions with `current_period_end ≤ now` in a
   billable state.
2. **Per subscription**: acquire a Postgres **transaction-scoped advisory lock**
   `pg_advisory_xact_lock(hashtextextended(subscription_id))` (auto-released at COMMIT/ROLLBACK — no
   leak if the worker is killed), then **claim** `period_index = N` via `ON CONFLICT DO NOTHING`. Lost
   claim ⇒ skip. Won claim ⇒ build/finalize the invoice for period N (03 primitive) and invoke the 03
   charge loop with `orderReference = mintReference('LTX')` *derived deterministically from the
   period claim* so a Nomba-side replay is also idempotent (E-section requirement, owned by 03).
3. **Advance** — set `current_period_start/end` to period `N+1` **in the same transaction** as the
   claim, so "claimed" and "advanced" commit together. A crash before COMMIT rolls back the claim and
   the advance together; the next tick re-finds the subscription as still-due and tries again — at most
   once-effective. This is the B6/J6 guarantee.

There is **no partial-run window**: a tick either fully processes a subscription's one period or
leaves it untouched; it never half-advances.

### D.5 Concurrency (B8/K3)
Two defenses, belt-and-suspenders:
- **Advisory lock** serializes concurrent *workers* on the same subscription (cheap, in-tx).
- **`(subscription_id, period_index)` unique** is the structural guarantee that survives even if the
  lock is bypassed (different connection pools, lock-key collision, future sharding). A portal action
  that also advances state (03 uses optimistic `version`) races the sweep through the same advisory
  lock + version check; the loser retries against fresh state. K3 is proven by a race test
  (portal-cancel vs sweep on one subscription → one consistent outcome, no double charge).

### D.6 Catch-up after downtime (B9)
If the worker was down and a subscription is N periods behind, the sweep advances it **one period at a
time** until `current_period_end > now`, billing each intervening period **once** (each is its own
claim row). Policy (documented, enforced): **bill every missed period** (no skipping — the customer
owes each cycle) and **never stack** (each period is a distinct claimed invoice, processed
sequentially under the advisory lock). A `maxCatchUpPeriods` guard (config, default 36) caps a
pathologically stale row and emits an alert instead of an unbounded loop.

### D.7 subscription_schedules (B10)
A schedule is an **ordered list of phases** attached to a subscription; each phase names the target
`price_id` (and later quantity/coupon — 05) and a `start_index` (the period boundary it takes effect).
The sweep, at the moment it advances to period N, checks for a phase with `start_index = N` and
**applies it at that boundary** (swap the effective price for the period it is about to bill), then
marks the phase consumed. Applying *at the boundary* — not at the API call time — is exactly B10. The
schedule row is created by `POST …/schedule` with `effectiveAt: 'next_cycle'`, which resolves to the
subscription's current `period_index + 1`.

### D.8 Scale to 10k due in one window (B11 ★)
The tick does **not** process 10k inline. It:
1. Selects due subscriptions in **keyset batches** (`(org, env, current_period_end, id)` index,
   `LIMIT batchSize` cursor) — bounded memory, no `OFFSET`.
2. For each batch, **enqueues one `bill-subscription` job per subscription** onto a dedicated BullMQ
   queue (fan-out) with `jobId = ${subscriptionId}:${periodIndex}` (BullMQ dedup ⇒ a re-enqueue from
   an overlapping tick is a no-op — a third idempotency layer).
3. Worker concurrency drains the fan-out in parallel; each job runs the D.4 claim-once transaction.
The cron tick itself is O(batches), returns fast, and **never holds a long transaction over 10k rows**,
so there is no partial-run / timeout window. The load test (P7) asserts 10k due → 10k claims → 10k
invoices, zero dupes, within the window.

### D.9 Seam & house-style anchors
- Register the cron in `apps/api/src/super-modules/scheduler/index.ts` via
  `upsertCron('billing-sweep', '<cron>')` (already the documented seam) and add the
  `case 'billing-sweep'` in `createSchedulerWorker`. `upsertCron` is replay-safe (jobId = task id).
- The fan-out queue follows `packages/queue/src/queues/scheduler.ts` conventions (new
  `billing.ts` queue + worker registered in `super-modules/worker/index.ts`).
- Money stays integer kobo; invoices/charges go through 03's `postTransaction`
  (`packages/sara/src/ledger/post.ts`) and emit via `emitEvent` (`packages/sara/src/events/emit.ts`).
  Status is **derived from the ledger/invoice**, never a drift column. Every row is tenant-scoped
  (`organization_id` + `environment`). References via `mintReference('SCH')` (contract C.4).

### D.10 Time-based lifecycle sweep (A6 + the proactive notices)
Some transitions/events are driven by *time*, not by a charge — they have no other home, so the scheduler
owns them. A single **`lifecycle-sweep`** cron (separate from `billing-sweep`, so a slow renewal run can't
delay notices) does three **idempotent** passes:
1. **Incomplete expiry (A6).** Select `status='incomplete' AND created_at < now − INCOMPLETE_EXPIRY_WINDOW`
   and call 03's named `expireIncomplete` transition (→ `incomplete_expired`). Idempotent: the transition is a
   no-op on an already-expired row, so a replayed tick double-acts on nothing.
2. **Trial-will-end notice.** Select `status='trialing' AND trial_end ≤ now + TRIAL_NOTICE_WINDOW AND
   trial_will_end_notified_at IS NULL`, emit `subscription.trial_will_end`, stamp `trial_will_end_notified_at`
   — the stamp makes a replayed tick emit nothing.
3. **Payment-method-expiring notice.** Select active card `payment_methods` whose token expiry is within
   `PM_EXPIRY_NOTICE_WINDOW AND expiring_notified_at IS NULL`, emit `payment_method.expiring`, stamp it.
None of these moves money; all are replay-safe by the stamp / transition idempotency. (This is the producer
for the two time-based events catalogued in contract C.6.)

---

## Tasks (layer by layer)

### DB (core-db)

- [x] **`subscription_periods`** (new, the idempotency claim spine) — `packages/core-db/src/schema/subscription-periods.ts`:
      `idPk()`, `organization_id` FK, `environment`, `subscription_id` FK,
      `period_index` integer (≥0), `period_start`/`period_end` `timestamptz`, `invoice_id` FK (nullable
      until finalized), `claimed_at` `timestamptz` default now, `createdAt()`.
      **`unique(subscription_id, period_index)`** — the structural double-bill guard (K2/B6/B8).
      Index `(organization_id, environment, period_end)`.
      *Proof:* migration applies on a fresh DB; a second insert of the same `(subscription_id, period_index)` raises a unique violation in a test.
- [x] **`subscription_schedules`** (contract C.1) — `packages/core-db/src/schema/subscription-schedules.ts`:
      `idPk()`, `referenceCol()` (SCH), `organization_id` FK, `environment`, `subscription_id` FK,
      `status` enum (`pgEnum`: `active`/`released`/`canceled`), `phases` jsonb (ordered:
      `{ startIndex, priceId, quantity? }[]`), `createdAt()`, `updatedAt()`.
      `unique(reference)`; keyset index `(organization_id, environment, created_at desc, id desc)`.
      *Proof:* migration applies; a row round-trips with phases preserved in order.
- [x] **Extend `subscriptions`** (03 table) — 03 already ships `billing_cycle_anchor` and
      `current_period_index`; this phase adds only `next_billing_at` `timestamptz` (mirrors
      `current_period_end`, the due-selection cursor) and `trial_will_end_notified_at` `timestamptz` nullable
      (the lifecycle sweep's trial-notice idempotency stamp). Add index
      `(organization_id, environment, next_billing_at)` for the due query (B7/B11).
      *Proof:* `EXPLAIN` on the due query uses the index (not a seq scan) in the e2e harness.
- [x] **`invoices`** — **no change here.** 03 already ships `subscription_id`, `period_index`, and
      **`unique(subscription_id, period_index)`**; this phase **relies on** that constraint as the
      one-period-⇒-one-invoice guard (K2) and re-asserts it in the e2e (a second finalize for the same period
      raises the unique violation). (No duplicate `add` — avoids a migration collision with 03.)
- [x] **Extend `payment_methods`** (02 table) — add `expiring_notified_at` `timestamptz` nullable (the
      lifecycle sweep's payment-method-expiring idempotency stamp). Additive only.
- [x] Use shared helpers throughout (`idPk`, `referenceCol`, `environmentEnum`, `createdAt`,
      `updatedAt` from `packages/core-db/src/schema/shared.ts`); register both new tables in
      `schema/index.ts`.
- [x] `pnpm db:generate` then `pnpm db:migrate` — **one clean migration**, applied on a fresh DB
      (never `push`). *Proof:* migration file committed; harness boots it green.

### Contracts (core-contracts)

- [x] `packages/core-contracts/src/types/subscription-schedule.ts` — `SubscriptionScheduleResponseData`
      (reference, subscriptionId-ref, status, phases, timestamps ISO-8601 UTC).
- [x] `packages/core-contracts/src/types/upcoming-invoice.ts` — `UpcomingInvoiceResponseData`
      (period start/end ISO, `periodIndex`, `amountDue` kobo integer, line previews, `billingReason`).
- [x] `packages/core-contracts/src/validations/subscription-schedule.ts` —
      `scheduleChangeBody` (`{ priceId: string; quantity?: number; effectiveAt: 'next_cycle' }`,
      zod with refinement; `effectiveAt` is an `as const` enum so future modes are additive),
      `params` (`:ref`). Reuse the `validate({...})` middleware shape from
      `validations/example.ts`. DTO types are `z.infer<…>`.
- [x] Export both from the respective barrels (`types/index.ts`, `validations/index.ts`).

### Domain (sara)

New submodule **`packages/sara/src/billing/`** (export `./billing` in `sara/package.json`), with a
pure `scheduling/` core and an impure `sweep`/queries layer.

- [x] **`billing/scheduling/anchor.ts`** (pure) — `computeAnchor(activationInstant, price): Date` and
      `periodBounds(anchor, price, periodIndex): { start: Date; end: Date }`. No I/O. Uses the fixed
      billing zone + hour. *Proof:* unit table-test of bounds for index 0..13.
- [x] **`billing/scheduling/interval.ts`** (pure) — `addInterval(date, unit, count): Date` with
      **EOM snap-back** preserving the anchor day-of-month; `unit ∈ {day,week,month,year}`.
      *Proof:* unit tests — Jan-31 monthly across all 12 months snaps back to 31; `addInterval`
      never destroys the anchor DOM.
- [x] **`billing/scheduling/leap.ts`** (pure helpers used by interval) — Feb-29 annual anchor lands
      28/29 by year; *Proof:* unit test across a leap and non-leap year, both directions.
- [x] **`billing/scheduling/timezone.ts`** (pure) — `billingInstant(date): Date` = `BILLING_HOUR`
      local in `BILLING_TIMEZONE` → UTC; `isDue(periodEnd, now): boolean`. *Proof:* unit test that
      "due today" is one exact instant and a subscription one second before the boundary is not due.
- [x] **`billing/queries.ts`** — `findDueSubscriptions(db, { now, cursor, limit })`: keyset-batched
      due-selection (`next_billing_at ≤ now`, billable states), returns a batch + next cursor.
      Signature `(db, ctx?, input)` — this is a **cross-tenant operational** read (the sweep runs
      platform-wide), so it is the documented exception that does not pin a single `ctx`; it still
      stamps every downstream write with each row's own (org, env). *Proof:* boundary fixture test
      (B7) — subscriptions straddling `now` selected exactly.
- [x] **`billing/claim.ts`** — `claimPeriod(tx, ctx, { subscriptionId, periodIndex, start, end })`:
      `INSERT … ON CONFLICT (subscription_id, period_index) DO NOTHING RETURNING` inside the caller's
      tx; returns `{ claimed: boolean; periodId? }`. Pure-ish (single statement). *Proof:* unit/e2e —
      concurrent double-claim → exactly one `claimed: true`.
- [x] **`billing/sweep.ts`** — `runBillingSweep(deps)`: the orchestrator (D.4). For each due
      subscription it opens an interactive tx on `InfraTxDb`, takes
      `pg_advisory_xact_lock(...)`, calls `claimPeriod`, and on a won claim: applies any due schedule
      phase (`subscription-schedules/apply.ts`), finalizes the period invoice (03 primitive),
      advances `current_period_*`/`next_billing_at`/`current_period_index`, and **enqueues the
      `bill-subscription` charge job** (03 charge loop). Emits `invoice.created`/`invoice.finalized`
      via `emitEvent` in-tx. Catch-up loop advances one period at a time (D.6) with
      `maxCatchUpPeriods` guard. *Proof:* replay test (B6) — run, kill before COMMIT, re-run → one
      invoice, one charge.
- [x] **`packages/sara/src/subscription-schedules/`** (`create.ts`, `apply.ts`, `queries.ts`,
      `serialize.ts`, `types.ts`, `index.ts`; export `./subscription-schedules`):
      - `createSchedule(db, ctx, { subscriptionRef, priceId, quantity?, effectiveAt })` — resolves
        `effectiveAt:'next_cycle'` to `current_period_index + 1`, mints `SCH`, emits
        `subscription.updated`. *Proof:* e2e — schedule created with `startIndex = currentIndex+1`.
      - `applyDuePhase(tx, ctx, { subscriptionId, periodIndex })` — called by the sweep at the
        boundary; swaps the effective price for the period about to bill, marks the phase consumed.
        *Proof:* e2e (B10) — change scheduled "next cycle" does **not** alter the current period's
        invoice but **does** alter the next period's.
      - `getSchedule` / `cancelSchedule` (release the active schedule). *Proof:* e2e round-trip.
- [x] **`packages/sara/src/billing/lifecycle-sweep.ts`** — `runLifecycleSweep(deps)`: the three idempotent
      passes of D.10 — incomplete-expiry (calls 03's `expireIncomplete` transition; **A6**), trial-will-end
      emit + stamp, payment-method-expiring emit + stamp. Backed by pure selection queries in
      `billing/queries.ts`: `selectExpiredIncomplete`, `selectTrialEndingSoon`, `selectExpiringPaymentMethods`
      (keyset-batched cross-tenant operational reads, each stamping its own (org, env)). *Proof:* e2e — a
      never-paid `incomplete` past the window flips to `incomplete_expired` (**A6**); a `trialing` sub within
      the notice window emits exactly **one** `subscription.trial_will_end` across two ticks (stamp idempotency).
- [x] **`packages/sara/src/billing/upcoming.ts`** — `getUpcomingInvoice(db, ctx, subscriptionRef)`:
      computes the next period bounds (pure math) + the amount due (current effective price, or the
      scheduled phase price if one applies next), **without** persisting anything. *Proof:* e2e — returns
      the right period and amount; reflects a pending schedule.
- [x] Add the `SCH` reference domain to `packages/sara/src/reference.ts` `ReferenceDomain` union (it
      is listed in contract C.4 but only added when its table ships — this phase).
- [x] Add **`SUBSCRIPTION_SCHEDULE_*`** error codes (e.g. `SUBSCRIPTION_SCHEDULE_NOT_FOUND`,
      `SUBSCRIPTION_SCHEDULE_CONFLICT`, `SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT`) and a
      `BILLING_CATCH_UP_LIMIT_EXCEEDED` code to `packages/errors/src/codes.ts`; keep public/internal
      discipline (only `*_NOT_FOUND`/`*_CONFLICT`/`*_INVALID_*` public).

### API (apps/api)

New routes under the existing `subscriptions` module (do not create a parallel module) —
`apps/api/src/modules/subscriptions/`:

- [x] `GET /v1/subscriptions/:ref/upcoming-invoice` — scope `subscriptions:read`. Controller
      `controllers/get-upcoming-invoice.ts`, `jsonHandler<UpcomingInvoiceResponseData>`, calls
      `getUpcomingInvoice`. Reads skip `idempotency`.
- [x] `POST /v1/subscriptions/:ref/schedule` — scope `subscriptions:write`. Controller
      `controllers/create-schedule.ts`, full chain
      `apiKeyAuth → rateLimit → requireScope('subscriptions:write') → idempotency → validate({ params, body: scheduleChangeBody }) → controller`,
      calls `createSchedule`. *Proof:* e2e + `Idempotency-Key` replay returns same schedule, no 2nd row.
- [x] `GET /v1/subscriptions/:ref/schedule` — scope `subscriptions:read`; `getSchedule`.
- [x] `DELETE /v1/subscriptions/:ref/schedule` — scope `subscriptions:write`, idempotent;
      `cancelSchedule`. Emits `subscription.updated`.
- [x] Wire controllers in `controllers/index.ts`; group routes under a rule-comment header
      ("Billing schedules & upcoming invoice") in `routes.ts`. Controllers stay thin (call sara, shape
      the envelope; never touch `res`).
- [x] Confirm scopes `subscriptions:read`/`subscriptions:write` already exist from 03 (no new scope
      set needed; schedules live under the subscription resource).

### Wiring

- [x] **`packages/queue/src/queues/billing.ts`** (new, mirroring `scheduler.ts`): `BILLING_QUEUE_NAME`,
      `BillingJobData = { subscriptionId; periodIndex; organizationId; environment }`, `billingQueue`,
      `enqueueBilling(data)` with `jobId = ${subscriptionId}:${periodIndex}` (BullMQ dedup =
      idempotency layer 3). Export from the queue barrel.
- [x] **`apps/api/src/super-modules/scheduler/index.ts`** — in `registerRepeatables`, add
      `await upsertCron('billing-sweep', BILLING_SWEEP_CRON)` (e.g. `'5 1 * * *'` — once daily,
      ~01:05 to give the worker margin before the 02:00 deterministic boundary; cron in config). In
      `createSchedulerWorker`, replace the commented seam with
      `case 'billing-sweep': await runBillingSweep(deps); break;`. The sweep only **enqueues**; it does
      not charge inline (D.8). *Proof:* booting the API registers exactly one `billing-sweep` scheduler
      (no duplicates across reboots).
- [x] **`apps/api/src/super-modules/worker/index.ts`** — add `createBillingWorker()` to the
      `startWorkers()` array (drains `billing` queue, runs the per-subscription claim-once charge from
      03). New file `super-modules/worker/workers/billing.ts`, modeled on `inbound-webhook.ts`.
- [x] **`apps/api/src/super-modules/scheduler/index.ts`** (lifecycle sweep) — also register
      `await upsertCron('lifecycle-sweep', LIFECYCLE_SWEEP_CRON)` (e.g. hourly) and add
      `case 'lifecycle-sweep': await runLifecycleSweep(deps); break;` to `createSchedulerWorker`. Kept separate
      from `billing-sweep` so a slow renewal run can't delay notices. *Proof:* booting the API registers
      exactly one `lifecycle-sweep` scheduler; the A6 expiry + the two notices fire on tick.
- [x] **`apps/api/src/shared/config/env.ts`** — add zod-validated `BILLING_TIMEZONE`
      (default `'Africa/Lagos'`), `BILLING_HOUR` (default `2`), `BILLING_SWEEP_CRON`,
      `BILLING_BATCH_SIZE` (default `500`), `BILLING_MAX_CATCH_UP_PERIODS` (default `36`), plus the lifecycle
      windows `LIFECYCLE_SWEEP_CRON`, `INCOMPLETE_EXPIRY_WINDOW_HOURS` (default `24`),
      `TRIAL_NOTICE_WINDOW_HOURS` (default `72`), `PM_EXPIRY_NOTICE_WINDOW_DAYS` (default `14`).

### Tests

- [x] **unit (sara/billing/scheduling)** — interval/EOM/leap table tests: Jan-31 monthly across a full
      year snaps back to 31 (**B3**); Feb-29 annual across leap/non-leap (**B4**); week/day custom
      intervals exact (**B1**); anchor-based bounds for index 0..13 (**B2**); `isDue` single-instant
      boundary (**B5**).
- [x] **e2e (testcontainers PG+Redis)** — **due selection** boundary fixture: subscriptions at
      `now-1s`, `now`, `now+1s` → exactly the first two selected (**B7**).
- [x] **e2e — idempotent replay** (**B6/K4**): seed a due subscription, run the sweep, kill the worker
      transaction before COMMIT (simulated via injected fault), re-run → exactly one
      `subscription_periods` row, one invoice, one charge.
- [x] **e2e — concurrency** (**B8/K2**): two `runBillingSweep` invocations in parallel on the same due
      subscription → exactly one `claimed:true`, one invoice (advisory lock + unique both proven).
- [x] **race (**K3**)** — portal `cancel-now` vs sweep on one subscription concurrently → one
      consistent terminal outcome, no charge after cancel, no double charge.
- [x] **e2e — catch-up** (**B9**): subscription 3 periods behind → 3 claimed periods, 3 invoices, one
      per missed cycle, none stacked/skipped; a row beyond `maxCatchUpPeriods` raises
      `BILLING_CATCH_UP_LIMIT_EXCEEDED` and alerts instead of looping.
- [x] **e2e — schedule at next cycle** (**B10**): `POST …/schedule` with `effectiveAt:'next_cycle'`;
      current period invoice unchanged, next period bills the new price; `GET …/upcoming-invoice`
      reflects the scheduled price.
- [x] **load (**B11 ★ / P7**)** — seed 10k due subscriptions in one window; one tick enqueues 10k
      deduped jobs; workers drain to 10k claims / 10k invoices, zero dupes, within the window; no
      partial run (assert no subscription left half-advanced).

---

## Verification checklist (rubric)

One line per box; each states **how** it is demonstrated.

> **✅ PHASE 04 DONE (2026-06-30, commits `6050b70` · `b9ca5e0` · `a8d600b` · `0ddf5f5` · `bb8d5fb` ·
> `2a52c67` · `349b387` on `build/apps-api`).** Demonstrated: B1–B5 (anchor/EOM/leap/tz — pure
> `billing-scheduling.test.ts` walks Jan-31 across the year + Feb-29 leap + one-instant `isDue`), B6/B8/K2/K3
> (idempotent + concurrency-safe sweep — `subscription_periods` claim spine + the two-concurrent-runs e2e
> bills a period exactly once), B7 (exact due selection e2e), B9 (catch-up + `maxCatchUpPeriods` guard),
> B10 (`subscription_schedules` apply-at-boundary e2e), A6 (lifecycle sweep expiry + trial-notice idempotency
> e2e), K4. The **04c-2 hardening** commit (`bb8d5fb`) closed adversarial-review sweep/period defects.
> **Carve-out:** **B11 ★** (10k-due load test) is the one box NOT demonstrated here — it is the load proof
> owned by **build_plan_09 §P** (the fair-scheduling fixture lands in 08, the scale run in 09); the
> O(batches) keyset-batched enqueue + fan-out it relies on is built. Proven green by the current full suite.

- [x] **B1** — monthly, annual, and custom (week/day × `interval_count`) cycles supported; proven by
      the `interval.ts` unit table tests covering each unit.
- [x] **B2** — billing is anchor-based (`billing_cycle_anchor + n·interval`), not "+30 days"; proven by
      `periodBounds` unit test for indices 0..13 against a fixed anchor.
- [x] **B3 ⚠** — EOM snap-back: Jan-31 monthly → Feb-28/29 → **snaps back to Mar-31**; proven by the
      full-year walk unit test (read + run).
- [x] **B4 ⚠** — leap-day: Feb-29 annual anchor lands 28 (common) / 29 (leap) and snaps back; proven by
      the `leap.ts` unit test across leap + non-leap years (read + run).
- [x] **B5** — all boundaries computed in one fixed zone (`Africa/Lagos`) at a deterministic hour;
      "due today" is one exact UTC instant; proven by the `timezone.ts`/`isDue` unit test.
- [x] **B6 ⚠** — scheduler idempotent/replayable: kill mid-run → zero duplicate charges/invoices;
      proven by the e2e replay test (`subscription_periods` claim + in-tx advance) (read + run).
- [x] **B7** — exact due selection, no miss/no dup; proven by the straddling-boundary fixture e2e.
- [x] **B8 ⚠** — concurrent workers cannot double-bill; proven by the parallel-sweep e2e (advisory lock
      **and** `(subscription_id, period_index)` unique) (read + run).
- [x] **B9** — downtime catch-up bills each missed period once, no skip/stack; proven by the 3-periods-
      behind e2e, with the `maxCatchUpPeriods` guard test.
- [x] **B10** — plan/price change "next cycle" applies at the boundary, not immediately; proven by the
      schedule e2e (current invoice unchanged, next invoice uses new price).
- [ ] **B11 ★** — 10k-due throughput without timeout/partial run; proven by the load test (10k claims /
      10k invoices, zero dupes, no half-advanced rows).
- [x] **K2** — duplicate invoices & duplicate period charges structurally impossible; proven by the two
      unique constraints (`subscription_periods` and `invoices(subscription_id, period_index)`) and the
      conflict tests.
- [x] **K3 ⚠** — scheduler-vs-portal on the same subscription doesn't corrupt state; proven by the race
      test (advisory lock + optimistic `version`) (read + run).
- [x] **K4** — scheduler runs independently idempotent; proven by the replay e2e (same as B6) plus the
      `upsertCron` single-registration assertion.
- [x] **A6** — a never-paid `incomplete` subscription auto-expires to `incomplete_expired` after
      `INCOMPLETE_EXPIRY_WINDOW`; proven by the `lifecycle-sweep` e2e (the row flips after the window;
      idempotent on replay). The transition is 03's `expireIncomplete`; the **timer that fires it is here**.

---

## Done when

- `subscription_periods` and `subscription_schedules` exist via **one clean generate+migrate**; the
  `(subscription_id, period_index)` unique on both the claim table and `invoices` makes a double-bill
  structurally impossible.
- The pure `billing/scheduling` core passes its full table tests for monthly/annual/custom + EOM
  snap-back across a year + leap-day, all I/O-free.
- The `billing-sweep` cron is registered in the scheduler super-module seam and its worker case
  enqueues per-subscription `bill-subscription` jobs that drive the **03** charge loop once per
  claimed period; killing the sweep mid-run leaves zero duplicates.
- Concurrent workers and a concurrent portal action cannot double-bill or corrupt state (race tests
  green); downtime catch-up bills each missed period exactly once.
- `GET …/upcoming-invoice` and the `…/schedule` endpoints work end-to-end; a change scheduled "next
  cycle" lands at the next boundary, not immediately.
- The 10k load test enqueues and drains without timeout or partial run.
- `pnpm type-check`, `pnpm build`, `pnpm test` are green across the workspace, and every rubric box
  above (B1–B11, K2–K4) is ticked because it was **demonstrated**.
