# Nomba One: Console Plan · 04 · Developer experience

> **What this is.** The full specification for the Developers area: API keys, webhooks and their deliveries inspector, the event feed and catalog, request and rate-limit inspection, the test-mode instruments, the embedded "reproduce this object" panel, and the OpenAPI reference. This is the developer's control panel behind the SDK, the center of gravity per doc 00, and it is held to the same simulator-level care as the website's live demo. Every screen below gives its purpose, the exact fields it shows (real names from `packages/core-contracts`), the real endpoint method and path, and its empty, loading, and error states. ASCII wireframes are the Phase A pencil starting point. Cited names are real and confirmed against the code; anything not confirmable, or any real gap in the current build, is marked "(verify)" rather than smoothed over.
>
> **Depends on:** doc 00 (north star, personas, scope boundary, the console-auth dependency, inherited design language and voice) and doc 01 (IA and navigation: the app shell, the Developers sub-nav under BUILD, the mandatory test and live environment switch, the cursor-pagination model, and the exact rule that Test mode renders only when the deployment reports `INFRA_ENVIRONMENT=test`). It also leans on doc 02 §1 for the three response envelopes, the money-in-kobo rendering rule, and the idempotency policy, all reused verbatim here; on doc 06 for the data table, detail drawer, code panel, log-stream, and copy-once secret field this doc's screens compose from; and on doc 08 for the complete error-code to hint, docUrl, and fields rendering contract.

---

## 1. How to read this, and the rules unique to this area

Section 1 states what carries over from doc 02 without repeating it, plus the two things that are unique to Developers.

### 1.1 Carried over from doc 02, unchanged

- **The three envelopes.** Success, paginated, and error, all discriminated on `success`, all carrying `meta.requestId`. Every screen in this doc renders `error.hint` verbatim, deep-links `error.docUrl`, and shows `meta.requestId`. Validation failures carry `error.fields`.
- **Money is integer kobo.** The only money this area touches is the `invoice` object embedded in a test-mode `advance-cycle` response (section 8); it renders through the same naira-by-100 helper as every other invoice in the console.
- **The two-phase method.** Phase A frames in `.pen`, wired to real fields, real actions, and the loading, empty, and error states. Phase B builds to those frames against `/v1` with idempotency and error rendering wired live.

### 1.2 What is unique here: idempotency is optional everywhere, and one whole sub-area is a live wire into the sandbox

- **No required `Idempotency-Key` in this entire area.** Doc 02 §1.3 lists subscription and credit actions that require the header because they move money. Nothing in Developers moves money: minting a key, registering a URL, replaying a delivery, and simulating a webhook are all `idempotencyOptional` at the route (confirmed on every route below). The console still generates and sends a key on every write, because retrying a dropped connection should never double-create an endpoint or double-mint a secret, but the merchant and the developer never see or type one.
- **Test mode is a live wire, not a mock.** Every `/v1/test/*` call the console makes is a real request against the same `/v1` the developer's own code calls. There is no separate "demo" backend. This is deliberate: doc 00's test is "a skeptic opens their devtools and sees our sandbox is real," and the Developers area is where the console proves it on the console's own network tab, not only the developer's.

### 1.3 The Developers sub-nav (from doc 01 §1.2)

```
BUILD
  Developers
    · API keys
    · Webhooks
    · Events
    · Test mode        (only when the environment is test)
    · API reference
```

Request and rate-limit inspection (section 7) and the reproduce-this panel (section 9) are not separate nav items; they are threaded through every screen in this area and, for the reproduce-this panel, through every detail drawer in the whole console.

---

## 2. API keys

**Purpose.** The developer's own credential to the public `/v1` API: mint a scoped secret key, see where it is used, and revoke it. This is the trust root under every other integration the developer builds.

### 2.1 The real gap this screen is built against

`apps/api` exposes **zero HTTP routes for `api_keys` today**. There is no `api-keys` module directory under `apps/api/src/apps/main/modules`, and no such router is imported into `v1Router` in `apps/api/src/apps/main/server/routes.ts`. What exists, confirmed in the code:

