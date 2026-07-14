---
title: "Rust SDK"
type: reference
summary: "The nombaone crate: one async-first Rust library on tokio, reqwest, and rustls, with an optional blocking API, a three-state Field for clearable inputs, typed errors, automatic retries that never double-charge, and a keyless webhook verifier."
canonical: https://docs.nombaone.xyz/sdks/rust
---

# Rust SDK

`nombaone` is the official Rust SDK for the NombaOne subscription-billing API. It
is async-first — built on `tokio`, `reqwest`, and `rustls` — with an optional
synchronous surface behind the `blocking` feature, and it contains zero `unsafe`.
One client, cheap to clone and `Send + Sync`, talks to the same API as every other
SDK, so the money behaves identically wherever you run it.

```bash
cargo add nombaone
cargo add tokio --features macros,rt-multi-thread   # the async runtime nombaone awaits on
```

The default `reqwest-transport` feature ships the built-in HTTP transport (`reqwest`
over `rustls`); build with `default-features = false` to plug in your own. Annotate
your entry point with `#[tokio::main]` and `.await` each call. Your secret key is
read from `NOMBAONE_API_KEY` (or passed to the builder); it is server-side only —
never ship it to a browser.

```rust
use nombaone::*;         // the client, resource/param/domain types, and enums
// Webhooks live in `nombaone::webhooks`; the mock transport in `nombaone::testing`.
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Money is integer kobo: every `..._in_kobo`
field is a `Kobo` (an alias for `i64`), and `250_000` means ₦2,500.00 — not
₦250,000.

```rust
use nombaone::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let nombaone = Nombaone::from_env()?; // reads NOMBAONE_API_KEY (a nbo_sandbox_… key)

    // 1. Something to sell.
    let plan = nombaone
        .plans()
        .create(PlanCreateParams { name: "Pro".into(), ..Default::default() })
        .await?;
    let price = nombaone
        .plans()
        .prices()
        .create(&plan.id, PriceCreateParams::new(250_000, PriceInterval::Month)) // unit_amount_in_kobo: 250_000, // ₦2,500.00
        .await?;

    // 2. Someone to bill.
    let customer = nombaone
        .customers()
        .create(CustomerCreateParams {
            email: "ada@example.com".into(),
            name: "Ada Lovelace".into(),
            ..Default::default()
        })
        .await?;

    // 3. A way to pay — in the sandbox, mint a deterministic test card.
    let method = nombaone
        .sandbox()
        .create_payment_method(SandboxPaymentMethodParams {
            customer_id: customer.id.clone(),
            ..Default::default()
        })
        .await?;

    // 4. The subscription. The engine takes it from here: cycles, invoices, retries.
    let subscription = nombaone
        .subscriptions()
        .create(SubscriptionCreateParams {
            customer_id: customer.id,
            price_id: price.id,
            payment_method_id: Some(method.id),
            ..Default::default()
        })
        .await?;

    println!("{}", subscription.status); // "active"
    Ok(())
}
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
`https://api.nombaone.xyz` automatically.

## Constructing the client

```rust
use std::time::Duration;

let nombaone = Nombaone::builder()
    .api_key("nbo_sandbox_…")             // or omit to read $NOMBAONE_API_KEY
    .timeout(Duration::from_secs(30))
    .max_retries(2)
    .default_header("x-app", "billing-worker")
    .build()?;
```

`Nombaone::new(key)` and `Nombaone::from_env()` are shorthands for the builder.
Read `nombaone.mode()` (`Mode::Sandbox | Mode::Live`) and `nombaone.base_url()` to
see where a client points; the client is cheap to clone (reference-counted) and
`Send + Sync`, so build one and share it across your app.

