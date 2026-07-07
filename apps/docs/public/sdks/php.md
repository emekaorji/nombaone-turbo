---
title: "PHP SDK"
type: reference
summary: "The nombaone/nombaone-php SDK: one library for PHP, Laravel, and Symfony. Associative arrays in, typed readonly objects out, with typed exceptions, automatic retries that never double-charge, cursor pagination, and a keyless webhook verifier."
canonical: https://docs.nombaone.xyz/sdks/php
---

# PHP SDK

`nombaone/nombaone-php` is the official SDK for PHP. One library serves plain PHP,
Laravel, and Symfony — you pass associative arrays keyed by the wire names in and
receive typed, readonly objects back, over whatever PSR-18 HTTP client the SDK
discovers. It talks to the same API as every other SDK, so the money behaves
identically wherever you run it.

```bash
composer require nombaone/nombaone-php
```

The SDK requires PHP 8.2+ and any PSR-18 HTTP client with PSR-17 factories, which it
auto-discovers via `php-http/discovery` — Guzzle, Symfony HttpClient, Nyholm, any
implementation works — and it prefers a built-in curl transport when `ext-curl` is
present. Your secret key is read from `NOMBAONE_API_KEY` (or passed to the
constructor); it is server-side only — never ship it to a browser.

```php
use NombaOne\Nombaone; // the client

// Models live in NombaOne\Models\*, exceptions in NombaOne\Exceptions\*,
// and the webhook verifier is NombaOne\Webhooks\Webhooks.
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Money is integer kobo: ₦2,500.00 is `250_000`.

```php
use NombaOne\Nombaone;

$nomba = new Nombaone(getenv('NOMBAONE_API_KEY'));

// 1. Something to sell.
$plan  = $nomba->plans->create(['name' => 'Pro']);
$price = $nomba->plans->prices->create($plan->id, [
    'unitAmountInKobo' => 250_000, // ₦2,500.00
    'interval'         => 'month',
]);

// 2. Someone to bill.
$customer = $nomba->customers->create([
    'email' => 'ada@example.com',
    'name'  => 'Ada Lovelace',
]);

// 3. A way to pay — in the sandbox, mint a deterministic test card.
$method = $nomba->sandbox->createPaymentMethod(['customerId' => $customer->id]);

// 4. The subscription. The engine takes it from here.
$subscription = $nomba->subscriptions->create([
    'customerId'      => $customer->id,
    'priceId'         => $price->id,
    'paymentMethodId' => $method->id,
]);

echo $subscription->status; // "active"
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
`https://api.nombaone.xyz` automatically.

## Constructing the client

```php
new Nombaone(string|array|null $apiKey = null, array $options = [])
```

Pass the key as the first argument, a full options array in its place, or `null` to
fall back to `NOMBAONE_API_KEY`. The constructor throws a `NombaOneException` with an
actionable message when no key resolves, or when the key prefix is unrecognized and
no `baseUrl` is given.

| Option | Default | Meaning |
|---|---|---|
| `apiKey` | `NOMBAONE_API_KEY` env | The secret key. Server-side only. |
| `baseUrl` | derived from key prefix | Override the API origin. Always wins; required for an unrecognized prefix. |
| `timeout` | `30` seconds | Per-attempt timeout. |
| `maxRetries` | `2` (3 attempts) | Retries network failures, timeouts, 408/429/5xx, and in-flight idempotency conflicts. A `POST` retry always reuses its `Idempotency-Key`. |
| `httpClient` | auto-discovered | Bring your own PSR-18 client, for tests, proxies, or instrumentation. |
| `requestFactory` / `streamFactory` | auto-discovered | PSR-17 factories, injected the same way. |

The SDK ships no hard HTTP dependency — it auto-discovers the PSR-18 client and
PSR-17 factories, so you choose the implementation. Read `$nomba->mode`
(`Mode::Sandbox` or `Mode::Live`) and `$nomba->baseUrl` to see where a client points.

## Conventions

