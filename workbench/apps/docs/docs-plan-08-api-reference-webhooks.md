# Docs — Plan 08 · API Reference (hand-authored per endpoint) + Webhooks + the rail-switcher

> Hand-author a per-operation reference page for all ~80 endpoints across 18 modules, render the webhook event catalog + signing/retry/replay/dedupe from the frozen SSOT, and ship the persistent `<RailSwitcher>` — every page kept honest by the Phase-03 gate. Prerequisites: 03 (runnable spine), 04 (error reference). Serves tenets: 3 (buffet), 5 (the API is the product), 6 (docs are the demo), 8 (honest about hard parts), 9 (errors are a feature), 10 (one language).

## Goal

Turn the current 1-page reference (`content/reference/examples.mdx`, the deletable scaffold) into a complete, hand-authored, three-column reference that documents **every mounted operation** and the **whole webhook system**, with:

- one MDX page per operation, each carrying `<EndpointHeader>`, `<ParamField>`/`<ResponseField>` for **both** the happy (200/201) **and** the real error variants (tenet 9 — no happy-path-only page), a multi-language `<RequestExample>` from the Phase-03 buffet engine, and a live `<ApiExplorer>` seeded with realistic (non-`example`) data;
- every money field carrying the integer-**kobo** unit rail (`<MoneyUnit>` from Phase 07) and every referenced error code auto-linking to `/errors#CODE` (Phase 04);
- the **webhook event catalog** rendered from `packages/core-contracts/src/types/webhook-events.ts` (no drift possible), each event showing its producing transition, payload shape, the at-least-once guarantee + the `x-nombaone-delivery-guarantee` header, an inline `<WebhookVerifier>` seeded with that event's body, and a cross-link to its `<LifecycleStateMachine>` edge;
- the webhook **signing / retry / replay / dedupe** docs written to the **real** implementation (see §Antipattern watch — the shipped `<WebhookVerifier>` currently documents a scheme the server does not use);
- a persistent `<RailSwitcher>` (card / direct-debit / transfer / crypto) on the subscription, dunning, and reconciliation guides that re-renders the **same** lifecycle example per rail, honestly surfacing the card OTP wall, direct-debit mandate consent, transfer push→reconcile, and settlement lag.

Every page must be green under the Phase-03 OpenAPI honesty gate, WCAG 2.2 AA on the dark default, and the Vale vocabulary pack.

## Prerequisites (what must exist first)

- **Phase 03 (runnable spine).** The `/api/playground` proxy with the `/v1/test/*` allowlist + SSE variant; the **buffet snippet engine** (build-time codegen from `openapi.json` + a per-operation example-values registry → curl/Node/Python/Go/PHP/Ruby/Java) replacing `buildCurl`/`buildTs` in `api-explorer.tsx`; the **OpenAPI honesty gate** (`scripts/openapi-lint.ts` importing `buildOpenApiDocument` from `@nombaone/api`); the rehype transformer that auto-links every `PUBLIC_ERROR_CODES` token in fenced blocks; Pagefind over built HTML. **Check before starting:** `<ApiExplorer>`'s `Method` union is `"GET" | "POST"` today (`api-explorer.tsx:43`) — Phase 03 must have extended it to `PATCH | PUT | DELETE` (with a body editor for `PATCH`/`PUT`) or Phase 08 does it in task A3.
- **Phase 04 (error reference).** `/errors` exists, one anchor per code (`packages/errors/src/codes.ts` → `DOCS_ERRORS_BASE = https://docs.nombaone.com/errors`, `ERROR_CODE_META`, `PUBLIC_ERROR_CODES`). No error code this phase references may 404.
- **Phase 02 (IA/nav/voice).** `content/manifest.ts` schema (already supports `kind: "api"`, `method`, nested `children`), the Diátaxis section order, and the Vale pack. Phase 08 populates the API + Webhooks sections; it does not redesign the manifest schema.
- **Phase 07 (concepts/hard parts).** Owns `<MoneyUnit>` (the kobo linter widget) and the `/concepts/money` page. Phase 08 consumes `<MoneyUnit>` on money fields and links every kobo field to that page. Phase 07 also authors the prose of the subscription/dunning/reconciliation guides; Phase 08 mounts `<RailSwitcher>` into them (task D).
- **Phase 05 (test toolkit).** Owns `/v1/test/webhooks/simulate` docs and the deterministic test-method registry. Phase 08 cross-links to them from the webhook simulate section; it does not re-document the toolkit.

Grounded source files (read, never edit from docs): `apps/api/src/apps/main/modules/*/routes.ts` (endpoint truth), `packages/core-contracts/src/validations/*` + `types/*` (request/response shapes, `*InKobo` money fields, domain discriminators), `packages/core-contracts/src/types/webhook-events.ts` (the frozen catalog), `packages/sara/src/webhooks/{sign,deliver,simulate}.ts` (the real signing + retry truth).