| Method | Default | Meaning |
|---|---|---|
| `.api_key(k)` | `$NOMBAONE_API_KEY` | Secret key. Missing or empty raises `Error::Config`; an unknown prefix with no `base_url` does too. |
| `.base_url(u)` | derived from key | Override the host (a local stack, say). Always wins over the prefix. |
| `.timeout(d)` | `30s` | Per-attempt timeout, a `std::time::Duration`. |
| `.max_retries(n)` | `2` | Automatic retries (3 attempts total). `0` disables. |
| `.default_header(name, value)` | none | An extra header on every request. Call it repeatedly. |
| `.transport(t)` | reqwest + rustls | Inject a custom `HttpTransport` for tests or proxies. |

## Conventions

- **Money is integer kobo.** `₦1.00 == 100`, every money field and param ends in
`_in_kobo` and is typed `Kobo` (an alias for `i64`), and `currency` is always
`"NGN"`. Multiply naira by 100 exactly once, at the edge of your system — never
use floats for money.
- **snake_case in Rust, camelCase on the wire.** You write `price.unit_amount_in_kobo`
and `customer.created_at`; the API sends `unitAmountInKobo` and `createdAt`. The
SDK maps both directions.
- **IDs are opaque strings** shaped `nbo…` with a type suffix (`…cus`, `…sub`,
`…inv`). Pass them as `&str`; never parse them. Timestamps are ISO-8601 UTC
strings.
- **Omit, clear, or set — the three-state `Field`.** Most optional inputs are
`Option` and are simply omitted when `None`. For the few fields you can
*clear* with JSON `null` (a customer's `phone`, a plan or customer
`description`), the type is `Field` with three states.

```rust
nombaone.customers().update(&customer.id, CustomerUpdateParams {
    phone: Field::Null,                       // send JSON null → clear the number
    // phone: "+2348012345678".to_string().into(), // Field::Value → set it
    // phone: Field::Missing (the default)          → leave it untouched
    ..Default::default()
}).await?;
```

Idempotency is automatic: the SDK computes an `Idempotency-Key` (a UUID) once for
**every POST** and reuses it across automatic retries, so a dropped connection can
never double-charge. On `settlements().create_payout(...)`, pass your own stable
key — it doubles as the durable `merchant_tx_ref`, so a retry from a fresh process
can't create a second payout.

Every single-resource method returns a lazy `ApiCall`; every `list` returns a
`Paginator`. **Nothing is sent until you `.await`.** Chain options first, and
finish with `.with_response()` when you also need the request id and headers:

```rust
use std::time::Duration;

let resp = nombaone
    .settlements()
    .create_payout(PayoutCreateParams {
        amount_in_kobo: 5_000_000, // ₦50,000.00
        bank_code: "058".into(),
        account_number: "0123456789".into(),
    })
    .idempotency_key("payout-2026-07-01") // POST only; overrides the auto UUID
    .header("x-trace", "abc")             // an extra header for this call
    .timeout(Duration::from_secs(60))     // per-attempt timeout for this call
    .max_retries(0)                       // retry budget for this call
    .with_response()                      // -> Response<Payout>, not Payout
    .await?;

resp.data;        // the Payout
resp.request_id;  // meta.requestId — quote it to support
resp.status;      // u16 HTTP status
```

Cancellation is idiomatic Rust: drop the future (`tokio::select!` or
`tokio::time::timeout`). A dropped call is never retried.

## Return values and pagination

A single-resource call `.await`s to `T`; a `list` `.await`s to the first `Page`.
`Page` carries `.data()`, its `.pagination()` cursor block, `.has_next_page()`,
and `.request_id()`. Pagination is cursor-only and forward-only: `limit` is 1–100
(the API default is 20), and there are no total counts. Item and page streams need
a `Stream` extension trait — add `futures-util` and its `TryStreamExt`.

```rust
use futures_util::TryStreamExt;

// One page + the cursor block.
let page = nombaone
    .customers()
    .list(CustomerListParams { limit: Some(50), ..Default::default() })
    .await?;
page.data();                   // &[Customer]
page.pagination().has_more;    // bool
page.has_next_page();          // bool

// Every item across every page — the cursors are threaded for you.
let mut items = nombaone.customers().list(CustomerListParams::default()).stream();
while let Some(customer) = items.try_next().await? {
    println!("{}", customer.email);
}

// Page by page instead: `.pages()` yields a `PageStream<T>`.
let mut pages = nombaone.customers().list(CustomerListParams::default()).pages();
while let Some(page) = pages.try_next().await? { /* … */ }
```

