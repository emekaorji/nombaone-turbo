# Nomba One: Console Plan · 02 · Core screens

> **What this is.** The full specification for the everyday merchant screens: subscriptions, customers, plans and prices, and invoices. Every screen below gives its purpose, the exact DTO fields it shows (real names from `packages/core-contracts`), the real actions (endpoint method and path, with `Idempotency-Key` called out where money moves), FSM-aware action gating, and the empty, loading, and error states. ASCII wireframes are the Phase A pencil starting point for every screen. Cited names are real and confirmed against the code; anything not confirmable is marked "(verify)".
>
> **Depends on:** doc 00 (overview: north star, personas, scope boundary, inherited design language, voice). Leans on doc 01 (IA and navigation) for the app shell, the test/live switch, and the cursor-pagination model; doc 03 (money screens) for payment methods, settlements, coupons, and credits detail; doc 06 (components) for the data table, filter bar, detail drawer, timeline, and FSM badge set these screens compose from; and doc 08 (empty and error states) for the complete error-code to hint, docUrl, and fields rendering contract.

---

## 1. How to read this, and the rules every screen obeys

Read this section once. It defines the contracts every screen in this doc inherits, so the per-screen sections stay focused on what is unique to each screen.

### 1.1 The three response envelopes

Every read and write returns one of three envelopes, all discriminated on `success`, all carrying `meta.requestId`.

- **Success:** `{ success: true, statusCode, data, meta: { requestId } }`. Detail screens render `data` directly.
- **Paginated:** success plus `pagination: { limit, hasMore, nextCursor }`. Lists are **cursor-only**. There are no totals and no page numbers. Every list screen renders a "Load more" affordance driven by `hasMore` and `nextCursor`, never a numbered pager.
- **Error:** `{ success: false, error: { code, message, hint, docUrl, fields? }, meta: { requestId } }`. Every error carries `hint` and `docUrl`. The console renders `error.hint` verbatim next to the failed action, deep-links `error.docUrl`, and shows `meta.requestId` for support. Validation failures (`CLIENT_VALIDATION_FAILED`) carry `error.fields`, a map of field path to messages, which the console renders inline beneath the matching input.

### 1.2 Money is integer kobo. Render naira by dividing by 100, never with floats

Every money field on the wire ends in `InKobo` and is an integer count of kobo. The console renders naira with one shared helper that divides by 100 using integer arithmetic (naira part is `Math.trunc(kobo / 100)`, kobo remainder is `kobo % 100`) and never `parseFloat`. Currency is always `NGN`.

Any naira the merchant types is multiplied by 100 to store kobo at the input boundary, and any amount shown is divided by 100 at the display boundary. The conversion happens explicitly, in one place, per direction. This guards the known 100x risk: the Nomba checkout order endpoint takes naira decimal strings while the engine stores integer kobo, and the charge and renewal unit is not yet live-confirmed, so the console never lets a raw naira value reach a charge or amount field without an explicit pin to kobo. Wherever a screen displays or accepts money, that rule holds.

### 1.3 Idempotency where money moves

The API requires an `Idempotency-Key` header on the money-moving actions and treats it as optional (deduplicated if present) on the rest. The console **generates the key itself**, one stable key per user-initiated action, and retries the same key on network failure so a double-tap or a dropped connection never doubles an operation. The merchant never sees or types a key.

Money-moving actions in this doc that carry a **required** key: subscription create, subscription change, subscription cancel, subscription resubscribe, customer credit grant, and customer credit void. Actions with an **optional** key (still sent by the console): subscription update, pause, resume, schedule create and cancel, discount apply and remove, customer create and update, plan create, update, archive, price create and deactivate, and invoice void. Each screen names which of its actions require the key.

### 1.4 FSM-aware action gating

Subscriptions run a seven-state finite state machine. The console reads the current `status` and enables only the actions whose transition is legal from that state, so the merchant cannot trigger an illegal action. The legal edges, confirmed in `packages/sara/src/subscriptions/fsm.ts`, are:

```
incomplete           -> incomplete_expired | active | canceled
trialing             -> active | past_due | canceled
active               -> past_due | paused | canceled
past_due             -> active | canceled
paused               -> active | canceled
incomplete_expired   -> (terminal, no outgoing edge)
canceled             -> (terminal, no outgoing edge)
```

`canceled` and `incomplete_expired` are terminal. `canceled` has no un-cancel: the only forward path is `resubscribe`, which mints a brand new subscription rather than transitioning out of `canceled`. A no-op (from equals to) is always allowed, so re-issuing the same state is safe.

Two subscription errors get specific handling, defined once here and referenced per screen:

- **`SUBSCRIPTION_VERSION_CONFLICT`** means the subscription changed under you (optimistic concurrency), most often because the billing scheduler advanced it while the merchant was acting. The console handles this **silently**: it re-fetches the subscription with `GET /v1/subscriptions/:id`, reapplies the intended change to the fresh version, and retries once. The merchant sees nothing unless the retry also conflicts, in which case the console reloads the detail and shows a quiet "This subscription changed, review and try again" notice.
- **`SUBSCRIPTION_ILLEGAL_TRANSITION`** should never reach a merchant, because gating disables illegal actions. If it fires anyway (the state moved between load and click), the console catches it, re-fetches, re-gates the action bar to the current status, and shows the same quiet notice rather than an error dialog.

### 1.5 The loading, empty, and error state contract

Every screen implements three non-happy states, in the voice of doc 00 (direction, not mood).

- **Loading:** skeleton rows for lists, skeleton field blocks for detail. No spinner-only blank screens.
- **Empty:** an invitation to act, never a dead end. A list with zero rows names the thing to create and offers the create action. A filtered list with zero rows says the filter matched nothing and offers to clear the filter.
- **Error:** the failed action renders `error.hint` verbatim, a link to `error.docUrl`, and the `meta.requestId`. A read that fails renders a retry panel with the same `requestId`. A 429 (`RATE_LIMIT_EXCEEDED`) reads the `Retry-After` header and backs off. A 503 (`PLATFORM_MAINTENANCE`) tells the merchant reads still work and writes are briefly paused.

### 1.6 The two-phase method

Every screen ships in two phases, each with its own done criteria (collected in section 15).

- **Phase A (pencil):** low-fi frames in the `.pen` design source, built from the ASCII wireframes below, wired to the real data shape and states. Done when the frame shows the real DTO fields, the real action set gated by FSM, and the loading, empty, and error states.
- **Phase B (build):** the screen built to the Phase A frames against `/v1`, with idempotency, gating, and error rendering wired live. Done when the screen drives real requests, renders real envelopes, and passes the state and gating checks. Once the `.pen` frames exist, they are the 1:1 gate and the build matches them exactly.

---

## 2. Subscriptions: list

