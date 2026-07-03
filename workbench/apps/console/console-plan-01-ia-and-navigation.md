# Nomba One: Console Plan · 01 · Information architecture and navigation

> **What this is.** This doc defines the complete console information architecture: the app shell, the left-nav areas and every screen inside them, the mandatory test and live environment switch, the cursor-pagination model, RBAC-gated visibility, the URL structure, and the responsive strategy. Every screen names the real endpoint, entity, event, or status that justifies it. No screen exists without a backing capability. This is the map. The per-screen anatomy (fields, copy, motion) lives in docs 02 through 05.
>
> **Depends on:** doc 00 (north star, personas, scope boundary, the console-auth dependency, inherited design language and voice). It also leans on the real code it cites: `apps/api/src/apps/main/server/routes.ts`, every `apps/api/src/apps/main/modules/*/routes.ts`, and `packages/core-contracts/src/types/*`. Component and density specs are in doc 06. Empty and error-state copy is cataloged in doc 08. Auth, team, and onboarding are in doc 09.

---

## 0. Grounding constraints that shape the whole IA

Read these before the sections below. They are not stylistic. They decide the structure.

- **Money is integer kobo on the wire.** Every money field ends in `InKobo` (`unitAmountInKobo`, `amountDueInKobo`, `mrrInKobo`, `grossInKobo`, `netToTenantInKobo`, and so on). The console renders naira by dividing by 100 for display, using integer math, never a float. The console never sends a raw amount to a charge or setup endpoint without pinning the unit, because there is a known 100x naira-versus-kobo risk on the charge boundary. Every amount input stores kobo, and every amount display divides by 100. This rule reappears at every screen that shows or accepts money.
- **The public reference is the human `nbo` id.** Every resource carries a stable reference of the form `nbo` + 12 digits + a 3-letter domain suffix, for example `nbo749201835566cus`. URLs use this reference. The internal UUID never appears.
- **Switch on the `domain` discriminator, never the id suffix.** Every response `data` object leads with a `domain` field (`subscription`, `invoice`, `customer`, `settlement`, and so on). When the console resolves an arbitrary reference (command palette, global search, a pasted id) it routes by the fetched `domain`, not by parsing the 3-letter suffix. The suffix is a display hint.
- **One environment at a time.** Every domain row carries `environment` (`test` or `live`). The console shows exactly one organization and one environment at once. The environment switch is `org_sessions.environment`. Test and live are separate databases and separate API-key sets.
- **Cursor pagination everywhere.** Every list returns `pagination.hasMore` and `pagination.nextCursor`. There are no page numbers and no totals. Lists load more by cursor.
- **Console-auth is dependency zero.** `apps/api` authenticates only per-org API keys (`nbo_test_` and `nbo_live_`). It exposes no login, session, or team endpoints. The DB has the tables (`org_users`, `org_sessions`, `password_reset_tokens`, `api_keys`) but no HTTP surface serves them. Console login, RBAC, team management, and key minting are gated on a console-auth API that is not yet built. Screens that depend on it are marked "gated on console-auth API." Doc 09 owns that surface.

---

## 1. The app shell

The shell is one persistent frame that wraps every area. It holds a left sidebar grouped by area, a top bar, the environment switch, the user and organization menu, and an optional command palette. It inherits the chrome, tokens, and motion from the design language in doc 00. Overlay layers, the app container width, and the density scale are specified in doc 06 and referenced here.

### 1.1 Shell anatomy

Three regions:

1. **Left sidebar** (fixed, `--surface-1` over `--background`). The primary navigation, grouped by area, with the active area highlighted in the single emerald accent. Collapses to a slide-over sheet at 390px (section 7).
2. **Top bar** (sticky, hairline bottom border). Left to right: the collapsed-nav trigger on small screens, breadcrumbs for the current area and detail, a global search field that opens the command palette, the environment switch, and the user and organization menu. On a test deployment it also carries a persistent test-mode banner.
3. **Content region** (`--background`). The area's own screens render here. Lists, detail views, drawers, and forms all live inside this region. The region scrolls; the sidebar and top bar do not.

### 1.2 Left sidebar, grouped by area

The sidebar groups the twelve areas into five clusters plus a pinned Settings footer. Group labels are quiet `--subtle-foreground` captions, not dividers. The order matches the mandate.

```
Overview                         (standalone, top)

BILLING
  Subscriptions
  Customers
  Plans and prices
  Invoices

MONEY
  Payments and rails
  Dunning and recovery
  Settlements and payouts
  Coupons and credits

BUILD
  Developers
    · API keys
    · Webhooks
    · Events
    · Test mode        (only when the environment is test)
    · API reference

Reconciliation                   (standalone)

──────────────────────────────── (pinned footer)
Settings
  · Organization
  · Billing settings
  · Team
  · Nomba connection
```

Rules:

- Exactly one area is active at a time, highlighted with the emerald accent on its label and an accent left-edge marker. The accent budget from doc 00 holds: the active nav marker is one of the few places emerald appears in the chrome.
- **Test mode** is a Developers sub-item that renders only when the current environment is `test` and the API deployment reports `INFRA_ENVIRONMENT=test`. It is absent, not disabled, on live. This mirrors the server, where the `/v1/test/*` router mounts only on a test deployment (`apps/api/src/apps/main/server/routes.ts`).
- Nav items are gated by role (section 5). A viewer sees the read-heavy areas and none of the write actions. A developer sees Build in full and is withheld money-out and team surfaces.
- The sidebar shows the current organization name and the active environment at the top, above Overview, so the operator always knows which tenant and which ring they are editing.

### 1.3 Top bar

The top bar carries orientation and global controls, never area content.

- **Breadcrumbs.** Area, then the current object by its human reference when a detail is open, for example `Subscriptions / nbo749201835566sub`. Breadcrumbs are the primary "where am I" cue and the back path out of a detail.
- **Global search.** A field that opens the command palette (section 1.6). It accepts a reference paste and resolves by `domain`.
- **Environment switch.** Section 1.4.
- **User and organization menu.** Section 1.5.
- **Test-mode banner.** On a test deployment, a persistent strip reads "Test data. No real money moves here." It is informational, giving direction rather than mood, per doc 00. It never appears on live.

### 1.4 The environment switch (mandatory)

A segmented control in the top bar with two states, `Test` and `Live`, backed by `org_sessions.environment`.

- Switching environment re-scopes every list and detail in the console. The two environments are separate databases and separate key contexts, so switching is a context change, not a filter. The console holds a test key context and a live key context and uses the one the switch selects.
- The switch is present on every screen. It is the single most load-bearing control in the shell, because a plan, subscription, or settlement in test is a different row from its live counterpart.
- Selecting `Test` reveals the Test mode nav sub-item (when the deployment is test-pinned) and paints the test-mode banner. Selecting `Live` hides both.
- Money and status semantics are byte-identical across environments. Only the data differs. The switch never changes how an amount is rendered or how a status is named.
- **Role and state gating.** A viewer can switch environments to read either ring but writes stay disabled. If the current environment has no active Nomba connection (`org_nomba_accounts.status` is not `active`), the console still lets the operator read and build, and surfaces a "connect your Nomba account to settle" banner rather than blocking navigation.

### 1.5 The user and organization menu

One user maps to one organization, so the menu is a user menu with organization context, not an org switcher.

- **Identity block.** The signed-in `org_users` name, email, and `role` (`owner`, `admin`, `developer`, or `viewer`), plus the organization name and its public reference.
- **Actions.** Profile, security (TOTP enrollment status), sign out. Owners and admins also see a shortcut to Team.
- All of this is **gated on the console-auth API**. Until that surface ships, the menu renders a designed placeholder that names the dependency plainly rather than faking a session.

### 1.6 Command palette (optional)

A `Cmd/Ctrl K` palette that does three things:

1. **Jump to a resource by reference.** Paste any `nbo…` id. The palette fetches it, reads the `domain` field, and routes to the matching detail. It never parses the 3-letter suffix to decide the route.
2. **Navigate to an area.** Type an area name to jump.
3. **Run an action.** A short list of safe, high-frequency actions the current role is allowed to run, for example "Create subscription" or "New coupon." Money-moving and destructive actions are reachable but always land on a confirmation, never fire from the palette.

