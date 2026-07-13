---
title: "Bill a gym membership"
type: reference
summary: "Iron Republic gym, end to end: connect your Nomba account, one plan with three prices, members joining through hosted checkout, silent card renewals with an honest OTP fallback, transfer memberships on the invoice lane, and dunning that recovers before it churns."
canonical: https://docs.nombaone.xyz/cookbook/bill-a-gym-membership
---

# Bill a gym membership

**Iron Republic** is a gym in Surulere. Members pay monthly or yearly; they join
at the front desk or from the website; some pay by card, plenty pay by bank
transfer. Nobody at the gym wants to store card details, chase renewals over
WhatsApp, or reconcile transfers against a spreadsheet.

This recipe wires the whole membership lifecycle:

1. connect the gym's **Nomba account**, so collections settle,
2. one **plan** with three prices (monthly, yearly, and a ten-minute rehearsal
cadence for the sandbox),
3. a member joining through **hosted checkout** — no card details touch your code,
4. **silent card renewals**, with the honest OTP fallback when a bank steps in,
5. the **invoice lane** for members who pay by transfer,
6. **dunning** that recovers a missed renewal before it churns the member.

Every call runs against the sandbox with an `nbo_sandbox_…` key; swap in an
`nbo_live_…` key and the same code collects real money. The Node samples use
[`@nombaone/node`](/sdks/node) 0.1.5 or later.

## 0 · Where the money goes

There is nothing to connect. Your organization has a settlement balance from the
moment you sign up: every payment a member makes is split into our platform fee
and **your share**, and your share accrues to a balance you own.

You only have to tell us one thing, and only when you want the money out — the
bank account to pay it into. We confirm it with your bank before we save it, so
the name on the account comes from the bank rather than from a form:

```bash
# what does the bank say this account number belongs to?
curl -X POST https://sandbox.api.nombaone.xyz/v1/payout-accounts/resolve \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "bankCode": "000013", "bankName": "GTBank", "accountNumber": "0123456789" }'

# → { "accountName": "IRON REPUBLIC GYM LTD" }  ← confirm this is you, then save it
curl -X POST https://sandbox.api.nombaone.xyz/v1/payout-accounts \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "bankCode": "000013", "bankName": "GTBank", "accountNumber": "0123456789" }'
```

Pick the bank from `GET /v1/banks` rather than typing a code from memory.

From then on your balance sweeps to that account **once a day, automatically**.
If you want it sooner, `POST /v1/settlements/payout` pays out on demand — note
that it takes no destination, because the money can only ever go to the account
your bank already confirmed.

You can skip this section entirely and come back to it. Billing works without a
payout account; you simply can't withdraw yet, and nothing is lost in the
meantime.

## 1 · One plan, three prices

Iron Republic sells one membership at two real cadences, plus a **rehearsal
price** that renews every ten minutes — `interval: "minute"` is a first-class
wall-clock cadence, and it is how you will watch a whole renewal cycle happen
during this recipe instead of waiting a month. Amounts are
**integer kobo**: ₦25,000.00 is `2500000`.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "Iron Republic membership",
    "prices": [
      { "unitAmountInKobo": 2500000,  "interval": "month" },
      { "unitAmountInKobo": 25000000, "interval": "year" },
      { "unitAmountInKobo": 50000,    "interval": "minute", "intervalCount": 10 }
    ]
  }'
```

**Node.js**

```ts
import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

const plan = await nombaone.plans.create({ name: 'Iron Republic membership' });

const monthly = await nombaone.plans.prices.create(plan.id, {
  unitAmountInKobo: 2_500_000, // ₦25,000.00
  interval: 'month',
});
const yearly = await nombaone.plans.prices.create(plan.id, {
  unitAmountInKobo: 25_000_000, // ₦250,000.00
  interval: 'year',
});
// Sandbox rehearsal cadence: a real renewal every ten minutes.
const rehearsal = await nombaone.plans.prices.create(plan.id, {
  unitAmountInKobo: 50_000, // ₦500.00
  interval: 'minute',
  intervalCount: 10,
});
```

The API accepts up to ten inline `prices` on the plan create; the SDK adds them
one call at a time. Either way you end with one plan and three price ids — see
[create plans and prices](/guides/create-plans-and-prices) for trials, tiers,
and the cadence rules.

## 2 · A member walks in

A **customer** is the member. Email and name are enough — the email is where
renewal reminders and payment links land later.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/customers \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "email": "tobi@example.com", "name": "Tobi Adeyemi" }'
```

