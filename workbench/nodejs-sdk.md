# `@nombaone/node` — usage guide

How to actually **use** the `@nombaone/node` SDK — a scenario-by-scenario cookbook for the
nombaone billing API (a Stripe-style subscription engine for Nigeria, settling on Nomba).
Every snippet below is real application code you can copy, adapt, and run. It is **not** the
SDK's internals — for the endpoints and payload shapes behind these calls, see
[`api-reference.md`](./api-reference.md).

A few things that hold everywhere:

- **Money is always integer kobo** (₦1 = 100 kobo), currency `NGN`. `500_000` = ₦5,000.
- **Every resource id is a `nbo…` reference** returned as `.id` (e.g. `nbo749201835566cus`).
  You pass that `id` back into every method — `nomba.customers.retrieve(id)`.
- **The environment is baked into the key** — a `nbo_test_…` key talks to test, `nbo_live_…`
  to live. There is no runtime flag.

Assume this shared client at the top of every example (create it once, reuse it):

```ts
import { Nombaone } from '@nombaone/node';

const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! });
```

---

## 1. Install & first call

```
npm install @nombaone/node
```

```ts
import { Nombaone } from '@nombaone/node';

const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! });

// Create a customer and read it back.
const customer = await nomba.customers.create({ email: 'ada@acme.io', name: 'Ada Payer' });
console.log(customer.id); // → "nbo749201835566cus"

const again = await nomba.customers.retrieve(customer.id);
console.log(again.email); // → "ada@acme.io"
```

---

## 2. Client setup & configuration

The only required option is `apiKey`. Everything else has a sane default; override what you need.

```ts
const nomba = new Nombaone({
  apiKey: process.env.NOMBAONE_API_KEY!, // "nbo_test_…" or "nbo_live_…" (prefix picks the env)
  baseUrl: 'https://api.nombaone.com/v1', // override to hit a self-hosted / local instance
  timeoutMs: 30_000,                      // per-request timeout
  maxRetries: 2,                          // auto-retry on 429 / 5xx / network (safe: same Idempotency-Key)
});
```

Point at test vs live purely by swapping the key:

```ts
const test = new Nombaone({ apiKey: 'nbo_test_…' }); // sandbox
const live = new Nombaone({ apiKey: 'nbo_live_…' }); // production
```

Bring your own `fetch` (e.g. `undici` on older Node, or an instrumented fetch), and your own
idempotency-key generator for deterministic keys across a distributed system:

```ts
import { fetch as undiciFetch } from 'undici';
import { randomUUID } from 'node:crypto';

const nomba = new Nombaone({
  apiKey: process.env.NOMBAONE_API_KEY!,
  fetch: undiciFetch as unknown as typeof fetch,
  idempotencyKeyGenerator: () => `svc-${randomUUID()}`,
});
```

> The SDK auto-attaches an `Idempotency-Key` to every mutating call and reuses it across its own
> retries, so a retried `POST` never double-charges. For cross-restart safety, pass **your own**
> stable key (see §14).

---

## 3. Customers — CRUD, credit, discounts

### Create, retrieve, update

```ts
const customer = await nomba.customers.create({
  email: 'ada@acme.io',
  name: 'Ada Payer',
  phone: '+2348012345678',
  metadata: { plan_intent: 'pro', signup_source: 'landing' },
});

await nomba.customers.retrieve(customer.id);

await nomba.customers.update(customer.id, {
  name: 'Ada N. Payer',
  metadata: { ...customer.metadata, vip: true },
});
```

### List, filter by email, auto-paginate

```ts
// Filter to a single email (returns a paginator; usually one match).
const page = await nomba.customers.list({ email: 'ada@acme.io' }).page();
const found = page.data[0];

// Stream every customer across all pages — cursors are handled for you.
for await (const c of nomba.customers.list({ limit: 100 })) {
  console.log(c.id, c.email);
}
```

### Account credit — grant, read balance, void

Credit is applied to future invoices before charging the payment method. Amounts are kobo.

