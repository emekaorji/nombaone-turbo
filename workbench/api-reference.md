# nombaone API reference

The nombaone billing API — a Stripe-style subscription-billing engine for Nigeria,
settling on Nomba. Generated from the mounted `v1Router` (single source of truth;
also served machine-readable at `GET /v1/openapi.json`).

- **Base URL:** `https://<your-host>/v1` (all paths below are relative to `/v1`)
- **Money:** every amount is an **integer in kobo** (₦1 = 100 kobo), and every money field
  name ends in **`InKobo`** (e.g. `amountInKobo`, `unitAmountInKobo`, `totalInKobo`) so the unit
  is impossible to mistake. Currency is always `NGN`.
- **IDs:** every resource's public `id` is a reference `nbo{12 digits}{domain}` — e.g.
  `nbo749201835566cus` (customer), `…sub`, `…inv`, `…prc`, `…pmt`, `…stl`. The reference,
  not an internal UUID, is what you pass back in.
- **Time:** all timestamps are ISO-8601 UTC strings.

---

## Authentication

Every request (except `/health`, `/events/catalog`) requires a per-organization
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
`settlements:{read,write}`, `organizations:{read,write}`, `metrics:read`, `webhooks:{read,write}`.

---

## Request & response conventions

**Idempotency.** Send an `Idempotency-Key` header on mutating requests; replaying the same
key returns the original result and never repeats the side effect. It is **required** on the
money-moving endpoints (subscription create/change/resubscribe/cancel, credit grant/void, card
setup, mandate create, settlement refund/payout) — a missing key there is `400
IDEMPOTENCY_KEY_MISSING`, backed by a durable DB claim. It is **optional but strongly
encouraged** everywhere else: supply a key and the mutation dedupes; omit it and it behaves as
a normal request. Our SDKs auto-generate a key, so idempotency is on by default.

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

**Object type (`domain`).** Every resource object carries a `domain` string naming its type —
`"customer"`, `"invoice"`, `"subscription"`, `"payout"`, and so on. Switch on `domain` to tell
objects apart (e.g. in a webhook payload or a polymorphic list); never infer type from the id
suffix. It is the first field of every response `data`.

