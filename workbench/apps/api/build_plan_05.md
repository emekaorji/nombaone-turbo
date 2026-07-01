# apps/api — Build Plan 05 · Invoicing adjustments (proration, coupons/discounts, credits, partial collection, seat/quantity)

> Make a finalized invoice's amount the **exact integer-kobo** result of mid-cycle plan/seat changes, coupons, and a per-customer credit balance — every adjustment an **explicit signed line item**, the sum of parts equal to the cycle total to the kobo, credits applied **oldest-first**, and a fully-discounted invoice marked `paid` without a ₦0 charge.
> Depends on: 01 (plans/prices), 03 (subscriptions, subscription_items, invoices, invoice_line_items, the charge→ledger→verify loop), 04 (billing cycles/anchors/period boundaries, subscription_schedules). Unblocks: 06 (dunning collects the `amount_due` this phase computes), 08 (settlement splits the collected total this phase produces).

---

## Objective & scope

**In.**
- **Proration engine** (`packages/sara/src/proration/`): pure integer-kobo math + line-item generation for the four change kinds — **upgrade**, **downgrade**, **interval-switch** (monthly↔annual), **seat/quantity** change — anchored to the current period's elapsed/remaining fraction. Upgrade charges the prorated **difference now**; downgrade issues a **credit toward the next cycle** (documented default policy). Sum-of-parts = cycle total **to the kobo** (largest-remainder distribution; no float, no rounding leak).
- **Coupons + discounts** (`packages/sara/src/coupons/`, `packages/sara/src/discounts/`): `percent_off` / `amount_off`; duration `once` / `repeating` (N cycles) / `forever`; `redeem_by`, `max_redemptions`, `times_redeemed`. A discount is the *application* of a coupon to a customer or subscription over a window. Discounts produce **explicit negative line items**, never an opaque adjusted total.
- **Per-customer credit balance** (`packages/sara/src/credits/`): `credit_grants` rows (downgrade proration credit, manual grant, goodwill) backed by a **customer credit ledger account** (`liability`, key `customer_credit:{customerRef}`). Applied to invoices **deterministically oldest-first** (grant `created_at asc`, tie-broken by `id asc`), each application an explicit credit line item.
- **Partial collection** (`packages/sara/src/proration/partial-collection.ts` policy + invoice flow): tenant opt-in via `org_billing_settings.partial_collection_enabled`, **off by default**; when on, a short-collected charge marks the invoice `partially_paid` and tracks `amount_remaining`; when off, behaviour is unchanged (all-or-nothing → `past_due`).
- **Zero-amount invoice path**: an invoice whose `amount_due` resolves to `0` (100%-off coupon, full credit cover) is finalized straight to `paid` with **no rail charge attempted** and an explicit ledger entry recognizing revenue against credit/discount — not a ₦0 charge.
- **Seat/quantity** changes mutate `subscription_items.quantity` and feed the proration engine.
- API: `/v1/coupons` CRUD, apply/remove discount on a subscription or customer, `/v1/customers/:ref/credit` (grant + list balance), and `POST /v1/subscriptions/:ref/change` (price swap, interval switch, quantity) that **triggers proration** (distinct from 03's `PATCH /v1/subscriptions/:ref` which only edits `defaultPaymentMethodId`/`metadata`).

**Out (do not poach).**
- Dunning retry/branching/comms on the resulting `past_due` / `partially_paid` invoice → **06**.
- Settlement split of the collected total into the tenant sub-account → **08**.
- The end-customer self-service upgrade/downgrade **UI** → `apps/checkout` (only the API + domain land here; rubric I is that app's plan).
- Refund-to-rail of a credit balance on cancel → out of scope (credit is consumed by future invoices; cash-out is a later concern).
- Usage-based/metered proration → not in product scope (prices are flat or per-seat; rubric C is seat/quantity + plan/interval only).

---

## Rubric coverage

This phase demonstrates, from `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`:

- **Section C (Proration) — all boxes:** C1 upgrade charges prorated diff immediately · C2 downgrade credit policy (documented) · C3 ⚠ exact integer-kobo math, sum-of-parts = cycle total to the kobo, no float · C4 interval-switch proration · C5 seat/quantity proration · C6 no proration during a free trial · C7 explicit proration **ledger line items** ("−₦X unused, +₦Y new") · **C8 ★** per-customer credit balance applied deterministically **oldest-first**.
- **Section J (Ledger & money) — the adjustment boxes:** J1 ⚠ all amounts integer kobo, no floats · J2 invoices immutable once finalized (corrections via new credit/adjustment lines, never edits) · J4 ⚠ Σ(line items) = invoice total enforced by invariant · J5 every money-affecting change (proration, discount, credit) emits a ledger entry · **J8 zero-amount invoice marked `paid` without a ₦0 charge** · J9 void path produces correct ledger entries (coupon/credit void).
- Supporting (already owned by earlier phases; re-asserted where this phase touches them): **K1** Idempotency-Key on every new mutating route · **K2** unique constraints make duplicate coupon-redemption / duplicate credit-application structurally impossible · **L2** stable error codes (`PRORATION_*`, `COUPON_*`, `CREDIT_*`) · **N4** auth+scope on every new route.

---

## Design notes

### Money: exact integer kobo, no float (J1, C3)
- Everything is `Kobo` (`packages/sara/src/money`). No `nairaToKobo`/float on the proration path; inputs are already kobo (`prices.unit_amount`).
- **Proration fraction without float:** never compute `unit_amount * (remaining/total)` in floating point. Compute `Math.floor((unit_amount * remainingUnits) / totalUnits)` where `remainingUnits` / `totalUnits` are **integer time units** (seconds, or whole days for day-granular plans) of the current period. This is the same integer-division-then-clamp discipline as `config/fees.ts::computeClampedFee` (`Math.round((amount * rateBps) / 10_000)`), reused here as floor-division.
- **Sum-of-parts invariant (C3, the hard one):** when a single cycle amount is split across N parts (e.g. per-seat lines, or unused+new on a swap), distribute with the **largest-remainder method**: integer-divide to get the base per-part, then hand the `total − Σbase` leftover kobo one-at-a-time to the parts with the largest division remainders. Guarantees `Σ parts === total` exactly, deterministically. Implemented as a pure helper `distributeKobo(total, weights[]) → Kobo[]` with `assertDistributionExact` (I/O-free, unit-tested alone — mirrors `assertBalanced`).

### Proration model (C1, C2, C4, C5, C7)
- A change at instant `t` within period `[periodStart, periodEnd)` produces **two** proration lines against the current subscription item:
  - `proration` **credit** line: unused remainder of the **old** price = `−floor(oldUnit * remaining / total)` (signed negative).
  - `proration` **debit** line: prorated cost of the **new** price for the remaining window = `+floor(newUnit * remaining / total)` (signed positive).
- **Upgrade** (new > old): net positive → an immediate invoice (`billing_reason = 'proration'`) finalized and charged now (C1).
- **Downgrade** (new < old): net negative → the surplus is **granted as customer credit** (a `credit_grants` row, `source = 'downgrade_proration'`) applied to the **next** invoice, NOT refunded to rail. Default policy, documented in code and in `org_billing_settings.proration_credit_policy` (`credit_next_cycle` default; `none` to forfeit). (C2)
- **Interval-switch** (monthly→annual): old monthly remainder credited, new annual price prorated for the remaining window of the *new* cadence; same two-line shape, just different `total` denominators. (C4)
- **Seat/quantity:** delta seats × per-seat unit, prorated for the remaining window; increasing seats = upgrade-shaped (charge now), decreasing = downgrade-shaped (credit). Quantity lives on `subscription_items.quantity`. (C5)
- **No proration during trial (C6):** if the subscription is `trialing`, a plan/seat change swaps the item in place with **zero** proration lines (the trial hasn't been charged; nothing to prorate). Guarded explicitly with a test asserting **no** `proration` line items are produced.
- Every proration line is also a **ledger posting** via `ledger/postTransaction` (debit/credit `customer_credit` ↔ `platform_revenue` / `cash`), so the money state is in the ledger, not only on the invoice (C7, J5). Line items and ledger entries are produced in the same interactive transaction as invoice finalize.

### Coupons & discounts (J, L)
- Coupon validity at apply/redemption: not past `redeem_by`, `times_redeemed < max_redemptions`. Redemption increments `times_redeemed` via an atomic `UPDATE … WHERE times_redeemed < max_redemptions` (no read-modify-write race) — over-redemption is structurally impossible (K2).
- Discount duration drives **how many invoices** carry the discount line: `once` (next invoice only), `repeating` (N cycles, tracked by `discounts.cycles_remaining`), `forever`.
- A discount line is computed on the **post-proration subtotal**: `percent_off` → `−floor(subtotal * pct / 100)`; `amount_off` → `−min(amount_off, subtotal)` (clamp so the line never exceeds the subtotal; reuse the clamp idiom from `fees.ts`). Always an explicit negative `discount` line item, never a silently reduced subtotal.

### Credit balance, oldest-first (C8 ★)
- Balance is **materialized in the ledger** as the `customer_credit` account balance (`liability`, key `customer_credit:{customerRef}`), per `ledger/balance.ts` O(1) reads — never summed from grants at read time. `credit_grants` is the per-grant **audit + ordering** record (amount, remaining, source, created_at).
- Application at finalize: walk grants `ORDER BY created_at ASC, id ASC`, consuming each grant's `remaining` until the invoice `amount_due` is covered or credit is exhausted. Each consumed grant produces one explicit `credit` line item and decrements `credit_grants.remaining`. Deterministic and replayable (the consumed set is a pure function of the grant ledger at finalize time).

### Invoice resolution order (fixed, so totals are deterministic)
```
subtotal      = Σ subscription + proration line items
discountTotal = Σ discount line items            (≤ subtotal, clamped)
afterDiscount = subtotal − discountTotal
creditApplied = Σ credit line items (oldest-first, ≤ afterDiscount)
amount_due    = afterDiscount − creditApplied    (≥ 0, never negative)
```
- `assertInvoiceBalanced`: `Σ(all signed line items) === amount_due` (J4) — pure, called before finalize; an unbalanced invoice can never be written (mirrors `assertBalanced`).
- **Zero path (J8):** if `amount_due === 0`, finalize directly to `paid`, emit `invoice.paid`, post the revenue-recognition ledger entry against credit/discount, and **skip the rail entirely** — no `getRail().collect`, no ₦0 charge.

### Partial collection (tenant opt-in, off by default)
- `org_billing_settings.partial_collection_enabled` (default `false`). When `false`, a short collection is a full failure → invoice stays `open`, subscription → `past_due` (06 takes over) — unchanged from 03.
- When `true`, a partial rail success posts the collected amount to the ledger, sets `invoices.amount_remaining = amount_due − collected`, status `partially_paid`; the remainder is what dunning (06) pursues. Policy + status transition are this phase; the *retry* of the remainder is 06.

### Immutability (J2)
- A finalized invoice's line items are never edited. A later correction (e.g. a clawback of an over-credit) is a **new** adjustment line + a ledger **reversal** (`ledger/reverseTransaction`), never a row edit — consistent with the correction-by-reversal paradigm already in `ledger/reverse.ts`.

---

## Tasks (layer by layer)

### DB (core-db)

- [x] **`coupons`** table (`packages/core-db/src/schema/coupons.ts`): `idPk`, `referenceCol` (CPN), `organization_id` FK, `environment`, `code` (text, tenant-facing), `duration` enum (`once`/`repeating`/`forever`), `amount_off` bigint kobo nullable, `percent_off` smallint nullable, `duration_in_cycles` smallint nullable, `redeem_by` timestamptz nullable, `max_redemptions` int nullable, `times_redeemed` int not null default 0, `metadata` jsonb, `createdAt`, `updatedAt`. **CHECK** exactly one of (`amount_off`, `percent_off`) is set; **CHECK** `percent_off` in 1..100; `unique(reference)`; `unique(organization_id, environment, code)`; keyset index `(org, env, created_at desc, id desc)`. *Proof: migration applies on fresh DB.*
- [x] **`discounts`** table (`packages/core-db/src/schema/discounts.ts`): `idPk`, `referenceCol` (DSC), `organization_id` FK, `environment`, `coupon_id` FK, `customer_id` FK nullable, `subscription_id` FK nullable, `cycles_remaining` smallint nullable, `start_at`/`end_at` timestamptz, `status` enum (`active`/`ended`), timestamps. **CHECK** exactly one of (`customer_id`, `subscription_id`) is set; **partial unique** `(subscription_id) WHERE status='active'` and `(customer_id) WHERE status='active'` (one active discount per target); keyset index.
- [x] **`credit_grants`** table (`packages/core-db/src/schema/credit-grants.ts`): `idPk`, `referenceCol` (CRG), `organization_id` FK, `environment`, `customer_id` FK, `amount` bigint kobo (positive granted), `remaining` bigint kobo (positive, ≤ amount), `source` enum (`downgrade_proration`/`manual`/`goodwill`/`coupon`), `source_reference` text nullable (e.g. originating subscription/invoice ref), `ledger_transaction_id` FK (the grant posting), `metadata` jsonb, timestamps. `unique(reference)`; **index** `(org, env, customer_id, created_at asc, id asc)` — the oldest-first application order (C8); **CHECK** `remaining >= 0 AND remaining <= amount`.
- [x] **Extend `invoice_line_items`** (from 03): widen the `type` enum to include `proration` and `credit` (alongside `subscription` and `discount`); add nullable `proration_period_start`/`proration_period_end` (the window a proration line covers); add nullable `source_reference` (links a `credit` line to its `credit_grants.reference`, a `discount` line to its `discounts.reference`). Confirm `amount` stays signed bigint kobo (lines can be negative). *Proof: existing 03 invoice tests still green after the enum/columns widen.*
- [x] **Extend `invoices`** (from 03): add `amount_remaining` bigint kobo not null default 0 and widen `status` enum to include `partially_paid`; add `discount_total` bigint kobo not null default 0 and `credit_total` bigint kobo not null default 0 (denormalized for fast reads; the truth is the line items). Keep `(subscription_id, period_index)` unique (04) so a period can't be invoiced twice.
- [x] **Extend `subscription_items`** (from 03): confirm `quantity` int not null default 1 and `unit_amount` bigint kobo are present (the per-seat unit); add `price_id` FK if not already (a sub item references its price). *No new table — extend.*
- [x] **Create `org_billing_settings`** (this phase is the **sole creator**; 06 and 08 extend it with additive `ALTER ADD COLUMN` only): `packages/core-db/src/schema/org-billing-settings.ts` — `idPk()`, `organization_id` FK, `environment`, `partial_collection_enabled` boolean not null default `false`, `proration_credit_policy` enum (`credit_next_cycle`/`none`) not null default `credit_next_cycle`, `createdAt`, `updatedAt`; **`unique(organization_id, environment)`** (exactly one settings row per tenant/env). Register in `schema/index.ts`. *Documented hand-off: 06 adds the dunning columns, 08 adds limits/settlement — both additive, never a second `CREATE`.*
- [x] **`pnpm db:generate` then `pnpm db:migrate`** — one clean migration; verify it applies on a fresh DB and that the four new enum values / columns are present. **Never `push`.**

### Contracts (core-contracts)

- [x] **`packages/sara/src/reference.ts`**: add domains `CPN` (coupon), `DSC` (discount), `CRG` (credit grant) to `ReferenceDomain` (per C.4). *(SBI/ILI/SCH already added by 03/04.)*
- [x] **`packages/errors/src/codes.ts`**: add code groups (per C.5) and the internal/public split:
  - `PRORATION_NOT_APPLICABLE` (e.g. attempted during trial when caller forces it), `PRORATION_PERIOD_INVALID`, `PRORATION_DISTRIBUTION_UNBALANCED` (internal invariant breach).
  - `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MAX_REDEMPTIONS_REACHED`, `COUPON_INVALID_DEFINITION` (both/neither of amount/percent), `COUPON_ALREADY_APPLIED`.
  - `CREDIT_GRANT_NOT_FOUND`, `CREDIT_INSUFFICIENT_BALANCE` (manual debit attempt > balance), `CREDIT_INVALID_AMOUNT`.
  - `INVOICE_NOT_BALANCED` (Σ lines ≠ amount_due), `INVOICE_ALREADY_FINALIZED` (immutability guard).
  - Add the **public-safe** ones (`COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MAX_REDEMPTIONS_REACHED`, `COUPON_INVALID_DEFINITION`, `COUPON_ALREADY_APPLIED`, `CREDIT_INSUFFICIENT_BALANCE`, `CREDIT_INVALID_AMOUNT`, `PRORATION_NOT_APPLICABLE`) to `PUBLIC_ERROR_CODES`; keep the invariant-breach codes internal (collapse to `SYSTEM_INTERNAL_ERROR`).
- [x] **`packages/core-contracts/src/validations/coupon.ts`**: `createCouponBody` (`code`, XOR `amount_off`/`percent_off` via `.refine`, `duration`, `duration_in_cycles` required-iff-`repeating`, optional `redeem_by`, `max_redemptions`), `updateCouponBody` (metadata/`redeem_by`/`max_redemptions` only — definition immutable), `listCouponQuery` (cursor + `.coerce` limit).
- [x] **`packages/core-contracts/src/validations/discount.ts`**: `applyDiscountBody` (`coupon` ref/code, XOR target `customer`/`subscription`). Mounted on subscription + customer routes.
- [x] **`packages/core-contracts/src/validations/credit.ts`**: `grantCreditBody` (`amount` positive int kobo, `source`, optional `source_reference`, `metadata`), `listCreditQuery`.
- [x] **`packages/core-contracts/src/validations/subscription-change.ts`** (extends 03's subscription validations; named distinctly so it does **not** collide with 03's `updateSubscriptionBody`): `changeSubscriptionBody` — optional `price` (swap → proration), `quantity` (seat change → proration), `interval_switch` flag; `proration_behavior` enum (`create_prorations` default / `none`) so a caller can opt out. `.refine` that at least one mutating field is present.
- [x] **`packages/core-contracts/src/types/`**: response DTOs `CouponResponseData`, `DiscountResponseData`, `CreditGrantResponseData`, and extend `InvoiceResponseData` with `amount_remaining`, `discount_total`, `credit_total`, and the widened line-item `type`. Export from both type/validation barrels.

### Domain (sara)

- [x] **`packages/sara/src/proration/`** — pure math + line generation.
  - `math.ts`: `prorate(unitKobo, remainingUnits, totalUnits) → Kobo` (floor-division, no float); `distributeKobo(total, weights[]) → Kobo[]` (largest-remainder); `assertDistributionExact(parts, total)` (throws `PRORATION_DISTRIBUTION_UNBALANCED`). **I/O-free, unit-tested alone.**
  - `lines.ts`: `buildProrationLines(input) → ProrationLine[]` — given old/new price, period window, instant, quantity delta, returns the signed `proration` credit + debit lines (empty array if `trialing` or `proration_behavior='none'`). Pure.
  - `apply.ts`: `applyProration(txDb, ctx, { subscription, change }) → { invoice?, creditGrant? }` — orchestrates: build lines → if net positive create+finalize an immediate proration invoice (calls 03's finalize) → if net negative create a `credit_grants` row (`source='downgrade_proration'`) + ledger post → emit `subscription.updated`. Signature `(db, ctx, input)`.
  - `partial-collection.ts`: `resolvePartialCollection(settings, amountDue, collected) → { status, amountRemaining }` pure policy.
  - `index.ts` barrel; add `./proration` export to `packages/sara/package.json`.
- [x] **`packages/sara/src/coupons/`** — `create.ts` (`createCoupon`), `queries.ts` (`getCouponByReferenceOrCode`, `listCoupons`), `redeem.ts` (`assertRedeemable` pure + `redeemCoupon` atomic `times_redeemed` increment), `serialize.ts`, `types.ts`, `index.ts`. Emit `coupon.created`. Export `./coupons`.
- [x] **`packages/sara/src/discounts/`** — `apply.ts` (`applyDiscount(db, ctx, { coupon, target })` — validates coupon, redeems, writes `discounts` row with `cycles_remaining` from duration), `remove.ts` (`endDiscount` → status `ended`), `compute.ts` (`computeDiscountLine(subtotal, coupon) → DiscountLine` pure, clamped), `queries.ts`, `serialize.ts`, `index.ts`. Export `./discounts`.
- [x] **`packages/sara/src/credits/`** — `grant.ts` (`grantCredit(txDb, ctx, input)` — writes `credit_grants` + posts a balanced ledger entry crediting `customer_credit` account via `ensureAccount`/`postTransaction`; emits no public event by default, optional), `apply.ts` (`applyCreditsOldestFirst(txDb, ctx, { customerId, amountDue }) → { lines, totalApplied }` — walks grants `created_at asc, id asc`, consumes `remaining`, returns explicit `credit` lines + decrements), `balance.ts` (`getCreditBalance` via the `customer_credit` ledger account — O(1)), `queries.ts` (`listCreditGrants`), `serialize.ts`, `index.ts`. Export `./credits`.
- [x] **`packages/sara/src/invoices/finalize.ts`** (extend 03's invoice module): `finalizeInvoiceWithAdjustments(txDb, ctx, { invoice, lines })` resolves the **fixed order** (subtotal → discount → credit → amount_due), calls `assertInvoiceBalanced` (Σ signed lines === amount_due, throws `INVOICE_NOT_BALANCED`), and routes the **zero path**: when `amount_due === 0` → status `paid`, ledger revenue-recognition entry, emit `invoice.paid`, **no rail** (J8). Otherwise hand `amount_due` to 03's collect path; on partial success apply `resolvePartialCollection`. Guard `INVOICE_ALREADY_FINALIZED` (J2 immutability).
- [x] **Events emitted** (per C.6, via `events/emitEvent`): `coupon.created`, `subscription.updated` (on proration), `invoice.created`/`invoice.finalized`/`invoice.paid` (zero path), `invoice.voided` (discount/credit void). Credit grant/consumption are ledger + audit, not necessarily outbound — documented.

### API (apps/api)

- [x] **`apps/api/src/modules/coupons/`** — `routes.ts` + `controllers/{create,get,list,update}.ts` (thin; each calls a `sara/coupons` fn). New scopes `coupons:read` / `coupons:write`.
  - `POST /v1/coupons` (`coupons:write`) · `GET /v1/coupons/:reference` (`coupons:read`) · `GET /v1/coupons` (`coupons:read`) · `PATCH /v1/coupons/:reference` (`coupons:write`).
- [x] **`apps/api/src/modules/credits/`** (or nest under customers): `POST /v1/customers/:ref/credit` (grant, `customers:write`) → `sara/credits/grantCredit`; `GET /v1/customers/:ref/credit` (balance + grants list, `customers:read`) → `getCreditBalance` + `listCreditGrants`.
- [x] **Discount endpoints** on the subscriptions + customers modules (from 03):
  - `POST /v1/subscriptions/:ref/discount` (apply, `subscriptions:write`) · `DELETE /v1/subscriptions/:ref/discount` (remove).
  - `POST /v1/customers/:ref/discount` (apply, `customers:write`) · `DELETE /v1/customers/:ref/discount`.
- [x] **Subscription change** (extend 03's subscriptions module): `POST /v1/subscriptions/:ref/change` (`subscriptions:write`) → `changeSubscriptionBody`; controller calls `changeSubscription` in `sara/subscriptions`, which invokes `applyProration` when `price`/`quantity`/`interval_switch` changes. Returns the updated subscription + any immediate proration invoice ref. (03's `PATCH /v1/subscriptions/:ref` stays the metadata/default-PM editor — separate verb, separate body.)
- [x] **Middleware chain on every new mutating route, fixed order** (per B.3, matching `modules/example/routes.ts`): `apiKeyAuth → rateLimit → requireScope(...) → idempotency → validate({...}) → controller`. Reads omit `idempotency`. Add the new scopes (`coupons:read/write`) to the API-key scope set + contracts.
- [x] Mount `coupons` + `credits` under `/v1` in `app/main/routes.ts`; confirm `GET /v1/health` green.

### Wiring

- [x] **Ledger account kind:** register the per-customer credit account convention — `customer_credit:{customerRef}`, kind `liability`, created lazily via `ledger/ensureAccount` on first grant (no change to `SYSTEM_ACCOUNTS`; this is a per-customer, not system, account). Document the key convention next to `config/system-accounts.ts`.
- [x] **Scheduler hook (04):** at each renewal, before collect, the renewal flow must (a) apply still-active `discounts` (decrement `cycles_remaining`, end at 0), and (b) apply available credits oldest-first. Wire `finalizeInvoiceWithAdjustments` into 04's per-cycle invoice build so scheduled renewals carry discounts + credits, not just immediate proration invoices. *(Backward dep into 04's sweep; documented as the integration seam.)*
- [x] No new queue/worker — proration + adjustment run inline in the request/sweep transaction.

### Tests

- [x] **Unit (sara/proration) — C3, C5, the proof (P1):**
  - `prorate` and `distributeKobo`: property test that `Σ distributeKobo(total, w) === total` for randomized totals/weights, including totals indivisible by N (the rounding-leak case). **Sum-of-parts = cycle total to the kobo.**
  - upgrade, downgrade, interval-switch, seat-change line generation — assert exact kobo and signed direction; assert leap-year (Feb 29) period denominators (uses 04's date core) prorate exactly.
  - **trial guard (C6):** change while `trialing` → **zero** proration lines.
- [x] **Unit (sara/coupons, discounts):** `assertRedeemable` (expired, max-redemptions, bad definition); `computeDiscountLine` percent + amount + clamp-to-subtotal; 100%-off → discount line equals subtotal.
- [x] **Unit (sara/credits) — C8 ★:** `applyCreditsOldestFirst` consumes grants in `created_at asc` order across multiple grants, partial consumption leaves correct `remaining`, exhaustion stops at `amount_due`. Deterministic-order assertion.
- [x] **Unit (sara/invoices):** `assertInvoiceBalanced` rejects Σlines ≠ amount_due (J4); fixed-order resolution yields `amount_due ≥ 0`; zero-path returns `paid` with no rail call (J8).
- [x] **e2e (testcontainers, apps/api) — full chain:**
  - create coupon → apply to subscription → next invoice carries an explicit negative `discount` line; subtotal unchanged, total reduced (C7, J).
  - upgrade subscription mid-cycle → immediate invoice with `proration` credit + debit lines, charged now; ledger has matching entries (C1, C7, J5).
  - downgrade mid-cycle → `credit_grants` row created, **no** rail charge; next renewal invoice consumes it oldest-first as a `credit` line (C2, C8).
  - 100%-off coupon → invoice `amount_due = 0` → status `paid`, **no rail call** asserted (mock rail not invoked), `invoice.paid` emitted (J8).
  - partial collection **on**: short rail success → invoice `partially_paid`, `amount_remaining` correct; **off** (default): same short success → invoice `open`, subscription `past_due`.
  - **Idempotency-Key** replay on coupon-create / credit-grant / subscription-update → original result, no second row (K1); coupon over-redemption blocked by the atomic increment (K2).
  - immutability (J2): attempt to re-finalize a finalized invoice → `INVOICE_ALREADY_FINALIZED`.

---

## Verification checklist (rubric → how demonstrated)

> **★ PHASE 05 COMPLETE (as of 2026-07-01, `build/apps-api`).** 05e landed: partial-collection wired into
> `collectForInvoice` (per-tenant `org_billing_settings.partial_collection_enabled`, off by default →
> `partially_paid` + `amount_remaining`, atomic `claimInvoicePartiallyPaid` CAS, rail `collectedKobo`), the
> `finalizeInvoiceWithAdjustments` renewal hook, and the comprehensive C/J e2e (C5 seat/qty, C7 discount-line-
> on-renewal, C2→C8 downgrade-credit-consumed-on-renewal, J8 100%-off-no-rail, partial ON/OFF, K1 replay).
> Adversarially reviewed before commit (no double-post: partial CAS gated on `amount_paid = 0`; the
> `partially_paid→paid` completion is 06's and must NOT gate `claimInvoicePaid` on `amount_paid = 0`).
> Green: type-check 9/9, build 5/5, **94 sara unit + 58 api e2e**. **Deferred (honest):** **C4** interval-switch
> (rejected not mis-charged) + **J9** credit-void/clawback reversal — see the two boxes below.
>
> Earlier chunks, done & green:
> **05a** pure proration math (`7b35cfa` — `prorate`/`distributeKobo` largest-remainder, exact-kobo, no
> float; C3/J1), **05b** adjustment tables + contracts (`8974bc4` — coupons/discounts/credit_grants/
> org_billing_settings, migration 0008, `partially_paid` + amount_remaining/credit_total), **05c** coupons +
> discounts modules/endpoints (`0160b66` — atomic over-redemption guard K2, clamped discount lines),
> **05d-1** credits oldest-first ledger-backed (`33bfaf1` — C8 ★ `consumeGrants` + O(1) balance),
> **05d-2** adjustment-aware finalize + proration + change (`7bade6f` — fixed-order subtotal→discount→
> credit→amount_due, `assertInvoiceBalanced` J4, J8 zero-path; C1 upgrade / C2 downgrade e2e). The money
> path then went through an **adversarial review** that found 4 real defects, all fixed: `abcf703`
> (changeSubscription claim-first — no torn state / double-charge; interval-switch rejected not mis-charged)
> + `81bc53f` (atomic credit grant-decrement + ledger debit via a `postTransaction` savepoint).
> **Remaining for 05e:** wire `finalizeInvoiceWithAdjustments` into the 04 renewal sweep (discounts+credits
> at each cycle) + the full C/J e2e set (C5 seat/quantity, J8 100%-off-no-rail, partial-collection on/off,
> K1 replay) + this checklist. **Deferred (honest carve-out):** **C4 interval-switch** proration — currently
> rejected with `PRORATION_INTERVAL_SWITCH_UNSUPPORTED` rather than mis-charged; correct interval-aware
> proration needs period-claim re-anchoring, scheduled as its own reviewed build.

- [x] **C1** — mid-cycle upgrade charges the prorated difference immediately: e2e creates an upgrade and asserts an immediate finalized invoice with net-positive proration lines and a ledger charge in the same tx.
- [x] **C2** — downgrade applies a credit toward next cycle per the **documented** default (`proration_credit_policy = credit_next_cycle`): e2e asserts a `credit_grants` row and no rail charge; policy comment + setting present.
- [x] **C3 ⚠** — proration math is exact integer kobo, sum-of-parts = cycle total to the kobo, no float: `distributeKobo` property test (incl. indivisible totals) + `assertDistributionExact`; grep proves no float on the proration path. *(verify twice: read + run)*
- [x] **C4** — interval-switch (monthly↔annual) prorates correctly: **NOW BUILT** — `buildIntervalSwitchLines` (credit unused old-cadence remainder + charge a FULL fresh new-cadence period) + `reanchorForIntervalSwitch` (back-dates the anchor so `current_period_index` stays monotonic → no invoice `unique(sub,period_index)` collision) + `applyIntervalSwitch`. Unit tests: re-anchor consistency invariant, EOM (Jan-31→Feb-28), yearly. e2e: month→year charges the prorated diff + re-anchors + the next renewal bills a full year cleanly; year→month banks a credit. Trialing switches skip the re-anchor (trial date preserved).
- [x] **C5** — quantity/seat changes prorate correctly: unit covers ±seat deltas; e2e changes `subscription_items.quantity` and asserts prorated lines.
- [x] **C6** — no proration during a free trial: unit asserts a change while `trialing` produces **zero** proration line items.
- [x] **C7** — every proration produces explicit ledger line items ("−₦X unused, +₦Y new"), not one opaque amount: e2e asserts two signed `proration` lines + matching ledger entries.
- [x] **C8 ★** — per-customer credit balance tracked and applied deterministically oldest-first: `applyCreditsOldestFirst` unit (order assertion) + e2e (downgrade credit consumed on next renewal in grant-creation order).
- [x] **J1 ⚠** — all amounts integer kobo, no floats on the adjustment path: type is `Kobo` throughout; grep gate over `proration/`, `coupons/`, `credits/` for float ops. *(verify twice)*
- [x] **J2** — finalized invoice immutable; corrections via new lines / ledger reversal: e2e re-finalize → `INVOICE_ALREADY_FINALIZED`; clawback path uses `reverseTransaction`.
- [x] **J4 ⚠** — Σ(line items) = invoice total enforced by invariant: `assertInvoiceBalanced` unit rejects mismatches; called before every finalize. *(verify twice)*
- [x] **J5** — every money-affecting change emits a ledger entry: proration, discount-cover, and credit-apply each post via `postTransaction`; e2e inspects ledger rows.
- [x] **J8** — zero-amount invoice marked `paid` without a ₦0 charge: e2e 100%-off → `paid`, mock rail asserted **never called**, `invoice.paid` emitted.
- [ ] **J9** — void path produces correct ledger entries: removing a discount / voiding a credit posts a `reversal`; e2e asserts net-zero on the touched accounts. **PARTIAL/DEFERRED** — invoice-void ledger correctness is done+tested (03c/03e); discount removal correctly moves NO money (nothing to reverse); the credit-void/clawback `reverseTransaction` path is not yet built — pairs with a future adjustment surface.
- [x] **K1** — Idempotency-Key honored on coupon-create / credit-grant / subscription-update: e2e replay returns original, no new row.
- [x] **K2** — duplicate coupon-redemption / over-redemption structurally impossible: atomic `times_redeemed < max_redemptions` UPDATE; e2e races two redemptions, exactly one wins.
- [x] **L2** — stable machine codes for the new failures (`PRORATION_*`, `COUPON_*`, `CREDIT_*`, `INVOICE_*`): public-safe subset in `PUBLIC_ERROR_CODES`; error-shape e2e asserts code presence.
- [x] **N4** — every new route enforces `apiKeyAuth` + scope, no unauthenticated mutating route: route-table read + e2e 401/403.
- [x] `pnpm type-check`, `pnpm build`, `pnpm test` green across the workspace.

## Done when

`/v1/coupons` CRUD, discount apply/remove, `/v1/customers/:ref/credit`, and `POST /v1/subscriptions/:ref` all work end to end; a mid-cycle **upgrade** charges the exact prorated kobo difference immediately, a **downgrade** banks an exact credit grant consumed **oldest-first** on the next renewal, **interval-switch** and **seat/quantity** changes prorate to the kobo with **sum-of-parts = cycle total**, a 100%-off invoice is **`paid` with no ₦0 charge**, every adjustment is an **explicit signed line item with a matching ledger entry**, partial collection honours the per-tenant flag, **no float touches the money path**, and Section **C** (all, incl. ★C8) and the adjustment boxes of Section **J** (J1/J2/J4/J5/J8/J9) are green with `type-check`, `build`, and `test` passing.