---

## Deliverables checklist

### A. Reference scaffolding, conventions & shared components

- [ ] **A1 — Define the per-operation page Definition of Done (Op-DoD) once.** Add `apps/docs/content/reference/_TEMPLATE.mdx` (a non-routed authoring template, excluded from the manifest) encoding the canonical page shape so every operation page is uniform. The **Op-DoD** (referenced by every operation task below) is: (1) frontmatter `title` (verb-first, sentence case, e.g. "Create a subscription"), `description`, `section: api`; (2) `<EndpointHeader method path scope idempotent?>` — `path` carries the `/v1` prefix (matching `examples.mdx`, e.g. `/v1/subscriptions`), `scope` is the literal from `requireScope(...)` in `routes.ts`, `idempotent` set for money/mutating POSTs that mount the `idempotency` middleware; (3) a one-paragraph, marketing-free, present-tense, second-person summary; (4) a `<ParamField>` for **every** request field (path/query/body) with `name`/`type`/`in`/`required` matching the module's zod validation exactly; (5) `<ResponseField>`s for the success shape from the module's `types/*`; (6) a `<ResponseExample>` with the happy variant (200/201) **and** at least one real error variant, every error `code` a `PUBLIC_ERROR_CODES` value that auto-links to `/errors#CODE`; (7) a `<RequestExample>` fed by the Phase-03 buffet engine (curl/Node/Python/Go/PHP/Ruby/Java) — i.e. an entry in the example-values registry keyed by `operationId`; (8) an `<ApiExplorer endpoint method scope idempotent? defaultBody params>` seeded with realistic values (never the throwaway `example` resource); (9) honesty gate green, a11y AA, Vale pass; (10) a manifest child row with a `method` chip. **Acceptance:** the template renders, is not in `FLAT_NAV`, and a reviewer can build any operation page by filling it in without inventing structure.
- [ ] **A2 — Money-field rail + error-link conventions.** Document (in `_TEMPLATE.mdx` + a short `content/reference/index.mdx` overview) that every `*InKobo` field (found in `validations/{credit,price,settlement,coupon,payment-method}.ts`) is typed `integer · kobo`, wrapped with `<MoneyUnit>` (Phase 07) in its description, and links to `/concepts/money`. **Acceptance:** grep shows no money `<ParamField>`/`<ResponseField>` in `content/reference/**` without the `kobo` type token; the honesty gate's unit assertion passes.
- [ ] **A3 — Verify/extend `<ApiExplorer>` verbs.** Confirm Phase 03 extended `apps/docs/src/components/mdx/api-explorer.tsx` `Method` to include `PATCH`/`PUT`/`DELETE` (with the body editor shown for `PATCH`/`PUT`, hidden for `DELETE`) and that the `/api/playground` proxy allowlist forwards those methods. If not done, extend it here (small: widen the union, gate the body editor on `method !== "GET" && method !== "DELETE"`, keep the live-key rejection + test-key gate untouched). **Acceptance:** a `PATCH /subscriptions/:id` and a `DELETE /payment-methods/:id` fire a real sandbox call through the proxy from their reference pages.
- [ ] **A4 — Rewrite the API section of `content/manifest.ts`.** Replace the single `/reference/examples` row with 18 `kind: "api"` resource rows (one per module), each with a resource-overview `slug` (`/reference/<resource>`) and nested `children` — one child per operation, in `routes.ts` order, each with its `method` chip. Order resources by developer journey (subscriptions, plans, prices, customers, payment-methods, invoices, dunning, coupons, mandates, settlements, webhooks, events, billing-settings, settings, metrics, health), then a final "Test toolkit" pointer (Phase 05). Keep the `example` scaffold row only until real pages land, then delete it (task A6). **Acceptance:** the sidebar renders 18 disclosable resource groups with per-operation method chips; `ALL_SLUGS` includes every operation slug; the pager walks them in order.
- [ ] **A5 — Author 18 resource-overview pages** at `content/reference/<resource>/index.mdx` — a short, mode-pure Reference intro to the resource (what it models, its lifecycle in one line with a link to the relevant `<LifecycleStateMachine>`, its domain discriminator where one exists — e.g. `payment_method.kind` ∈ card|mandate|virtual_account, `settlement` vs `payout`), and a table of its operations linking to each child page. No try-it here (overviews stay static). **Acceptance:** each `/reference/<resource>` resolves, names one canonical noun per concept (tenet 10), and links every operation child.
- [ ] **A6 — Retire the `example` scaffold from the reference** once ≥1 real module ships: delete `content/reference/examples.mdx`, drop its manifest row, and remove `example.*` from any reference nav (the module and its `example.created`/`example.settled` events stay documented **only** as the "reference scaffold" note in the webhook catalog, task C3). **Acceptance:** `/reference/examples` no longer routes; no reference page references the `example` resource as product.