**Error envelope.** Non-internal codes are exposed; everything else collapses to
`SYSTEM_INTERNAL_ERROR`.

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "CLIENT_VALIDATION_FAILED",
    "message": "…",
    "hint": "One or more fields failed validation — see `fields` for the specifics and fix each.",
    "docUrl": "https://docs.nombaone.com/errors#CLIENT_VALIDATION_FAILED",
    "fields": { "email": ["Invalid email"] }
  },
  "meta": { "requestId": "req_…" }
}
```

Every error carries a **`hint`** (a plain-English "what to do next") and a **`docUrl`** (a link
to that code's docs) alongside `code` and `message` — errors tell you how to fix them.

Common codes: `API_KEY_MISSING`/`API_KEY_INVALID`/`API_KEY_SCOPE_FORBIDDEN`,
`CLIENT_VALIDATION_FAILED`, `CLIENT_RESOURCE_NOT_FOUND`, `IDEMPOTENCY_KEY_MISSING`/`_REUSED`/`_IN_PROGRESS`,
`RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`, plus per-resource codes (`SUBSCRIPTION_NOT_FOUND`,
`INVOICE_ALREADY_PAID`, `MANDATE_NOT_ACTIVE`, `REFUND_ALREADY_REFUNDED`, `ESCROW_LOCKED`, …).

**Rate limits.** Per-organization per-minute cap (`429 RATE_LIMIT_EXCEEDED`) + an optional
monthly request quota (`429 QUOTA_EXCEEDED`).

---

## Customers `nbo…cus`

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| POST | `/customers` | Create a customer | customers:write | `{ email, name, phone?, metadata? }` |
| GET | `/customers` | List customers (filter by email) | customers:read | `?email=&limit=&cursor=` |
| GET | `/customers/{id}` | Retrieve one customer | customers:read | — |
| PATCH | `/customers/{id}` | Update a customer | customers:write | `{ name?, phone?, metadata? }` |
| POST | `/customers/{id}/discount` | Apply a coupon to the customer | customers:write | `{ coupon }` (ref or code) → `DiscountResponseData` |
| DELETE | `/customers/{id}/discount` | Remove the customer's discount | customers:write | — |
| POST | `/customers/{id}/credit` | Grant account credit | customers:write | `{ amountInKobo, source?, sourceReference?, metadata? }` → `CreditGrantResponseData` |
| GET | `/customers/{id}/credit` | Get credit balance + grants | customers:read | → `CreditBalanceResponseData` (`{ customerId, balanceInKobo, grants[] }`) |
| DELETE | `/customers/{id}/credit/{grantId}` | Void an unconsumed credit grant | customers:write | reverses only the remainder |

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
| GET | `/plans/{id}` | Retrieve a plan | plans:read | — |
| PATCH | `/plans/{id}` | Update a plan | plans:write | `{ name?, description?, metadata? }` |
| POST | `/plans/{id}/archive` | Archive a plan | plans:write | — |
| POST | `/plans/{id}/prices` | Add a price to the plan | prices:write | create a price on the plan (body below) |
| GET | `/plans/{id}/prices` | List a plan's prices | prices:read | — |
| GET | `/prices` | List prices | prices:read | `?planRef=&active=&limit=&cursor=` |
| GET | `/prices/{id}` | Retrieve a price | prices:read | — |
| POST | `/prices/{id}/deactivate` | Deactivate a price | prices:write | — |

**Create price body:** `{ unitAmountInKobo, interval: day\|week\|month\|year, intervalCount=1,
usageType: licensed\|metered, billingScheme: per_unit\|tiered, trialPeriodDays=0, metadata? }`

**PriceResponseData**: `{ id, planId, unitAmountInKobo, currency:"NGN", interval, intervalCount,
usageType, billingScheme, trialPeriodDays, active, metadata, environment, createdAt }`

---

## Subscriptions `nbo…sub`

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| POST | `/subscriptions` | Create a subscription (charges the first invoice) | subscriptions:write | `{ customerId, priceId, paymentMethodId?, collectionMethod?, trialDays?, quantity=1, metadata? }` |
| GET | `/subscriptions` | List subscriptions | subscriptions:read | `?customerId=&status=&limit=&cursor=` |
| GET | `/subscriptions/{id}` | Retrieve a subscription | subscriptions:read | — |
| PATCH | `/subscriptions/{id}` | Update default method / metadata | subscriptions:write | `{ defaultPaymentMethodId?, metadata? }` |
| POST | `/subscriptions/{id}/pause` | Pause billing | subscriptions:write | `{ maxDays? }` |
| POST | `/subscriptions/{id}/resume` | Resume a paused subscription | subscriptions:write | `{}` |
| POST | `/subscriptions/{id}/cancel` | Cancel (now or at period end) | subscriptions:write | `{ mode: now\|at_period_end, comment? }` |
| POST | `/subscriptions/{id}/resubscribe` | Restart a canceled subscription | subscriptions:write | `{ priceId?, paymentMethodId? }` |
| POST | `/subscriptions/{id}/change` | Change plan/quantity/interval (proration) | subscriptions:write | `{ priceId?, quantity?, intervalSwitch?, prorationBehavior: create_prorations\|none }` |
| GET | `/subscriptions/{id}/upcoming-invoice` | Preview the next invoice (unsaved) | subscriptions:read | → `UpcomingInvoiceResponseData` |
| POST | `/subscriptions/{id}/schedule` | Schedule a change for next cycle | subscriptions:write | `{ priceId, quantity?, effectiveAt: next_cycle }` |
| GET | `/subscriptions/{id}/schedule` | Get the pending scheduled change | subscriptions:read | — |
| DELETE | `/subscriptions/{id}/schedule` | Cancel the scheduled change | subscriptions:write | — |
| POST | `/subscriptions/{id}/discount` | Apply a coupon | subscriptions:write | `{ coupon }` |
| DELETE | `/subscriptions/{id}/discount` | Remove the discount | subscriptions:write | — |
| GET | `/subscriptions/{id}/events` | Subscription audit trail | subscriptions:read | domain events |

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
| GET | `/subscriptions/{id}/dunning` | Current dunning state + attempts | subscriptions:read | → `DunningStateResponseData` |
| GET | `/subscriptions/{id}/dunning/attempts` | List retry attempts | subscriptions:read | paginated `DunningAttemptResponseData[]` |
| POST | `/subscriptions/{id}/payment-method` | Swap the card mid-dunning + retry now | subscriptions:write | `{ paymentMethodReference? }` XOR `{ checkoutToken? }` |

Attempt status: `scheduled | attempting | succeeded | rescheduled | card_update_required | exhausted`.
`card_update_required` is also where an **OTP/3DS-required** card recharge holds (see the
`invoice.action_required` webhook — it carries a fresh checkout link the customer completes).

---

## Invoices `nbo…inv`

| Method | Path | Description | Scope | Query / Body |
|---|---|---|---|---|
| GET | `/invoices` | List invoices | invoices:read | `?customerId=&subscriptionId=&status=&limit=&cursor=` |
| GET | `/invoices/{id}` | Retrieve an invoice | invoices:read | — |
| POST | `/invoices/{id}/void` | Void an open invoice | invoices:write | `{ comment? }` |

**InvoiceResponseData**: `{ id, customerId, subscriptionId|null, status, billingReason,
subtotalInKobo, discountTotalInKobo, creditTotalInKobo, totalInKobo, amountDueInKobo, amountPaidInKobo, amountRemainingInKobo,
currency:"NGN", periodStart|null, periodEnd|null, dueDate|null,
lineItems:[{id,kind,description,amount,quantity}], finalizedAt|null, paidAt|null,
voidedAt|null, environment, createdAt }`

Status: `draft | open | partially_paid | paid | void | uncollectible`.

---

## Coupons `nbo…cpn` & Discounts `nbo…dsc`

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| POST | `/coupons` | Create a coupon | coupons:write | `{ code, amountOffInKobo? XOR percentOff?, duration: once\|repeating\|forever, durationInCycles?, redeemBy?, maxRedemptions?, metadata? }` |
| GET | `/coupons` | List coupons | coupons:read | `?limit=&cursor=` |
| GET | `/coupons/{id}` | Retrieve a coupon | coupons:read | — |
| PATCH | `/coupons/{id}` | Update coupon limits/metadata | coupons:write | `{ redeemBy?, maxRedemptions?, metadata? }` |

Apply a coupon to a customer or subscription via their `…/discount` endpoints above.
**CouponResponseData**: `{ id, code, duration, amountOffInKobo|null, percentOff|null,
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
| GET | `/payment-methods/{id}` | Retrieve a method | payment_methods:read | — |
| POST | `/payment-methods/{id}/default` | Set as the customer's default | payment_methods:write | — |
| DELETE | `/payment-methods/{id}` | Remove a method | payment_methods:write | — |
| POST | `/mandates` | Create a direct-debit mandate | mandates:write | mandate body (below) → `{ reference, mandateRef, status, consentInstruction }` |
| GET | `/mandates/{id}` | Poll mandate status | payment_methods:read | → `PaymentMethodResponseData` (flips to `active` once NIBSS advice is sent) |

**Create mandate body:** `{ customerRef, customerAccountNumber, bankCode (CBN 3-digit),
customerName, customerAccountName, customerPhoneNumber, customerAddress, narration,
maxAmountInKobo (per-debit ceiling), frequency: monthly\|weekly\|every_two_weeks\|…, startDate?, endDate? }`.
The mandate starts `consent_pending`; the customer completes the NIBSS ₦50 validation
(`consentInstruction`), then it polls to `active`.

**PaymentMethodResponseData**: `{ id, customerId, kind, status, isDefault, brand|null,
last4|null, expMonth|null, expYear|null, environment, createdAt, updatedAt }` (never a PAN).

---

## Settlements, Refunds & Payouts `nbo…stl / …ref / …pay`

A verified collection **splits at collection**: the organization's net share settles to their Nomba
sub-account; the platform fee is the remainder. A rolling **3-hour escrow lock** reserves the
organization's net share so it can be clawed back for a refund before withdrawal.

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| GET | `/settlements` | List settlements | settlements:read | `?status=&limit=&cursor=` |
| GET | `/settlements/{id}` | Retrieve a settlement | settlements:read | — |
| GET | `/settlements/escrow` | Escrow lock + withdrawable balance | settlements:read | → `{ lockedInKobo, since, balanceInKobo, minWithdrawableInKobo, availableInKobo }` |
| POST | `/settlements/{id}/refund` | Refund the organization's share (fee kept) | settlements:write | `{ amountInKobo? }` (default = full remaining) → `RefundResponseData` |
| POST | `/settlements/payout` | Withdraw settled funds to a bank | settlements:write | `{ amountInKobo, bankCode, accountNumber }` → `PayoutResponseData` |

- **Refund** reverses **only the organization's leg** — the platform fee is non-refundable. Supports
  partials up to `netToTenantInKobo`; idempotent. `422 REFUND_ALREADY_REFUNDED` / `REFUND_AMOUNT_EXCEEDS_NET`.
- **Payout** honours the escrow lock: `available = balance − lockedLast3h − minBuffer`.
  `422 ESCROW_LOCKED` (within the 3h window) / `PAYOUT_EXCEEDS_AVAILABLE`.

**SettlementResponseData**: `{ id, invoiceReference|null, subAccountRef, splitReference|null,
merchantTxRef, grossInKobo, platformFeeInKobo, netToTenantInKobo, status, createdAt }`
(status: `pending|settled|reconciled|failed|refunded`).

---

## Organization & billing policy

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| GET | `/organizations` | Get your organization (account/webhook/limits) | organizations:read | → `OrganizationResponseData` (webhook secret withheld, only a prefix) |
| PUT | `/organizations` | Update quota / settlement mode / branding | organizations:write | `{ monthlyRequestQuota?, settlementMode?, branding? }` |
| GET | `/billing-settings` | Get dunning / proration policy | billing_settings:read | → `BillingSettingsResponseData` |
| PUT | `/billing-settings` | Update billing policy | billing_settings:write | any of `partialCollectionEnabled, prorationCreditPolicy, dunningMaxAttempts, dunningIntervalsHours, dunningMaxWindowHours, gracePeriodHours, paydayDays, paydayPullForwardDays, paydayBiasEnabled, defaultCollectionMethod, commsEnabled` |

---

## Webhook endpoints, Events & Deliveries

| Method | Path | Description | Scope | Body / Query |
|---|---|---|---|---|
| POST | `/webhooks` | Register a webhook endpoint | webhooks:write | `{ url, enabledEvents=['*'] }` → signing secret shown **once** |
| GET | `/webhooks` | List endpoints | webhooks:read | paginated |
| GET | `/webhooks/{id}` | Retrieve an endpoint | webhooks:read | — |
| PATCH | `/webhooks/{id}` | Update url / events / disabled | webhooks:write | `{ url?, enabledEvents?, disabled? }` |
| DELETE | `/webhooks/{id}` | Delete an endpoint | webhooks:write | — |
| POST | `/webhooks/{id}/rotate-secret` | Rotate the signing secret | webhooks:write | → `{ id, signingSecret, signingSecretPrefix }` |
| GET | `/events` | List domain events | webhooks:read | `?type=&limit=&cursor=` |
| GET | `/events/{id}` | Retrieve an event | webhooks:read | — |
| GET | `/events/catalog` | List all event types + payload shapes | _(public)_ | — |
| GET | `/webhooks/{id}/deliveries` | List a webhook's deliveries | webhooks:read | `?status=&eventType=&limit=&cursor=` |
| GET | `/webhooks/{id}/deliveries/{deliveryId}` | Retrieve a delivery | webhooks:read | — |
| POST | `/webhooks/{id}/deliveries/{deliveryId}/replay` | Replay a delivery | webhooks:write | re-enqueue |

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

_(The deep **readiness** probe — DB / Redis / Nomba-token — is an admin/ops endpoint, not part of the public API. See `admin-ops.md`.)_

---

## Test-mode instruments `/v1/test/*`

Available **only on a test deployment** (a `nbo_test_…` key on a test host) — the routes don't exist
on live. They let you drive the billing engine deterministically: no cron wait, no real card, no
waiting on Nomba.

| Method | Path | Description | Scope | Body |
|---|---|---|---|---|
| POST | `/test/payment-methods` | Mint a deterministic, chargeable test payment method | payment_methods:write | `{ customerId, behavior?, kind? }` → `PaymentMethodResponseData` |
| POST | `/test/subscriptions/{id}/advance-cycle` | Force the subscription's next billing cycle now (a "test clock") | subscriptions:write | → `{ domain:"advance_cycle_result", subscriptionId, outcome, invoice }` |
| POST | `/test/webhooks/simulate` | Emit + deliver a real catalog event to your endpoints | webhooks:write | `{ type, payload? }` → `{ domain:"webhook_simulation", event, type, deliveredCount }` |

**A test method's `behavior`** fixes what every charge of it does — deterministically, every time
(`kind` is `card` by default, or `mandate`):

- `success` — the charge succeeds and the invoice is paid.
- `decline_insufficient_funds` / `decline_expired_card` / `decline_do_not_honor` — the charge fails
  with that exact reason (drives dunning down the matching branch).
- `requires_otp` — the charge needs customer OTP/3DS: the invoice stays open and an
  `invoice.action_required` event fires, exactly like a live bank step-up.

Attach a test method to a subscription, then `advance-cycle` to bill the next period on demand.
Advancing is **idempotent per period** — re-calling returns the same invoice, never a second charge —
and applies only to `active`/`trialing` subscriptions (else `422`).

---

_Machine-readable spec: `GET /v1/openapi.json`. Money is integer kobo (every money field is named
`*InKobo`); references are the public ids._