**Purpose.** The merchant's roll call of who is subscribed, who is failing, and who has left. It is the entry point to every subscription detail and to the create flow.

**Endpoint.** `GET /v1/subscriptions` (paginated). Query params, confirmed in `listSubscriptionQuery`: `customerId`, `status`, `limit` (1 to 100, default 20), `cursor`.

**Filters.** Two server-side facets map directly to query params:

- **Status**, the seven-state FSM: `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `paused`, `canceled`. Each is a filter chip and each row's badge uses the exact enum string, no synonyms.
- **Collection method**: `charge_automatically` or `send_invoice`. (verify: `listSubscriptionQuery` exposes `customerId` and `status` but not `collectionMethod`; until the query gains that param, the console filters collection method client-side over the loaded page, or sends it once the API adds it.)

A `customerId` filter scopes the list to one customer and is set automatically when the merchant opens the list from a customer detail.

**Data per row (from `SubscriptionResponseData`).** `id` (the `nbo…sub` reference), `customerId`, `status` (badge), `collectionMethod`, `currentPeriodEnd` (next renewal), `latestInvoiceId`, and `createdAt`. Amount per period is not on the subscription DTO; the row shows the price reference `priceId` and the console resolves its `unitAmountInKobo` from the price for the naira column, rendered by the section 1.2 helper.

**Status to badge mapping.** Draft-like `incomplete` and `incomplete_expired` read neutral, `trialing` reads info, `active` reads accent, `past_due` reads warning, `paused` reads neutral, `canceled` reads danger. A subscription that recovered from `past_due` back to `active` shows the success live-dot on its next render (the recovery peak from doc 00).

**Actions.** Row click opens the detail (section 3). The primary action is **New subscription**, which opens the no-code wizard (section 14) for merchants or a compact create form for developers. Create is `POST /v1/subscriptions` and requires an `Idempotency-Key`.

**Wireframe (Phase A).**

```
┌ Subscriptions ───────────────────────────────────  [ + New subscription ] ┐
│                                                                            │
│ Status: [All] [Trialing] [Active] [Past due] [Paused] [Canceled] [Incompl.]│
│ Collection: [All] [Automatic] [Send invoice]         Customer: [ all ▾ ]   │
│                                                                            │
│ ┌────────────┬───────────────┬──────────┬───────────┬────────────┬──────┐ │
│ │ Subscription│ Customer      │ Status   │ Amount    │ Renews     │ Method│ │
│ ├────────────┼───────────────┼──────────┼───────────┼────────────┼──────┤ │
│ │ nbo…sub    │ ada@shop.io   │ ●Active  │ ₦12,000/mo│ 12 Jul     │ Auto  │ │
│ │ nbo…sub    │ tunde@x.co    │ ●Past due│ ₦5,000/mo │ overdue    │ Auto  │ │
│ │ nbo…sub    │ zoe@lab.ng    │ ●Trialing│ ₦20,000/mo│ trial→9 Jul│ Auto  │ │
│ │ nbo…sub    │ ken@co.ng     │ ●Canceled│ ₦8,000/mo │ ended      │ Invoic│ │
│ └────────────┴───────────────┴──────────┴───────────┴────────────┴──────┘ │
│                                            [ Load more ]  (cursor, no page) │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** six skeleton rows.
- **Empty (no subscriptions):** "No subscriptions yet. Create your first subscription to start billing." with the New subscription action. Honest, no placeholder rows.
- **Empty (filter matched nothing):** "No subscriptions match this filter." with a clear-filter action.
- **Error:** read-failure retry panel with `requestId`. `INVALID_CURSOR` (a stale or malformed cursor) drops the cursor and reloads from the first page.

---

## 3. Subscriptions: detail

**Purpose.** The single source of truth for one subscription: its current state, its schedule, its audit history, its next invoice, and every legal action. This is where the bill, fail, recover story is legible on real data.

**Endpoints.**

- `GET /v1/subscriptions/:id` returns `SubscriptionResponseData`.
- `GET /v1/subscriptions/:id/events` returns the append-only domain-event history for the audit timeline.
- `GET /v1/subscriptions/:id/upcoming-invoice` returns `UpcomingInvoiceResponseData`, a computed preview that persists nothing.

**Data shown (from `SubscriptionResponseData`).** `domain` (always `subscription`, the discriminator the console switches on, never the id suffix), `id`, `customerId`, `priceId`, `status`, `collectionMethod`, `currentPeriodIndex`, `currentPeriodStart`, `currentPeriodEnd`, `trialStart`, `trialEnd`, `cancelAtPeriodEnd`, `canceledAt`, `endedAt`, `cancellationReason` (`voluntary` or `involuntary`), `defaultPaymentMethodId`, `items[]` (each with item `id`, `priceId`, `quantity`), `latestInvoiceId`, `currency`, `environment`, and `createdAt`.

The header renders the status badge, the customer link, the price and quantity from `items[]`, and the next renewal from `currentPeriodEnd`. When `cancelAtPeriodEnd` is true, the header shows a "Cancels on {currentPeriodEnd}" chip so a scheduled cancellation is never a surprise. When `status` is `canceled`, the header shows `canceledAt`, `endedAt`, and whether `cancellationReason` was `voluntary` (the merchant or customer chose to stop) or `involuntary` (dunning exhausted, the churned outcome). These two are visually distinct and never conflated.

### 3.1 The events audit timeline

`GET /v1/subscriptions/:id/events` feeds a vertical, status-dotted timeline that renders the frozen event vocabulary verbatim: `subscription.created`, `subscription.activated`, `subscription.trial_will_end`, `invoice.created`, `invoice.finalized`, `invoice.payment_failed`, `invoice.action_required`, `invoice.payment_recovered`, `subscription.paused`, `subscription.resumed`, `subscription.updated`, and the terminal fork `subscription.canceled` (voluntary) versus `subscription.churned` (involuntary). The recovery event lands in the success color with the live dot. The churn event reads danger and is labeled "Churned (dunning exhausted)" so it never reads like a voluntary cancel.

### 3.2 The upcoming-invoice preview

`GET /v1/subscriptions/:id/upcoming-invoice` renders a preview card from `UpcomingInvoiceResponseData`: `periodIndex`, `periodStart`, `periodEnd`, `billingReason`, `subtotalInKobo`, `totalInKobo`, `amountDueInKobo`, and the preview `lineItems[]`. All amounts render through the section 1.2 helper. The card is labeled "Preview, not yet issued" because this computes and persists nothing. If a schedule phase applies at the next boundary, the preview reflects that phase's price, and the card notes "Reflects a scheduled change."

**Wireframe (Phase A).**

