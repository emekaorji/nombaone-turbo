# apps/api — Build Plan 03 · Subscriptions, the State Machine, Invoices & the charge→ledger→verify loop

> Bind a customer to a price as a lifecycle-driven **subscription**, issue an immutable **invoice** per
> period, and collect it through the rail (02) → ledger → verify-by-webhook loop — with trials, legal-only
> transitions, and a structurally impossible double-charge. **Depends on:** 00 (foundations, customers,
> ledger, events, idempotency, reference), 01 (plans + prices), 02 (rails + payment_methods + inbound
> ingest). **Unblocks:** 04 (scheduler drives this loop on a clock), 05 (proration/adjustments deepen the
> invoice math), 06 (dunning consumes the `past_due` entry/exit hooks defined here), 07 (formalizes the
> events emitted here).

---

## Objective & scope

**In.**
- Tables: `subscriptions`, `subscription_items`, `invoices`, `invoice_line_items` (contract C.1), each
  tenant-scoped (`organization_id` + `environment`), reference-keyed (C.4 domains `SUB`/`SBI`/`INV`/`ILI`).
- The **subscription lifecycle FSM** (contract C.2) as a set of explicit, named, event-emitting, idempotent
  operations that enforce legal transitions and reject illegal ones with stable coded errors. Status is
  **derived** from invoice/ledger state, not a free-floating column that can drift.
- **Trials** (`trialing`, no charge attempted) including `trialing → active` on first successful charge and
  `trialing → canceled` (no charge) when cancelled in-trial.
- The **single-cycle billing loop**: issue invoice (draft → open/finalized) → `collectForInvoice` through
  the rail (02) → post the double-entry ledger transaction → emit outbox event → confirm by inbound webhook
  **re-verified server-side (requery)** → mark invoice `paid` → advance the subscription period.
- **Invoice immutability** once finalized (corrections are new credit/adjustment rows, never edits) and the
  **line-item-sum = total** invariant enforced in code at finalize time.
- The **`(subscription_id, period_index)` unique** constraint that makes a double-charge structurally
  impossible, plus reference-keyed idempotency on the charge.
- `cancel-now` vs `cancel-at-period-end` (distinct transitions, distinct behaviour); `pause`/`resume`;
  `resubscribe` (creates a **new** subscription row, never revives the terminal one); voluntary
  (`subscription.canceled`) vs involuntary (`subscription.churned`) churn events.
- API: `/v1/subscriptions` (create/get/list/update; pause; resume; cancel-now; cancel-at-period-end;
  resubscribe) and `/v1/invoices` (get/list/void) with `subscriptions:*` / `invoices:*` scopes.

**Out (explicitly deferred — do not poach).**
- The **clock/scheduler** that *triggers* renewals, anchor math, EOM/leap, idempotent sweep, concurrency,
  catch-up → **04**. This phase exposes `advancePeriod` + a `runCycle(db, ctx, subscriptionRef)` primitive
  and proves it for a *single* cycle invoked directly; 04 drives it on a clock.
- **Proration, coupons/discounts, credit balances, partial collection, seat/quantity proration math** → **05**.
  `subscription_items` and `invoice_line_items` are created here with the shape 05 needs (typed lines, signed
  kobo, period), but only `subscription`-type lines and full-amount collection are exercised now.
- **Dunning policy / retry schedule / comms** → **06**. This phase defines the `past_due` **entry hook**
  (`enterPastDue`, fired when collection fails) and **exit hooks** (`recoverFromPastDue` → `active`,
  `churnFromPastDue` → `canceled`), and emits the failure event — but the retry *policy* and `dunning_attempts`
  belong to 06.
- Outbound **webhook delivery transport / per-tenant HMAC / replay** → **07** (we only `emitEvent`).
- The **customer self-service portal UI** (rubric I) → `apps/checkout`. Only the API + domain obligations
  land here.

---

## Rubric coverage

Exact boxes from `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md` this phase **demonstrates** (proof named in the
Verification checklist). `⚠` boxes are verified twice (read + run); `★` are distinction items.

- **A. Subscription state machine** — A1 (all states reachable), A2 ⚠ (terminal `canceled` + resubscribe =
  new record), A3 (every transition explicit/named/event-triggered), A4 ⚠ (illegal transitions rejected,
  test per transition), A5 (`incomplete` for never-succeeded first payment, never shows `active`), A7
  (`trialing → active` on first successful charge at trial end), A8 (`trialing → canceled` in-trial, no
  charge), A9 ⚠ (cancel-now vs cancel-at-period-end distinct), A10 (pause→resume; resume recomputes next
  bill, no skip/double), A11 (pause semantics documented + enforced), A12 ★ (status derived from / consistent
  with the ledger), A13 ★ (every transition writes an immutable audit event — replayable history), A14
  (replaying a trigger is idempotent — no double-apply).