The palette is optional for the first console milestone. When present it obeys the same RBAC gating as the nav.

### 1.7 ASCII: desktop shell

The Phase A pencil starting point for the shell at the app working width (section 7, exact value in doc 06).

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Acme Ltd     │ Subscriptions / nbo749201835566sub      [⌘K search]  ●Test    │
│ nbo…org  ●Test│──────────────────────────────────────────────────────────────│
│              │  Test data. No real money moves here.                         │
│ Overview     │──────────────────────────────────────────────────────────────│
│              │                                                               │
│ BILLING      │   Subscription  nbo749201835566sub          [Active ●]        │
│ ▸Subscriptions│   ──────────────────────────────────────────────────────     │
│  Customers   │   Customer   nbo…cus   Price nbo…prc   Period 3               │
│  Plans/prices│   Next bill  2026-07-28                                        │
│  Invoices    │                                                               │
│              │   [ Pause ] [ Cancel ] [ Change plan ] [ Apply discount ]     │
│ MONEY        │                                                               │
│  Payments    │   Timeline                                                    │
│  Dunning     │   ● invoice.created       2026-06-28                          │
│  Settlements │   ● invoice.paid          2026-06-28                          │
│  Coupons     │   ● subscription.activated 2026-06-28                         │
│              │                                                               │
│ BUILD        │                                                               │
│  Developers  │                                                               │
│              │                                                               │
│ Reconciliation│                                                              │
│──────────────│                                                               │
│ Settings     │                                                               │
│  [ user ▾ ]  │                                                               │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### 1.8 ASCII: 390px collapsed sheet

At 390px the sidebar collapses. The top bar keeps a hamburger trigger, the breadcrumb truncates to the area, and the environment switch stays visible because it is mandatory. Opening the nav slides a full-height sheet over the content behind a backdrop.

```
Collapsed (nav closed)              Sheet open (nav)
┌────────────────────────────┐      ┌────────────────────────────┐
│ ☰  Subscriptions   ●Test   │      │ Acme Ltd        ●Test    ✕ │
│────────────────────────────│      │────────────────────────────│
│ Test data. No real money.  │      │ Overview                   │
│────────────────────────────│      │                            │
│ Subscription               │      │ BILLING                    │
│ nbo749201835566sub         │      │  Subscriptions   ▸         │
│ [Active ●]                 │      │  Customers                 │
│                            │      │  Plans and prices          │
│ Customer  nbo…cus          │      │  Invoices                  │
│ Period 3 · Next 2026-07-28 │      │                            │
│                            │      │ MONEY                      │
│ [ Pause ]  [ Cancel ]      │      │  Payments and rails        │
│ [ Change plan ]            │      │  Dunning and recovery      │
│                            │      │  Settlements and payouts   │
│ Timeline                   │      │  Coupons and credits       │
│ ● invoice.paid  06-28      │      │                            │
│ ● activated     06-28      │      │ BUILD                      │
│                            │      │  Developers                │
│ [ Load more ]              │      │ Reconciliation             │
│                            │      │────────────────────────────│
│                            │      │ Settings     [ user ▾ ]    │
└────────────────────────────┘      └────────────────────────────┘
```

The environment switch stays in the collapsed top bar so an operator never edits the wrong ring on a phone. The Test mode nav item appears in the sheet only under the same test-deployment condition as on desktop.

---

## 2. The navigation map, area by area

Each area below gives its purpose, its screens, the exact data each screen shows (real DTO fields), the key actions (real endpoint method and path, all under the single `/v1` mount), the FSM-aware gating on those actions, and the empty, loading, and error states at IA fidelity. Full per-screen anatomy and copy live in docs 02 through 05. ASCII here fixes each area's list-and-detail structure and its place in the shell.

Money reminder for every area: amounts arrive as `…InKobo`, render as naira by integer division by 100, and never reach a charge or setup body without a pinned unit.

### 2.0 Home and Overview

**Purpose.** The landing area. Answer "is my billing healthy right now" in one read, and route a new operator into the zero-to-first-subscription path.

**Screen: Overview.**
- **Data.** `GET /v1/metrics/billing` returns `BillingMetricsData`: `mrrInKobo`, `activeCount`, `voluntaryChurn`, `involuntaryChurn`, `failedChargeRate`, `dunningRecoveryRate`, `dunningFunnel` (`scheduled`, `attempting`, `cardUpdateRequired`, `rescheduled`, `succeeded`, `exhausted`), `windowFrom`, `windowTo`. Recent activity from `GET /v1/subscriptions` and the event feed `GET /v1/events`. Connection state from `GET /v1/organization` (`TenantSettingsResponseData`: `nombaAccount.status`, `webhook.configured`).
- **Actions.** Jump to the create-subscription path. Jump to Test mode when the environment is test. Both are navigation, not money moves.
- **Metric window.** `GET /v1/metrics/billing` accepts `from` and `to` ISO-8601 datetimes. The Overview exposes a window selector that sets those params.
- **Empty state.** No subscriptions yet renders "Create your first subscription," an honest invitation, never fabricated numbers. `mrrInKobo` of 0 shows as ₦0.00, not a dash.
- **Loading state.** Metric tiles render skeletons; the layout does not reflow when data lands.
- **Error state.** A metrics 500 collapses to `SYSTEM_INTERNAL_ERROR` and renders a retry panel carrying `meta.requestId`. If `nombaAccount.status` is not `active`, a "connect your Nomba account to settle" banner appears above the tiles.

```
Overview
┌───────────────────────────────────────────────────────────────┐
│ [ Window: last 30 days ▾ ]                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ MRR      │ │ Active   │ │ Recovery │ │ Failed   │           │
│ │ ₦248,500 │ │ 132      │ │ 71%      │ │ 6%       │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│ Churn  voluntary 4 · involuntary 2                            │
│ Dunning funnel  sched 3 · attempting 1 · card-update 2 …      │
│                                                               │
│ Recent subscriptions                    Recent events         │
│ nbo…sub  active                         invoice.paid          │
│ nbo…sub  past_due                       subscription.churned  │
└───────────────────────────────────────────────────────────────┘
```

### 2.1 Subscriptions

**Purpose.** The engine's lifecycle surface. Create, inspect, and drive the seven-state subscription FSM, and read its full audit history.