```ts
// Grant ₦2,000 of goodwill credit.
const grant = await nomba.customers.grantCredit(customer.id, {
  amountInKobo: 200_000,
  source: 'goodwill',
  sourceReference: 'support-ticket-8842',
});

// Read the running balance + the grants that make it up.
const balance = await nomba.customers.creditBalance(customer.id);
console.log(balance.balanceInKobo, balance.grants.length); // { customerId, balanceInKobo, grants[] }

// Void the *unconsumed remainder* of a grant (already-applied credit is untouched).
await nomba.customers.voidCredit(customer.id, grant.id);
```

### Discounts (coupons) on a customer

Apply a coupon by its code or id; it then discounts the customer's subscriptions.

```ts
await nomba.customers.applyDiscount(customer.id, 'LAUNCH20');
// …later
await nomba.customers.removeDiscount(customer.id);
```

---

## 4. Catalogue — plans & prices

A **plan** is the product; **prices** are the billable variants (monthly, yearly, trial, metered).

```ts
const plan = await nomba.plans.create({
  name: 'Pro',
  description: 'Everything in Pro',
  metadata: { tier: 'pro' },
});

// ₦5,000 / month
const monthly = await nomba.plans.createPrice(plan.id, {
  unitAmountInKobo: 500_000,
  interval: 'month',
});

// ₦50,000 / year with a 14-day free trial
const yearly = await nomba.plans.createPrice(plan.id, {
  unitAmountInKobo: 5_000_000,
  interval: 'year',
  trialPeriodDays: 14,
});

// Metered: ₦10 per unit of usage, billed monthly
const metered = await nomba.plans.createPrice(plan.id, {
  unitAmountInKobo: 1_000,
  interval: 'month',
  usageType: 'metered',
});
```

List and deactivate prices:

```ts
for await (const price of nomba.plans.listPrices(plan.id)) {
  console.log(price.id, price.unitAmountInKobo, price.interval, price.active);
}

// Or list across all plans, active only:
await nomba.prices.list({ active: true }).toArray();

await nomba.prices.deactivate(monthly.id); // stops new subscriptions on this price
```

Archive a whole plan when it's retired:

```ts
await nomba.plans.archive(plan.id);
```

---

## 5. Payment methods — card, virtual account, mandate

Three kinds: hosted **card** (checkout token), **virtual_account** (bank transfer/push), and
**mandate** (NIBSS direct debit). A `PaymentMethod` has `status`:
`setup_pending | consent_pending | active | removed | expired` and never exposes a PAN.

### Hosted card setup (redirect → captured via webhook)

The SDK returns a `checkoutLink`; send the customer there. The card is captured asynchronously and
arrives as a `payment_method.attached` webhook — you don't get the `id` back from this call.

```ts
const setup = await nomba.paymentMethods.setupCard({
  customerId: customer.id,
  amountInKobo: 500_000, // kobo — the verification/first charge (₦5,000)
  callbackUrl: 'https://acme.io/billing/return',
});

// Redirect the browser to setup.checkoutLink …
// … then wait for the `payment_method.attached` webhook to learn the payment method id (§12).
```

### Issue a virtual account (pay-in)

```ts
const va = await nomba.paymentMethods.issueVirtualAccount({
  customerId: customer.id,
  expectedAmount: 500_000, // optional
});
console.log(va.bankName, va.accountNumber, va.accountName);
```

### NIBSS mandate (consent flow → poll to active)

Creating a mandate returns a `consentInstruction`; the customer completes the NIBSS ₦50 validation,
then the mandate polls to `active`. Only then can you charge it.

```ts
const mandate = await nomba.mandates.create({
  customerId: customer.id,
  customerAccountNumber: '0123456789',
  bankCode: '058',                 // CBN 3-digit
  customerName: 'Ada Payer',
  customerAccountName: 'ADA PAYER',
  customerPhoneNumber: '+2348012345678',
  customerAddress: '1 Marina, Lagos',
  narration: 'Acme Pro subscription',
  maxAmountInKobo: 1_000_000,            // per-debit ceiling, kobo (₦10,000)
  frequency: 'monthly',
});

console.log(mandate.consentInstruction); // show this to the customer

// Poll until the bank activates it.
async function waitForActive(id: string, tries = 20): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const pm = await nomba.mandates.retrieve(id);
    if (pm.status === 'active') return true;
    if (pm.status === 'removed' || pm.status === 'expired') return false;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  return false;
}
const active = await waitForActive(mandate.id);
```

