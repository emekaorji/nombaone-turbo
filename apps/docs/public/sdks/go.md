---
title: "Go SDK"
type: reference
summary: "The nombaone-go SDK: one context-first, zero-dependency Go library for the NombaOne billing API — typed errors you match with errors.As, retries that never double-charge, range-over-func pagination, and a standalone webhook package."
canonical: https://docs.nombaone.xyz/sdks/go
---

# Go SDK

`github.com/nombaone/nombaone-go` is the official SDK for Go. One package, no
dependencies beyond the standard library, covers the entire API — every
namespace, typed errors, automatic retries that never double-charge, cursor
pagination, and a standalone webhook verifier. It talks to the same API as every
other SDK, so the money behaves identically wherever you run it. It needs only
Go 1.23+.

```bash
go get github.com/nombaone/nombaone-go
```

The SDK is server-side only — secret keys, no publishable key. Your key is read
from `NOMBAONE_API_KEY` (or set with `WithAPIKey`); never ship it to a browser.

```go
import (
	"context"

	nombaone "github.com/nombaone/nombaone-go" // the client
)
// Webhook verification is a separate, key-free package:
//   github.com/nombaone/nombaone-go/webhook
```

## Your first subscription

This is the whole lifecycle — a plan, a price, a customer, a way to pay, and a
subscription — against the sandbox. Every method takes a `context.Context`
first, and money is integer kobo: ₦2,500.00 is `250_000`.

```go
package main

import (
	"context"
	"fmt"
	"log"

	nombaone "github.com/nombaone/nombaone-go"
)

func main() {
	// Reads NOMBAONE_API_KEY; the host is derived from the key prefix
	// (nbo_sandbox_… → sandbox, nbo_live_… → live).
	client, err := nombaone.New()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()

	// 1. Something to sell.
	plan, _ := client.Plans.Create(ctx, nombaone.PlanCreateParams{Name: "Pro"})
	price, _ := client.Plans.Prices.Create(ctx, plan.ID, nombaone.PriceCreateParams{
		UnitAmountInKobo: 250_000, // ₦2,500.00
		Interval:         nombaone.PriceIntervalMonth,
	})

	// 2. Someone to bill.
	customer, _ := client.Customers.Create(ctx, nombaone.CustomerCreateParams{
		Email: "ada@example.com",
		Name:  "Ada Lovelace",
	})

	// 3. A way to pay — in the sandbox, mint a deterministic test card.
	method, _ := client.Sandbox.CreatePaymentMethod(ctx, nombaone.SandboxPaymentMethodParams{
		CustomerID: customer.ID,
	})

	// 4. The subscription. The engine takes over.
	sub, _ := client.Subscriptions.Create(ctx, nombaone.SubscriptionCreateParams{
		CustomerID:      customer.ID,
		PriceID:         price.ID,
		PaymentMethodID: nombaone.String(method.ID),
	})
	fmt.Println(sub.Status) // "active"
}
```

Only the key and the host change when you go live: an `nbo_live_…` key routes to
the live host automatically.

## Constructing the client

```go
func nombaone.New(opts ...nombaone.Option) (*nombaone.Client, error)
```

Pass functional options. `New` derives the host from the key prefix, and an
explicit `WithBaseURL` always wins. It returns an error — never panics — for a
missing key, or an unrecognized key prefix with no base URL.

| Option | Default | Meaning |
|---|---|---|
| `WithAPIKey(key)` | `NOMBAONE_API_KEY` env var | The secret key. Server-side only. |
| `WithBaseURL(url)` | derived from key prefix | Override the API origin. Always wins; required for an unrecognized prefix. |
| `WithTimeout(d)` | `30s` | Per-attempt timeout. |
| `WithMaxRetries(n)` | `2` (3 attempts) | Retries network failures, timeouts, 408/429/5xx, and in-flight idempotency conflicts. A `POST` retry always reuses its `Idempotency-Key`. |
| `WithHTTPClient(h)` | new `*http.Client` | Bring your own transport, for tests, proxies, or instrumentation. |
| `WithDefaultHeader(k, v)` | — | A header added to every request. |

Read `client.Mode()` (`sandbox` / `live`) and `client.BaseURL()` to see where a
client points.

## Conventions

