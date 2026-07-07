---
title: "Java SDK"
type: reference
summary: "One thread-safe, synchronous SDK for Java, Kotlin, and Spring — integer-kobo money, unchecked typed errors, automatic retries that never double-charge, auto-paginating lists, and a sealed webhook event union, with Jackson as its only dependency."
canonical: https://docs.nombaone.xyz/sdks/java
---

# Java SDK

`xyz.nombaone:nombaone` is the official SDK for the JVM — one library for Java,
Kotlin, and Spring. It is thread-safe and synchronous: build one `Nombaone` client
at startup and reuse it across every request and thread. It carries a single
runtime dependency (Jackson), talks to the same API as every other SDK, and
derives its host from the key prefix — so the money behaves identically wherever
you run it.

Add the dependency with Gradle:

```groovy
implementation("xyz.nombaone:nombaone:0.1.0")
```

Or with Maven:

```xml
<dependency>
  <groupId>xyz.nombaone</groupId>
  <artifactId>nombaone</artifactId>
  <version>0.1.0</version>
</dependency>
```

The SDK requires Java 17+ (JPMS automatic module `xyz.nombaone`). Your secret key
is read from `NOMBAONE_API_KEY` (or passed to the constructor); it is server-side
only — never ship it to a browser.

```java
import xyz.nombaone.Nombaone;

// Build once, reuse everywhere — the client is thread-safe.
Nombaone nombaone = new Nombaone(System.getenv("NOMBAONE_API_KEY"));
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Money is integer kobo, typed `long`: ₦2,500.00
is `250_000L`.

```java
import xyz.nombaone.Nombaone;

Nombaone nombaone = new Nombaone(System.getenv("NOMBAONE_API_KEY"));

// 1. Something to sell.
Plan plan = nombaone.plans().create(
    PlanCreateParams.builder().name("Pro").build());

Price price = nombaone.plans().prices().create(plan.id(),
    PriceCreateParams.builder()
        .unitAmountInKobo(250_000L) // ₦2,500.00
        .interval(PriceInterval.MONTH)
        .build());

// 2. Someone to bill.
Customer customer = nombaone.customers().create(
    CustomerCreateParams.builder()
        .email("ada@example.com")
        .name("Ada Lovelace")
        .build());

// 3. A way to pay — in the sandbox, mint a deterministic test card.
PaymentMethod method = nombaone.sandbox().createPaymentMethod(
    SandboxPaymentMethodParams.builder().customerId(customer.id()).build());

// 4. The subscription. The engine takes it from here.
Subscription subscription = nombaone.subscriptions().create(
    SubscriptionCreateParams.builder()
        .customerId(customer.id())
        .priceId(price.id())
        .paymentMethodId(method.id())
        .build());

System.out.println(subscription.status()); // ACTIVE
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
`https://api.nombaone.xyz` automatically.

## Constructing the client

The constructor has four overloads. Pass the key explicitly, hand it a
`ClientOptions`, or let both resolve from the environment.

```java
new Nombaone();                              // key from NOMBAONE_API_KEY
new Nombaone(String apiKey);                 // explicit key
new Nombaone(ClientOptions options);         // key from options.apiKey() or env
new Nombaone(String apiKey, ClientOptions options);
```

The key resolves in the order argument → `options.apiKey()` → `NOMBAONE_API_KEY`.
The constructor throws a `NombaoneException` with an actionable message when no key
resolves, or when the key prefix is unrecognized and no `baseUrl` is given.

```java
import java.time.Duration;

Nombaone nombaone = new Nombaone(apiKey, ClientOptions.builder()
    .baseUrl("https://sandbox.api.nombaone.xyz") // override the derived host
    .timeout(Duration.ofSeconds(30))             // per-attempt timeout
    .maxRetries(2)                               // 3 attempts total
    .httpTransport(transport)                    // advanced: swap the HTTP layer
    .defaultHeader("X-My-App", "acme/1.0")       // sent on every request
    .build());
```

| Builder method | Default | Meaning |
|---|---|---|
| `apiKey(String)` | `NOMBAONE_API_KEY` | The secret key. Server-side only. |
| `baseUrl(String)` | derived from key prefix | Override the API origin. Required for an unrecognized prefix. |
| `timeout(Duration)` | 30s | Per-attempt timeout, not whole-call. |
| `maxRetries(int)` | 2 | Total attempts = `maxRetries + 1`. Retries transport failures, timeouts, 408/429/5xx, and in-flight idempotency conflicts. |
| `httpTransport(HttpTransport)` | JDK `HttpClient` | Bring your own transport, for tests, proxies, or instrumentation. |
| `defaultHeader(String, String)` | — | Headers sent on every request. |

Read `nombaone.mode()` (`Mode.SANDBOX` or `Mode.LIVE`) and `nombaone.baseUrl()`
(no `/v1`) to see where a client points. The `Nombaone.SANDBOX_BASE_URL` and
`Nombaone.LIVE_BASE_URL` constants hold both hosts.