### List, set default, remove

```ts
for await (const pm of nomba.paymentMethods.list({ customerId: customer.id })) {
  console.log(pm.id, pm.kind, pm.status, pm.isDefault, pm.last4);
}

await nomba.paymentMethods.setDefault('nbo…pmt');
await nomba.paymentMethods.remove('nbo…pmt');
```

---

## 6. Subscriptions — the full lifecycle

### Create — with a card, with a mandate, or trial-only

Creating a subscription charges the first invoice immediately (unless it starts on a trial).

```ts
// With a saved card / mandate payment method:
const sub = await nomba.subscriptions.create({
  customerId: customer.id,
  priceId: monthly.id,
  paymentMethodId: 'nbo…pmt',
  quantity: 1,
});

// With a mandate (direct debit) — pass the mandate's payment method id:
await nomba.subscriptions.create({
  customerId: customer.id,
  priceId: monthly.id,
  paymentMethodId: mandate.id,
});

// Trial-only — no payment method needed while trialDays > 0:
const trialing = await nomba.subscriptions.create({
  customerId: customer.id,
  priceId: monthly.id,
  trialDays: 14,
});
console.log(trialing.status); // → "trialing"
```

### Retrieve & list (by status, by customer)

Status: `incomplete | incomplete_expired | trialing | active | past_due | paused | canceled`.

```ts
await nomba.subscriptions.retrieve(sub.id);

// Everything for one customer:
await nomba.subscriptions.list({ customerId: customer.id }).toArray();

// Stream all past-due subscriptions:
for await (const s of nomba.subscriptions.list({ status: 'past_due' })) {
  console.log(s.id, s.currentPeriodEnd);
}
```

### Update the default payment method / metadata

```ts
await nomba.subscriptions.update(sub.id, {
  defaultPaymentMethodId: 'nbo…pmt',
  metadata: { seat_owner: 'ada' },
});
```

### Pause & resume

```ts
await nomba.subscriptions.pause(sub.id, { maxDays: 30 });
await nomba.subscriptions.resume(sub.id);
```

### Cancel — now or at period end — and resubscribe

```ts
await nomba.subscriptions.cancel(sub.id, { mode: 'at_period_end', comment: 'downgrading' });
// or hard-cancel immediately:
await nomba.subscriptions.cancel(sub.id, { mode: 'now' });

// Bring a canceled subscription back:
await nomba.subscriptions.resubscribe(sub.id, {
  priceId: monthly.id,
  paymentMethodId: 'nbo…pmt',
});
```

### Change plan / quantity / interval (with proration)

```ts
// Upgrade to a different price, prorate the difference now:
await nomba.subscriptions.change(sub.id, {
  priceId: yearly.id,
  prorationBehavior: 'create_prorations',
});

// Add seats:
await nomba.subscriptions.change(sub.id, {
  quantity: 5,
  prorationBehavior: 'create_prorations',
});

// Switch monthly → yearly interval without proration:
await nomba.subscriptions.change(sub.id, {
  priceId: yearly.id,
  intervalSwitch: true,
  prorationBehavior: 'none',
});
```

### Preview the upcoming invoice before you commit

```ts
const preview = await nomba.subscriptions.upcomingInvoice(sub.id);
console.log(preview.totalInKobo, preview.lineItems); // nothing is charged — this is a dry run
```

### Schedule a change for the next cycle

Defer a change so it takes effect at the next renewal instead of now.

```ts
await nomba.subscriptions.schedule(sub.id, {
  priceId: yearly.id,
  effectiveAt: 'next_cycle',
});

await nomba.subscriptions.getSchedule(sub.id);   // inspect the pending change
await nomba.subscriptions.cancelSchedule(sub.id); // call it off
```

