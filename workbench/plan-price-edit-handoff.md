# Handoff — edit a plan's prices, and make the 10-minute cadence real

**Status: code-complete and green. Tests + docs are the only things left.**
All source changes described below are already in the working tree and were swept into commit
`0c5881c`. Nothing here needs to be re-implemented — read it, then finish the four open items in
§5.

Verified green at handoff:
- `pnpm type-check` → **10/10**
- `pnpm check:boundaries` → clean
- `pnpm --filter @nombaone/console lint` → clean
- `pnpm --filter @nombaone/api test -- test/e2e/wall-clock-cadence.e2e.test.ts` → **6/6**
- OpenAPI snapshot regenerated (`pnpm --filter @nombaone/api gen:openapi`, 64 paths)

---

## 1. What the user asked for (verbatim)

> - for new plans, the add price button should not be there.
> - only the edit plan should be there.
> - the edit plan modal should now feature more fields as is done in the create plan modal, such that
>   when they are editing the plan, they can update the price values too as they did during creation.
> - any price value that changes for that plan is a recreation of price on our end.
> - all other prices that didn't change remain active and every price that changed deactivates the
>   previous price for that interval. **(SPEND TIME ON THIS LOGIC HERE)**
> - also, when creating the plan, i don't see the 10-minute interval. the agent who worked on the wall
>   clock change was supposed to attend to this, find out if it missed something and fix it. (the
>   paradigm behind having a 10-minute interval is because i want my merchants/developers to be able to
>   see updates and see a subscription in real time while they are developing, so the 10-minute price of
>   a plan must work exactly like every others with **no difference at all**).
> - make this change for both console and api, such that when updating a plan, they can also pass these
>   fields. update the docs when you are done.

Two ideas, one root: **a plan IS what it costs**, and a merchant should manage it as one thing.

---

## 2. The bug that made the 10-minute cadence a lie (this was the important find)

The wall-clock work shipped correct *period math* but never touched the *scheduler*. A 10-minute
subscription billed **once and was then parked forever**. Three compounding causes:

1. `BILLING_SWEEP_CRON` defaulted to `'5 1 * * *'` — **once a day**. A wall-clock cadence is due on
   the wall clock; a daily sweep leaves a 10-minute plan ~144 periods unbilled.
2. `BILLING_MAX_CATCH_UP_PERIODS = 36` is cadence-blind: 3 *years* of `month`, but **6 hours** of
   `minute × 10`.
3. Worst: `runCycle` **threw `BILLING_CATCH_UP_LIMIT_EXCEEDED` *before billing anything***, the worker
   caught it and returned **without advancing the period**, so `next_billing_at` never moved and every
   later sweep re-threw. **Silently dead, forever.**

This was a latent brick for **every** cadence — a monthly sub 37 periods behind parked identically.
It shipped green because `wall-clock-cadence.e2e.test.ts` called `runCycle` *without*
`maxCatchUpPeriods`, disabling the exact guard that breaks in production.

### The fix (already applied)

- **`apps/api/src/shared/services/billing/runCycle.ts`** — the throwing guard is gone. `RunCycleResult`
  now carries **`periodsBehind`** (bounded count loop, `MAX_BEHIND_SCAN = 100_000`). It always bills and
  always advances.
  > **Billing is IN ADVANCE** — period *k* is billed at its **start**. So `periodsBehind === 0` is the
  > *healthy steady state*, not 1. A caller that stops at `<= 1` stops one period short and leaves
  > `next_billing_at` in the **past**. (I got this wrong first; the e2e caught it.)
- **`apps/api/src/services/worker/modules/billing/index.ts`** — a bounded **drain loop**: keep calling
  `runCycle` until `periodsBehind === 0`, capped at `BILLING_MAX_CATCH_UP_PERIODS` **per job** — a *rate
  limit, not a wall*: whatever is left is still due, so the next sweep tick continues it. Breaks early on
  `past_due` / `canceled` / `awaiting_payment`.
- **`apps/api/src/shared/config/env.ts`** — `BILLING_SWEEP_CRON` default is now `'* * * * *'`. (The
  deployments already had this set; the *code default* did not, so local dev and any new environment
  silently would not bill a 10-minute plan — exactly the audience the cadence exists for.) The sweep is
  an indexed `next_billing_at <= now` scan that matches zero rows on almost every tick.
- **`apps/api/src/apps/main/modules/test/controllers/advance-cycle.ts`** — dropped the removed
  `maxCatchUpPeriods` option. The sandbox clock still advances exactly one cycle per call.