### B. Per-module operation pages (the ~80 hand-authored pages)

> Each checkbox = one operation page under `content/reference/<resource>/<op>.mdx`, built per the **Op-DoD (A1)**. `<EndpointHeader>` path shown with `/v1`; `<ApiExplorer endpoint>` uses the router-relative path (no `/v1` — `API_BASE` already includes it). Scopes are the exact `requireScope(...)` literals. For error variants, grep the module's controllers/services for its `throw` sites and use the real `PUBLIC_ERROR_CODES` those raise — do not guess.

#### B1 — subscriptions (16) · validations `validations/{subscription,subscription-change,subscription-schedule}.ts` · types `types/subscription.ts`, `types/upcoming-invoice.ts`
- [ ] `create.mdx` — POST `/subscriptions` · `subscriptions:write` · idempotent · body `createSubscriptionBody`; errors incl. validation + plan/price/customer-not-found + duplicate.
- [ ] `retrieve.mdx` — GET `/subscriptions/:id` · `subscriptions:read`; 404 variant.
- [ ] `list.mdx` — GET `/subscriptions` · `subscriptions:read`; query params (pagination/filter) as `<ParamField in="query">`.
- [ ] `events.mdx` — GET `/subscriptions/:id/events` · `subscriptions:read`; cross-link to the webhook catalog (task C).
- [ ] `update.mdx` — PATCH `/subscriptions/:id` · `subscriptions:write` · idempotent-optional; partial body.
- [ ] `pause.mdx` — POST `/subscriptions/:id/pause` · `subscriptions:write`; note the `subscription.paused` event.
- [ ] `resume.mdx` — POST `/subscriptions/:id/resume` · `subscriptions:write`; `subscription.resumed`.
- [ ] `cancel.mdx` — POST `/subscriptions/:id/cancel` · `subscriptions:write`; voluntary → `subscription.canceled` (distinguish from involuntary `subscription.churned`).
- [ ] `resubscribe.mdx` — POST `/subscriptions/:id/resubscribe` · `subscriptions:write`.
- [ ] `change.mdx` — POST `/subscriptions/:id/change` · `subscriptions:write` · idempotent · body `subscription-change.ts`; document proration as a ledger outcome, link `/concepts` proration.
- [ ] `upcoming-invoice.mdx` — GET `/subscriptions/:id/upcoming-invoice` · `subscriptions:read`; response `types/upcoming-invoice.ts`, kobo rail on every amount.
- [ ] `create-schedule.mdx` — POST `/subscriptions/:id/schedule` · `subscriptions:write` · body `subscription-schedule.ts`.
- [ ] `get-schedule.mdx` — GET `/subscriptions/:id/schedule` · `subscriptions:read`.
- [ ] `cancel-schedule.mdx` — DELETE `/subscriptions/:id/schedule` · `subscriptions:write`.
- [ ] `add-discount.mdx` — POST `/subscriptions/:id/discount` · `subscriptions:write`; `discount.created`.
- [ ] `remove-discount.mdx` — DELETE `/subscriptions/:id/discount` · `subscriptions:write`; `discount.removed`.

#### B2 — webhooks module (9) · validations `validations/webhook.ts` — **the endpoint-management API** (distinct from the webhook *system* docs in §C)
- [ ] `create.mdx` — POST `/webhooks` · `webhooks:write` · idempotent-optional · body `createWebhookEndpointBody`; response returns the signing secret **once** (call this out loudly).
- [ ] `list.mdx` — GET `/webhooks` · `webhooks:read`.
- [ ] `retrieve.mdx` — GET `/webhooks/:id` · `webhooks:read`.
- [ ] `update.mdx` — PATCH `/webhooks/:id` · `webhooks:write` · body `updateWebhookEndpointBody`.
- [ ] `delete.mdx` — DELETE `/webhooks/:id` · `webhooks:write`.
- [ ] `rotate-secret.mdx` — POST `/webhooks/:id/rotate-secret` · `webhooks:write`; explain the overlap window for zero-downtime rotation.
- [ ] `list-deliveries.mdx` — GET `/webhooks/:id/deliveries` · `webhooks:read` · query `listWebhookDeliveryQuery`; document delivery statuses (`pending|succeeded|failed|dead`).
- [ ] `retrieve-delivery.mdx` — GET `/webhooks/:id/deliveries/:deliveryId` · `webhooks:read`.
- [ ] `replay-delivery.mdx` — POST `/webhooks/:id/deliveries/:deliveryId/replay` · `webhooks:write`; cross-link the replay/dedupe section (C2).