```
┌ nbo…sub · Ada Obi (ada@shop.io)                    ●Active   [ Actions ▾ ] ┐
│ ₦12,000 / month · qty 1 · Automatic · renews 12 Jul 2026                   │
│ Cancels on 12 Jul  (shown only when cancelAtPeriodEnd = true)              │
│                                                                            │
│ ┌ Current period ──────────────┐ ┌ Upcoming invoice (preview) ──────────┐ │
│ │ #4 · 12 Jun → 12 Jul 2026    │ │ #5 · 12 Jul → 12 Aug · cycle         │ │
│ │ default method: nbo…pmt card │ │ subtotal   ₦12,000                   │ │
│ │ trial: none                  │ │ total      ₦12,000                   │ │
│ └──────────────────────────────┘ │ amount due ₦12,000  (not yet issued) │ │
│                                   └──────────────────────────────────────┘ │
│                                                                            │
│ ┌ Timeline (events) ───────────────────────────────────────────────────┐  │
│ │ ● subscription.activated        12 Jun 09:02                          │  │
│ │ ● invoice.created  #4           12 Jun 09:02   ₦12,000                 │  │
│ │ ○ invoice.payment_failed  #3    12 May 09:05   insufficient_funds      │  │
│ │ ● invoice.payment_recovered #3  13 May 07:11   ₦5,000  (live dot)      │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌ Reproduce this ─ SDK | curl ─────────────────────────────────────────┐  │
│ │ await nomba.subscriptions.retrieve("nbo…sub")                         │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton header, skeleton period and preview cards, skeleton timeline.
- **Empty (timeline):** a subscription created seconds ago shows only `subscription.created`; that is a valid, full timeline, not an empty state.
- **Empty (upcoming invoice):** a `canceled` subscription has no upcoming invoice; the card reads "No upcoming invoice. This subscription has ended."
- **Error:** `SUBSCRIPTION_NOT_FOUND` renders "No subscription at this id in {environment}" and a hint to check the test/live switch. Any write error is handled per section 4.

---

## 4. Subscriptions: the lifecycle actions

All lifecycle actions live in the detail Actions menu and are gated by the FSM (section 1.4). This section specifies each action, its endpoint, its idempotency requirement, and its gating. The console renders only the enabled actions for the current `status`.

### 4.1 The action-gating matrix

Enabled (`Y`) or hidden or disabled (`.`) per status. `canceled` and `incomplete_expired` are terminal.

```
action                 incomplete  trialing  active  past_due  paused  incomplete_expired  canceled
─────────────────────  ──────────  ────────  ──────  ────────  ──────  ──────────────────  ────────
Change plan or price       .          Y        Y        Y        .            .               .
Change quantity            .          Y        Y        Y        .            .               .
Switch interval            .          Y        Y        Y        .            .               .
Pause                      .          .        Y        .        .            .               .
Resume                     .          .        .        .        Y            .               .
Cancel now                 Y          Y        Y        Y        Y            .               .
Cancel at period end       .          Y        Y        Y        .            .               .
Apply or remove discount   Y          Y        Y        Y        Y            .               .
Schedule next-cycle change .          Y        Y        Y        .            .               .
Update default method      Y          Y        Y        Y        Y            .               .
Resubscribe                .          .        .        .        .            .               Y
```

Notes: Pause is only legal from `active` (edge `active -> paused`). Resume is only legal from `paused` (edge `paused -> active`). Cancel-now is legal from every non-terminal state that has an edge to `canceled`. Cancel-at-period-end sets a flag on a running subscription and so is offered only where a future period boundary exists (`trialing`, `active`, `past_due`). Resubscribe is offered only on a terminal `canceled` subscription.

### 4.2 Cancel now versus cancel at period end: two operations, not a toggle

Both hit `POST /v1/subscriptions/:id/cancel` with an `Idempotency-Key` (required). They differ by the `mode` field in `cancelSubscriptionBody`:

- **Cancel now** (`{ mode: "now" }`) ends the subscription immediately, transitions it to `canceled`, sets `canceledAt` and `endedAt`, and records `cancellationReason: "voluntary"`. Access stops now.
- **Cancel at period end** (`{ mode: "at_period_end" }`) sets `cancelAtPeriodEnd: true` and leaves the subscription running until `currentPeriodEnd`, at which point the sweep ends it. Access continues to the paid-through date.

These are two distinct menu items with two distinct confirmations, never a single toggle. The confirm dialog for cancel-now says "Ends access immediately." The confirm dialog for cancel-at-period-end says "Keeps access until {currentPeriodEnd}, then ends." Both accept an optional `comment` (max 500 chars) that the merchant can add as a cancellation note. A subscription already flagged `cancelAtPeriodEnd` offers an "Undo scheduled cancellation" affordance (verify the exact undo endpoint; if none exists, the console re-issues `PATCH`/state as the API supports, otherwise it documents the flag as forward-only).

### 4.3 Resubscribe mints a new subscription

`canceled` is terminal. There is no reactivation. The canceled detail offers **Start a new subscription**, which calls `POST /v1/subscriptions/:id/resubscribe` with an `Idempotency-Key` (required) and an optional `resubscribeBody` of `priceId` and `paymentMethodId`. On success the API returns a **new** `nbo…sub` reference, and the console navigates to that new subscription's detail. The copy is explicit: "This creates a new subscription. The canceled one stays in your history." Calling resubscribe on a non-terminal subscription returns `SUBSCRIPTION_NOT_TERMINAL`; gating hides the action so a merchant never hits it.

### 4.4 Change: price, quantity, interval switch, proration behavior

`POST /v1/subscriptions/:id/change` with an `Idempotency-Key` (required), body `changeSubscriptionBody`: at least one of `priceId`, `quantity`, or `intervalSwitch`, plus `prorationBehavior` which is `create_prorations` (default) or `none`. This is distinct from the metadata-only `PATCH` (section 4.7). The change form previews the proration before it commits by rendering the upcoming-invoice preview after the merchant picks the new price or quantity, so the naira impact is visible before confirmation.

- An upgrade (net positive proration) is charged now.
- A downgrade (net negative proration) is banked as a `downgrade_proration` credit on the customer, not refunded to the rail. The form says so: "The difference is added as account credit, applied to future invoices."
- `intervalSwitch` across a change of billing interval is not prorated the same way; if the engine returns `PRORATION_INTERVAL_SWITCH_UNSUPPORTED`, the console routes the merchant to schedule the interval change at the next boundary (section 5) with a clear message.

Gating: offered for `trialing`, `active`, and `past_due`. During `trialing` there is no paid period yet, so proration is a no-op and the form hides the proration preview.

### 4.5 Pause and resume

- **Pause:** `POST /v1/subscriptions/:id/pause`, optional `Idempotency-Key` (sent by the console), body `pauseSubscriptionBody` with optional `maxDays`. Legal only from `active`. The dialog offers an optional auto-resume after `maxDays`.
- **Resume:** `POST /v1/subscriptions/:id/resume`, optional `Idempotency-Key`, empty body. Legal only from `paused`.

### 4.6 Apply and remove discount

- **Apply:** `POST /v1/subscriptions/:id/discount`, optional `Idempotency-Key`, body `applyDiscountBody` with `coupon` (a `nbo…cpn` reference or the tenant-facing coupon `code`). Returns a `DiscountResponseData` (status `active`, `cyclesRemaining`, `startAt`, `endAt`). One active discount per subscription.
- **Remove:** `DELETE /v1/subscriptions/:id/discount`, optional `Idempotency-Key`.

Errors surface inline on the discount field: `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MAX_REDEMPTIONS_REACHED`, `COUPON_INVALID_DEFINITION`, and `COUPON_ALREADY_APPLIED` each render their `hint`. Coupon creation itself lives on the money screens (doc 03); this screen only applies and removes.

### 4.7 Update default method and metadata

`PATCH /v1/subscriptions/:id`, optional `Idempotency-Key`, body `updateSubscriptionBody`: `defaultPaymentMethodId` and/or `metadata` (at least one field). This does not transition the FSM and carries no proration. It is available in every non-terminal state.

**Error handling for all actions.** On `SUBSCRIPTION_VERSION_CONFLICT`, silently re-fetch and retry once (section 1.4). On `SUBSCRIPTION_ILLEGAL_TRANSITION`, re-fetch, re-gate, and show the quiet notice. On `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` (a `charge_automatically` subscription with no usable method), route the merchant to attach a method (doc 03) with the returned `hint`.

---

## 5. Subscriptions: schedules

**Purpose.** Bank a change to take effect at the next cycle boundary rather than now. A schedule is how a merchant moves a subscriber to a new price or quantity without proration mid-cycle: the change applies when the sweep crosses the boundary.

**Endpoints.**

- `GET /v1/subscriptions/:id/schedule` returns `SubscriptionScheduleResponseData`: `id` (`nbo…sch`), `subscriptionId`, `status` (`active`, `released`, or `canceled`), and `phases[]`, each with `startIndex` (the period index the phase takes effect), `priceId`, optional `quantity`, and `consumedAt` (set when the sweep applies it).
- `POST /v1/subscriptions/:id/schedule`, optional `Idempotency-Key`, body `scheduleChangeBody`: `priceId` (required), optional `quantity`, and `effectiveAt` which is `next_cycle` (the only mode today; the enum is built to add future modes without breaking).
- `DELETE /v1/subscriptions/:id/schedule`, optional `Idempotency-Key`, cancels the active schedule.

**Relationship to change.** Change (section 4.4) applies now with proration. Schedule applies at the boundary with no proration. The console presents them as one decision: "Apply now" routes to change, "Apply at next renewal" routes to schedule. This keeps the merchant from having to know which endpoint does which.

**Gating.** Create a schedule for `trialing`, `active`, or `past_due` (states with a next boundary). A schedule conflict returns `SUBSCRIPTION_SCHEDULE_CONFLICT`; the console tells the merchant a schedule already exists and offers to replace it (cancel then create). An invalid `effectiveAt` returns `SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT`.

**Wireframe (Phase A).**

```
┌ nbo…sub · Schedule ────────────────────────────────  [ + Schedule change ] ┐
│                                                                            │
│ Status: ●Active                                                            │
│ ┌ Phase ─────────────┬──────────────┬──────────┬───────────────────────┐  │
│ │ Takes effect        │ New price     │ Quantity │ Applied               │  │
│ ├─────────────────────┼──────────────┼──────────┼───────────────────────┤  │
│ │ period #5 (12 Aug)  │ nbo…prc ₦15k │ 1        │ pending (consumedAt=∅)│  │
│ └─────────────────────┴──────────────┴──────────┴───────────────────────┘  │
│                                                       [ Cancel schedule ]   │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton phase row.
- **Empty:** "No scheduled changes. Bank a price or quantity change to apply at the next renewal." with the Schedule change action, offered only where gating allows.
- **Error:** `SUBSCRIPTION_SCHEDULE_NOT_FOUND` on a stale delete reloads the panel. Conflict and invalid-effective-at render their hints.

