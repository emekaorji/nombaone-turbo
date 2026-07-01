# apps/api — Build Plan 07 · Outbound webhooks & event catalog

> Formalize the **outbound event delivery contract** (rubric G): finalize the C.6 event catalog with
> documented payload shapes and fire-points, per-tenant **HMAC-signed** deliveries the tenant verifies,
> retry with **exponential backoff on non-2XX** (mirroring Nomba), a **stable per-event id** (`EVT`) for
> consumer dedupe, an explicitly-stated **at-least-once** guarantee, and a **dead-letter store + manual /
> automatic replay** for deliveries that exhaust retries — all built ON the existing webhooks primitives.
> **Depends on:** 00 (envelope/middleware chain/idempotency/cursor pagination/scopes; `domain_events`,
> `webhook_endpoints`, `webhook_deliveries` already exist), 03–06 (the producers that `emitEvent(...)` the
> catalog: subscription/invoice/payment_method/dunning events). **Unblocks:** 08 (`settlement.created`
> fans out through this delivery path), 09 (renders this catalog into the public OpenAPI + docs app, and
> exposes delivery/dead-letter metrics).

---

## Objective & scope

The webhook **infrastructure already exists** and works (`sign.ts`, `deliver.ts`, `endpoints.ts`, the
`emitEvent` outbox, the `outbound-webhook` queue + worker). This phase does **not** re-spec those — it
turns the working machinery into a **stated, tested, documented contract**: a frozen catalog, a verifiable
signing scheme, a policy declaration (at-least-once + backoff), and the two missing operator capabilities
(a queryable dead-letter view and a **replay** operation). It is a formalization + replay phase, not a
greenfield one.

**In scope**
- **Finalize the C.6 catalog** as a single source of truth in code: a typed, frozen `WEBHOOK_EVENT_TYPES`
  registry naming every event (the minimum `subscription.*` / `invoice.*` set plus the product set), its
  payload **shape** (typed), and a one-line **when-it-fires** description. Producers in 03–06 reference
  these constants instead of bare strings.
- **Per-tenant HMAC signing — formalized & proven.** The scheme already lives in `sign.ts` /
  `endpoints.ts` (per-endpoint secret, hash-at-rest, `HMAC-SHA256(secret, rawBody)` hex). This phase
  freezes the **wire contract** (header names, signed-body shape, the exact key a tenant recomputes) and
  proves a tenant can independently verify a real delivery.
- **Retry with exponential backoff on non-2XX**, mirroring Nomba's own model — already in `deliver.ts`'s
  `BACKOFF_MS`; this phase states it as policy, adds the per-tenant-visible `attempts` / `nextAttemptAt`,
  and tests the schedule.
- **Stable unique event id** (`EVT` reference) carried inside the signed body so consumers dedupe — already
  emitted; this phase asserts it is present, stable across redeliveries, and documented as the dedupe key.
- **Delivery guarantee stated**: at-least-once; consumers are told (in the catalog doc + per-delivery
  header) to dedupe on the event id. No exactly-once claim.
- **Dead-letter store + replay ★**: a queryable dead-letter listing (deliveries in terminal `dead`) and a
  **replay** operation — manual (operator/tenant re-arms a `dead` delivery) and automatic (a bounded
  auto-replay sweep for transient dead-letters), both **idempotent** and **replay-safe**.
- **API**: `/v1/webhook-endpoints` CRUD + **rotate secret**, `/v1/events` (list the emitted domain events),
  `/v1/webhook-deliveries` (list + filter by status/event/endpoint, **replay** dead-lettered).
- **Catalog content** (names / payload shapes / when each fires) authored here as the canonical reference
  the docs app (09) renders — produced, not rendered.

**Out of scope (owned elsewhere — do not poach)**
- **Inbound** Nomba webhooks (verify → dedup on `requestId` → fast-ack → verify-again-then-act) are **02**;
  this phase is strictly **outbound** (us → tenant).
- The **docs-app rendering** of the catalog (the HTML pages) is the docs app / **09**; we author the catalog
  content + the machine-readable registry, we do not build the docs UI.
- **Producing** new event kinds beyond C.6 — the producers in 03–06 already emit; here we only **name and
  type** them. `settlement.created` is wired by **08**.