#### B3 — customers (9) · validations `validations/{customer,credit,discount}.ts`
- [ ] `create.mdx` — POST `/customers` · `customers:write` · idempotent-optional.
- [ ] `retrieve.mdx` — GET `/customers/:id` · `customers:read`.
- [ ] `list.mdx` — GET `/customers` · `customers:read`.
- [ ] `update.mdx` — PATCH `/customers/:id` · `customers:write`.
- [ ] `add-discount.mdx` — POST `/customers/:id/discount` · `customers:write`.
- [ ] `remove-discount.mdx` — DELETE `/customers/:id/discount` · `customers:write`.
- [ ] `grant-credit.mdx` — POST `/customers/:id/credit` · `customers:write` · body `credit.ts` (kobo rail on `amountInKobo`); link the credit-application "oldest first" concept.
- [ ] `list-credit.mdx` — GET `/customers/:id/credit` · `customers:read`.
- [ ] `void-credit.mdx` — DELETE `/customers/:id/credit/:grantId` · `customers:write`.

#### B4 — plans (7) · validations `validations/plan.ts`
- [ ] `create.mdx` — POST `/plans` · `plans:write`.
- [ ] `retrieve.mdx` — GET `/plans/:id` · `plans:read`.
- [ ] `list.mdx` — GET `/plans` · `plans:read`.
- [ ] `update.mdx` — PATCH `/plans/:id` · `plans:write`.
- [ ] `archive.mdx` — POST `/plans/:id/archive` · `plans:write`; note cascade → `price.deactivated`.
- [ ] `create-price.mdx` — POST `/plans/:id/prices` · `plans:write` (or `prices:write` — use the literal) · kobo rail.
- [ ] `list-prices.mdx` — GET `/plans/:id/prices` · `plans:read`.

#### B5 — payment-methods (6) · validations `validations/payment-method.ts` · discriminator `kind` ∈ card|mandate|virtual_account
- [ ] `setup.mdx` — POST `/payment-methods/setup` · `payment-methods:write`; the card/mandate setup entry — honestly link the OTP/3DS wall concept (Phase 07) for card.
- [ ] `create-virtual-account.mdx` — POST `/payment-methods/virtual-account` · `payment-methods:write`; the transfer/push rail.
- [ ] `retrieve.mdx` — GET `/payment-methods/:id` · `payment-methods:read`.
- [ ] `list.mdx` — GET `/payment-methods` · `payment-methods:read`.
- [ ] `set-default.mdx` — POST `/payment-methods/:id/default` · `payment-methods:write`.
- [ ] `delete.mdx` — DELETE `/payment-methods/:id` · `payment-methods:write`.

#### B6 — settlements (5) · validations `validations/settlement.ts` · discriminator settlement vs payout
- [ ] `list.mdx` — GET `/settlements` · `settlements:read` · query `listSettlementsQuery`.
- [ ] `retrieve.mdx` — GET `/settlements/:id` · `settlements:read`.
- [ ] `escrow.mdx` — GET `/settlements/escrow` · `settlements:read`; explain the escrow lock + settlement lag.
- [ ] `payout.mdx` — POST `/settlements/payout` · `settlements:write` · idempotent · body `createPayoutBody` (kobo); `settlement.payout_created`.
- [ ] `refund.mdx` — POST `/settlements/:id/refund` · `settlements:write` · idempotent · body `refundSettlementBody`; state the fee-is-non-refundable rule; `settlement.refunded`.

#### B7 — coupons (4) · validations `validations/coupon.ts`
- [ ] `create.mdx` — POST `/coupons` · `coupons:write` (kobo rail on fixed-amount coupons).
- [ ] `retrieve.mdx` — GET `/coupons/:id` · `coupons:read`.
- [ ] `list.mdx` — GET `/coupons` · `coupons:read`.
- [ ] `update.mdx` — PATCH `/coupons/:id` · `coupons:write`.

#### B8 — dunning (3) · validations `validations/dunning.ts` — the recovery surface (tenet 8, disproportionate care)
- [ ] `get-state.mdx` — GET `/subscriptions/:id/dunning` · `subscriptions:read`; document the past_due→recovered/churned arc, link the thin-balance dunning simulator (Phase 07) and the `<RailSwitcher>` (task D).
- [ ] `list-attempts.mdx` — GET `/subscriptions/:id/dunning/attempts` · `subscriptions:read`; each attempt's reason ties to an error code; the `DUN`-keyed retry reference.
- [ ] `update-payment-method.mdx` — POST `/subscriptions/:id/payment-method` · `subscriptions:write`; the card-update-during-dunning recovery path; `payment_method.updated`.

#### B9 — invoices (3) · validations `validations/invoice.ts`
- [ ] `retrieve.mdx` — GET `/invoices/:id` · `invoices:read`; kobo rail on all amounts; document `action_required` + `checkoutLink`.
- [ ] `list.mdx` — GET `/invoices` · `invoices:read`.
- [ ] `void.mdx` — POST `/invoices/:id/void` · `invoices:write`; `invoice.voided`.