- **J. Ledger & money integrity** — J1 ⚠ (integer kobo, no floats), J2 (invoices immutable once issued;
  corrections via new entries), J3 (invoice lifecycle `draft → open → paid` + `void`/`uncollectible`
  enforced), J4 ⚠ (Σ line items = total — invariant), J5 (every money-affecting change posts a ledger
  entry), J6 ⚠ (no double-charge — replay any charge path = one debit), J8 (zero-amount invoice → `paid`
  with no ₦0 charge), J9 (void path defined, correct ledger entries).
- **E. Tokenization & Nomba charge integration** — E2 (recurring charges use the stored `tokenKey`/method
  from 02, no re-collection), E3 ⚠ (each charge carries a unique `orderReference` = our `reference`, so
  retries are idempotent on Nomba's side), E4 ⚠ (charge outcomes verified server-side via webhook +
  requery — never trust a client-reported success), E8 (currency consistently NGN across order/charge/
  invoice/ledger).
- **Partial/forward contributions (proven, owned elsewhere):** K2 (DB unique constraints make duplicate
  period charges structurally impossible — `(subscription_id, period_index)`), A6-entry (an `incomplete`
  that is never paid *auto-expires* — the transition + window are defined here; the **timer** that fires it
  is 04). A6's automatic firing is ticked in 04.

---

## Design notes

### D.1 The two state machines, exactly per contract
We implement contract **C.2** (subscription lifecycle) in full and define the **C.3** (dunning) *entry/exit
hooks only*. States: `incomplete · incomplete_expired · trialing · active · past_due · paused · canceled`.

- A `transitions` table-of-truth in `subscriptions/fsm.ts` declares the **legal** `(from → to)` set. Every
  lifecycle op routes through one private `transition(tx, ctx, sub, to, reason)` that (a) asserts the edge is
  legal else throws `SUBSCRIPTION_ILLEGAL_TRANSITION`, (b) writes the new status under an optimistic
  `version` guard, (c) `emitEvent`s the matching event. **No op writes `status` directly** — A3.
- `incomplete` is reachable only as the **first-ever** state when collection method is `charge_automatically`
  and the *first* charge has not yet succeeded; it never serializes as `active` (A5). The
  `incomplete → incomplete_expired` edge is legal here; the **window timer** that fires it is 04 (A6).
- `trialing` is entered at create when the price (01) has `trial_days > 0` **or** an explicit `trialDays`
  override is supplied; **no charge is attempted while `trialing`** (A8/J — trial guard). `trialing → active`
  happens on the first successful charge at trial end (A7); `trialing → canceled` is a no-charge edge (A8).
- **cancel-now** = `(active|trialing|past_due|paused) → canceled` immediately, `endedAt = now`, access
  revoked, emits `subscription.canceled` (voluntary). **cancel-at-period-end** = sets
  `cancelAtPeriodEnd = true` and stays `active` (no status change); the actual `→ canceled` fires when the
  period boundary is reached (the boundary trip is invoked by 04; the transition + flag live here). A9.
- **pause/resume**: `active → paused` (`pausedAt = now`), `paused → active` recomputes the next billing date
  from elapsed paused duration so no period is skipped or double-billed (A10). Pause policy: a `pauseMaxDays`
  (default null = indefinite-hold, documented) enforced at resume/sweep (A11).
- `canceled` is **terminal**: the FSM declares *no* outgoing edges from it. `resubscribe` is a **separate
  domain op** that `createSubscription`s a brand-new row referencing the same `(customer, price)`; it never
  mutates the old row (A2/⚠).
- **Voluntary vs involuntary churn** are distinct: user-initiated `→ canceled` emits `subscription.canceled`;
  dunning-exhausted `past_due → canceled` (via `churnFromPastDue`, called by 06) emits
  `subscription.churned`. Distinct events, distinct `cancellationReason` (`voluntary` | `involuntary`).

### D.2 Mirror the example money-path paradigm
`billing/collectForInvoice.ts` is the real-domain twin of `example/create.ts` + `example/confirm.ts`. Same
seven beats, same primitives:
1. **Validation at the boundary** — `assertPositiveKobo` on `amount_due` (zero handled separately, J8).
2. **The reference = the join key** — `mintReference('INV')` is the invoice's public id **and** the
   `orderReference` handed to the rail (E3): one stable string ties invoice ↔ ledger ↔ event ↔ Nomba.
3. **The resource rows** — the `invoices` row (no status column; status derived) + its `invoice_line_items`.
4. **Well-known accounts** — `ensureSystemAccounts` + `ensureAccount` for `cash` / `accounts_receivable` /
   `platform_revenue` (reuse `ledger/accounts.ts`).
5. **The ledger post** — `postTransaction(kind:'charge')` debits `cash`, credits `platform_revenue`
   (settlement detail deferred to 08); the `assertBalanced` invariant guards Σdebits = Σcredits (J5/J1).
6. **The event emit** — `emitEvent('invoice.created' / 'invoice.finalized')` via the outbox.
7. **The rail collect** — `getRail(method.railKey).collect({ reference: invoice.reference, amountKobo })`
   (02). PULL rails answer succeeded/pending/failed; PUSH rails return pay-instructions and settle later.