- **Money is integer kobo.** ₦1.00 = `100`, money fields end in `InKobo`, and
`currency` is always `"NGN"`. There are no floats or decimal strings for money,
anywhere.
- **camelCase in and out.** Params are associative arrays keyed by the exact
camelCase wire names (`unitAmountInKobo`, `customerId`); the objects you get back
expose the same fields as typed readonly properties (`$customer->email`). Send
only the keys you set, and pass a nullable field as `null` to clear it.
- **Idempotency is automatic.** A UUID `Idempotency-Key` is generated for every
`POST` and reused across automatic retries, so a dropped connection can never
double-charge. On payouts, pass your own stable key (below).
- **IDs are opaque strings** of the form `nbo…` with a type suffix (`…cus`,
`…sub`, `…inv`). Timestamps are ISO-8601 strings; nullable fields are typed `?T`.

Per call, every method takes an optional last argument:

| Field | Meaning |
|---|---|
| `idempotencyKey` | Override the auto-generated key. Required practice on payouts. |
| `headers` | Extra headers; a `null` value removes an SDK default. |
| `timeout` | Per-attempt seconds for this call. |
| `maxRetries` | Retry budget for this call; `0` fails fast. |

## Return values and pagination

Every method is synchronous — it returns the resource, or throws. Each object also
carries its response metadata: `$customer->requestId()` and
`$customer->getLastResponse()` reach the request id and the raw PSR-7 response when
you need headers, status, or rate-limit info.

Every `list()` returns a `NombaOne\Page`. Read one page, thread the cursor yourself
with `nextPage()`, or `foreach` it to stream every item across every page — the
cursors are threaded for you and pages are fetched lazily.

```php
// One page.
$page = $nomba->invoices->list(['status' => 'open', 'limit' => 50]);
$page->data;                   // list<Invoice>
$page->pagination->hasMore;    // bool
$page->pagination->nextCursor; // ?string

// Manual paging — same filters, next cursor threaded.
if ($page->hasNextPage()) {
    $next = $page->nextPage();
}

// Every item across every page — breaking the loop stops fetching.
foreach ($nomba->invoices->list(['status' => 'open']) as $invoice) {
    echo $invoice->id, "\n";
}
// equivalently: $nomba->invoices->list()->autoPagingIterator() — a Generator<Invoice>
```

## Errors

Every error is a typed exception. The base is `NombaOneException` (also thrown for
config mistakes); any non-2xx response is an `ApiException` with a status-specific
subclass, and transport failures are `ConnectionException` / `TimeoutException`. All
live in `NombaOne\Exceptions\`.

An `ApiException` carries `$statusCode`, a machine-readable `$errorCode`, a `$hint`,
a `$docUrl`, an optional `$fields` map (on 422s), and the `$requestId`. The `$hint`
is folded into the message, so the fix arrives with the failure.

| Status | Class | Notes |
|---|---|---|
| 400 | `BadRequestException` | Malformed request. |
| 401 | `AuthenticationException` | Missing, invalid, or wrong-mode key. |
| 403 | `PermissionDeniedException` | Missing scope, or a foreign resource. |
| 404 | `NotFoundException` | Wrong id, or wrong mode. |
| 409 | `ConflictException` | State conflicts, idempotency reuse or in-progress. |
| 422 | `ValidationException` | `$e->fields` has per-field messages. |
| 429 | `RateLimitException` | Adds `$retryAfter`, `$limit`, `$remaining`. |
| 5xx | `ServerException` | Safe to retry — the SDK already did. |

```php
use NombaOne\ErrorCode;
use NombaOne\Exceptions\{ValidationException, RateLimitException, NotFoundException};

try {
    $nomba->subscriptions->create(['customerId' => $customerId, 'priceId' => $priceId]);
} catch (ValidationException $e) {
    $e->fields;                       // ['paymentMethodId' => ['Required']]
} catch (RateLimitException $e) {
    sleep($e->retryAfter ?? 1);       // seconds
} catch (NotFoundException $e) {
    error_log("{$e->errorCode} {$e->requestId}");
}
```

The machine code lives on `$errorCode`, **not** `$code` — PHP's `\Exception`
reserves `$code`. Branch on `$errorCode` or the exception class, never on
`$e->getMessage()`, which may be reworded. Every code and its fix is in the
[error reference](/errors).

## Webhooks

The webhook verifier is `NombaOne\Webhooks\Webhooks`. It needs **no API key** —
construct it standalone with `new Webhooks()`, or reach it as `$nomba->webhooks` —
because a receiver usually holds only the signing secret.

```php
use NombaOne\Webhooks\Webhooks;
use NombaOne\Exceptions\WebhookVerificationException;