### Discounts on a subscription

```ts
await nomba.subscriptions.applyDiscount(sub.id, 'LAUNCH20');
await nomba.subscriptions.removeDiscount(sub.id);
```

### Read the subscription's event audit trail

```ts
for await (const ev of nomba.subscriptions.events(sub.id)) {
  console.log(ev.type, ev.createdAt); // subscription.created, invoice.paid, …
}
```

---

## 7. Invoices

Status: `draft | open | partially_paid | paid | void | uncollectible`. Amounts are kobo.

```ts
// List / filter:
await nomba.invoices.list({ customerId: customer.id, status: 'open' }).toArray();
await nomba.invoices.list({ subscriptionId: sub.id }).toArray();

const invoice = await nomba.invoices.retrieve('nbo…inv');
console.log(invoice.totalInKobo, invoice.amountDueInKobo, invoice.amountRemainingInKobo);

// Void an open invoice (cannot void a paid one — see §13):
await nomba.invoices.void('nbo…inv', { comment: 'issued in error' });
```

---

## 8. Coupons

Create a fixed-amount or percentage coupon, with `once | repeating | forever` duration.

```ts
// ₦1,000 off, applied one time:
const flat = await nomba.coupons.create({
  code: 'NGN1000OFF',
  amountOffInKobo: 100_000,
  duration: 'once',
});

// 20% off for the first 3 cycles:
const pct = await nomba.coupons.create({
  code: 'LAUNCH20',
  percentOff: 20,
  duration: 'repeating',
  durationInCycles: 3,
  maxRedemptions: 500,
  redeemBy: '2026-12-31T23:59:59Z',
});

await nomba.coupons.list().toArray();

// Tighten limits later:
await nomba.coupons.update(pct.id, { maxRedemptions: 200 });
```

Attach coupons to a customer or subscription via their `applyDiscount` methods (§3, §6).

---

## 9. Dunning & the OTP/3DS recovery flow

When a renewal charge fails, the subscription enters dunning. Tokenized-card recharges can require
customer **OTP/3DS** — those land in the `card_update_required` state and surface as an
`invoice.action_required` webhook carrying a fresh `checkoutLink` the customer completes.

### Read the dunning state and attempts

```ts
const state = await nomba.subscriptions.dunning(sub.id);
console.log(state.status); // e.g. "card_update_required"

// Attempt status: scheduled | attempting | succeeded | rescheduled | card_update_required | exhausted
for await (const attempt of nomba.subscriptions.dunningAttempts(sub.id)) {
  console.log(attempt.status, attempt.createdAt);
}
```

### Swap the card mid-dunning and retry now

Pass **either** a new payment method id **or** a fresh checkout token (never both):

```ts
// Customer picked an existing card:
await nomba.subscriptions.updatePaymentMethod(sub.id, { paymentMethodId: 'nbo…pmt' });

// …or they completed a fresh hosted checkout:
await nomba.subscriptions.updatePaymentMethod(sub.id, { checkoutToken: 'chk_…' });
```

### Handle `invoice.action_required` by emailing the customer

In your webhook receiver (§12), forward the fresh checkout link so the customer can finish OTP/3DS:

```ts
case 'invoice.action_required': {
  const { id: invoiceId, reason, checkoutLink } = event.data as {
    id: string; reason: string; checkoutLink: string;
  };
  await emailCustomer(invoiceId, {
    subject: 'Action needed to keep your subscription active',
    body: `Please confirm your payment: ${checkoutLink}`,
  });
  break;
}
```

---

## 10. Settlements, refunds, payouts & escrow

A verified collection splits at collection: the organization's net share settles to their Nomba
sub-account; the platform fee is the remainder. A rolling **3-hour escrow lock** reserves the net
share so it can be clawed back for a refund before it's withdrawn.

### List settlements

Status: `pending | settled | reconciled | failed | refunded`.