- the `api_keys` table itself (per-org secret, `nbo_test_`/`nbo_live_` prefix, SHA-256 hash only, `scopes jsonb`, per doc 00's product map),
- one preparatory validation schema, `createApiKeyBody` in `packages/core-contracts/src/validations/api-key.ts`: `name` (1 to 120 chars) and `scopes` (a non-empty array of `ApiKeyScope`), with **no corresponding update-scopes schema**, so there is no designed path to edit a key's scopes after mint; the only remedy for a wrong scope set is revoke and mint fresh.

This whole sub-area is **gated on the console-auth API** (doc 09), the same dependency doc 00 and doc 01 name for login, team, and RBAC. Phase A ships this screen as a designed-but-not-yet-wired frame: the real fields, the real create form, the once-shown secret, all present, with a plain banner where the live data would be: "API keys are minted through the console-auth API, which is not live yet." Phase B is gated on that API shipping, not on this doc.

**Not to be confused with the console's own service credential.** Per doc 00 §B, the console's backend calls `/v1` on the merchant's behalf using a key context scoped to the signed-in organization and the active environment; the merchant never sees this internal credential. This screen manages the keys a **developer mints for their own external integrations**, an entirely separate set of rows.

### 2.2 Data (from `ApiKeyResponseData` and `CreatedApiKeyResponseData`)

`id`, `name`, `keyPrefix` (display-only, e.g. `nbo_test_a1b2…`), `scopes[]`, `environment` (`test` or `live`), `lastUsedAt`, `revokedAt`, `createdAt`. A freshly created key additionally carries `secret`, the full plaintext, returned exactly once.

**The 26 real scopes (`ApiKeyScope`).** Ten resource families as a `read`/`write` pair each (`customers`, `plans`, `prices`, `payment_methods`, `subscriptions`, `invoices`, `coupons`, `billing_settings`, `settlements`, `organizations`) plus `webhooks:read`/`webhooks:write`, `mandates:write` (no read pair; mandate reads go through `payment_methods:read`, per doc 00's product map), `metrics:read` (no write pair), and the `example:read`/`example:write` scaffold pair. The create form renders these grouped by resource family with a read/write toggle per row, never a bare checkbox list of 26 unlabeled strings.

### 2.3 Test and live as separate key sets

`environment` is a first-class column and is baked into the prefix, so a key is structurally test-only or live-only. The screen presents two separate lists, switched by the console's mandatory environment control (doc 01 §1.4), never a combined table with an environment column to scan.

### 2.4 The once-shown secret

Create returns `CreatedApiKeyResponseData.secret` exactly once. The screen renders it in a copy-once field (doc 01 §E2 component 12): a monospace value, a copy button, and a warning that does not soften the fact: "This secret is shown once and cannot be retrieved again. Copy it now and store it in your own secrets manager." Closing the dialog without copying is allowed, but the console does not offer a "show again" affordance anywhere, because there is nothing to show; only the hash is stored server-side.

### 2.5 Errors this screen exists to explain

Four public, hinted codes govern every call a developer makes with a console-minted key, and this screen is where a developer comes to understand why one of their own calls failed elsewhere:

- `API_KEY_MISSING`. Hint: "Send your secret key as `Authorization: Bearer <key>`. Create one in the dashboard under API keys if you do not have it."
- `API_KEY_INVALID`. Hint: "That key is not recognized. Copy it fresh from the dashboard (it may have been rotated or revoked) and send the whole `nbo_test_`/`nbo_live_` string with no extra whitespace."
- `API_KEY_SCOPE_FORBIDDEN`. Hint: "Your key lacks the scope this endpoint needs. Grant the required scope (e.g. `customers:write`) to the key in the dashboard, or use a key that already has it."
- `API_KEY_ENVIRONMENT_MISMATCH`. Hint: "You used a live key against a test host (or vice-versa). Use the key whose prefix (`nbo_test_`/`nbo_live_`) matches the environment you're calling."

The key list surfaces `lastUsedAt` precisely so a developer can tell a stale key from a live one before they start debugging the wrong suspect.

**Wireframe (Phase A).**

```
┌ Developers · API keys ─────────────────────────────  [ + Create key ]  ●Test┐
│ Test keys                                                                   │
│ ┌──────────┬────────────────┬───────────────────┬───────────┬────────────┐ │
│ │ Name      │ Prefix          │ Scopes             │ Last used │ Status     │ │
│ ├──────────┼────────────────┼───────────────────┼───────────┼────────────┤ │
│ │ CI runner │ nbo_test_a1b2… │ customers:read +3  │ 2 min ago │ active     │ │
│ │ Old key   │ nbo_test_9f0e… │ subscriptions:write│ 40d ago   │ revoked    │ │
│ └──────────┴────────────────┴───────────────────┴───────────┴────────────┘ │
│  API keys are minted through the console-auth API, which is not live yet.  │
└──────────────────────────────────────────────────────────────────────────┘

┌ Create key ────────────────────────────────────────────────────────────┐
│ Name  [ CI runner                                          ]           │
│ Scopes                                                                 │
│  Customers   [ ] read [ ] write     Subscriptions  [ ] read [ ] write  │
│  Webhooks    [ ] read [ ] write     Settlements    [ ] read [ ] write  │
│  ...                                                                    │
│                                              [ Cancel ]  [ Create key ]│
└──────────────────────────────────────────────────────────────────────┘

┌ Your new secret key ────────────────────────────────────────────────┐
│ nbo_test_8f2a1c9d4b7e6f0a3c5d8e1b2f4a6c9d              [ Copy ]      │
│ ⚠ This secret is shown once and cannot be retrieved again. Copy it   │
│   now and store it in your own secrets manager.                     │
│                                                          [ Done ]     │
└────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows once the console-auth API is live.
- **Empty:** "No API keys yet. Create one to call the API from your own code." with Create key.
- **Error:** each of the four codes above renders inline with its verbatim hint next to the failing call, plus `meta.requestId`.

---

## 3. Webhooks: endpoints

**Purpose.** Register the URLs Nomba One notifies, choose which event types reach each one, and manage each endpoint's signing secret. This is a real, live-wired sub-area: every endpoint here is a row in `webhook_endpoints`, confirmed against `apps/api/src/apps/main/modules/webhooks/routes.ts`.

**Endpoints.**

- `POST /v1/webhooks`, scope `webhooks:write`, `idempotencyOptional`, body `createWebhookEndpointBody`: `url` (a valid URL), `enabledEvents` (an array of at least one string, defaulting to `['*']` if omitted).
- `GET /v1/webhooks`, scope `webhooks:read`. **This list takes no query parameters at all and is not paginated.** The controller returns every one of the tenant's endpoints as a plain array in `data`, not the paginated envelope. A tenant is expected to hold a handful of endpoints, not thousands, so there is no cursor here and no "Load more" control. This is the one console list that breaks the "cursor pagination everywhere" rule from doc 01 §4, deliberately, because the underlying route was built that way.
- `GET /v1/webhooks/:id`, scope `webhooks:read`, single endpoint.
- `PATCH /v1/webhooks/:id`, scope `webhooks:write`, `idempotencyOptional`, body `updateWebhookEndpointBody`: `url?`, `enabledEvents?`, `disabled?` (boolean), at least one required.
- `DELETE /v1/webhooks/:id`, scope `webhooks:write`, `idempotencyOptional`. **This is a soft-disable, not a row delete.** It calls the same `disableWebhookEndpoint` path that `PATCH { disabled: true }` calls, stamping `disabledAt` and returning the endpoint row unchanged otherwise. The row and its full delivery history persist. The console labels this action **Disable**, never **Delete permanently**, and the confirm dialog says so plainly: "This stops deliveries to this URL. Its history stays visible."
- `POST /v1/webhooks/:id/rotate-secret`, scope `webhooks:write`, `idempotencyOptional`. Mints a fresh signing secret and returns it once.

### 3.1 Data (from `WebhookEndpointResponseData`)

`domain` (always `webhook`), `id` (`nbo…whk`), `url`, `enabledEvents[]` (chosen from the catalog plus the wildcard `*`), `signingSecretPrefix` (e.g. `nbo_whsec_a1b2c3`, the first 16 characters of the generated secret, display-only), `disabledAt` (null while active), `createdAt`.

**Enable and disable read from one field, both ways.** `disabled: true` sets `disabledAt` to now; `disabled: false` clears it. The console's toggle sends exactly this, and `DELETE` is offered as an equivalent affordance for a developer who reaches for the REST verb directly; both land on the identical `disabledAt` state, never two different states with the same name.

### 3.2 The secret, shown once at create and at each rotation

On create, the response merges the endpoint object with a one-time `signingSecret` (statusCode 201): the developer sees the full URL, the enabled events, and the plaintext secret together, once. On rotate, `RotatedWebhookSecretResponseData` (`domain: 'webhook_secret'`, `id`, `signingSecret`, `signingSecretPrefix`) returns the same one-time shape. Both render in the copy-once secret field from section 2.4, with the identical "cannot be retrieved again" warning. Per `apps/api/WEBHOOKS.md`, on rotation the console tells the developer plainly: "In-flight deliveries re-sign with the new key. Keep the old key briefly, or rotate during a quiet window."

### 3.3 Choosing events: the catalog plus the wildcard

`enabledEvents` is validated only as a non-empty array of strings, so the server accepts any string. The console does not: the picker is a multi-select populated from `GET /v1/events/catalog` (section 5.3) plus one wildcard option, `*` (all events). Constraining the picker to real catalog values protects a developer from a silent typo that would otherwise subscribe them to nothing and fail closed with no error, which is exactly the kind of gotcha doc 00 exists to prevent.

### 3.4 Errors

- `CLIENT_VALIDATION_FAILED` renders inline on `url` (must be a valid URL) or on the event picker (must choose at least one) from `error.fields`.
- `WEBHOOK_ENDPOINT_NOT_FOUND` fires on `GET`, `PATCH`, `DELETE`, and rotate against a stale or foreign id (confirmed in `packages/sara/src/webhooks/endpoints.ts`). **(verify).** This code is not currently in `PUBLIC_ERROR_CODES`, so until that is corrected a stale reference here surfaces on the wire as the generic `SYSTEM_INTERNAL_ERROR`, not a targeted 404. The console still renders "No webhook endpoint at this reference in {environment}" locally on any 404-class response, rather than surfacing the raw internal code to the developer.

**Wireframe (Phase A).**

```
┌ Developers · Webhooks ─────────────────────────────  [ + New endpoint ]  ●Test┐
│ (no filters, no pagination; every endpoint for this org and environment)     │
│ ┌──────────────────────────┬──────────────────┬─────────────────┬──────────┐ │
│ │ URL                       │ Events            │ Secret           │ Status   │ │
│ ├──────────────────────────┼──────────────────┼─────────────────┼──────────┤ │
│ │ https://acme.co/hooks     │ *                 │ nbo_whsec_a1b2c3 │ ●Active  │ │
│ │ https://acme.co/dunning   │ invoice.* (3)     │ nbo_whsec_9d4e2f │ Disabled │ │
│ └──────────────────────────┴──────────────────┴─────────────────┴──────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘

┌ New endpoint ──────────────────────────────────────────────────────────┐
│ URL     [ https://acme.co/hooks                                    ]   │
│ Events  [x] All events (*)                                             │
│         or choose specific types:                                      │
│         [ ] invoice.payment_failed  [ ] invoice.payment_recovered      │
│         [ ] subscription.churned    [ ] payment_method.expiring  ...   │
│                                          [ Cancel ]  [ Create endpoint ]│
└──────────────────────────────────────────────────────────────────────┘

┌ Your signing secret ─────────────────────────────────────────────────┐
│ nbo_whsec_a1b2c3d4e5f6...                              [ Copy ]      │
│ ⚠ Shown once. Verify deliveries with this exact value; we store      │
│   only its hash.                                          [ Done ]   │
└──────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No webhook endpoints yet. Add one to start receiving events." with New endpoint.
- **Error:** validation renders per-field; `WEBHOOK_ENDPOINT_NOT_FOUND` per section 3.4.

---

## 4. Webhooks: the deliveries inspector

**Purpose.** Nested under one endpoint, this is where a developer debugs why a delivery did or did not land, and recovers a dead letter without waiting on the platform's own bounded auto-replay. It carries the platform's honesty about at-least-once delivery in full view.

**Endpoints.**

- `GET /v1/webhooks/:id/deliveries`, scope `webhooks:read`, query `listWebhookDeliveryQuery`: `limit` (1 to 100, default 20), `cursor`, `status` (`pending`, `succeeded`, `failed`, `dead`), `eventType`. The schema also carries an `endpoint` field, but the controller always passes the path `:id` as the endpoint filter regardless of any query value, so this nested route is always scoped to the one endpoint in the URL.
- `GET /v1/webhooks/:id/deliveries/:deliveryId`, single delivery.
- `POST /v1/webhooks/:id/deliveries/:deliveryId/replay`, scope `webhooks:write`, `idempotencyOptional`.

### 4.1 Data (from `WebhookDeliveryResponseData`)

`domain` (`webhook_delivery`), `id` (`nbo…whd`), `eventType`, `endpointId`, `eventId` (`nbo…evt`, the dedupe key), `status` (`pending`, `succeeded`, `failed`, `dead`), `attempts`, `nextAttemptAt`, `lastAttemptAt`, `responseStatus`, `replayedAt`, `replayCount`, `createdAt`. Filters `status` and `eventType` bind directly to real query params.

### 4.2 The guarantee, precisely

Delivery is **at-least-once**, never exactly-once (`WEBHOOK_DELIVERY_GUARANTEE`, carried on every outbound POST as the `x-nombaone-delivery-guarantee` header). A non-2xx or a transport error schedules a retry on backoff `[10s, 1m, 5m, 30m, 2h]`; after 6 attempts the row parks at `dead`. **Dedupe on `event.event.id`** (the frozen, signed identity inside the delivery body), never on the delivery `id`. The reason is structural, not a mechanic of retries: the same event fans out to a **separate delivery row per subscribed endpoint** (five endpoints subscribed to one event produce five distinct `whd` references sharing the identical `evt`), so `event.event.id` is the one field guaranteed to mean "this business event" everywhere it appears, while a delivery `id` only ever identifies one endpoint's copy of it. A developer's dedupe store should key on `event.event.id` for this reason, independent of how any one delivery row behaves internally.

### 4.3 Replay, exactly as the code runs it

Confirmed in `packages/sara/src/webhooks/deliveries.ts`: manual replay **re-arms the same row**: it does not mint a new delivery or event reference. Calling replay on a `dead` or `failed` row resets `status` to `pending`, `attempts` to `0`, sets `nextAttemptAt` to now, stamps `replayedAt`, and increments `replayCount`; the `id` never changes. Calling replay on a `pending` or `succeeded` row is an **idempotent no-op**: it returns the current row unchanged rather than erroring, so a developer who double-clicks Replay never re-fires a delivery that is already in flight or already landed. The console's Replay button reflects this: it is always safe to press, and it is disabled only when there is nothing sensible to replay against (there is no such state; the button stays enabled and no-ops on a live row).

**Automatic replay also exists**, run as a bounded maintenance tick: `dead` deliveries to non-disabled endpoints are re-armed the same way, capped at a `replayCount` ceiling of 3, so a permanently dead endpoint is not retried forever. The console names this in the dead-letter view's copy ("we also retry automatically, up to 3 times, if your endpoint recovers") so a developer isn't surprised to see a row move off `dead` without having pressed Replay themselves.

### 4.4 The raw view

A delivery's detail renders the reconstructed body shape from `apps/api/WEBHOOKS.md` for reference and copy: `{ id, type, event: { id, type, createdAt }, data }`. This is **not** a re-signed replica of the exact bytes that were sent. The console never holds the tenant's plaintext signing secret beyond its one-time reveal (section 3.2), so it cannot recompute `x-nombaone-signature` after the fact. The panel says so: "Shape shown for reference. Verify signatures against your own signing secret." The delivery row's own metadata (`responseStatus`, `attempts`, `nextAttemptAt`) is real and live, not reconstructed.

### 4.5 Empty and error states

- **Loading:** skeleton rows.
- **Empty (no deliveries yet):** "No deliveries yet. They start after the first subscribed event fires." No create action; deliveries are system-generated.
- **Empty (dead-letter filter):** "No dead letters." is a **good state**, stated plainly, not styled as an error.
- **Empty (other filter):** "No deliveries match this filter." with a clear-filter action.
- **Error:** read failures render the retry panel with `meta.requestId`. A stale delivery id on single-fetch or replay surfaces the same `WEBHOOK_ENDPOINT_NOT_FOUND` gap noted in section 3.4.

**Wireframe (Phase A).**

```
┌ Webhooks · https://acme.co/hooks · Deliveries ──────────────────────────┐
│ [status: All ▾ Pending Succeeded Failed Dead]  [eventType ▾]             │
│ ┌──────────┬───────────────────────┬──────────┬─────────┬───────┬──────┐│
│ │ Delivery  │ Event type             │ Status    │ Attempts │ Next  │ Resp ││
│ ├──────────┼───────────────────────┼──────────┼─────────┼───────┼──────┤│
│ │ nbo…whd  │ invoice.paid           │ succeeded │ 1        │ n/a   │ 200  ││
│ │ nbo…whd  │ subscription.churned   │ dead      │ 6        │ n/a   │ 500  ││
│ │ nbo…whd  │ invoice.payment_failed │ pending   │ 2        │ 05:12 │ n/a  ││
│ └──────────┴───────────────────────┴──────────┴─────────┴───────┴──────┘│
│ guarantee: at-least-once · dedupe on event.event.id, not delivery id     │
│                                                          [ Replay dead ] │
└───────────────────────────────────────────────────────────────────────┘

┌ Delivery nbo…whd ────────────────────────────────────────────────────┐
│ event nbo…evt · subscription.churned · replayCount 2 · replayed once  │
│ { "id": "nbo…whd", "type": "subscription.churned",                     │
│   "event": { "id": "nbo…evt", "type": "subscription.churned",          │
│              "createdAt": "2026-06-30T09:11:00.000Z" },                │
│   "data": { "reference": "nbo…sub" } }                                 │
│ Shape shown for reference. Verify signatures against your own secret.  │
│                                                          [ Replay ]     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Events: the feed, the detail, and the catalog

**Purpose.** The audit spine of everything Nomba One does for this tenant, filterable and inspectable, plus the frozen public catalog that backs every webhook subscription.

**Endpoints.**

- `GET /v1/events`, scope `webhooks:read`, query `listEventQuery`: `limit` (1 to 100, default 20), `cursor`, `type` (optional exact match).
- `GET /v1/events/:id`, scope `webhooks:read`, single event.
- `GET /v1/events/catalog`, **public, no `apiKeyAuth`, no scope.** Declared before `/events/:id` in `apps/api/src/apps/main/modules/events/routes.ts` specifically so the literal path segment `catalog` is never captured as an `:id` reference.

### 5.1 Data (from `DomainEventResponseData`)

`domain` (`event`), `id` (`nbo…evt`, the same dedupe key a webhook delivery embeds), `type`, `payload` (the raw stored `data` object, the same keys that get embedded in every delivery for this event), `createdAt`. The feed filters by `type` (exact match on a catalog string, no partial or family-prefix match), and the detail renders `payload` as raw JSON, because raw reads as real, the same voice choice the website's live simulator makes for its webhook console (doc 00, referencing the website plan's §3.5).

**(verify).** `GET /v1/events/:id` currently throws its not-found case tagged with the code `SYSTEM_INTERNAL_ERROR` rather than a dedicated not-found code (confirmed in `apps/api/src/apps/main/modules/events/controllers/get-event.ts`). The console does not depend on the code string here: any 404-status response on this route renders "No event at this reference in {environment}," regardless of which code label the server currently attaches.

**What this screen is not.** `payload` is the raw domain-event row, not the full signed outbound envelope. The signed shape (`{ id, type, event, data }` plus the `x-nombaone-*` headers) only exists on an actual delivery attempt, which is what section 4.4 renders. This screen shows the event itself; section 4 shows what got sent because of it.

### 5.2 The events audit timeline, reused

Every subscription, invoice, and customer detail across the console embeds a filtered view of this same feed as its audit timeline (doc 02 §3.1). This screen is the unfiltered, tenant-wide version of that same data, with the type filter exposed directly.

### 5.3 The catalog

`GET /v1/events/catalog` returns `WEBHOOK_EVENT_CATALOG` verbatim: an object keyed by event type, each entry carrying a one-line `when` (the producing transition) and a `payload` array (the keys the event's `data` object carries). It is **34 entries**: 32 real tenant event types plus 2 deletable `example.created`/`example.settled` scaffold entries, which the console labels "reference scaffold, not a real event" rather than hiding, so a developer who notices them in the raw JSON isn't left guessing. The console renders this as a table with columns type, fires when, and payload keys, grouped by resource family (customer, coupon, discount, plan, price, subscription, invoice, payment method, settlement), and it is the exact source the webhook endpoint's event picker (section 3.3) draws its options from.

This endpoint needs no key and no scope, matching doc 00's "docs are the demo": the catalog is publicly fetchable so a developer can plan an integration before they have created an account.

### 5.4 Empty and error states

- **Loading:** skeleton feed rows; the catalog table renders once, cached, since it never changes per request.
- **Empty (feed):** "No events yet." is valid for a brand-new organization; it is not an error.
- **Empty (filtered):** "No events of this type yet." with a clear-filter action.
- **Error:** read-failure retry panel with `meta.requestId`. The catalog fetch, being public and static, has no meaningful error state beyond a generic retry.

**Wireframe (Phase A).**

```
┌ Developers · Events ────────────────────────────────────────  ●Test ┐
│ [type ▾]                                                              │
│ ┌────────┬──────────────────────────┬─────────────────────────────┐ │
│ │ Event   │ Type                      │ At                          │ │
│ ├────────┼──────────────────────────┼─────────────────────────────┤ │
│ │ nbo…evt│ invoice.payment_recovered │ 2026-07-03 09:11:02          │ │
│ │ nbo…evt│ subscription.churned      │ 2026-07-02 14:40:11          │ │
│ └────────┴──────────────────────────┴─────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

┌ Event nbo…evt · invoice.payment_recovered ─────────────────────────┐
│ { "reference": "nbo…inv" }                                          │
│                                             [ Reproduce this ↓ ]     │
└──────────────────────────────────────────────────────────────────┘

┌ Catalog (34 types) ──────────────────────────────  no key required  ┐
│ Type                          Fires when                  Payload   │
│ invoice.payment_failed        a collection attempt failed  ref,reason│
│ invoice.action_required       card needs OTP/3DS auth       ref,reason,checkoutLink│
│ subscription.churned          dunning exhausted (involuntary) ref   │
│ example.created  (scaffold)   reference resource created    ref     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Inbound triage: `nomba_webhook_events`

**Purpose.** Beside the tenant's own outbound feed, a two-sided view: how Nomba's own provider webhooks landed on this platform's inbound endpoint, for the rare case a developer needs to understand why one of their subscription's charges took the path it did.

**The real gap.** `nomba_webhook_events` is a real table (`packages/core-db/src/schema/nomba-webhook-events.ts`): `id`, `reference`, `organizationId` (nullable, resolved during settlement, not at ingest), `environment`, `provider` (defaults `'nomba'`), `requestId`, `eventType`, `status` (`received`, `processed`, `ignored`, `failed`), `payload`, `receivedAt`, `processedAt`, `createdAt`. A `unique(provider, request_id)` index makes it the durable dedupe spine for inbound provider webhooks, distinct from the outbound `webhook_deliveries` table sections 3 and 4 cover.

**(verify).** No `/v1` route reads this table today. It is written only by the inbound ingest worker, `packages/sara/src/nomba/ingest.ts`; nothing under `apps/api/src/apps/main/modules` selects from it. This screen is specified here as the mandate requires, and it is real, load-bearing data for triage, but it needs a **new endpoint** before it can be built for real, most likely `GET /v1/webhooks/inbound`, scoped to `webhooks:read` and tenant-filtered on the now-nullable `organizationId` (which only resolves once a payload is matched to a settlement), or an admin-scoped equivalent if that resolution makes it fundamentally cross-tenant before settlement. Doc 00's honesty rule applies here to the plan itself: this section is a design spec for a screen whose backing endpoint does not exist, not a description of something already live.

**Data this screen would show, once wired.** `eventType`, `status` (a plain badge: `received` neutral, `processed` success, `ignored` neutral, `failed` danger), `receivedAt`, `processedAt` (null while still in flight), and the raw `payload` on expand, the provider's own JSON, before Nomba One reshapes anything into its own event vocabulary. This is deliberately the provider's-eye view, sitting beside the tenant's-eye view in section 5, so a developer chasing "why didn't my webhook fire" can see both: did Nomba's own webhook arrive at all, and if it did, what did processing it produce.

**Phase A note.** Ship this as a clearly labeled "coming soon" panel next to the Events feed rather than omitting it silently, since the mandate calls for it and the data model already exists; the panel names the missing endpoint rather than faking rows.

```
┌ Inbound (provider-side) ─────────────────────────  endpoint not yet built ┐
│ eventType              Status      Received            Processed         │
│ payment_success         processed   09:10:58             09:11:01         │
│ payment_success         ignored     09:04:02             09:04:02         │
│ (designed against nomba_webhook_events; needs GET /v1/webhooks/inbound)   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 7. Request logs and inspector

**Purpose.** Let a developer correlate one console action, or one of their own API calls, to a concrete server-side identity: a request id, and how close they are to being throttled.

### 7.1 The request id, exactly as the server mints it

Confirmed in `apps/api/src/shared/http/request-id.ts`: every request is stamped `req_${randomBytes(16).toString('base64url')}`, set on `req.requestId`, echoed on the response as the `X-Request-Id` header, and carried through every downstream log line via a correlation context. The success and error envelopes both echo the same value as `meta.requestId`. The console surfaces it in three places: next to every error (doc 02 §1.1), in the reproduce-this panel's response preview (section 9), and in a lightweight per-session request log (7.3).

### 7.2 Rate-limit headers, exactly as the server sets them

Confirmed in `apps/api/src/shared/middlewares/rate-limit.ts`: a fixed 60-second window, keyed per API key. Every rate-limited request carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`; a rejected (429) request additionally carries `Retry-After` in seconds until the window rolls over. The limiter is **fail-open**: a Redis outage never blocks a request, it only stops emitting the count. A separate, coarser **monthly quota** is enforced per organization (not per key) and rejects with `QUOTA_EXCEEDED` rather than `RATE_LIMIT_EXCEEDED` when it is hit. The console treats these as two distinct error surfaces with two distinct hints, never collapsed into one "you're rate limited" message.

The console renders a small headroom indicator near the top bar (doc 01 §1.3) reading the last response's `X-RateLimit-Remaining` over `X-RateLimit-Limit`, and on a 429 it reads `Retry-After` and disables the retry action until that many seconds have passed, counting down rather than leaving a dead button.

### 7.3 The console's own request log

**(verify).** There is no `GET /v1/request-logs` endpoint; nothing server-side persists a queryable request audit trail for this purpose. The panel this section specifies is a **client-side instrumentation log** over calls the console itself made in the current session, keyed off the `X-Request-Id` each call already returns, not a server-backed history a developer can page back through days later. It lists, newest first: the method and path, the status code, `meta.requestId`, and latency. Its value is narrow and honest: "here is the id for the call that failed, so you can hand it to support," not a general-purpose observability surface.

**Wireframe (Phase A).**

```
┌ Developers · Request log (this session) ───────────────────────────────┐
│ Method  Path                          Status  Request id        Latency│
│ POST    /v1/webhooks                  201     req_a1b2c3d4…      212ms │
│ POST    /v1/webhooks/nbo…whk/deliveries/nbo…whd/replay  200  req_9f0e…  88ms│
│ GET     /v1/subscriptions             429     req_7c1e2f0a…       n/a   │
│  Rate limit 40/40 used this minute. Retry after 22s.                    │
└─────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Empty:** "No requests yet this session." on first load.
- **A 429 entry** shows `Retry-After` inline and a live countdown, never a static "try again later."

---

## 8. Test mode: the sandbox-is-real instruments

**Purpose.** Doc 00's test, made literal in the console: a skeptic opens devtools, watches the console fire a real `/v1/test/*` call, and sees the exact same response shape their own integration would get. This sub-area mints deterministic payment methods, forces a billing cycle on demand, and fires a real signed webhook, no cron wait, no real card, no fake timers.

### 8.1 The mount condition, exactly

Confirmed in `apps/api/src/apps/main/server/routes.ts`: `if (env.INFRA_ENVIRONMENT === 'test') { v1Router.use(testRouter); }`. The `/v1/test/*` router does not exist on a live-pinned deployment; it is not merely disabled, it is absent from the mounted stack. The console's nav item follows the identical rule from doc 01 §1.2: rendered only when the current environment is `test` **and** the deployment reports `INFRA_ENVIRONMENT=test`, absent (not greyed out) otherwise. Every handler additionally hard-refuses a non-test `ctx.environment` as defence in depth, returning a 403 `CLIENT_FORBIDDEN` ("The test clock is only available in the test environment") even if somehow reached. The console never relies on the nav being hidden as its only guard.

### 8.2 Mint a deterministic test payment method

`POST /v1/test/payment-methods`, scope `payment_methods:write`, `idempotencyOptional`, body `createTestPaymentMethodBody`: `customerId` (required), `behavior` (one of `success`, `decline_insufficient_funds`, `decline_expired_card`, `decline_do_not_honor`, `requires_otp`, default `success`), `kind` (`card` or `mandate`, default `card`). Returns a real `PaymentMethodResponseData` row (statusCode 201) that is genuinely chargeable in test: every future charge against it resolves exactly per its `behavior`, deterministically, every time. This is what lets a developer script "attach a method that always declines with insufficient funds" instead of hunting for a specific real test card number that happens to trigger that path.

### 8.3 The advance-cycle test clock

`POST /v1/test/subscriptions/:id/advance-cycle`, scope `subscriptions:write`, `idempotencyOptional`. Forces the subscription's next billing cycle **now**, by calling the same `runCycle` the production sweep calls, restricted to `active` and `trialing` subscriptions (`ADVANCEABLE`); any other status returns 422 `SUBSCRIPTION_ILLEGAL_TRANSITION` with a message naming the actual status. Billing stays exactly-once per period: while the current period's invoice is unpaid, a repeat call returns that same invoice rather than posting a second charge; once it is paid, the next call bills the following period. One call advances exactly one cycle. Response `AdvanceCycleResponseData` (statusCode 201): `domain: 'advance_cycle_result'`, `subscriptionId`, `outcome` (`paid`, `past_due`, `pending`, or `open`), and the full `invoice` the cycle produced or found, rendered through the same invoice detail component as doc 02 §13, naira by kobo throughout.

### 8.4 Simulate a webhook

`POST /v1/test/webhooks/simulate`, scope `webhooks:write`, `idempotencyOptional`, body `simulateWebhookBody`: `type` (any string, in practice a catalog type chosen from the section 5.3 picker) and an optional `payload` object to override the default `data`. This emits a **real** domain event and drives it through the real, signed delivery path to every endpoint subscribed to that type. It is not a preview or a dry run. Response `WebhookSimulationResponseData` (statusCode 201): `domain: 'webhook_simulation'`, `event` (the minted `nbo…evt` reference), `type`, `deliveredCount` (how many delivery attempts fired). A developer who finished building an endpoint can fire `invoice.payment_recovered` here and watch the deliveries inspector (section 4) pick up the real row within the second.

### 8.5 Composition

Three action cards, one per instrument, each firing its real POST and each feeding a reproduce-this panel (section 9) so the exact call is copyable into the developer's own test suite. None of the three requires a required `Idempotency-Key`; the console still sends one automatically so a flaky connection never mints two methods or double-fires a simulated webhook.

**Wireframe (Phase A).**

```
┌ Developers · Test mode ────────────────────────────  ●Test only, absent on live ┐
│ ┌ Mint test payment method ─────────────┐ ┌ Advance-cycle test clock ─────────┐│
│ │ Customer  [ nbo…cus ▾ ]                │ │ Subscription [ nbo…sub ▾ ]         ││
│ │ Behavior  [ decline_insufficient_funds▾]│ │        [ Advance one cycle ]      ││
│ │ Kind      [ card ▾ ]                    │ │ outcome: past_due                 ││
│ │        [ Mint method ]                  │ │ invoice nbo…inv  ₦5,000  due ₦5,000││
│ └─────────────────────────────────────────┘ └───────────────────────────────────┘│
│ ┌ Simulate a webhook ────────────────────────────────────────────────────────┐│
│ │ Type [ invoice.payment_recovered ▾ ]   Payload override (optional JSON)     ││
│ │                                              [ Simulate ]                   ││
│ │ event nbo…evt emitted · 2 deliveries fired                                   ││
│ └───────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** each card's own submit button spins; the others stay interactive.
- **Empty:** the customer or subscription picker with no rows routes to "Create one first" inline, never a dead dropdown.
- **Error:** `CLIENT_FORBIDDEN` (reached outside test, defence in depth) renders its hint plainly. `SUBSCRIPTION_ILLEGAL_TRANSITION` on advance-cycle names the actual status and explains only `active` or `trialing` subscriptions bill a cycle. Validation errors render per-field.

---

## 9. "Reproduce this object": the embedded SDK and curl panel

**Purpose.** Every detail drawer in the console, not only in Developers, carries a panel that turns "I can see this in the dashboard" into "I can call this myself right now." This section specifies the panel once, for doc 06 to formalize as a shared component; the examples below are drawn from objects this doc already covers.

### 9.1 What it always contains

Two tabs, **SDK** (`@nombaone/node`) and **curl**, both prefilled with the object's real `nbo…` reference, never a placeholder like `{id}`. The panel switches on the object's `domain` discriminator to choose which call template renders, the same rule doc 01 §0 states for the command palette: never parse the three-letter id suffix to decide behavior.

### 9.2 The SDK tab

Renders the namespaced call a developer would write, matching the object's `domain`: a webhook endpoint's drawer shows `nomba.webhooks.list()` or `nomba.webhooks.retrieve("nbo…whk")`; an event's drawer shows `nomba.events.retrieve("nbo…evt")`; a delivery's drawer shows `nomba.webhooks.deliveries.replay("nbo…whk", "nbo…whd")`. For a mutating call, the panel shows the SDK's own auto-`Idempotency-Key` behavior as a code comment rather than hiding it: `// nomba auto-generates an Idempotency-Key; pass your own as the last argument for cross-restart safety`.

### 9.3 The curl tab

A complete, copy-pasteable request: method, full URL under the current environment's host, `Authorization: Bearer <key>`, `Content-Type: application/json` where a body applies, and, for a mutating call, an `Idempotency-Key` header. The panel **never inlines the merchant's real secret key.** It renders a redacted placeholder, `nbo_test_••••••••`, with a note to substitute the developer's own key from section 2; the one exception is the moment immediately after a fresh key or secret reveal (sections 2.4 and 3.2), where the panel may offer to substitute that newly revealed value for the remainder of the same reveal dialog only, never persisting it into a reusable snippet.

### 9.4 The response preview

Beneath both tabs, a compact preview of the envelope this exact object last returned: `meta.requestId` (section 7.1) and, where relevant, the rate-limit headers (section 7.2), so a developer sees not only the shape of a successful call but the exact correlation id they would hand to support if it had failed.

### 9.5 Worked examples

- **Subscription detail** (doc 02 §3): SDK `await nomba.subscriptions.retrieve("nbo749201835566sub")`; curl `GET /v1/subscriptions/nbo749201835566sub`.
- **Webhook endpoint list** (section 3): SDK `await nomba.webhooks.list()`; curl `GET /v1/webhooks`. The panel notes the response is a plain array, not a paginated page, matching section 3's list behavior exactly.
- **Event detail** (section 5): SDK `await nomba.events.retrieve("nbo…evt")`; curl `GET /v1/events/nbo…evt`.
- **Test payment method mint** (section 8.2): SDK `await nomba.test.paymentMethods.create({ customerId: "nbo…cus", behavior: "decline_insufficient_funds" })`; curl `POST /v1/test/payment-methods` with the same body, both tabs carrying a note that this call only exists on a test-pinned deployment.

**Wireframe (Phase A, the shared panel).**

```
┌ Reproduce this ─ [ SDK ]  curl ─────────────────────────────────────┐
│ await nomba.webhooks.deliveries.replay(                              │
│   "nbo749201835501whk",                                              │
│   "nbo749201835501whd"                                               │
│ )                                                       [ Copy ]      │
│ requestId req_a1b2c3d4e5f6…   X-RateLimit-Remaining 57/60             │
└──────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** the panel renders the template immediately from the object already in memory; it does not wait on a network call to show copyable text.
- **Empty:** not applicable. The panel only ever renders alongside an already-loaded object.
- **Error:** if the object's own load failed, the panel does not render a broken template; it is absent until the object loads.

---

## 10. The API reference: OpenAPI, generated, cannot drift

**Purpose.** The machine spec, and the console's proof that it was not hand-written and cannot silently disagree with the server.

**Endpoint.** `GET /v1/openapi.json`, public, no `apiKeyAuth`, served raw (not wrapped in the platform envelope). Confirmed in `apps/api/src/apps/main/server/routes.ts`: the document is built once by `buildOpenApiDocument(v1Router)` and cached in memory on first hit, then served from cache.

### 10.1 Why it cannot drift

`buildOpenApiDocument` (`apps/api/src/shared/openapi/build.ts`) walks the **actually-mounted** `v1Router` stack at runtime and, for every route, reads the Zod schemas tagged onto its own `validate` middleware. The advertised request shape for any endpoint is the literal schema object the server enforces on that same route, not a separately maintained description of it. The error schema in the generated document enumerates exactly `PUBLIC_ERROR_CODES`, the same set doc 08 renders: a code that is not public cannot appear in the spec, and a code that is public cannot be missing from it.

### 10.2 What differs by environment, and why that is the point

Because the document is built by walking the router that is actually mounted, a **test**-pinned deployment's spec includes the full `/v1/test/*` family (section 8), and a **live**-pinned deployment's spec omits it entirely: not marked deprecated, only absent, because the route is absent. The console fetches its own active environment's `/v1/openapi.json`, so switching the environment control (doc 01 §1.4) and re-opening this screen is a concrete, honest demonstration of "the spec cannot drift" and "test mode does not exist on live" at once.

### 10.3 Composition

The console embeds a rendered viewer over the fetched document (grouped by tag or path, each operation showing its parameters, its request schema, and its response shape) plus a plain "View raw JSON" link to `/v1/openapi.json` directly, useful for importing into an external tool (Postman, Insomnia, a codegen pipeline). It never re-authors example values by hand; every example is derived from the same schemas the server enforces.

**Wireframe (Phase A).**

```
┌ Developers · API reference ───────────────────────────  ●Test  [ View raw JSON ↗ ]┐
│ Webhooks                                                                            │
│  POST   /v1/webhooks                body: { url, enabledEvents }                    │
│  GET    /v1/webhooks                (no query params, not paginated)                │
│  GET    /v1/webhooks/{id}/deliveries  query: { limit, cursor, status, eventType }    │
│ Test  (present only because this deployment is test-pinned)                         │
│  POST   /v1/test/payment-methods    body: { customerId, behavior, kind }             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton operation list while the document fetches; it is cached after the first hit so subsequent visits render instantly.
- **Error:** a fetch failure renders the retry panel with `meta.requestId`. Because this route bypasses the platform envelope, a failure here is a raw HTTP error rather than the standard error shape, and the console's retry copy says so rather than looking for `error.hint` on a body that will not have one.

---

## 11. Phase A and Phase B done criteria, per screen group

**API keys (section 2).**

- Phase A done: list (test and live, separately), create form grouped by resource family, and the once-shown secret frame exist in `.pen`, with the console-auth-API dependency named plainly on the frame rather than faking live data.
- Phase B done: gated entirely on doc 09's console-auth API shipping; once it does, create, list, and revoke hit their real endpoints, the secret renders in the copy-once field exactly once, and all four `API_KEY_*` codes render their real hints.

**Webhooks: endpoints and deliveries (sections 3 and 4).**

- Phase A done: endpoint list (flat, unpaginated), create and edit forms, the once-shown secret frame, and the nested deliveries table with status and event-type filters all exist, showing the disable-not-delete model and the guarantee-and-dedupe copy verbatim.
- Phase B done: create, update, disable, and rotate hit their real endpoints with optional idempotency; the deliveries list binds `status` and `eventType` to real query params; replay is always enabled and its no-op behavior on a live row is verified; the raw-shape panel renders without claiming to hold a real signature.

**Events: feed, detail, and catalog (section 5).**

- Phase A done: the feed with a type filter, the raw-JSON detail, and the 34-entry catalog table (grouped by resource family, the two scaffold entries labeled) all exist.
- Phase B done: the feed and detail hit their real endpoints; the catalog fetch requires no key; the event picker in section 3.3 is proven to read from this same catalog response, not a hand-maintained copy.

**Inbound triage (section 6).**

- Phase A done: the panel exists, clearly labeled with the missing endpoint named, so the gap is visible in the design artifact itself, not only in this doc.
- Phase B done: gated on a new endpoint shipping (most likely `GET /v1/webhooks/inbound`); this doc's Phase B is not reachable until that lands.

**Request logs (section 7).**

- Phase A done: the headroom indicator, the per-session request log, and the 429 countdown treatment exist.
- Phase B done: `X-Request-Id`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` are read from real response headers on every console-initiated call; `QUOTA_EXCEEDED` and `RATE_LIMIT_EXCEEDED` render as two distinct states.

**Test mode (section 8).**

- Phase A done: the three instrument cards exist, each showing its real body fields and its real response shape, with the environment-gated absence (not a disabled state) modeled on the frame itself.
- Phase B done: all three hit their real `/v1/test/*` endpoints; the nav item and the screen are both structurally absent when `INFRA_ENVIRONMENT` is not `test`, matching the server's own mount condition exactly; `SUBSCRIPTION_ILLEGAL_TRANSITION` and the defence-in-depth `CLIENT_FORBIDDEN` both render their real hints.

**Reproduce this object (section 9).**

- Phase A done: the shared panel frame exists with SDK and curl tabs, the redacted-secret rule visible, and at least the four worked examples from section 9.5 represented.
- Phase B done: the panel is proven to render correctly off the `domain` discriminator for every object type in the console, not only the four worked examples; no panel ever contains a real, un-redacted secret outside its one-time reveal dialog.

**API reference (section 10).**

- Phase A done: the embedded viewer frame and the raw-JSON link exist.
- Phase B done: the viewer renders the live `/v1/openapi.json` for the console's active environment; switching environment and reloading is verified to change which operations appear (`/v1/test/*` present only on a test-pinned deployment).

Proceed to doc 05.