**Node.js**

```ts
const member = await nombaone.customers.create({
  email: 'tobi@example.com',
  name: 'Tobi Adeyemi',
});
```

## 3 · They join through hosted checkout

Here is the move this recipe is built around: create the subscription with
**no `paymentMethodId`**. On a `charge_automatically` create with no trial,
that is the hosted-checkout entry — the subscription starts `incomplete` and
the response carries a `checkoutLink`, a Nomba-hosted payment page where the
member pays by **card or bank transfer**, their choice. Card details never
touch your code.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerId": "{customerId}",
    "priceId": "{monthlyPriceId}",
    "callbackUrl": "https://ironrepublic.example/joined"
  }'
```

**Node.js**

```ts
const subscription = await nombaone.subscriptions.create({
  customerId: member.id,
  priceId: monthly.id,
  callbackUrl: 'https://ironrepublic.example/joined',
});

// subscription.status → "incomplete"
if (subscription.checkoutLink) redirect(subscription.checkoutLink);
```

```json
{
  "success": true,
  "data": {
    "id": "nbo…sub",
    "status": "incomplete",
    "collectionMethod": "charge_automatically",
    "checkoutLink": "https://checkout…"
  }
}
```

Redirect the member to `checkoutLink`; after paying they return to your
`callbackUrl`. What paying does depends on how they paid:

- **Card** — the membership activates and the engine captures a reusable card
token, so future renewals can charge silently.
- **Bank transfer** — the money is real but a transfer leaves no token to
charge later, so the engine flips the subscription to `send_invoice`: every
future cycle issues an invoice with a payment link instead of pulling. That
member lives on the [invoice lane](#6--the-transfer-member-the-invoice-lane)
below, automatically.
- **Nobody pays** — the subscription expires to `incomplete_expired`. Nothing
is owed, nothing retries.

> **When there is no checkoutLink**
>
> The hosted-checkout entry is specifically the *pay-now* path: a
> `charge_automatically` create with no trial and no payment method. A trial
> create or a `send_invoice` create has nothing to pay at creation, so it
> returns no `checkoutLink`. If you already hold an authorized payment method,
> pass `paymentMethodId` and skip checkout entirely — see
> [start a subscription](/guides/start-a-subscription).

## 4 · Know the moment they're in

Don't poll for the activation — receive it. Register a webhook endpoint for
the events this lifecycle emits:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/webhooks \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ironrepublic.example/webhooks/nombaone",
    "enabledEvents": [
      "subscription.activated",
      "invoice.paid",
      "invoice.payment_failed",
      "invoice.action_required",
      "invoice.payment_instructions",
      "invoice.payment_recovered",
      "subscription.churned"
    ]
  }'
```

Verify the signature, dedupe on the event id, and branch — the SDK's
[webhook helper](/webhooks/signing-and-verification) does the cryptography:

```ts
import { webhooks, WebhookVerificationError } from '@nombaone/node';

export async function POST(req: Request) {
  let event;
  try {
    event = webhooks.constructEvent(
      await req.text(), // the RAW body, never re-serialized
      req.headers.get('x-nombaone-signature') ?? '',
      process.env.NOMBAONE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    if (err instanceof WebhookVerificationError) return new Response(null, { status: 400 });
    throw err;
  }

  switch (event.type) {
    case 'subscription.activated':      grantGymAccess(event.data.reference); break;
    case 'invoice.action_required':     sendMember(event.data.checkoutLink);  break;
    case 'invoice.payment_instructions': noteTransferPending(event.data);     break;
    case 'subscription.churned':        revokeGymAccess(event.data.reference); break;
  }
  return new Response(null, { status: 200 });
}
```

`subscription.activated` is your "unlock the turnstile" moment.
`subscription.churned` — much later, only after dunning has genuinely given
up — is the moment to lock it again.

## 5 · Renewals, honestly

