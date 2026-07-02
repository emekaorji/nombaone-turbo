# nombaone API reference

The nombaone billing API — a Stripe-style subscription-billing engine for Nigeria,
settling on Nomba. Generated from the mounted `v1Router` (single source of truth;
also served machine-readable at `GET /v1/openapi.json`).

- **Base URL:** `https://<your-host>/v1` (all paths below are relative to `/v1`)
- **Money:** every amount is an **integer in kobo** (₦1 = 100 kobo). Currency is always `NGN`.
- **IDs:** every resource's public `id` is a reference `nbo{12 digits}{domain}` — e.g.
  `nbo749201835566cus` (customer), `…sub`, `…inv`, `…prc`, `…pmt`, `…stl`. The reference,
  not an internal UUID, is what you pass back in.
- **Time:** all timestamps are ISO-8601 UTC strings.

---

## Authentication

Every request (except `/health`, `/ready`, `/events/catalog`) requires a per-organization
**secret API key** as a bearer token:

```
Authorization: Bearer nbo_live_xxxxxxxxxxxxxxxx
```

- The key encodes its environment: `nbo_test_…` or `nbo_live_…`. A key whose environment
  doesn't match the deployment is rejected (`API_KEY_ENVIRONMENT_MISMATCH`).
- Each key carries a set of **scopes**; each endpoint requires one (e.g. `subscriptions:write`).
  A missing scope → `403 API_KEY_SCOPE_FORBIDDEN`.

Scopes: `customers:{read,write}`, `plans:{read,write}`, `prices:{read,write}`,
`payment_methods:{read,write}`, `mandates:write`, `subscriptions:{read,write}`,
`invoices:{read,write}`, `coupons:{read,write}`, `billing_settings:{read,write}`,
`settlements:{read,write}`, `settings:{read,write}`, `metrics:read`, `webhooks:{read,write}`.

---

## Request & response conventions

**Idempotency.** Every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) requires an
`Idempotency-Key` header. Replaying the same key returns the original result and never
repeats the side effect. Money-moving endpoints back this with a durable DB claim.

```
Idempotency-Key: 3f9c1e7a-…            Content-Type: application/json
```

**Success envelope.**

```json
{
  "success": true,
  "statusCode": 200,
  "data": { … },
  "meta": { "requestId": "req_…" }
}
```

**Paginated envelope** (cursor-based; no total count):

```json
{
  "success": true,
  "statusCode": 200,
  "data": [ … ],
  "pagination": { "limit": 20, "hasMore": true, "nextCursor": "eyJ…" },
  "meta": { "requestId": "req_…" }
}
```

List endpoints take `?limit=` (1–100, default 20) and `?cursor=` (opaque; pass back
`pagination.nextCursor`).