#### B10 — prices (3) · validations `validations/price.ts`
- [ ] `retrieve.mdx` — GET `/prices/:id` · `prices:read`; kobo rail on `unitAmountInKobo`.
- [ ] `list.mdx` — GET `/prices` · `prices:read`.
- [ ] `deactivate.mdx` — POST `/prices/:id/deactivate` · `prices:write`; `price.deactivated`.

#### B11 — events (3) · types `webhook-events.ts`
- [ ] `catalog.mdx` — GET `/events/catalog` · `webhooks:read`; the machine-readable catalog endpoint; cross-link the human catalog page (C3) as its rendered twin.
- [ ] `list.mdx` — GET `/events` · `webhooks:read` · query `listEventQuery` (the `type` filter is validated against `WEBHOOK_EVENT_TYPES`).
- [ ] `retrieve.mdx` — GET `/events/:id` · `webhooks:read`; the delivered envelope shape `{ id, type, event, data }`.

#### B12 — mandates (2) · validations/types `mandate*`
- [ ] `create.mdx` — POST `/mandates` · scope literal · idempotent-optional; direct-debit consent; link the mandate-consent concept + `<RailSwitcher>` direct-debit rail.
- [ ] `retrieve.mdx` — GET `/mandates/:id` · read scope; document the mandate status machine (link `<LifecycleStateMachine>`).

#### B13 — billing-settings (2) · validations `validations/billing-settings.ts`
- [ ] `get.mdx` — GET `/organization/billing` · `organizations:read` (confirm literal).
- [ ] `update.mdx` — PUT `/organization/billing` · `organizations:write` · idempotent-optional · body from `billing-settings.ts` (partial collection toggle, dunning config).

#### B14 — settings (2) · validations `validations/settings.ts`
- [ ] `get.mdx` — GET `/organization` · `organizations:read`.
- [ ] `update.mdx` — PUT `/organization` · `organizations:write` · idempotent-optional · body `updateTenantSettingsBody`. Use "organization" everywhere (never "tenant") in prose (tenet 10 / Vale rule).

#### B15 — metrics (1) · validations `validations/metrics.ts`
- [ ] `billing.mdx` — GET `/metrics/billing` · `metrics:read` · query `metricsQuery`; kobo rail on monetary metrics (MRR etc.).

#### B16 — health (1)
- [ ] `health.mdx` — GET `/health` · **no auth** — document that it takes no key and is safe to poll; it is not the private `/ready` (per repo convention). No `<ApiExplorer>` key field required.

#### B17 — test toolkit (3) — **reference stubs only; Phase 05 owns the full pages**
- [ ] `advance-cycle.mdx`, `simulate-webhook.mdx`, `test-payment-methods.mdx` under `content/reference/test/` — thin reference rows for POST `/test/subscriptions/:id/advance-cycle`, POST `/test/webhooks/simulate`, POST `/test/payment-methods`, each `<Callout type="note">` cross-linking to the Phase-05 test-toolkit page and flagged **test-base only**. **Acceptance:** these appear in the reference nav but defer their narrative to Phase 05 (no duplication).

### C. The webhook system docs (`content/webhooks/*`)