---

## 6. Customers: list

**Purpose.** The directory of end-payers. Entry point to each customer detail and to create.

**Endpoint.** `GET /v1/customers` (paginated). Query params from `listCustomerQuery`: `email` (exact match), `limit`, `cursor`.

**Data per row (from `CustomerResponseData`).** `id` (`nbo…cus`), `name`, `email`, `phone`, `environment`, `createdAt`. A search box binds to the `email` query param for exact lookup; free-text name search is client-side over the loaded page until the API adds a name filter (verify).

**Actions.** Row click opens detail (section 7). Primary action **New customer** opens the create form. Create is `POST /v1/customers` with an optional `Idempotency-Key` (sent by the console).

**Wireframe (Phase A).**

```
┌ Customers ─────────────────────────────────────────  [ + New customer ] ┐
│ Search email: [ ada@shop.io          ]                                   │
│ ┌────────────┬──────────────┬─────────────────┬──────────────┬────────┐ │
│ │ Customer    │ Name          │ Email            │ Phone        │ Added  │ │
│ ├────────────┼──────────────┼─────────────────┼──────────────┼────────┤ │
│ │ nbo…cus    │ Ada Obi       │ ada@shop.io      │ +234 80…     │ 2 Jun  │ │
│ │ nbo…cus    │ Tunde A.      │ tunde@x.co       │ none         │ 4 Jun  │ │
│ └────────────┴──────────────┴─────────────────┴──────────────┴────────┘ │
│                                                          [ Load more ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No customers yet. Add your first customer to start subscribing them." with New customer.
- **Empty (search):** "No customer with that email." with a clear-search action.
- **Error:** read-failure retry panel with `requestId`.

---

## 7. Customers: detail, create, and edit

**Purpose.** One customer's profile, their subscriptions, their invoices, their credit balance, and their active discount, plus the forms to create and edit them.

**Endpoints.**

- `GET /v1/customers/:id` returns `CustomerResponseData`.
- `POST /v1/customers`, optional `Idempotency-Key`, body `createCustomerBody`: `email` (required, valid email), `name` (required, 1 to 255 chars), optional `phone`, optional `metadata`.
- `PATCH /v1/customers/:id`, optional `Idempotency-Key`, body `updateCustomerBody`: optional `name`, `phone`, `metadata` (at least one). Email is the natural key within (organization, environment) and is not editable here.

**Data shown.** `domain` (`customer`), `id`, `email`, `name`, `phone`, `metadata`, `environment`, `createdAt`, `updatedAt`. Beneath the profile the detail embeds three panels sourced from other endpoints: this customer's subscriptions (`GET /v1/subscriptions?customerId=`), this customer's invoices (`GET /v1/invoices?customerId=`), and this customer's credit balance (section 8).

**`CUSTOMER_EMAIL_TAKEN` handling.** Email is unique per (organization, environment). On create, a duplicate returns `CUSTOMER_EMAIL_TAKEN`. The console renders this **inline on the email field** from `error.fields` (the field-path map on the validation envelope), with the code's hint: reuse the existing customer or use a different email. The form offers a "View existing customer" link that searches by that email.

**Wireframe (Phase A, detail).**

```
┌ Ada Obi · nbo…cus ─────────────────────────────────────  [ Edit ] [ ▾ ] ┐
│ ada@shop.io · +234 80… · added 2 Jun 2026 · test                        │
│                                                                          │
│ ┌ Subscriptions ───────────────┐ ┌ Credit balance ─────────────────────┐ │
│ │ nbo…sub  ●Active   ₦12,000/mo│ │ ₦2,500 available                    │ │
│ │ nbo…sub  ●Canceled ₦8,000/mo │ │ [ Grant credit ]                    │ │
│ └──────────────────────────────┘ └─────────────────────────────────────┘ │
│ ┌ Invoices ────────────────────┐ ┌ Discount ───────────────────────────┐ │
│ │ nbo…inv  paid   ₦12,000      │ │ SAVE10 · active · 2 cycles left     │ │
│ │ nbo…inv  open   ₦12,000      │ │ [ Remove ]                          │ │
│ └──────────────────────────────┘ └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Wireframe (Phase A, create and edit form).**