- **`apps/api/test/e2e/load.e2e.test.ts`** — same option removed.
- **`apps/api/test/e2e/wall-clock-cadence.e2e.test.ts`** — new test: *"a subscription far past the
  catch-up cap DRAINS and advances — it is never parked."* Backdates the anchor 50 periods, asserts the
  first cycle reports `periodsBehind > BILLING_MAX_CATCH_UP_PERIODS` **and still bills**, drains to 0,
  and ends with `next_billing_at` in the **future**. **This is the test that would have caught the bug.**

`BILLING_CATCH_UP_LIMIT_EXCEEDED` in `packages/errors/src/codes.ts` is now a **dead public error code**
(never thrown). Left in place deliberately — same status as `PRICE_PLAN_MISMATCH` — but it is a docs
honesty wart worth a follow-up.

---

## 3. The 10-minute cadence in the console

A cadence is a **UNIT × a COUNT**. "Every 10 minutes" is `interval: 'minute', intervalCount: 10` — *not*
a unit. The create form keyed its fields by the unit alone (`amount_month`), which silently hard-pinned
every price it could create to `intervalCount = 1`. That is why the cadence could not be offered — and
why this was **not** "unhide a checkbox".

- **NEW `apps/console/src/lib/cadences.ts`** — the SSOT. `Cadence = { key, interval, intervalCount, label }`,
  `PLAN_CADENCES` (10 min / daily / weekly / monthly / annual, sorted shortest→longest), `parseCadenceKey`
  (validates both halves against the engine enum — a hand-crafted form post cannot smuggle an unknown
  unit into an insert), `cadenceSuffix`, `cadenceOrder`.
  Form fields are now keyed by the **pair**: `amount_minute_10`, `amount_month_1`.
- **`packages/core-contracts/src/billing/interval.ts`** — added **`cadenceApproxMs(interval, count)`**, a
  *sort key only*. `PRICE_INTERVALS` is pinned to the Postgres enum's physical (append-only) order, so
  `minute` sits **last** and ranking a ladder by `indexOf` printed "every 10 minutes" *after* "annual".
- **`apps/console/src/components/console/plans/new-plan-button.tsx`** — rebuilt on cadences. The
  `PLAN_CADENCES` wall-clock filter is **deleted**. Offered in **both modes** — no sandbox-only gating
  ("no difference at all").
- **`apps/console/src/lib/plans-actions.ts`** — both `isWallClockInterval` rejections **deleted**.
- **`apps/console/src/lib/plans.ts`** — ladder sorts by `cadenceApproxMs`, not enum position. Stale
  "legacy/test cadence" copy fixed.

No new math was needed: `convertIntervalKobo` / `toMonthlyKobo` route through `periodsPerYear`, where
`minute` was already correct (`525_600`).

---

## 4. The reconcile (the part the user said to spend time on)

**A price row is immutable — its money is NEVER rewritten.** A subscription pins `price_id`, and that
pinned row is the whole reason an existing subscriber's bill cannot move under them. So "changing a
price" is: **mint a new row, retire the old.** The job here was to make that the merchant's *outcome*
instead of the merchant's *problem*.

### The rule, per SUBMITTED cadence, in ONE transaction

```
no active price on that cadence  → INSERT                                   → price.created
amount UNCHANGED, one active row → NOTHING AT ALL (no write, no event)
amount UNCHANGED, several active → keep the newest, deactivate the rest     → price.deactivated × M
amount CHANGED                   → INSERT new + deactivate EVERY other       → price.created
                                   active row on that cadence                 + price.deactivated × M
```

**A cadence that is NOT submitted is left completely alone.** That is exactly *"all other prices that
didn't change remain active"*, and it means omission can never silently retire a price.

Deliberate details:
- The **canonical** price for a cadence is the **newest active** row. A legacy plan can already carry two
  live monthly prices (nothing in the DB forbids it), and leaving one behind would let *row order* decide
  what a new subscriber pays. Any edit of that cadence **heals** it down to one.
- We deactivate **every other** active row on the cadence, excluding the new one **by id** — so the plan
  is never left with nothing to bill on.
- **Lock the PLAN row `FOR UPDATE` first**, then the price rows. Two concurrent edits would otherwise both
  find a cadence unpriced and both mint a price for it — and a `FOR UPDATE` on the price rows *cannot*
  prevent that, because **you cannot lock a row that does not exist yet.**
- Cadences are processed in a deterministic (duration) order → deterministic lock order → no deadlock.

### API

- **`packages/core-contracts/src/validations/plan.ts`** — `updatePlanBody` gains
  `prices?: array(createPriceBody).min(1).max(MAX_EMBEDDED_PRICES).superRefine(rejectDuplicateCadence)`.
  Reuses the *exact* pieces `createPlanBody` uses, so the two entry points cannot drift.