The **inbound confirm** mirrors `example/confirm.ts`: resolve our invoice by *our* reference within `ctx`,
**re-verify with Nomba (requery)** before recording, then post settlement + `emitEvent('invoice.paid')` and
advance the period (E4/⚠).

### D.3 Status derived, never stored (A12)
Neither `invoices` nor `subscriptions` carries a drift-prone money-status column. Invoice status is derived
by `deriveInvoiceStatus(db, invoice)` from `(finalized_at, voided_at, amount_due, ledger AR balance)` →
`draft | open | paid | void | uncollectible` (J3). Subscription *lifecycle* status is a real, FSM-guarded
column (it is event-state, not money-state) but it is **made consistent with the ledger**: a subscription is
only `active`/`past_due` in agreement with its latest invoice's derived status, and the serializer asserts
that agreement (A12). The audit trail in `domain_events` lets a subscription's whole history be replayed (A13).

### D.4 No double-charge — structural, not guarded (J6/⚠, K2)
Two independent guards, both required:
- **DB:** `unique(subscription_id, period_index)` on `invoices`. The Nth period can have **exactly one**
  invoice; a racing/replayed issue collides on the index and is caught → returns the existing invoice
  (idempotent), never a second row.
- **Charge:** the invoice `reference` is the rail's `orderReference` (E3). A replayed `collectForInvoice`
  re-sends the *same* reference; Nomba dedupes, and our confirm path is guarded against posting a second
  settlement for an already-`paid` invoice (the seam the example documents, made real here). Result: replay
  the scheduler, the webhook, or the portal → exactly one debit.

### D.5 Zero-amount invoices (J8)
When `amount_due === 0` (e.g. a 100%-off future coupon, or a ₦0 trial-conversion edge), `finalizeInvoice`
short-circuits: mark `paid` directly with **no rail call and no charge ledger post** (a zero-amount
`adjustment` memo row records *why*), then advance the period. No ₦0 charge is ever sent to Nomba.

### D.6 Tenancy, money, idempotency (cross-cutting)
Every row stamped `organizationId`/`environment` from `ctx` (never the client). Money is integer kobo
end-to-end, NGN (E8). Mutating endpoints honour `Idempotency-Key` (the 00 middleware). The FSM ops are
idempotent: re-issuing the same transition is a no-op that returns current state (A14).

---

## Tasks (layer by layer)

### DB (core-db)

- [ ] **`packages/core-db/src/schema/subscriptions.ts`** — `subscriptionsTable`:
      `idPk`, `referenceCol` (SUB), `organization_id` FK (cascade), `environment`, `customer_id` FK
      (→ `customers`, 00), `price_id` FK (→ `prices`, 01), `default_payment_method_id` FK
      (→ `payment_methods`, 02, nullable), `status` (`subscription_status` pgEnum:
      `incomplete · incomplete_expired · trialing · active · past_due · paused · canceled`),
      `collection_method` (`collection_method` pgEnum: `charge_automatically · send_invoice`),
      `current_period_index` (integer, starts 0), `current_period_start` / `current_period_end`
      (timestamptz), `billing_cycle_anchor` (timestamptz; **anchor math is 04**, column lives here),
      `trial_start` / `trial_end` (timestamptz, nullable), `cancel_at_period_end` (boolean default false),
      `canceled_at` / `ended_at` / `paused_at` (timestamptz, nullable), `pause_max_days` (integer, nullable),
      `cancellation_reason` (`cancellation_reason` pgEnum: `voluntary · involuntary`, nullable),
      `version` (integer default 0, optimistic lock), `metadata` jsonb, `createdAt`, `updatedAt`.
      Indexes: `unique(reference)`; keyset `(org, env, created_at desc, id desc)`; lookup
      `(org, env, customer_id)`; `(org, env, status)` for due/list filters.