```
┌ New customer ─────────────────────────────────────────────────────────┐
│ Email  [ ada@shop.io                         ]  (required)             │
│        ⚠ A customer with this email already exists. Reuse it, or use   │
│          a different email.  [ View existing customer ]               │
│ Name   [ Ada Obi                             ]  (required)             │
│ Phone  [ +234 80…                            ]  (optional)            │
│ Metadata [ { "tier": "gold" }                ]  (optional JSON)       │
│                                          [ Cancel ]  [ Create customer ]│
└────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton profile and skeleton panels.
- **Empty (embedded panels):** each panel has its own empty copy ("No subscriptions yet", "No invoices yet", "No credit granted", "No active discount").
- **Error:** `CUSTOMER_NOT_FOUND` renders the environment-mismatch hint. `CUSTOMER_EMAIL_TAKEN` renders inline per above. Validation failures render per-field from `error.fields`.

---

## 8. Customers: credit (balance and grants)

**Purpose.** Show and manage a customer's account credit, the ledger-backed balance applied to future invoices oldest-first. Credit comes from downgrade prorations, manual grants, goodwill, or coupons.

**Endpoints.**

- `GET /v1/customers/:id/credit` returns `CreditBalanceResponseData`: `customerId`, `balanceInKobo` (the O(1) ledger balance), and `grants[]`.
- Each grant is a `CreditGrantResponseData`: `id` (`nbo…crg`), `customerId`, `amountInKobo`, `remainingInKobo`, `source` (`downgrade_proration`, `manual`, `goodwill`, or `coupon`), `sourceReference`, `voidedAt`, `createdAt`.
- **Grant:** `POST /v1/customers/:id/credit` with an `Idempotency-Key` (**required**, money moves), body `grantCreditBody`: `amountInKobo` (positive integer kobo), `source` (`manual` or `goodwill`), optional `sourceReference`, optional `metadata`.
- **Void:** `DELETE /v1/customers/:id/credit/:grantId` with an `Idempotency-Key` (**required**). Voids the **unconsumed remainder** of a grant, not already-applied credit.

**Money handling.** The grant form takes naira, multiplies by 100 to send `amountInKobo`, and shows the balance and each grant by dividing kobo by 100 (section 1.2). The oldest-first application order is shown so a merchant understands `remainingInKobo` versus original `amountInKobo` per grant.

**Wireframe (Phase A).**

```
┌ Ada Obi · Credit ──────────────────────────────────────  [ Grant credit ] ┐
│ Balance: ₦2,500 available   (applied to invoices oldest-first)            │
│ ┌──────────┬──────────────────┬──────────┬───────────┬──────────┬───────┐ │
│ │ Grant     │ Source            │ Granted  │ Remaining │ Added    │       │ │
│ ├──────────┼──────────────────┼──────────┼───────────┼──────────┼───────┤ │
│ │ nbo…crg  │ downgrade_prorat. │ ₦2,000   │ ₦2,000    │ 12 Jun   │ [Void]│ │
│ │ nbo…crg  │ goodwill          │ ₦1,000   │ ₦500      │ 4 Jun    │ [Void]│ │
│ │ nbo…crg  │ manual            │ ₦1,000   │ ₦0        │ 1 Jun    │ used  │ │
│ └──────────┴──────────────────┴──────────┴───────────┴──────────┴───────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton balance and rows.
- **Empty:** "No credit granted. Grant credit to apply to this customer's future invoices." with Grant credit.
- **Error:** `CREDIT_GRANT_ALREADY_VOIDED` on a stale void reloads the panel. `CREDIT_GRANT_NOT_FOUND` reloads. `CREDIT_INVALID_AMOUNT` renders inline on the amount field. Void is disabled on a grant whose `remainingInKobo` is 0 (nothing to void) and on one with a `voidedAt` set.

---

## 9. Customers: discount (apply and remove)

**Purpose.** Apply a coupon to the customer so it discounts their subscriptions, or remove it. A discount is the application of a coupon; the coupon definition itself is authored on the money screens (doc 03). One active discount per customer.

**Endpoints.**

- **Apply:** `POST /v1/customers/:id/discount`, optional `Idempotency-Key`, body `applyDiscountBody` with `coupon` (a `nbo…cpn` reference or its `code`). Returns `DiscountResponseData`: `status` (`active`), `couponId`, `cyclesRemaining`, `startAt`, `endAt`.
- **Remove:** `DELETE /v1/customers/:id/discount`, optional `Idempotency-Key`.

**Rendered on** the customer detail Discount panel (section 7). Applying when one is already active returns `COUPON_ALREADY_APPLIED`; the panel shows the existing discount and offers Remove first. Coupon validation errors (`COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MAX_REDEMPTIONS_REACHED`, `COUPON_INVALID_DEFINITION`) render inline on the coupon input with their hints.

**States.**

- **Empty:** "No active discount. Apply a coupon to discount this customer's subscriptions."
- **Error:** the coupon-code errors above, each inline.

---

## 10. Plans and prices: plans list and plan detail

**Purpose.** The catalog. Plans are the product; prices are the immutable, versioned ways to charge for a plan. A plan is retired by archive, never deleted, so a plan with subscribers is never orphaned.

**Endpoints (plans).**