- [ ] **C1 — Signing & verification page** `content/webhooks/signing.mdx`. Document the **real** scheme from `packages/sara/src/webhooks/sign.ts` + `deliver.ts:203`: header `x-nombaone-signature: <lowercase-hex HMAC-SHA256(signingSecret, rawBody)>` — **signed over the raw body only, no timestamp, no `t=`/`v1=`**; companion headers `x-nombaone-event-type`, `x-nombaone-delivery` (the delivery reference), and `x-nombaone-delivery-guarantee: at-least-once`. Instruct the reader to verify by recomputing the HMAC over the **exact received bytes** with `timingSafeEqual`-equivalent comparison. Embed the (corrected — task C5) `<WebhookVerifier>`. **Acceptance:** the documented recipe matches `signWebhookPayload` byte-for-byte; the page states plainly that there is **no signed-timestamp replay window today** — replay protection is via body `event.id` dedupe (C2), not a timestamp tolerance. (Honesty gate + tenet 8: do not invent a timestamp scheme the server does not implement.)
- [ ] **C2 — Delivery guarantee, retries, replay & dedupe page** `content/webhooks/delivery.mdx`. Document from `deliver.ts`: at-least-once (`WEBHOOK_DELIVERY_GUARANTEE`), the envelope `{ id: <delivery ref>, type, event: { id, type, createdAt }, data }`, **dedupe on `event.id`** (it is inside the signed body so it cannot be spoofed independently), the retry cadence `BACKOFF_MS = [10s, 1m, 5m, 30m, 2h]` indexed by failed attempt, `MAX_ATTEMPTS = 6` → `dead` (dead-letter), `REQUEST_TIMEOUT_MS = 10s`, and delivery statuses `pending|succeeded|failed|dead`. Cross-link manual replay (`POST /webhooks/:id/deliveries/:deliveryId/replay`, B2) and simulate (`/v1/test/webhooks/simulate`, Phase 05). Include a copy-run "log processed `event.id`" idempotent-consumer snippet. **Acceptance:** every number/enum on the page is traceable to `deliver.ts`; no invented cadence.
- [ ] **C3 — The event catalog page** `content/webhooks/events.mdx`, rendered from the frozen SSOT via a new RSC component `<WebhookEventCatalog>` (task C4) that imports `WEBHOOK_EVENT_CATALOG` at build time. Per event, render: the `type`, the one-line `when` (producing transition), the `payload` key shape, the guarantee + header, an inline seeded `<WebhookVerifier>` (C5), and a cross-link to the state/edge in the relevant `<LifecycleStateMachine>` that fires it (e.g. `invoice.payment_failed` → the invoice past_due edge; `invoice.action_required` → the OTP-wall edge with `checkoutLink`; `subscription.churned` → dunning-exhausted terminal). Mark `example.created`/`example.settled` explicitly as the deletable reference scaffold. **Acceptance:** the page lists exactly the catalog's entries (a diff test asserts parity with `WEBHOOK_EVENT_TYPES`); adding an event to the SSOT makes it appear with no page edit; removing one fails the parity test.
- [ ] **C4 — Build `<WebhookEventCatalog>`** at `apps/docs/src/components/mdx/webhook-event-catalog.tsx` as a **server component** (not `'use client'`) that imports `WEBHOOK_EVENT_CATALOG`, `WEBHOOK_DELIVERY_GUARANTEE`, `WEBHOOK_DELIVERY_GUARANTEE_HEADER` from `@nombaone/core-contracts` and maps each entry to a card, embedding the client `<WebhookVerifier>` leaf per event. Register it in `apps/docs/src/components/mdx/index.tsx`. Each event card links to `/webhooks/events#<type>` (deep-linkable anchor) and to its `<LifecycleStateMachine>` edge. **Acceptance:** renders statically (no runtime fetch), passes the gate, and each event anchor resolves.
- [ ] **C5 — Correct & prop-ify `<WebhookVerifier>`** (`apps/docs/src/components/mdx/webhook-verifier.tsx`). It currently computes `HMAC(${timestamp}.${body})` and expects a `t=,v1=` header — **this contradicts the shipped server** (C1). Rewrite `computeSignature` to `HMAC-SHA256(secret, rawBody)` hex (body only), drop the timestamp input and the `t=…,v1=…` output, compare against a pasted bare-hex `x-nombaone-signature`, and update the doc comment to cite `sign.ts` truthfully. Add props `seedBody`, `seedType`, `seedSecret?` so C3/C4 can seed each event's real payload; keep the "nothing leaves the page / sign the exact bytes" copy and a11y (labelled inputs, `aria-live` verdict, colour-plus-text). **Acceptance:** for a given secret+body, the widget's expected signature equals `signWebhookPayload(secret, body)` from `@nombaone/sara/webhooks`; a mismatch renders the reject-with-400 verdict.
- [ ] **C6 — Webhooks section overview** `content/webhooks/index.mdx` — the map into signing (C1), delivery/retry/replay (C2), the catalog (C3), and the endpoint-management API (B2) — plus the "verify us in your own devtools" affordance pointing at Phase-05 simulate. Add a Webhooks section to `content/manifest.ts` (a non-`api` docs section, distinct from the `reference/webhooks` module rows). **Acceptance:** `/webhooks` resolves and links all four; no Diátaxis mode-mixing (system explanation + how-to stay separated from the per-endpoint reference rows).

### D. The `<RailSwitcher>` (card / direct-debit / transfer / crypto)