- **NEW `apps/api/src/shared/services/plans/update-with-prices.ts`** — `updatePlanWithPrices`. House
  pattern: **all guards before the tx** (`resolvePlanId` → `assertPlanAcceptsPrices` →
  `assertPriceCreatable` per row → `assertPlanNameFree`), **one tx**, **events emitted after commit on the
  pool handle**. Archived-plan check is re-run *under the lock*.
- **`apps/api/src/apps/main/modules/plans/controllers/update-plan.ts`** — **scope-escalation guard**,
  mirroring `create-plan.ts`: the route declares `plans:write`, so when (and only when) `prices` is
  present the key must **also** hold `prices:write` → else `403 API_KEY_SCOPE_FORBIDDEN`. Asserted against
  the verified principal, before any DB work. Returns `PlanWithPricesResponseData`; `data.prices` is
  always present (the plan's **active** prices after the update), so the response shape doesn't depend on
  whether the caller sent prices.
- **`apps/api/src/shared/services/plans/queries.ts`** — new `listActivePlanPrices`.
- **`apps/api/src/shared/services/plans/create.ts`** — `assertPlanNameFree` gained an optional
  `exceptPlanId` (a rename to your own name is not a conflict). `update.ts`'s duplicated inline check now
  calls it — one implementation.
- **`apps/api/src/shared/openapi/responses.ts`** — `'patch /v1/plans/{id}'` remapped `Plan` →
  `PlanWithPrices`. **Snapshot regenerated** (`apps/docs/src/generated/openapi.json`) — verified that PATCH
  now advertises the `prices` array and that `minute` is in the interval enum.
- **Events**: `plan.updated`, `price.created`, `price.deactivated` all already exist in the catalog
  (`packages/core-contracts/src/types/webhook-events.ts`). **No catalog change needed.**

### Console

- **`apps/console/src/lib/plans-actions.ts`** — new **`updatePlanWithPricesAction`** (pooled tx, same
  reconcile). Runs on `@nombaone/core-db/pool`, **not** the serverless Neon HTTP driver, which cannot do
  multi-statement transactions. The old `updatePlanAction` (name/description only, serverless) is
  **deleted**. New shared `readSubmittedPrices` parses `amount_<interval>_<count>` fields; empty fields are
  **skipped, not zeroed** ("not submitted" ⇒ untouched).
- **`apps/console/src/components/console/plans/plan-action-buttons.tsx`** — `EditPlanButton` is now the
  create modal's twin: name, description, and one row per cadence with amount + `% off`, pre-filled from
  the plan's current **active** price per cadence. Rows = the offered cadences **∪ whatever the plan
  already has** (so an exotic `month × 3` created via the API is visible and editable, not invisibly
  omitted).
  > **THE CRITICAL UX RULE — no silent recreation.** In *create*, editing the base re-derives every other
  > cadence. In *edit* it must **NOT**: every changed amount mints a new price row, so cascading a
  > re-derive would silently recreate prices the merchant never touched. Derivation fires in **exactly one
  > place**: switching a **new** cadence on (to seed it with a sensible figure). The `% off` box is a live
  > *view* of the true saving (recomputed each render, with the typed value as an override) so it can
  > never show a stale figure — but it never cascades to another cadence's amount.
  > Removing a cadence is **not** in this modal — that stays the ladder's per-price `Deactivate`.
- **`apps/console/src/app/(app)/plans/page.tsx`** — the general **`Add price` button is removed** from the
  detail head. `Edit plan` + `Archive` only. The **repair CTA is kept** (`label="Add a price"`, keyed off
  `detail.billable`) for a legacy plan with **zero active prices** — it cannot be billed until one exists.
- **`apps/console/src/components/console/plans/new-price-button.tsx`** — kept as the escape hatch (arbitrary
  cadences like `month × 3`) and the repair path; doc comment updated.

### The money round-trip (I checked this explicitly — it was the scariest possible bug)

If `kobo → naira input string → back to kobo` were lossy, then **opening the edit modal and saving
unchanged would recreate every price on the plan**. It is not: `toKobo(naira(k).replace('₦',''))` is
lossless — **0 mismatches across an exhaustive sweep of 1..200,000 kobo**, plus ₦1M. A no-op save writes
nothing.

---

## 5. WHAT IS LEFT (the whole remaining job)

### 5.1 API e2e tests for the reconcile — **not written**
Extend **`apps/api/test/e2e/plans.e2e.test.ts`** (it already covers `POST /v1/plans` with embedded prices
incl. the scope-escalation 403 — match its style). Every case must assert against the **DB**, not just the
HTTP response:

1. **Unchanged amount → ZERO new rows.** Same price id/reference back; the plan's total price-row count
   did not move.
2. **Changed amount →** exactly ONE new active row, and the OLD row is `active=false` with its
   **`unit_amount` UNTOUCHED** (query the row directly — this is the grandfathering invariant).
3. **A cadence not submitted** stays active and untouched.
4. **A newly-enabled cadence** is created.
5. **A legacy plan with TWO active monthly prices is HEALED to one** by any edit of that cadence. (Seed the
   duplicate by direct insert — `rejectDuplicateCadence` prevents it over the wire.)
6. **Scope escalation**: PATCH *with* `prices` on a `plans:write`-only key → **403**; the same key *without*
   `prices` → 200.
7. **Archived plan** + `prices` → 409 `PLAN_ALREADY_ARCHIVED`.
8. `data.prices` carries the plan's **active** prices after the update.
9. A **10-minute** cadence round-trips through PATCH exactly like `month`.
10. **Events**: an unchanged-amount edit emits **no** `price.*` event; a changed amount emits
    `price.created` + `price.deactivated`.

Also worth adding: a **concurrency** test (two simultaneous PATCHes on a plan with an *unpriced* cadence
must not both mint it — that is what the plan-row lock exists for).

### 5.2 Docs — **not written**
- **`apps/docs/content/guides/create-plans-and-prices.mdx`** — a section on **changing a price**: the
  reconcile rules, and *why* a change is a new row (subscribers pin `priceId`; grandfathering is a property
  of the data model, not a feature). Note `prices` requires the `prices:write` scope. Plus the **10-minute
  cadence** as first-class (`interval: "minute", intervalCount: 10`) — and **be honest** that it needs a
  per-minute billing sweep (now the default).
- **`apps/docs/content/changelog.mdx`** (2026-07-12 section) — `### Added`: PATCH `/v1/plans/{id}` accepts
  `prices`; `minute` is a first-class cadence. `### Fixed`: **the catch-up park** — say plainly what it was;
  it could have eaten a customer's revenue, don't soften it.
- **`apps/website/src/app/changelog/page.tsx`** — one entry at the top of `ENTRIES`, `"Jul 12, 2026"`,
  `"v0.16"`, matching the existing voice. (Existing top entry is v0.15.)
- **Sweep `apps/docs/content` for pages that LIE about the cadence** — grep `interval` / `cadence` /
  `monthly` for any page that omits `minute` from the interval list or calls it test-only/sandbox-only.
  A docs page that lies about what the API accepts is the bug this whole change exists to kill.
- Docs gates must pass: `check:frontmatter`, `check:style`, `check:links`, `check:openapi`.

### 5.3 Final verification — **not run end-to-end**
- `pnpm --filter @nombaone/api test` (full suite — I only ran the wall-clock file)
- `pnpm --filter @nombaone/console build`
- **Browser E2E**: plan detail shows `Edit plan`/`Archive` and **no** `Add price`; a price-less legacy plan
  still shows the repair CTA; Edit pre-fills current amounts; editing **one** amount recreates **only** that
  cadence (verify in psql: old row `active=f` with money unchanged, new row active) and leaves the others
  active; "Every 10 minutes" is offered and derives correctly.
- **REAL 10-minute billing**: create a `minute × 10` plan in the console, subscribe, let the every-minute
  sweep run, and assert invoices appear ~10 minutes apart and `currentPeriodIndex` advances.
  ⚠️ **The user asked that the running console port (8010) NOT be killed — they want to test it themselves.**

### 5.4 Flagged follow-ups (explicitly NOT in scope)
- **Dunning defaults are cadence-blind.** A failed 10-minute charge retries on a 24h → 3d → 5d → 7d ladder
  with a payday-snap, and renewals freeze while `past_due` — so **one decline stalls a 10-minute plan for up
  to two weeks**. The settings *are* per-tenant configurable and already support fractional hours
  (`0.25` = 15 min), so the escape hatch exists; making the **defaults** scale to the cadence is a separate
  call.
- `BILLING_CATCH_UP_LIMIT_EXCEEDED` is now a **dead public error code**.
- No DB partial unique index on `(plan_id, interval, interval_count) WHERE active` — cadence uniqueness
  stays app-enforced (the reconcile *heals* duplicates rather than preventing them).

---

## 6. House rules the finishing agent must respect

- **Money is integer kobo everywhere.** Never floats.
- **Never** mention Claude/Anthropic/AI/LLM in any file, comment, PR, or commit; **never** add a
  `Co-Authored-By` trailer. Commits are authored solely by the human's configured git identity.
- Comments explain **WHY** (the invariant, the bug that motivated the code) — never what the next line does.
- Drizzle: `generate` + `migrate` only. **Never `drizzle-kit push`.** (No migration is needed for this
  change — it adds no columns.)
- The ONE Neon DB is shared by dev and the deployed app → **a migration is a PRODUCTION write.**
- Design fidelity to the Pencil `.pen` file is a hard 1:1 gate for any UI.
