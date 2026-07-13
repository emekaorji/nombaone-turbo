---
title: "Node.js & TypeScript SDK"
type: reference
summary: "The @nombaone/node SDK: one TypeScript-first library for Node, Next.js, and every JS runtime. Typed errors, automatic retries that never double-charge, cursor pagination, and a fully-typed webhook event union."
canonical: https://docs.nombaone.xyz/sdks/node
---

# Node.js & TypeScript SDK

`@nombaone/node` is the official SDK for Node.js and TypeScript. One library serves
every JS runtime and framework — Node, Next.js, Remix, Nuxt, Express, Hono, Bun,
Astro, and serverless — with complete types, zero dependencies, and a webhook
verifier. It talks to the same API as every other SDK, so the money behaves
identically wherever you run it.

```bash
npm install @nombaone/node
# pnpm add @nombaone/node · yarn add @nombaone/node · bun add @nombaone/node
```

The SDK is ESM and CommonJS, ships complete `.d.ts` types, and depends only on the
global `fetch` and `node:crypto`. Your secret key is read from `NOMBAONE_API_KEY`
(or passed to the constructor); it is server-side only — never ship it to a browser.

```ts
import Nombaone from '@nombaone/node';          // default export: the client
import { webhooks, ValidationError } from '@nombaone/node'; // named exports
// CommonJS: const Nombaone = require('@nombaone/node').default;
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Money is integer kobo: ₦2,500.00 is `250_000`.

```ts
import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

// 1. Something to sell.
const plan = await nombaone.plans.create({ name: 'Pro' });
const price = await nombaone.plans.prices.create(plan.id, {
  unitAmountInKobo: 250_000, // ₦2,500.00
  interval: 'month',
});

// 2. Someone to bill.
const customer = await nombaone.customers.create({
  email: 'ada@example.com',
  name: 'Ada Lovelace',
});

// 3. A way to pay — in the sandbox, mint a deterministic test card.
const method = await nombaone.sandbox.createPaymentMethod({ customerId: customer.id });

// 4. The subscription. The engine takes it from here.
const subscription = await nombaone.subscriptions.create({
  customerId: customer.id,
  priceId: price.id,
  paymentMethodId: method.id,
});

console.log(subscription.status); // "active"
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
`https://api.nombaone.xyz` automatically.

## Constructing the client

```ts
new Nombaone(apiKey?: string | NombaoneOptions, options?: NombaoneOptions)
```

Pass the key as the first argument, or a single options object. The constructor
throws a `NombaoneError` with an actionable message when no key resolves, or when
the key prefix is unrecognized and no `baseUrl` is given.

| Option | Default | Meaning |
|---|---|---|
| `apiKey` | `process.env.NOMBAONE_API_KEY` | The secret key. Server-side only. |
| `baseUrl` | derived from key prefix | Override the API origin. Always wins; required for an unrecognized prefix. |
| `timeout` | `30_000` ms | Per-attempt timeout. |
| `maxRetries` | `2` (3 attempts) | Retries network failures, timeouts, 408/429/5xx, and in-flight idempotency conflicts. A `POST` retry always reuses its `Idempotency-Key`. |
| `fetch` | `globalThis.fetch` | Bring your own fetch, for tests, proxies, or instrumentation. |
| `defaultHeaders` | — | Headers sent on every request. |

Read `nombaone.mode` (`'sandbox' | 'live'`) and `nombaone.baseUrl` to see where a
client points. The exported `BASE_URLS` constant holds both hosts.

## Conventions

- **Money is integer kobo.** `Kobo = number`, ₦1.00 = `100`, money fields end in
`InKobo`, and `currency` is always `"NGN"`. There are no floats or decimal
strings for money, anywhere.
- **Idempotency is automatic.** A UUID `Idempotency-Key` is generated for every
`POST` and reused across automatic retries, so a dropped connection can never
double-charge. On payouts, pass your own stable key (below).
- **IDs are opaque strings** of the form `nbo…` with a type suffix (`…cus`,
`…sub`, `…inv`). Timestamps are ISO-8601 strings; nullable fields are typed
`T | null`.

Per call, every method takes an optional last argument:

| Field | Meaning |
|---|---|
| `idempotencyKey` | Override the auto-generated key. Required practice on payouts. |
| `headers` | Extra headers; a `null` value removes an SDK default. |
| `signal` | An `AbortSignal`; an aborted call is never retried. |
| `timeout` | Per-attempt milliseconds for this call. |
| `maxRetries` | Retry budget for this call; `0` fails fast. |

## Return values and pagination

Every non-list method returns an `APIPromise` — `await` it for the resource, or
call `.withResponse()` for `{ data, requestId, response }` when you need the raw
`Response` (headers, status, rate-limit info).

Every `list()` returns a `PagePromise`. Await it for one `Page`, or `for
await` it directly to stream every item across every page — the cursors are
threaded for you.

```ts
// One page.
const page = await nombaone.invoices.list({ status: 'open', limit: 50 });

// Manual paging.
if (page.hasNextPage()) {
  const next = await page.nextPage();
}

// Every item across every page — breaking the loop stops fetching.
for await (const invoice of nombaone.invoices.list({ status: 'open' })) {
  console.log(invoice.id);
}

// The request id + raw response, when you need them.
const { data, requestId } = await nombaone.customers.retrieve(id).withResponse();
```

## Errors

Every error is typed. The base is `NombaoneError` (also thrown for config
mistakes); any non-2xx response is an `APIError` with a status-specific subclass,
and transport failures are `ConnectionError` / `TimeoutError`.

An `APIError` carries `statusCode`, a machine-readable `code`, a `hint`, a
`docUrl`, an optional `fields` map (on 422s), and the `requestId`. The `hint` is
baked into `error.message`, so the fix arrives with the failure.