- [ ] **D1 — Build `<RailSwitcher>` + `<Rail>`** at `apps/docs/src/components/mdx/rail-switcher.tsx` (`'use client'` leaf). `<RailSwitcher>` renders a persistent segmented toggle (card | direct debit | transfer | crypto) with `localStorage` memory (key `nombaone-docs:rail`), provides the active rail via React context, and `<Rail rail="...">…</Rail>` children show only for the active rail (all rails rendered to the DOM for SSR/Pagefind, hidden via `hidden`/`aria-hidden`). a11y: `role="tablist"`, arrow-key nav, `aria-selected`, focus ring ≥2px per §6 tokens, emerald accent (post-Phase-01). Register in `index.tsx`. **Acceptance:** switching rails re-renders the same lifecycle example for the chosen rail with no layout shift; the choice persists across pages; keyboard-operable; all four rails present in the built HTML (searchable).
- [ ] **D2 — Author the per-rail lifecycle content** as the same subscription example across four `<Rail>` blocks, each honestly surfacing that rail's reality: **card** → the OTP/3DS recharge wall (`invoice.action_required` + `checkoutLink`, link Phase-07 OTP page); **direct debit** → mandate consent + the mandate status machine (link B12 + the mandate concept); **transfer** → push→reconcile (the reader pushes, we reconcile by reference; link the reconciliation cookbook, Phase 07); **crypto** → underpaid/late + settlement lag. Reuse `<LifecycleStateMachine>` and `<MoneyFlow>` per rail. **Acceptance:** every rail shows a runnable/linked path (no dead "coming soon" cell — tenet 3 answer is "yes, with the caveat inline"); the caveats are stated, not hidden (tenet 8).
- [ ] **D3 — Mount `<RailSwitcher>` into the three guides.** Insert the rail-switcher block at the top of the subscription guide, the dunning guide, and the reconciliation guide (Phase-07/Guides pages). If a guide page does not yet exist when Phase 08 runs, ship the rail-switcher block as an includable partial (`content/_partials/rail-lifecycle.mdx`) and add a stub guide page that renders it, leaving a note for Phase 07 to wrap prose around it. **Acceptance:** all three guides carry the switcher; flipping the rail on any of them re-renders that guide's lifecycle example; the setting is shared across them.

### E. Gate, a11y & voice conformance

- [ ] **E1 — Honesty-gate pass for every reference + webhook page.** Run `scripts/openapi-lint.ts` (Phase 03) over all of `content/reference/**` and `content/webhooks/**`: every `<EndpointHeader>`/`<ApiExplorer>` method+path resolves to a spec operation; every `<ParamField>`/`<ResponseField>` name+type+required matches the zod schema; every error `code` is in `PUBLIC_ERROR_CODES`; every `docUrl`/`/errors#CODE` link resolves. **Acceptance:** the docs `build`/`type-check` turbo task is green; a deliberately-wrong field name in any page turns CI red (spot-check one).
- [ ] **E2 — a11y AA sweep** on the new components (`<RailSwitcher>`, `<WebhookEventCatalog>`, corrected `<WebhookVerifier>`) and the reference pages: 4.5:1 body / 3:1 large / 3:1 focus (≥2px) on the dark `#040404` default, method/status chips carry text not colour alone, full keyboard operability. **Acceptance:** axe/lighthouse a11y pass on a subscriptions op page, the event catalog page, and a rail-switched guide.
- [ ] **E3 — Vale vocabulary pass** (Phase 02 pack): "organization" not "tenant", `:id` not `:ref`, "kobo" units, no marketing adjectives in reference prose, sentence-case verb-first titles, one canonical noun per concept (no `tx_ref`/`flw_ref`/`trxref` synonym tangle — one `reference`). **Acceptance:** Vale is green across `content/reference/**` + `content/webhooks/**`.

---

## New/changed components & files

| Path | Purpose |
|---|---|
| `apps/docs/content/reference/_TEMPLATE.mdx` | Non-routed authoring template encoding the Op-DoD (A1). |
| `apps/docs/content/reference/index.mdx` | Reference overview + money/error-link conventions (A2). |
| `apps/docs/content/reference/<resource>/index.mdx` (×18) | Per-resource overview pages (A5). |
| `apps/docs/content/reference/<resource>/<op>.mdx` (~79) | Hand-authored per-operation pages (B1–B17). |
| `apps/docs/content/reference/test/*.mdx` (×3) | Thin reference stubs deferring to Phase 05 (B17). |
| `apps/docs/content/webhooks/index.mdx` | Webhooks system overview (C6). |
| `apps/docs/content/webhooks/signing.mdx` | Real HMAC signing/verification (C1). |
| `apps/docs/content/webhooks/delivery.mdx` | Guarantee, retry cadence, replay, dedupe (C2). |
| `apps/docs/content/webhooks/events.mdx` | The catalog page rendered from the SSOT (C3). |
| `apps/docs/content/_partials/rail-lifecycle.mdx` | Shared per-rail lifecycle block (D2/D3). |
| `apps/docs/src/components/mdx/webhook-event-catalog.tsx` | **New** RSC rendering `WEBHOOK_EVENT_CATALOG` at build (C4). |
| `apps/docs/src/components/mdx/rail-switcher.tsx` | **New** `<RailSwitcher>`/`<Rail>` client island (D1). |
| `apps/docs/src/components/mdx/webhook-verifier.tsx` | **Rewrite** to the real body-only HMAC scheme + seed props (C5). |
| `apps/docs/src/components/mdx/api-explorer.tsx` | Verify/extend `Method` to PATCH/PUT/DELETE (A3). |
| `apps/docs/src/components/mdx/index.tsx` | Register `<WebhookEventCatalog>` + `<RailSwitcher>`/`<Rail>` (C4/D1). |
| `apps/docs/content/manifest.ts` | 18 API resource groups + operation children + Webhooks section (A4/C6). |
| Phase-03 example-values registry (e.g. `apps/docs/scripts/example-values.ts`) | One `operationId` entry per operation feeding the buffet snippets (A1.7). |

