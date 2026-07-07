---
title: "Ruby SDK"
type: reference
summary: "The nombaone gem: one library for Ruby and Rails with zero runtime dependencies. Typed errors you rescue, automatic retries that never double-charge, Enumerable pagination, and a keyless webhook verifier."
canonical: https://docs.nombaone.xyz/sdks/ruby
---

# Ruby SDK

`nombaone` is the official SDK for Ruby. One gem serves plain Ruby and Rails
alike — built entirely on the standard library, with zero runtime dependencies, a
keyless webhook verifier, and shipped RBS type signatures. It talks to the same
API as every other SDK, so the money behaves identically wherever you run it.

```bash
gem install nombaone   # or, in a Gemfile: gem "nombaone"
```

The gem is built on the standard library — `net/http`, `json`, `openssl`,
`securerandom` — with zero runtime dependencies, and ships RBS signatures under
`sig/`. Your secret key is read from `NOMBAONE_API_KEY` (or passed to the
constructor); it is server-side only — never ship it to a browser.

```ruby
require "nombaone"

# Nombaone.new(api_key = nil, **options) builds a Nombaone::Client.
# Nombaone.webhooks is a module-level, keyless webhook verifier.
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Money is integer kobo: ₦2,500.00 is `250_000`.

```ruby
require "nombaone"

nombaone = Nombaone.new(ENV["NOMBAONE_API_KEY"])

# 1. Something to sell.
plan  = nombaone.plans.create(name: "Pro")
price = nombaone.plans.prices.create(
  plan.id,
  unit_amount_in_kobo: 250_000, # ₦2,500.00
  interval: "month",
)

# 2. Someone to bill.
customer = nombaone.customers.create(
  email: "ada@example.com",
  name: "Ada Lovelace",
)

# 3. A way to pay — in the sandbox, mint a deterministic test card.
method = nombaone.sandbox.create_payment_method(customer_id: customer.id)

# 4. The subscription. The engine takes over now.
subscription = nombaone.subscriptions.create(
  customer_id: customer.id,
  price_id: price.id,
  payment_method_id: method.id,
)

subscription.status # => "active"
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
`https://api.nombaone.xyz` automatically.

## Constructing the client

```ruby
Nombaone.new(api_key = nil, **options)
```

Pass the key as the first argument, or omit it to read `NOMBAONE_API_KEY`. The
constructor raises a `Nombaone::Error` — locally, before any network call — when
no key resolves, or when the key prefix is unrecognized and no `base_url:` is
given.

| Option | Default | Meaning |
|---|---|---|
| `api_key` | `ENV["NOMBAONE_API_KEY"]` | The secret key. Server-side only. |
| `base_url:` | derived from key prefix | Override the API origin. Always wins; required for an unrecognized prefix. |
| `timeout:` | `30` seconds | Per-attempt request timeout. |
| `max_retries:` | `2` (3 attempts) | Retries network failures, timeouts, 408/429/5xx, and in-flight idempotency conflicts. A `POST` retry always reuses its `Idempotency-Key`. |
| `default_headers:` | — | Headers sent on every request. |
| `http:` | `Net::HTTP` transport | Inject a connection that responds to `#execute` — for tests, proxies, or instrumentation. |

Read `nombaone.mode` (`"sandbox"` or `"live"`) and `nombaone.base_url` to see
where a client points; both are derived from the key prefix.

## Conventions

- **Money is integer kobo, params are snake_case.** Money params and readers end
in `_in_kobo`, ₦1.00 is `100`, and `currency` is always `"NGN"`. Ruby's
`Integer` is arbitrary-precision, so there are no floats or decimal strings for
money, anywhere. You pass snake_case keyword arguments and read snake_case
methods (`amount_in_kobo`), even though the wire is camelCase — the SDK
translates both directions.
- **Idempotency is automatic.** A UUID `Idempotency-Key` is generated once per
`POST`, before the retry loop, and reused across automatic retries — so a
dropped connection can never double-charge. On payouts, pass your own stable key
(below).
- **IDs are opaque strings** shaped `nbo…` with a type suffix (`…cus`, `…sub`,
`…inv`). Never validate them client-side. Timestamps are ISO-8601 strings; the
SDK leaves them as strings — parse with `Time.iso8601` if you need a `Time`.