```ts
for await (const s of nomba.settlements.list({ status: 'settled' })) {
  console.log(s.id, s.grossInKobo, s.platformFeeInKobo, s.netToTenantInKobo, s.status);
}

const settlement = await nomba.settlements.retrieve('nbo…stl');
```

### Refund the organization's share (full or partial)

Only the organization's leg is reversed — the platform fee is non-refundable. Omit `amountInKobo` for a full
refund; partials are capped at `netToTenantInKobo`.

```ts
// Full organization-share refund:
await nomba.settlements.refund('nbo…stl');

// Partial ₦2,500 refund:
await nomba.settlements.refund('nbo…stl', { amountInKobo: 250_000 });
```

### Check escrow, then pay out available funds

`available = balance − lockedLast3h − minBuffer`. Withdraw only what's available.

```ts
const escrow = await nomba.settlements.escrow();
console.log(escrow.lockedInKobo, escrow.availableInKobo, escrow.minWithdrawableInKobo);

if (escrow.availableInKobo >= escrow.minWithdrawableInKobo) {
  await nomba.settlements.payout({
    amountInKobo: escrow.availableInKobo,
    bankCode: '058',
    accountNumber: '0123456789',
  });
}
```

### Handle the money-movement errors

```ts
import { NombaoneError } from '@nombaone/node';

try {
  await nomba.settlements.payout({ amountInKobo: 5_000_000, bankCode: '058', accountNumber: '0123456789' });
} catch (err) {
  if (err instanceof NombaoneError) {
    if (err.code === 'ESCROW_LOCKED')            { /* funds still in the 3h window — retry later */ }
    else if (err.code === 'PAYOUT_EXCEEDS_AVAILABLE') { /* lower the amount to escrow.availableInKobo */ }
    else if (err.code === 'REFUND_ALREADY_REFUNDED')  { /* settlement was already refunded */ }
    else throw err;
  } else throw err;
}
```

---

## 11. Organizations — settings, branding, settlement mode

`nomba.organizations` is your org's configuration (formerly "settings"). The webhook signing
secret is never returned in full — only a prefix.

```ts
const org = await nomba.organizations.retrieve();
console.log(org.settlementMode, org.branding);

await nomba.organizations.update({
  settlementMode: 'auto',
  monthlyRequestQuota: 1_000_000,
  branding: { displayName: 'Acme', primaryColor: '#0F5EFF', logoUrl: 'https://acme.io/logo.png' },
});
```

Dunning / proration policy lives in billing settings:

```ts
await nomba.billingSettings.retrieve();
await nomba.billingSettings.update({
  dunningMaxAttempts: 6,
  dunningIntervalsHours: [10, 24, 72],
  gracePeriodHours: 48,
  defaultCollectionMethod: 'charge_automatically',
});
```

---

## 12. Webhooks — register, rotate, inspect, replay & receive

### Register an endpoint (the signing secret is shown once)

```ts
const endpoint = await nomba.webhooks.create({
  url: 'https://acme.io/nombaone/webhooks',
  enabledEvents: ['invoice.paid', 'invoice.action_required', 'subscription.churned',
                  'settlement.created', 'payment_method.attached'],
});
console.log(endpoint.signingSecret); // store this now — it is never returned again
```

### Rotate the secret, list & update endpoints

```ts
const rotated = await nomba.webhooks.rotateSecret(endpoint.id);
console.log(rotated.signingSecret, rotated.signingSecretPrefix);

await nomba.webhooks.list().toArray();
await nomba.webhooks.retrieve(endpoint.id);
await nomba.webhooks.update(endpoint.id, { enabledEvents: ['*'] });
await nomba.webhooks.del(endpoint.id);
```

### Inspect deliveries (nested under the endpoint) and replay a dead one

```ts
// Failed deliveries for one endpoint:
for await (const d of nomba.webhooks.deliveries.list(endpoint.id, { status: 'failed' })) {
  console.log(d.id, d.eventType, d.status, d.attempts);
}

const delivery = await nomba.webhooks.deliveries.retrieve(endpoint.id, 'nbo…whd');

// Re-enqueue a dead-lettered delivery:
await nomba.webhooks.deliveries.replay(endpoint.id, delivery.id);
```