## Acceptance criteria (how we know the phase is done — testable)

- Every mounted operation in `apps/api/src/apps/main/modules/*/routes.ts` (subscriptions 16, webhooks 9, customers 9, plans 7, payment-methods 6, settlements 5, coupons 4, dunning/invoices/prices/events 3 each, mandates/settings/billing-settings 2 each, metrics/health 1 each, test 3) has a reference page reachable from `content/manifest.ts`; the `example` scaffold reference page is deleted.
- No reference page is happy-path-only: each has ≥1 error `<Response>` whose `code` resolves to `/errors#CODE` (tenet 9).
- The honesty gate (E1) is green; a deliberately-mismatched field fails CI.
- The webhook signing page (C1) and `<WebhookVerifier>` (C5) match `packages/sara/src/webhooks/sign.ts` byte-for-byte; the delivery page (C2) matches `deliver.ts` (`BACKOFF_MS`, `MAX_ATTEMPTS=6`, dedupe on `event.id`, headers); no invented timestamp/tolerance appears anywhere.
- The event catalog page (C3) is provably at parity with `WEBHOOK_EVENT_TYPES` (a diff test); every event cross-links its lifecycle edge and carries a seeded verifier.
- `<RailSwitcher>` re-renders the same lifecycle example across card/direct-debit/transfer/crypto with the honest caveats inline, persists the choice, is keyboard-operable, and all rails are in the built HTML (Pagefind-searchable); it is mounted on the subscription, dunning, and reconciliation guides.
- Every `*InKobo` money field in the reference carries the kobo type token + `<MoneyUnit>` and links `/concepts/money`.
- a11y AA (E2) and Vale (E3) pass across `content/reference/**` and `content/webhooks/**`.

## Antipattern watch (the §10 rules most relevant here)

- **No hand-drift (the §10 gate).** The reference is hand-authored but CI-checked against `/v1/openapi.json`; a page that disagrees with the server turns the build red. Do not author a field/type/path the spec does not have.
- **The signing docs must not lie.** The shipped `<WebhookVerifier>` documents a `t=,v1=`/timestamp scheme the server never sends — correcting it (C5) is non-negotiable; a payments audience opens devtools and a wrong signature recipe collapses trust (tenet 8). Do not invent a signed-timestamp replay window; document the real `event.id` dedupe.
- **No happy-path-only pages.** Every operation shows its declines/404/409/422; the dunning, OTP-wall, and settlement realities are documented as loudly as `200` (tenet 9, disproportionate care on unhappy paths).
- **One name per concept.** Use one canonical `reference` (never a `tx_ref`/`flw_ref`/`trxref` tangle), "organization" not "tenant", `:id` not `:ref` (tenet 10 / Vale).
- **Real sandbox, test keys only.** Every `<ApiExplorer>` goes through the `/api/playground` proxy (live-key-rejecting, allowlisted); never call the sandbox directly from the browser; never seed a live key or the `example` throwaway resource.
- **No hand-maintained multi-language snippets.** `<RequestExample>` is fed by the Phase-03 buffet engine + example-values registry, not hand-concatenated strings.
- **Consume the spec/catalog at build, never at runtime.** `<WebhookEventCatalog>` imports the SSOT const at build time (RSC), not via a fetch of `openapi.json`/`/events/catalog`.
- **No Diátaxis mode-mixing.** Reference pages stay propositional; the webhook *system* explanation and how-to live in `content/webhooks/*`, separate from the per-endpoint reference rows.

## Manifesto ties

- **Tenet 5 (the API is the product):** a complete, spec-honest, per-operation reference — the reference *is* the API made legible and runnable.
- **Tenet 6 (docs are the demo / if it isn't in the docs it doesn't exist):** all ~80 endpoints and the full event catalog documented and runnable; the last dark corner of the API is lit.
- **Tenet 9 (errors are a feature):** every operation's real error codes shown and linked to their `/errors` reproduce-and-fix page.
- **Tenet 3 (a buffet, not a menu):** the multi-language snippets and the `<RailSwitcher>` make "can I do this over transfer / from Go?" a visible "yes, with the caveat inline."
- **Tenet 8 (honest about the hard parts):** the OTP wall, mandate consent, transfer reconciliation, settlement lag, and the true webhook signing/at-least-once/dedupe story are told plainly — including correcting our own component that got the signing scheme wrong.
- **Tenet 10 (one platform, one language):** one canonical vocabulary across every reference and webhook page, Vale-enforced.
- **Tenet 1 (the money is never wrong):** the kobo unit rail on every money field, linked to the money-unit page.