For a card member, each cycle the engine invoices and charges the captured
token — the member does nothing, you receive `invoice.paid`, access continues.
Before each renewal the engine can also email the member a heads-up (the
`renewalReminderLeadHours` billing setting, capped at one period; all member
emails are gated by the `commsEnabled` billing setting).

The honest part: **a Nigerian bank can refuse to be silent.** Some banks
step in on a recurring card charge and demand a fresh OTP from the cardholder,
and no billing engine can type it for them. When that happens the engine does
not fail the membership — it emits `invoice.action_required` carrying a fresh
hosted-checkout link (and emails it to the member). The member taps the link,
completes the OTP, the invoice settles, and the subscription recovers. Forward
that link the moment you see the event; it is the difference between a renewal
and a churn.

## 6 · The transfer member: the invoice lane

The member who paid their first cycle by transfer is now on
`collectionMethod: "send_invoice"`. Each cycle the engine issues an invoice
that knows how to get itself paid:

- a real `dueDate` (your grace period, capped at one billing period),
- a stamped hosted-checkout link, emailed to the member,
- and `payInstructions` — a virtual account (NUBAN) dedicated to **this
invoice**, so a plain bank transfer reconciles itself to the right member
with no spreadsheet,
- plus an `invoice.payment_instructions` webhook so your own app can show the
same details.

```bash
curl "https://sandbox.api.nombaone.xyz/v1/invoices?subscriptionId={subscriptionId}&status=open" \
  -H "Authorization: Bearer nbo_sandbox_…"
```

```json
{
  "id": "nbo…inv",
  "status": "open",
  "amountDueInKobo": 2500000,
  "dueDate": "2026-08-12T09:00:00.000Z",
  "payInstructions": {
    "bankName": "Amucha MFB",
    "accountNumber": "1214847596",
    "accountName": "Iron Republic / Tobi A.",
    "amountInKobo": 2500000,
    "reference": "nbo…inv"
  }
}
```

## 7 · When they don't pay

A card renewal that fails, or an invoice that passes its `dueDate`, moves the
subscription to `past_due` and hands it to
[dunning](/guides/dunning-and-recovery). The two lanes recover differently:

- **Card (pull)** — the engine retries the charge on a cadence biased toward
Nigerian paydays, because a failed gym debit usually means "not yet," not
"no."
- **Transfer (push)** — there is nothing to retry-charge, so dunning runs
`payment_reminder`: it re-sends the payment link and transfer details on the
same ladder instead. The member pays when the balance lands.

When the money arrives — either lane — `invoice.payment_recovered` fires and
the subscription re-anchors: **the next period starts from the recovery**, so
a member who was locked out for a week is not billed for the week they never
trained. No back-billing, no double charge, no awkward front-desk argument.

If every attempt exhausts, the engine emits `subscription.churned` — the
involuntary-churn signal, distinct from a member who deliberately canceled
(`subscription.canceled`). Only then do you revoke access. Watch the loop run:

```bash
curl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/dunning \
  -H "Authorization: Bearer nbo_sandbox_…"
```

## 8 · Rehearse the whole loop before launch day

You already created the rehearsal price. Put a member on it and a full
renewal happens, for real, every ten minutes — invoice, collection, webhook,
email. Too slow? Skip the wait entirely:

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/subscriptions/{id}/advance-cycle \
  -H "Authorization: Bearer nbo_sandbox_…"
```

**Node.js**

```ts
await nombaone.sandbox.advanceCycle(subscription.id);
```

To rehearse the unhappy paths, mint a deterministic
[sandbox payment method](/sandbox-toolkit/payment-methods) —
`decline_insufficient_funds` walks you through dunning to
`subscription.churned`; `requires_otp` fires the `invoice.action_required`
branch — before a single real member is involved.

## Where to go next

- **[Dunning and recovery](/guides/dunning-and-recovery)**: 
Operate the recovery loop: policies, the payday bias, and the events.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Verify, dedupe, and branch on events without double-crediting.
- **[Start a subscription](/guides/start-a-subscription)**: 
Every entry path: hosted checkout, card on file, mandate, transfer.
- **[Event catalog](/webhooks/event-catalog)**: 
Every event this recipe mentioned, with its exact payload.