## Conventions

- **Money is integer kobo.** ₦1.00 = `100`, money fields are typed `long` (or
`Long` when optional) and end in `InKobo`, and `currency` is always `"NGN"`.
There are no floats or `BigDecimal` for money, anywhere — `250_000L` is ₦2,500.
- **Idempotency is automatic.** A UUID `Idempotency-Key` is generated for every
`POST` and reused across automatic retries, so a dropped connection can never
double-charge. On `settlements().createPayout(...)`, pass your own stable key —
it doubles as the durable `merchantTxRef`, so a retry from a fresh process can't
create a second payout.
- **IDs are opaque `String`s** of the form `nbo…` with a three-letter type suffix
(`…cus`, `…sub`, `…inv`). Timestamps are ISO-8601 UTC strings, left unparsed;
`metadata` is a `Map<String, Object>`.

Every method takes an optional trailing `RequestOptions`
(`RequestOptions.none()` is the shared empty instance):

| Field | Meaning |
|---|---|
| `idempotencyKey(String)` | Override the auto-generated key (POST only). Required practice on payouts. |
| `header(String, String)` | Extra headers; a `null` value strips an SDK default. |
| `timeout(Duration)` | Per-attempt timeout for this call. |
| `maxRetries(int)` | Retry budget for this call; `0` fails fast. |
| `onResponse(Consumer)` | Receive the raw `ResponseInfo` — status, request id, headers — on success. |

To cancel a blocking call, interrupt the calling thread; a cancellation is never
retried.

## Return values and pagination

The client is synchronous: every non-list method blocks and returns the unwrapped
resource directly (the `{success, data, meta}` envelope is unwrapped for you).
Every `list(...)` returns a `Page`.

```java
// One page.
Page<Invoice> page = nombaone.invoices().list(
    InvoiceListParams.builder().status(InvoiceStatus.OPEN).limit(50).build());
page.data();        // List<Invoice>
page.pagination();  // PageInfo{ limit, hasMore, nextCursor }

// Manual paging.
if (page.hasNextPage()) {
  Page<Invoice> next = page.nextPage();
}

// Every item across every page — cursors threaded, filters preserved.
for (Invoice invoice : nombaone.invoices().list().autoPager()) {
  System.out.println(invoice.id());
}

// Or as a Stream.
nombaone.invoices().list().stream().forEach(this::index);
```

`autoPager()` is an `Iterable` and `stream()` is a `Stream`; both fetch pages
lazily as you consume them. Paging is cursor-only and forward-only, with no total
counts — `limit` is 1–100. For the request id and raw headers of any call, pass
`RequestOptions.onResponse(...)`.

Every enum is **open**: an unknown wire value the API adds tomorrow deserializes to
`UNKNOWN` rather than throwing, so a new status never breaks a running client.
Branch on the constants you know and handle `UNKNOWN` as a default.

## Errors

Every failure throws an **unchecked** exception extending
`xyz.nombaone.error.NombaoneException` (also thrown for config mistakes). Any
non-2xx response is an `ApiException` carrying `statusCode()`, a machine-readable
`code()`, a `hint()`, a `docUrl()`, a `fields()` map (on 422s), and a
`requestId()`. The `hint` is folded into `getMessage()`, so the fix arrives with
the failure. Transport failures are `ConnectionException` / `TimeoutException`;
webhook verification failures are `WebhookVerificationException`.

| Status | Exception | Notes |
|---|---|---|
| 400 | `BadRequestException` | Malformed request. |
| 401 | `AuthenticationException` | Missing, invalid, or wrong-mode key (sandbox vs live). |
| 403 | `PermissionDeniedException` | Missing scope, or a foreign resource. |
| 404 | `NotFoundException` | Wrong id, or wrong mode. |
| 409 | `ConflictException` | State conflicts, idempotency reuse or in-progress. |
| 422 | `ValidationException` | `fields()` has per-field messages. |
| 429 | `RateLimitException` | Adds `retryAfter()`, `limit()`, `remaining()`. |
| ≥500 | `ServerException` | Safe to retry — the SDK already did. |

```java
try {
  nombaone.subscriptions().create(params);
} catch (ValidationException e) {
  e.fields().forEach((field, msgs) -> log.warn("{}: {}", field, msgs));
} catch (RateLimitException e) {
  e.retryAfter().ifPresent(this::backoff);      // seconds
} catch (NotFoundException e) {
  log.error("{} {}", e.code(), e.requestId().orElse("-"));
}
```

Branch on the exception subclass or `e.code()` — never on `e.getMessage()`, which
may be reworded. Every code and its fix is in the [error reference](/errors).

## Webhooks

The verifier is available as `nombaone.webhooks()` and, importantly, as a
standalone `new xyz.nombaone.webhook.Webhooks()` that needs **no API key** — a
receiver usually holds only the signing secret, so it can depend on the webhook
package alone.