- `GET /v1/plans` (paginated). Query from `listPlanQuery`: `status` (`active` or `archived`), `limit`, `cursor`.
- `GET /v1/plans/:id` returns `PlanResponseData`.
- `POST /v1/plans`, optional `Idempotency-Key`, body `createPlanBody`: `name` (1 to 200 chars), optional `description`, optional `metadata`.
- `PATCH /v1/plans/:id`, optional `Idempotency-Key`, body `updatePlanBody`: optional `name`, `description`, `metadata` (at least one).
- `POST /v1/plans/:id/archive`, optional `Idempotency-Key`. There is intentionally **no DELETE route**.

**Data (from `PlanResponseData`).** `domain` (`plan`), `id` (`nbo…pln`), `name`, `description`, `status` (`active` or `archived`), `metadata`, `environment`, `createdAt`, `updatedAt`. The plan detail embeds the plan's prices (section 11).

**Archive, never delete.** The Archive action is the only retirement path. Archiving a plan that still has active subscribers returns `PLAN_HAS_ACTIVE_SUBSCRIBERS`; the console tells the merchant to migrate or cancel those subscriptions first and links the plan's subscriber list. Archiving an already-archived plan returns `PLAN_ALREADY_ARCHIVED` (a stale click), which reloads the detail. A duplicate name on create returns `PLAN_NAME_TAKEN`, rendered inline on the name field.

**Wireframe (Phase A, plans list).**

```
┌ Plans ─────────────────────────────────────────────────  [ + New plan ] ┐
│ Status: [Active] [Archived] [All]                                        │
│ ┌────────────┬────────────────────┬──────────┬──────────┬────────────┐  │
│ │ Plan        │ Name                │ Status   │ Prices   │ Updated    │  │
│ ├────────────┼────────────────────┼──────────┼──────────┼────────────┤  │
│ │ nbo…pln    │ Pro                 │ ●Active  │ 2 active │ 12 Jun     │  │
│ │ nbo…pln    │ Legacy Starter      │ Archived │ 0 active │ 1 May      │  │
│ └────────────┴────────────────────┴──────────┴──────────┴────────────┘  │
│                                                          [ Load more ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No plans yet. Create your first plan, then add a price to it."
- **Error:** archive and create errors render per above; reads use the retry panel.

---

## 11. Prices: nested under a plan, immutable, the change-price action

**Purpose.** Show and manage the prices under a plan. Prices are immutable: once created they never change, so billing history stays stable. The console models a "price change" as create a new price and deactivate the old one, behind a single action, and it never shows an edit form for a price.

**Endpoints.**

- `GET /v1/plans/:id/prices` (paginated). Query from `listPriceQuery`: `planRef`, `active`, `limit`, `cursor`.
- `GET /v1/prices/:id` returns `PriceResponseData`.
- `GET /v1/prices` (paginated, global read) for cross-plan price lookups.
- `POST /v1/plans/:id/prices`, optional `Idempotency-Key`, scope `prices:write`, body `createPriceBody`: `unitAmountInKobo` (positive integer kobo), `interval` (`day`, `week`, `month`, `year`), `intervalCount` (default 1), `usageType` (`licensed` or `metered`, default `licensed`), `billingScheme` (`per_unit` or `tiered`, default `per_unit`), `trialPeriodDays` (default 0), optional `metadata`.
- `POST /v1/prices/:id/deactivate`, optional `Idempotency-Key`, scope `prices:write`. This flips `active` to false; it is a sellability change, not a money edit.

**Data (from `PriceResponseData`).** `domain` (`price`), `id` (`nbo…prc`), `planId` (the plan reference), `unitAmountInKobo`, `currency` (`NGN`), `interval`, `intervalCount`, `usageType`, `billingScheme`, `trialPeriodDays`, `active`, `metadata`, `environment`, `createdAt`.

**The single change-price action.** The merchant sees one button, "Change price." It opens a form that takes a new naira amount (and optionally a new interval), and on confirm it does two calls behind the scenes: `POST /v1/plans/:id/prices` to create the new active price, then `POST /v1/prices/:oldId/deactivate` to retire the old one. The form carries a clear, always-visible note: **"Existing subscribers keep their current price. New subscriptions use the new price."** The immutability mechanic never leaks to the merchant; a developer viewing the raw price sees the two-call reality in the reproduce-this panel.

**Money.** The amount input is naira; the console multiplies by 100 to send `unitAmountInKobo` and divides by 100 to display. A price amount is never sent to any charge endpoint from this form; this only defines the catalog price.

**Tiered and metered are a later phase.** `usageType: metered` and `billingScheme: tiered` are schema-present but not yet supported end-to-end. The console gates them: the price form defaults to `licensed` and `per_unit` and marks tiered and metered as "Coming later." If the API returns `PRICE_TIERED_NOT_SUPPORTED`, the console renders its hint and keeps the flat per-unit path.

**Wireframe (Phase A, prices under a plan).**

```
┌ Pro · nbo…pln · Prices ────────────────────────────────  [ Change price ] ┐
│ ┌──────────┬───────────┬───────────┬──────────┬────────┬───────────────┐  │
│ │ Price     │ Amount     │ Interval   │ Trial    │ Type   │ Status        │  │
│ ├──────────┼───────────┼───────────┼──────────┼────────┼───────────────┤  │
│ │ nbo…prc  │ ₦15,000    │ month × 1  │ 0 days   │ licensed│ ●Active       │  │
│ │ nbo…prc  │ ₦12,000    │ month × 1  │ 7 days   │ licensed│ Deactivated   │  │
│ └──────────┴───────────┴───────────┴──────────┴────────┴───────────────┘  │
│                                                                            │
│ ┌ Change price ────────────────────────────────────────────────────────┐  │
│ │ New amount (₦) [ 15000 ]   Interval [ month ▾ ] × [ 1 ]               │  │
│ │ Trial days [ 0 ]                                                       │  │
│ │ Existing subscribers keep their current price. New subscriptions use  │  │
│ │ the new price.                                     [ Change price ]    │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton price rows.
- **Empty:** "No price yet. Add a price so customers can subscribe to this plan." with an Add price action (the first price is a plain create, not a change).
- **Error:** `PRICE_ALREADY_INACTIVE` on a stale deactivate reloads. `PRICE_PLAN_MISMATCH` guards a price referenced against the wrong plan. `PRICE_IMMUTABLE`, if it ever surfaces, confirms the create-new-and-deactivate model to a developer. Validation failures render per-field.

---

## 12. Invoices: list

**Purpose.** The record of every bill the engine issued, and their derived status. There is no create; invoices are engine-issued.

**Endpoint.** `GET /v1/invoices` (paginated). Query from `listInvoiceQuery`: `customerId`, `subscriptionId`, `status`, `limit`, `cursor`.