### Verify & receive (Express, raw body)

Delivery is **at-least-once** — verify the signature, then dedupe on the domain event id
(`event.event.id`, stable across redeliveries; the top-level `event.id` is the delivery id, which
changes on replay). Mount a **raw** body parser on the webhook route.

```ts
import express from 'express';
import { Nombaone } from '@nombaone/node';

const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! });
const app = express();

app.post('/nombaone/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = nomba.webhooks.constructEvent(
      req.body,                                     // raw Buffer — NOT a parsed object
      req.header('x-nombaone-signature')!,
      process.env.NOMBAONE_WEBHOOK_SECRET!,         // the plaintext secret from create/rotate
    );
  } catch {
    return res.status(400).send('bad signature');
  }

  // Idempotent handling: dedupe on the domain event id.
  if (await alreadyProcessed(event.event.id)) return res.sendStatus(200);

  switch (event.type) {
    case 'invoice.paid': {
      const { id: invoiceId } = event.data as { id: string };
      await grantAccessForInvoice(invoiceId);
      break;
    }
    case 'invoice.action_required': {
      const { id: invoiceId, checkoutLink } = event.data as { id: string; checkoutLink: string };
      await emailCustomer(invoiceId, { body: `Confirm your payment: ${checkoutLink}` });
      break;
    }
    case 'subscription.churned': {
      const { id: subscriptionId } = event.data as { id: string };
      await revokeAccess(subscriptionId);
      break;
    }
    case 'settlement.created': {
      const { id: settlementId } = event.data as { id: string };
      await reconcileLedger(settlementId);
      break;
    }
    case 'payment_method.attached': {
      const { id: paymentMethodId } = event.data as { id: string };
      await onCardCaptured(paymentMethodId); // e.g. finish an in-flight signup
      break;
    }
  }

  await markProcessed(event.event.id);
  res.sendStatus(200);
});
```

The signature scheme, if you ever need to verify without the SDK: the key is
`sha256(plaintextSecret)` (hex) and the signature is `HMAC-SHA256(key, rawBody)` (hex),
constant-time compared. Prefer `constructEvent` — it does exactly this.

---

## 13. Error handling — typed errors

Every failure throws a `NombaoneError` (with `.status`, `.code`, `.message`, `.hint`,
`.docUrl`, `.fields`, `.requestId`) or one of its subclasses. `.hint` is a plain-English
"what to do next" and `.docUrl` links straight to that code's docs — surface them in your
logs so a failure explains itself. Catch the specific type you care about.

```ts
import {
  NombaoneError, NotFoundError, ValidationError,
  RateLimitError, ConflictError,
} from '@nombaone/node';

try {
  await nomba.subscriptions.cancel('nbo…sub', { mode: 'now' });
} catch (err) {
  if (err instanceof NotFoundError) {
    // 404 — already gone / wrong id
  } else if (err instanceof ValidationError) {
    console.error(err.fields); // 422 — { email: ["Invalid email"], … }
  } else if (err instanceof RateLimitError) {
    // 429 — the SDK already retried maxRetries times; back off further
  } else if (err instanceof ConflictError) {
    // 409 — Idempotency-Key reused with a different body
  } else if (err instanceof NombaoneError) {
    console.error(err.status, err.code, err.hint, err.requestId); // anything else — hint says what to do, requestId is for support
  } else {
    throw err;
  }
}
```

You can also branch on the raw `code` when several map to one HTTP status:

```ts
try {
  await nomba.invoices.void('nbo…inv');
} catch (err) {
  if (err instanceof NombaoneError && err.code === 'INVOICE_ALREADY_PAID') {
    // nothing to void
  } else throw err;
}
```

---

## 14. Idempotency — your own stable keys on money-moving calls

For calls that move money, pass a **stable, deterministic** key derived from your domain (order id,
signup id). Replaying it returns the original result instead of charging again — safe across process
restarts, retries, and duplicate queue messages. The key is the last argument on mutating methods.