- The base **queue/worker** mechanics (concurrency, BullMQ options) are infrastructure that already exists;
  we only add a repeatable auto-replay tick and reference the existing drain.

---

## Rubric coverage

This phase owns rubric **section G in full**, plus the G-facing slivers of **L** and **N**.

| Box | Item | Where demonstrated |
|---|---|---|
| **G1** | Documented event set incl. the minimum `subscription.created/updated/canceled`, `invoice.paid/payment_failed/payment_recovered` | `WEBHOOK_EVENT_TYPES` registry + catalog doc; `GET /v1/events` lists real emitted events |
| **G2 ⚠** | Outbound events **signed (HMAC) with a per-tenant secret the tenant can verify** | `sign.ts` (formalized wire contract) + tenant-verification e2e |
| **G3** | Failed deliveries **retried with exponential backoff on non-2XX** | `deliver.ts` `BACKOFF_MS` policy + backoff-schedule e2e |
| **G4** | Each event carries a **stable, unique event id** for dedupe | `EVT` reference in the signed body; redelivery-stability e2e |
| **G5** | Delivery guarantees **explicitly stated** (at-least-once; dedupe) | catalog doc statement + `x-nombaone-delivery-guarantee` header + e2e |
| **G6 ★** | **Dead-letter store** + manual/automatic **replay** for exhausted events | `dead` status + replay op + `POST /v1/webhook-deliveries/:ref/replay` + auto-replay tick; replay e2e |
| **G7** | **Full catalog documented** (names, payload shapes, when each fires) for downstream devs | the authored catalog reference + typed payloads; consumed by 09 |
| **L12** | The webhook event reference is part of the public docs surface | the registry is the machine-readable source 09's OpenAPI/docs renders |
| **N3** | Webhook signatures generated **outbound** (the G half of N3) | outbound signing proven (pairs with 02's inbound half) |
| **N4** | Every webhook route enforces auth + scope; no unauthenticated mutating route | route middleware chain + auth/isolation e2e |

---

## Design notes

- **Build on, don't rebuild.** `sign.ts`, `endpoints.ts`, `deliver.ts`, `emit.ts`, the `outbound-webhook`
  queue and worker are correct and stay. The deltas are: (1) a typed catalog registry, (2) `rotateSecret`
  + `updateEndpoint` on the endpoints slice, (3) a `replayDelivery` + `autoReplayDeadLetters` op on the
  deliver slice, (4) read queries for events + deliveries, (5) the three API modules, (6) the catalog doc.

- **The signing key the tenant uses.** Per `endpoints.ts`, the HMAC key is the **sha256 of the plaintext
  secret** (the at-rest hash), not the plaintext itself. The wire contract we freeze and document for
  tenants is therefore: *recompute `key = sha256(plaintextSecret)` once, then verify every delivery with
  `HMAC-SHA256(key, rawBytes) == x-nombaone-signature` (lowercase hex), comparing against the **exact raw
  body** received.* This is load-bearing — the catalog doc states it verbatim so a tenant's verifier
  matches `signWebhookPayload`. **Rotate** mints a new plaintext (returned once), overwrites the hash +
  prefix, and is scope/tenant-pinned; in-flight `pending`/`failed` deliveries re-sign with the new key on
  their next drain (acceptable — the doc tells tenants to keep the prior key briefly during rotation, or
  rotate during a quiet window).

- **The signed body shape is frozen** (from `deliver.ts` `buildBody`) and documented:
  ```jsonc
  {
    "id":   "nbo…WHD",          // the DELIVERY reference (unique per attempt-target)
    "type": "invoice.paid",      // the event type
    "event": { "id": "nbo…EVT", "type": "invoice.paid", "createdAt": "ISO-8601 UTC" },
    "data": { /* the typed payload for this event type */ }
  }
  ```
  **`event.id` (the `EVT` reference) is the dedupe key** — stable across every redelivery of the same
  event to the same endpoint (the delivery row's `eventId` never changes; only `attempts`/`nextAttemptAt`
  move). The `data` shape is exactly the `payload` the producer wrote to `domain_events`; the catalog types
  each shape. The id lives **inside** the signed body (not only in a header) so it cannot be spoofed apart
  from the signature.

- **Delivery guarantee — at-least-once, stated.** We mark a delivery's outcome only **after** the POST
  resolves (`deliver.ts`), so a crash mid-flight re-drains the row → a receiver can see a duplicate.
  Therefore: **at-least-once, dedupe on `event.id`.** Stated three ways: in the catalog doc, in a constant
  `WEBHOOK_DELIVERY_GUARANTEE = 'at-least-once'`, and on every POST as `x-nombaone-delivery-guarantee`.

- **Backoff policy = Nomba-mirroring exponential.** `deliver.ts` `BACKOFF_MS = [10s, 1m, 5m, 30m, 2h]`
  indexed by the failed-attempt number, with `MAX_ATTEMPTS = 6` → terminal `dead`. We declare this as the
  documented policy and surface `attempts`/`nextAttemptAt`/`lastAttemptAt` on the delivery DTO so tenants
  can see the retry state. We do **not** change the schedule; we test it.

- **Dead-letter + replay ★.** `dead` already exists as the terminal status (`webhook_delivery_status`
  enum). The store is therefore the existing table filtered to `status = 'dead'`. **Replay** re-arms a
  `dead` (or a still-`failed`) delivery: reset `status → 'pending'`, `attempts → 0`, `nextAttemptAt → now`,
  stamp `replayedAt` / increment `replayCount`, then enqueue the existing drain — the **same** row, so no
  duplicate event id is minted and consumers still dedupe on the unchanged `event.id`. **Manual** replay is
  the API endpoint; **automatic** replay is a bounded, repeatable tick that re-arms dead-letters whose
  endpoint is healthy again, capped so a permanently-dead endpoint is not retried forever (a
  `replayCount` ceiling). Replay is idempotent: replaying an already-`pending`/`succeeded` row is a no-op
  success, replaying across a double-fire re-arms once (guarded on `status = 'dead'`).

- **Tenant scope.** Endpoints/events/deliveries reads are pinned to `ctx.organizationId` + `ctx.environment`
  (deliveries join through `endpoint`/`event` for env, or carry their own `organizationId`). The **drain**
  itself stays platform-wide (it is infra, per `deliver.ts`'s note) but every **API** surface is
  tenant-scoped; cross-tenant reads/replays are `NotFound`, never a leak.

- **No schema rewrite.** We add only what replay needs: `replayed_at` + `replay_count` columns on
  `webhook_deliveries`, and a partial index for the dead-letter list. Everything else is reused as-is.

---

## Tasks (layer by layer)

### DB (core-db)

- [x] Extend `webhook_deliveries` (`packages/core-db/src/schema/webhook-deliveries.ts`) with replay audit
      columns: `replayedAt` (`timestamp` tz, nullable — last manual/auto replay), `replayCount` (`integer`
      notNull default `0` — ceiling for auto-replay). No change to the `webhook_delivery_status` enum
      (`pending|succeeded|failed|dead` already covers the dead-letter terminal). **Proof:** columns present
      in the generated migration; `WebhookDeliveryRow` type picks them up.
- [x] Add a **dead-letter list index**: partial index on `(organization_id, status, created_at desc)` (or a
      keyset `(organization_id, status, created_at desc, id desc)`) to serve `GET /v1/webhook-deliveries`
      filtered to `dead`/by-status without a scan. **Proof:** index in the migration; `EXPLAIN` on the list
      query uses it.
- [x] `pnpm db:generate` then `pnpm db:migrate` — one clean migration; applies on a fresh testcontainer DB.
      **Never `push`.** **Proof:** migration file committed; e2e harness boots it green.

### Contracts (core-contracts)

- [x] **Event catalog registry** — `packages/core-contracts/src/types/webhook-events.ts`: a frozen
      `WEBHOOK_EVENT_TYPES` (`as const`) listing every C.6 event type; a `WebhookEventType` union derived
      from it; and a typed `WebhookEventPayloadMap` mapping each type → its payload shape (referencing the
      existing response DTO types where a payload mirrors a resource, e.g. `subscription.*` →
      subscription snapshot, `invoice.*` → invoice snapshot). Export `WEBHOOK_DELIVERY_GUARANTEE =
      'at-least-once' as const`. **Proof:** every string a producer emits in 03–06 is a member of the
      union (a `satisfies` check at the producer call sites compiles).
- [x] Extend `types/webhook.ts`: add `replayedAt`/`replayCount` to `WebhookDeliveryResponseData`; add
      `nextAttemptAt`/`responseStatus` (retry-state visibility for G3); add `DomainEventResponseData`
      (`id`, `type`, `payload`, `createdAt`) for `GET /v1/events`; add `RotatedWebhookSecretResponseData`
      (extends endpoint DTO with the one-time `signingSecret`).
- [x] Extend `validations/webhook.ts`: `updateWebhookEndpointBody` (`url?`, `enabledEvents?`,
      `disabled?` — partial, refined non-empty); `listWebhookEndpointQuery` (cursor); `listEventQuery`
      (cursor + `type?` filter); `listWebhookDeliveryQuery` (cursor + `status?` ∈ delivery-status enum +
      `eventType?` + `endpoint?` filters); reuse `createWebhookEndpointBody`. **Proof:** schemas exported
      from the validations barrel; `validate({...})` parses them in the e2e.
- [x] No new scopes needed — `webhooks:read` / `webhooks:write` already exist in `ApiKeyScope`
      (`types/api-key.ts`); `events`/`deliveries` reuse `webhooks:read`, replay/rotate use `webhooks:write`.

### Domain (sara)

Extend the existing `@nombaone/sara/webhooks` and `@nombaone/sara/events` slices. Signatures follow the
B.6 `(db, ctx, input)` idiom; every write is scope-pinned; replay is idempotent.

- [x] `events/catalog.ts` (new, exported via `@nombaone/sara/events`): re-export `WEBHOOK_EVENT_TYPES` and
      the payload map as the **producer-facing** constants, plus a typed `emit<T extends WebhookEventType>`
      thin wrapper (or a `satisfies WebhookEventType` guard helper) so producers cannot emit an
      undocumented type. **Invariant:** the catalog is the only place event-type strings are defined.
- [x] `webhooks/endpoints.ts` — **add**, do not rewrite:
  - `updateWebhookEndpoint(db, ctx, reference, input)` → patch `url`/`enabledEvents`/re-enable; scope-pinned
    existence check first (mirrors `disableWebhookEndpoint`); `NotFound` on foreign/unknown.
  - `rotateWebhookSecret(txDb, ctx, reference)` → mint a new plaintext via `generateSigningSecret`,
    overwrite `signingSecretHash` + `signingSecretPrefix`, return `{ reference, signingSecret,
    signingSecretPrefix }` (plaintext escapes **once**, same discipline as create). Scope-pinned;
    `NotFound` otherwise.
  - `getWebhookEndpoint(db, ctx, reference)` + keep `listWebhookEndpoints` (already present).
- [x] `webhooks/deliveries.ts` (new file in the slice): read + replay ops.
  - `listWebhookDeliveries(db, ctx, query)` → cursor list, tenant-scoped, filterable by
    `status`/`eventType`/`endpoint`. **Dead-letter view** = `status: 'dead'`.
  - `getWebhookDelivery(db, ctx, reference)`.
  - `replayDelivery(db, ctx, reference)` → scope-pinned; **guard on `status ∈ {dead, failed}`** (replaying
    `pending`/`succeeded` is an idempotent no-op success); reset `status → 'pending'`, `attempts → 0`,
    `nextAttemptAt → now`, stamp `replayedAt`, `replayCount += 1`; then `enqueueOutboundWebhook` (jobId =
    delivery reference → idempotent enqueue). Re-arms the **same** row → the `event.id` consumers dedupe on
    is unchanged. Emits no new event (replay is an operation, not a state change). **Invariant:** no new
    `WHD`/`EVT` reference is minted.
  - `autoReplayDeadLetters(db, opts?)` → platform-wide (infra, like `deliverPending`): re-arm `dead`
    deliveries to **non-disabled** endpoints whose `replayCount < AUTO_REPLAY_CEILING`, bounded by `limit`;
    returns a count summary. Idempotent and bounded so a permanently-dead endpoint is not retried forever.
- [x] `events/queries.ts` (new): `listDomainEvents(db, ctx, query)` (cursor, tenant-scoped, `type?` filter)
      + serialize, backing `GET /v1/events`.
- [x] `webhooks/serialize.ts` + `events/serialize.ts`: row → response DTO mappers (ISO-8601 UTC timestamps,
      reference as `id`, never leak `signingSecretHash`/internal PK). Update the slice barrels
      (`webhooks/index.ts`, `events/index.ts`).
- [x] **No changes to** `sign.ts` (correct), `deliver.ts` (backoff/dead-letter correct), `emit.ts` (outbox
      correct) beyond importing the catalog types for producer safety. Document this explicitly in the PR.

### API (apps/api)

Three modules under `apps/api/src/modules/`, each B.2-shaped (`routes.ts`, `index.ts`,
`controllers/<one-per-endpoint>.ts`, thin), built with `jsonHandler`/`paginatedHandler`, fixed
middleware order `apiKeyAuth → rateLimit → requireScope → idempotency → validate → controller`
(reads skip `idempotency`). Mount all three under `/v1` in `app/main/routes.ts`.

- [x] `modules/webhook-endpoints/`:
  - `POST   /v1/webhook-endpoints`               `webhooks:write` + idempotency → `createWebhookEndpoint` (secret once)
  - `GET    /v1/webhook-endpoints`               `webhooks:read`  → `listWebhookEndpoints`
  - `GET    /v1/webhook-endpoints/:reference`    `webhooks:read`  → `getWebhookEndpoint`
  - `PATCH  /v1/webhook-endpoints/:reference`    `webhooks:write` + idempotency → `updateWebhookEndpoint`
  - `DELETE /v1/webhook-endpoints/:reference`    `webhooks:write` + idempotency → `disableWebhookEndpoint` (soft)
  - `POST   /v1/webhook-endpoints/:reference/rotate-secret` `webhooks:write` + idempotency → `rotateWebhookSecret` (secret once)
- [x] `modules/events/`:
  - `GET    /v1/events`                          `webhooks:read`  → `listDomainEvents` (cursor, `type?`)
  - `GET    /v1/events/:reference`               `webhooks:read`  → get one
- [x] `modules/webhook-deliveries/`:
  - `GET    /v1/webhook-deliveries`              `webhooks:read`  → `listWebhookDeliveries` (cursor; `status?`=`dead` is the dead-letter view)
  - `GET    /v1/webhook-deliveries/:reference`   `webhooks:read`  → `getWebhookDelivery`
  - `POST   /v1/webhook-deliveries/:reference/replay` `webhooks:write` + idempotency → `replayDelivery`
- [x] Controllers are thin: parse `ctx` from auth, call the sara function, shape the envelope. The
      one-time `signingSecret` is returned **only** from create + rotate responses, never on read.

### Wiring

- [x] **Auto-replay tick:** register a repeatable job on the existing `outbound-webhook` queue (or a small
      sibling) that calls `autoReplayDeadLetters(db, { limit })` on a cadence (e.g. every 15 min), draining
      dead-letters whose endpoints recovered. Reuse the existing worker pattern in
      `super-modules/worker/workers/outbound-webhook.ts`; do not spin a new infra path.
- [x] **Replay enqueue:** `replayDelivery` calls `enqueueOutboundWebhook` so a manual replay is picked up
      immediately (jobId = delivery reference keeps it idempotent), rather than waiting for the next drain.
- [ ] **Producer safety:** at each `emitEvent(...)` call site in 03–06, type the `type` against
      `WebhookEventType` (import the catalog) so an undocumented event cannot ship. (Mechanical edit;
      no behavior change.) **DEFERRED** — the catalog registry + `eventType()`/`isCatalogEventType()`
      guards ship and are the source of truth; wiring the `satisfies` guard into every one of ~40 emit
      sites is a mechanical follow-up left out to avoid churn/regression risk across the phase-03–06 suite.
- [x] **No queue/worker rewrite** — the drain, concurrency cap, and BullMQ options stay.

### Catalog documentation (produced here, rendered by 09)

- [x] Author the **canonical outbound event catalog** as the machine-readable `WEBHOOK_EVENT_TYPES` registry
      (types + payload shapes in code) **plus** a human reference section: for **each** C.6 event — exact
      `type` string, **when it fires** (the producing transition), and an example **payload shape**. Cover
      the full C.6 set: `customer.created`, `plan.created/updated`, `subscription.created/updated/
      trial_will_end/activated/paused/resumed/canceled/churned`, `invoice.created/finalized/paid/
      payment_failed/payment_recovered/voided`, `payment_method.attached/updated/expiring`,
      `settlement.created`. **State the verification recipe** (`key = sha256(secret)`,
      `HMAC-SHA256(key, rawBody)` hex), **the signed-body shape**, **the dedupe key** (`event.id`), and the
      **at-least-once guarantee**. This is the content 09's docs app + OpenAPI renders — not the rendering.

### Tests

Vitest. Unit in `sara` for pure logic; e2e in `apps/api` against testcontainers Postgres + Redis booting
real migrations. No network (fake receiver via a local HTTP listener / `fetch` mock).

- [x] **unit (sign):** `signWebhookPayload` ↔ `verifyWebhookSignature` round-trip; a tenant-side verifier
      that recomputes `sha256(plaintext)` then `HMAC-SHA256` over the raw body matches our signature
      byte-for-byte (the **frozen wire contract** — proves G2/N3).
- [x] **unit (catalog):** every member of `WEBHOOK_EVENT_TYPES` has a payload entry in the map; the minimum
      G1 set (`subscription.created/updated/canceled`, `invoice.paid/payment_failed/payment_recovered`) is
      present; no producer string is outside the union.
- [x] **unit (backoff):** `backoffFor(n)` yields the documented `[10s,1m,5m,30m,2h]` schedule; attempt
      `MAX_ATTEMPTS` parks the row `dead` (G3 schedule + dead-letter transition).
- [x] **unit (replay):** `replayDelivery` on a `dead` row resets `status/attempts/nextAttemptAt`, stamps
      `replayedAt`, increments `replayCount`, mints **no** new reference; replaying a `succeeded`/`pending`
      row is a no-op; double-replay re-arms once (idempotent — G6).
- [x] **e2e (delivery happy path):** create endpoint (capture the one-time secret) → emit an event via a
      real producing call → drain via `deliverPending` against a **fake receiver** that records the request
      → assert: 2xx → row `succeeded`; the **body matches the frozen shape**; `event.id` present; the
      **fake receiver verifies the signature with the documented recipe** (G2, G4, G7).
- [x] **e2e (backoff + dead-letter):** fake receiver returns `500` → assert `attempts` increments,
      `status='failed'`, `nextAttemptAt` advances per the schedule; after `MAX_ATTEMPTS` the row is `dead`
      and appears in `GET /v1/webhook-deliveries?status=dead` (G3, G6 store).
- [x] **e2e (replay):** dead-letter a delivery → `POST /v1/webhook-deliveries/:ref/replay` → fake receiver
      now returns `200` → assert the **same** delivery reference flips to `succeeded`, `replayCount=1`, and
      the **event.id is unchanged** (consumer dedupe holds across replay) (G6).
- [x] **e2e (dedupe stability):** force a redelivery (transient 500 then 200) → assert `x-nombaone-delivery`
      (the delivery ref) may change per attempt-target but `event.id` in the body is **stable**, and
      `x-nombaone-delivery-guarantee: at-least-once` is present on every POST (G4, G5).
- [x] **e2e (rotate):** rotate secret → new prefix returned once → a delivery signed after rotation verifies
      with the **new** key and fails with the old (G2 rotation safety).
- [x] **e2e (auth + isolation):** every route rejects a missing/invalid key and wrong scope; Tenant A cannot
      list/get/replay Tenant B's endpoints/events/deliveries (cross-tenant → `NotFound`) (N4).

---

## Verification checklist (rubric)

> **★ PHASE 07 COMPLETE (2026-07-01, `build/apps-api`).** The outbound webhook surface is now a stated,
> tested, documented contract on the existing machinery: a frozen `WEBHOOK_EVENT_CATALOG` registry (C.6 +
> product set, typed payload shapes), per-tenant HMAC signing proven independently verifiable with the
> documented recipe (`key = sha256(secret)` → `HMAC-SHA256(key, rawBody)`) + rotation-safe, exponential
> backoff → dead-letter, a stable `EVT` dedupe key inside the signed body, an explicit at-least-once
> guarantee (constant + `x-nombaone-delivery-guarantee` header), and the ★ dead-letter store + manual
> (`POST …/replay`, same row) + automatic (`autoReplayDeadLetters`) replay. Three API modules
> (`/v1/webhook-endpoints` CRUD+rotate, `/v1/events`, `/v1/webhook-deliveries`+replay) + a `webhook-maintenance`
> cron (drain + auto-replay). Doc: `apps/api/WEBHOOKS.md`. Migration 0011 (replay columns + status index).
> Green: type-check 9/9, build 5/5, **111 sara unit (+5) + 72 api e2e (+6)**. **Deferred (honest):** typing
> every one of ~40 `emitEvent` sites against the union — the catalog + guards ship; the per-site `satisfies`
> is a mechanical follow-up left out to avoid churn/regression risk.

- [x] **G1** — the documented event set exists as `WEBHOOK_EVENT_TYPES` and includes the minimum
      `subscription.created/updated/canceled` + `invoice.paid/payment_failed/payment_recovered`;
      `GET /v1/events` lists real emitted events. *Demonstrated by:* the catalog unit test (minimum-set
      assertion) + the events list e2e.
- [x] **G2 ⚠** — outbound deliveries are HMAC-signed with the **per-tenant** secret; a tenant independently
      verifies. *Demonstrated twice:* read — `sign.ts`/`endpoints.ts` (per-endpoint hash-at-rest key);
      run — the sign round-trip unit test + the happy-path e2e where the fake receiver verifies with the
      documented recipe, and the rotate e2e.
- [x] **G3** — failed deliveries retry with **exponential backoff on non-2XX**. *Demonstrated by:* the
      `backoffFor` unit test (the `[10s,1m,5m,30m,2h]` schedule) + the backoff e2e advancing `nextAttemptAt`.
- [x] **G4** — each event carries a **stable unique event id** for dedupe. *Demonstrated by:* the
      dedupe-stability e2e asserting `event.id` is the `EVT` reference and is unchanged across redeliveries
      and replays.
- [x] **G5** — delivery guarantee **stated** (at-least-once; dedupe on event id). *Demonstrated by:* the
      `WEBHOOK_DELIVERY_GUARANTEE` constant + the `x-nombaone-delivery-guarantee` header (e2e asserts it) +
      the catalog doc statement.
- [x] **G6 ★** — a **dead-letter store** + **manual/automatic replay** exist. *Demonstrated by:* `status=dead`
      list view, `POST …/replay` flipping the same row to `succeeded`, the `autoReplayDeadLetters` tick, and
      the replay unit + e2e (idempotent, no new reference).
- [x] **G7** — the **full catalog** (names, payload shapes, when each fires) is documented for downstream
      devs. *Demonstrated by:* the authored catalog reference + the typed `WebhookEventPayloadMap` (every
      type has a shape), consumed by 09.
- [x] **L12** — the webhook event reference is part of the public-docs surface. *Demonstrated by:* the
      machine-readable registry 09 renders into OpenAPI/docs (handoff verified, full render is 09).
- [x] **N3** — webhook signatures generated **outbound**. *Demonstrated by:* the outbound signing proof
      (pairs with 02's inbound verification half).
- [x] **N4** — every webhook route is authed + scoped; no unauthenticated mutating route. *Demonstrated by:*
      the auth + isolation e2e (missing key / wrong scope / cross-tenant all rejected).
- [x] `pnpm type-check`, `pnpm build`, `pnpm test` all green across the workspace.

---

## Done when

The outbound webhook surface is a **stated, tested, documented contract** on top of the existing machinery:
the **C.6 catalog is frozen** in a typed `WEBHOOK_EVENT_TYPES` registry with a payload shape and fire-point
for every event (the minimum `subscription.*`/`invoice.*` set included), deliveries are **per-tenant
HMAC-signed** and independently verifiable with a documented recipe (rotation-safe), failures **retry with
exponential backoff on non-2XX** and surface their retry state, every delivery carries a **stable `EVT`
event id** consumers dedupe on under an explicitly **at-least-once** guarantee, exhausted deliveries land in
a **queryable dead-letter store** with both **manual (`POST …/replay`) and automatic** idempotent replay,
and the three API modules (`/v1/webhook-endpoints` CRUD + rotate, `/v1/events`, `/v1/webhook-deliveries` +
replay) are auth- and scope-guarded and tenant-isolated. Every rubric box above is green (the `★` G6
demonstrated, the `⚠` G2 verified twice — read + run), and `pnpm type-check`, `pnpm build`, `pnpm test` pass
across the workspace. The phase hands **08** a delivery path for `settlement.created` and **09** the
machine-readable catalog to render into the public OpenAPI + docs and the delivery/dead-letter metrics.