- [ ] **`packages/core-db/src/schema/subscription-items.ts`** — `subscriptionItemsTable`:
      `idPk`, `referenceCol` (SBI), `organization_id` FK, `environment`, `subscription_id` FK (cascade),
      `price_id` FK (→ `prices`, 01), `quantity` (integer default 1, >0),
      `unit_amount` (bigint kobo — the per-seat unit captured from the price at attach; 05's proration reads it),
      `metadata` jsonb, `createdAt`,
      `updatedAt`. Indexes: `unique(reference)`; `(org, env, subscription_id)`. (Seat/quantity *proration*
      is 05; the row shape is final here.)
- [ ] **`packages/core-db/src/schema/invoices.ts`** — `invoicesTable`:
      `idPk`, `referenceCol` (INV), `organization_id` FK, `environment`, `customer_id` FK,
      `subscription_id` FK (nullable for one-off, but set for sub invoices), `period_index` (integer),
      `billing_reason` (`billing_reason` pgEnum: `subscription_create · subscription_cycle ·
      subscription_update · manual`), `currency` (text, default `NGN`), `subtotal` (bigint kobo),
      `discount_total` (bigint kobo default 0), `total` (bigint kobo), `amount_due` (bigint kobo),
      `amount_paid` (bigint kobo default 0), `attempt_count` (integer default 0),
      `ledger_transaction_id` (uuid, nullable — linkage to the `charge` post),
      `due_date` (timestamptz, nullable), `finalized_at` / `voided_at` / `paid_at` (timestamptz, nullable),
      `period_start` / `period_end` (timestamptz), `metadata` jsonb, `createdAt`, `updatedAt`.
      Indexes: `unique(reference)`; **`unique(subscription_id, period_index)` ← the no-double-charge guard
      (K2/J6)** — partial `where subscription_id is not null`; keyset `(org, env, created_at desc, id desc)`;
      `(org, env, customer_id)`. **No money-status column** (derived). `total`/`amount_due` are immutable
      after `finalized_at` (enforced in domain — J2).
- [ ] **`packages/core-db/src/schema/invoice-line-items.ts`** — `invoiceLineItemsTable`:
      `idPk`, `referenceCol` (ILI), `organization_id` FK, `environment`, `invoice_id` FK (cascade),
      `subscription_item_id` FK (nullable), `kind` (`invoice_line_kind` pgEnum:
      `subscription · proration · discount · credit · adjustment`), `description` (text),
      `amount` (bigint kobo, **signed** — proration credits/discounts are negative; the only place a
      negative kobo is allowed, documented), `quantity` (integer default 1),
      `period_start` / `period_end` (timestamptz, nullable), `createdAt`.
      Indexes: `unique(reference)`; `(org, env, invoice_id)`. (Only `subscription` lines are produced this
      phase; `proration`/`discount`/`credit` are 05.)
- [ ] Register all four in `packages/core-db/src/schema/index.ts`; export `$inferSelect`/`$inferInsert`
      row types (`SubscriptionRow`, `SubscriptionItemRow`, `InvoiceRow`, `InvoiceLineItemRow`).
- [ ] **`pnpm db:generate` then `pnpm db:migrate`** — one clean migration; verify it applies on a fresh DB
      (the testcontainer harness boots it). **Never `push`.** *Proof:* migration file in
      `packages/core-db/drizzle/`, applied green in the e2e boot.

### Contracts (core-contracts)

- [ ] **`packages/core-contracts/src/types/subscription.ts`** — `SubscriptionResponseData`
      (`id`, `customer`, `price`, `status`, `collectionMethod`, `currentPeriodStart/End`,
      `trialStart/End`, `cancelAtPeriodEnd`, `canceledAt`, `endedAt`, `cancellationReason`, `items[]`,
      `latestInvoice` (ref), `currency: 'NGN'`, `environment`, `createdAt`), `SubscriptionStatus`,
      `SubscriptionItemData`.
- [ ] **`packages/core-contracts/src/types/invoice.ts`** — `InvoiceResponseData`
      (`id`, `customer`, `subscription`, `status` (`draft|open|paid|void|uncollectible`), `billingReason`,
      `subtotal`, `discountTotal`, `total`, `amountDue`, `amountPaid`, `currency`, `periodStart/End`,
      `dueDate`, `lineItems[]`, `finalizedAt`, `paidAt`, `voidedAt`, `createdAt`), `InvoiceStatus`,
      `InvoiceLineItemData`.
- [ ] **`packages/core-contracts/src/validations/subscription.ts`** — zod `{ body?, query?, params? }`:
      - `createSubscriptionBody`: `customerId` (ref), `priceId` (ref), optional `paymentMethodId`,
        `collectionMethod` (default `charge_automatically`), `trialDays` (int ≥0, optional override),
        `quantity` (int ≥1, default 1), `metadata`. Refinement: `charge_automatically` **requires** a
        `paymentMethodId` (or the customer's default) **unless** a trial is requested (A5/A8 boundary).
      - `updateSubscriptionBody`: `defaultPaymentMethodId?`, `metadata?` (lifecycle changes go through the
        dedicated action endpoints, not generic update).
      - `cancelSubscriptionBody`: `{ mode: 'now' | 'at_period_end' }` (A9), optional `comment`.
      - `pauseSubscriptionBody`: `{ maxDays?: int }`; `resumeSubscriptionBody`: `{}`.
      - `resubscribeBody`: `{ priceId?: ref, paymentMethodId?: ref }` (defaults reuse the source sub).
      - `listSubscriptionQuery`: `cursor?`, `limit?` (`.coerce`), `customerId?`, `status?`.
- [ ] **`packages/core-contracts/src/validations/invoice.ts`** — `listInvoiceQuery`
      (`cursor?`, `limit?`, `customerId?`, `subscriptionId?`, `status?`); `voidInvoiceBody` (`{ comment? }`).
      DTO types are `z.infer<…>`. Add both files to the type + validation barrels.

### Domain (sara)

> New submodules `packages/sara/src/subscriptions/`, `…/invoices/`, `…/billing/`. Signatures follow the
> house idiom `(db, ctx, input)`; pure invariant checks are I/O-free and unit-testable alone. Add `SUB`,
> `SBI`, `INV`, `ILI` to `packages/sara/src/reference.ts` (`ReferenceDomain` union + comments). Add the
> error groups `SUBSCRIPTION_*` (incl. illegal-transition codes), `INVOICE_*` to
> `packages/errors/src/codes.ts` (public vs internal discipline per C.5). Register the three `./` exports
> in `packages/sara/package.json`.

#### `subscriptions/`
- [ ] **`fsm.ts`** — `LEGAL_TRANSITIONS` (the `(from, to)` set per C.2) `as const`;
      `assertLegalTransition(from, to)` (pure; throws `SUBSCRIPTION_ILLEGAL_TRANSITION` with `{from,to}`);
      `EVENT_FOR_TRANSITION` map (`to` → outbound event name, incl. voluntary/involuntary fork). **Pure,
      I/O-free — unit-tested exhaustively (every legal edge passes, every illegal edge throws).**
- [ ] **`create.ts`** — `createSubscription(txDb, ctx, input)`:
      resolve customer (00) + price (01) + payment method (02) within `ctx`; decide initial state
      (`trialing` if trial; else `incomplete` for `charge_automatically` until first charge; `active` for a
      ₦0/zero edge); mint `SUB`; insert `subscriptions` + one `subscription_items` row; set period 0
      window; `emitEvent('subscription.created')`; if not trialing and not zero, kick the first cycle via
      `runCycle` (D.2). Returns `SubscriptionResponseData`. **Idempotent on `Idempotency-Key`** (00 store).
- [ ] **`transition.ts`** — private `transition(tx, ctx, sub, to, reason)`: assert legal (fsm), update
      `status` + `version+1` under optimistic guard (stale `version` → `SUBSCRIPTION_VERSION_CONFLICT`),
      `emitEvent`. The **single** writer of `status` (A3). Plus the named public ops, each idempotent (A14):
      - `cancelNow(txDb, ctx, subRef, reason)` → `canceled`, `endedAt`, `cancellationReason:'voluntary'`,
        emits `subscription.canceled` (A9).
      - `cancelAtPeriodEnd(txDb, ctx, subRef)` → sets `cancel_at_period_end=true`, **stays `active`**, emits
        `subscription.updated` (A9). The boundary `→ canceled` trip is `tripPeriodEndCancel` (invoked by 04).
      - `pauseSubscription` / `resumeSubscription` (A10/A11; resume recomputes next bill).
      - `enterPastDue(txDb, ctx, sub)` (`active → past_due`; **06 entry hook**) emits
        `invoice.payment_failed` + `subscription.updated`.
      - `recoverFromPastDue` (`past_due → active`; **06 exit hook**, called on a successful retry) and
        `churnFromPastDue` (`past_due → canceled`, `cancellationReason:'involuntary'`, emits
        `subscription.churned`; **06 exit hook**).
      - `expireIncomplete(txDb, ctx, sub)` (`incomplete → incomplete_expired`; the **window timer** is 04).
- [ ] **`resubscribe.ts`** — `resubscribe(txDb, ctx, sourceSubRef, input)`: assert source is `canceled`
      (else `SUBSCRIPTION_NOT_TERMINAL`), then call `createSubscription` with a **new** `SUB` reference;
      **never touch the source row** (A2/⚠). Returns the new subscription.
- [ ] **`queries.ts`** — `getSubscriptionByReference`, `listSubscriptions` (cursor, `ctx`-scoped, filters),
      `getSubscriptionItems`. All `ctx`-scoped (cross-tenant impossible).
- [ ] **`serialize.ts`** — `serializeSubscription(row, items, latestInvoice, derivedConsistencyOk)`:
      public `id` = `reference`; asserts FSM-status ↔ ledger consistency (A12); `currency:'NGN'`; ISO-8601 UTC.
- [ ] **`types.ts`**, **`index.ts`** (barrel). Export `./subscriptions`.

#### `invoices/`
- [ ] **`create.ts`** — `createInvoice(txDb, ctx, input)`: mint `INV`; insert draft `invoices` row keyed
      `(subscription_id, period_index)` — on unique violation **return the existing invoice** (idempotent,
      no second row — K2); insert `invoice_line_items` (one `subscription` line this phase);
      `emitEvent('invoice.created')`.
- [ ] **`finalize.ts`** — `finalizeInvoice(txDb, ctx, invoiceRef)`:
      `assertLineItemsSumToTotal(lines, invoice.total)` (**pure invariant, J4/⚠** — throws
      `INVOICE_LINE_ITEMS_UNBALANCED`); set `finalized_at`; from now the invoice is **immutable** (J2 —
      `total`/`amount_due` writes are rejected by `assertNotFinalized`); if `amount_due === 0` →
      `markPaid` directly with **no charge** (D.5/J8); emit `invoice.finalized`.
- [ ] **`markPaid.ts`** — `markInvoicePaid(tx, ctx, invoice, ledgerTxId)`: guard already-`paid`
      (idempotent, no second settlement — J6); set `paid_at`, `amount_paid = total`, link
      `ledger_transaction_id`; emit `invoice.paid`.
- [ ] **`void.ts`** — `voidInvoice(txDb, ctx, invoiceRef, comment)`: only legal from `draft`/`open` (a
      `paid` invoice is corrected by a **reversal** via `ledger/reverse.ts`, not a void — J2/J9); set
      `voided_at`; emit `invoice.voided`. Defines the **void path + correct ledger entries** (J9).
- [ ] **`status.ts`** — `deriveInvoiceStatus(db, invoice)` → `draft|open|paid|void|uncollectible` from
      `(finalized_at, voided_at, paid_at, amount_due, AR balance)` (J3, A12). Pure-ish (one balance read).
- [ ] **`lineItems.ts`** — `assertLineItemsSumToTotal(lines, total)` (pure, J4); `buildSubscriptionLine(...)`.
- [ ] **`queries.ts`**, **`serialize.ts`**, **`types.ts`**, **`index.ts`**. Export `./invoices`.

#### `billing/`
- [ ] **`collectForInvoice.ts`** — `collectForInvoice(txDb, ctx, invoice, paymentMethod)` — the real-domain
      money path (D.2). If `amount_due === 0` short-circuit to paid (J8). Else: `ensureSystemAccounts` +
      `ensureAccount` (`cash`/`accounts_receivable`/`platform_revenue`); `getRail(method.railKey).collect({
      reference: invoice.reference, amountKobo: invoice.amount_due, metadata })` (E2/E3); on **PULL
      succeeded** → `postTransaction(kind:'charge')` (J5) then `markInvoicePaid` + `advancePeriod`; on
      **PULL failed** → `enterPastDue` + bump `attempt_count` + `emitEvent('invoice.payment_failed')`
      (06 takes over); on **pending / PUSH** → leave `open`, await the inbound confirm. **Never trust a
      client success** (E4).
- [ ] **`confirmInvoiceFromWebhook.ts`** — twin of `example/confirm.ts`: resolve **our** invoice by **our**
      reference within `ctx`; **re-verify with Nomba (requery via the 02 adapter)** — confirm amount ==
      `amount_due` and provider status settled — before recording (E4/⚠); guard already-`paid` (J6);
      `postTransaction(kind:'settlement')` → `markInvoicePaid` → `advancePeriod` (if cycle invoice) →
      `recoverFromPastDue` if the sub was `past_due`. Out-of-order safe (a `payment_success` after a requery
      does not corrupt state).
- [ ] **`runCycle.ts`** — `runCycle(txDb, ctx, subscriptionRef)` — the **single-cycle** orchestrator
      composed of the primitives above: `createInvoice` (billing_reason from period_index) → `finalizeInvoice`
      → `collectForInvoice`. Idempotent on `(subscription_id, period_index)` (re-run returns the existing
      invoice, J6). **This is the unit 04's scheduler will call**; here it is invoked directly in tests.
- [ ] **`advancePeriod.ts`** — `advancePeriod(tx, ctx, sub)`: increment `current_period_index`, roll the
      window forward by the price interval (simple roll only — **anchor/EOM/leap math is 04**), and, if
      `cancel_at_period_end`, trip `tripPeriodEndCancel` instead of rolling. `trialing → active` on the
      first paid cycle (A7).
- [ ] **`index.ts`** (barrel). Export `./billing`.

### API (apps/api)

> Thin controllers only — one file per endpoint, business logic in `sara`. Fixed middleware order per
> contract B.3: `apiKeyAuth → rateLimit → requireScope(...) → idempotency → validate({...}) → controller`
> (reads skip `idempotency`). Built with `jsonHandler<T>` / `paginatedHandler<T>` (B.3). New scopes
> `subscriptions:read` / `subscriptions:write` / `invoices:read` / `invoices:write` added to the API-key
> scope set + contracts.

- [ ] **`apps/api/src/modules/subscriptions/`** — `routes.ts` + `controllers/`:
      - `POST /v1/subscriptions` → `create-subscription.ts` (`subscriptions:write`, idempotent).
      - `GET /v1/subscriptions/:reference` → `get-subscription.ts` (`subscriptions:read`).
      - `GET /v1/subscriptions` → `list-subscriptions.ts` (`paginatedHandler`, `subscriptions:read`).
      - `PATCH /v1/subscriptions/:reference` → `update-subscription.ts` (`subscriptions:write`).
      - `POST /v1/subscriptions/:reference/pause` → `pause-subscription.ts` (`subscriptions:write`).
      - `POST /v1/subscriptions/:reference/resume` → `resume-subscription.ts`.
      - `POST /v1/subscriptions/:reference/cancel` → `cancel-subscription.ts` (body `mode:now|at_period_end`,
        A9).
      - `POST /v1/subscriptions/:reference/resubscribe` → `resubscribe-subscription.ts`.
      Each controller calls exactly one `sara/subscriptions` (or `billing`) fn and shapes the envelope.
- [ ] **`apps/api/src/modules/invoices/`** — `routes.ts` + `controllers/`:
      - `GET /v1/invoices/:reference` → `get-invoice.ts` (`invoices:read`).
      - `GET /v1/invoices` → `list-invoices.ts` (`paginatedHandler`, `invoices:read`).
      - `POST /v1/invoices/:reference/void` → `void-invoice.ts` (`invoices:write`, J9). **No create/update
        invoice endpoint** — invoices are issued by the billing loop, not by the tenant (J2 immutability).
- [ ] Mount both under `/v1` in `apps/api/src/app/main/routes.ts`; add the four scopes to the scope set +
      contracts.

### Wiring

- [ ] **Inbound confirm seam** — extend `apps/api/src/super-modules/worker/workers/inbound-webhook.ts`
      (the 02 seam): on a `payment_success` whose `orderReference` resolves to an `INV` reference, route to
      `confirmInvoiceFromWebhook` (verify-again-then-act). Idempotent on `requestId` (02 dedup) **and** on
      already-`paid` invoice (J6).
- [ ] **`runCycle` entry point** — export `runCycle` from `@nombaone/sara/billing` so 04's scheduler imports
      the *same* primitive the create-path uses (no duplicated billing logic). No cron added here (04).
- [ ] **Event registration** — ensure the new event names (`subscription.created/updated/activated/paused/
      resumed/canceled/churned`, `invoice.created/finalized/paid/payment_failed/voided`) are in the catalog
      the outbox matches against (C.6); delivery transport is 07.

### Tests

- [ ] **unit — FSM (P, A4/⚠):** `subscriptions/fsm.test.ts` — table-driven over `LEGAL_TRANSITIONS`:
      assert **every legal edge passes** and **every illegal edge** (`canceled → active`,
      `incomplete → past_due`, `canceled → anything`, `paused → past_due`, …) throws
      `SUBSCRIPTION_ILLEGAL_TRANSITION`. One assertion per illegal edge (A4 "a test proving each").
- [ ] **unit — invariants (J4/J1):** `invoices/lineItems.test.ts` — `assertLineItemsSumToTotal` passes when
      Σ = total, throws `INVOICE_LINE_ITEMS_UNBALANCED` otherwise; signed line sums (negative discount/credit)
      sum correctly; all integer kobo, no float.
- [ ] **unit — status derivation (J3, A12):** `invoices/status.test.ts` — each
      `(finalized/voided/paid/amount_due)` combo maps to the right `draft|open|paid|void|uncollectible`.
- [ ] **e2e (testcontainers Postgres+Redis, real migrations, fake rail adapter — B.10):**
      - **Happy path (E2/E3/E4/J5/A7):** create sub (trial) → trial end → first charge via fake PULL
        succeeds → `payment_success` webhook **requeried** → invoice `paid`, ledger `charge` posted,
        `trialing → active`, period advanced.
      - **No double-charge (J6/⚠/K2):** replay the cycle (re-call `runCycle`), replay the webhook, and fire
        a concurrent confirm → assert **exactly one** `charge` ledger transaction and **one** invoice for the
        period; `(subscription_id, period_index)` unique proven by the rejected duplicate insert.
      - **Idempotency-Key (K):** repeat `POST /v1/subscriptions` with the same key → same subscription, no
        second row.
      - **Zero-amount (J8):** finalize a ₦0 invoice → `paid` with **no rail call**, no charge ledger post.
      - **cancel-now vs cancel-at-period-end (A9/⚠):** `mode:now` revokes immediately + emits
        `subscription.canceled`; `mode:at_period_end` keeps `active` + sets the flag; the boundary trip
        cancels.
      - **trial cancel (A8):** cancel during trial → `canceled`, **zero charge ledger posts**.
      - **pause/resume (A10):** pause then resume → next billing date recomputed, no skipped/double period.
      - **resubscribe (A2/⚠):** cancel → resubscribe → **new** `SUB` reference, source row untouched
        (`canceled`).
      - **immutability (J2):** attempt to mutate a finalized invoice's `total` → rejected
        (`INVOICE_ALREADY_FINALIZED`).
      - **isolation smoke (H/N):** Tenant A cannot read/mutate Tenant B's subscription or invoice.
      - **voluntary vs involuntary churn (D, A13):** user cancel emits `subscription.canceled`;
        `churnFromPastDue` emits `subscription.churned` — distinct events in `domain_events`.

---

## Verification checklist (rubric — one line per box, each says HOW it's demonstrated)

- [ ] **A1** — all seven states reachable: each materialized by a create/transition in the e2e suite
      (incomplete, trialing, active, past_due, paused, canceled) + `incomplete_expired` via `expireIncomplete`.
- [ ] **A2 ⚠** — `canceled` is terminal (FSM declares no outgoing edge); `resubscribe` creates a **new** `SUB`
      row, source untouched — proven by the resubscribe e2e (read FSM table + run the test).
- [ ] **A3** — `status` has exactly one writer (`transition`); no op writes it directly — proven by grep +
      the FSM routing test.
- [ ] **A4 ⚠** — every illegal transition throws `SUBSCRIPTION_ILLEGAL_TRANSITION`; one assertion per
      illegal edge in `fsm.test.ts` (read the table + run the table-driven test).
- [ ] **A5** — `incomplete` is set only for a never-succeeded first `charge_automatically`; it never
      serializes as `active` — asserted in the create-without-trial e2e.
- [ ] **A7** — `trialing → active` on the first successful charge at trial end — happy-path e2e asserts the
      status flip + the ledger `charge`.
- [ ] **A8** — `trialing → canceled` attempts **no charge** — trial-cancel e2e asserts zero charge ledger
      posts.
- [ ] **A9 ⚠** — cancel-now (immediate revoke + `subscription.canceled`) and cancel-at-period-end (stays
      `active`, flag set, boundary trip) are distinct ops — proven by the two-mode e2e (read + run).
- [ ] **A10** — pause→resume recomputes the next billing date, no skip/double — pause/resume e2e asserts the
      recomputed window.
- [ ] **A11** — pause policy (`pause_max_days`, default indefinite-hold) documented (D.1) and enforced at
      resume — asserted by an over-limit resume test.
- [ ] **A12 ★** — subscription status is consistent with the ledger/derived invoice status; the serializer
      asserts agreement — proven by `status.test.ts` + the happy-path consistency assertion.
- [ ] **A13 ★** — every transition emits an immutable `domain_events` row; a subscription's history is
      replayable — the churn e2e reads back the full event sequence.
- [ ] **A14** — replaying a transition is a no-op returning current state — idempotency assertion on a
      repeated cancel/pause.
- [ ] **J1 ⚠** — all amounts integer kobo, no floats — enforced by `assertPositiveKobo`/`assertBalanced`;
      grep proves no float arithmetic on the money path (read + run unit tests).
- [ ] **J2** — finalized invoices are immutable; corrections are new entries — `INVOICE_ALREADY_FINALIZED`
      e2e + the reversal path for paid corrections.
- [ ] **J3** — invoice lifecycle `draft → open → paid` + `void`/`uncollectible` enforced via
      `deriveInvoiceStatus` — `status.test.ts`.
- [ ] **J4 ⚠** — Σ line items = total enforced by `assertLineItemsSumToTotal` at finalize — `lineItems.test.ts`
      (read the invariant + run the unbalanced-throws case).
- [ ] **J5** — every money-affecting change posts a ledger entry — `collectForInvoice` posts a `charge`,
      confirm posts a `settlement`; asserted in the happy-path e2e.
- [ ] **J6 ⚠** — no double-charge: replay scheduler + webhook + concurrent confirm → exactly one debit and
      one invoice per period — the no-double-charge e2e + `(subscription_id, period_index)` unique (read +
      run).
- [ ] **J8** — zero-amount invoice → `paid` with no ₦0 charge — zero-amount e2e asserts no rail call, no
      charge post.
- [ ] **J9** — void path defined with correct ledger entries — `void-invoice` e2e (void from open) + the
      paid-correction reversal.
- [ ] **E2** — recurring charges use the stored payment method/`tokenKey` from 02, no re-collection — the
      cycle e2e charges via the persisted method.
- [ ] **E3 ⚠** — each charge carries a unique `orderReference` = the invoice `reference`; replay is
      idempotent on Nomba's side — asserted by the fake adapter recording one reference across replays
      (read the wiring + run the replay).
- [ ] **E4 ⚠** — charge outcomes verified server-side via webhook + requery; never a client success —
      `confirmInvoiceFromWebhook` requeries before posting (read the confirm path + run the out-of-order test).
- [ ] **E8** — NGN consistent across order/charge/invoice/ledger — asserted on every serialized money field.
- [ ] **K2** — DB unique constraints make duplicate period charges structurally impossible —
      `(subscription_id, period_index)` unique proven by the rejected duplicate insert.
- [ ] Grep gate: zero `example`/`EXA` references introduced; new modules import narrow `sara` slices, never
      the root barrel.
- [ ] `pnpm type-check`, `pnpm build`, `pnpm test` all green across the workspace.

## Done when

`subscriptions` + `subscription_items` + `invoices` + `invoice_line_items` are live behind real migrations;
the lifecycle FSM enforces every legal transition and rejects every illegal one (with a test per illegal
edge); trials enter `trialing` with no charge and convert on first paid cycle; a single billing cycle runs
end-to-end (issue invoice → collect via the 02 rail → post the double-entry ledger → confirm by webhook +
requery → mark `paid` → advance period) with the invoice line-item-sum = total invariant and
finalized-invoice immutability enforced; `(subscription_id, period_index)` unique + reference-keyed
idempotency make a double-charge structurally impossible (proven by replaying the scheduler, the webhook,
and a concurrent confirm to exactly one debit); cancel-now/cancel-at-period-end/pause/resume/resubscribe and
voluntary-vs-involuntary churn events all behave per contract C.2; and `pnpm type-check`, `pnpm build`,
`pnpm test` are green. The phase hands 04 a single-cycle `runCycle` primitive to drive on a clock, and 06 the
`past_due` entry/exit hooks to attach a dunning policy to.