| Status | Class | Notes |
|---|---|---|
| 400 | `BadRequestError` | Malformed request. |
| 401 | `AuthenticationError` | Missing, invalid, or wrong-environment key. |
| 403 | `PermissionDeniedError` | Missing scope, or a foreign resource. |
| 404 | `NotFoundError` | Wrong id, or wrong environment. |
| 409 | `ConflictError` | State conflicts, idempotency reuse or in-progress. |
| 422 | `ValidationError` | `err.fields` has per-field messages. |
| 429 | `RateLimitError` | Adds `retryAfter` (seconds), `limit`, `remaining`. |
| 5xx | `ServerError` | Safe to retry — the SDK already did. |

```ts
import { NotFoundError, RateLimitError, ValidationError } from '@nombaone/node';

try {
  await nombaone.subscriptions.create({ customerId, priceId });
} catch (err) {
  if (err instanceof ValidationError) console.log(err.fields);    // { paymentMethodId: [...] }
  if (err instanceof RateLimitError) console.log(err.retryAfter); // seconds
  if (err instanceof NotFoundError) console.log(err.code, err.requestId);
}
```

Branch on `err.code` or `instanceof` — never on `err.message`, which may be
reworded. Every code and its fix is in the [error reference](/errors).

## Webhooks

The webhook verifier is available as `nombaone.webhooks` and, importantly, as a
standalone import that needs **no API key** — a receiver usually holds only the
signing secret.

```ts
import express from 'express';
import { webhooks, WebhookVerificationError } from '@nombaone/node';

const app = express();

app.post('/nombaone/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = webhooks.constructEvent(
      req.body,                                  // 1. the RAW body, never re-serialized
      req.header('x-nombaone-signature') ?? '',
      process.env.NOMBAONE_WEBHOOK_SECRET!,      // shown once at endpoint creation
    );
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.status(400).send('bad signature');
    throw err;
  }

  if (alreadyProcessed(event.event.id)) return res.sendStatus(200); // 2. dedupe on the event id

  switch (event.type) {                          // 3. fully typed — data narrows on type
    case 'invoice.paid':            unlock(event.data.reference); break;
    case 'invoice.action_required': send(event.data.checkoutLink); break;
    case 'invoice.payment_failed':  note(event.data.reason); break;
  }

  res.sendStatus(200); // respond 2xx fast; do the work async
});
```

Three rules the SDK enforces: feed the **raw** body (Express `express.raw`,
Next.js route handlers `await req.text()`, Hono `await c.req.text()`); verify
before you parse; and **dedupe on `event.event.id`**, because delivery is
at-least-once. The event is a closed discriminated union, so `switch (event.type)`
fully types `event.data`. See [signing and verification](/webhooks/signing-and-verification)
for the signature scheme.

## The sandbox toolkit

Every `nombaone.sandbox` method is sandbox-only and throws locally, before any
network call, if the client holds a live key.

```ts
// A deterministic test method — no real card.
const method = await nombaone.sandbox.createPaymentMethod({
  customerId: customer.id,
  behavior: 'decline_insufficient_funds', // a thin balance: "not yet", not "no"
});

// The test clock — run the next billing cycle through the real engine, now.
const cycle = await nombaone.sandbox.advanceCycle(subscription.id);
console.log(cycle.outcome); // "past_due"

// Fire a real, signed webhook at your registered endpoints.
await nombaone.sandbox.simulateWebhook({ type: 'invoice.paid' });
```

The behaviors are `success` (default), `decline_insufficient_funds`,
`decline_expired_card`, `decline_do_not_honor`, and `requires_otp`. The sandbox
sends no organic webhooks — `simulateWebhook` is how you rehearse a handler. See
the [sandbox toolkit](/sandbox-toolkit/overview) for the full story.

## Every framework, one SDK

There are no framework-specific SDKs, because there is no need for one. The same
client runs in Node, Next.js, Remix, Nuxt, Express, Hono, Redwood, Bun, Astro, and
serverless (Vercel, Cloudflare Workers, Deno, AWS Lambda). The only framework
difference is how you capture the **raw** webhook body — `express.raw` on Express,
`await req.text()` in a Next.js route handler, `await c.req.text()` on Hono.

## The honest hard parts

We would rather you read these here than discover them at 2am.

> **Two methods return a PaymentMethod, not what you'd guess**
>
> `subscriptions.updatePaymentMethod` returns the updated `PaymentMethod`, and
> `mandates.retrieve` returns a `PaymentMethod` too (a mandate's standing lives on
> the payment-method row). That is what the wire carries — the types say so.

- **Mandates activate asynchronously.** After `mandates.create`, wait for the
`payment_method.updated` webhook — do not poll, and do not charge early. On the
deployed sandbox, `POST /mandates` can currently return a `504` from the NIBSS
upstream; it surfaces as a `ServerError`, so pass `{ maxRetries: 0 }` to fail
fast while that upstream is down.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not
yet." Honor `graceAccessUntil` on the dunning state and keep access on until it
passes. Involuntary churn ends as `canceled` with `cancellationReason:
'involuntary'` — there is no `churned` status (there is a `subscription.churned`
event).
- **Prices are immutable, plans archive.** To change pricing, deactivate the price
and create a new one; plans archive rather than delete.
- **Withdrawing needs a bank account.** Every organization has a settlement balance
from day one, but a payout has nowhere to go until you add the bank account you want
to be paid into. Until then, escrow and payout return a typed `PAYOUT_ACCOUNT_MISSING`
— a real business state whose `hint` explains itself.

## Next

- **[Method reference](/sdks/node/reference)**: 
Every method in the SDK, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