```java
import xyz.nombaone.webhook.Webhooks;

private final Webhooks webhooks = new Webhooks(); // no key needed

@PostMapping("/nombaone/webhooks")
ResponseEntity<String> handle(
    @RequestBody byte[] rawBody,                        // 1. the RAW bytes, never re-serialized
    @RequestHeader("X-Nombaone-Signature") String signature) {

  WebhookEvent event;
  try {
    event = webhooks.constructEvent(                    // 2. verify before you parse
        rawBody, signature, System.getenv("NOMBAONE_WEBHOOK_SECRET"));
  } catch (WebhookVerificationException e) {
    return ResponseEntity.badRequest().body("bad signature");
  }

  if (alreadyProcessed(event.event().id())) {          // 3. dedupe on the event id
    return ResponseEntity.ok().build();
  }

  if (event instanceof InvoiceActionRequiredEvent e) {
    send(e.data().checkoutLink());
  } else if (event instanceof InvoicePaymentFailedEvent e) {
    note(e.data().reason());
  }

  return ResponseEntity.ok().build(); // respond 2xx fast; do the work async
}
```

`WebhookEvent` is a **sealed interface**: the events with a non-trivial payload
have their own typed record with a typed `data()`, and every other type — including
one the platform adds tomorrow — arrives as a `GenericEvent`, so the union stays
open. Three rules the SDK enforces: feed it the **raw** request bytes (a Spring
`@RequestBody byte[]` or `request.getInputStream()` — re-serializing the JSON
breaks the signature); verify before you parse; and **dedupe on
`event.event().id()`**, because delivery is at-least-once. See
[signing and verification](/webhooks/signing-and-verification) for the signature
scheme.

## The sandbox toolkit

Every `nombaone.sandbox()` method is sandbox-only and throws a `NombaoneException`
locally, before any network call, if the client holds a live key.

```java
// A deterministic test method — no real card.
PaymentMethod method = nombaone.sandbox().createPaymentMethod(
    SandboxPaymentMethodParams.builder()
        .customerId(customer.id())
        .behavior(SandboxPaymentMethodBehavior.DECLINE_INSUFFICIENT_FUNDS)
        .build());

// The test clock — run the next billing cycle through the real engine, now.
AdvanceCycleResult cycle = nombaone.sandbox().advanceCycle(subscription.id());
System.out.println(cycle.outcome()); // past_due

// Fire a real, signed webhook at your registered endpoints.
nombaone.sandbox().simulateWebhook(
    SandboxSimulateWebhookParams.builder().type("invoice.paid").build());
```

The behaviors are `SUCCESS` (default), `DECLINE_INSUFFICIENT_FUNDS`,
`DECLINE_EXPIRED_CARD`, `DECLINE_DO_NOT_HONOR`, and `REQUIRES_OTP`. `advanceCycle`
runs the next cycle through the real engine — invoice, charge, ledger, webhooks.
The sandbox sends no organic webhooks, so `simulateWebhook` is how you rehearse a
handler. See the [sandbox toolkit](/sandbox-toolkit/overview) for the full story.

## The honest hard parts

We would rather you read these here than discover them at 2am.

> **The method is voidInvoice, because void is a Java keyword**
>
> To void an invoice, call `nombaone.invoices().voidInvoice(id)` — `void` is a
> reserved word in Java, so the method carries the `Invoice` suffix. It returns the
> voided `Invoice`.

- **Two methods return a `PaymentMethod`, not what you'd guess.**
`subscriptions().updatePaymentMethod(...)` returns the updated `PaymentMethod`,
and `mandates().retrieve(...)` returns a `PaymentMethod` too — a mandate's
standing lives on the payment-method row. That is what the wire carries; the
types say so.
- **Mandates activate asynchronously.** After `mandates().create(...)` a mandate is
`consent_pending` until the customer authorizes it with their bank. Relay
`MandateSetup.consentInstruction()`, then wait for the `payment_method.updated`
webhook — do not poll, and do not charge early.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not
yet." Read `subscriptions().dunning(...)` and honor `graceAccessUntil` — keep
access on until it passes. Involuntary churn ends as `CANCELED` with
`cancellationReason = INVOLUNTARY`; there is no `churned` status (there is a
`subscription.churned` event).
- **Prices are immutable; plans archive.** To change pricing, deactivate the price
and create a new one; plans archive rather than delete.
- **The invoice list `status` filter excludes `partially_paid`.**
`invoices().list(...)` filters on `draft | open | paid | void | uncollectible`,
even though an `Invoice` object can carry the `PARTIALLY_PAID` status.
- **Filter names are not uniform (wire law).** Subscriptions and invoices filter by
`customerId`, payment methods by `customerRef`, and prices by `planRef`. The
builders name each one exactly, so the compiler keeps you honest.

## Next

- **[Method reference](/sdks/java/reference)**: 
Every method in the SDK, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