Need a synchronous surface? Enable `features = ["blocking"]` and use the **same**
resource methods — only the terminal changes: `.send_blocking()` instead of
`.await`, and `.iter()` instead of `.stream()`. (The blocking terminals panic if
called from inside a Tokio runtime; use the async form there.)

```rust
let customer = nombaone.customers().retrieve(id).send_blocking()?;
for invoice in nombaone.invoices().list(InvoiceListParams::default()).iter() {
    let invoice = invoice?; // Iterator<Item = Result<Invoice, Error>>
}
```

## Errors

Every fallible call returns `Result<T, nombaone::Error>`. `Error` is a
`#[non_exhaustive]` enum, so match it with a catch-all arm and let future variants
compile clean.

```rust
#[non_exhaustive]
pub enum Error {
    Api(Box<ApiError>),      // a non-2xx API response
    Connection { .. },       // DNS, reset, TLS, transport (retried within budget)
    Timeout { .. },          // a per-attempt timeout elapsed (retried)
    Decode { .. },           // the response was not a valid NombaOne envelope
    WebhookVerification(WebhookVerificationError),
    Config { .. },           // bad or missing key / base URL (raised at construction)
}
```

An `ApiError` carries everything the error envelope said: `status`, a
machine-readable `code`, a `message`, a `hint` (folded into `Display`), a
`doc_url`, an optional `fields` map on 422s, the `request_id`, and — on 429 —
`retry_after`, `rate_limit`, and `rate_remaining`. Classify by HTTP class with
`ApiError::kind() -> ApiErrorKind` (`BadRequest`, `Authentication`,
`PermissionDenied`, `NotFound`, `Conflict`, `Validation`, `RateLimit`, `Server`,
`Other`).

```rust
use nombaone::{Error, ErrorCode, ApiErrorKind};

match nombaone.subscriptions().create(params).await {
    Ok(sub) => println!("{}", sub.status),
    Err(Error::Api(e)) if e.code == ErrorCode::CUSTOMER_NOT_FOUND => { /* re-create the customer */ }
    Err(Error::Api(e)) if e.kind() == ApiErrorKind::RateLimit => { let _ = e.retry_after; }
    Err(Error::Api(e)) if e.kind() == ApiErrorKind::Validation => { let _ = e.fields; } // per-field messages
    Err(other) => eprintln!("{other}"),
}
```

`ErrorCode` is an **open** newtype — it has an associated constant for every known
code, and an unknown future code still parses, so compare `e.code == ErrorCode::X`
or `e.code.as_str()`. Branch on the `kind()` or the `code`, never on the message,
which may be reworded. Every code and its fix is in the [error reference](/errors).

## Webhooks

The webhook verifier is a set of free functions in `nombaone::webhooks` that need
**no API key** — a receiver usually holds only the signing secret, shown once when
you create or rotate an endpoint. Feed the **raw request bytes**, never a
re-serialized copy.

```rust
use nombaone::{webhooks, WebhookEventType, WebhookVerificationError};
use nombaone::webhook_events::WebhookEventData;

fn handle(raw_body: &[u8], signature: &str, secret: &str) -> Result<(), WebhookVerificationError> {
    // 1. verify + parse from the RAW bytes, before you trust anything.
    let event = webhooks::construct_event(raw_body, signature, secret)?;

    // 2. dedupe on the event id — delivery is at-least-once.
    // if already_processed(&event.event.id) { return Ok(()); }

    // 3. act — `data` narrows on the event type.
    match event.event_type {
        WebhookEventType::InvoicePaid => { /* unlock access */ }
        WebhookEventType::InvoiceActionRequired => {
            if let WebhookEventData::InvoiceActionRequired(d) = &event.data {
                send_checkout_link(&d.checkout_link);
            }
        }
        _ => {}
    }
    Ok(())
}
```