Per call, every method takes a final `request_options:` keyword:

| Key | Meaning |
|---|---|
| `:idempotency_key` | Override the auto-generated key. Required practice on payouts. |
| `:headers` | Extra headers; a `nil` value removes an SDK default. |
| `:timeout` | Per-attempt seconds for this call. |
| `:max_retries` | Retry budget for this call; `0` fails fast. |
| `:cancel_when` | A callable checked before each attempt; if truthy the call raises `Nombaone::ConnectionError` and is never retried. |

## Return values and pagination

Every method is synchronous — you call it, it blocks, you get an object back. A
single resource is a `Nombaone::NombaObject` with snake_case readers; every
`list` returns a `Nombaone::Page`, which `include`s `Enumerable`.

```ruby
# One page.
page = nombaone.invoices.list(status: "open", limit: 50)
page.data      # => Array<Nombaone::NombaObject>
page.has_more? # => true / false

# Manual paging — same filters, next cursor.
page = page.next_page if page.next_page?

# Every item across every page — lazy, fetches pages as needed.
nombaone.invoices.list(status: "open").each { |invoice| puts invoice.id }
nombaone.customers.list.auto_paging_each { |c| handle(c) } # alias of each
first_three = nombaone.customers.list.first(3)             # stops after one page

# The request id, when you need it.
nombaone.customers.retrieve(id).request_id
```