```ts
// Same signup retried after a crash → one subscription, one charge.
const sub = await nomba.subscriptions.create(
  { customerId: customer.id, priceId: monthly.id, paymentMethodId: 'nbo…pmt' },
  `signup:${signupId}`,
);

// Refund keyed to the order — a duplicate webhook won't double-refund.
await nomba.settlements.refund('nbo…stl', { amountInKobo: 250_000 }, `refund:${orderId}`);

// Payout keyed to a payout run:
await nomba.settlements.payout(
  { amountInKobo: 500_000, bankCode: '058', accountNumber: '0123456789' },
  `payout:${payoutRunId}`,
);
```

> Reusing a key with a **different** body throws `ConflictError` (409). Keep the key ↔ payload
> mapping 1:1.

---

## 15. Pagination — three ways

Every `list(...)` (and nested list) returns a lazy paginator. Pick the style that fits:

```ts
// (a) A single page — you manage the cursor:
const first = await nomba.customers.list({ limit: 50 }).page();
console.log(first.data.length, first.hasMore, first.nextCursor);
const next = await nomba.customers.list({ limit: 50 }).page(first.nextCursor ?? undefined);

// (b) Stream every item across all pages (cursors handled for you):
for await (const c of nomba.customers.list({ limit: 100 })) {
  await process(c);
}

// (c) Collect everything into an array (guarded — pass a cap for large sets):
const all = await nomba.subscriptions.list({ status: 'active' }).toArray(5_000);
```

---

## 16. Metrics

Fetch billing metrics (MRR, churn, dunning funnel) for a window:

```ts
const metrics = await nomba.metrics.billing({
  from: '2026-06-01T00:00:00Z',
  to: '2026-07-01T00:00:00Z',
});
console.log(metrics); // MRR (kobo), active subscriptions, churn rate, dunning funnel
```

---

## 17. Testing — point the SDK at a test key or a local server

Use a `nbo_test_…` key for the sandbox, and override `baseUrl` to hit a locally running instance.

```ts
// Sandbox:
const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_TEST_KEY! }); // "nbo_test_…"

// Local dev server (short timeout, no retries so failures surface immediately):
const local = new Nombaone({
  apiKey: 'nbo_test_local',
  baseUrl: 'http://localhost:4000/v1',
  timeoutMs: 5_000,
  maxRetries: 0,
});

// Liveness probe:
const health = await nomba.health.live(); // { status: "ok" }
```

### Test-mode instruments — drive the engine deterministically

On a **test** key, `nomba.test.*` lets you make renewals, declines, OTP step-ups, and webhook
deliveries happen on demand — no cron wait, no real card. (These throw on a live key.)

```ts
// 1. Mint a deterministic test payment method. `behavior` fixes what every charge does.
const card = await nomba.test.paymentMethods.create({
  customerId: customer.id,
  behavior: 'success', // | 'decline_insufficient_funds' | 'decline_expired_card'
  //         | 'decline_do_not_honor' | 'requires_otp'
});

// 2. Use it like any method — the first charge settles synchronously.
const sub = await nomba.subscriptions.create({
  customerId: customer.id,
  priceId: price.id,
  paymentMethodId: card.id,
});
// sub.status === 'active'  (a decline_* method would leave it past_due, driving dunning)

// 3. Fast-forward billing: force the next cycle now (idempotent per period — no double charge).
const { outcome, invoice } = await nomba.test.subscriptions.advanceCycle(sub.id);
// outcome === 'paid';  invoice.status === 'paid';  invoice.amountPaidInKobo === price.unitAmountInKobo

// 4. Trigger a real, signed webhook delivery to your endpoints on demand.
const sim = await nomba.test.webhooks.simulate({ type: 'invoice.paid' });
console.log(sim.event, sim.deliveredCount); // "nbo…EVT", 1
```

The `requires_otp` behavior exercises the full recovery path — the invoice stays open and an
`invoice.action_required` event fires — so you can test your OTP/dunning handling end to end.