- **Money is integer kobo.** `Kobo` is `int64`, ₦1.00 = `100`, money fields end
in `InKobo`, and `currency` is always `"NGN"`. There are no floats or decimal
strings for money, anywhere.
- **Fields are PascalCase; the wire is camelCase.** Go struct fields like
`UnitAmountInKobo` map to the camelCase wire through JSON tags you never touch.
Optional scalars are pointers — set them with `nombaone.String`,
`nombaone.Int`, `nombaone.Int64`, `nombaone.Bool` so "unset" stays distinct
from a zero value.
- **Idempotency is automatic.** A UUID `Idempotency-Key` is generated once for
every `POST` and reused across automatic retries, so a dropped connection can
never double-charge. On `Settlements.CreatePayout`, pass your own stable
`WithIdempotencyKey` — it doubles as the durable `merchantTxRef`.
- **IDs are opaque strings** shaped `nbo…` with a type suffix (`…cus`, `…sub`,
`…inv`); never construct or validate them. Timestamps are ISO-8601 UTC
strings; nullable fields are pointers (`*string`).

## Return values and pagination

Every method is synchronous — it blocks until the API responds — but
context-first, so a deadline or cancellation on the `ctx` you pass is always
honored. Non-list methods return `(*T, error)`; every `List` returns
`(*nombaone.Page[T], error)`.

```go
// One page.
page, err := client.Invoices.List(ctx, nombaone.InvoiceListParams{
	Status: nombaone.InvoiceStatusOpen, Limit: nombaone.Int(50),
})

// Manual paging.
for page.HasNextPage() {
	page, err = page.NextPage(ctx)
}

// Every item across every page — a Go 1.23 range-over-func iterator
// (iter.Seq2[T, error]); breaking the loop stops fetching.
for inv, err := range client.Invoices.List(ctx, nombaone.InvoiceListParams{}).All(ctx) {
	if err != nil {
		break // a mid-iteration fetch failed
	}
	fmt.Println(inv.ID, inv.AmountDueInKobo)
}
```

`*Page[T]` carries `Data []T`, a `Pagination` cursor, and the `RequestID`.
Pagination is cursor-only and forward-only; `Limit` is 1–100 (server default
20). Capture the raw `*http.Response` — for `X-Request-Id`, rate-limit headers,
status — with `nombaone.WithRawResponse(&resp)` on any call.

## Errors

Every failed call returns a typed error. The base is `*nombaone.APIError` for
any non-2xx response; each status has a specific type that embeds it, so
`errors.As` reaches both. Transport failures are `*ConnectionError` and
`*TimeoutError`.

An `*APIError` carries `StatusCode`, a machine-readable `Code`, a `Hint` (the
fix), a `DocURL`, an optional `Fields` map (on 422s), and the `RequestID`.
`Error()` renders `message — hint`, so the fix arrives with the failure.

| Status | Type | Notes |
|---|---|---|
| 400 | `*BadRequestError` | Malformed request. |
| 401 | `*AuthenticationError` | Missing, invalid, or wrong-mode key. |
| 403 | `*PermissionDeniedError` | Missing scope, or a foreign resource. |
| 404 | `*NotFoundError` | Wrong id, or wrong mode. |
| 409 | `*ConflictError` | State conflicts, idempotency reuse or in-progress. |
| 422 | `*ValidationError` | `Fields` has per-field messages. |
| 429 | `*RateLimitError` | Adds `RetryAfter` (seconds), `Limit`, `Remaining`. |
| 5xx | `*ServerError` | Safe to retry — the SDK already did. |

```go
import "errors"

_, err := client.Subscriptions.Create(ctx, params)

var ve *nombaone.ValidationError
if errors.As(err, &ve) {
	fmt.Println(ve.Fields) // { "paymentMethodId": ["required"] }
}
var rl *nombaone.RateLimitError
if errors.As(err, &rl) {
	fmt.Println(rl.RetryAfter) // seconds
}
var apiErr *nombaone.APIError
if errors.As(err, &apiErr) {
	fmt.Println(apiErr.Code, apiErr.RequestID)
}
```

Branch on `apiErr.Code` or the concrete type — never on the message, which may
be reworded. `ErrorCode` is an open string type, so unknown future codes still
parse into an `*APIError`. Every code and its fix is in the
[error reference](/errors).

## Webhooks

The verifier is a separate package — `github.com/nombaone/nombaone-go/webhook` —
that needs **no API key**, so a receiver pulls in only the signing secret, not
the client.

```go
package main

import (
	"io"
	"net/http"
	"os"

	"github.com/nombaone/nombaone-go/webhook"
)

func handler(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body) // 1. the RAW body — never decode it first

	event, err := webhook.ConstructEvent(
		body,
		r.Header.Get("X-Nombaone-Signature"),
		os.Getenv("NOMBAONE_WEBHOOK_SECRET"), // shown once at endpoint creation
	)
	if err != nil { // 2. verify before you parse
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	if alreadyProcessed(event.Event.ID) { // 3. dedupe on the event id
		w.WriteHeader(http.StatusOK)
		return
	}

	switch event.Type {
	case "invoice.paid":
		var d webhook.RefData
		_ = event.DataInto(&d) // d.Reference
	case "invoice.action_required":
		var d webhook.InvoiceActionRequiredData
		_ = event.DataInto(&d) // d.CheckoutLink
	case "invoice.payment_failed":
		var d webhook.InvoicePaymentFailedData
		_ = event.DataInto(&d) // d.Reason
	}

	w.WriteHeader(http.StatusOK) // respond 2xx fast; do the work async
}
```