**The status filter is a subset of the derived statuses.** `listInvoiceQuery.status` accepts `draft`, `open`, `paid`, `void`, and `uncollectible`. The derived status set also includes `partially_paid`, which is **not** a server-side filter value. To surface partially-paid invoices the console filters `open` server-side and splits `partially_paid` from `open` client-side using each invoice's `amountPaidInKobo`, and labels the filter accordingly. This is stated on the screen so the behavior is not a mystery.

**Data per row (from `InvoiceResponseData`).** `id` (`nbo…inv`), `customerId`, `subscriptionId`, `status` (derived, see section 13), `billingReason`, `totalInKobo`, `amountDueInKobo`, `amountRemainingInKobo`, `periodEnd`, `dueDate`, `createdAt`. Amounts render through the section 1.2 helper.

**Status to badge mapping.** `draft` neutral, `open` warning, `partially_paid` warning with a fraction chip, `paid` success, `void` neutral, `uncollectible` danger.

**Wireframe (Phase A).**

```
┌ Invoices ──────────────────────────────────────────────────────────────┐
│ Status: [All] [Open] [Partially paid*] [Paid] [Void] [Uncollectible]     │
│ *derived client-side from open + amountPaid                              │
│ ┌──────────┬──────────────┬────────────┬──────────┬──────────┬────────┐ │
│ │ Invoice   │ Customer      │ Reason      │ Total    │ Due      │ Status │ │
│ ├──────────┼──────────────┼────────────┼──────────┼──────────┼────────┤ │
│ │ nbo…inv  │ ada@shop.io   │ cycle       │ ₦12,000  │ ₦0       │ ●Paid  │ │
│ │ nbo…inv  │ tunde@x.co    │ cycle       │ ₦5,000   │ ₦5,000   │ ●Open  │ │
│ │ nbo…inv  │ zoe@lab.ng    │ create      │ ₦20,000  │ ₦8,000   │ Part.  │ │
│ └──────────┴──────────────┴────────────┴──────────┴──────────┴────────┘ │
│                                                          [ Load more ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No invoices yet. Your first invoice appears after the first billing cycle." No create action, because invoices are engine-issued.
- **Empty (filter):** "No invoices match this filter." with clear-filter.
- **Error:** read-failure retry panel with `requestId`.

---

## 13. Invoices: detail

**Purpose.** One invoice, its derived status, its money breakdown, its signed line items, its billing reason, and its retry state. Void is available only when draft or open. A paid invoice is corrected by ledger reversal, not void.

**Endpoints.**

- `GET /v1/invoices/:id` returns `InvoiceResponseData`.
- `POST /v1/invoices/:id/void`, optional `Idempotency-Key`, body `voidInvoiceBody` with an optional `comment` (max 500 chars).

**Status is server-derived. The console reads it.** The server derives status with the precedence below in `deriveInvoiceStatus` and returns the result on the `status` field. The console renders that server-provided `status` (`draft`, `open`, `partially_paid`, `paid`, `void`, or `uncollectible`) as the source of truth and never recomputes it on the client. `InvoiceResponseData` serializes only `finalizedAt`, `paidAt`, and `voidedAt`, not `uncollectibleAt`, so the client cannot detect `uncollectible` without the server status. The precedence the server applies, in this exact order:

1. `voidedAt` set, so `void`.
2. `uncollectibleAt` set, so `uncollectible`.
3. `paidAt` set, so `paid`.
4. `finalizedAt` not set, so `draft`.
5. `amountDueInKobo` is 0, so `paid` (a finalized zero-amount invoice is paid, never a zero-naira charge).
6. `amountPaidInKobo` greater than 0, so `partially_paid`.
7. otherwise `open`.

The console maps the server `status` straight to its badge, so the badge always matches the server and never drifts from a client recompute.

**Money fields shown (all `InKobo`, rendered by section 1.2).** `subtotalInKobo`, `discountTotalInKobo`, `creditTotalInKobo`, `totalInKobo`, `amountDueInKobo`, `amountPaidInKobo`, and `amountRemainingInKobo`. The breakdown reads: subtotal, minus discount total, minus credit total, gives total, gives amount due, and amount paid and amount remaining track collection.

**Billing reason.** `billingReason` is one of `subscription_create`, `subscription_cycle`, `subscription_update`, or `manual`, rendered verbatim as a labeled chip.

**Signed line items (from `InvoiceLineItemData`).** Each line has `id`, `kind` (`subscription`, `proration`, `discount`, `credit`, or `adjustment`), `description`, `amountInKobo` (**signed**, the only place negatives live), and `quantity`. Discount and credit lines carry negative `amountInKobo` and render with a minus sign; subscription, proration, and adjustment lines are typically positive. The lines sum to `totalInKobo`.

**Retry state (attempt count and last failure).** The invoice DTO does not carry `attemptCount` or `lastFailureReason` (verify: neither field exists on `InvoiceResponseData`). The console sources retry state from the dunning view instead. For a subscription invoice it links to `GET /v1/subscriptions/:id/dunning`, which returns `DunningStateResponseData` (`attemptsUsed`, `maxAttempts`, `nextAttemptAt`, `graceAccessUntil`) and `attempts[]` of `DunningAttemptResponseData` (`attemptNumber`, `status`, `branch`, `failureReason`, `gatewayMessage`, `outcome`, `nextAttemptAt`). The invoice detail renders a compact "Retry state" strip from that data (attempts used out of max, the concrete `failureReason`, and the next attempt time) and deep-links the full dunning cockpit in doc 05. The failure reason is always a concrete string a merchant can act on, never a shrug.

**Void gating.** Void is enabled only when the derived status is `draft` or `open`. It is disabled for `partially_paid`, `paid`, `void`, and `uncollectible`. Attempting void on a non-voidable invoice returns `INVOICE_NOT_VOIDABLE`; the console renders its hint: because this invoice is paid or already void, issue a refund or credit note instead. A paid invoice is never voided; the detail routes a correction to a refund (doc 03) or a ledger reversal, which the copy states plainly.

**Wireframe (Phase A).**

```
┌ nbo…inv · Ada Obi ─────────────────────────────────  ●Paid   [ Void ✕ ] ┐
│ reason: subscription_cycle · period 12 Jun → 12 Jul · due 12 Jun         │
│ (Void disabled: only draft or open invoices can be voided)               │
│                                                                          │
│ ┌ Line items ──────────────────────────────────────────────────────────┐ │
│ │ subscription  Pro monthly           ×1        ₦12,000                  │ │
│ │ discount      SAVE10 (10%)                     -₦1,200                 │ │
│ │ credit        applied account credit           -₦500                  │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ subtotal ₦12,000 · discount -₦1,200 · credit -₦500                    │ │
│ │ total ₦10,300 · due ₦0 · paid ₦10,300 · remaining ₦0                  │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌ Retry state (from dunning) ──────────────────────────────────────────┐ │
│ │ (shown only for an unpaid subscription invoice in recovery)          │ │
│ │ attempts 2 / 4 · last failure: insufficient_funds · next 26 Jun      │ │
│ │ [ Open dunning cockpit → ]                                            │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton header, breakdown, and lines.
- **Empty:** an invoice always has at least one line; there is no empty line-item state for a finalized invoice.
- **Error:** `INVOICE_NOT_FOUND` renders the environment-mismatch hint. `INVOICE_NOT_VOIDABLE` and `INVOICE_ALREADY_PAID` render their hints and disable void. `SUBSCRIPTION_VERSION_CONFLICT` never applies here (invoices are engine-issued and immutable once finalized).