Every `list` accepts `limit:` (1–100, default 20) and `cursor:` (from a prior
page's `next_cursor`), plus the resource's own filters. Every object also carries
`request_id` and `to_h` (the untouched wire hash).

## Errors

Every error is raised and typed. The base is `Nombaone::Error` (also raised for
config mistakes); any non-2xx response is a `Nombaone::APIError` with a
status-specific subclass, and transport failures are `Nombaone::ConnectionError`
/ `Nombaone::TimeoutError`.

An `APIError` carries `status_code`, a machine-readable `code`, a `hint`, a
`doc_url`, an optional `fields` map (on 422s), and the `request_id`. The `hint` is
baked into the message, so the fix arrives with the failure.

| Status | Class | Notes |
|---|---|---|
| 400 | `BadRequestError` | Malformed request. |
| 401 | `AuthenticationError` | Missing, invalid, or wrong-mode key. |
| 403 | `PermissionDeniedError` | Missing scope, or a foreign resource. |
| 404 | `NotFoundError` | Wrong id, or wrong mode. |
| 409 | `ConflictError` | State conflicts, idempotency reuse or in-progress. |
| 422 | `ValidationError` | `error.fields` has per-field messages. |
| 429 | `RateLimitError` | Adds `retry_after` (seconds), `limit`, `remaining`. |
| 5xx | `ServerError` | Safe to retry — the SDK already did. |

```ruby
begin
  nombaone.subscriptions.create(customer_id: customer_id, price_id: price_id)
rescue Nombaone::ValidationError => e
  e.fields      # { "paymentMethodId" => ["…"] }
rescue Nombaone::RateLimitError => e
  e.retry_after # seconds
rescue Nombaone::NotFoundError => e
  puts [e.code, e.request_id].inspect
end
```

Branch on `e.code` (stable) or the class — never on `e.message`, which may be
reworded. Codes are also constants (`Nombaone::ErrorCode::CUSTOMER_NOT_FOUND`),
and the list is open, so an unknown future code still surfaces as a plain string.
Every code and its fix is in the [error reference](/errors).

## Webhooks

The webhook verifier is available as `nombaone.webhooks` and, importantly, as
`Nombaone.webhooks` — a module-level helper that needs **no API key**, because a
receiver usually holds only the signing secret.

```ruby
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    event = Nombaone.webhooks.construct_event(
      request.raw_post,                        # 1. the RAW body, never re-serialized
      request.headers["X-Nombaone-Signature"],
      ENV.fetch("NOMBAONE_WEBHOOK_SECRET"),    # shown once at endpoint creation
    )

    return head(:ok) if AlreadyProcessed.exists?(event.event.id) # 2. dedupe on the event id

    case event.type                            # 3. branch on the event type
    when "invoice.paid"            then unlock(event.data.reference)
    when "invoice.action_required" then email(event.data.checkout_link)
    when "invoice.payment_failed"  then note(event.data.reason)
    end

    head :ok
  rescue Nombaone::WebhookVerificationError
    head :bad_request
  end
end
```

Three rules the SDK enforces: feed the **raw** body (`request.raw_post` in Rails,
`request.body.read` in Sinatra or Rack); verify before you parse; and **dedupe on
`event.event.id`**, because delivery is at-least-once. See
[signing and verification](/webhooks/signing-and-verification) for the signature
scheme.

## The sandbox toolkit

Every `nombaone.sandbox` method is sandbox-only and raises locally, before any
network call, if the client holds a live key.

```ruby
# A deterministic test method — no real card.
method = nombaone.sandbox.create_payment_method(
  customer_id: customer.id,
  behavior: "decline_insufficient_funds", # a thin balance: "not yet", not "no"
)

# The test clock — run the next billing cycle through the real engine, now.
cycle = nombaone.sandbox.advance_cycle(subscription.id)
cycle.outcome # => "past_due"

# Fire a real, signed webhook at your registered endpoints.
nombaone.sandbox.simulate_webhook(type: "invoice.paid")
```

The behaviors are `success` (default), `decline_insufficient_funds`,
`decline_expired_card`, `decline_do_not_honor`, and `requires_otp`. The sandbox
sends no organic webhooks — `simulate_webhook` is how you rehearse a handler. See
the [sandbox toolkit](/sandbox-toolkit/overview) for the full story.

## The honest hard parts

We would rather you read these now than discover them at 2am.

> **Webhook signature verification is not live yet**
>
> `Nombaone.webhooks.construct_event` implements the documented `t=…,v1=…`
> signature scheme, and a golden-vector test proves that implementation is
> correct. But the backend still signs outbound deliveries with the legacy
> bare-hex scheme, so `construct_event` will not match a real delivery until the
> backend ships the documented scheme. Wire up your handler now — the SDK side is
> proven — but do not assume live signature parity yet.

- **`mode` is `"sandbox"`, not `"test"`.** Every resource carries a `mode`, and a
sandbox key yields `"sandbox"` on the wire — mind that if you branch on it.
- **Two methods return a `PaymentMethod`.** `subscriptions.update_payment_method`
returns the updated `PaymentMethod`, and `mandates.retrieve` returns a
`PaymentMethod` too (a mandate's standing lives on the payment-method row). That
is what the wire carries — the readers reflect it.
- **Mandates activate asynchronously.** `mandates.create` returns
`consent_pending`; wait for the `payment_method.updated` webhook before charging
— do not poll tightly. On the deployed sandbox, `mandates.create` can currently
return a backend `504` from the NIBSS upstream; it surfaces as a
`Nombaone::ServerError`, so pass `request_options: { max_retries: 0 }` to fail
fast while that upstream is down.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not
yet." Read `subscriptions.dunning.retrieve` and honor `grace_access_until`
before cutting access. Involuntary churn ends as `canceled` with
`cancellation_reason: "involuntary"` — there is no `churned` status (there is a
`subscription.churned` event).
- **Prices are immutable; plans archive.** To change pricing, `prices.deactivate`
the old price and create a new one; plans archive rather than delete.

## Next

- **[Method reference](/sdks/ruby/reference)**: 
Every method in the gem, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