Three rules the package enforces: feed the **raw** body (`io.ReadAll(r.Body)` on
net/http, `c.GetRawData()` on Gin, `c.Body()` on Fiber — and register no JSON
middleware on the route); verify before you parse; and **dedupe on
`event.Event.ID`**, because delivery is at-least-once. Decode a payload into a
typed struct with `event.DataInto(&d)` or `webhook.DecodeData[T]`. See
[signing and verification](/webhooks/signing-and-verification) for the signature
scheme.

## The sandbox toolkit

Every `client.Sandbox` method is sandbox-only and fails **locally, before any
network call**, when the client holds a live key — returning the sentinel
`nombaone.ErrSandboxRequiresSandboxKey`, which you check with `errors.Is`.

```go
// A deterministic test method — no real card.
method, _ := client.Sandbox.CreatePaymentMethod(ctx, nombaone.SandboxPaymentMethodParams{
	CustomerID: customer.ID,
	Behavior:   nombaone.SandboxBehaviorDeclineInsufficientFunds, // a thin balance: "not yet", not "no"
})

// The test clock — run the next billing cycle through the real engine, now.
cycle, _ := client.Sandbox.AdvanceCycle(ctx, sub.ID)
fmt.Println(cycle.Outcome) // "past_due"

// Fire a real, signed webhook at your registered endpoints.
_, _ = client.Sandbox.SimulateWebhook(ctx, nombaone.SandboxSimulateWebhookParams{Type: "invoice.paid"})
```

The behaviors are `success` (default), `decline_insufficient_funds`,
`decline_expired_card`, `decline_do_not_honor`, and `requires_otp`. The sandbox
sends no organic webhooks — `SimulateWebhook` is how you rehearse a handler. The
live-key guard is a plain sentinel:

```go
_, err := client.Sandbox.AdvanceCycle(ctx, sub.ID)
if errors.Is(err, nombaone.ErrSandboxRequiresSandboxKey) {
	// this client holds a live key — the sandbox instruments are off
}
```

See the [sandbox toolkit](/sandbox-toolkit/overview) for the full story.

## The honest hard parts

We would rather you read these than discover them at 2am.

> **Rehearse declines with a trial, not a live first charge**
>
> Creating a subscription whose **first charge declines** currently returns a
> 422 `SUBSCRIPTION_ILLEGAL_TRANSITION`, not a dunning state. To rehearse a
> failed charge, start the subscription with `TrialDays` set to defer the first
> charge, then force the cycle with `Sandbox.AdvanceCycle` using a declining
> sandbox card — the decline then lands as `past_due` with a real dunning state
> to inspect.

- **Two methods return a `PaymentMethod`.** `Subscriptions.UpdatePaymentMethod`
returns the attached `*PaymentMethod` (not a `*Subscription`), and
`Mandates.Retrieve` returns a `*PaymentMethod` too — a mandate's standing lives
on the payment-method row. That is what the wire carries.
- **Mandates activate asynchronously.** After `Mandates.Create`, wait for the
`payment_method.updated` webhook — do not poll, and do not charge early. On the
deployed sandbox, `POST /mandates` can currently return a `504` from the NIBSS
upstream; it surfaces as a `*ServerError`, so pass
`nombaone.WithRequestMaxRetries(0)` to fail fast while that upstream is down.
- **`past_due` is not canceled.** A failed charge on a thin balance means "not
yet." Read `Subscriptions.Dunning.Retrieve` and honor `GraceAccessUntil` before
you cut access. Involuntary churn ends as `Status canceled` with
`CancellationReason involuntary` — there is no `churned` status (there is a
`subscription.churned` event).
- **Sandbox settlements.** The sandbox organization has no settlement subaccount,
so escrow and payout return a typed `SETTLEMENT_SUBACCOUNT_NOT_FOUND` — a real
business state whose `Hint` explains itself, not an SDK fault.
- **Prices are immutable, plans archive.** To change pricing, deactivate the
price and create a new one; plans archive rather than delete.

## Next

- **[Method reference](/sdks/go/reference)**: 
Every method in the SDK, grouped by namespace.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive, verify, and dedupe events end to end.
- **[Error reference](/errors)**: 
Every code, what triggers it, and how to fix it.