---

## 18. End-to-end: new customer → active subscription → renewal → refund → payout

Ties the pieces together. Steps 1–3 run in your signup flow; step 4 happens in your webhook
receiver on the next cycle; steps 5–6 run in an ops/back-office job.

```ts
import { Nombaone, NombaoneError } from '@nombaone/node';

const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! });

// 1. Catalogue (once, at setup time)
const plan = await nomba.plans.create({ name: 'Pro' });
const price = await nomba.plans.createPrice(plan.id, { unitAmountInKobo: 500_000, interval: 'month' }); // ₦5,000/mo

// 2. Customer + hosted card setup — redirect, capture via webhook
const customer = await nomba.customers.create({ email: 'ada@acme.io', name: 'Ada Payer' });
const setup = await nomba.paymentMethods.setupCard({
  customerId: customer.id,
  amountInKobo: 500_000,
  callbackUrl: 'https://acme.io/return',
});
// → send the customer to setup.checkoutLink; on `payment_method.attached`, grab the payment method id.

// 3. Subscribe once the card is active (idempotent on the signup id)
const sub = await nomba.subscriptions.create(
  { customerId: customer.id, priceId: price.id, paymentMethodId: 'nbo…pmt' },
  `signup:${customer.id}`,
);
console.log(sub.status); // → "active"

// 4. Next cycle: your webhook receiver gets `invoice.paid` → keep access on.
//    If a recharge needs OTP/3DS you get `invoice.action_required` → email the checkoutLink (§9, §12).

// 5. A customer disputes a charge — refund their share of the settlement
const settlement = (await nomba.settlements.list({ status: 'settled' }).page()).data[0];
if (settlement) {
  await nomba.settlements.refund(settlement.id, {}, `refund:${settlement.id}`); // full organization-share refund
}

// 6. Sweep available funds to the bank, respecting the escrow lock
const escrow = await nomba.settlements.escrow();
if (escrow.availableInKobo >= escrow.minWithdrawableInKobo) {
  try {
    await nomba.settlements.payout(
      { amountInKobo: escrow.availableInKobo, bankCode: '058', accountNumber: '0123456789' },
      `payout:${new Date().toISOString().slice(0, 10)}`,
    );
  } catch (err) {
    if (err instanceof NombaoneError && err.code === 'ESCROW_LOCKED') {
      // funds still within the 3h window — retry on the next sweep
    } else throw err;
  }
}
```

---

## Cheat sheet — every namespace at a glance

```ts
nomba.customers      .create · retrieve · update · list · applyDiscount · removeDiscount
                     · grantCredit · creditBalance · voidCredit
nomba.plans          .create · retrieve · update · list · archive · createPrice · listPrices
nomba.prices         .retrieve · list · deactivate
nomba.subscriptions  .create · retrieve · list · update · pause · resume · cancel · resubscribe
                     · change · upcomingInvoice · events · applyDiscount · removeDiscount
                     · schedule · getSchedule · cancelSchedule
                     · dunning · dunningAttempts · updatePaymentMethod
nomba.invoices       .retrieve · list · void
nomba.coupons        .create · retrieve · list · update
nomba.paymentMethods .setupCard · issueVirtualAccount · retrieve · list · setDefault · remove
nomba.mandates       .create · retrieve
nomba.settlements    .list · retrieve · escrow · refund · payout
nomba.organizations  .retrieve · update
nomba.billingSettings.retrieve · update
nomba.webhooks       .create · list · retrieve · update · del · rotateSecret
                     · deliveries.list · deliveries.retrieve · deliveries.replay
                     · constructEvent (signature verification)
nomba.events         .list · retrieve · catalog
nomba.metrics        .billing
nomba.health         .live
```

All amounts are integer kobo. Every id is the `nbo…` reference returned as `.id`. Idempotency is
automatic; pass your own key for cross-restart safety on money-moving calls. Webhooks are
at-least-once — always `constructEvent` to verify, then dedupe on `event.event.id`.