$wh = new Webhooks();

try {
    $event = $wh->constructEvent(
        file_get_contents('php://input'),           // 1. the RAW body, never re-serialized
        $_SERVER['HTTP_X_NOMBAONE_SIGNATURE'] ?? '',
        getenv('NOMBAONE_WEBHOOK_SECRET'),          // shown once at endpoint creation
    );
} catch (WebhookVerificationException $e) {
    http_response_code(400);
    exit;
}

if (alreadyProcessed($event->event->id)) {          // 2. dedupe on the event id
    http_response_code(200);
    exit;
}

match ($event->type) {                              // 3. branch on the type
    'invoice.paid'            => unlock($event->data['reference']),
    'invoice.action_required' => send($event->data['checkoutLink'] ?? null),
    'invoice.payment_failed'  => note($event->data['reason'] ?? null),
    default                   => null,
};

http_response_code(200); // respond 2xx fast; do the work async
```

Three rules the SDK enforces: feed the **raw** body (`file_get_contents('php://input')`
in plain PHP, `$request->getContent()` in Laravel or Symfony — never a parsed body);
verify before you parse; and **dedupe on `$event->event->id`**, because delivery is
at-least-once. See [signing and verification](/webhooks/signing-and-verification)
for the signature scheme.

## The sandbox toolkit

Every `$nomba->sandbox` method is sandbox-only and throws locally, before any
network call, if the client holds a live key.

```php
// A deterministic test method — no real card.
$method = $nomba->sandbox->createPaymentMethod([
    'customerId' => $customer->id,
    'behavior'   => 'decline_insufficient_funds', // a thin balance: "not yet", not "no"
]);

// The test clock — run the next billing cycle through the real engine, now.
$cycle = $nomba->sandbox->advanceCycle($subscription->id);
echo $cycle->outcome; // "past_due"

// Fire a real, signed webhook at your registered endpoints.
$nomba->sandbox->simulateWebhook(['type' => 'invoice.paid']);
```

The behaviors are `success` (default), `decline_insufficient_funds`,
`decline_expired_card`, `decline_do_not_honor`, and `requires_otp`. The sandbox
sends no organic webhooks — `simulateWebhook` is how you rehearse a handler. See
the [sandbox toolkit](/sandbox-toolkit/overview) for the full story.

## The honest hard parts

We would rather you learn these now than discover them at 2am.

> **The machine error code is $errorCode, not $code**
>
> PHP's `\Exception` already reserves `$code`, so the stable, branchable error code
> lives on `$errorCode`. Read `$e->errorCode` (a string like `CUSTOMER_NOT_FOUND`) —
> `$e->getCode()` is not it.

- **Two methods return a `PaymentMethod`.** `subscriptions->updatePaymentMethod`
returns the updated `PaymentMethod`, and `mandates->retrieve` returns a
`PaymentMethod` too — a mandate's standing lives on the payment-method row. That
is what the wire carries; the types say so.
- **A no-body `POST` sends `{}`.** The transport guards against PHP serializing an
empty map as `[]` (a JSON array), which the API rejects — so bodyless calls like
`subscriptions->resume` or `plans->archive` always send a valid `{}`.
- **Mandates activate asynchronously.** After `mandates->create`, relay
`MandateSetup->consentInstruction`, wait for the `payment_method.updated` webhook,
and do not charge early. On the deployed sandbox, creating a mandate can currently
return a `504` from the NIBSS upstream; it surfaces as a `ServerException`, so
pass `['maxRetries' => 0]` to fail fast while that upstream is down.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not
yet." Read `subscriptions->dunning->retrieve()` and honor `graceAccessUntil`
before cutting access. Involuntary churn ends as `canceled` with
`cancellationReason: 'involuntary'` — there is no `churned` status (there is a
`subscription.churned` event).
- **Prices are immutable, plans archive.** To change pricing, deactivate the price
and create a new one; plans archive rather than delete.

## Next

- **[Method reference](/sdks/php/reference)**: 
Every method in the SDK, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