**Screen: Subscriptions list.**
- **Data.** `GET /v1/subscriptions` returns `SubscriptionResponseData[]`. Columns: `id`, `customerId`, `priceId`, `status` (`incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `paused`, `canceled`), `collectionMethod` (`charge_automatically`, `send_invoice`), `currentPeriodIndex`, `currentPeriodEnd`, `createdAt`.
- **Filters.** Real query params only: `status` and `customerId`. `collectionMethod` is a display column, not a filter param, so the filter bar exposes `status` and `customerId` and does not offer a collection-method facet.
- **Actions.** Create a subscription (opens the guided wizard, doc 02).
- **Empty state.** An invitation to create the first subscription.
- **Pagination.** Cursor, "Load more" (section 4).

**Screen: Subscription detail.**
- **Data.** `GET /v1/subscriptions/:id` returns `SubscriptionResponseData`: `status`, `currentPeriodIndex`, `currentPeriodStart`, `currentPeriodEnd`, `trialStart`, `trialEnd`, `cancelAtPeriodEnd`, `canceledAt`, `endedAt`, `cancellationReason` (`voluntary` or `involuntary`), `defaultPaymentMethodId`, `items[]` (`priceId`, `quantity`), `latestInvoiceId`, `currency`, `environment`, `createdAt`. Audit from `GET /v1/subscriptions/:id/events`. Upcoming charge preview from `GET /v1/subscriptions/:id/upcoming-invoice` returning `UpcomingInvoiceResponseData` (`periodIndex`, `periodStart`, `periodEnd`, `billingReason`, `subtotalInKobo`, `totalInKobo`, `amountDueInKobo`, `lineItems[]`).
- **Actions and their endpoints.**
  - Pause: `POST /v1/subscriptions/:id/pause` (`maxDays?`).
  - Resume: `POST /v1/subscriptions/:id/resume`.
  - Cancel: `POST /v1/subscriptions/:id/cancel` (`mode`: `now` or `at_period_end`). Idempotency-Key required.
  - Resubscribe: `POST /v1/subscriptions/:id/resubscribe`. Idempotency-Key required. This mints a new subscription. A canceled subscription is terminal.
  - Change plan, quantity, or interval: `POST /v1/subscriptions/:id/change` (`priceId?`, `quantity?`, `intervalSwitch?`, `prorationBehavior`: `create_prorations` or `none`). Idempotency-Key required.
  - Edit default method or metadata only: `PATCH /v1/subscriptions/:id`.
  - Apply a discount: `POST /v1/subscriptions/:id/discount`. Remove: `DELETE /v1/subscriptions/:id/discount`.
- **FSM-aware gating.** Cancel now and cancel at period end are two distinct operations behind the `mode` argument, never a single toggle, because `subscription.canceled` (voluntary) and `subscription.churned` (involuntary) are different outcomes and the UI must not blur them. Pause is offered only from `active` or `trialing`. Resume is offered only from `paused`. Resubscribe is offered only from a terminal `canceled`. Change is withheld from `canceled` and `incomplete_expired`. The console reads the current `status` and disables illegal actions; if the server still rejects, `SUBSCRIPTION_ILLEGAL_TRANSITION` maps back to the same disabled set.
- **Concurrency.** A write that loses the optimistic version race returns `SUBSCRIPTION_VERSION_CONFLICT`. The console re-fetches and retries once silently, because the scheduler may be advancing the same row.
- **Error states.** `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` on a `charge_automatically` create routes the operator to attach a method first. `SUBSCRIPTION_NOT_TERMINAL` on resubscribe means the source is not canceled yet.

**Screen: Schedules (banked future-cycle changes).**
- **Data.** `GET /v1/subscriptions/:id/schedule` returns `SubscriptionScheduleResponseData`: `status` (`active`, `released`, `canceled`) and `phases[]` (`startIndex`, `priceId`, `quantity`, `consumedAt`).
- **Actions.** Create a phase: `POST /v1/subscriptions/:id/schedule` (`effectiveAt: next_cycle`). Cancel: `DELETE /v1/subscriptions/:id/schedule`.
- **Error states.** `SUBSCRIPTION_SCHEDULE_CONFLICT`, `SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT`, `SUBSCRIPTION_SCHEDULE_NOT_FOUND`.

```
Subscriptions list                  Subscription detail
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ [status ▾][customerId ▾]      │   │ nbo…sub          [past_due ●] │
│ Ref        Status    Period   │   │ cust nbo…cus  price nbo…prc   │
│ nbo…sub    active     3        │   │ period 3 · end 2026-07-28     │
│ nbo…sub    past_due   2        │   │ cancelAtPeriodEnd  false      │
│ nbo…sub    trialing   0        │   │ [Cancel] [Change] [Update card]│
│ nbo…sub    canceled   5        │   │ Upcoming ₦2,500.00            │
│ [ Load more ]                  │   │ Timeline · Schedules · Dunning│
└──────────────────────────────┘   └──────────────────────────────┘
```

### 2.2 Customers

**Purpose.** Manage the tenant's end-payers and their credit and discounts. A customer is distinct from the organization.

**Screen: Customers list.**
- **Data.** `GET /v1/customers` returns `CustomerResponseData[]`: `id`, `email`, `name`, `phone`, `metadata`, `environment`, `createdAt`, `updatedAt`.
- **Filters.** Real param only: `email`.
- **Actions.** Create: `POST /v1/customers`.
- **Empty state.** An invitation to add the first customer.

**Screen: Customer detail.**
- **Data.** `GET /v1/customers/:id` returns `CustomerResponseData`. The detail also surfaces this customer's subscriptions (`GET /v1/subscriptions?customerId=`), payment methods (`GET /v1/payment-methods?customerRef=`), invoices (`GET /v1/invoices?customerId=`), credit balance, and active discount.
- **Actions.** Edit mutable fields: `PATCH /v1/customers/:id`.
- **Error state.** `CUSTOMER_EMAIL_TAKEN` on create or edit (the unique key is organization, environment, email) renders inline on the email field from `error.fields`. `CUSTOMER_NOT_FOUND` on a stale reference.

**Sub-surface: Customer credit.**
- **Data.** `GET /v1/customers/:id/credit` returns `CreditBalanceResponseData`: `balanceInKobo`, `grants[]` where each grant is `CreditGrantResponseData` (`amountInKobo`, `remainingInKobo`, `source` one of `downgrade_proration`, `manual`, `goodwill`, `coupon`, `sourceReference`, `voidedAt`, `createdAt`). Grants apply oldest first.
- **Actions.** Grant credit: `POST /v1/customers/:id/credit`. Idempotency-Key required. Void an unconsumed remainder: `DELETE /v1/customers/:id/credit/:grantId`. Idempotency-Key required.
- **Money.** `balanceInKobo` and every grant amount render as naira by division by 100. The grant form takes a naira amount and stores kobo.

**Sub-surface: Customer discount.**
- **Data.** The active discount from `DiscountResponseData` (`couponId`, `status` `active` or `ended`, `cyclesRemaining`, `startAt`, `endAt`).
- **Actions.** Apply a coupon: `POST /v1/customers/:id/discount`. Remove: `DELETE /v1/customers/:id/discount`.
- **Gating.** One active discount per customer. `COUPON_ALREADY_APPLIED` blocks a second.

```
Customer detail
┌───────────────────────────────────────────────────────────┐
│ Ada Obi   nbo749201835566cus        ada@acme.co            │
│ [ Edit ]                                                   │
│ Credit balance  ₦1,200.00     [ Grant credit ]            │
│  grant nbo…crg  ₦1,200.00  source manual  remaining ₦1,200 │
│ Discount  WELCOME10  active  cyclesRemaining 2  [ Remove ] │
│ Subscriptions (2) · Payment methods (1) · Invoices (4)     │
└───────────────────────────────────────────────────────────┘
```

### 2.3 Plans and prices

**Purpose.** The catalog. Plans are offerings, prices are immutable versioned ways to charge. Prices are never edited; a change is a new price plus a deactivation of the old one.

**Screen: Plans list.**
- **Data.** `GET /v1/plans` returns `PlanResponseData[]`: `id`, `name`, `description`, `status` (`active`, `archived`), `metadata`, timestamps.
- **Filters.** Real param: `status`.
- **Actions.** Create: `POST /v1/plans`.

**Screen: Plan detail with nested prices.**
- **Data.** `GET /v1/plans/:id` returns `PlanResponseData`. Prices from `GET /v1/plans/:id/prices` returning `PriceResponseData[]`: `unitAmountInKobo`, `currency`, `interval` (`day`, `week`, `month`, `year`), `intervalCount`, `usageType` (`licensed`, `metered`), `billingScheme` (`per_unit`, `tiered`), `trialPeriodDays`, `active`.
- **Actions.** Edit plan metadata: `PATCH /v1/plans/:id`. Archive: `POST /v1/plans/:id/archive`. Add a price version: `POST /v1/plans/:id/prices`. Deactivate a price: `POST /v1/prices/:id/deactivate`.
- **Gating.** A plan is archived, never deleted; there is no delete route. `PLAN_HAS_ACTIVE_SUBSCRIBERS` and `PLAN_ALREADY_ARCHIVED` gate the archive action. `PLAN_NAME_TAKEN` renders inline on the name field.
- **Immutability model.** The UI never shows a price edit form. A "change price" action creates a new price version and deactivates the old one, with a plain note that existing subscribers keep their price. Immutability is structural, enforced by the absence of an edit route: there is only create-under-plan plus deactivate, so a price can never be mutated once created. `PRICE_IMMUTABLE` is not a tenant-facing code (it collapses to `SYSTEM_INTERNAL_ERROR` and no route returns it); the missing edit route is what guarantees immutability. `PRICE_ALREADY_INACTIVE` backs the double-deactivation guard. `PRICE_TIERED_NOT_SUPPORTED` gates tiered and metered creation, so the price form may hide those options until they ship.
- **Money.** `unitAmountInKobo` renders as naira by division by 100. The price form takes a naira amount and stores kobo. This is the first place the 100x risk bites, because a plan priced wrong overcharges every subscriber.

**Screen: Prices (global read).**
- **Data.** `GET /v1/prices` returns `PriceResponseData[]`; filters `planRef` and `active`. `GET /v1/prices/:id` for a single price.

```
Plan detail
┌───────────────────────────────────────────────────────────┐
│ Pro monthly   nbo…pln          [active]     [ Archive ]    │
│ Prices                                        [ New price ]│
│ Ref      Amount     Interval  Trial  Active               │
│ nbo…prc  ₦2,500.00  month/1   14d    yes                  │
│ nbo…prc  ₦2,000.00  month/1   0d     no    (deactivated)  │
└───────────────────────────────────────────────────────────┘
```

### 2.4 Invoices

**Purpose.** Read the engine-issued invoices and void the ones that qualify. Tenants never create invoices.

**Screen: Invoices list.**
- **Data.** `GET /v1/invoices` returns `InvoiceResponseData[]`: `id`, `customerId`, `subscriptionId`, `status`, `billingReason`, and the money fields below.
- **Filters.** Real params: `customerId`, `subscriptionId`, `status`. Note the list `status` filter enum is a subset (`draft`, `open`, `paid`, `void`, `uncollectible`) and does not include `partially_paid`, even though the DTO status can be `partially_paid`. The filter bar offers only the five filterable values, and the list still renders a `partially_paid` badge when a returned row carries it.

**Screen: Invoice detail.**
- **Data.** `GET /v1/invoices/:id` returns `InvoiceResponseData`: `status` (`draft`, `open`, `partially_paid`, `paid`, `void`, `uncollectible`, derived, never stored), `billingReason` (`subscription_create`, `subscription_cycle`, `subscription_update`, `manual`), `subtotalInKobo`, `discountTotalInKobo`, `creditTotalInKobo`, `totalInKobo`, `amountDueInKobo`, `amountPaidInKobo`, `amountRemainingInKobo`, `periodStart`, `periodEnd`, `dueDate`, `lineItems[]` (`kind` one of `subscription`, `proration`, `discount`, `credit`, `adjustment`, `description`, signed `amountInKobo`, `quantity`), `finalizedAt`, `paidAt`, `voidedAt`.
- **Actions.** Void: `POST /v1/invoices/:id/void` (`comment?`).
- **FSM-aware gating.** Void is offered only when the invoice is `draft` or `open`. `INVOICE_NOT_VOIDABLE` backs the disabled state on any other status. A paid invoice is corrected by a ledger reversal, not a void, and the UI says so instead of offering void. `INVOICE_ALREADY_PAID` and `INVOICE_ALREADY_FINALIZED` cover the race.
- **Money.** Every amount renders as naira by division by 100. Line `amountInKobo` is signed; a credit or discount line renders negative, and the console preserves the sign rather than showing an absolute value.
- **Empty state.** The first invoice appears after the first cycle. Before that the list reads "Invoices appear here after the first billing cycle."

```
Invoice detail
┌───────────────────────────────────────────────────────────┐
│ nbo…inv   subscription_cycle           [partially_paid]    │
│ Period 2026-06-28 → 2026-07-28   Due 2026-06-28            │
│ Lines                                                      │
│  subscription  Pro monthly       ₦2,500.00                │
│  discount      WELCOME10        -₦250.00                  │
│ Subtotal ₦2,500.00  Discount -₦250.00  Due ₦2,250.00     │
│ Paid ₦1,000.00   Remaining ₦1,250.00                     │
│ [ Void ] (disabled, not draft/open)                       │
└───────────────────────────────────────────────────────────┘
```

### 2.5 Payments and rails

**Purpose.** Manage a customer's payment methods across the three rails: card (pull), mandate (direct debit pull), and virtual account (transfer push). The console configures rails; it never becomes a card-entry surface. No PAN ever crosses the wire.

**Screen: Payment methods list.**
- **Data.** `GET /v1/payment-methods` returns `PaymentMethodResponseData[]`: `id`, `customerId`, `kind` (`card`, `mandate`, `virtual_account`), `status` (`setup_pending`, `consent_pending`, `active`, `removed`, `expired`), `isDefault`, and card display only (`brand`, `last4`, `expMonth`, `expYear`, all null for mandate and virtual account). Filter: `customerRef`.

**Screen: Add card (hosted setup).**
- **Action.** `POST /v1/payment-methods/setup` (`customerRef`, `amountInKobo`, `callbackUrl`). Idempotency-Key required. Returns `CheckoutSetupResponseData` (`reference`, `checkoutLink`). Per doc 03 section 3 (verified in `packages/sara/src/payment-methods/attach.ts`), `setupCard` mints the payment-method `reference` (an `nbo…pmt` id) up front and inserts the payment-method row immediately with `kind` `card` and `status` `setup_pending`, so the method already exists and shows in the methods list right away. Only the capture of `brand` and `last4` is asynchronous, confirmed by the `payment_method.attached` event. The console redirects to `checkoutLink`, then awaits the event or polls the method by reference.
- **Money.** `amountInKobo` is the validation charge and is entered in naira, stored in kobo. This is a charge boundary, so the unit is pinned.

**Screen: Issue virtual account.**
- **Action.** `POST /v1/payment-methods/virtual-account` (`customerRef`, `expectedAmount?` in kobo, `expiryDate?`). Returns `VirtualAccountResponseData` (`bankName`, `accountNumber`, `accountName`, `accountRef`). The console renders these as pay-in instructions for the push rail.

**Screen: Create mandate (direct debit).**
- **Action.** `POST /v1/mandates` (`customerRef`, `customerAccountNumber`, `bankCode`, `customerName`, `customerAccountName`, `customerPhoneNumber`, `customerAddress`, `narration`, `maxAmountInKobo`, `frequency`, `startDate?`, `endDate?`). Idempotency-Key required. Returns `MandateSetupResponseData` (`mandateRef`, `status` `consent_pending`, `consentInstruction` the ₦50 NIBSS validation step). Poll with `GET /v1/mandates/:id`.
- **Honesty.** The mandate is the reliable silent recurring rail, and it is live-gated: `/v1/direct-debits/*` returns 404 in sandbox. The console presents it as the silent rail and renders its honest interim `consent_pending` state rather than claiming activation. `maxAmountInKobo` is a hard per-debit ceiling entered in naira, stored in kobo.

**Screen: Manage a method.**
- **Actions.** Set default: `POST /v1/payment-methods/:id/default`. Remove: `DELETE /v1/payment-methods/:id`.
- **Gating.** One default per customer per environment. `MANDATE_NOT_ACTIVE`, `MANDATE_CONSENT_PENDING`, `MANDATE_MAX_AMOUNT_EXCEEDED`, `PAYMENT_METHOD_KIND_MISMATCH`, and `PAYMENT_METHOD_NOT_ACTIVE` back the disabled and error states.

```
Payment methods (customer scope)
┌───────────────────────────────────────────────────────────┐
│ [customerRef ▾]              [ Add card ][ Mandate ][ VA ] │
│ Ref      Kind             Status          Default          │
│ nbo…pmt  card visa •4242  active          yes              │
│ nbo…pmt  mandate          consent_pending no               │
│ nbo…pmt  virtual_account  active          no               │
└───────────────────────────────────────────────────────────┘
```

### 2.6 Dunning and recovery

**Purpose.** The recovery cockpit. Make the failure, retry, and recover path legible per subscription, and route stuck cases to the right resolution instead of a blind retry. This is a signature honesty surface; full anatomy is in doc 05.

**Screen: Dunning state (per subscription).**
- **Data.** `GET /v1/subscriptions/:id/dunning` returns `DunningStateResponseData`: `subscriptionRef`, `invoiceRef`, `status` (`none`, `scheduled`, `attempting`, `succeeded`, `rescheduled`, `card_update_required`, `exhausted`), `attemptsUsed`, `maxAttempts`, `nextAttemptAt`, `graceAccessUntil`, and `attempts[]`.
- **Attempts.** `GET /v1/subscriptions/:id/dunning/attempts` returns `DunningAttemptResponseData[]`: `attemptNumber`, `status`, `branch` (`reschedule`, `card_update_required`, `short_path`), `railKey`, `failureReason`, `gatewayMessage`, `outcome`, `scheduledAt`, `executedAt`, `nextAttemptAt`.
- **Action.** Swap the card mid-dunning: `POST /v1/subscriptions/:id/payment-method`. This re-arms the held attempt to due-now.
- **FSM-aware gating.** Blind retry is structurally absent for `card_update_required`, `expired_card`, and `otp_required` cases. The console offers a card update or forwards the `invoice.action_required.checkoutLink` instead. For a `reschedule` branch it shows the payday-biased `nextAttemptAt` and does not offer an override. `DUNNING_NO_OPEN_INVOICE` means there is nothing in recovery.
- **Empty state.** "No subscriptions in recovery," which is a good state, not an error.
- **Error surface as the feature.** Every attempt shows a concrete `failureReason` and `gatewayMessage`, never a shrug.

```
Dunning cockpit (subscription scope)
┌───────────────────────────────────────────────────────────┐
│ nbo…sub   status card_update_required   3 of 4 attempts    │
│ grace until 2026-07-05   next: held                        │
│ #1 attempting → failed  insufficient_funds  reschedule     │
│ #2 rescheduled  next 2026-06-30 (payday)                   │
│ #3 card_update_required  expired_card                      │
│ [ Update card ]   [ Send pay link ↗ ]                     │
└───────────────────────────────────────────────────────────┘
```

### 2.7 Settlements and payouts

**Purpose.** See collected funds split to the tenant, understand the escrow lock, withdraw available funds, and refund the tenant's share. Provider legs are live-gated, so the console renders honest interim statuses.

**Screen: Settlements list and detail.**
- **Data.** `GET /v1/settlements` returns `SettlementResponseData[]`: `id`, `invoiceReference`, `subAccountRef`, `splitReference`, `merchantTxRef`, `grossInKobo`, `platformFeeInKobo`, `netToTenantInKobo`, `status` (`pending`, `settled`, `reconciled`, `failed`, `refunded`). Filter: `status`. Detail: `GET /v1/settlements/:id`.
- **Money.** The console renders the `gross = platformFee + net` split visually, all as naira by division by 100.

**Screen: Escrow and withdrawal.**
- **Data.** `GET /v1/settlements/escrow` returns `EscrowResponseData`: `lockedInKobo`, `since`, `balanceInKobo`, `minWithdrawableInKobo`, `availableInKobo`. `balanceInKobo` is `apps/api`'s own ledger-derived `tenant_settlement` balance; the Nomba sub-account reconciles out of band, matching doc 03 section 1.6 and doc 05.
- **Rule.** Withdrawable equals this ledger balance minus the rolling 3-hour locked amount minus the minimum withdrawal buffer. The console clamps or rejects a withdrawal that violates it, in plain language, not as a raw error.
- **Action.** Withdraw: `POST /v1/settlements/payout` returns `PayoutResponseData` (`subAccountRef`, `amountInKobo`, `bankCode`, `accountNumber`, `resolvedAccountName`, `status` `pending`, `ledger_posted`, `succeeded`, or `failed`, `providerReference`, `failureReason`). Idempotency-Key required.
- **Honesty.** `ledger_posted` is not bank-confirmed `succeeded`. The provider leg is flag-gated (`NOMBA_PAYOUT_ENABLED`), so the console shows `PayoutStatus` truthfully and never claims money reached the bank on a `ledger_posted` row. `ESCROW_LOCKED` and `PAYOUT_EXCEEDS_AVAILABLE` are distinct errors and render as distinct explanations.

**Screen: Refunds.**
- **Action.** `POST /v1/settlements/:id/refund` returns `RefundResponseData` (`amountInKobo`, `status` `pending`, `ledger_only`, `succeeded`, or `failed`, `providerReference`). Idempotency-Key required. Refunds return only the tenant's net share; the platform fee is non-refundable. Repeated partials are allowed up to `netToTenantInKobo`.
- **Gating.** `REFUND_ALREADY_REFUNDED` and `REFUND_AMOUNT_EXCEEDS_NET` back the disabled and error states. `ledger_only` is not money-returned and the console says so.

```
Escrow and withdrawal
┌───────────────────────────────────────────────────────────┐
│ Balance ₦82,000.00   Locked (3h) ₦12,000.00              │
│ Min withdrawable ₦1,000.00   Available ₦69,000.00        │
│ Locked since 2026-07-03 14:10  (refund buffer)           │
│ [ Withdraw to bank ]                                      │
│ Settlements                                              │
│ Ref      Gross      Fee      Net        Status           │
│ nbo…stl  ₦2,500.00  ₦75.00   ₦2,425.00  settled          │
│ nbo…stl  ₦2,000.00  ₦60.00   ₦1,940.00  reconciled       │
└───────────────────────────────────────────────────────────┘
```

### 2.8 Coupons, discounts, and credits

**Purpose.** Define reusable discounts and read their applications. Coupons are the top-level CRUD. Discounts are the application (surfaced on customer and subscription detail). Credits live on customer detail.

**Screen: Coupons list and detail.**
- **Data.** `GET /v1/coupons` returns `CouponResponseData[]`: `id`, `code`, `duration` (`once`, `repeating`, `forever`), `amountOffInKobo` exclusive-or `percentOff`, `durationInCycles`, `redeemBy`, `maxRedemptions`, `timesRedeemed`. Detail: `GET /v1/coupons/:id`. The list takes no extra filter param beyond cursor and limit.
- **Actions.** Create: `POST /v1/coupons`. Edit: `PATCH /v1/coupons/:id`. There is no delete.
- **Gating.** `COUPON_INVALID_DEFINITION` (a coupon carries `amountOffInKobo` or `percentOff`, never both), `COUPON_EXPIRED`, and `COUPON_MAX_REDEMPTIONS_REACHED` back the error states.
- **Money.** `amountOffInKobo` renders as naira by division by 100; the create form takes naira and stores kobo. A percent coupon shows a percentage, not a money field.

**Discounts.** Not a top-level list. `DiscountResponseData` (`status` `active` or `ended`, `cyclesRemaining`) appears on customer detail (2.2) and subscription detail (2.1), applied and removed there.

**Credits.** Not a top-level list. `CreditBalanceResponseData` and `CreditGrantResponseData` appear on customer detail (2.2).

```
Coupons
┌───────────────────────────────────────────────────────────┐
│                                            [ New coupon ]  │
│ Code       Off        Duration   Redeemed  Max            │
│ WELCOME10  10%         repeating  42        100            │
│ LAUNCH500  ₦500.00     once       12        none           │
└───────────────────────────────────────────────────────────┘
```

### 2.9 Developers

**Purpose.** The developer's control panel: keys, webhooks, the event stream, request inspection, test-mode instruments, and the machine spec. This is the center of gravity per doc 00. Full anatomy is in doc 04.

**Sub-area: API keys.**
- **Data.** `ApiKeyResponseData`: `name`, `keyPrefix`, `scopes[]` (the 26 `resource:read`/`resource:write` scopes in `ApiKeyScope`), `environment`, `lastUsedAt`, `revokedAt`, `createdAt`.
- **Actions.** Create returns `CreatedApiKeyResponseData` with `secret` shown once. Scope, revoke.
- **Gating.** Gated on the console-auth API. Test and live are separate key sets, presented separately. `API_KEY_ENVIRONMENT_MISMATCH`, `API_KEY_INVALID`, `API_KEY_MISSING`, and `API_KEY_SCOPE_FORBIDDEN` are the surfaced codes.
- **Secret handling.** A copy-once field with a "this secret cannot be retrieved again" warning.

**Sub-area: Webhooks.**
- **Endpoints.** `GET /v1/webhooks`, `GET /v1/webhooks/:id`, `POST /v1/webhooks`, `PATCH /v1/webhooks/:id`, `DELETE /v1/webhooks/:id`, `POST /v1/webhooks/:id/rotate-secret`.
- **Data.** `WebhookEndpointResponseData`: `url`, `enabledEvents[]` (chosen from the frozen catalog plus `*`), `signingSecretPrefix`, `disabledAt`. The full `signingSecret` returns once from create and rotate as `RotatedWebhookSecretResponseData`, a copy-once field.
- **Deliveries inspector.** `GET /v1/webhooks/:id/deliveries` (filters `status` and `eventType`) returns `WebhookDeliveryResponseData[]`: `eventType`, `eventId`, `status` (`pending`, `succeeded`, `failed`, `dead`), `attempts`, `nextAttemptAt`, `lastAttemptAt`, `responseStatus`, `replayedAt`, `replayCount`. Single delivery: `GET /v1/webhooks/:id/deliveries/:deliveryId`. Replay a dead letter: `POST /v1/webhooks/:id/deliveries/:deliveryId/replay`.
- **Guidance.** The guarantee is at-least-once, never exactly-once. Dedupe on `event.event.id`, the stable event id, not the delivery id.

**Sub-area: Events.**
- **Endpoints.** `GET /v1/events` (filter `type`) returns `DomainEventResponseData[]` (`id` the EVT dedupe key, `type`, `payload`, `createdAt`). Single: `GET /v1/events/:id`. Catalog: `GET /v1/events/catalog` returns the frozen `WEBHOOK_EVENT_CATALOG` (the 32 tenant event types plus the 2 deletable `example.*` scaffold entries, 34 total).
- **Rendering.** Raw signed JSON, because raw reads as real. An aria-live console for the tail.

**Sub-area: Test mode** (only when the environment is test and the deployment is test-pinned).
- **Endpoints.** `POST /v1/test/payment-methods` mints a deterministic method (`success`, `decline_insufficient_funds`, `decline_expired_card`, `decline_do_not_honor`, `requires_otp`). `POST /v1/test/subscriptions/:id/advance-cycle` is the test clock, returning `AdvanceCycleResponseData` (`outcome`, `invoice`). `POST /v1/test/webhooks/simulate` emits a real signed catalog event, returning `WebhookSimulationResponseData` (`event`, `type`, `deliveredCount`).
- **Honesty.** This is the "sandbox is real" proof. The skeptic opens devtools and sees real `/v1/test/*` calls. The whole sub-area is absent on live.

**Sub-area: API reference.**
- **Endpoint.** `GET /v1/openapi.json`, the spec generated from the live router, which cannot drift. The console links or embeds it.

**Request inspection.** Across the area, surface `meta.requestId` and the `X-Request-Id` response header, plus the rate-limit headers, so a developer can correlate a console action to a server log line.

```
Developers · Webhooks · deliveries inspector
┌───────────────────────────────────────────────────────────┐
│ Endpoint  https://acme.co/hooks   events *   [ Rotate ]    │
│ [status ▾][eventType ▾]                                    │
│ Delivery   Event type            Status   Attempts  Resp   │
│ nbo…whd    invoice.paid          succeeded 1        200    │
│ nbo…whd    subscription.churned  dead      6        500    │
│ [ Replay ]  guarantee at-least-once · dedupe event.event.id│
└───────────────────────────────────────────────────────────┘
```

### 2.10 Settings, organization, and team

**Purpose.** The tenant's own configuration: organization profile, billing and dunning policy, the Nomba connection, and the team. Team and keys are gated on the console-auth API.

**Screen: Organization.**
- **Data.** `GET /v1/organization` returns `TenantSettingsResponseData`: `billing.rateLimitPerMinute`, `billing.monthlyRequestQuota`, `billing.settlementMode` (`split_at_collection` or `collect_then_payout`), `billing.platformFee` (`bps`, `minInKobo`, `maxInKobo`), `billing.grace` (`gracePeriodHours`, `dunningMaxAttempts`), `billing.branding` (`displayName`, `supportEmail`, `logoUrl`, `primaryColorHex`), `webhook` (`url`, `signingSecretPrefix`, `configured`), `nombaAccount` (`accountRef`, `status`).
- **Action.** Edit: `PUT /v1/organization`. The webhook signing secret is withheld on read; only the prefix shows.

**Screen: Billing settings.**
- **Data.** `GET /v1/organization/billing` returns `BillingSettingsResponseData`: `partialCollectionEnabled` (off by default), `prorationCreditPolicy` (`credit_next_cycle` or `none`), `dunningMaxAttempts`, `dunningIntervalsHours[]`, `dunningMaxWindowHours`, `gracePeriodHours`, `paydayDays[]`, `paydayPullForwardDays`, `paydayBiasEnabled`, `defaultCollectionMethod` (`charge_automatically` or `send_invoice`), `commsEnabled`.
- **Action.** Edit: `PUT /v1/organization/billing`.

**Screen: Nomba connection.**
- **Data.** `nombaAccount` from `TenantSettingsResponseData` (`accountRef`, `status`), backed by `org_nomba_accounts` (`status` `pending`, `active`, `suspended`). Settlement and payout require `active`.
- **Empty and error state.** A `pending` or `suspended` status renders a plain "connect your Nomba account to settle" prompt, consistent with the Overview banner.

**Screen: Team and RBAC.**
- **Data.** `org_users` (`role` `owner`, `admin`, `developer`, `viewer`, TOTP enrollment), `org_sessions`, `password_reset_tokens`.
- **Actions.** Invite, set role, enroll or enforce TOTP, reset password. All gated on the console-auth API. The UI enforces role gating; a viewer cannot mint keys or change roles.

### 2.11 Reconciliation (tenant-scoped)

**Purpose.** Let the tenant see its own settlement health and ledger-derived balances. The cross-tenant drift and orphan view is admin-only and does not live in the console.

**Screen: Settlement health.**
- **Data.** The tenant's own settlements with `status` including `reconciled`, from `GET /v1/settlements?status=reconciled` and the full list. Ledger-derived balances are authoritative O(1) reads, surfaced through the settlement and escrow DTOs already listed in 2.7.
- **Boundary.** The operator drift classifications (`local_paid_missing_at_nomba`, `amount_mismatch`, `settled_at_nomba_missing_locally`) are admin-only. The console shows the tenant's own `reconciled` and `failed` status, not the operator diff. This screen is a focused view over the same settlement data, not a new endpoint.

```
Reconciliation (tenant view)
┌───────────────────────────────────────────────────────────┐
│ Reconciled this window  128 of 132 settlements            │
│ Ref      Net        Status                                │
│ nbo…stl  ₦2,425.00  reconciled                            │
│ nbo…stl  ₦1,940.00  settled  (awaiting reconcile)         │
│ nbo…stl  ₦900.00    failed                                │
│ Cross-tenant drift lives in the operator console, not here│
└───────────────────────────────────────────────────────────┘
```

---

## 3. Traceability: every screen to its backing capability

No screen without a real endpoint, entity, event, or status. Idempotency-required money-movers are marked "idem." Screens gated on the unbuilt console-auth API are marked "auth-gated."

| Area | Screen | Backing endpoint or entity | DTO or table | Event or status that justifies it |
|---|---|---|---|---|
| Overview | Dashboard | `GET /v1/metrics/billing`, `GET /v1/subscriptions`, `GET /v1/events`, `GET /v1/organization` | `BillingMetricsData`, `TenantSettingsResponseData` | `mrrInKobo`, `dunningFunnel`, `nombaAccount.status` |
| Subscriptions | List | `GET /v1/subscriptions` | `SubscriptionResponseData` | `status` FSM, `collectionMethod` |
| Subscriptions | Detail | `GET /v1/subscriptions/:id`, `GET …/upcoming-invoice` | `SubscriptionResponseData`, `UpcomingInvoiceResponseData` | 7-state FSM, `cancellationReason` |
| Subscriptions | Create | `POST /v1/subscriptions` (idem) | `createSubscriptionBody` | `subscription.created` |
| Subscriptions | Pause / Resume | `POST …/pause`, `POST …/resume` | `pauseSubscriptionBody` | `subscription.paused`, `subscription.resumed` |
| Subscriptions | Cancel | `POST …/cancel` (idem) | `cancelSubscriptionBody` (`mode`) | `subscription.canceled` (voluntary) |
| Subscriptions | Resubscribe | `POST …/resubscribe` (idem) | `resubscribeBody` | new subscription; source terminal |
| Subscriptions | Change | `POST …/change` (idem) | `changeSubscriptionBody` | `subscription.updated`, proration |
| Subscriptions | Audit timeline | `GET …/events` | `DomainEventResponseData` | full event history |
| Subscriptions | Schedules | `GET/POST/DELETE …/schedule` | `SubscriptionScheduleResponseData` | `active`, `released`, `canceled` |
| Subscriptions | Discount | `POST/DELETE …/discount` | `DiscountResponseData` | `discount.created`, `discount.removed` |
| Customers | List / Detail | `GET /v1/customers`, `GET …/:id` | `CustomerResponseData` | unique (org, env, email) |
| Customers | Create / Edit | `POST /v1/customers`, `PATCH …/:id` | `create/updateCustomerBody` | `customer.created`, `customer.updated` |
| Customers | Credit | `GET/POST …/credit` (idem), `DELETE …/credit/:grantId` (idem) | `CreditBalanceResponseData`, `CreditGrantResponseData` | `source`, `remainingInKobo` |
| Plans | List / Detail | `GET /v1/plans`, `GET …/:id` | `PlanResponseData` | `status` (active, archived) |
| Plans | Create / Edit / Archive | `POST /v1/plans`, `PATCH …/:id`, `POST …/archive` | `create/updatePlanBody` | `plan.created`, `plan.archived` |
| Prices | Nested list / create | `GET/POST /v1/plans/:id/prices` | `PriceResponseData`, `createPriceBody` | `price.created`, immutability |
| Prices | Global read / deactivate | `GET /v1/prices`, `GET …/:id`, `POST …/deactivate` | `PriceResponseData` | `price.deactivated`, `active` flag |
| Invoices | List / Detail | `GET /v1/invoices`, `GET …/:id` | `InvoiceResponseData` | derived `status`, `billingReason` |
| Invoices | Void | `POST /v1/invoices/:id/void` | `voidInvoiceBody` | `invoice.voided`, draft/open only |
| Payments | Methods list | `GET /v1/payment-methods` | `PaymentMethodResponseData` | `kind`, `status`, `isDefault` |
| Payments | Add card | `POST /v1/payment-methods/setup` (idem) | `CheckoutSetupResponseData` | `payment_method.attached` |
| Payments | Virtual account | `POST /v1/payment-methods/virtual-account` | `VirtualAccountResponseData` | transfer rail pay-in |
| Payments | Mandate | `POST /v1/mandates` (idem), `GET /v1/mandates/:id` | `MandateSetupResponseData` | `consent_pending`, live-gated |
| Payments | Default / Remove | `POST …/:id/default`, `DELETE …/:id` | `PaymentMethodResponseData` | one default per (customer, env) |
| Dunning | State | `GET /v1/subscriptions/:id/dunning` | `DunningStateResponseData` | `status` incl. `none`, `graceAccessUntil` |
| Dunning | Attempts | `GET …/dunning/attempts` | `DunningAttemptResponseData` | `branch`, `failureReason` |
| Dunning | Card swap | `POST /v1/subscriptions/:id/payment-method` | `updateSubscriptionCardBody` | `payment_method.updated` |
| Settlements | List / Detail | `GET /v1/settlements`, `GET …/:id` | `SettlementResponseData` | `status`, gross = fee + net |
| Settlements | Escrow | `GET /v1/settlements/escrow` | `EscrowResponseData` | `lockedInKobo`, `availableInKobo` |
| Settlements | Payout | `POST /v1/settlements/payout` (idem) | `PayoutResponseData` | `ledger_posted` vs `succeeded` |
| Settlements | Refund | `POST /v1/settlements/:id/refund` (idem) | `RefundResponseData` | `ledger_only`, net-only |
| Coupons | List / Detail | `GET /v1/coupons`, `GET …/:id` | `CouponResponseData` | `duration`, amount xor percent |
| Coupons | Create / Edit | `POST /v1/coupons`, `PATCH …/:id` | `create/updateCouponBody` | `coupon.created` |
| Developers | API keys | `api_keys` (auth-gated) | `ApiKeyResponseData`, `CreatedApiKeyResponseData` | `keyPrefix`, `scopes`, once-secret |
| Developers | Webhooks | `GET/POST/PATCH/DELETE /v1/webhooks`, `POST …/rotate-secret` | `WebhookEndpointResponseData`, `RotatedWebhookSecretResponseData` | `enabledEvents`, once-secret |
| Developers | Deliveries | `GET …/deliveries`, `GET …/deliveries/:deliveryId`, `POST …/replay` | `WebhookDeliveryResponseData` | `status` (pending, succeeded, failed, dead) |
| Developers | Events | `GET /v1/events`, `GET …/:id`, `GET /v1/events/catalog` | `DomainEventResponseData`, `WEBHOOK_EVENT_CATALOG` | 32 tenant types + 2 example scaffold, frozen catalog |
| Developers | Test mode | `POST /v1/test/payment-methods`, `POST /v1/test/subscriptions/:id/advance-cycle`, `POST /v1/test/webhooks/simulate` | `AdvanceCycleResponseData`, `WebhookSimulationResponseData` | test-deployment only |
| Developers | API reference | `GET /v1/openapi.json` | generated spec | cannot drift from router |
| Settings | Organization | `GET/PUT /v1/organization` | `TenantSettingsResponseData` | `settlementMode`, `branding` |
| Settings | Billing settings | `GET/PUT /v1/organization/billing` | `BillingSettingsResponseData` | dunning and payday policy |
| Settings | Nomba connection | `org_nomba_accounts` via `nombaAccount` | `TenantSettingsResponseData` | `status` (pending, active, suspended) |
| Settings | Team | `org_users`, `org_sessions` (auth-gated) | `OrgUserResponseData` | `role` (owner, admin, developer, viewer) |
| Reconciliation | Settlement health | `GET /v1/settlements` | `SettlementResponseData` | `reconciled`, `failed` |

---

## 4. The cursor-pagination model, everywhere

Every list in the console is cursor-paginated. This is not a per-screen choice; it is the wire contract.

- **The envelope.** A paginated response carries `pagination: { limit, hasMore, nextCursor }` alongside `data[]` (`ApiPaginated<T>` in `packages/core-contracts/src/types/envelope.ts`). There is no page count and no total. The cursor is opaque.
- **Params.** Every list validation takes `limit` (integer, 1 to 100, default 20) and `cursor` (optional opaque string). The console requests the first page with a `limit` and no cursor, then requests the next page by passing `pagination.nextCursor` back as `cursor`.
- **The control.** A "Load more" button, or an infinite-scroll sentinel, appends the next page. When `hasMore` is false, `nextCursor` is null and the control is removed, replaced by an end-of-list marker. The console never renders page numbers, a "page X of Y," or a total count, because the API returns none and inventing one would drift.
- **Filters reset the cursor.** Changing a filter (for example `status` on subscriptions, `eventType` on deliveries) starts a fresh first page with no cursor. Filters and the cursor never combine into a stale window.
- **Sort.** Lists are server-ordered (newest first by creation). The console does not offer client-side re-sorting across pages, because a cursor is only stable within one server order.
- **Loading and empty.** The first page renders skeleton rows. An empty first page renders the area's empty-state invitation, not a zero-row table. A failed page load renders a retry affordance carrying `meta.requestId` and keeps any rows already loaded.
- **Applies to.** Subscriptions, customers, plans, prices, invoices, payment methods, coupons, settlements, events, webhook endpoints, webhook deliveries, dunning attempts, and subscription events. Every one of these returns the same `pagination` block.

```
List footer states
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ … rows …                      │   │ … rows …                      │
│ [ Load more ]   hasMore=true  │   │ End of results  hasMore=false │
└───────────────────────────────┘   └───────────────────────────────┘
```

---

## 5. RBAC-gated visibility

The console user role comes from `org_users.role`: `owner`, `admin`, `developer`, or `viewer`. This role governs what a person sees and can do in the console UI. It is distinct from the API-key `scopes` (`ApiKeyScope`), which govern a machine key. The console enforces role gating in the UI, and doc 09's console-auth API enforces it on the server. Until console-auth ships, this matrix is a design contract for the not-yet-built console-auth layer; today `rbac.ts` grants only `owner` a wildcard.

The principle: read is broad, write narrows by role, money-out and governance are narrowest. Nav items and actions a role cannot use are absent, not merely disabled, except where a disabled state teaches an FSM rule (section 2).

| Area or action | owner | admin | developer | viewer |
|---|---|---|---|---|
| Overview (read) | yes | yes | yes | yes |
| Subscriptions read | yes | yes | yes | yes |
| Subscriptions write (create, pause, resume, change, schedule, discount) | yes | yes | yes | no |
| Cancel and resubscribe | yes | yes | yes | no |
| Customers read | yes | yes | yes | yes |
| Customers write (create, edit, discount) | yes | yes | yes | no |
| Grant or void credit (money) | yes | yes | no | no |
| Plans and prices read | yes | yes | yes | yes |
| Plans and prices write (create, archive, new price, deactivate) | yes | yes | yes | no |
| Invoices read | yes | yes | yes | yes |
| Invoice void | yes | yes | yes | no |
| Payment methods read | yes | yes | yes | yes |
| Payment methods write (setup, mandate, virtual account, default, remove) | yes | yes | yes | no |
| Dunning read | yes | yes | yes | yes |
| Dunning card swap | yes | yes | yes | no |
| Settlements and escrow read | yes | yes | yes | yes |
| Payout (money out) | yes | yes | no | no |
| Refund (money out) | yes | yes | no | no |
| Coupons read | yes | yes | yes | yes |
| Coupons write | yes | yes | yes | no |
| Developers: API keys | yes | yes | yes | no |
| Developers: webhooks and deliveries write and replay | yes | yes | yes | no |
| Developers: events and API reference read | yes | yes | yes | yes |
| Developers: test mode instruments (test env only) | yes | yes | yes | no |
| Settings: organization read | yes | yes | yes | yes |
| Settings: organization and billing write | yes | yes | no | no |
| Settings: Nomba connection | yes | yes | no | no |
| Settings: team (invite, set role, TOTP) | yes | yes | no | no |
| Reconciliation read | yes | yes | yes | yes |

Notes:

- **Viewer** is strictly read-only across every area, including test mode. A viewer can switch environments to read either ring but cannot write in either.
- **Developer** owns the Build cluster in full and can drive the whole billing lifecycle in both environments, but is withheld money-out (payout, refund, credit grant and void) and governance (organization and billing settings, Nomba connection, team). This matches the manifesto's developer-first stance without handing a developer the treasury.
- **Admin** performs every money-out action alongside owner (create payout, refund a settlement, grant customer credit), and does everything except the destructive org-level acts reserved to owner: deleting the organization, transferring ownership, and wiping or rotating all API keys. For nav and screen visibility, admin equals owner in this matrix.
- **Owner** sees everything and additionally holds the owner-only destructive org-level acts: deleting the organization, transferring ownership, and wiping or rotating all API keys.
- The API-key scope model is orthogonal and stricter per key. A key minted with only `subscriptions:read` cannot write regardless of the minting user's role. The console surfaces `API_KEY_SCOPE_FORBIDDEN` when a key lacks a scope the action needs.

---

## 6. URL structure

Every area and detail has a stable, shareable URL keyed by the human `nbo` reference. The console reads the leading `domain` discriminator to route a resolved object, never the 3-letter suffix.

**Area routes.**

```
/                                   Overview
/subscriptions                      Subscriptions list
/subscriptions/:ref                 Subscription detail        (ref … sub)
/subscriptions/:ref/schedule        Schedules for a subscription
/subscriptions/:ref/dunning         Dunning cockpit for a subscription
/customers                          Customers list
/customers/:ref                     Customer detail            (ref … cus)
/plans                              Plans list
/plans/:ref                         Plan detail with prices    (ref … pln)
/prices/:ref                        Price detail               (ref … prc)
/invoices                           Invoices list
/invoices/:ref                      Invoice detail             (ref … inv)
/payments                           Payment methods list
/payments/:ref                      Payment method detail      (ref … pmt)
/dunning                            Dunning and recovery (all subscriptions in recovery)
/settlements                        Settlements list
/settlements/:ref                   Settlement detail          (ref … stl)
/settlements/escrow                 Escrow and withdrawal
/coupons                            Coupons list
/coupons/:ref                       Coupon detail              (ref … cpn)
/developers/keys                    API keys
/developers/webhooks                Webhook endpoints
/developers/webhooks/:ref           Endpoint detail            (ref … whk)
/developers/webhooks/:ref/deliveries/:deliveryRef  Delivery detail (deliveryRef … whd)
/developers/events                  Event feed
/developers/events/:ref             Event detail               (ref … evt)
/developers/test                    Test mode (test env only)
/developers/reference               API reference (openapi.json)
/settings/organization              Organization
/settings/billing                   Billing settings
/settings/team                      Team and RBAC
/settings/nomba                     Nomba connection
/reconciliation                     Settlement health (tenant)
```

**Reference suffixes** (for display and route parsing hints only): `cus`, `pln`, `prc`, `pmt`, `sub`, `sch`, `inv`, `ili`, `cpn`, `dsc`, `crg`, `dun`, `stl`, `ref`, `pay`, `whk`, `whd`, `evt`.

**Routing rules.**

- The environment is not in the path. It is `org_sessions.environment`, held in the shell. A given reference resolves within the active environment. A test subscription and a live subscription can share the same URL shape and are told apart by the current environment context, not by the URL.
- **Resolve by `domain`, not by suffix.** When the command palette or a global search resolves an arbitrary pasted reference, the console fetches it and routes on the returned `domain` field (`subscription`, `invoice`, `customer`, and so on). The 3-letter suffix is a hint for the loading placeholder, never the routing decision. This holds even if a future suffix collides or is renamed, because the discriminator is authoritative.
- **Nested detail keeps its parent in the path.** A delivery lives under its endpoint (`/developers/webhooks/:ref/deliveries/:deliveryRef`), mirroring the API, where the delivery is nested under the webhook and the inner param is `deliveryId`, not a second `id`. A schedule and a dunning cockpit live under their subscription.
- **Deep links are RBAC-checked on load.** A viewer who opens a write-only route by URL lands on the read view of that object with write actions absent, not on an error page.

---

## 7. Responsive strategy

The console is a working tool, denser and wider than the marketing site. The exact app container width and density scale are specified in doc 06; this section fixes the behavior the IA depends on.

**Working width.** The marketing container is 1080px, which is too narrow for the console's table-heavy surfaces. The console uses a wider app container. The desktop layout is a fixed left sidebar plus a fluid content region that grows to the app container maximum. Wide content (data tables, the reconciliation view, the deliveries inspector, the event payload viewer) scrolls inside its own horizontal-scroll container so the page body never scrolls sideways. Doc 06 pins the sidebar width, the content maximum, and the intermediate spacing steps.

**Breakpoints and the sidebar.**

- **Desktop (wide).** The sidebar is fixed and always visible. Content fills the app container. This is the primary target.
- **Tablet (medium).** The sidebar may collapse to an icon rail or stay full depending on the doc 06 width; the content region reflows tables to fewer columns with the rest reachable by horizontal scroll inside the table container.
- **390px (the mandated small target).** The sidebar collapses entirely to a slide-over sheet, triggered by the hamburger in the top bar (ASCII in section 1.8). The top bar keeps the hamburger, a truncated breadcrumb, and the mandatory environment switch. Tables collapse to stacked cards or a single primary column with the rest behind a detail tap. Detail views become full-screen. Drawers become full-height sheets. The environment switch is never hidden, because editing the wrong ring on a phone is the costliest small-screen mistake.

**Rules that hold at every width.**

- The environment switch is always reachable.
- Money always renders as naira from integer kobo, at every width, never as a float.
- Cursor pagination degrades to the same "Load more" control on small screens; there is never a page-number control to reflow.
- Overlays (command palette, drawers, confirm dialogs, the nav sheet) use the layering defined in doc 06, above the sticky top bar.
- Reduced motion is honored per doc 00; the sheet and drawer collapse to near-instant transitions when the user asks for less motion.

---

Proceed to doc 02.