---

## 14. The merchant no-code create-a-subscription wizard

**Purpose.** Let a merchant with no engineer start a subscription end to end through a guided flow, without ever seeing an `Idempotency-Key`, a `priceId`, or a kobo value. This is the Tenet 7 proof: a merchant runs a subscription without an engineer.

**The flow, three steps plus confirm.**

1. **Customer.** Pick an existing customer (search by `email`) or create one inline. Create is `POST /v1/customers` (optional key, sent by the console) with `email` and `name`. `CUSTOMER_EMAIL_TAKEN` resolves to "use the existing one" inline.
2. **Plan and price.** Pick an existing plan and one of its active prices, or create a plan and a price inline. The price input is **naira only**; the wizard multiplies by 100 to send `unitAmountInKobo` on `POST /v1/plans/:id/prices`. The word `priceId` never appears; the merchant picks "Pro, ₦15,000 per month." Create-plan is `POST /v1/plans`, create-price is `POST /v1/plans/:id/prices`.
3. **Rail.** Pick how the customer pays: card (best-effort recurring, with the honest note that a bank may require the customer to confirm with a one-time code, handled by a pay link), direct debit (the silent bank mandate rail, live-gated), or bank transfer (a virtual account the customer pushes to). The wizard sets `collectionMethod` and the payment-method plumbing behind the scenes. It never shows a card-entry field; card capture happens on the hosted checkout (doc 03).
4. **Confirm.** A plain-language summary (customer, plan and naira price, rail, when the first charge happens). Confirm calls `POST /v1/subscriptions` with a console-generated `Idempotency-Key`, `customerId`, `priceId`, `collectionMethod`, and `paymentMethodId` where the rail provides one. On success it navigates to the new subscription's detail (section 3).

**What the wizard hides.** `Idempotency-Key` (generated), `priceId` (chosen by name and price), kobo (entered and shown as naira), `paymentMethodId` (resolved by the rail step). What it never hides: the honest first-charge timing, the card best-effort caveat, and the live-gated status of direct debit.

**Wireframe (Phase A).**

```
┌ Create a subscription ─────────────────────  step 2 of 3 ┐
│ ①Customer  ─●─  ②Plan & price  ───  ③How they pay        │
│                                                          │
│ Customer:  Ada Obi (ada@shop.io)                [change] │
│                                                          │
│ Plan:   ( Pro )  ( Starter )  ( + New plan )             │
│ Price:  (•) ₦15,000 / month   ( ) ₦150,000 / year        │
│         ( + New price )                                  │
│                                                          │
│         Amounts are in naira. We store them exactly.     │
│                                     [ Back ]  [ Next → ] │
└──────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** each step's pick-list shows skeletons while its list loads.
- **Empty:** step 2 with no plans offers "Create your first plan" inline; step 3 with no method offers to add one (routes to hosted checkout for card, virtual account for transfer, mandate consent for direct debit).
- **Error:** any step's validation renders inline from `error.fields`. A `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` on confirm (automatic collection with no method and no trial) routes back to step 3 with the hint. On confirm the console retries the same `Idempotency-Key` on a network failure so a re-tap never double-creates.

---

## 15. Phase A and Phase B done criteria, per screen group

Each screen group ships through the two-phase method (section 1.6). The done criteria below are the gate.

**Subscriptions (sections 2 to 5).**

- Phase A done: list, detail, actions menu, and schedule frames exist in `.pen`, showing the seven-state badges, the FSM action-gating matrix (section 4.1) reflected in which actions are visible per status, the events timeline, the upcoming-invoice preview, and the loading, empty, and error states.
- Phase B done: list filters bind to `status` and `customerId`; detail renders `SubscriptionResponseData`, `/events`, and `/upcoming-invoice`; every action hits its real endpoint with the correct idempotency requirement; cancel-now and cancel-at-period-end are two operations; resubscribe navigates to a new subscription; `SUBSCRIPTION_VERSION_CONFLICT` retries silently; `SUBSCRIPTION_ILLEGAL_TRANSITION` re-gates.

**Customers (sections 6 to 9).**

- Phase A done: list, detail, create and edit form, credit panel, and discount panel frames exist, showing `CustomerResponseData`, the embedded subscription, invoice, credit, and discount panels, and the inline `CUSTOMER_EMAIL_TAKEN` treatment.
- Phase B done: create and edit hit `POST` and `PATCH`; `CUSTOMER_EMAIL_TAKEN` renders inline from `error.fields`; credit grant and void carry required idempotency and render naira from kobo; discount apply and remove render coupon errors inline.

**Plans and prices (sections 10 to 11).**

- Phase A done: plans list, plan detail, and the prices panel with the single change-price form exist, showing archive-not-delete, immutability modeled as new-plus-deactivate, the "existing subscribers keep their price" note, and tiered and metered gated as later.
- Phase B done: archive hits `/archive` and handles `PLAN_HAS_ACTIVE_SUBSCRIBERS`; change-price does create-new then deactivate-old in one action; naira inputs store kobo; `PRICE_TIERED_NOT_SUPPORTED` is handled.

**Invoices (sections 12 to 13).**

- Phase A done: list and detail frames exist, showing the derived-status precedence, the signed line items, the full money breakdown, the billing reason, and the dunning-sourced retry strip, with void gated to draft and open.
- Phase B done: the badge is computed from timestamps and amounts matching `deriveInvoiceStatus`; the status filter maps to the server subset with `partially_paid` split client-side; void is enabled only for draft and open and handles `INVOICE_NOT_VOIDABLE`; the retry strip reads the dunning endpoint.

**No-code wizard (section 14).**

- Phase A done: the three-step-plus-confirm frame exists, with naira-only price inputs, the rail picker, and no `Idempotency-Key` or `priceId` on screen.
- Phase B done: each step drives its real endpoint; the confirm generates the key, sends kobo, and navigates to the new subscription; the card best-effort and direct-debit live-gated notes are present and honest.

Proceed to doc 03.