Three rules the SDK enforces: feed the **raw** body (don't let the framework parse
and re-serialize it — axum `Bytes`, actix-web `web::Bytes`, warp
`warp::body::bytes()`); verify before you parse; and **dedupe on `event.event.id`**,
because delivery is at-least-once. `WebhookEventType` is open, and
`WebhookEventData` narrows the payload per type. See
[signing and verification](/webhooks/signing-and-verification) for the signature
scheme.

## The sandbox toolkit

Every `nombaone.sandbox()` method gives you deterministic control of the real
billing engine, and each one fails **locally** — it returns `Error::Config` with no
network call — if the client was built with a live key.

```rust
// A card that declines like a thin balance does: "not yet", not "no".
let method = nombaone.sandbox().create_payment_method(SandboxPaymentMethodParams {
    customer_id: customer.id.clone(),
    behavior: Some(SandboxPaymentMethodBehavior::DeclineInsufficientFunds),
    ..Default::default()
}).await?;

// The test clock — run the subscription's next billing cycle through the real engine, now.
let cycle = nombaone.sandbox().advance_cycle(&subscription.id).await?;
println!("{}", cycle.outcome); // "paid" | "past_due" | …

// Fire a real, signed webhook at your registered endpoints.
nombaone.sandbox().simulate_webhook(SandboxSimulateWebhookParams {
    event_type: "invoice.paid".into(), ..Default::default()
}).await?;
```

The behaviors are `Success` (the default), `DeclineInsufficientFunds`,
`DeclineExpiredCard`, `DeclineDoNotHonor`, and `RequiresOtp`. The sandbox sends no
organic webhooks — `simulate_webhook` is how you rehearse a handler. For your own
unit tests, enable the `test-util` feature to get `nombaone::testing::MockTransport`,
a queue-backed transport you inject with `.transport(...)` and assert on afterward —
no real HTTP. See the [sandbox toolkit](/sandbox-toolkit/overview) for the full
story.

## The honest hard parts

We would rather you read these here than discover them at 2am.

> **Pin idna_adapter on older toolchains**
>
> The crate builds on Rust 1.85+. On rustc &lt; 1.86 a *fresh* dependency resolve
> pulls `icu 2.2` through `reqwest → url → idna`; such consumers add
> `idna_adapter = "=1.1.0"` to their `[dependencies]`, or use cargo's MSRV-aware
> resolver. On rustc ≥ 1.86 nothing is needed.

> **Two methods return a PaymentMethod, not what you'd guess**
>
> `subscriptions().update_payment_method(...)` returns the updated `PaymentMethod` —
> it swaps the card during dunning — and `mandates().retrieve(id)` returns a
> `PaymentMethod` too, because a mandate's standing lives on the payment-method row.
> That is what the wire carries; the types say so.

- **Mandates activate asynchronously.** A new mandate is `consent_pending` until the
bank confirms — listen for the `payment_method.updated` webhook; do not poll, and
do not charge early.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not yet."
Read `dunning().retrieve()` and honor `grace_access_until` before cutting access.
Involuntary churn ends as `status: Canceled` with `cancellation_reason: Involuntary`
— there is no `churned` status (there is a `subscription.churned` event).
- **Prices are immutable; plans archive.** To change pricing, deactivate the price
and create a new one; plans archive rather than delete.
- **The invoice list filter omits `partially_paid`.** `InvoiceListStatus` has no
`partially_paid` variant, even though an `Invoice` object can carry that status —
filter on `Open` and inspect the amounts.
- **Withdrawing needs a bank account.** An organization that has not yet added the
bank account it wants to be paid into gets a typed `PAYOUT_ACCOUNT_MISSING` on
escrow and payout — a real business state whose `hint` explains itself. The
settlement balance itself exists from day one.

## Next

- **[Method reference](/sdks/rust/reference)**: 
Every method in the crate, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