**Error envelope.** Non-internal codes are exposed; everything else collapses to
`SYSTEM_INTERNAL_ERROR`.

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "CLIENT_VALIDATION_FAILED",
    "message": "…",
    "fields": { "email": ["Invalid email"] }
  },
  "meta": { "requestId": "req_…" }
}
```

Common codes: `API_KEY_MISSING`/`API_KEY_INVALID`/`API_KEY_SCOPE_FORBIDDEN`,
`CLIENT_VALIDATION_FAILED`, `CLIENT_RESOURCE_NOT_FOUND`, `IDEMPOTENCY_KEY_MISSING`/`_REUSED`/`_IN_PROGRESS`,
`RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`, plus per-resource codes (`SUBSCRIPTION_NOT_FOUND`,
`INVOICE_ALREADY_PAID`, `MANDATE_NOT_ACTIVE`, `REFUND_ALREADY_REFUNDED`, `ESCROW_LOCKED`, …).

**Rate limits.** Per-tenant per-minute cap (`429 RATE_LIMIT_EXCEEDED`) + an optional
monthly request quota (`429 QUOTA_EXCEEDED`).

---

## Customers `nbo…cus`

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| POST | `/customers` | Create a customer | customers:write | `{ email, name, phone?, metadata? }` |
| GET | `/customers` | List customers (filter by email) | customers:read | `?email=&limit=&cursor=` |
| GET | `/customers/:ref` | Retrieve one customer | customers:read | — |
| PATCH | `/customers/:ref` | Update a customer | customers:write | `{ name?, phone?, metadata? }` |
| POST | `/customers/:ref/discount` | Apply a coupon to the customer | customers:write | `{ coupon }` (ref or code) → `DiscountResponseData` |
| DELETE | `/customers/:ref/discount` | Remove the customer's discount | customers:write | — |
| POST | `/customers/:ref/credit` | Grant account credit | customers:write | `{ amount, source?, sourceReference?, metadata? }` → `CreditGrantResponseData` |
| GET | `/customers/:ref/credit` | Get credit balance + grants | customers:read | → `CreditBalanceResponseData` (`{ customerId, balance, grants[] }`) |
| DELETE | `/customers/:ref/credit/:grantRef` | Void an unconsumed credit grant | customers:write | reverses only the remainder |

**CustomerResponseData**: `{ id, email, name, phone|null, metadata, environment, createdAt, updatedAt }`

```json
// POST /customers
{
  "email": "ada@acme.io",
  "name": "Ada Payer",
  "phone": "+2348012345678"
}
```

---

## Plans `nbo…pln` & Prices `nbo…prc`

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| POST | `/plans` | Create a plan | plans:write | `{ name, description?, metadata? }` |
| GET | `/plans` | List plans | plans:read | `?status=active\|archived&limit=&cursor=` |
| GET | `/plans/:ref` | Retrieve a plan | plans:read | — |
| PATCH | `/plans/:ref` | Update a plan | plans:write | `{ name?, description?, metadata? }` |
| POST | `/plans/:ref/archive` | Archive a plan | plans:write | — |
| POST | `/plans/:ref/prices` | Add a price to the plan | prices:write | create a price on the plan (body below) |
| GET | `/plans/:ref/prices` | List a plan's prices | prices:read | — |
| GET | `/prices` | List prices | prices:read | `?planRef=&active=&limit=&cursor=` |
| GET | `/prices/:ref` | Retrieve a price | prices:read | — |
| POST | `/prices/:ref/deactivate` | Deactivate a price | prices:write | — |

**Create price body:** `{ unitAmount (kobo), interval: day\|week\|month\|year, intervalCount=1,
usageType: licensed\|metered, billingScheme: per_unit\|tiered, trialPeriodDays=0, metadata? }`

**PriceResponseData**: `{ id, planId, unitAmount, currency:"NGN", interval, intervalCount,
usageType, billingScheme, trialPeriodDays, active, metadata, environment, createdAt }`

---

## Subscriptions `nbo…sub`

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| POST | `/subscriptions` | Create a subscription (charges the first invoice) | subscriptions:write | `{ customerId, priceId, paymentMethodId?, collectionMethod?, trialDays?, quantity=1, metadata? }` |
| GET | `/subscriptions` | List subscriptions | subscriptions:read | `?customerId=&status=&limit=&cursor=` |
| GET | `/subscriptions/:ref` | Retrieve a subscription | subscriptions:read | — |
| PATCH | `/subscriptions/:ref` | Update default method / metadata | subscriptions:write | `{ defaultPaymentMethodId?, metadata? }` |
| POST | `/subscriptions/:ref/pause` | Pause billing | subscriptions:write | `{ maxDays? }` |
| POST | `/subscriptions/:ref/resume` | Resume a paused subscription | subscriptions:write | `{}` |
| POST | `/subscriptions/:ref/cancel` | Cancel (now or at period end) | subscriptions:write | `{ mode: now\|at_period_end, comment? }` |
| POST | `/subscriptions/:ref/resubscribe` | Restart a canceled subscription | subscriptions:write | `{ priceId?, paymentMethodId? }` |
| POST | `/subscriptions/:ref/change` | Change plan/quantity/interval (proration) | subscriptions:write | `{ priceId?, quantity?, intervalSwitch?, prorationBehavior: create_prorations\|none }` |
| GET | `/subscriptions/:ref/upcoming-invoice` | Preview the next invoice (unsaved) | subscriptions:read | → `UpcomingInvoiceResponseData` |
| POST | `/subscriptions/:ref/schedule` | Schedule a change for next cycle | subscriptions:write | `{ priceId, quantity?, effectiveAt: next_cycle }` |
| GET | `/subscriptions/:ref/schedule` | Get the pending scheduled change | subscriptions:read | — |
| DELETE | `/subscriptions/:ref/schedule` | Cancel the scheduled change | subscriptions:write | — |
| POST | `/subscriptions/:ref/discount` | Apply a coupon | subscriptions:write | `{ coupon }` |
| DELETE | `/subscriptions/:ref/discount` | Remove the discount | subscriptions:write | — |
| GET | `/subscriptions/:ref/events` | Subscription audit trail | subscriptions:read | domain events |

**SubscriptionResponseData**: `{ id, customerId, priceId, status, collectionMethod,
currentPeriodIndex, currentPeriodStart|null, currentPeriodEnd|null, trialStart|null,
trialEnd|null, cancelAtPeriodEnd, canceledAt|null, endedAt|null, cancellationReason|null,
defaultPaymentMethodId|null, items:[{id,priceId,quantity}], latestInvoiceId|null,
currency:"NGN", environment, createdAt }`

Status: `incomplete | incomplete_expired | trialing | active | past_due | paused | canceled`.

```json
// POST /subscriptions  (a payment method is required unless trialDays > 0)
{
  "customerId": "nbo…cus",
  "priceId": "nbo…prc",
  "paymentMethodId": "nbo…pmt",
  "quantity": 1
}
```

---

## Dunning (recovery)

| Method | Path | Description | Scope | Notes |
|---|---|---|---|---|
| GET | `/subscriptions/:ref/dunning` | Current dunning state + attempts | subscriptions:read | → `DunningStateResponseData` |
| GET | `/subscriptions/:ref/dunning/attempts` | List retry attempts | subscriptions:read | paginated `DunningAttemptResponseData[]` |
| POST | `/subscriptions/:ref/payment-method` | Swap the card mid-dunning + retry now | subscriptions:write | `{ paymentMethodReference? }` XOR `{ checkoutToken? }` |

Attempt status: `scheduled | attempting | succeeded | rescheduled | card_update_required | exhausted`.
`card_update_required` is also where an **OTP/3DS-required** card recharge holds (see the
`invoice.action_required` webhook — it carries a fresh checkout link the customer completes).

---

## Invoices `nbo…inv`

| Method | Path | Description | Scope | Query / Body |
|---|---|---|---|---|
| GET | `/invoices` | List invoices | invoices:read | `?customerId=&subscriptionId=&status=&limit=&cursor=` |
| GET | `/invoices/:ref` | Retrieve an invoice | invoices:read | — |
| POST | `/invoices/:ref/void` | Void an open invoice | invoices:write | `{ comment? }` |

**InvoiceResponseData**: `{ id, customerId, subscriptionId|null, status, billingReason,
subtotal, discountTotal, creditTotal, total, amountDue, amountPaid, amountRemaining,
currency:"NGN", periodStart|null, periodEnd|null, dueDate|null,
lineItems:[{id,kind,description,amount,quantity}], finalizedAt|null, paidAt|null,
voidedAt|null, environment, createdAt }`

Status: `draft | open | partially_paid | paid | void | uncollectible`.

---

## Coupons `nbo…cpn` & Discounts `nbo…dsc`

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| POST | `/coupons` | Create a coupon | coupons:write | `{ code, amountOff? XOR percentOff?, duration: once\|repeating\|forever, durationInCycles?, redeemBy?, maxRedemptions?, metadata? }` |
| GET | `/coupons` | List coupons | coupons:read | `?limit=&cursor=` |
| GET | `/coupons/:ref` | Retrieve a coupon | coupons:read | — |
| PATCH | `/coupons/:ref` | Update coupon limits/metadata | coupons:write | `{ redeemBy?, maxRedemptions?, metadata? }` |

Apply a coupon to a customer or subscription via their `…/discount` endpoints above.
**CouponResponseData**: `{ id, code, duration, amountOff|null, percentOff|null,
durationInCycles|null, redeemBy|null, maxRedemptions|null, timesRedeemed, environment, createdAt }`

---

## Payment methods `nbo…pmt`

Three kinds: **card** (hosted-checkout token), **mandate** (NIBSS direct debit),
**virtual_account** (transfer/push).

| Method | Path | Description | Scope | Body → Response |
|---|---|---|---|---|
| POST | `/payment-methods/setup` | Start hosted card setup (returns a checkout link) | payment_methods:write | `{ customerRef, amount (kobo), callbackUrl }` → `{ reference, checkoutLink }` (card captured via webhook) |
| POST | `/payment-methods/virtual-account` | Issue a pay-in virtual account | payment_methods:write | `{ customerRef, expectedAmount?, expiryDate? }` → `{ reference, bankName, accountNumber, accountName, accountRef }` |
| GET | `/payment-methods` | List a customer's methods | payment_methods:read | `?customerRef=&limit=&cursor=` |
| GET | `/payment-methods/:ref` | Retrieve a method | payment_methods:read | — |
| POST | `/payment-methods/:ref/default` | Set as the customer's default | payment_methods:write | — |
| DELETE | `/payment-methods/:ref` | Remove a method | payment_methods:write | — |
| POST | `/mandates` | Create a direct-debit mandate | mandates:write | mandate body (below) → `{ reference, mandateRef, status, consentInstruction }` |
| GET | `/mandates/:ref` | Poll mandate status | payment_methods:read | → `PaymentMethodResponseData` (flips to `active` once NIBSS advice is sent) |

**Create mandate body:** `{ customerRef, customerAccountNumber, bankCode (CBN 3-digit),
customerName, customerAccountName, customerPhoneNumber, customerAddress, narration,
maxAmount (kobo per-debit ceiling), frequency: MONTHLY\|WEEKLY\|…, startDate?, endDate? }`.
The mandate starts `consent_pending`; the customer completes the NIBSS ₦50 validation
(`consentInstruction`), then it polls to `active`.

**PaymentMethodResponseData**: `{ id, customerId, kind, status, isDefault, brand|null,
last4|null, expMonth|null, expYear|null, environment, createdAt, updatedAt }` (never a PAN).

---

## Settlements, Refunds & Payouts `nbo…stl / …ref / …pay`

A verified collection **splits at collection**: the tenant's net share settles to their Nomba
sub-account; the platform fee is the remainder. A rolling **3-hour escrow lock** reserves the
tenant's net share so it can be clawed back for a refund before withdrawal.

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| GET | `/settlements` | List settlements | settlements:read | `?status=&limit=&cursor=` |
| GET | `/settlements/:ref` | Retrieve a settlement | settlements:read | — |
| GET | `/settlements/escrow` | Escrow lock + withdrawable balance | settlements:read | → `{ lockedKobo, since, balanceKobo, minWithdrawableKobo, availableKobo }` |
| POST | `/settlements/:ref/refund` | Refund the tenant share (fee kept) | settlements:write | `{ amountKobo? }` (default = full remaining) → `RefundResponseData` |
| POST | `/settlements/payout` | Withdraw settled funds to a bank | settlements:write | `{ amountKobo, bankCode, accountNumber }` → `PayoutResponseData` |

- **Refund** reverses **only the tenant leg** — the platform fee is non-refundable. Supports
  partials up to `netToTenantKobo`; idempotent. `422 REFUND_ALREADY_REFUNDED` / `REFUND_AMOUNT_EXCEEDS_NET`.
- **Payout** honours the escrow lock: `available = balance − lockedLast3h − minBuffer`.
  `422 ESCROW_LOCKED` (within the 3h window) / `PAYOUT_EXCEEDS_AVAILABLE`.

**SettlementResponseData**: `{ id, invoiceReference|null, subAccountRef, splitReference|null,
merchantTxRef, grossKobo, platformFeeKobo, netToTenantKobo, status, createdAt }`
(status: `pending|settled|reconciled|failed|refunded`).

---

## Settings & billing policy

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| GET | `/settings` | Get tenant settings (account/webhook/limits) | settings:read | → `TenantSettingsResponseData` (webhook secret withheld, only a prefix) |
| PUT | `/settings` | Update quota / settlement mode / branding | settings:write | `{ monthlyRequestQuota?, settlementMode?, branding? }` |
| GET | `/billing-settings` | Get dunning / proration policy | billing_settings:read | → `BillingSettingsResponseData` |
| PUT | `/billing-settings` | Update billing policy | billing_settings:write | any of `partialCollectionEnabled, prorationCreditPolicy, dunningMaxAttempts, dunningIntervalsHours, dunningMaxWindowHours, gracePeriodHours, paydayDays, paydayPullForwardDays, paydayBiasEnabled, defaultCollectionMethod, commsEnabled` |

---

## Webhook endpoints, Events & Deliveries

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| POST | `/webhook-endpoints` | Register a webhook endpoint | webhooks:write | `{ url, enabledEvents=['*'] }` → signing secret shown **once** |
| GET | `/webhook-endpoints` | List endpoints | webhooks:read | paginated |
| GET | `/webhook-endpoints/:ref` | Retrieve an endpoint | webhooks:read | — |
| PATCH | `/webhook-endpoints/:ref` | Update url / events / disabled | webhooks:write | `{ url?, enabledEvents?, disabled? }` |
| DELETE | `/webhook-endpoints/:ref` | Delete an endpoint | webhooks:write | — |
| POST | `/webhook-endpoints/:ref/rotate-secret` | Rotate the signing secret | webhooks:write | → `{ id, signingSecret, signingSecretPrefix }` |
| GET | `/events` | List domain events | webhooks:read | `?type=&limit=&cursor=` |
| GET | `/events/:ref` | Retrieve an event | webhooks:read | — |
| GET | `/events/catalog` | List all event types + payload shapes | _(public)_ | — |
| GET | `/webhook-deliveries` | List deliveries | webhooks:read | `?status=&eventType=&endpoint=&limit=&cursor=` |
| GET | `/webhook-deliveries/:ref` | Retrieve a delivery | webhooks:read | — |
| POST | `/webhook-deliveries/:ref/replay` | Replay a delivery | webhooks:write | re-enqueue |

### Receiving webhooks (outbound, us → you)

Each delivery is a POST with headers:

```
x-nombaone-signature: <hex>                 x-nombaone-event-type: invoice.paid
x-nombaone-delivery: nbo…whd                x-nombaone-delivery-guarantee: at-least-once
```

Body:

```json
{
  "id": "nbo…whd",
  "type": "invoice.paid",
  "event": { "id": "nbo…evt", "type": "invoice.paid", "createdAt": "…" },
  "data": { "reference": "nbo…inv" }
}
```

**Verify the signature** — the signing key is `sha256(plaintextSecret)` (hex); the signature is
`HMAC-SHA256(key, rawBody)` (hex), constant-time compared:

```js
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
const key = createHash('sha256').update(SIGNING_SECRET).digest('hex');
const expected = createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
const ok = timingSafeEqual(
  Buffer.from(expected),
  Buffer.from(req.header('x-nombaone-signature') ?? '')
);
```

Delivery is **at-least-once** — dedupe on `event.id`. Retries back off `[10s, 1m, 5m, 30m, 2h]`
for up to 6 attempts, then dead-letter (replayable).

### Event catalog (types)

`customer.created/updated` · `coupon.created` · `discount.created/removed` ·
`plan.created/updated/archived` · `price.created/deactivated` ·
`subscription.created/updated/trial_will_end/activated/paused/resumed/canceled/churned` ·
`invoice.created/finalized/paid/payment_failed/payment_partially_collected/payment_recovered/action_required/voided` ·
`payment_method.attached/updated/expiring` · `settlement.created/refunded/payout_created`.

`invoice.action_required` (payload `reference, reason, checkoutLink`) fires when a card recharge
needs customer OTP/3DS — send the customer the attached `checkoutLink` to complete payment.

---

## Metrics & health

| Method | Path | Description | Scope | Notes |
|---|---|---|---|---|
| GET | `/metrics/billing` | Billing metrics (MRR, churn, dunning funnel) | metrics:read | `?from=&to=` → `BillingMetricsData` |
| GET | `/health` | Liveness check | _(public)_ | — |
| GET | `/ready` | Readiness check (DB + Redis + Nomba token) | _(public)_ | — |

---

_Machine-readable spec: `GET /v1/openapi.json`. Amounts are kobo; references are the public ids._
