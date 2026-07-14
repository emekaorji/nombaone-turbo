# Nomba One — Live Audit
### Endpoints · SDK methods · shipped scaffolding

**Date:** 2026-07-12 · **Product status:** LIVE — every 🔴 below is reachable by a real integrator today.

**Scope:** `nombaone-turbo` (api, docs, console, admin, checkout, website, packages) and the nine SDK repos `nombaone-{node,python,go,php,ruby,java,dotnet,rust,elixir}`.

---

## How to trust this

452 agents. 22 auditors swept the surface independently (5 endpoint groups, 9 SDKs, 4 stub sweeps, 4 invariants). **Every finding was then handed to two independent refuters** — one re-opening both cited files to check the facts, one testing whether it actually reaches a user in production. **A finding appears below only if neither refuter could kill it.**

| | |
|---|---|
| Findings raised | 239 |
| **Survived double refutation** | **189** |
| Refuted and discarded | 50 |
| Critical / High / Medium / Low | 29 / 74 / 75 / 11 |
| Checked and found **correct** | 221 |

Where a refuter partly agreed, its correction is quoted under the finding. **Read those** — several narrow a scary headline into something small, and a few widen it. This step is not ceremony: an earlier, shallower pass on this codebase confidently reported a webhook *"product bug"* that turned out not to be a bug at all.

## The finding, in one paragraph

The API is in good shape. Paths, request bodies and money arithmetic are almost entirely correct, and the OpenAPI snapshot really is in sync with the server. **What is wrong is nearly everything we say *about* it.** Three systems fabricate content, and no gate checks any of them:

1. **The OpenAPI builder** hardcodes response facts it never reads from the code — every create is published as `200` when it returns `201`; `Idempotency-Key` is marked required on 44 operations when 11 enforce it; and the public spec tells every integrator the base URL is `http://localhost:8000/v1`.
2. **The docs' snippet generator** invents SDK method names and type names by naming convention and never opens an SDK repo — so published samples call methods that do not exist, in languages that will not compile.
3. **The `example` scaffold** from the original boilerplate was never deleted. It is now in the live money ledger, the public spec, nine published packages, the AI-agent surfaces, and the rendered docs.

The single highest-value action is not a bug fix. **It is deleting the scaffold.**

---

# Action checklist

Every finding, one line each. IDs match the evidence sections below.

### Part 1 — Scaffolding & placeholders live in production

| | ID | Finding | Files |
|---|---|---|---|
| 🔴 | S1 | /hall claims "Real questions, real code, real answers" and "1,204 answered" — all 9 Q&As are inve… | `page.tsx`, `AskModal.tsx`, `Header.tsx` |
| 🔴 | S2 | 4 of the 5 cards on the public /use-cases page (primary nav) land on a placeholder that says "we'… | `page.tsx`, `page.tsx` |
| 🔴 | S3 | Homepage "Run simulation" button is a dead no-op — the flagship demo does nothing when clicked | `SimulatorStage.tsx` |
| 🔴 | S4 | Public GET /v1/openapi.json advertises servers.url = http://localhost:8000/v1 AND double-prefixes… | `build.ts`, `routes.ts`, `openapi.json` |
| 🔴 | S5 | Public OpenAPI spec tells every integrator the API base URL is http://localhost:8000/v1 | `build.ts`, `routes.ts`, `openapi.json` |
| 🔴 | S6 | The entire /merchants "Share a payment link" page documents a feature that exists nowhere — no pa… | `share-a-payment-link.mdx`, `overview.mdx`, `manifest.ts` |
| 🔴 | S7 | The shipped OpenAPI spec advertises /v1/examples and /v1/sandbox/* as real endpoints — feeding th… | `routes.ts`, `build.ts`, `routes.ts` |
| 🔴 | S8 | The three concept pages the multi-rail doc sends you to for card / mandate / virtual-account are … | `mandates-and-consent.mdx`, `card-tokens-expire.mdx`, `when-a-transfer-does-not-match-the-invoice.mdx` |
| 🔴 | S9 | The word "deletable" and the example scaffold are shipped across SEVEN live docs surfaces — inclu… | `manifest.ts`, `examples.mdx`, `quickstart.mdx` |
| 🟠 | S10 | "Ask in the open" submit button on /hall and /pricing is a dead no-op — visitor questions are sil… | `AskModal.tsx`, `page.tsx`, `page.tsx` |
| 🟠 | S11 | /hall presents 8 fabricated developer questions as "real questions, real code, real answers", plu… | `page.tsx` |
| 🟠 | S12 | Deleting the `example` scaffold in the 'obvious' order breaks apps/checkout and apps/admin at com… | `routes.ts`, `actions.ts`, `queue-stats.ts` |
| 🟠 | S13 | The `example` scaffold leaks into the PUBLIC type surface of all nine published SDKs (EXAMPLE_NOT… | `error.ts`, `webhook-events.ts`, `index.ts` |
| 🟠 | S14 | The agent-native .md mirrors for the error reference, event catalog and glossary are EMPTY — llms… | `md-mirror.ts`, `errors.md`, `event-catalog.md` |
| 🟠 | S15 | The docs ship an empty top-level "Cookbook" section whose only page says "Recipes are on the way" | `manifest.ts`, `cookbook.mdx`, `cookbook.md` |
| 🟠 | S16 | The homepage sells a CLI as a shipped feature; the docs admit it "is not released yet" | `page.tsx`, `sdks.mdx` |
| 🟠 | S17 | The live site advertises `checkout.nombaone.xyz` as the dunning action-link host; the API actuall… | `SimulatorStage.tsx`, `page.tsx` |
| 🟠 | S18 | The live site advertises webhook event `dunning.retry_scheduled`, which does not exist in the eve… | `SimulatorStage.tsx`, `page.tsx` |
| 🟡 | S19 | "Google sign-in is coming soon" on the console login and signup screens — the first two screens a… | `signup-form.tsx`, `login-form.tsx` |
| 🟡 | S20 | /sdks lists a "Command-line tool" card beside the nine real SDKs with no not-shipped signal — the… | `manifest.ts`, `sdks.mdx`, `cli.mdx` |
| 🟡 | S21 | Console ships a `?state=` design-preview backdoor that fakes zero/filtered/error screens over rea… | `page.tsx` |
| 🟡 | S22 | Deleting the website's [slug] catch-all without first fixing the homepage's own deep links turns … | `page.tsx`, `page.tsx`, `page.tsx` |
| 🟡 | S23 | EXAMPLE_NOT_FOUND ships in the public error-code enum, the committed OpenAPI ApiError schema, and… | `codes.ts`, `openapi.json`, `build.ts` |
| 🟡 | S24 | Footer links to status.nombaone.xyz (not a canonical host) while /trust claims "The status page p… | `Footer.tsx`, `page.tsx` |
| 🟡 | S25 | Internal "Build summary" agent-handoff docs are committed to six PUBLIC SDK repos — and one of th… | `SUMMARY.md`, `SUMMARY.md`, `SUMMARY.md` |
| 🟡 | S26 | The Prometheus /metrics endpoint is served unauthenticated on the public API host and leaks the r… | `index.ts`, `prometheus.ts`, `cloudflared.config.yml` |
| 🟡 | S27 | The `example` scaffold reaches the AI-agent surfaces too — llms.txt, the docs MCP server, and the… | `routes.ts`, `llms.txt`, `openapi.json` |
| 🟡 | S28 | The docs event catalog claims to be "provably complete" while the unauthenticated live API return… | `routes.ts`, `webhook-events.ts`, `event-catalog.tsx` |
| 🟡 | S29 | The docs playground proxies unauthenticated GETs to all 62 documented endpoints using a server-si… | `route.ts` |
| 🟡 | S30 | The docs snippet/method-name fixes are ONE file's worth of work but they are being reported as ~1… | `sdk-map.ts`, `snippets.ts`, `samples.ts` |
| 🟡 | S31 | `EXAMPLE_NOT_FOUND` scaffold code is shipped inside the published Hex package's public API | `error.ex` |
| 🟡 | S32 | `PaymentMethods.DeleteAsync` collides with a protected base-class helper — the fabricated name pr… | `sdk-map.ts` |
| 🟡 | S33 | `confirmExampleFromWebhook` is dead code that posts a real settlement ledger transaction with pro… | `confirm.ts`, `index.ts` |
| 🟡 | S34 | `exampleQueue` is a dead BullMQ queue that opens two Redis connections per process at import and … | `example.ts`, `index.ts` |
| 🟡 | S35 | buildStubPage() is a live, ungated "Coming soon" generator wired into generateStaticParams AND si… | `content.ts`, `check-links.ts`, `manifest.ts` |
| ⚪ | S36 | The admin app ships a first-class "Examples" dashboard page for the deletable scaffold | `page.tsx`, `queue-stats.ts` |
| ⚪ | S37 | The root README still describes the shipped product as "a bare boilerplate" containing "none of t… | `README.md` |

### Part 2 — Cross-cutting: money, errors, webhooks, auth

| | ID | Finding | Files |
|---|---|---|---|
| 🔴 | X1 | Docs publish a webhook body shape that does not exist: no `event` object, and two invented top-le… | `overview.mdx`, `event-catalog.mdx`, `event-catalog.tsx` |
| 🔴 | X2 | Every published OpenAPI spec (docs + all 9 SDK repos) declares `servers: http://localhost:8000/v1` | `routes.ts`, `build.ts`, `openapi.json` |
| 🔴 | X3 | Every webhooks endpoint answers a not-found id with code SYSTEM_INTERNAL_ERROR and the message "I… | `codes.ts` |
| 🔴 | X4 | The documented webhook scheme is UNIMPLEMENTABLE server-side today — the server has no plaintext … | `sign.ts`, `deliver.ts`, `endpoints.ts` |
| 🔴 | X5 | `commsEnabled` is shipped in the console as "Send dunning emails and pay-link nudges" and stamps … | `billing-settings-form.tsx`, `attempt.ts`, `set-up-dunning-messages.mdx` |
| 🟠 | X6 | All nine SDK-vendored `spec/openapi.json` are stale: none knows about embedded plan prices, and f… | `openapi.json`, `openapi.json`, `openapi.json` |
| 🟠 | X7 | Docs promise a zero-downtime secret rotation grace window; the code overwrites the secret in a si… | `signing-and-verification.mdx`, `endpoints.ts`, `webhook-endpoints.ts` |
| 🟠 | X8 | Docs' 422 sample shows `fields` as a map of strings; the API and the OpenAPI spec both emit a map… | `examples.mdx` |
| 🟠 | X9 | Docs' own 422 sample uses an invented code `VALIDATION_FAILED` that the docs' own ErrorExplorer c… | `examples.mdx`, `check-links.ts` |
| 🟠 | X10 | Retry docs name the wrong terminal status (`failed`, which actually means "still retrying") and o… | `retries-and-replay.mdx` |
| 🟠 | X11 | Ten separate findings all mutate the OpenAPI document — regenerate once, or you will re-vendor ni… | `build.ts`, `responses.ts`, `gen-openapi.ts` |
| 🟠 | X12 | The agent-native error reference (errors.md) contains ZERO error codes while llms.txt advertises … | `md-mirror.ts`, `errors.md` |
| 🟠 | X13 | The interactive `<WebhookVerifier />` seeds a fabricated event type (`payment.settled`) and a fla… | `webhook-verifier.tsx` |
| 🟠 | X14 | The l10n gate promises staleness "demotes" a translated page — no staleness detection exists anyw… | `check-l10n.ts`, `content.ts`, `config.ts` |
| 🟠 | X15 | The primary "Handle webhooks" guide reads the header `x-nomba-signature` — the server sends `x-no… | `handle-webhooks.mdx` |
| 🟠 | X16 | The refunds guide's worked partial-refund example is arithmetically impossible — the second call … | `refunds-payouts-settlement.mdx`, `refunds-payouts-settlement.md` |
| 🟠 | X17 | The ⌘K search index is English-only and its results push bare English URLs — the Yorùbá/Hausa doc… | `build-search-index.ts`, `search-palette.tsx`, `build-ask-index.ts` |
| 🟠 | X18 | Webhook payloads break the `…InKobo` invariant: the SAME money field is `unitAmountInKobo` over R… | `create.ts`, `create-with-prices.ts`, `markPaid.ts` |
| 🟠 | X19 | `Idempotency-Key` is documented as required on 13 non-POST mutating ops where the middleware igno… | `idempotency.ts`, `build.ts` |
| 🟡 | X20 | /api/ask is an unauthenticated, unrate-limited public LLM proxy on the docs domain — nobody audit… | `route.ts`, `route.ts` |
| 🟡 | X21 | Docs state the signing secret is `whsec_…` on four pages; the server mints `nbo_whsec_…` | `overview.mdx`, `handle-webhooks.mdx`, `going-live.mdx` |
| 🟡 | X22 | Every error envelope printed in the docs omits `hint` and `docUrl` — the two fields the spec mark… | `authentication.mdx`, `examples.mdx`, `error-explorer.tsx` |
| 🟡 | X23 | Four of the nine SDKs are missing the public code API_KEY_HOST_MISMATCH from their vendored code … | `error.ts`, `errors.go`, `ErrorCode.java` |
| 🟡 | X24 | No docs page tells a developer WHICH endpoints require Idempotency-Key — the reference renderer d… | `model.ts`, `api-reference.tsx`, `manifest.ts` |
| 🟡 | X25 | No endpoint documents which errors it can raise — the OpenAPI doc advertises all 72 codes on all … | `build.ts`, `responses.ts` |
| 🟡 | X26 | On a 429 QUOTA_EXCEEDED the server sends no Retry-After and no X-RateLimit-* headers, though ever… | `rate-limit.ts` |
| 🟡 | X27 | PUBLIC_ERROR_CODES is a published enum: ADDING codes is cheap, REMOVING them breaks exhaustive ma… | `codes.ts`, `get-event.ts`, `deliveries.ts` |
| 🟡 | X28 | Provider/upstream failures report SYSTEM_INTERNAL_ERROR, not SYSTEM_UPSTREAM_ERROR — the upstream… | `codes.ts`, `error-handler.ts` |
| 🟡 | X29 | SDKs advertise `limit`/`cursor` paging on three endpoints the server does not paginate (subscript… | `routes.ts`, `list-subscription-events.ts`, `routes.ts` |
| 🟡 | X30 | Several 'docs are wrong' items are actually 'engine is wrong' — fixing the prose first ships a pe… | `upcoming.ts`, `subscription-detail.ts`, `lifecycle-sweep.ts` |
| 🟡 | X31 | The `amount` vs `amountInKobo` 422 is wider than the quickstart: the endpoint's own reference pag… | `examples.mdx`, `quickstart.mdx` |
| 🟡 | X32 | The changelog claims it is generated by diffing the OpenAPI snapshot "so it can't silently omit a… | `changelog.mdx` |
| 🟡 | X33 | The docs MCP server's `lookup_error` tool documents an example code that does not exist, and it s… | `route.ts` |
| 🟡 | X34 | The merchant overview's "Everything the console does, the API can do too" is inverted — the conso… | `overview.mdx` |
| 🟡 | X35 | Three unauthenticated endpoints are published with `security: ApiKeyAuth` — the spec's security b… | `build.ts` |
| ⚪ | X36 | GET /v1/plans/{id}/prices documents a `planRef` query filter that the handler ignores | `price.ts`, `routes.ts` |
| ⚪ | X37 | Gating /metrics will silently blind whatever is scraping it — and the docs playground's demo key … | `index.ts`, `provision-docs-key.ts`, `route.ts` |
| ⚪ | X38 | The documented delivery example omits two headers the server always sends (`x-nombaone-event-type… | `overview.mdx` |

### Part 3 — Endpoints

| | ID | Finding | Files |
|---|---|---|---|
| 🔴 | E1 | Docs say a failed first charge returns `past_due` and "dunning now owns recovery" — the API retur… | `start-a-subscription.mdx`, `collectForInvoice.ts`, `fsm.ts` |
| 🔴 | E2 | Every 404 on the webhooks and events surface returns error code SYSTEM_INTERNAL_ERROR with messag… | `codes.ts`, `get-event.ts`, `deliveries.ts` |
| 🔴 | E3 | POST /v1/payment-methods/setup takes a REAL charge (amountInKobo) that is never credited, applied… | `start-a-subscription.mdx`, `payment-method.ts` |
| 🔴 | E4 | POST /v1/settlements/{id}/refund never returns money to the customer — it is a ledger-only entry … | `refunds-payouts-settlement.mdx`, `read-a-settlement.mdx`, `settlement-and-sub-accounts.mdx` |
| 🔴 | E5 | The auto-generated "Example request body" for POST /v1/coupons is guaranteed to 422 — four separa… | `samples.ts` |
| 🟠 | E6 | A payout to a bad bank account returns 503 SYSTEM_INTERNAL_ERROR — SETTLEMENT_PAYOUT_FAILED is no… | `codes.ts`, `refunds-payouts-settlement.mdx`, `openapi.json` |
| 🟠 | E7 | Adding `.strict()` to the request bodies is a BREAKING contract change to a live API — the spec's… | `build.ts`, `plan.ts`, `price.ts` |
| 🟠 | E8 | DELETE /v1/customers/{id}/discount is the only op in the group with no response schema — spec and… | `responses.ts`, `openapi.json` |
| 🟠 | E9 | DELETE /v1/payment-methods/{id} advertises a required Idempotency-Key that the middleware structu… | `build.ts`, `idempotency.ts` |
| 🟠 | E10 | Dunning guide tells you to cut access on `subscription.canceled`, but dunning exhaustion emits `s… | `dunning-and-recovery.mdx` |
| 🟠 | E11 | Escrow, payout, and refund have NO response schema in the OpenAPI spec — the three money-movement… | `responses.ts`, `openapi.json` |
| 🟠 | E12 | Every generated price sample — the reference example body AND all 10 SDK snippets — ships `"inter… | `samples.ts` |
| 🟠 | E13 | Filling the plan-archive guard while the console archives by direct DB write ships an API stricte… | `archive.ts`, `plans-actions.ts`, `api-client.ts` |
| 🟠 | E14 | GET /v1/subscriptions/{id}/upcoming-invoice includes no prorations, discounts or credits — the pr… | `proration-and-plan-changes.mdx`, `upcoming.ts` |
| 🟠 | E15 | PATCH /v1/customers/{id} silently swallows `email` and returns 200 — the spec's `additionalProper… | `customer.ts`, `coupons-and-credits.mdx` |
| 🟠 | E16 | POST /v1/subscriptions/{id}/payment-method is documented as returning a Subscription; it returns … | `responses.ts`, `openapi.json` |
| 🟠 | E17 | Reference request examples for payment-methods/setup and /virtual-account are guaranteed 422s (ca… | `samples.ts`, `payment-method.ts` |
| 🟠 | E18 | Renaming `expectedAmount` → `expectedAmountInKobo` is a live request-field rename — it cannot be … | `payment-method.ts`, `money-is-integer-kobo.mdx`, `start-a-subscription.mdx` |
| 🟠 | E19 | SDK `@throws` annotations on four subscription ops name the wrong status/error class (409/Conflic… | `subscriptions.ts`, `subscriptions.py`, `subscriptions.go` |
| 🟠 | E20 | The "100× trap" money callout is inverted: sending naira where kobo is expected UNDER-charges by … | `money-is-integer-kobo.mdx`, `your-first-subscription.mdx` |
| 🟠 | E21 | The "Start a subscription" guide's first curl (payment-methods/setup) omits Idempotency-Key, but … | `start-a-subscription.mdx`, `api-operation.tsx`, `model.ts` |
| 🟠 | E22 | The `incomplete`-vs-`past_due` first-charge item has a docs fix and an ENGINE fix — take the docs… | `start-a-subscription.mdx`, `startSubscription.ts`, `collectForInvoice.ts` |
| 🟠 | E23 | The error reference and all nine SDKs tell integrators a mid-cycle interval switch is UNSUPPORTED… | `codes.ts`, `subscriptions.ts`, `subscriptions.py` |
| 🟠 | E24 | The flagship webhook-handler snippet reads the header `x-nomba-signature`; the server sends `x-no… | `handle-webhooks.mdx` |
| 🟠 | E25 | The money-sample regex never matches camelCase `…InKobo`, so `amountOffInKobo`, `remainingInKobo`… | `samples.ts` |
| 🟠 | E26 | The reference page's own request example for POST /v1/mandates sends startDate/endDate: "string" … | `payment-method.ts`, `attach.ts` |
| 🟠 | E27 | The refund guide's worked example refunds MORE than the refundable net — both amounts 422 with RE… | `refunds-payouts-settlement.mdx` |
| 🟠 | E28 | The settlement refund docs fix is safe, but the console ships an 'Issue refund' button on the sam… | `settlement-buttons.tsx`, `refunds-payouts-settlement.mdx`, `responses.ts` |
| 🟠 | E29 | The setup-charge disclosure is urgent and cheap; the 'auto-credit it' remedy is a money-engine ch… | `start-a-subscription.mdx`, `payment-method.ts`, `attach.ts` |
| 🟠 | E30 | The spec documents list pagination under `meta.pagination`; the API returns it as a TOP-LEVEL `pa… | `build.ts`, `openapi.json` |
| 🟠 | E31 | The spec puts list pagination at `meta.pagination`; the API returns it top-level as `pagination` … | `build.ts` |
| 🟠 | E32 | Widening the idempotency middleware to PUT/PATCH/DELETE is a breaking change that will start 400i… | `void.ts`, `void-customer-credit.ts`, `idempotency.ts` |
| 🟠 | E33 | `?active=false` on GET /v1/prices and GET /v1/plans/{id}/prices returns ACTIVE prices — `z.coerce… | `price.ts`, `catalog.test.ts` |
| 🟠 | E34 | `additionalProperties: false` in the spec is a lie — every plans/prices zod body silently STRIPS … | `price.ts`, `plan.ts` |
| 🟠 | E35 | `maxDays` on pause is documented as "auto-resume after this many days" — nothing ever reads it, s… | `subscriptions.ts`, `lifecycle-sweep.ts` |
| 🟡 | E36 | /errors documents CREDIT_GRANT_ALREADY_VOIDED and CREDIT_INSUFFICIENT_BALANCE — the API has zero … | `codes.ts`, `coupons-and-credits.mdx` |
| 🟡 | E37 | A duplicate coupon `code` returns 409 COUPON_INVALID_DEFINITION, whose documented fix is about pe… | `codes.ts`, `create.ts` |
| 🟡 | E38 | All five plans/prices mutating ops are marked `Idempotency-Key: required` in the spec but every o… | `build.ts`, `idempotency.ts` |
| 🟡 | E39 | Coupon `metadata` is write-only: accepted and stored, never returned by any endpoint | `serialize.ts`, `coupon.ts`, `responses.ts` |
| 🟡 | E40 | DELETE /v1/customers/{id}/credit/{grantId} ignores {id} — the documented "belongs to the customer… | `void.ts`, `void-customer-credit.ts` |
| 🟡 | E41 | DELETE /v1/subscriptions/{id}/discount is missing from the response map, so the spec documents it… | `responses.ts`, `openapi.json` |
| 🟡 | E42 | DISCOUNT_NOT_FOUND's documented fix tells you to verify a discount id and list discounts — the AP… | `codes.ts` |
| 🟡 | E43 | Docs say the webhook signing secret looks like `whsec_…`; the API mints `nbo_whsec_…` | `overview.mdx`, `handle-webhooks.mdx`, `verify-in-your-devtools.mdx` |
| 🟡 | E44 | Every mandate/payment-method sample id uses an id shape the API can never mint (`…mnd` / `…pm` vs… | `snippets.ts`, `samples.ts`, `responses.ts` |
| 🟡 | E45 | GET /v1/invoices cannot filter by `partially_paid` — the query enum omits a status the service im… | `invoice.ts`, `openapi.json` |
| 🟡 | E46 | GET /v1/mandates/{id} is missing from RESPONSE_DATA_BY_ROUTE → the reference page documents its r… | `responses.ts`, `openapi.json` |
| 🟡 | E47 | GET /v1/metrics/billing accepts `from`/`to` and echoes them as `windowFrom`/`windowTo`, but `dunn… | `compute.ts`, `metrics.ts`, `responses.ts` |
| 🟡 | E48 | GET /v1/plans/{id}/prices documents a `planRef` query param that the controller silently ignores | `price.ts`, `routes.ts` |
| 🟡 | E49 | GET /v1/subscriptions always returns `latestInvoiceId: null` — the documented (required) field is… | `queries.ts`, `responses.ts` |
| 🟡 | E50 | GET /v1/webhooks/{id}/deliveries documents an `endpoint` query parameter that the controller sile… | `webhook.ts`, `openapi.json` |
| 🟡 | E51 | POST /v1/plans and POST /v1/plans/{id}/prices return 201, but the reference says 200 — and the do… | `build.ts`, `responses.ts`, `samples.ts` |
| 🟡 | E52 | Rate limiting is enforced on every route in the group and appears nowhere in the docs content | `rate-limits.mdx`, `manifest.ts` |
| 🟡 | E53 | Response examples show impossible objects: a coupon with BOTH amountOffInKobo and percentOff, and… | `samples.ts` |
| 🟡 | E54 | The GET /v1/invoices example response shows every invoice line item with all-null fields | `samples.ts` |
| 🟡 | E55 | The Java code sample for "Void an invoice" calls a method named `void` — a Java reserved word; th… | `snippets.ts`, `sdk-map.ts` |
| 🟡 | E56 | The interactive <WebhookVerifier /> claims in its own header comment to mirror sara's signer "byt… | `webhook-verifier.tsx` |
| 🟡 | E57 | The interval-switch curl in the proration guide omits `Idempotency-Key` on a strict-idempotency r… | `proration-and-plan-changes.mdx` |
| 🟡 | E58 | The spec marks Idempotency-Key `required: true` on PATCH/DELETE /v1/webhooks/{id} and PUT /v1/org… | `build.ts`, `openapi.json` |
| 🟡 | E59 | `PLAN_ALREADY_ARCHIVED` tells you to "unarchive it first" — there is no unarchive endpoint, and a… | `codes.ts` |
| 🟡 | E60 | `PRICE_PLAN_MISMATCH` is published on /errors as a live catalog error but is thrown nowhere in th… | `codes.ts` |
| 🟡 | E61 | `comment` on POST /v1/subscriptions/{id}/cancel is documented and accepted, then silently discarded | `subscription.ts`, `cancel-subscription.ts`, `transition.ts` |
| 🟡 | E62 | `limit`/`cursor` on subscriptions.listEvents and dunning.listAttempts are documented as working p… | `routes.ts`, `routes.ts`, `queries.ts` |
| ⚪ | E63 | Credit-grant sample ids use the suffix `grn`; the API mints `crg` | `samples.ts`, `snippets.ts` |
| ⚪ | E64 | The changelog links `POST /v1/plans/{id}/prices` to /reference/prices, a page that has no create … | `changelog.mdx` |
| ⚪ | E65 | The generated "Create a payout" reference page shows `"bankCode": "string", "accountNumber": "str… | `samples.ts` |

### Part 4 — SDKs

| | ID | Finding | Files |
|---|---|---|---|
| 🔴 | K1 | Every nested-namespace Rust snippet renders the accessor as a struct field, not a method call — 1… | `snippets.ts` |
| 🔴 | K2 | Generated Java snippet for POST /v1/invoices/{id}/void emits `invoices().void(...)` — `void` is a… | `sdk-map.ts`, `snippets.ts`, `sdk-method-index.tsx` |
| 🔴 | K3 | Go snippet emitter omits the required params struct on 14 of 75 operations — every List call is '… | `snippets.ts` |
| 🔴 | K4 | Java webhook verifier rejects 100% of real deliveries — RUNTIME-PROVEN, and the SDK's green test … | `Webhooks.java`, `WebhooksTest.java`, `WebhookReceiver.java` |
| 🔴 | K5 | PHP webhook verifier rejects 100% of real deliveries — proven by running it (throws "Malformed X-… | `Webhooks.php`, `WebhooksTest.php`, `php.mdx` |
| 🔴 | K6 | The .NET SDK's webhook verifier implements a Stripe-style scheme the server does not use — and sh… | `WebhookVerifier.cs`, `WebhooksTests.cs`, `dotnet.mdx` |
| 🔴 | K7 | The generated .NET method index drops the `Async` suffix — all 75 method names on /sdks/dotnet/re… | `sdk-method-index.tsx` |
| 🔴 | K8 | The published Java SDK leaks the `example.*` scaffold into its PUBLIC API on Maven Central: `Erro… | `ErrorCode.java`, `openapi.json`, `registry.ts` |
| 🔴 | K9 | The published PHP SDK leaks the `example` scaffold into its public API: `ErrorCode::EXAMPLE_NOT_F… | `ErrorCode.php`, `openapi.json`, `OpenApiCoverageTest.php` |
| 🔴 | K10 | The published npm package @nombaone/node@0.1.4 ships `example.created`/`example.settled` scaffold… | `webhook-events.ts`, `webhook-events.ts` |
| 🟠 | K11 | 5 of 75 reference snippets AND the /sdks/php/reference method index name PHP methods that do not … | `sdk-map.ts` |
| 🟠 | K12 | Compiler-verified: exactly 5 of the 75 generated Elixir calls raise UndefinedFunctionError — and … | `sdk-map.ts` |
| 🟠 | K13 | Every Rust `list` snippet omits the required *ListParams argument — 13 ops fail with E0061 (Rust … | `snippets.ts`, `sdk-map.ts` |
| 🟠 | K14 | Go snippets assign bare literals to optional fields the SDK types as pointers — the SDK's own `no… | `snippets.ts` |
| 🟠 | K15 | Go snippets emit `CustomerId`/`PriceId`/`Url` — the SDK uses Go initialisms `CustomerID`/`PriceID… | `snippets.ts` |
| 🟠 | K16 | Java SDK ships a stale spec and cannot express the `minute` billing interval at all — the docs do… | `PriceInterval.java`, `openapi.json`, `java.mdx` |
| 🟠 | K17 | Nine SDKs are PUBLISHED and immutable — every SDK-touching fix in the list must be collapsed into… | `responses.ts`, `registry.ts`, `check-sdks.ts` |
| 🟠 | K18 | Params type is derived from the URL resource, not the SDK sub-namespace — nested creates get a RE… | `snippets.ts` |
| 🟠 | K19 | Ruby quickstart tells you NOMBAONE_API_KEY, then renders a snippet that reads NOMBAONE_SECRET_KEY… | `snippets.ts`, `check-sdks.ts` |
| 🟠 | K20 | Rust snippets assign bare literals and `"…".into()` to `Option<T>` / `Field<T>` fields — 13 ops f… | `snippets.ts` |
| 🟠 | K21 | SYSTEMATIC: every enum-typed builder argument in the Java snippets is emitted as a String literal… | `snippets.ts` |
| 🟠 | K22 | Six SDK method names in the generated Java index/snippets do not exist on the Java client (adding… | `sdk-map.ts`, `snippets.ts`, `sdk-method-index.tsx` |
| 🟠 | K23 | The Go guide's headline auto-pager sample does not compile — it chains `.All(ctx)` onto a two-val… | `go.mdx` |
| 🟠 | K24 | The Python webhook test suite fabricates its own signature header, so the scheme mismatch is invi… | `test_webhooks.py`, `webhooks.py`, `python.mdx` |
| 🟠 | K25 | The generated /sdks/ruby/reference method index prints 5 method names that raise NoMethodError — … | `sdk-map.ts`, `check-sdks.ts` |
| 🟠 | K26 | The shipped Go SDK leaks the `example.*` reference scaffold into its public API surface: an expor… | `errors.go`, `openapi.json`, `conformance_test.go` |
| 🟠 | K27 | The shipped NuGet package NombaOne 0.1.0 exposes `NombaoneErrorCodes.ExampleNotFound` documented … | `NombaoneErrorCodes.cs`, `NombaOne.csproj`, `registry.ts` |
| 🟠 | K28 | `check:sdks`, the build gate that claims to prove the SDK docs cannot drift, never opens a single… | `check-sdks.ts`, `sdk-map.ts`, `sdk-method-index.tsx` |
| 🟠 | K29 | `var event = …` — the snippet emitter produces a C# reserved keyword, so 2 of 75 .NET samples are… | `snippets.ts` |
| 🟠 | K30 | dunning_intervals_hours is typed list[int] but the API now takes fractional hours — mypy --strict… | `organization.py`, `openapi.json` |
| 🟠 | K31 | nombaone 0.1.0 cannot send prices[] on plan create — the headline flow of the #1 guide; its vendo… | `plans.py`, `openapi.json`, `registry.ts` |
| 🟡 | K32 | /sdks/go/reference promises "Every method in the SDK" but the generated index silently omits the … | `model.ts`, `reference.mdx`, `sdk-method-index.tsx` |
| 🟡 | K33 | /sdks/rust/reference claims "Every method in the nombaone crate" but silently omits the entire `n… | `reference.mdx`, `sdk-method-index.tsx` |
| 🟡 | K34 | All 75 PHP snippets omit `require 'vendor/autoload.php';` — `use` is an alias, not a loader, so e… | `snippets.ts` |
| 🟡 | K35 | EXAMPLE_NOT_FOUND scaffold code is shipped inside the published PyPI package's public surface — d… | `_constants.py`, `registry.ts` |
| 🟡 | K36 | Literal `"string"` placeholder leaks into the Rust samples for required bank/coupon fields — the … | `samples.ts` |
| 🟡 | K37 | Reference samples ship literal `"string"` as the value for real fields (bank codes, account numbe… | `samples.ts`, `snippets.ts` |
| 🟡 | K38 | SYSTEMATIC: all 75 generated Java snippets emit `import xyz.nombaone.Nombaone;` as the sole impor… | `snippets.ts`, `reference.mdx`, `sdk-method-index.tsx` |
| 🟡 | K39 | The .NET guide's webhook receiver does not compile — `WebhookVerificationException` is not in the… | `dotnet.mdx` |
| 🟡 | K40 | The Java guide's FIRST runnable sample does not compile: it declares one import and then uses 11 … | `java.mdx` |
| 🟡 | K41 | The `check:sdks` honesty gate never opens the Rust crate — it structurally cannot catch any of th… | `check-sdks.ts` |
| 🟡 | K42 | The five fabricated method names also render in the `<SdkMethodIndex>` on /sdks/rust/reference — … | `sdk-map.ts` |
| 🟡 | K43 | `..Default::default()` is appended to Rust params structs that do not derive Default (CouponCreat… | `snippets.ts` |
| 🟡 | K44 | `check:sdks` is advertised as the honesty gate that proves the SDK docs "can't drift", but it nev… | `check-sdks.ts`, `sdk-method-index.tsx`, `package.json` |
| 🟡 | K45 | check:sdks claims the method index is 'correct by construction' and 'proves coverage', but it nev… | `check-sdks.ts`, `sdk-method-index.tsx`, `sdk-map.ts` |
| 🟡 | K46 | python.mdx promises cursor pagination on 'every list()', but three list endpoints return an unpag… | `list-endpoints.ts`, `list-dunning-attempts.ts`, `webhook_endpoints.py` |
| ⚪ | K47 | Docs registry pins @nombaone/node at 0.1.3; the manifest and npm `latest` are both 0.1.4 | `registry.ts` |
| ⚪ | K48 | The PHP method index prints dot-notation (`customers.create`), which is string concatenation in P… | `sdk-method-index.tsx` |
| ⚪ | K49 | The SDK's CHANGELOG marks 0.1.0 "Unreleased" although it has been live on Hex since 2026-07-07 | `CHANGELOG.md` |

---

# Sequencing and blast radius — read before deleting anything

**1. Delete the `example` scaffold first.** Root cause of most of Part 1, and the only cluster that is pure *removal* — no contract change, no re-release. But it is wired through `core-db` (an `examples` **table**, in migrations), `core-contracts`, `sara`, `queue`, `admin`, `checkout`, and all nine SDKs' error enums. Order matters:

   1. **Unmount the route** (`apps/api/.../server/routes.ts`) — zero risk, kills public reachability immediately.
   2. Strip the two `example.*` events from `WEBHOOK_EVENT_CATALOG`, and `EXAMPLE_NOT_FOUND` from `packages/errors`.
   3. Remove the docs surfaces (`content/reference/examples.mdx`, the manifest entry, the `Example (deletable)` group in `error-reference.tsx`), then **regenerate** `openapi.json`, `llms.txt` and the `.md` mirrors.
   4. **Drop the `examples` table LAST, as a deliberate migration.** The Neon DB is shared with production — a migration is a production write. Not zero-risk; do not bundle it with the rest.
   5. Delete `DELETE-ME-EXAMPLE.md` itself.

**2. The webhook scheme is a fork in the road, not a bug fix.** The docs and all nine SDKs implement a Stripe-style scheme (`t=<unix>,v1=<hex>` over `"{t}.{body}"`, keyed on the plaintext secret). The server sends a **bare hex digest** keyed on `sha256(plaintext)`. The server is **self-consistent** — a tenant following its real design verifies successfully. So choose:

   - **Change the SERVER to match the docs.** But the server stores only the hash, so it has no plaintext to key on. This is not a code change — it needs a **schema migration to persist the plaintext secret**, which is exactly the security posture the current design was chosen to avoid. It also breaks any tenant who already made verification work.
   - **Change the DOCS + all nine SDKs to match the server.** Nine coordinated releases, but no production migration and nobody currently working gets broken.

   The second is almost certainly right. **Decide before touching either side** — fixing one alone leaves verification broken.

**3. Fix the two generators, not the 189 symptoms.** Most endpoint and SDK findings are not independent bugs; they are the output of two functions:

   - `apps/api/src/shared/openapi/build.ts` — hardcodes `200`, stamps `Idempotency-Key: required` on every mutating method, stamps `security` on unauthenticated routes, and emits `servers: http://localhost:8000/v1`. Fix the builder and dozens of findings vanish at once.
   - `apps/docs/src/lib/api-ref/{snippets,sdk-map,samples}.ts` — invent method names, invent `*Params` type names, and emit request bodies that violate the schema's own validation rules. Fix the generator, not the 750 generated snippets.

**4. The gates are why none of this was caught.** Three gates that *look* like they enforce correctness only enforce presence:

| Gate | What it actually checks |
|---|---|
| `check-openapi-honesty` | That a METHOD+PATH in a code sample exists in the spec. Nothing about params, bodies, responses, or status codes. |
| `check-api-ref` | That every snippet is **non-empty**. Never that it is correct. |
| `check-sdks` | That the pages exist and mention `NOMBAONE_API_KEY`. **It never opens an SDK repo.** |

Until one gate diffs the docs against the real SDKs and the real controllers, this report will be true again in a month.

---

# Part 1 — Scaffolding, stubs and placeholders that are LIVE

The owner's stated priority: *"we are already live and showing deletable endpoints and placeholders in live is detrimental to our credibility."*

Most of this has one root cause: **the boilerplate's `example` slice was never deleted.** The repo ships its own removal checklist — `DELETE-ME-EXAMPLE.md` — which was never executed. The slice has since reached the live money ledger, the public OpenAPI spec, nine published SDK packages, the AI-agent surfaces (`llms.txt`, the `.md` mirrors, the MCP server), and the rendered docs. The rest is marketing-site and docs content that promises things which do not exist.

*37 findings — 9 critical, 9 high, 17 medium, 2 low.*

## S1. 🔴 /hall claims "Real questions, real code, real answers" and "1,204 answered" — all 9 Q&As are invented and the "Ask in the open" form is dead

**What we publish**

apps/website/src/app/hall/page.tsx:152 — "Every hard question builders have hit on Nomba One, answered in the open. Real questions, real code, real answers. Curated, never careless." And hall/page.tsx:158 — `<span className="font-mono text-[13px] text-muted-foreground">1,204 answered, in public</span>`. A button at hall/page.tsx:162 invites "Add your question".

**What the code does**

The content is a hardcoded array of 9 fabricated entries (`grep -c "handle:"` → 9) with invented handles — apps/website/src/app/hall/page.tsx:25-31 `handle: "@midnight_debugger"`, then `vibecheck_vic`, `naira_nerd`. The count 1,204 appears nowhere else in the codebase; it is a literal. And the submit path does not exist: apps/website/src/components/sections/AskModal.tsx:79-81 is
```tsx
<Button variant="accent" className="mt-1 w-full">
  <Sparkles className="size-4" /> Ask in the open
</Button>
```
— no `onClick`, no `type="submit"`, no `<form>`, no `action`, no `fetch`. The `<Textarea>` (AskModal.tsx:57-62) is not even bound to state. The Image and "Add code" buttons (AskModal.tsx:66-72) are equally inert. The "Posting as" handle is seeded from a hardcoded list of 6 invented handles (AskModal.tsx:12-19).

**Impact.** LIVE AND VISIBLE: /hall is reachable from the footer and the mobile nav sheet (apps/website/src/components/chrome/Header.tsx:37 `{ label: "The Hall", href: "/hall" }`) and is in the sitemap (sitemap.ts:19). A visitor reads an explicit truth-claim ("Real questions, real code, real answers") over fabricated user handles and a fabricated social-proof counter, then types a real question, clicks "Ask in the open", and nothing happens at all — no submit, no toast, no error, the dialog just sits there. Beyond the dead form, the "1,204 answered" + "real questions" pairing is a false factual claim on a live commercial site, which is a materially worse credibility exposure than any leftover TODO in th

*…trimmed (10 more chars — see the cited files).*

**Fix.** Do one of: (1) delete the route — remove apps/website/src/app/hall/page.tsx, apps/website/src/components/sections/AskModal.tsx, the nav entry at apps/website/src/components/chrome/Header.tsx:37, the footer entry, and the "/hall" line in apps/website/src/app/sitemap.ts:19; or (2) make it honest — delete the "1,204 answered, in public" pill (hall/page.tsx:156-159), rewrite line 152 to drop "Real questions, real code, real answers" (these are team-authored FAQs, so say so), and either wire AskModal's button to a real handler/mailto or remove the AskModal trigger at hall/page.tsx:160-165 entirely. Nothing else imports AskModal outside the hall page. No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/app/hall/page.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/components/sections/AskModal.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/components/chrome/Header.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/app/sitemap.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct: the quotes are verbatim at the cited lines, all 9 Q&As are hardcoded with invented handles, "1,204" is a bare literal appearing nowhere else in the repo, and the "Ask in the open" button has no onClick/type=submit/form/action/fetch (the Textarea is not bound to state either), so the form is genuinely dead. No guard, env gate, or later wiring exists — rg across apps/website/src finds no submit path at all. Two fixes to the auditor's write-up: (1) /hall is NOT reachable from the footer — Footer.tsx has no /hall link; it is reachable from the MOBILE nav sheet only (Header.tsx:33-38 MOBILE_EXTRA, not the desktop NAV), from the /pricing FAQ (pricing/page.tsx:
> 
> *…trimmed (776 more chars — see the cited files).*
> Two corrections, net-negative for the owner (reachability is broader than the finding claims, severity is narrower).
> 
> REACHABILITY — the finding is WRONG about the footer but MISSED a worse entry point:
> - Footer does NOT link /hall (apps/website/src/components/chrome/Footer.tsx contains zero "hall" references). That part of the impact claim is false.
> - Header.tsx:37 confirmed, but /hall is in MOBILE_EXTRA only — it is NOT in the desktop primary nav.
> - MISSED: apps/website/src/app/pricing/page.tsx:5 imports the same AskModal and renders it at lines 176-180, under the copy "Not here? Ask us. We answer in the open, in the Hall." /pricing IS in the primary desktop nav (Header.tsx). So the dead f
> 
> *…trimmed (1390 more chars — see the cited files).*

---

## S2. 🔴 4 of the 5 cards on the public /use-cases page (primary nav) land on a placeholder that says "we're working on it."

**What we publish**

apps/website/src/app/use-cases/page.tsx:16-42 renders five UseCaseCards linking to `/use-cases/saas` (:18), `/use-cases/school-fees` (:24), `/use-cases/gyms` (:30), `/use-cases/lending` (:36), `/use-cases/platforms` (:42). "Use cases" is a top-level desktop nav item — apps/website/src/components/chrome/Header.tsx:26 `{ label: "Use cases", href: "/use-cases" }` — and /use-cases is listed in apps/website/src/app/sitemap.ts:12 so Google crawls it.

**What the code does**

Only one of those five has a real page. `find apps/website/src/app -name page.tsx` returns exactly one static use-case route: apps/website/src/app/use-cases/school-fees/page.tsx. The other four fall through to the dynamic segment apps/website/src/app/use-cases/[slug]/page.tsx, whose entire body is:
```tsx
/** Placeholder — rebuilt against NOMBAONE.pen in its own pass. */
<SectionHeader
  title={slug}          // line 10 — renders the raw lowercase slug, e.g. "saas"
  deck="we're working on it."   // line 11
/>
```
There is no `notFound()` and no `generateStaticParams`, so it always renders.

**Impact.** LIVE AND VISIBLE: a prospect clicks "Use cases" in the header of nombaone.xyz, sees five confident cards, clicks "SaaS" (or Gyms/Lending/Platforms) and gets a near-empty page whose headline is the literal lowercase string `saas` above the words "we're working on it." Four out of five clicks from a primary-nav page dead-end into a visibly unfinished scaffold. This is exactly the "placeholders in live" the owner is worried about, on the highest-traffic marketing surface.

**Fix.** Two options, both concrete. (a) Ship the four pages. (b) Until then, stop advertising them: in apps/website/src/app/use-cases/page.tsx delete the four entries at lines 16-22, 28-34, 34-40, 40-46 of the USE_CASES array, leaving only the school-fees entry; and in apps/website/src/app/use-cases/[slug]/page.tsx replace the whole body with `import { notFound } from 'next/navigation'; export default async function Page({ params }) { await params; notFound(); }` so a guessed/stale URL 404s honestly instead of rendering a scaffold. Nothing breaks — no other file imports the [slug] page, and sitemap.ts already omits these four slugs. No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/app/use-cases/page.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/app/use-cases/[slug]/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> The code facts are exactly as reported and there is no guard, env gate, redirect, or default that rescues it: apps/website/src/app/use-cases/[slug]/page.tsx has no notFound(), no generateStaticParams, no dynamicParams=false, and there is no middleware.ts or next.config redirect — so /use-cases/saas, /gyms, /lending, /platforms all render an <h2> containing the literal lowercase slug above the deck "we're working on it.", reachable in two clicks from the top-level "Use cases" nav item (Header.tsx:26). Only /use-cases/school-fees is a real page. Two corrections to the auditor's framing: (1) "LIVE AND VISIBLE on nombaone.xyz" is unproven from the repo — apps/website has no .vercel project link 
> 
> *…trimmed (769 more chars — see the cited files).*
> Accurate on the facts, but two adjustments. (1) Reach is WIDER than claimed: the home page itself links into the placeholder twice — apps/website/src/app/page.tsx:331 and :480 both href="/use-cases/platforms" — so a visitor hits the dead-end one click from nombaone.xyz/, not only via the Use cases index. Additionally, the catch-all renders 200 for any arbitrary slug (indexable soft-404). (2) Severity is HIGH, not critical: it is a live, public, visibly unfinished marketing surface, but it touches no money, auth, data, or correctness path.

---

## S3. 🔴 Homepage "Run simulation" button is a dead no-op — the flagship demo does nothing when clicked

**What we publish**

apps/website/src/components/sections/SimulatorStage.tsx:82-87 renders a primary CTA button:
```
        <button
          type="button"
          ...
          Run simulation
        </button>
```
It is rendered on the live homepage at apps/website/src/app/page.tsx:270 (`<SimulatorStage />`).

**What the code does**

The component's own doc-comment admits it is inert — apps/website/src/components/sections/SimulatorStage.tsx:28-31:
```
/**
 * Static SimulatorStage skin (.pen D5rg1S, doc-02 resting state). The live,
 * sandbox-backed version and its SSE endpoint are a separate Phase-B piece.
 */
```
`grep -n "onClick" apps/website/src/components/sections/SimulatorStage.tsx` returns NOTHING. All three buttons (lines 82, 88, 94) are `type="button"` with no handler, no form, no action. The event feed is a hardcoded `const EVENTS` array (line 18).

**Impact.** LIVE AND VISIBLE: reachable at https://nombaone.xyz (homepage, mid-page section). A prospect clicks the product's signature interactive demo — "Run simulation" — and absolutely nothing happens. No spinner, no error, no state change. This is the single most damaging item found: it is the hero interaction of the marketing site and it is visibly broken to every visitor who tries it.

**Fix.** Either (a) remove the three dead buttons — delete apps/website/src/components/sections/SimulatorStage.tsx:82-96 — leaving the static event feed as a non-interactive illustration; or (b) wire them. If removing, nothing else breaks: SimulatorStage is imported only at apps/website/src/app/page.tsx:30 and rendered only at :270. NO DB migration is involved — this is pure presentational code.

**Files.** `apps/website/src/components/sections/SimulatorStage.tsx`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: The homepage SimulatorStage section (apps/website/src/components/sections/SimulatorStage.tsx, rendered at apps/website/src/app/page.tsx:270) is entirely static — not just the "Run simulation" button. It has no `"use client"` directive, so it is a Server Component with zero interactivity by construction: all three buttons (lines 82, 88, 94) are inert, the rail "tabs" are non-clickable `<span>`s (line 44), and the timeline/webhook console are hardcoded const arrays (lines 6, 14). The website app contains no API routes at all.
> 
> This is NOT an accidental bug. It is an explicitly documented Phase-B deferral, stated in the component doc-comment (lines 28-31) AND in apps/website/V
> 
> *…trimmed (1031 more chars — see the cited files).*
> The dead-button claim is accurate and the component IS unconditionally rendered on the public homepage (no gate), so it is reachable by every visitor. It is also slightly worse than described: the rail "selector" pills are <span>s, not buttons, and the section deck at apps/website/src/app/page.tsx:266 explicitly tells the visitor to "Pick a rail, run it, then break it" — so the page promises an interaction it cannot deliver, across three affordances. However, the severity is NOT critical: no money, auth, data, or integrator path is affected, and this is a knowingly-deferred Phase-B skin (per the component's own doc-comment), not a regression. The real defect is shipping a static skin under i
> 
> *…trimmed (127 more chars — see the cited files).*

---

## S4. 🔴 Public GET /v1/openapi.json advertises servers.url = http://localhost:8000/v1 AND double-prefixes every path with /v1 — every generated client calls localhost:8000/v1/v1/…

**What we publish**

The committed snapshot of the live spec, apps/docs/src/generated/openapi.json:8-12, declares `"servers": [{ "url": "http://localhost:8000/v1", "description": "One base URL for both modes — the API key prefix (nbo_sandbox_ / nbo_live_) selects sandbox vs live." }]`, while every one of its 62 path keys ALSO carries the prefix (line 2886: `"/v1/plans": {`). The route that serves it is documented as public: apps/api/src/apps/main/server/routes.ts:55-56 — `// The generated OpenAPI 3.1 document (L ⚠) — public (codegen tools fetch it),`.

**What the code does**

apps/api/src/shared/openapi/build.ts:117 — `export function buildOpenApiDocument(v1Router: Router, baseUrl = 'http://localhost:8000')`. Line 119 — `collectRoutes(v1Router, '/v1', routes);` (so `specPath` is already `/v1/plans`). Line 161 — `servers: [{ url: `${baseUrl}/v1`, … }]`. And the caller passes NO baseUrl: apps/api/src/apps/main/server/routes.ts:59-62 — `v1Router.get('/openapi.json', (_req, res) => { cachedOpenApiDoc ??= buildOpenApiDocument(v1Router); res.json(cachedOpenApiDoc); });`. It is mounted on `v1Router` (routes.ts:110-133) with NO `apiKeyAuth`, NO mode gate — it is unauthenticated. So in production `GET https://api.nombaone.xyz/v1/openapi.json` returns servers=`http://localhost:8000/v1` and paths=`/v1/plans`.

**Impact.** LIVE AND VISIBLE: reachable unauthenticated at https://api.nombaone.xyz/v1/openapi.json (and the sandbox host). Two compounding defects. (1) Anyone who imports the spec into Postman/Insomnia, or runs openapi-generator / Speakeasy / Stainless / `openapi-typescript` against it, gets a client whose base URL is the developer's own laptop — every call fails with ECONNREFUSED. (2) Even after they hand-fix the host, server-url + path concatenation yields `https://api.nombaone.xyz/v1` + `/v1/plans` = `/v1/v1/plans` → 404 on every single operation. A developer doing the single most normal thing with a public OpenAPI document gets a 100%-broken client and no clue why. Note this is NOT visible in apps/

*…trimmed (158 more chars — see the cited files).*

**Fix.** Two edits in apps/api. (1) apps/api/src/shared/openapi/build.ts:161 — stop appending `/v1` to the server URL, since the paths already carry it: change to `servers: [{ url: baseUrl, description: '…' }]`. (2) apps/api/src/apps/main/server/routes.ts:60 — pass the real public base instead of taking the localhost default: `cachedOpenApiDoc ??= buildOpenApiDocument(v1Router, process.env.PUBLIC_API_BASE_URL ?? 'https://api.nombaone.xyz');` and set PUBLIC_API_BASE_URL per deployment (sandbox host on the sandbox deploy). Then re-run `pnpm --filter @nombaone/api gen:openapi` to refresh apps/docs/src/generated/openapi.json. NOTHING BREAKS: the docs read only `paths` from the snapshot (src/lib/playground-allowlist.ts:20, src/app/api/mcp/route.ts:101, src/lib/api-ref/model.ts) — the `servers` block is unused there, and the playground's host comes from NEXT_PUBLIC_INFRA_API_BASE. No DB migration invol

*…trimmed (32 more chars — see the cited files).*

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/api/src/apps/main/server/routes.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The bug is REAL and live, but it is ONE defect, not two — and the auditor misidentifies which half is broken. Only apps/api/src/shared/openapi/build.ts:161 is wrong: `servers: [{ url: `${baseUrl}/v1` }]` appends /v1 to a base whose path keys already carry /v1 (set by collectRoutes(v1Router, '/v1', routes) at build.ts:119). The /v1-prefixed path keys are CORRECT and load-bearing — apps/docs/scripts/check-openapi-honesty.ts:71 validates real calls as `https://host/v1/PATH` against those keys, and apps/docs/src/lib/api-ref/snippets.ts:53 pairs a bare host (HOST = "https://sandbox.api.nombaone.xyz", no /v1) with the /v1 path. The repo convention is base = bare host, path = /v1/.... Stripping /v1
> 
> *…trimmed (1080 more chars — see the cited files).*
> Facts hold; only the severity and one omission need adjusting. Severity is high, not critical (no money/auth/data/security impact, loud immediate failure, one-line fix). The finding also UNDERSTATES reach: the bad spec is not just fetched live — the committed snapshot is imported by apps/docs/src/app/api/mcp/route.ts:11 (the read-only MCP server), the ApiReference renderer, playground-allowlist.ts, and the Ask/agent-native index builders, so AI agents and doc tooling also receive http://localhost:8000/v1. Correct fix: servers[].url must be the bare origin with NO /v1 (collectRoutes already prefixes every path with /v1), and a real baseUrl must be threaded into buildOpenApiDocument from route
> 
> *…trimmed (151 more chars — see the cited files).*

---

## S5. 🔴 Public OpenAPI spec tells every integrator the API base URL is http://localhost:8000/v1

**What we publish**

apps/docs/src/generated/openapi.json:1 (and the identical vendored copy in all 9 public SDK repos, e.g. /Users/mac/Vault/the-60/nombaone/nombaone-node/spec/openapi.json) declares: `"servers": [{"url": "http://localhost:8000/v1", "description": "One base URL for both modes — the API key prefix (nbo_sandbox_ / nbo_live_) selects sandbox vs live."}]`

**What the code does**

apps/api/src/shared/openapi/build.ts:117 `export function buildOpenApiDocument(v1Router: Router, baseUrl = 'http://localhost:8000')` and build.ts:161 `servers: [{ url: `${baseUrl}/v1`, ... }]`. The only caller is apps/api/src/apps/main/server/routes.ts:60 `cachedOpenApiDoc ??= buildOpenApiDocument(v1Router);` — it passes NO baseUrl, so the default wins. That handler is registered on `v1Router` with zero middleware (routes.ts:59) and v1Router is mounted at apps/api/src/apps/main/server/index.ts:64 `app.use('/v1', v1Router)`, so `GET https://api.nombaone.xyz/v1/openapi.json` is unauthenticated and public.

**Impact.** LIVE AND VISIBLE: reachable with no key at GET https://api.nombaone.xyz/v1/openapi.json (and sandbox.api.nombaone.xyz), plus the committed copy powering docs.nombaone.xyz and the 9 public SDK GitHub repos. Any integrator who runs `openapi-generator generate -i https://api.nombaone.xyz/v1/openapi.json`, imports the spec into Postman/Insomnia, or points an agent at it gets a client whose base URL is http://localhost:8000/v1 — every generated call fails with ECONNREFUSED, over plaintext HTTP, against their own machine. This is the single most damaging artifact found: it is machine-read, so it silently poisons generated code rather than being noticed and ignored.

**Fix.** apps/api/src/apps/main/server/routes.ts:60 — pass the real host: `buildOpenApiDocument(v1Router, process.env.PUBLIC_API_URL ?? 'https://api.nombaone.xyz')`. Better, change the default at apps/api/src/shared/openapi/build.ts:117 from `'http://localhost:8000'` to `'https://api.nombaone.xyz'` so an unset env can never emit localhost, and emit BOTH servers (live + sandbox). Then regenerate apps/docs/src/generated/openapi.json and re-vendor spec/openapi.json into all 9 SDK repos. Nothing breaks: no code reads `servers` (apps/docs/src/lib/api-ref/snippets.ts:53 hardcodes `const HOST = "https://sandbox.api.nombaone.xyz"`, which is why the curl samples are correct and this was never caught). No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/build.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/server/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/generated/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/spec/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and the fix is required, but two details need adjusting. (a) Scope of the code defect is WIDER than reported: the auditor names only routes.ts:60 as "the only caller". There is a second call site — apps/api/scripts/gen-openapi.ts:20 `const doc = buildOpenApiDocument(v1Router);` — which also omits baseUrl and is what actually writes the committed apps/docs/src/generated/openapi.json and the copies vendored into the 9 SDK repos. Both call sites must be fixed, not just the handler. (b) Impact is NARROWER than reported: no shipped code is broken. The 9 hand-written SDK clients hardcode the correct hosts and derive them from the nbo_sandbox_/nbo_live_ key prefix (nombaone-n
> 
> *…trimmed (737 more chars — see the cited files).*
> The spec IS public, unauthenticated, and does advertise http://localhost:8000/v1 in production (confirmed: routes.ts:60 passes no baseUrl; platformGate only gates mutating requests). But the impact claim is overstated on two counts. First, it does not reach most integrators: the shipped SDKs hardcode the correct hosts (nombaone-node/src/client.ts:25-26) and the docs' rendered request snippets hardcode the host too (apps/docs/src/lib/api-ref/snippets.ts:53) — `servers` is typed in api-ref/model.ts:47 but never rendered. Only raw-spec consumers (openapi-generator, Postman/Insomnia, agents fetching the spec or the docs MCP route) are affected. Second, it does not "silently poison" anything: a g
> 
> *…trimmed (371 more chars — see the cited files).*

---

## S6. 🔴 The entire /merchants "Share a payment link" page documents a feature that exists nowhere — no payment link in the console, the API, or the checkout app

**What we publish**

apps/docs/content/merchants/share-a-payment-link.mdx:8-32 — "The fastest way to put a customer on a plan is a **payment link**... In the console, open the plan you want to collect and choose **Share link** (or **Payment link**). The console gives you a link tied to that plan and price... When a customer opens it, they enter their details, choose how to pay (card, bank transfer, or direct debit), and confirm... Once they've paid the first time, Nomba One bills them every cycle automatically." It is a first-class nav entry (apps/docs/content/manifest.ts:299), the headline of the merchant track (merchants/overview.mdx:4 "collect recurring payments with a link", :20-22), is mirrored to apps/docs/public/merchants/share-a-payment-link.md, advertised in apps/docs/public/llms.txt:134, appears 8 times in apps/docs/public/llms-full.txt, and is translated into Yorùbá and Hausa (apps/docs/l10n/yo/merchants/share-a-payment-link.mdx, apps/docs/l10n/ha/merchants/share-a-payment-link.mdx).

**What the code does**

There is no payment-link feature anywhere in the product. `grep -rniE "payment.?link|share link" apps/console/src apps/api/src packages` returns ZERO hits — no console button, no route, no resource, no endpoint. apps/console/src/components/console/plans/ contains only new-plan-button.tsx, new-price-button.tsx and plan-action-buttons.tsx (create price / archive) — there is no Share-link affordance on a plan. The only "payment link" strings in the repo are in apps/checkout (apps/checkout/src/app/page.tsx:16, not-found.tsx:23, lib/actions.ts:65), and apps/checkout is the DELETABLE EXAMPLE SCAFFOLD: apps/checkout/src/app/[reference]/page.tsx:12-24 resolves an `ExampleResponseData` by an `nbo…exa` reference via `getExampleByReference` — it knows nothing about plans, prices, customers, rails, or subscriptions, and it cannot start recurring billing. Nothing in the codebase can mint a plan-scoped, reusable, self-serve subscribe-and-pay URL.

**Impact.** A non-technical merchant — the exact audience this section is written for — signs into console.nombaone.xyz, opens their plan, and looks for the "Share link" button the docs told them to click. It does not exist, and never has. This is not a stale sentence: it is a whole published page, a nav item, a card on the merchant overview, an entry in the machine-readable llms.txt an AI agent will parrot back, and two translations. It is the single largest fabrication in the docs and no auditor looked at /merchants at all (the entire 5-page merchant track has ~1 finding against it in 191).

**Fix.** Either build it or delete it. Deleting: remove apps/docs/content/merchants/share-a-payment-link.mdx, the manifest entry at apps/docs/content/manifest.ts:299, the Card at apps/docs/content/merchants/overview.mdx:20-22, the cross-links from merchants/set-up-dunning-messages.mdx:49-51 and merchants/read-a-settlement.mdx, the yo/ha translations, then rebuild so llms.txt / llms-full.txt / search-index.json / ask-index.json / sitemap.xml drop it. Also fix merchants/overview.mdx:4 and :33-34, which sell the link as the primary way a subscription begins.

**Files.** `apps/docs/content/merchants/share-a-payment-link.mdx`, `apps/docs/content/merchants/overview.mdx`, `apps/docs/content/manifest.ts`, `apps/docs/l10n/yo/merchants/share-a-payment-link.mdx`, `apps/docs/l10n/ha/merchants/share-a-payment-link.mdx`

---

## S7. 🔴 The shipped OpenAPI spec advertises /v1/examples and /v1/sandbox/* as real endpoints — feeding the docs API reference, the playground allowlist, and the agent MCP `list_operations` tool

**What we publish**

apps/docs/src/generated/openapi.json (committed, 62 paths) contains: `/v1/examples` [post, get], `/v1/examples/{id}` [get], `/v1/sandbox/payment-methods` [post], `/v1/sandbox/subscriptions/{id}/advance-cycle` [post], `/v1/sandbox/webhooks/simulate` [post]. Each carries `security: [{ApiKeyAuth: []}]` like every other operation, with nothing marking it as scaffold or sandbox-only.

**What the code does**

apps/api/src/shared/openapi/build.ts:119 `collectRoutes(v1Router, '/v1', routes);` walks the ACTUALLY-MOUNTED router with NO exclusion list. apps/api/src/apps/main/server/routes.ts:48 `v1Router.use(exampleRouter);` and :53 `v1Router.use(testRouter);` mount both unconditionally, so both land in the spec. The spec is then consumed by three production surfaces: apps/docs/src/components/mdx/api-reference.tsx:1 `import openapi from "@/generated/openapi.json";` (renders the reference); apps/docs/src/lib/playground-allowlist.ts:8 "adding an endpoint + re-snapshotting auto-allows it with no edit here" (so POST /examples is auto-forwardable); apps/docs/src/app/api/mcp/route.ts:99-112 `listOperations()` iterates `spec.paths` with no filter, and its tool description (route.ts:156) says "List every Nomba One API operation ... from the live OpenAPI schema."

**Impact.** LIVE AND VISIBLE: reachable with no auth at all — anyone can GET https://api.nombaone.xyz/v1/openapi.json (routes.ts:59, no apiKeyAuth middleware), browse the rendered reference on docs.nombaone.xyz, or point an AI agent at the docs MCP server and get `/v1/examples` returned as a real, first-class Nomba One endpoint. This is precisely the owner's stated concern: an integrator (or their coding agent) sees a scaffold resource presented as product. IMPORTANT CORRECTION to the earlier pass, which called exampleRouter "mounted UNGATED": it is NOT actually callable by a real merchant. apps/api/src/apps/main/modules/example/routes.ts:34 requires `requireScope('example:write')`; packages/sara/src/ap

*…trimmed (523 more chars — see the cited files).*

**Fix.** Delete the example slice, then regenerate the spec. Code-only (ZERO database risk): (1) apps/api/src/apps/main/server/routes.ts — remove line 9 `import { exampleRouter } ...` and line 48 `v1Router.use(exampleRouter);`; (2) rm -rf apps/api/src/apps/main/modules/example/; (3) rm -rf packages/sara/src/example/ and drop its barrel export; (4) packages/sara/src/rails/index.ts — remove lines 2, 6, 15, 16 (mock rail import/export/registration) and delete packages/sara/src/rails/mock.ts; (5) packages/sara/src/reference.ts:41 — remove `| 'EXA'`; (6) delete packages/core-contracts/src/types/example.ts + validations/example.ts and their barrel exports; (7) packages/core-contracts/src/types/api-key.ts:27-28 and validations/api-key.ts:26-27 — remove 'example:read'/'example:write'; (8) packages/core-contracts/src/types/webhook-events.ts:107-109 — remove the example.* entries; (9) packages/errors/src/c

*…trimmed (1550 more chars — see the cited files).*

**Files.** `apps/api/src/apps/main/server/routes.ts`, `apps/api/src/shared/openapi/build.ts`, `apps/api/src/apps/main/modules/example/routes.ts`, `apps/docs/src/generated/openapi.json`, `packages/sara/src/rails/index.ts`, `packages/core-contracts/src/types/api-key.ts`, `packages/errors/src/codes.ts`, `packages/queue/src/queues/index.ts`, `packages/core-db/src/schema/index.ts`, `apps/api/scripts/provision-docs-key.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the OpenAPI snapshot does leak the scaffold resource /v1/examples (3 operations) into two machine surfaces — the raw public GET /v1/openapi.json and the docs MCP `list_operations` tool (mcp/route.ts:99-112, unfiltered `spec.paths`) — plus the playground allowlist. Fix: add an exclusion list to build.ts (or filter at snapshot time), mirroring the allowlist that apps/docs/src/lib/api-ref/model.ts:138 already applies.
> 
> Three corrections to the finding as written:
> 1. It does NOT feed the docs API reference. api-reference.tsx is unused (zero `<ApiReference>` usages in content/); the real generator, src/lib/api-ref/model.ts, already excludes `examples` and `sandbox` via a curated
> 
> *…trimmed (1007 more chars — see the cited files).*
> The accurate finding is narrower: ONLY /v1/examples (post/get, plus /v1/examples/{id}) is a scaffold leaking into the shipped public OpenAPI spec, the rendered docs API reference (there is even a full published page apps/docs/content/reference/examples.mdx that says "delete the slice"), the playground allowlist, and the docs MCP list_operations. The /v1/sandbox/* paths are NOT a defect — they are intentional Stripe-style sandbox test instruments, gated by requireSandboxMode (live keys refused, handlers re-check ctx.mode) and deliberately advertised by the docs MCP list_test_methods tool. Impact is credibility/DX only, not security: example:write is unmintable, so every real key gets 403. Sev
> 
> *…trimmed (27 more chars — see the cited files).*

---

## S8. 🔴 The three concept pages the multi-rail doc sends you to for card / mandate / virtual-account are all unwritten stubs on the live docs site

**What we publish**

apps/docs/content/concepts/multi-rail-push-and-pull.mdx:15-18 and :32 deep-link the reader to the rail explainers: "See [card tokens expire](/concepts/hard-parts/card-tokens-expire) and the OTP recovery model.", "pull from a bank account the customer has authorized with a [mandate](/concepts/hard-parts/mandates-and-consent)", "[a transfer that doesn't match the invoice](/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice) is a real case you must handle, not an edge." All three are routable pages listed in apps/docs/content/manifest.ts:207-216.

**What the code does**

All three targets are placeholder stubs. apps/docs/content/concepts/hard-parts/mandates-and-consent.mdx:6 — `> Draft. On the roster, not yet written.` (whole file is 9 lines). apps/docs/content/concepts/hard-parts/card-tokens-expire.mdx:6 — same line (8 lines total). apps/docs/content/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice.mdx:6 — same line (9 lines total). A repo-wide grep for `not yet written` returns 12 published pages carrying that exact line, including `migrate/from-stripe.mdx:6` and `migrate/from-paystack.mdx:6`.

**Impact.** Every developer integrating the mandate rail, the card-OTP recovery path, or transfer reconciliation — the three genuinely hard parts of this API, and the three the docs themselves flag as must-reads — clicks through from a polished page and lands on "Draft. On the roster, not yet written." It reads as an abandoned product, and it is served on the production docs host with no `draft: true` frontmatter or noindex to hide it.

**Fix.** Either write the three pages, or (as an immediate mitigation) add `draft: true` to their frontmatter, exclude drafted slugs from apps/docs/content/manifest.ts (lines 207-216) and from the route's generateStaticParams, and convert the three links in apps/docs/content/concepts/multi-rail-push-and-pull.mdx:16, :18, :32 into plain prose so no reader is routed to a stub. Add a CI honesty gate that fails the docs build if any file in content/ matches /not yet written/ and is reachable from the manifest.

**Files.** `apps/docs/content/concepts/hard-parts/mandates-and-consent.mdx`, `apps/docs/content/concepts/hard-parts/card-tokens-expire.mdx`, `apps/docs/content/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice.mdx`, `apps/docs/content/concepts/multi-rail-push-and-pull.mdx`, `apps/docs/content/manifest.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct. Accurate version: the three rail explainers deep-linked from apps/docs/content/concepts/multi-rail-push-and-pull.mdx (lines 16, 18, 32) are all placeholder stubs whose entire body is `> Draft. On the roster, not yet written.` plus one sentence. Twelve published .mdx pages carry that exact marker (9 of the 14 hard-parts pages, plus migrate/from-stripe and migrate/from-paystack). There is no draft/noindex machinery anywhere in apps/docs: src/lib/content.ts:304-307 `listRoutableSlugs()` applies no draft filter, so the stubs are routed and emitted into src/app/sitemap.ts (submitted to docs.nombaone.xyz/sitemap.xml), and src/app/robots.ts is `allow: '/'` — th
> 
> *…trimmed (1344 more chars — see the cited files).*
> The finding is accurate but under-scoped and over-rated. Under-scoped: the stub problem is 12 published pages, not 3 — ten of the twelve concepts/hard-parts pages plus both migration landing pages (migrate/from-stripe.mdx, migrate/from-paystack.mdx), so the whole "why we're different" section and the top-of-funnel conversion pages are placeholders. Reachability is confirmed on three independent paths (inline links from multi-rail-push-and-pull.mdx:15-18,32; sidebar nav via manifest.ts:207-216; search + agent-native .md/llms.txt mirror + Ask-AI), and I confirmed there is no `draft` frontmatter handling, noindex, or build filter anywhere in apps/docs/scripts or apps/docs/src, and none of the n
> 
> *…trimmed (256 more chars — see the cited files).*

---

## S9. 🔴 The word "deletable" and the example scaffold are shipped across SEVEN live docs surfaces — including llms.txt, the global sidebar, the Quickstart, the search index and the Ask-AI corpus (in 3 languages)

**What we publish**

apps/docs/content/manifest.ts:229 — `{ slug: "/reference/examples", title: "Example", method: "POST", summary: "The deletable worked example (removed with the scaffold)." }`. That single summary string is copied verbatim into the agent-facing index: apps/docs/public/llms.txt:92 — `- [Example](https://docs.nombaone.xyz/reference/examples.md): The deletable worked example (removed with the scaffold).` The page body says it too: apps/docs/public/reference/examples.md — "Creates an **example**: the one deletable endpoint…" and "Use this as the template for your own resources, then delete the slice."

**What the code does**

The blast radius is far wider than the /reference/examples page itself. I verified each in the BUILT output: (a) apps/docs/content/getting-started/quickstart.mdx:80 — `<Card title="The example endpoint" href="/reference/examples">` — renders on the #1 landing page for every new integrator, and identically in l10n/yo/getting-started/quickstart.mdx:80 and l10n/ha/getting-started/quickstart.mdx:84; 7 built HTML pages link to it (quickstart, webhooks/overview, reference/glossary × en/yo/ha). (b) The manifest entry puts a nav item titled "Example" with a POST method chip in the "API reference" sidebar of EVERY page. (c) apps/docs/public/search-index.json contains 5 records for it (id `/reference/examples`, title "Create an example") → it is a Cmd-K search result. (d) apps/docs/public/ask-index.json contains 4 records → the Ask-AI bot will recommend it. (e) apps/docs/src/app/sitemap.ts:22 uses `listRoutableSlugs()`, and src/app/robots.ts allows `/` → https://docs.nombaone.xyz/reference/examples is submitted to Google. (f) The live /errors page renders `<h2 class="…">Example (deletable)</h2

*…trimmed (213 more chars — see the cited files).*

**Impact.** LIVE AND VISIBLE: no auth, no gate, no key. A visitor to https://docs.nombaone.xyz/getting-started/quickstart sees a card titled "The example endpoint"; the left sidebar of every page shows "Example · POST"; /errors shows a heading literally reading "Example (deletable)"; Cmd-K surfaces it; Google indexes it. Worst of all, every AI coding agent that fetches https://docs.nombaone.xyz/llms.txt — the canonical machine index — reads the literal sentence "The deletable worked example (removed with the scaffold)." This is precisely the credibility hit the owner named, and it is being served to humans, to crawlers, and to LLMs simultaneously. Secondary: the page's own happy-path curl is broken anyw

*…trimmed (26 more chars — see the cited files).*

**Fix.** Delete the docs surfaces first (safe, no DB, no API change): (1) apps/docs/content/manifest.ts:229 — delete the `/reference/examples` line. (2) `rm apps/docs/content/reference/examples.mdx`. (3) apps/docs/content/getting-started/quickstart.mdx:80-82 — delete the `<Card title="The example endpoint" …>` block; same at l10n/yo/getting-started/quickstart.mdx:80 and l10n/ha/getting-started/quickstart.mdx:84. (4) Remove the remaining `/reference/examples` links in content/webhooks/overview.mdx and content/reference/glossary.mdx. (5) apps/docs/src/components/mdx/error-reference.tsx:50 — delete the `["EXAMPLE_", "Example (deletable)"]` family row. (6) Rebuild: `pnpm -F @nombaone/docs build` regenerates llms.txt, llms-full.txt, search-index.json, ask-index.json, sitemap.xml and the .md mirrors, and `rm -rf apps/docs/public/reference/examples.md`. WHAT BREAKS: step 5 only hides the family header —

*…trimmed (561 more chars — see the cited files).*

**Files.** `apps/docs/content/manifest.ts`, `apps/docs/content/reference/examples.mdx`, `apps/docs/content/getting-started/quickstart.mdx`, `apps/docs/l10n/yo/getting-started/quickstart.mdx`, `apps/docs/l10n/ha/getting-started/quickstart.mdx`, `apps/docs/content/webhooks/overview.mdx`, `apps/docs/content/reference/glossary.mdx`, `apps/docs/src/components/mdx/error-reference.tsx`, `apps/docs/public/llms.txt`, `apps/docs/public/reference/examples.md`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct; three refinements. (1) Severity is high, not critical — the blast radius is real (7 built HTML pages, llms.txt, llms-full.txt, 5 search-index records, 4 ask-index records, the global "API reference" sidebar, the /errors heading, and the Google-submitted sitemap) but it is a credibility defect, not a functional/security/money defect. Nothing is broken; a visitor who follows the link reaches a page describing an endpoint that genuinely exists. (2) Two citation errors, neither material: the l10n quickstarts live at apps/docs/l10n/yo/... and apps/docs/l10n/ha/... (NOT apps/docs/content/l10n/...), though the line numbers 80 and 84 are exact; and "reference/gl
> 
> *…trimmed (1033 more chars — see the cited files).*
> The reachability claims are accurate and verified in the built output; the severity is not. Two corrections: (1) Severity is medium, not critical — the impact is purely credibility/professionalism on public docs surfaces. No money, auth, data, or availability is affected, and no integrator's request fails. (2) The finding (and the manifest string itself) wrongly implies the endpoint was removed. POST /v1/examples is LIVE: apps/api/src/apps/main/server/routes.ts:9 mounts exampleRouter, with controllers under apps/api/src/apps/main/modules/example/. So the accurate framing is: the docs publicly describe a real, shipping endpoint as deletable scaffolding across seven surfaces (manifest sidebar 
> 
> *…trimmed (282 more chars — see the cited files).*

---

## S10. 🟠 "Ask in the open" submit button on /hall and /pricing is a dead no-op — visitor questions are silently discarded

**What we publish**

apps/website/src/components/sections/AskModal.tsx:79-81:
```
          <Button variant="accent" className="mt-1 w-full">
            <Sparkles className="size-4" /> Ask in the open
          </Button>
```
The modal collects a handle (Input, :42), a question (Textarea, :56), and a "Feature my question in the Hall" switch (:73).

**What the code does**

The Button has no `type`, no `onClick`, no `action`, and is not inside a `<form>` — there is no submit path and no network call anywhere in the file. The "Image" (:64) and "Add code" (:67) buttons are likewise handler-less. The "Posting as" field is prefilled from a hardcoded fake-handle array, apps/website/src/components/sections/AskModal.tsx:12-19: `const HANDLES = ["midnight_debugger", "ships_at_3am", "kudi_gremlin", "miraculous_mimi", "code_wizard_99", "aunty.tech"];`

**Impact.** LIVE AND VISIBLE: the modal is opened from https://nombaone.xyz/hall (apps/website/src/app/hall/page.tsx:160) and https://nombaone.xyz/pricing (apps/website/src/app/pricing/page.tsx:176). A prospective customer types a real pre-sales question, clicks "Ask in the open", and the button does nothing — no confirmation, no error, no submission. They conclude the site is broken, or worse, they believe the question was sent and wait for an answer that will never come. On the /pricing page this is a lost sales lead.

**Fix.** Either wire the submit (a server action posting to a questions table or an email/Slack webhook) or remove the affordance. To remove: delete apps/website/src/components/sections/AskModal.tsx and its two call sites — apps/website/src/app/hall/page.tsx:3,160-164 and apps/website/src/app/pricing/page.tsx:5,176-180 — replacing the triggers with a `mailto:` or a real contact route. NO DB migration involved.

**Files.** `apps/website/src/components/sections/AskModal.tsx`, `apps/website/src/app/hall/page.tsx`, `apps/website/src/app/pricing/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: The "Ask in the open" button in apps/website/src/components/sections/AskModal.tsx:79-81 genuinely has no submit path — no type, no onClick, no enclosing <form>, and the question Textarea (:56) is uncontrolled and never read. There is no network call anywhere in apps/website (verified: zero `use server`/`onSubmit`/`fetch(`/`action=` in src). It is reachable from /hall (hall/page.tsx:160, linked in the header nav) and /pricing (pricing/page.tsx:176). This is an UNBUILT spec item, not an intentional mock: the spec at workbench/apps/website/nomba-one-website-plan-01-pages-content.md §12 requires "submissions go to the admin surface," and unlike the Simulator (explicitly waived 
> 
> *…trimmed (1309 more chars — see the cited files).*
> The finding is factually correct but the severity should be medium, not high. It is a dead CTA on a public marketing site — no money, auth, data, or persisted state is involved, and nothing is actually "discarded" (no submission path exists, so nothing is captured or lost). Real impact is a broken-looking pricing-page CTA, a possibly lost pre-sales lead, and a trust hit on a payments product — reachable by every visitor via the header nav, but bounded to marketing damage, and the same page carries a working alternate contact path ("or talk to us →" /trust, pricing/page.tsx:192). Separately, and more serious than the dead button: the Hall's Q&A cards and the modal's prefilled handles are enti
> 
> *…trimmed (92 more chars — see the cited files).*

---

## S11. 🟠 /hall presents 8 fabricated developer questions as "real questions, real code, real answers", plus a placeholder image box

**What we publish**

apps/website/src/app/hall/page.tsx:6-10 asserts authenticity in the page metadata:
```
export const metadata = {
  title: "The Hall",
  description:
    "Every hard question builders have hit on Nomba One, answered in the open by the team — real questions, real code, real answers.",
};
```
Each card is rendered with an avatar, a handle, and a verified checkmark labelled "Nomba One team" (apps/website/src/app/hall/page.tsx:100-140), i.e. it reads unmistakably as user-generated community content.

**What the code does**

The content is a hardcoded array of invented personas — apps/website/src/app/hall/page.tsx:26+ `const CARDS: QA[] = [...]` with handles `@midnight_debugger`, `vibecheck_vic`, `naira_nerd`, `404_bestie`, `prod_goblin`, `kudi_gremlin`, `sudo_sana`. The same fake handles are reused as the seed list in the Ask modal (apps/website/src/components/sections/AskModal.tsx:12-19), confirming they are fixtures, not people. One card also carries `image: "transfer_receipt.png"` (apps/website/src/app/hall/page.tsx), and the renderer at :126-131 draws a grey box containing an icon and the literal filename string rather than an image:
```
        <div className="flex h-[132px] items-center justify-center gap-2 rounded-[8px] border border-border bg-surface-2">
          <ImageIcon className="size-5 text-subtle-foreground" />
          <span className="font-mono text-[12px] text-subtle-foreground">{card.image}</span>
```

**Impact.** LIVE AND VISIBLE: https://nombaone.xyz/hall, linked from the header (apps/website/src/components/chrome/Header.tsx:37) and listed in the sitemap (apps/website/src/app/sitemap.ts:19). The page explicitly claims the questions are real and stamps each with a verified team badge — that is fabricated social proof on a production marketing surface for a payments product. It is exactly the class of content that destroys credibility when a prospect realises the "community" is invented, and it also renders a literal `transfer_receipt.png` placeholder box where an image should be.

**Fix.** Reframe or remove. Minimum honest fix: change apps/website/src/app/hall/page.tsx:8-9 metadata to drop the "real questions" claim, and reframe the card header as an editorial FAQ (remove the per-card `handle`/`initials` avatar chrome at :100-110) so it reads as team-written Q&A, which it is. Also either ship the real asset for `transfer_receipt.png` or delete the `image` field from that card and the renderer branch at :126-131. NO DB migration involved.

**Files.** `apps/website/src/app/hall/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding stands but needs three adjustments.
> 
> MORE SEVERE THAN REPORTED (auditor missed):
> 1. The authenticity claim is NOT confined to metadata. page.tsx:152-153 renders it in the visible masthead: "Every hard question builders have hit on Nomba One, answered in the open. Real questions, real code, real answers. Curated, never careless." A user sees the claim, not just a crawler.
> 2. page.tsx:158 displays a fabricated metric: "1,204 answered, in public" — against 8 hardcoded cards. And AskModal.tsx:79-81 ("Ask in the open") has no onClick and no form action, so the CTA is completely inert; nothing was ever submittable, which is why the count can only be invented.
> 
> OVERSTATED BY THE AUDITOR
> 
> *…trimmed (1062 more chars — see the cited files).*
> The finding is accurate but incomplete — it under-reports. Beyond the 8 fabricated personas, the verified "Nomba One team" badge, and the `transfer_receipt.png` placeholder box, the page also renders a fabricated quantitative metric ("1,204 answered, in public") and the "Ask the Hall" modal is completely non-functional (AskModal.tsx has no onSubmit/form action; the "Ask in the open" button has no handler, so a submitted question is silently discarded), as are the filter pills (non-interactive spans). Additionally, "LIVE AND VISIBLE" is not merely claimed — it is confirmed: https://nombaone.xyz/hall returns HTTP 200 and the served HTML contains `midnight_debugger`, `transfer_receipt.png`, and
> 
> *…trimmed (18 more chars — see the cited files).*

---

## S12. 🟠 Deleting the `example` scaffold in the 'obvious' order breaks apps/checkout and apps/admin at compile time — and the SDK conformance suites fail on a spec that no longer contains it

**What we publish**

Several findings say the example slice is 'a pure surface-area deletion' — remove the router mount, packages/sara/src/example, the EXAMPLE_NOT_FOUND code, the example:* scopes, the queue, and the docs page, then regenerate.

**What the code does**

The slice is load-bearing in two whole apps and in the published SDK test suites. apps/checkout/src/lib/actions.ts:71 references `NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND` and :85 calls `confirmExampleFromWebhook` from an UNAUTHENTICATED server action; apps/checkout/src/app/[reference]/page.tsx and lib/payment.ts consume the example row. apps/admin has an `/examples` page (app/(dashboard)/examples/page.tsx), a nav entry (lib/nav.ts:52), an RBAC entry, lib/reads.ts, and lib/queue/queue-stats.ts:5,27 which imports `exampleQueue`. apps/api/scripts/provision-docs-key.ts:47 grants `example:read`/`example:write`, so narrowing the scope union breaks it. And nombaone-node/test/conformance/openapi-coverage.test.ts:229-232 asserts `EXCLUDED entry no longer exists in spec` — i.e. re-vendoring a spec WITHOUT /v1/examples makes the node (and go/php/ruby/elixir/java) conformance suites FAIL.

**Impact.** A 'delete the scaffold' PR will not typecheck (checkout, admin), and re-vendoring the regenerated spec into the nine SDK repos will red the SDK CI on an assertion that is the mirror image of the one you are trying to satisfy.

**Fix.** Sequence it as four separate, independently-shippable steps. NEVER bundle the table drop.

STEP 1 (zero risk, do now): apps/docs only — delete content/reference/examples.mdx, the manifest.ts:229 row, the quickstart Card (en + l10n/yo + l10n/ha), the webhooks/overview + glossary links, the `["EXAMPLE_", "Example (deletable)"]` family row in error-reference.tsx, and rewrite the Quickstart's first request around POST /v1/customers. Rebuild so llms.txt, llms-full.txt, search-index.json, ask-index.json and public/*.md regenerate — those are GENERATED artifacts; hand-editing apps/docs/public/*.md will be overwritten.

STEP 2 (needs a decision about two apps): apps/checkout is a boilerplate scaffold whose only action posts a ledger transaction with the provider re-verification stubbed out (confirm.ts:64-69 'documented no-op seam') from an unauthenticated page. DELETE apps/checkout entirely, or 

*…trimmed (1618 more chars — see the cited files).*

**Files.** `apps/api/src/apps/main/server/routes.ts`, `apps/checkout/src/lib/actions.ts`, `apps/admin/src/lib/queue/queue-stats.ts`, `apps/admin/src/lib/nav.ts`, `packages/errors/src/codes.ts`, `packages/core-contracts/src/types/api-key.ts`, `apps/api/scripts/provision-docs-key.ts`, `packages/core-db/migrations/0016_rls_mode_isolation.sql`

---

## S13. 🟠 The `example` scaffold leaks into the PUBLIC type surface of all nine published SDKs (EXAMPLE_NOT_FOUND everywhere; example.created/example.settled in Node's WebhookEvent union)

**What we publish**

Every one of the nine SDKs vendors the scaffold error code into its public, IDE-autocompleted error enum, under a comment that says the quiet part out loud:
- nombaone-node/src/error.ts:99-100 `// ---- Example scaffold ----` / `| 'EXAMPLE_NOT_FOUND'`
- nombaone-go/errors.go:114-115 `// Example scaffold.` / `ErrCodeExampleNotFound ErrorCode = "EXAMPLE_NOT_FOUND"`
- nombaone-python/src/nombaone/_constants.py:143-144 `# Example scaffold` / `"EXAMPLE_NOT_FOUND",`
- nombaone-ruby/lib/nombaone/errors.rb:85 `EXAMPLE_NOT_FOUND` (then errors.rb:91 `ALL.each { |code| const_set(code, code) }` → `Nombaone::ErrorCode::EXAMPLE_NOT_FOUND`)
- nombaone-php/src/ErrorCode.php:126-127 `// ---- Example scaffold ----` / `public const EXAMPLE_NOT_FOUND = 'EXAMPLE_NOT_FOUND';`
- nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java:114-115 `// ---- Example scaffold ----` / `public static final String EXAMPLE_NOT_FOUND = ...`
- nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs:193-196 `// ---- Example scaffold ----` / `/// <summary>No example resource exists with that id (reference scaffold).</summa

*…trimmed (611 more chars — see the cited files).*

**What the code does**

This is not just source — it is in the PUBLISHED artifact. nombaone-node/dist/index.d.ts:1896 ships the union as `type WebhookEvent = CustomerCreatedEvent | … | ExampleCreatedEvent | ExampleSettledEvent;` and dist/index.d.ts:2073 ships `type NombaoneErrorCode = … | 'PAYOUT_EXCEEDS_AVAILABLE' | 'EXAMPLE_NOT_FOUND' | 'SYSTEM_INTERNAL_ERROR' | …`. package.json version is 0.1.4. Note the SDKs are internally inconsistent about this: nombaone-ruby/lib/nombaone/webhook_event.rb:12 and nombaone-elixir/lib/nombaone/webhook_event.ex:37 explicitly EXCLUDE the `example.*` events ("scaffold `example.*` events are excluded") while still including EXAMPLE_NOT_FOUND in the error enum — so the exclusion was known to be the right call and was simply not applied consistently.

**Impact.** LIVE AND VISIBLE: this is in packages a developer has already installed. A TypeScript integrator typing `switch (event.type)` gets `'example.created'` and `'example.settled'` offered by autocomplete alongside `'invoice.paid'`. A developer typing `NombaoneErrorCode.` or `nombaone.ErrCode…` sees `EXAMPLE_NOT_FOUND` sitting next to `PAYOUT_EXCEEDS_AVAILABLE`. In .NET the XML doc comment renders in the tooltip as the literal words "reference scaffold". The message a paying integrator receives is that they are holding an unfinished boilerplate — and it is repeated across every language, so it cannot be dismissed as one stale file.

**Fix.** Delete the scaffold block from each error enum: nombaone-node/src/error.ts lines 99-100; nombaone-go/errors.go lines 114-115; nombaone-python/src/nombaone/_constants.py lines 143-144; nombaone-ruby/lib/nombaone/errors.rb line 85; nombaone-php/src/ErrorCode.php lines 126-127; nombaone-java/.../ErrorCode.java lines 114-115; nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs lines 193-196; nombaone-rust/src/error.rs lines 181-182; nombaone-elixir/lib/nombaone/error.ex line 116. And delete nombaone-node/src/webhook-events.ts lines 94-97 plus the two union members at lines 159-160, then remove them from the `export {...}` at src/index.ts:71 and rebuild dist. WHAT BREAKS: nothing at runtime — every SDK's error code type is an OPEN union (node error.ts:105 `| (string & {})`; go/python/ruby tolerate unknown codes), so if the server ever did return EXAMPLE_NOT_FOUND it still parses. This is a pur

*…trimmed (275 more chars — see the cited files).*

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/error.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/webhook-events.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/index.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/errors.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/_constants.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-ruby/lib/nombaone/errors.rb`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/src/ErrorCode.php`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs`, `/Users/mac/Vault/the-60/nombaone/nombaone-rust/src/error.rs`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate except for one detail and one scoping error. (1) WRONG DETAIL: nombaone-node/src/index.ts:71 does not re-export ExampleCreatedEvent/ExampleSettledEvent — neither src/index.ts nor the dist/index.d.ts:2172 export block names them. They leak only structurally, via the exported WebhookEvent union, so `switch (event.type)` autocomplete does offer 'example.created'/'example.settled', but you cannot `import type { ExampleCreatedEvent }`. The impact claim is unaffected. (2) UNDER-SCOPED: this is not an SDK-vendoring mistake — the SDKs faithfully mirror an upstream platform that ships the scaffold publicly. packages/errors/src/codes.ts:212 defines EXAMPLE_NOT_FOUND under the c
> 
> *…trimmed (1021 more chars — see the cited files).*
> The finding is factually correct and if anything under-scoped — the scaffold is not confined to the SDKs. It is also mounted on the production API's unconditional /v1 router (apps/api/src/apps/main/server/routes.ts:48 `v1Router.use(exampleRouter)`) and published on the docs site (apps/docs/content/reference/examples.mdx documents `example.created`). Remediation is therefore three surfaces, not one: purge example.* from all nine SDK public type surfaces AND unmount the example router from /v1 AND delete the docs reference page. But the SEVERITY should be medium, not high: the impact is purely reputational/cosmetic (autocomplete pollution and a "reference scaffold" tooltip), with no functional
> 
> *…trimmed (308 more chars — see the cited files).*

---

## S14. 🟠 The agent-native .md mirrors for the error reference, event catalog and glossary are EMPTY — llms.txt promises "Every error code" and "Every event type" and delivers zero of each

**What we publish**

apps/docs/public/llms.txt:105 — `- [Error reference](https://docs.nombaone.xyz/errors.md): Every error code, what triggers it, and exactly how to fix it.` llms.txt:97 — `- [Event catalog](https://docs.nombaone.xyz/webhooks/event-catalog.md): Every event type, when it fires, and its payload.` llms.txt:91 — `- [Glossary](https://docs.nombaone.xyz/reference/glossary.md): One word, one meaning: the canonical vocabulary.` The errors.md frontmatter repeats the promise: `summary: "Every error code, what it means, and exactly how to fix it, complete and always current, generated from the same registry the API answers with."`

**What the code does**

All three files are hollow. apps/docs/public/errors.md is 1078 bytes and contains ZERO error codes — I grepped it: `grep -c "SUBSCRIPTION_\|INVOICE_\|UNAUTHORIZED\|VALIDATION_FAILED" public/errors.md` → `0`. Its entire data section is one line: `> **Interactive: \`<ErrorReference>\`.** View and run it live at https://docs.nombaone.xyz/errors`. Same for public/reference/glossary.md (599 bytes, 0 terms) and public/webhooks/event-catalog.md (0 catalog entries). Cause: apps/docs/src/lib/md-mirror.ts:23-37 lists `"EventCatalog", "ErrorReference", "Glossary"` in `ISLAND_NAMES` — commented `/** Interactive islands that have no prose equivalent — described in one line. */` — and md-mirror.ts:91-97 replaces any such self-closing tag with `out.push(\`> **Interactive: \\\`<${island[1]}>\\\`.** View and run it live at ${canonical}\`)`. But these three are NOT interactive widgets with no prose equivalent — they are DATA TABLES rendered from static registries (PUBLIC_ERROR_CODES, WEBHOOK_EVENT_CATALOG, glossary.seed.ts) that mirror perfectly into markdown. The same hole exists in public/llms-full.

*…trimmed (27 more chars — see the cited files).*

**Impact.** LIVE AND VISIBLE: https://docs.nombaone.xyz/errors.md, /webhooks/event-catalog.md and /reference/glossary.md are public static files, linked from llms.txt — the file that exists solely so AI coding agents can ingest the docs. An agent (Cursor, Claude Code, Copilot) asked "what does Nomba One's INVOICE_NOT_FOUND mean?" or "list every Nomba One webhook event so I can write a switch" follows llms.txt to errors.md / event-catalog.md, finds nothing, and hallucinates codes and event names — which is exactly the failure mode the agent-native surface was built to prevent. The docs make an explicit completeness guarantee to machines and break it. (The HTML pages are fine; only the machine-readable mi

*…trimmed (17 more chars — see the cited files).*

**Fix.** apps/docs/src/lib/md-mirror.ts — remove `"EventCatalog"`, `"ErrorReference"` and `"Glossary"` from the `ISLAND_NAMES` set (lines 26, 27, 28), and add a data-expander branch before the island check at line 91 that emits real markdown: for `<ErrorReference/>` iterate `PUBLIC_ERROR_CODES` from `@nombaone/errors` and emit `### CODE` + hint + docUrl per code; for `<EventCatalog/>` iterate `WEBHOOK_EVENT_CATALOG` from `@nombaone/core-contracts/types` (filtering `example.*` exactly as src/components/mdx/event-catalog.tsx:87 does) and emit type + `when` + payload fields; for `<Glossary/>` iterate content/glossary.seed.ts. Then rebuild to regenerate public/*.md and llms-full.txt. Nothing breaks — the HTML pages keep using the React components; only the mirror gains content. Keep WebhookVerifier/MoneyUnit/IdempotencyLab/ApiExplorer in ISLAND_NAMES: those genuinely have no prose equivalent.

**Files.** `apps/docs/src/lib/md-mirror.ts`, `apps/docs/public/errors.md`, `apps/docs/public/webhooks/event-catalog.md`, `apps/docs/public/reference/glossary.md`, `apps/docs/public/llms-full.txt`

> **Refuter's correction — re-scopes this finding:**
> The three .md mirrors (public/errors.md, public/reference/glossary.md, public/webhooks/event-catalog.md) are indeed data-free because md-mirror.ts:22-28 wrongly classifies ErrorReference/EventCatalog/Glossary as "interactive islands with no prose equivalent" — that part is confirmed. However, the errors half is NOT a live agent-facing hole: build-agent-native.ts:293-306 emits a full "## Error codes" section into public/llms-full.txt (line 7288) with all 72 PUBLIC_ERROR_CODES and their hints, llms.txt:5 points agents at llms-full.txt as the full corpus, and the docs MCP server exposes a lookup_error tool. The genuinely broken promises are llms.txt:97 ("Every event type") and llms.txt:91 (glos
> 
> *…trimmed (489 more chars — see the cited files).*
> Accurate on facts and cause, but the blast radius is smaller than claimed. The HTML pages are server-rendered from the registries (error-reference.tsx is a pure server component), the API's docUrl points at the HTML not the .md, the .md stub still emits the correct canonical URL an agent can follow, and the docs MCP server (src/app/api/mcp/route.ts) exposes a registry-grounded `lookup_error` tool. So no human integrator is affected and agents degrade to a fetch rather than to nothing. It is a docs-completeness/broken-promise defect on the agent-native surface — medium, not high. Additionally, public/ask-index.json inherited the same gap (0 occurrences of `invoice.paid`), so the Ask-AI index 
> 
> *…trimmed (83 more chars — see the cited files).*

---

## S15. 🟠 The docs ship an empty top-level "Cookbook" section whose only page says "Recipes are on the way"

**What we publish**

apps/docs/content/manifest.ts:176-181 registers Cookbook as a top-level section of the docs IA, rendered in the sidebar rail: `title: "Cookbook", key: "cookbook", … items: [{ slug: "/cookbook", title: "Overview", summary: "Task-focused recipes for common Nomba One billing jobs." }]`. Its frontmatter (apps/docs/content/cookbook.mdx:3) promises: `description: "Short, task-focused recipes for common Nomba One billing jobs, each a complete runnable path from a real problem to working code."`

**What the code does**

apps/docs/content/cookbook.mdx has no recipes. Its entire body is:
```mdx
## Recipes are on the way

We are still writing the first batch. Until they land, two places already cover the ground a recipe would:
…
Have a recipe you want first? Tell us on the [changelog](/changelog) thread, and we will prioritise it.
```
(cookbook.mdx:9-15). It is also mirrored to the agent surface: apps/docs/public/cookbook.md exists.

**Impact.** LIVE AND VISIBLE: "Cookbook" is a permanent entry in the docs sidebar at docs.nombaone.xyz. Every developer browsing the docs sees a section that looks like a body of worked recipes, clicks it, and gets an apology. It is also in the .md mirror, so coding agents fetching docs.nombaone.xyz/cookbook.md ingest "Recipes are on the way" as the platform's answer. An empty section in the nav reads as an abandoned product, and it is worse than having no section at all — the nav made a promise the page could not keep.

**Fix.** Delete the section from the nav until it has content: remove the Cookbook block at apps/docs/content/manifest.ts:175-182. Leave apps/docs/content/cookbook.mdx in the repo (unreferenced, so it stops rendering in the rail) or delete it too along with apps/docs/public/cookbook.md. WHAT BREAKS: apps/docs/scripts/check-links.ts will fail on any surviving in-content link to `/cookbook` — grep for `](/cookbook` before deleting and fix those links (they should point at `/guides/...`). The docs' honesty gates (check-links, check-openapi-honesty) run in the build, so a dangling link will be caught, not silently shipped. No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/manifest.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/cookbook.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/public/cookbook.md`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: apps/docs/content/cookbook.mdx is a stub — its frontmatter promises runnable task-focused recipes but the body is only "## Recipes are on the way" plus links to /guides and /reference. The stub is reachable from the docs header's **Resources dropdown** (apps/docs/src/components/chrome/top-nav.tsx:32), NOT from the docs sidebar rail: the section is `standalone: true` (apps/docs/content/manifest.ts:178) and DOCS_SECTIONS filters standalone sections out of the shared sidebar (manifest.ts:337-342), so it only renders its own single-section sidebar once the reader is already on /cookbook. It is mirrored to the agent surface (apps/docs/public/cookbook.md, advertised in public/llm
> 
> *…trimmed (489 more chars — see the cited files).*
> The finding is true and UNDER-states reach in one respect, but OVER-states severity. Reach correction: Cookbook is not only a sidebar rail entry — it is a primary top-nav header item (apps/docs/src/components/chrome/top-nav.tsx:32), is in the localized route set (src/lib/l10n/config.ts:80) so it ships in every locale, is walked into by the prev/next pager (chrome/pager.tsx), and public/llms.txt:61 advertises it to agents as "Task-focused recipes for common Nomba One billing jobs" — a machine-readable promise of content that does not exist. Severity correction: this is medium, not high. It is a live, public, unauthenticated, universally-seen credibility/polish defect, but it touches no money,
> 
> *…trimmed (401 more chars — see the cited files).*

---

## S16. 🟠 The homepage sells a CLI as a shipped feature; the docs admit it "is not released yet"

**What we publish**

apps/website/src/app/page.tsx:110 (§02 Rails & DX, the second section of the homepage): `deck="The same create-subscription call in your framework, plus a drop-in checkout and a CLI that tails webhooks locally."` and page.tsx:116-118, inside a Callout titled "Drop-in, either way.": "Embed checkout with a script tag, or scaffold your integration and tail webhooks locally with the CLI." Both are stated in the present tense with no caveat. The docs SDK index repeats it under a `## The CLI` heading — apps/docs/content/sdks.mdx:60-65: `<Card title="Command-line tool" href="/sdks/cli">Tail webhooks, scaffold a project, and drive the sandbox from your terminal.</Card>` — again with no "coming soon" marker on the card.

**What the code does**

The CLI does not exist. apps/docs/content/sdks/cli.mdx:11-15 says it plainly:
```mdx
<Callout type="note" title="In development">
  The CLI is not released yet. This page describes what it will do; it will fill
  in with real commands when the tool ships. To build today, reach for one of the
  [SDKs](/sdks) or the raw API.
</Callout>
```
and cli.mdx:17 heads the feature list "## What it will do". There is no CLI repo (`ls /Users/mac/Vault/the-60/nombaone/nombaone-*` returns 9 SDKs + the turbo monorepo, no CLI) and no `nombaone` binary/package anywhere in the workspace.

**Impact.** LIVE AND VISIBLE: on nombaone.xyz's homepage, above the fold of the developer-experience section, and on docs.nombaone.xyz/sdks. A developer evaluating the platform reads "a CLI that tails webhooks locally", picks Nomba One partly for that, then discovers on the /sdks/cli page that it does not exist. The docs page itself is honest — the failure is that the two surfaces that SELL it are not, so the developer only learns the truth after committing attention.

**Fix.** apps/website/src/app/page.tsx:110 — change the deck to `"The same create-subscription call in your framework, plus a drop-in checkout."` and delete the Callout at page.tsx:115-120 (or rewrite it to drop the CLI clause). apps/docs/content/sdks.mdx:59-65 — either delete the `## The CLI` CardGroup entirely, or retitle the card to `"Command-line tool (in development)"` so the coming-soon state is visible BEFORE the click. Nothing breaks; /sdks/cli.mdx can stay as an honest roadmap page (it is already correctly caveated).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/website/src/app/page.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but incomplete. The accurate version: the CLI does not exist (9 SDK repos, no CLI repo, no `nombaone` binary/package), yet it is sold as shipped on FIVE surfaces, not two:
> 
> 1. apps/website/src/app/page.tsx:110 — §02 deck: "…plus a drop-in checkout and a CLI that tails webhooks locally." (as cited)
> 2. apps/website/src/app/page.tsx:116-118 — Callout "Drop-in, either way.": "…tail webhooks locally with the CLI." (as cited)
> 3. MISSED, and the most damaging: apps/website/src/components/sections/CodeStack.tsx:462-476 — the homepage code-tab strip includes a "CLI" tab sitting as an equal peer to the nine real SDK tabs, showing a copy-pasteable-looking command: `nombaone subsc
> 
> *…trimmed (1328 more chars — see the cited files).*
> The finding is factually right and reachable, and it actually UNDER-counts the surfaces: a third present-tense claim lives in the docs nav at apps/docs/content/manifest.ts:157 ("The nombaone command-line tool: tail webhooks and scaffold locally."), which is notable because that manifest already has a "coming soon" mechanism it declines to use here. The severity, however, should be medium rather than high: the impact is confined to pre-integration evaluation trust, with no money, auth, data, or runtime-correctness exposure, and the honest "not released yet" disclosure is one click away on the very page both surfaces link to — so no integrator can actually build against the phantom feature. Re
> 
> *…trimmed (139 more chars — see the cited files).*

---

## S17. 🟠 The live site advertises `checkout.nombaone.xyz` as the dunning action-link host; the API actually mints a Nomba-hosted link and no such host exists

**What we publish**

Two live pages show integrators the shape of the `invoice.action_required` payload with a nombaone-branded checkout host.
apps/website/src/components/sections/SimulatorStage.tsx:22 (homepage):
```
    line: '{"event":"invoice.action_required","link":"checkout.nombaone.xyz/…"}',
```
apps/website/src/app/hall/page.tsx:32:
```
    code: ['{ "event": "invoice.action_required",', '  "link": "checkout.nombaone.xyz/…" }'],
```

**What the code does**

The API mints that link from NOMBA's hosted-checkout API, not from any nombaone host. apps/api/src/shared/services/billing/actionLink.ts:56-74:
```
  const res = await client.request<{ data?: { checkoutLink?: string; checkoutUrl?: string } }>({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    ...
  const link = String(data.checkoutLink ?? data.checkoutUrl ?? '');
  return link || null;
```
and that value is what goes on the wire — apps/api/src/shared/services/billing/collectForInvoice.ts:178-182:
```
  await emitEvent(txDb, {
    ...ctx,
    type: 'invoice.action_required',
    payload: { reference: invoice.reference, reason: 'otp_required', checkoutLink },
  });
```
Separately, `checkout.nombaone.xyz` has no deploy config anywhere in the repo (only apps/api has a Dockerfile + .do/app.yaml + workflow) and is not one of the canonical hosts.

**Impact.** LIVE AND VISIBLE: on https://nombaone.xyz and https://nombaone.xyz/hall. An integrator building the OTP/3DS recovery flow — the product's headline Nigeria-specific feature — reads the payload from the marketing site and hardcodes a `checkout.nombaone.xyz` host check, or allowlists that domain in their CSP/redirect allowlist, or tells their support team to expect that domain. The real `checkoutLink` is a Nomba domain, so their host check rejects every genuine action-required link and customers can never complete an OTP recovery. This also advertises a subdomain that does not resolve.

**Fix.** In apps/website/src/components/sections/SimulatorStage.tsx:22 and apps/website/src/app/hall/page.tsx:32, change the illustrated link to a neutral placeholder that does not imply a nombaone-owned checkout host — e.g. `"link":"<nomba hosted checkout url>"`. Also correct the /hall answer text at apps/website/src/app/hall/page.tsx which says "Dunning emits invoice.action_required with a one-tap checkout link" — that part is true; only the host in the code block is wrong. NO DB migration involved.

**Files.** `apps/website/src/components/sections/SimulatorStage.tsx`, `apps/website/src/app/hall/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: "Two decorative marketing surfaces illustrate the invoice.action_required payload with an ellipsized nombaone-branded checkout placeholder (`checkout.nombaone.xyz/…`), but the API currently emits Nomba's raw hosted-checkout URL, and apps/checkout — the app that would own that host — is still the untouched boilerplate scaffold."
> 
> Corrections to the original finding:
> - DROP "no such host exists / not a canonical host". checkout.nombaone.xyz is a first-class documented host: apps/checkout exists (port 8040, README.md:41) and workbench/PRODUCT-OVERVIEW.md:109 specifies it as the subscriber surface that wraps Nomba's hosted checkout by redirect/iframe. The marketing depiction is
> 
> *…trimmed (1495 more chars — see the cited files).*
> The two strings are real, live, and wrong, and the fix (drop the fake host from the example payloads in apps/website/src/components/sections/SimulatorStage.tsx:22 and apps/website/src/app/hall/page.tsx:32) is worth making. But this is a marketing-copy accuracy defect, not an integration break: no doc, guide, or SDK example anywhere instructs integrators to host-check or allowlist the checkoutLink — all SDK pages and both webhook guides say to forward `event.data.checkoutLink` verbatim. The "integrator hardcodes a host check and OTP recovery breaks for every customer" scenario has no supporting documented path; it is invented harm layered on a true fact. Severity is low (public inaccuracy / b
> 
> *…trimmed (57 more chars — see the cited files).*

---

## S18. 🟠 The live site advertises webhook event `dunning.retry_scheduled`, which does not exist in the event catalog and is never emitted

**What we publish**

apps/website/src/components/sections/SimulatorStage.tsx:20 (rendered on the homepage at apps/website/src/app/page.tsx:270):
```
  { line: '{"event":"dunning.retry_scheduled","at":"payday+1"}', tone: "text-warning" },
```
and apps/website/src/app/product/page.tsx:82:
```
    { dot: "bg-warning", text: "text-warning", label: "retry_scheduled · payday+1" },
```

**What the code does**

The authoritative catalog in packages/core-contracts/src/types/webhook-events.ts contains no `dunning.*` event of any kind. The full set of emitted types is: coupon.created, customer.created, customer.updated, discount.created, discount.removed, example.created, example.settled, invoice.action_required, invoice.created, invoice.finalized, invoice.paid, invoice.payment_failed, invoice.payment_partially_collected, invoice.payment_recovered, invoice.voided, payment_method.attached, payment_method.expiring, payment_method.updated, plan.archived, plan.created, plan.updated, price.created, price.deactivated, settlement.created, settlement.payout_created, settlement.refunded, subscription.* . A repo-wide grep for `retry_scheduled` hits ONLY the two website files above — it appears nowhere in apps/api or packages/.

**Impact.** LIVE AND VISIBLE: shown on https://nombaone.xyz (homepage simulator) and https://nombaone.xyz/product. Dunning retry visibility is one of the product's headline claims, so an integrator evaluating the product will specifically look for this event. They subscribe their webhook endpoint to `dunning.retry_scheduled`, build a retry-notification flow on it, and it NEVER fires — and `GET /v1/events/catalog` will not even list it, so they will assume their subscription is misconfigured and burn hours debugging.

**Fix.** In apps/website/src/components/sections/SimulatorStage.tsx:20, replace the fabricated event with a real one from the catalog — the truthful representation of a scheduled retry is the failure event that precedes it, e.g. `{ line: '{"event":"invoice.payment_failed","next_retry":"payday+1"}', tone: "text-warning" }`. Correspondingly fix apps/website/src/app/product/page.tsx:82. Do not invent the event in the catalog to match the marketing copy unless you actually intend to emit it.

**Files.** `apps/website/src/components/sections/SimulatorStage.tsx`, `apps/website/src/app/product/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the marketing site (homepage simulator + /product dunning timeline) depicts a webhook event `dunning.retry_scheduled` that does not exist in the frozen catalog (packages/core-contracts/src/types/webhook-events.ts) and is never emitted. It appears ONLY in apps/website/src/components/sections/SimulatorStage.tsx:20 and apps/website/src/app/product/page.tsx:82 — the real API contract surfaces (docs event catalog, OpenAPI, GET /v1/events filters, SDK types, console) are all correct, so this is marketing-copy drift rather than a broken API contract. Two aggravating details the auditor omitted: (a) the homepage deck at apps/website/src/app/page.tsx:268 explicitly claims "the webho
> 
> *…trimmed (924 more chars — see the cited files).*
> The finding is factually correct (retry_scheduled appears ONLY in the two website files, plus the .pen design source and workbench plans; absent from apps/api, packages/, and apps/docs) and it IS live and publicly visible — but "high" overstates it. Accurate framing: a false public claim in MARKETING COPY ONLY about one invented event name. The underlying dunning capability is real and IS observable through shipped events (invoice.payment_failed / invoice.action_required / invoice.payment_recovered), which appear in the same simulator strip. The surfaces an integrator actually builds against (apps/docs event catalog, SDKs, GET /v1/events/catalog) are all correct and never mention dunning.ret
> 
> *…trimmed (765 more chars — see the cited files).*

---

## S19. 🟡 "Google sign-in is coming soon" on the console login and signup screens — the first two screens a new merchant sees

**What we publish**

apps/console/src/components/auth/signup-form.tsx:100-108 and apps/console/src/components/auth/login-form.tsx:122-130 both render:
```
      <button
        type="button"
        disabled
        title="Google sign-in is coming soon"
        ...
        Continue with Google
      </button>
```

**What the code does**

The button is `disabled` and there is no Google OAuth provider anywhere in apps/console/src/lib/auth — the only auth paths are the credential form and the invite flow. The "coming soon" is in a `title` tooltip, so the visible affordance is just a greyed-out "Continue with Google" that does nothing on click; the explanation only appears on hover (and never on touch devices).

**Impact.** LIVE AND VISIBLE: https://console.nombaone.xyz login and signup — the very first screens a new merchant sees, and the destination of the website's primary CTA ("Get an API key", apps/website/src/app/page.tsx:492 → https://console.nombaone.xyz). A prominent, greyed-out social-login button on the signup screen of a live payments product reads as an unfinished build. On mobile there is no tooltip, so the user just taps a dead button.

**Fix.** Remove the button and its "or" divider from both files: apps/console/src/components/auth/signup-form.tsx:93-108 and apps/console/src/components/auth/login-form.tsx:115-130. Re-add when Google OAuth actually lands. Nothing else references these blocks. NO DB migration involved.

**Files.** `apps/console/src/components/auth/signup-form.tsx`, `apps/console/src/components/auth/login-form.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually accurate — quotes verified verbatim at the cited lines, no env gate/flag/OAuth provider anywhere in apps/console/src, and both forms are the entirety of the live /login and /signup pages — but it is (a) slightly overstated in severity and (b) missing the design-source context that changes the correct fix. Accurate version: the disabled "Continue with Google" button ships on both live auth screens with no OAuth implementation behind it; it is a cosmetic/trust and design-fidelity defect, not a functional one (credential login/signup and the TOTP step all work; a disabled button fires no click, so there is no error state, only a dead affordance that on touch devices has
> 
> *…trimmed (752 more chars — see the cited files).*
> Reachability holds exactly as stated (public unauth routes, destination of the website's primary CTA, no env/flag gate). Severity should be LOW, not medium: this is a credibility/polish defect, not a functional or security one. Signup/login work fine via the credential form; the button carries `disabled` + `disabled:opacity-60`, so it reads as unavailable even without the tooltip, and a disabled button on touch is inert rather than a trap that leads to an error. Fix = delete the button from both forms (or replace it with visible "Google sign-in coming soon" text) — a pre-launch tidy-up, not a blocker.

---

## S20. 🟡 /sdks lists a "Command-line tool" card beside the nine real SDKs with no not-shipped signal — the CLI does not exist anywhere in the monorepo

**What we publish**

apps/docs/content/sdks.mdx:59-65 renders a section `## The CLI` immediately after the nine real SDK cards: `<Card title="Command-line tool" href="/sdks/cli">Tail webhooks, scaffold a project, and drive the sandbox from your terminal.</Card>` — present-tense, no badge, no disclaimer. apps/docs/content/manifest.ts:157 puts it in the permanent sidebar with no badge: `{ slug: "/sdks/cli", title: "CLI", summary: "The nombaone command-line tool: tail webhooks and scaffold locally." }`.

**What the code does**

There is no CLI. `ls packages/` returns only core-contracts, core-db, docs-db, errors, queue, sara, ui, utils, and a repo-wide `find -iname "*cli*"` outside node_modules finds nothing. The destination page admits it — apps/docs/content/sdks/cli.mdx:10-14: `<Callout type="note" title="In development">The CLI is not released yet. This page describes what it will do; it will fill in with real commands when the tool ships.</Callout>` — and its body is entirely future tense ("## What it will do", "will let you", "Scaffold locally.").

**Impact.** LIVE AND VISIBLE: https://docs.nombaone.xyz/sdks, no auth. A developer scanning the SDK page sees ten shipped-looking tools and clicks the CLI card expecting an install command; only after the click do they learn it is vapourware. The page is also in sitemap.xml and therefore Google-indexed as "Command-line interface - Nomba One Docs", and its meta description ("tail webhooks, scaffold a project…") reads as a shipped product in search results. It is honestly labelled ON the page, so this is not deception — but it is a roadmap placeholder occupying a permanent nav slot on a live docs site, which is the credibility problem the owner described.

**Fix.** Cheapest honest fix, no deletion: apps/docs/content/manifest.ts:157 — add a badge so the sidebar says so, `badge: "beta"` is wrong (it isn't beta); instead delete the manifest entry and the sdks.mdx `## The CLI` section (content/sdks.mdx:59-65) and `rm apps/docs/content/sdks/cli.mdx`, then rebuild — the page leaves the sidebar, the sitemap and llms.txt automatically. If the CLI is genuinely weeks away and you want to keep the announcement, instead retitle the card to `<Card title="Command-line tool — coming soon" …>` and add `badge` support so the sidebar renders a "soon" pill; either way it must not read as shipped from /sdks. Nothing depends on the page: `grep -rn "/sdks/cli" content/ src/` finds only sdks.mdx and manifest.ts. Note src/lib/sdks/registry.ts (the SSOT the check:sdks gate enforces) correctly does NOT list the CLI, so removing it creates no gate failure.

**Files.** `apps/docs/content/manifest.ts`, `apps/docs/content/sdks.mdx`, `apps/docs/content/sdks/cli.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct on its central claim — sdks.mdx:59-65 and manifest.ts:157 do present a nonexistent CLI with no not-shipped signal, and no CLI exists anywhere in the repo (registry.ts has exactly 9 SDKs; no package.json has a `bin` field) — but two details need fixing and one is missing.
> 
> WRONG: The SEO impact claim. generateMetadata (apps/docs/src/app/(en)/[[...slug]]/page.tsx:56) sources the meta description from page frontmatter, and cli.mdx:3 already contains the hedge: "The nombaone CLI — tail webhooks, scaffold a project, and drive the sandbox from your terminal. In development; use an SDK or the raw API in the meantime." The indexed meta description does NOT "read as a
> 
> *…trimmed (1235 more chars — see the cited files).*
> Accurate on the facts, overstated on impact. Two corrections: (1) the SEO claim is wrong — the frontmatter `description` in apps/docs/content/sdks/cli.mdx is "The nombaone CLI — tail webhooks, scaffold a project, and drive the sandbox from your terminal. In development; use an SDK or the raw API in the meantime.", so the meta description a searcher sees already carries the not-shipped signal; it does not "read as a shipped product in search results." (2) The real defect is narrow: the /sdks index card (sdks.mdx:59-65) and the manifest sidebar entry (manifest.ts:157) are the only two surfaces missing the signal the destination page carries. Severity is low, not medium — a roadmap page that se
> 
> *…trimmed (203 more chars — see the cited files).*

---

## S21. 🟡 Console ships a `?state=` design-preview backdoor that fakes zero/filtered/error screens over real subscription data

**What we publish**

apps/console/src/app/(app)/subscriptions/page.tsx:82-84 documents it as a design affordance:
```
// Empty/error states are reachable in production when the fetched dataset (or a
// filtered segment) is empty, or a fetch throws (see loading.tsx / error.tsx).
// `?state=` is a design-preview switch for those same components.
type ListState = 'loading' | 'zero' | 'filtered' | 'error';
```

**What the code does**

The query param OVERRIDES the truthful derived state — apps/console/src/app/(app)/subscriptions/page.tsx:94 and :106-108:
```
  const preview = sp.state as ListState | undefined;
  ...
  // `?state=` overrides for design preview.
  const state: ListState | undefined =
    preview ?? (metrics.total === 0 ? 'zero' : rows.length === 0 ? 'filtered' : undefined);
```
and `state` gates the entire table render at :357 (`{state === 'zero' ? ...`), :373 (`: state === 'filtered' ?`), :389 (`: state === 'error' ?`) and :290 (`{state === 'loading' ?`). There is no environment or mode gate on `preview` — it is honoured in production, in live mode, for any signed-in user.

**Impact.** LIVE AND VISIBLE: any authenticated merchant on https://console.nombaone.xyz/subscriptions?state=error is shown a fabricated error screen while their real subscriptions load fine; `?state=zero` renders the "no subscriptions yet" empty state while hiding a real book of revenue. A merchant who lands on such a URL (bookmarked, shared, or copied from a screenshot) will believe their subscription data has been lost, and will open a P1 support ticket about a payments product losing their book. It is a dev affordance with no business being in a production bundle.

**Fix.** Delete the override. In apps/console/src/app/(app)/subscriptions/page.tsx: remove `state?: string` from the searchParams type (:89), delete line 94 (`const preview = ...`), and change :107-108 to derive state honestly only: `const state: ListState | undefined = metrics.total === 0 ? 'zero' : rows.length === 0 ? 'filtered' : undefined;`. The zero/filtered/error components themselves must STAY — they are load-bearing, reached via genuinely empty datasets and via error.tsx/loading.tsx. NO DB migration involved.

**Files.** `apps/console/src/app/(app)/subscriptions/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> The mechanism is confirmed exactly as reported: `?state=` at page.tsx:94 overrides the truthful derived state at :107-108 (nullish coalescing puts `preview` first) and gates the render at :290/:357/:373/:389, with no env, mode, or role guard anywhere (apps/console has no middleware.ts; the sole NODE_ENV use is the session cookie `secure` flag). Two corrections to the impact: (1) It does NOT hide a real book of revenue. For `zero`/`filtered`/`error` only the table is replaced — the command bar (:295-335) still renders the true MRR, true book-health bars, and a literal "{metrics.total} subscriptions" count, so the page visibly contradicts itself rather than presenting a clean "your data is gon
> 
> *…trimmed (1231 more chars — see the cited files).*
> The `?state=` override is genuinely ungated and does ship to production — that part stands. What is wrong: (a) it does NOT hide a real book of revenue — `state` gates only the table/card list, while the command bar (desktop 295-335, mobile 155-182) and the segment tabs keep rendering the REAL MRR, real total subscription count, and real per-segment counts, so ?state=zero produces a visibly self-contradictory screen ("₦X MRR · N subscriptions" above "No subscriptions yet") that reads as a glitch, not data loss; (b) nothing in the console ever emits a ?state= link (grep: the param appears only in these 5 lines), so no merchant reaches it by using the product or following the docs — it requires
> 
> *…trimmed (233 more chars — see the cited files).*

---

## S22. 🟡 Deleting the website's [slug] catch-all without first fixing the homepage's own deep links turns two homepage CTAs into 404s

**What we publish**

The finding says: delete apps/website/src/app/use-cases/[slug]/page.tsx (or notFound() it) so /use-cases/saas|gyms|lending|platforms stop rendering 'we're working on it.'

**What the code does**

apps/website/src/app/page.tsx:331 ('See the platform use case →') and page.tsx:480 both deep-link `/use-cases/platforms` directly from the HOMEPAGE. apps/website/src/components/chrome/Footer.tsx:36-40 already routes the four unbuilt segments to the /use-cases index — the workaround exists in-repo but was not applied to the homepage or the index cards.

**Impact.** notFound()-ing the catch-all first converts a bad page into a hard 404 reachable in ONE click from nombaone.xyz. Removing the index-card hrefs first, but leaving the catch-all, leaves the homepage links live and still landing on the stub.

**Fix.** Order: (1) fix the two homepage links (page.tsx:331, :480) and the four index cards (use-cases/page.tsx:18,30,36,42) to point at /use-cases (mirroring Footer.tsx's existing pattern); (2) THEN notFound() or delete the [slug] catch-all. Grep for any remaining `/use-cases/(saas|gyms|lending|platforms)` before you delete. Same discipline applies to the other website stub deletions: the /hall AskModal is mounted on /pricing too (pricing/page.tsx:176), so deleting AskModal without touching /pricing breaks the pricing build; and the Cookbook/CLI docs deletions must remove the manifest.ts entry, the top-nav entry (apps/docs/src/components/chrome/top-nav.tsx), the l10n route set (src/lib/l10n/config.ts), AND the inbound links, or apps/docs/scripts/check-links.ts fails the build.

**Files.** `apps/website/src/app/page.tsx`, `apps/website/src/app/use-cases/page.tsx`, `apps/website/src/app/use-cases/[slug]/page.tsx`, `apps/website/src/app/pricing/page.tsx`, `apps/docs/content/manifest.ts`

---

## S23. 🟡 EXAMPLE_NOT_FOUND ships in the public error-code enum, the committed OpenAPI ApiError schema, and every SDK's generated error type

**What we publish**

packages/errors/src/codes.ts:211-212 declares it under a comment that admits what it is — `// ---- The deletable example slice (delete with the example) ----` / `EXAMPLE_NOT_FOUND: 'EXAMPLE_NOT_FOUND',` — and :850-853 gives it a full public-facing metadata entry with a live docs URL: `EXAMPLE_NOT_FOUND: { hint: 'No example resource exists with that id in this environment. Check the id, and that your key matches the environment it was created in.', docUrl: \`${DOCS_ERRORS_BASE}#EXAMPLE_NOT_FOUND\` }`.

**What the code does**

It is not confined to the repo — it reaches the wire contract. I parsed the committed apps/docs/src/generated/openapi.json and `EXAMPLE_NOT_FOUND` is present inside the `components.schemas.ApiError` error-code enum. That enum is built from PUBLIC_ERROR_CODES at apps/api/src/shared/openapi/build.ts:12 (`const PUBLIC_ERROR_CODES_LIST = [...PUBLIC_ERROR_CODES];`) and attached as the `default` error response to every one of the 83 operations (build.ts:139-142). Any SDK or client generated from this spec therefore emits `EXAMPLE_NOT_FOUND` as a legitimate member of the Nomba One error union.

**Impact.** LIVE AND VISIBLE: a developer reading the API reference, generating a client from /v1/openapi.json, or exhaustively switching on the error union in a typed SDK sees a first-class error code called EXAMPLE_NOT_FOUND whose hint talks about "example resource" — and whose docUrl points at a real page, https://docs.nombaone.xyz/errors#EXAMPLE_NOT_FOUND. In a language with exhaustive matching (Rust, or TypeScript with a strict switch) they are forced to write a branch handling an error the product can never legitimately return to them, since no merchant key holds example:read. This is scaffold vocabulary embedded in the permanent public error contract. (Distinct from the already-known "Example (de

*…trimmed (134 more chars — see the cited files).*

**Fix.** packages/errors/src/codes.ts — delete lines 211-212 (the enum member and its section comment) and lines 850-853 (the metadata entry and its section comment). Then re-run `pnpm --filter @nombaone/api gen:openapi` and re-commit apps/docs/src/generated/openapi.json so the ApiError enum drops the code, and regenerate the SDK error types. What breaks: packages/sara/src/example/confirm.ts references NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND, so this must land together with the example-slice deletion (finding 1) or the build fails — which is the desired coupling, not a blocker. No database or migration involvement.

**Files.** `packages/errors/src/codes.ts`, `apps/docs/src/generated/openapi.json`, `apps/api/src/shared/openapi/build.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct, but two details need fixing — and both make the exposure LARGER, not smaller:
> 
> 1. The auditor's premise "no merchant key holds example:read" is wrong. `example:read` and `example:write` are first-class grantable scopes in the public validated scope enum (packages/core-contracts/src/validations/api-key.ts:26-27, packages/core-contracts/src/types/api-key.ts:27-28), and apps/api/src/apps/main/server/routes.ts:48 mounts `v1Router.use(exampleRouter)` with no environment gate. So EXAMPLE_NOT_FOUND is not merely an unreachable enum member — it is an error the API can actually return.
> 
> 2. The leak is not limited to the error code. The committed apps/docs/src/generated/openapi
> 
> *…trimmed (667 more chars — see the cited files).*
> The finding is right that EXAMPLE_NOT_FOUND ships in the public error enum, the committed OpenAPI ApiError schema, and every generated SDK. But its stated harm is backwards, and it understates the blast radius.
> 
> WRONG: "no merchant key holds example:read" / "an error the product can never legitimately return to them" / "forced to write a branch handling an impossible error." The code is readily returnable. provision-docs-key.ts:47 mints the docs sandbox key (INFRA_DEMO_SANDBOX_KEY) with ALL_SCOPES including 'example:read' and 'example:write', and both are valid members of the public createApiKeyBody zod enum (core-contracts/src/validations/api-key.ts:26-27). GET /v1/examples/{bad-id} returns
> 
> *…trimmed (1530 more chars — see the cited files).*

---

## S24. 🟡 Footer links to status.nombaone.xyz (not a canonical host) while /trust claims "The status page publishes real uptime"

**What we publish**

apps/website/src/components/chrome/Footer.tsx:6 and :30:
```
const STATUS_URL = "https://status.nombaone.xyz";
...
      { label: "Status", href: STATUS_URL, arrow: true, external: true },
```
and apps/website/src/app/trust/page.tsx:50-51:
```
    "What is your uptime posture?",
    "The status page publishes real uptime. Incidents are posted openly, with a plainly-worded postmortem.",
```

**What the code does**

`status.nombaone.xyz` is not one of the five canonical hosts (nombaone.xyz, api., sandbox.api., console., docs.) and there is no status-page app, config, or deploy artifact anywhere in the repo. I could not resolve DNS from this environment, so I cannot prove the host is dead — this is why I am marking confidence medium. What I can prove is that nothing in this repo builds or deploys it.

**Impact.** LIVE AND VISIBLE: the "Status" link sits in the Developers column of the footer on EVERY page of https://nombaone.xyz, and /trust makes an explicit promise that a real uptime page exists. If the host does not resolve, every visitor who clicks Status during an incident — precisely when they will click it — gets a DNS error from their payments provider. Combined with the hardcoded "All systems operational" pill on the homepage, the product's entire availability story is unbacked.

**Fix.** Confirm whether status.nombaone.xyz resolves. If it does not: either stand the page up, or remove the link at apps/website/src/components/chrome/Footer.tsx:30 and soften the claim at apps/website/src/app/trust/page.tsx:51 to describe the incident-communication process without asserting a live status page exists. NO DB migration involved.

**Files.** `apps/website/src/components/chrome/Footer.tsx`, `apps/website/src/app/trust/page.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but its supporting argument should be restated, and its scope is actually LARGER than reported.
> 
> ACCURATE VERSION: `https://status.nombaone.xyz` returns NXDOMAIN (verified by direct DNS lookup, with a control query proving no wildcard record exists), while nombaone.xyz, api., sandbox.api., console., and docs. all resolve. It is therefore a provably dead link, and it is hardcoded with no env gate or guard in TWO places, not one:
>   - apps/website/src/components/chrome/Footer.tsx:6 and :30 (Developers column, desktop footer, every website page — the mobile footer at :119-144 omits it)
>   - apps/docs/src/components/chrome/topbar.tsx:23 ("API status" in the docs topbar, ever
> 
> *…trimmed (1334 more chars — see the cited files).*
> The finding is right but under-scoped, and its one uncertainty is now resolved. (1) DNS is provable: `dig +short status.nombaone.xyz` returns EMPTY while `nombaone.xyz`/`docs.nombaone.xyz` resolve to Cloudflare — the host is dead, so the "confidence medium / cannot prove" hedge should be dropped to confirmed. (2) The blast radius is larger than claimed: the same dead host is ALSO hardcoded at `apps/docs/src/components/chrome/topbar.tsx:23` as the "API status" topbar quick-link, putting it on every docs page, not just the website footer. (3) The unbacked "All systems operational" claim appears twice, not once: `apps/website/src/app/page.tsx:439` AND `apps/website/src/components/chrome/Footer.
> 
> *…trimmed (168 more chars — see the cited files).*

---

## S25. 🟡 Internal "Build summary" agent-handoff docs are committed to six PUBLIC SDK repos — and one of them repeats the false webhook-scheme claim as verified fact

**What we publish**

SUMMARY.md exists at the root of six public GitHub repos: nombaone-dotnet, nombaone-elixir, nombaone-go, nombaone-java, nombaone-php, nombaone-rust (all on github.com/nombaone/*). It is an internal work report, not a user document — nombaone-go/SUMMARY.md:1 `# Build summary — nombaone-go v0.1.0`, with sections `## What shipped` (:6) and `## Verification performed` (:19).

**What the code does**

Worse than being merely internal, it launders the known-wrong webhook scheme into a verified-sounding claim. nombaone-go/SUMMARY.md:16-17: "Webhook helper implementing the **documented** `t=<unix>,v1=<hex>` scheme; golden vector passes **byte-for-byte**." — and SUMMARY.md:23 "**Webhook golden vector + full rejection matrix** pass." The golden vector passes because the SDK is tested against the SDK's own (Stripe-style) scheme, not against the server: the server sends a BARE HEX digest in `x-nombaone-signature` keyed on sha256(plaintext secret) (packages/sara/src/webhooks/sign.ts + deliver.ts:113). So the repo's most confident-sounding verification artifact certifies exactly the thing that is broken.

**Impact.** LIVE AND VISIBLE: SUMMARY.md renders on the GitHub repo file list of six public SDK repos, one click from the README that integrators actually land on. A prospective integrator (or a competitor, or a partner doing diligence) reads a document that is transparently an AI/agent build report — "What shipped", "Verification performed", operation counts — which signals the SDK was generated and self-graded rather than engineered. And the "byte-for-byte" webhook claim in it will be read as an assurance, then falsified the first time a real delivery arrives.

**Fix.** Delete SUMMARY.md from all six repos (git rm SUMMARY.md in nombaone-{dotnet,elixir,go,java,php,rust}). Nothing links to it — it is not referenced from any README, mix.exs docs `extras`, or .csproj packaging. If the content is wanted, move it to an internal doc outside the published repos. NOTE: do not simply correct the webhook sentence — the underlying SDK/docs webhook scheme is wrong in all nine SDKs (already established) and must be fixed in code; deleting SUMMARY.md just stops the false claim from being published while that fix lands. No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-go/SUMMARY.md`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/SUMMARY.md`, `/Users/mac/Vault/the-60/nombaone/nombaone-elixir/SUMMARY.md`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/SUMMARY.md`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/SUMMARY.md`, `/Users/mac/Vault/the-60/nombaone/nombaone-rust/SUMMARY.md`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: SUMMARY.md — an internal, operator-addressed agent build report — is committed and pushed to the root of six PUBLIC repos (nombaone/{dotnet,elixir,go,java,php,rust}; GitHub API confirms private=false; present in origin/main tree). Correct line refs for nombaone-go/SUMMARY.md: title :1, "## What shipped" :6, "## Verification performed" :20, webhook claim :17-18, golden-vector bullet :25. ALL SIX (not one) assert the webhook golden vector "passes byte-for-byte" (dotnet:20-21, elixir:14, go:17-18, java:24, php:16, rust:13), and that vector is self-signed — webhook_test.go:16 hardcodes goldenHeader in the SDK's own t=/v1= scheme, while the server actually sends a bare hex diges
> 
> *…trimmed (918 more chars — see the cited files).*
> Accurate in substance, with two refinements. (1) The SUMMARY is zero clicks from the repo landing page, not "one click from the README" — root-level .md files render directly in GitHub's file list. (2) "One of them repeats the false webhook-scheme claim as verified fact" understates the split: go/dotnet/java/php present the `t=,v1=` scheme as byte-for-byte verified, while nombaone-rust/SUMMARY.md:58-62 and nombaone-elixir/SUMMARY.md:64-68 openly DISCLOSE that the deployed backend emits the legacy bare-hex HMAC keyed on sha256(secret) and that "a real delivery would fail verification" — i.e. two public repos advertise that their own webhook helper is broken against production. The files also 
> 
> *…trimmed (454 more chars — see the cited files).*

---

## S26. 🟡 The Prometheus /metrics endpoint is served unauthenticated on the public API host and leaks the route inventory plus business volume counters

**What we publish**

apps/api/src/apps/main/server/index.ts:53-55 states the intent plainly: `// Process-scoped metrics exposition — outside /v1, no auth, no platformGate` / `// (it is telemetry about THIS process, never tenant data).` / `app.get('/metrics', metricsHandler);`

**What the code does**

The handler is a bare dump with no auth check of any kind — apps/api/src/shared/observability/prometheus.ts:126-129: `export const metricsHandler: RequestHandler = async (_req, res) => { res.setHeader('Content-Type', registry.contentType); res.end(await registry.metrics()); };`. Because it is registered on the same Express app that serves /v1 and BEFORE any auth, and apps/api/cloudflared.config.yml forwards every path to the origin with no path allowlist (`ingress: - hostname: tunnel.nombaone.xyz / service: http://localhost:8000` then a catch-all 404), the path is publicly reachable. The registry is not empty of business data: prometheus.ts:28-31 `http_request_duration_seconds` with `labelNames: ['method', 'route', 'status']`, :37-40 `nombaone_charge_failures_total` ("Count of billing charge attempts that failed (invoice went past_due)") with `labelNames: ['reason']`, and :51-54 `nombaone_reconcile_discrepancies_total` with `labelNames: ['class']`.

**Impact.** LIVE AND VISIBLE: an unauthenticated `curl https://<api-host>/metrics` returns the full Prometheus exposition. The comment's claim that it is "never tenant data" is true in the narrow sense (I checked every metric — there are NO organization/tenant labels, so no cross-tenant leak), but it is not merely process telemetry either: the `route` label enumerates the entire live route inventory (including /v1/examples and /v1/sandbox/*, reinforcing finding 1) with per-route request volumes, and `nombaone_charge_failures_total{reason=...}` publishes failed-charge volume by reason — commercially sensitive operating data any competitor or journalist can scrape on a timer. Confidence is medium, not hig

*…trimmed (323 more chars — see the cited files).*

**Fix.** Do not rely on the edge. Bind the exposition to a private listener or gate it in-process. Minimal in-repo fix at apps/api/src/apps/main/server/index.ts:55 — replace `app.get('/metrics', metricsHandler);` with a bearer-token guard, e.g. `app.get('/metrics', (req, res, next) => { const t = process.env.INFRA_METRICS_TOKEN; if (!t || req.get('authorization') !== \`Bearer ${t}\`) { res.status(404).end(); return; } next(); }, metricsHandler);` (404 rather than 401 so the path is not even confirmed to exist). What breaks: any Prometheus scraper currently configured against this endpoint must be given the token in its scrape config — check the deployment's scrape job before shipping, or it will silently stop collecting. Zero database involvement.

**Files.** `apps/api/src/apps/main/server/index.ts`, `apps/api/src/shared/observability/prometheus.ts`, `apps/api/cloudflared.config.yml`

> **Refuter's correction — re-scopes this finding:**
> The core finding stands and is stronger than reported on one axis, weaker on another.
> 
> STRONGER: the auditor's stated uncertainty ("could not establish whether production ingress fronts this or strips /metrics") is resolvable from the repo and resolves against them. apps/api/.do/app.yaml is the production deployment spec (nombaone-api-production, DigitalOcean App Platform, http_port 8000, one service, NO path routes/allowlist), and no nginx/Caddy/WAF config exists anywhere in the repo. The whole Express app, /metrics included, is served on the public production host. Confidence should be high, not medium. Additionally, workbench/apps/api/build_plan_09.md:131 explicitly specified this endpoin
> 
> *…trimmed (1598 more chars — see the cited files).*
> The claim is directionally right but mis-sourced and mis-weighted. (1) Prod reachability is established by .github/workflows/deploy-api.yml (DigitalOcean App Platform, single service, default '/' ingress, api.nombaone.xyz behind Cloudflare), NOT by cloudflared.config.yml, which is a local dev tunnel — the conclusion holds either way, but the cited evidence is the wrong artifact. (2) The exposure ALSO bypasses the rate limiter (rate-limit.ts is a per-route /v1 middleware, not global), and schedulerLag.collect() issues a Redis MGET per scrape, making /metrics an unauthenticated, unmetered endpoint that does backend I/O on the billing process — a stronger point than the data leak. (3) The 'comm
> 
> *…trimmed (412 more chars — see the cited files).*

---

## S27. 🟡 The `example` scaffold reaches the AI-agent surfaces too — llms.txt, the docs MCP server, and the spec vendored into all 9 public SDK repos

**What we publish**

This ADDS blast radius to the already-established /v1/examples + /reference/examples findings; it is not a re-report of them. Three additional surfaces carry it. (1) apps/docs/public/llms.txt:92 — served at https://docs.nombaone.xyz/llms.txt, the file whose whole purpose is to be eaten by coding agents: `- [Example](https://docs.nombaone.xyz/reference/examples.md): The deletable worked example (removed with the scaffold).` (2) The docs MCP server at apps/docs/src/app/api/mcp/route.ts:99-101 `function listOperations() { … for (const [p, methods] of Object.entries(spec.paths))` — it enumerates the OpenAPI paths verbatim, and route.ts:156 advertises that tool as "List every Nomba One API operation (method, path, params) from the live OpenAPI schema." (3) The spec is vendored into the public SDK repos: /Users/mac/Vault/the-60/nombaone/nombaone-node/spec/openapi.json and nombaone-go/spec/openapi.json.

**What the code does**

I walked the shipped spec: `Object.keys(openapi.paths).filter(p => /example/i.test(p))` → `['/v1/examples', '/v1/examples/{id}']`, present in BOTH apps/docs/src/generated/openapi.json and the SDK-vendored copies. So an agent calling the docs MCP `list_operations` is handed `POST /v1/examples` as a first-class Nomba One operation, and an agent reading llms.txt is told in the platform's own words that part of the API is "deletable" and "removed with the scaffold". Meanwhile the SDKs' own conformance tests know better and skip it — nombaone-go/conformance_test.go:267 `"post /v1/examples": true, // deletable reference scaffold`, nombaone-node/test/conformance/openapi-coverage.test.ts:38, nombaone-python/tests/test_conformance.py:33, nombaone-ruby/spec/conformance/openapi_coverage_spec.rb:24, nombaone-elixir/test/conformance/openapi_coverage_test.exs:35 ("Deletable scaffold + infra endpoints, excluded from every SDK").

**Impact.** LIVE AND VISIBLE: docs.nombaone.xyz/llms.txt and the docs MCP endpoint are both public and both explicitly built to be the agent-facing front door. In 2026 a large share of first integrations are written by an agent, and this is what the agent reads: an API whose own manifest says one of its endpoints is a deletable scaffold. It is also public on github.com/nombaone/nombaone-{node,go,…}/spec/openapi.json. The team clearly already agreed this endpoint is not product — five separate SDK conformance suites hardcode an exclusion for it — which is the strongest possible argument that it should not be in the spec at all.

**Fix.** Deleting the endpoint (apps/api/src/apps/main/modules/example/routes.ts + its mount at apps/api/src/apps/main/server/routes.ts:48 `v1Router.use(exampleRouter)`) removes it from the runtime spec automatically, because build.ts walks the mounted router — which then removes it from llms.txt, the MCP tool, the docs, and the re-vendored SDK specs in one move. Then regenerate apps/docs/src/generated/openapi.json and apps/docs/public/llms.txt (drop line 92) and re-vendor spec/openapi.json into the 9 SDK repos. ⚠️ PRODUCTION-DB HAZARD, FLAGGED SEPARATELY: the full deletion chain in DELETE-ME-EXAMPLE.md includes `packages/core-db/src/schema/examples.ts` (still present, still exported from schema/index.ts) — dropping the `examples` TABLE means a `drizzle-kit generate` + `migrate` against the ONE shared Neon database that also serves production. That is a PRODUCTION WRITE and an irreversible DROP T

*…trimmed (263 more chars — see the cited files).*

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/server/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/public/llms.txt`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/generated/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/spec/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct on all three cited surfaces, and understates the reach by one: apps/docs/public/llms-full.txt (the inlined agent corpus) additionally ships runnable cURL bodies against the LIVE host `https://api.nombaone.xyz/v1/examples` (lines 1190/1194/1273/3225), and apps/api/src/apps/main/server/routes.ts:48 mounts `exampleRouter` on /v1 with no environment gate, so the operation an agent is handed is real and working, not a 404.
> 
> The accurate framing is that these are downstream *generated artifacts* of one root cause, not four independent defects: llms.txt/llms-full.txt are emitted by apps/docs/scripts/build-agent-native.ts from apps/docs/content/manifest.ts:229; the M
> 
> *…trimmed (530 more chars — see the cited files).*
> The finding is accurate and slightly understates reach. Corrections/additions: (a) The docs MCP server at apps/docs/src/app/api/mcp/route.ts has NO authentication or environment gate at all — it is a fully public unauthenticated JSON-RPC endpoint, so list_operations leaking /v1/examples is unconditionally reachable by any agent. (b) A FOURTH surface exists that the finding missed: apps/docs/public/llms-full.txt. It is worse than llms.txt because it does not just index the scaffold — it uses /v1/examples as the canonical curl snippet in the authentication/quickstart region (lines 1190, 1194, 1273: `curl https://api.nombaone.xyz/v1/examples`, `curl -X POST https://sandbox.api.nombaone.xyz/v1/e
> 
> *…trimmed (541 more chars — see the cited files).*

---

## S28. 🟡 The docs event catalog claims to be "provably complete" while the unauthenticated live API returns two extra events whose text says "(reference scaffold)"

**What we publish**

apps/docs/src/components/mdx/event-catalog.tsx:9-12 — `Rendered directly from the API's canonical WEBHOOK_EVENT_CATALOG (@nombaone/core-contracts), so it is provably complete and can never drift: every event the API can emit has an entry here`. That component renders https://docs.nombaone.xyz/webhooks/event-catalog. But line 87 silently drops events: `const documented = entries.filter(([type]) => !type.startsWith("example."));` — justified at lines 15-16 as `The example.* scaffold events are excluded: they belong to the reference example module and are deleted with it, so they are never documented.`

**What the code does**

The example module was never deleted, so the exclusion turns the completeness claim into a false one against the running API. apps/api/src/apps/main/modules/events/routes.ts:15 mounts `GET /v1/events/catalog` with NO auth, and it serves the unfiltered WEBHOOK_EVENT_CATALOG — including `example.created` and `example.updated`, whose `when` strings in packages/core-contracts/src/types/webhook-events.ts:108-109 literally contain the words "(reference scaffold)". So the docs promise "every event the API can emit has an entry here" and the API emits two that don't.

**Impact.** LIVE AND VISIBLE (both halves, no key needed): a developer building an exhaustive `switch (event.type)` from https://docs.nombaone.xyz/webhooks/event-catalog, who then sanity-checks it against `curl https://api.nombaone.xyz/v1/events/catalog` (the obvious move, and the endpoint needs no auth), finds two event types the docs swore did not exist — one of which describes itself as a "reference scaffold". They now distrust the catalog's completeness guarantee, which is the single load-bearing promise of the page, and they have to defensively handle two phantom events. The filter is well-intentioned but it hides the leak rather than closing it.

**Fix.** Do not change the docs filter — close the leak at the source. In apps/api: unmount `exampleRouter` (apps/api/src/apps/main/server/routes.ts:48, `v1Router.use(exampleRouter);` — delete that line and its import at line ~20), and delete the `example.created` / `example.updated` entries from packages/core-contracts/src/types/webhook-events.ts:108-109. Then apps/docs/src/components/mdx/event-catalog.tsx:87 can drop the `.filter(...)` and lines 15-16 of its doc comment, and the "provably complete" claim becomes true by construction. WHAT BREAKS: the WebhookEventType union narrows — typecheck packages/sara and apps/api for switches over it. MIGRATION RISK — FLAG SEPARATELY: removing the example module's table is a Drizzle migration against the Neon DB that is SHARED WITH PRODUCTION, i.e. a production write. Unmounting the router and removing the event types requires NO migration and is zero-ris

*…trimmed (46 more chars — see the cited files).*

**Files.** `apps/api/src/apps/main/server/routes.ts`, `packages/core-contracts/src/types/webhook-events.ts`, `apps/docs/src/components/mdx/event-catalog.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct in substance but misnames one event and points at the wrong root cause.
> 
> (1) NAMING: the two extra events are `example.created` and `example.settled` (packages/core-contracts/src/types/webhook-events.ts:108-109), NOT `example.created` and `example.updated`. There is no `example.updated` in WEBHOOK_EVENT_CATALOG.
> 
> (2) EVERYTHING ELSE CONFIRMS. The docs component (apps/docs/src/components/mdx/event-catalog.tsx:8-16, :87) does claim provable completeness while filtering `example.*` out, justified by a comment asserting the example module "is deleted with it." That premise is false: the module is alive and mounted on the live router at apps/api/src/apps/main/server/routes.
> 
> *…trimmed (1011 more chars — see the cited files).*
> The accurate finding is: the public, unauthenticated GET /v1/events/catalog (apps/api/src/apps/main/modules/events/routes.ts:15-18) serves the unfiltered WEBHOOK_EVENT_CATALOG, which still contains the scaffold types example.created and example.settled (packages/core-contracts/src/types/webhook-events.ts:108-109, both self-described as "(reference scaffold)"), while the live docs page hides them via a filter (apps/docs/src/components/mdx/event-catalog.tsx:87) whose adjacent comment claims provable completeness. The two surfaces disagree.
> 
> The finding is WRONG that "the API emits two events that aren't documented." Those two event types have zero producers in the codebase — they are declared 
> 
> *…trimmed (747 more chars — see the cited files).*

---

## S29. 🟡 The docs playground proxies unauthenticated GETs to all 62 documented endpoints using a server-side shared demo key, with the promised per-IP rate limit never built ("tightened … (P3+)")

**What we publish**

apps/docs/src/app/api/playground/route.ts:19-21 states the rate limit as future work: `P0 ships the proxy with the rules; the schema-driven allowlist + per-IP rate limit are tightened as the reference pages land (P3+).` The env comment at apps/docs/.env.example describes the shared key as optional: `Optional shared read-only sandbox key so GET examples work before a user pastes their own sandbox key.`

**What the code does**

The allowlist landed; the rate limit never did. I read apps/docs/src/app/api/playground/route.ts end to end (153 lines) — there is no rate limiter, no per-IP counter, no CAPTCHA, and no origin check. Line 96 falls back to a server-held key when the caller sends none: `const effectiveKey = apiKey || (method === "GET" ? process.env.INFRA_DEMO_SANDBOX_KEY : "");` The allowlist is derived from the full spec — src/lib/playground-allowlist.ts:20-32 builds a matcher for EVERY path in openapi.json — so all 62 documented operations' GETs are forwardable. And the key is populated in the working env: apps/docs/.env sets `INFRA_DEMO_SANDBOX_KEY=nbo_sa…` (non-empty).

**Impact.** SHIPPED NOT VISIBLE (as a UI element) but LIVE AS AN ENDPOINT, if and only if INFRA_DEMO_SANDBOX_KEY is set in the production Vercel env — which I could NOT verify from the repo, hence medium confidence. Where set: anyone can `POST https://docs.nombaone.xyz/api/playground {"method":"GET","path":"/customers"}` with no API key at all and read the demo organization's sandbox customers, invoices, subscriptions, settlements and metrics, unthrottled — a free scraping and DoS-amplification surface pointed at your sandbox API. Blast radius is bounded and non-financial: the live-key guard (lines 60-73) fails CLOSED, only sandbox data is reachable, and mutating verbs still require the caller's own key

*…trimmed (214 more chars — see the cited files).*

**Fix.** First, confirm whether INFRA_DEMO_SANDBOX_KEY is set on the production docs deployment (`vercel env ls`); if it is not, this is a non-issue and you can close it. If it is set, either (a) unset it — GET-without-key then returns the existing clean 401 MISSING_KEY at apps/docs/src/app/api/playground/route.ts:97-99 and the ApiExplorer simply asks the user to paste their sandbox key, which is the honest UX anyway; or (b) keep it and add the rate limit the comment promised: a per-IP token bucket (e.g. 20 req/min keyed on `x-forwarded-for`) in front of the handler at route.ts:47, plus an Origin check restricting callers to https://docs.nombaone.xyz. Then update the stale comment at route.ts:19-21 so it no longer advertises unfinished work. Nothing breaks either way — the ApiExplorer already handles a 401 by prompting for a key.

**Files.** `apps/docs/src/app/api/playground/route.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: apps/docs/src/app/api/playground/route.ts has no per-IP rate limit, no origin check and no CAPTCHA — the deferral comment at lines 19-21 is still outstanding — and line 96 lets an unauthenticated caller issue any of the 39 documented GET operations (not 62) against the sandbox API using the server-held INFRA_DEMO_SANDBOX_KEY, if and only if that env var is set in the production Vercel project (unverifiable from the repo; .env is gitignored). However: (1) the calls are NOT unthrottled — apps/api/src/shared/middlewares/rate-limit.ts:64-119 applies a Redis per-apiKeyId fixed-window limit with a 120/min floor (tenant-config/limits.ts:6) plus an optional monthly org quota, so th
> 
> *…trimmed (1196 more chars — see the cited files).*
> The finding is directionally right and reachable, but three claims need correcting. (a) NOT unthrottled: apps/api's per-API-key limiter caps the demo key at 120 req/min org-wide (PLATFORM_RATE_LIMIT, limits.ts:6), so sandbox-API amplification is bounded; only the docs Vercel hop is unmetered (cost burn + ability to exhaust the demo key's budget and break the quickstart button). (b) The reachable data is not a real tenant's: provision-docs-key.ts creates a dedicated seeded "Nomba One Docs Sandbox" org, so what leaks is fixtures the playground exists to show. (c) <ApiExplorer> appears in ZERO content pages, so the 62-endpoint keyless surface is attacker-only; the sole shipped keyless call is G
> 
> *…trimmed (594 more chars — see the cited files).*

---

## S30. 🟡 The docs snippet/method-name fixes are ONE file's worth of work but they are being reported as ~15 per-language bugs — fix the emitters together, and only after the spec settles

**What we publish**

The list has separate items for: 5 fabricated method names (voidCreditGrant/schedule.cancel/paymentMethods.delete/retrieveCatalog/retrieveBilling), ~8-10 fabricated *Params type names, Go initialisms (CustomerId vs CustomerID), Go missing list params, Go pointer helpers, .NET missing Async suffix, .NET `var event` keyword, Java `void` keyword, Java missing imports, Java string-vs-enum, Rust nested-namespace E0615, Rust `..Default::default()` on non-Default structs, Rust missing ListParams, Elixir snake-cased module namespaces, PHP dot-notation, and the money-sample regex.

**What the code does**

Almost all of these live in exactly three files — apps/docs/src/lib/api-ref/sdk-map.ts (the hand-authored name map, shared by ALL languages and by the method index), snippets.ts (the ten renderers, which duplicate the same `singularPascal(op.resource) + pascal(method) + 'Params'` derivation in go/dotnet/java/rust), and samples.ts (the value generator). The 5 method names and the ~8 *Params names are language-NEUTRAL bugs — they are wrong in every language tab, not just the one each finding happened to compile.

**Impact.** Fixing them per-language means touching the same functions ten times and shipping partial correctness. Fixing them BEFORE the spec settles means regenerating against a moving schema. And a naive 'append Async' or 'append ::default()' patch reintroduces bugs (Customers.VoidCreditGrant → VoidCreditAsync is a stem change, not a suffix; CouponCreateParams/PriceCreateParams derive no Default).

**Fix.** Do this AFTER the OpenAPI batch lands, as one PR:
1. sdk-map.ts: correct the 5 method names ONCE (voidCredit, release, remove, catalog, billing) — they are shared across all nine languages and the <SdkMethodIndex>. Add a `paramsType` field to SdkCall (per-op, and per-language where they diverge) so go/dotnet/java/rust stop deriving the type name from the URL segment; add a per-language method override for reserved words (java: void→voidInvoice) and for casing/suffix rules (dotnet: Async; go: ID/URL initialisms).
2. snippets.ts: fix the four renderers that share the broken derivation in one pass; fix the Rust nested-namespace chain (`namespace.map(n => snake(n) + '()')`), the Rust `Nombaone::new()` arity, and the Go/Rust/Java/.NET required-params-struct emission for query-only ops.
3. samples.ts: make `/inkobo$/` case-insensitive (16 money fields currently sample 0), honour `exclusiveMini

*…trimmed (704 more chars — see the cited files).*

**Files.** `apps/docs/src/lib/api-ref/sdk-map.ts`, `apps/docs/src/lib/api-ref/snippets.ts`, `apps/docs/src/lib/api-ref/samples.ts`, `apps/docs/scripts/check-api-ref.ts`

---

## S31. 🟡 `EXAMPLE_NOT_FOUND` scaffold code is shipped inside the published Hex package's public API

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-elixir/lib/nombaone/error.ex:73-75 documents the list as real product surface: "# Vendored from the platform's `PUBLIC_ERROR_CODES` (packages/errors/src/codes.ts). # The union is OPEN … this list only powers constants and documentation", and error.ex:129-131 exposes it as a public, @spec'd, @doc'd function: `@doc """The known set of public error codes, vendored from the platform…""" @spec public_error_codes() :: [String.t()] def public_error_codes, do: @public_error_codes`.

**What the code does**

error.ex:116 — the vendored list literally contains the deletable scaffold's code: `    EXAMPLE_NOT_FOUND` (sitting between `QUOTA_EXCEEDED` on :115 and `SYSTEM_INTERNAL_ERROR` on :117). This is not a local file: hex.pm's API confirms `nombaone` 0.1.0 is PUBLISHED and is the latest stable release (`releases: ['0.1.0']`, `latest_stable: 0.1.0`, `inserted: 2026-07-07T08:12:47Z`, with `links.GitHub = https://github.com/nombaone/nombaone-elixir`), and mix.exs:82 ships `files: ~w(lib …)`. So `Nombaone.Error.public_error_codes()` returns `EXAMPLE_NOT_FOUND` to every Elixir developer today, and mix.exs:88-91 (`docs`, `main: "readme"`, ex_doc) renders it into the public hexdocs page for `Nombaone.Error`. This directly answers the audit's scaffold-leak question: yes, the deletable `/v1/examples` scaffold has escaped into a shipped SDK's public surface.

**Impact.** A developer building an exhaustive error-code match (the exact use case `public_error_codes/0` exists for) enumerates a code for a resource that does not exist in the product, and reasonably concludes the API has an `Example` object. On a paid billing SDK on Hex, a visible `EXAMPLE_NOT_FOUND` in the published error catalog reads as unfinished software.

**Fix.** Delete line 116 (`    EXAMPLE_NOT_FOUND`) from the `@public_error_codes` sigil in /Users/mac/Vault/the-60/nombaone/nombaone-elixir/lib/nombaone/error.ex and cut a 0.1.1 release (bump mix.exs:4 `@version`, then apps/docs/src/lib/sdks/registry.ts:184 `version`). Do it in the same change that removes `EXAMPLE_NOT_FOUND` from packages/errors/src/codes.ts, so the vendored list stays a faithful copy; a stale vendored constant here is exactly how the scaffold survives the scaffold's own deletion.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-elixir/lib/nombaone/error.ex`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the deletable example scaffold is still mounted in the live API (apps/api/src/apps/main/server/routes.ts:48, `v1Router.use(exampleRouter)`), so `EXAMPLE_NOT_FOUND` is a genuine, reachable public error code. It is therefore intentionally listed in the platform SSOT (packages/errors/src/codes.ts:212, :330, :851-854, under the comment "The deletable example slice (delete with the example)") and correctly propagates into the OpenAPI spec, the docs error reference, and ALL nine SDKs — Elixir (lib/nombaone/error.ex:116), Go, Node, Python, Ruby, PHP, etc. The Elixir SDK is not the bug; it is a faithful vendored mirror, and patching error.ex alone would desync it from the SSOT. The
> 
> *…trimmed (409 more chars — see the cited files).*
> The finding is right but scoped too narrowly. Accurate version: the deletable `/v1/examples` scaffold has escaped into ALL nine published SDKs (not just Elixir), into the served `/v1/openapi.json` and every SDK's vendored `spec/openapi.json` (both `/v1/examples` paths), and into the public docs error reference + `llms-full.txt` + the Ask-AI index. Root cause is `packages/errors/src/codes.ts:212`, self-labeled "The deletable example slice (delete with the example)". Worse than the finding says: the scaffold is not merely a documented string — `apps/api/src/apps/main/server/routes.ts:48` mounts `exampleRouter` UNCONDITIONALLY on the production `/v1` router with no environment gate (unlike `tes
> 
> *…trimmed (241 more chars — see the cited files).*

---

## S32. 🟡 `PaymentMethods.DeleteAsync` collides with a protected base-class helper — the fabricated name produces CS0122 'inaccessible due to its protection level', not 'does not exist'

**What we publish**

ADDS A NEW SPECIFIC to the established `paymentMethods.delete → remove` fabrication. `apps/docs/src/lib/api-ref/sdk-map.ts:32-38` derives `delete` from `CRUD_METHOD`, so `DELETE /v1/payment-methods/{id}` emits (snippets.ts:293) `var paymentMethod = await nombaone.PaymentMethods.DeleteAsync("nbo000000000001pm");`, and sdk-method-index.tsx renders `nombaone.PaymentMethods.Delete`.

**What the code does**

The real method is `nombaone-dotnet/src/NombaOne/Resources/PaymentMethods.cs:239`: `public Task<PaymentMethod> RemoveAsync(string id, RequestOptions? options = null, CancellationToken cancellationToken = default)`. The .NET-specific twist: `NombaoneResource` (the base class every resource inherits) has a **protected** generic helper `DeleteAsync<T>(string, RequestOptions?, CancellationToken)`. So the name is not simply absent — it resolves to an inaccessible member. `dotnet build` on the emitted snippet gives `error CS0122: 'NombaoneResource.DeleteAsync<T>(string, RequestOptions?, CancellationToken)' is inaccessible due to its protection level` — NOT the CS1061 'does not contain a definition' that every other fabricated name produces (I verified: `Customers.VoidCreditGrantAsync`, `Events.RetrieveCatalogAsync`, `Metrics.RetrieveBillingAsync` and `Subscriptions.Schedule.CancelAsync` all give CS1061).

**Impact.** CS0122 tells the developer they are calling something that exists but is private — so they go hunting for a visibility bug, an `InternalsVisibleTo`, or a wrong package version, instead of discovering the method is simply called `RemoveAsync`. This is the one fabricated name in the .NET surface whose compiler diagnostic actively points away from the fix. It is also the only DELETE on payment-methods, i.e. the 'detach a card' call.

**Fix.** In `apps/docs/src/lib/api-ref/sdk-map.ts`, add to `OVERRIDES` (the `// payment-methods` block, after line 76): `"DELETE /v1/payment-methods/{id}": { method: "remove" },`. That fixes both the snippet (snippets.ts) and the method index (sdk-method-index.tsx) in one place, for all nine SDKs. While there, also fix the other four established fabrications against the real .NET names: `"DELETE /v1/customers/{id}/credit/{grantId}"` → `voidCredit` (Customers.cs:360 `VoidCreditAsync`); `"GET /v1/events/catalog"` → `catalog` (Events.cs:82 `CatalogAsync`); `"GET /v1/metrics/billing"` → `billing` (Metrics.cs:110 `BillingAsync`); `"DELETE /v1/subscriptions/{id}/schedule"` → `release` (Subscriptions.cs:527 `ReleaseAsync`).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct except for one word: the base helper is declared `private protected`, not `protected` — `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/NombaoneResource.cs:42`: `private protected Task<T> DeleteAsync<T>(string path, RequestOptions? options, CancellationToken cancellationToken)` (all NombaoneResource helpers are `private protected`). This does not alter the impact: `private protected` emits as FamANDAssem and remains visible in metadata, so from a consumer assembly Roslyn still reports CS0122 rather than CS1061 — I confirmed by compiling the emitted snippet against the SDK's NombaOne.dll and got exactly `error CS0122: 'NombaoneResource.DeleteAsync<T>(stri
> 
> *…trimmed (291 more chars — see the cited files).*
> The technical facts hold (docs emit `PaymentMethods.DeleteAsync`, real method is `RemoveAsync`, base helper is `private protected DeleteAsync<T>` so the diagnostic is CS0122 rather than CS1061), and it is reachable on the live public docs. But it is a sub-detail of the already-established `paymentMethods.delete → remove` fabrication rather than a distinct defect, its blast radius is a compile-time error in a copy-paste snippet with no runtime/money/auth exposure, and the "developer hunts for a visibility bug" narrative overstates the friction — the `private protected` helper is invisible to IntelliSense, so the correct `RemoveAsync` is right there in completion. Severity: low, filed as a not
> 
> *…trimmed (37 more chars — see the cited files).*

---

## S33. 🟡 `confirmExampleFromWebhook` is dead code that posts a real settlement ledger transaction with provider re-verification left as an explicit no-op

**What we publish**

packages/sara/src/example/confirm.ts:25-28 documents the security-critical step it does not perform: "2. RE-VERIFY against the provider before recording anything. (Stub below — this is where you call the provider's 'get transaction' API using the provider reference and confirm amount + status server-side. Never settle on the strength of the webhook alone.)" and at :64-69 the body confirms: "// 2. Re-verify against the provider here, never trust the webhook alone: ... The mock rail has no real provider, so this is a documented no-op seam."

**What the code does**

The function nonetheless proceeds straight to posting money. Immediately after the no-op comment it does `await postTransaction(txDb, ctx, { kind: 'settlement', ... entries: [{ accountId: cash.id, direction: 'debit', amount: row.amount }, { accountId: platformRevenue.id, direction: 'credit', amount: row.amount }] })` and then `emitEvent(...)`. It is, however, unreachable: grepping `confirmExampleFromWebhook` across apps/api/src and packages/sara/src returns no caller outside packages/sara/src/example/ itself — no route, no worker, no webhook handler invokes it. The real inbound-confirm path is a separate file, apps/api/src/shared/services/billing/confirmInvoiceFromWebhook.ts, which its own header describes as the "twin of `example/confirm`".

**Impact.** SHIPPED NOT VISIBLE: nothing can call this today, so no money is at risk right now and no integrator can see it. I am reporting it because of what it is rather than what it currently does: a function that credits platform_revenue on the strength of a webhook alone, with the verification step replaced by a comment, sitting in the shipped sara bundle where it is exported and importable. It is a loaded footgun for whoever next wires up an inbound webhook by copying "the reference implementation", and it is the single most dangerous artifact in the deletable slice.

**Fix.** Delete packages/sara/src/example/confirm.ts along with the rest of packages/sara/src/example/ (finding 1, step 3) and remove the barrel export. Nothing breaks — it has no callers, and the real path (apps/api/src/shared/services/billing/confirmInvoiceFromWebhook.ts) is a fully independent implementation that must NOT be touched. Verify before deleting that confirmInvoiceFromWebhook does perform genuine provider re-verification; if it shares this no-op seam, that is a separate critical finding on the live money path and should be raised immediately. No database or migration involvement.

**Files.** `packages/sara/src/example/confirm.ts`, `packages/sara/src/example/index.ts`

> **Refuter's correction — re-scopes this finding:**
> `confirmExampleFromWebhook` is NOT dead code. It is live and reachable from a public, unauthenticated surface: apps/checkout/src/app/[reference]/page.tsx (self-described "UNAUTHENTICATED", no middleware in the app) renders PayForm.tsx:33, which invokes payAction (apps/checkout/src/lib/actions.ts:61), which calls confirmExampleFromWebhook at actions.ts:85. The auditor missed this because they scoped their grep to apps/api/src and packages/sara/src only.
> 
> Consequence: anyone holding a checkout reference URL can press Pay and cause a real `settlement` ledger transaction to be posted (debit `cash`, credit `platform_revenue`) with (a) provider re-verification replaced by a comment (confirm.ts:66-
> 
> *…trimmed (1597 more chars — see the cited files).*
> Two corrections. (1) The claim "no caller outside packages/sara/src/example/" is false. apps/checkout/src/lib/actions.ts:85 calls confirmExampleFromWebhook from `payAction`, a 'use server' Server Action, triggered by the "Pay now" button (PayForm.tsx) on the explicitly UNAUTHENTICATED public page apps/checkout/src/app/[reference]/page.tsx. There is no auth guard or middleware in the app. The unverified settlement is therefore already wired to an anonymous button click, not merely exported and awaiting a future copy-paste. (2) The correct reason it is not a production risk is deployment, not absence of a caller: apps/checkout is excluded from the only deploy workflow (.github/workflows/deploy
> 
> *…trimmed (878 more chars — see the cited files).*

---

## S34. 🟡 `exampleQueue` is a dead BullMQ queue that opens two Redis connections per process at import and has no worker consuming it

**What we publish**

packages/queue/src/queues/example.ts:8-11 documents itself as boilerplate — "Payload for a generic example job. Replace the shape with your own domain job when you copy this boilerplate." It nonetheless constructs live infrastructure at module scope: line 23 `export const exampleQueue = new Queue<ExampleJobData, ExampleJobResult>(EXAMPLE_QUEUE_NAME, { connection, defaultJobOptions });` and line 31 `export const exampleQueueEvents = new QueueEvents(EXAMPLE_QUEUE_NAME, { connection });`, plus a producer `enqueueExample` at line 42.

**What the code does**

No worker consumes it. apps/api/src/services/worker/index.ts:33-38 is the sole worker supervisor and registers exactly four: `workers = [createCronWorker(), createOutboundWebhookWorker(), createInboundWebhookWorker(), createBillingWorker()];` — there is no `createExampleWorker`. A repo-wide grep for `exampleQueue|EXAMPLE_QUEUE_NAME|ExampleJobData` across apps/api/src and packages/ returns hits ONLY inside packages/queue/src/queues/example.ts itself — nothing enqueues, nothing consumes. It is nevertheless instantiated in every process, because packages/queue/src/queues/index.ts:2 does `export * from './example';`, so any import of @nombaone/queue (api, worker, and cron all import it) evaluates the module and constructs both objects.

**Impact.** SHIPPED NOT VISIBLE: no integrator can see this and no jobs stall (nothing calls enqueueExample). But it is not free — a BullMQ `QueueEvents` opens a dedicated *blocking* Redis connection (XREAD BLOCK on the events stream) and `Queue` opens another, so every production process (API, worker, cron) permanently holds two Redis connections servicing a queue that can never receive a job. On a managed Redis with a connection cap this is real, silent waste, and it is exactly the "unregistered queue" class of dead artifact.

**Fix.** Delete packages/queue/src/queues/example.ts entirely and remove `export * from './example';` at packages/queue/src/queues/index.ts:2. Nothing breaks: no consumer, no producer, and no type in apps/api references ExampleJobData/ExampleJobResult. Do this as part of the example-slice deletion (finding 1, step 10). No database or migration involvement — this is pure Redis/runtime, zero production-write risk.

**Files.** `packages/queue/src/queues/example.ts`, `packages/queue/src/queues/index.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: `exampleQueue` is dead boilerplate — confirmed. packages/queue/src/queues/example.ts is exported via queues/index.ts:2 (`export * from './example';`), nothing calls `enqueueExample`, and apps/api/src/services/worker/index.ts:33-38 registers only cron/outbound-webhook/inbound-webhook/billing workers, so no worker consumes it. Delete the file and its barrel export.
> 
> Two corrections to the auditor's impact analysis:
> 
> 1. It costs ONE Redis connection per process, not two. `connection` (packages/queue/src/config/redis.ts:3) is a shared ioredis INSTANCE, and BullMQ's RedisConnection (redis-connection.js:47-58) reuses a passed-in instance rather than duplicating it — so `new Queue
> 
> *…trimmed (1246 more chars — see the cited files).*
> The dead queue is real and does get instantiated in every production process, but two claims are wrong. (1) It costs ONE extra Redis connection per process, not two: packages/queue/src/config/redis.ts exports a shared IORedis *instance*, and bullmq reuses a shared instance for `Queue` (queue-base.js sets `shared: isRedisInstance(...)`, redis-connection.js then does `this._client = opts`) — only `QueueEvents` pays, because queue-events.js explicitly `.duplicate()`s the instance and autoruns a blocking XREAD loop. (2) It is NOT unreferenced: apps/admin/src/lib/queue/queue-stats.ts:5,27 imports `exampleQueue` and lists it in the admin "Jobs & workers" dashboard, where it renders as a permanentl
> 
> *…trimmed (631 more chars — see the cited files).*

---

## S35. 🟡 buildStubPage() is a live, ungated "Coming soon" generator wired into generateStaticParams AND sitemap.xml — dormant today, but one manifest line away from publishing a placeholder to Google

**What we publish**

apps/docs/src/lib/content.ts:148-151 — `A "coming soon" stub for a manifest-listed route whose .mdx is not yet authored — so the full IA is navigable and nothing 404s while content lands.` Lines 157-167 emit the literal user-facing copy: `<Callout type="note" title="Coming soon">` … `This page is planned and on the way.` Line 197 is the trigger: `return ALL_SLUGS.includes(slug) ? buildStubPage(slug) : null;`

**What the code does**

It is currently DORMANT, and I verified that rather than assuming: I enumerated all 87 manifest slugs and checked each for a matching .mdx — zero are missing, and `grep -rl "Coming soon" .next/server/app` returns 0 files. So no visitor sees a stub today. BUT it is armed and unguarded in two directions. (1) apps/docs/src/lib/content.ts:304-307 — `listRoutableSlugs()` returns `authored ∪ ALL_SLUGS`, and it feeds BOTH `generateStaticParams` and apps/docs/src/app/sitemap.ts:22 (`const englishSlugs = Array.from(new Set([...(await listRoutableSlugs()), ...apiRefSlugs()]))`), with src/app/robots.ts allowing `/`. (2) There is NO CI gate that fails on a manifest entry without an .mdx — the link checker explicitly tolerates it: apps/docs/scripts/check-links.ts:168 — `// Only check anchors for pages we have content for (skip pure manifest stubs).`

**Impact.** SHIPPED NOT VISIBLE: zero stubs render today, so nothing is currently damaging. The risk is structural: the moment anyone adds a nav entry to content/manifest.ts before writing its .mdx — the exact ordinary workflow the mechanism was designed to enable — a page reading "Coming soon — This page is planned and on the way" is prerendered, linked in the sidebar of every page, AND submitted to Google in sitemap.xml, with no build failure and no review signal. On a live product docs site that is a credibility landmine armed to fire on a one-line commit. I am reporting it as SHIPPED NOT VISIBLE rather than LIVE because I confirmed it currently renders nowhere.

**Fix.** Since all 87 slugs are authored, the mechanism is now pure dead weight — delete it and convert it into a gate. In apps/docs/src/lib/content.ts: remove `buildStubPage` (lines 148-177), change line 197 to `return null;` (a manifest route with no .mdx becomes an honest 404 rather than a placeholder), and change `listRoutableSlugs()` (lines 304-307) to return `authored` only. Then add a build-time assertion — in an existing gate such as scripts/check-links.ts or check-frontmatter.ts — that every slug in ALL_SLUGS has a matching content/<slug>.mdx, failing the build if not. WHAT BREAKS: nothing today (0 of 87 slugs rely on it), and the sitemap loses no live URL. The new gate is what stops the regression, so land it in the same commit.

**Files.** `apps/docs/src/lib/content.ts`, `apps/docs/scripts/check-links.ts`, `apps/docs/content/manifest.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: `buildStubPage()` is intentional, documented behavior (content.ts:148-151 and the `getPage` docstring at 179-189 both state that a manifest route without an authored .mdx renders a stub rather than a 404 — the deliberate counterpart to the translated-locale path, which refuses to stub and 308s to English instead). It is currently dormant: 87/87 manifest slugs have an authored .mdx, so no stub renders anywhere. The auditor's mechanical claims are all true — `listRoutableSlugs()` (content.ts:304-307) unions authored ∪ ALL_SLUGS and feeds both `generateStaticParams` (src/app/(en)/[[...slug]]/page.tsx:33) and sitemap.ts:23, and no CI gate fails on a manifest entry lacking an .m
> 
> *…trimmed (699 more chars — see the cited files).*
> Accurate version: the stub generator is intentional, documented, and currently inert (0 of 87 manifest slugs lack an .mdx) — it renders for no user and is not a live defect. The only substantive gap is an asymmetry: stubs are excluded from the search index but NOT from sitemap.xml, so IF someone later adds a manifest entry before authoring its page, that placeholder would be submitted to Google. Fix is one line — have apps/docs/src/app/sitemap.ts use listAllSlugs() (authored only) instead of listRoutableSlugs(), keeping stubs navigable but unindexed. Optionally add a CI check that every manifest slug has an .mdx. Report this as a latent hardening item, not a shipped issue.

---

## S36. ⚪ The admin app ships a first-class "Examples" dashboard page for the deletable scaffold

**What we publish**

apps/admin (the internal operator console) has exactly five pages: apps/admin/src/app/(auth)/sign-in/page.tsx, (dashboard)/page.tsx, (dashboard)/audit-log/page.tsx, (dashboard)/jobs/page.tsx and **(dashboard)/examples/page.tsx**.

**What the code does**

One of the five screens in the operator surface is a browser for the `examples` scaffold resource, and apps/admin/src/lib/queue/queue-stats.ts:5,27 additionally lists `exampleQueue` among "The four async flows this stack runs" on the Jobs screen (while omitting the real `billingQueue`). The admin app was not audited at all in the 191 findings — this is the only defect I found in it, which is worth stating explicitly.

**Impact.** Internal only (no integrator sees it), but it is the same un-deleted scaffold surfacing in a fourth app, and it means the example slice cannot be removed without touching apps/admin too — a dependency the existing DELETE-ME-EXAMPLE fix plans do not list.

**Fix.** Delete apps/admin/src/app/(dashboard)/examples/page.tsx and its nav entry, and correct apps/admin/src/lib/queue/queue-stats.ts to list the four REAL queues (cron/scheduler, outbound-webhook, inbound-webhook, billing) — add these files to the example-slice deletion checklist.

**Files.** `apps/admin/src/app/(dashboard)/examples/page.tsx`, `apps/admin/src/lib/queue/queue-stats.ts`

---

## S37. ⚪ The root README still describes the shipped product as "a bare boilerplate" containing "none of the billing product itself", uses the dead nbo_test_ prefix, and points at a file that does not exist

**What we publish**

README.md:3-10, the first thing anyone opening the repo reads:
"A **bare, paradigm-embodying boilerplate** for **Nomba One** … > This repo is a *launchpad*, not the product. It ships the topology, conventions, and the cross-cutting **primitives** a billing engine needs — and **none** of the billing product itself. You build plans, subscriptions, the lifecycle + dunning state machines, invoices/proration, the scheduler policy, the concrete rail adapters, and settlement **on top of this**. The places those plug in are marked as doc-commented seams. See `PRODUCT-OVERVIEW.md`."
Plus README.md:16 "per-org **secret API keys** (SHA-256, env-embedded `nbo_test_`/`nbo_live_`, scopes, rotation, timing-safe)" and README.md:27 "…each with the chrome, common kit, and auth patterns, **no product screens**."

**What the code does**

Every one of those statements is now false. The billing product is built: apps/api/src/shared/services/ contains billing/, dunning/, plans/, prices/, subscriptions/, invoices/, settlements/, metrics/. The console has real product screens: apps/console/src/app/(app)/ contains coupons, customers, developers, dunning, invoices, payments, plans, reconciliation, settings, settlements, subscriptions. The key prefix was renamed — packages/sara/src/api-keys/keys.ts:37-38 is `sandbox: 'nbo_sandbox_'` / `live: 'nbo_live_'`; `nbo_test_` no longer exists anywhere in the domain. And `PRODUCT-OVERVIEW.md` does not exist — `ls *.md` returns only DELETE-ME-EXAMPLE.md, MANIFESTO.md, README.md.

**Impact.** SHIPPED NOT VISIBLE (to integrators): the monorepo lives at github.com/emekaorji/nombaone (a personal remote, presumably private) — unlike the nine SDK repos which are public under github.com/nombaone/*. So a customer is unlikely to read it. But it is the document every new engineer, contractor, partner, or diligence reader opens first, and it currently tells them the company has not built its own product. The `nbo_test_` line is the more actionable error: it is a live example of the known compiler-blind rename leak, and anyone following the README will hand out or look for a key prefix that no longer exists. Listed as low precisely because it is not integrator-facing — I want the owner to f

*…trimmed (29 more chars — see the cited files).*

**Fix.** Rewrite README.md:3-10 to describe what actually shipped (delete the "launchpad, not the product" blockquote and the "you build plans, subscriptions…" sentence). README.md:16 — change `nbo_test_`/`nbo_live_` to `nbo_sandbox_`/`nbo_live_`. README.md:27 — delete "no product screens". README.md:10 — remove the `See PRODUCT-OVERVIEW.md` pointer (or write the file). README.md:28-30 — the "One deletable `example` slice" bullet and the `See DELETE-ME-EXAMPLE.md` pointer should go when the slice does. No DB migration involved.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/README.md`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on substance but overstates one sub-claim. ACCURATE version: README.md is stale on three counts. (1) Lines 3-10 and 27-28 describe the repo as a "bare boilerplate" shipping "none of the billing product itself" with "no product screens" — both false: apps/api/src/shared/services/ contains billing/, dunning/, plans/, prices/, subscriptions/, invoices/, settlement/, metrics/, proration/, coupons/, credits/, reconciliation/, subscription-schedules/, and apps/console/src/app/(app)/ has 22 real page.tsx routes. (2) Line 16 advertises the dead `nbo_test_` prefix; packages/sara/src/api-keys/keys.ts:36-38 is unconditionally `{ sandbox: 'nbo_sandbox_', live: 'nbo_live_' }` with 
> 
> *…trimmed (973 more chars — see the cited files).*

---

# Part 2 — Cross-cutting: money, errors, webhooks, auth

Invariants asserted in prose and broken in practice.

*38 findings — 5 critical, 14 high, 16 medium, 3 low.*

## X1. 🔴 Docs publish a webhook body shape that does not exist: no `event` object, and two invented top-level fields (`reference`, `createdAt`)

**What we publish**

apps/docs/content/webhooks/overview.mdx:24-34 — the canonical "What a delivery looks like" block:
```
{
  "id": "evt_2a7e1b0d8c3a",
  "type": "invoice.paid",
  "reference": "nbo749201835566inv",
  "createdAt": "2026-07-02T10:14:52.004Z",
  "data": { "reference": "nbo749201835566inv" }
}
```
followed by "The `type` names the event, `reference` is the resource's public id, and `id` is the unique event id you dedupe on."
Repeated at apps/docs/content/webhooks/event-catalog.mdx:14 — "Every event shares one shape: a `type`, a stable `reference` (the `nbo…` id of the resource it's about), and a small typed payload."

**What the code does**

packages/sara/src/webhooks/deliver.ts:177-184 — the ONLY place a delivery body is built:
```ts
const buildBody = (delivery, event) => JSON.stringify({
    id: delivery.reference,      // ← a WHD (delivery) reference, NOT an event id
    type: delivery.eventType,
    event: event ? { id: event.reference, type: event.type, createdAt: event.createdAt } : {...},
    data: event?.payload ?? {},
  });
```
There is no top-level `reference` and no top-level `createdAt`. References are minted as `nbo{12 digits}{domain}` (packages/sara/src/reference.ts:43-45) — `nbo…whd` for the delivery (packages/sara/src/events/emit.ts:85), `nbo…evt` for the event (emit.ts:44) — never `evt_2a7e…`.
All NINE SDKs model the REAL shape and contradict the docs: nombaone-node/src/webhook-events.ts:8-18 — `id: string  // The delivery reference (nbo…whd)`, `event: { id: string; type: string; createdAt: string }` with "**Dedupe on `event.id`** (`nbo…evt`)". Same in nombaone-go/webhook/webhook.go:16, nombaone-python/src/nombaone/webhook_events.py:20-27, nombaone-elixir/lib/nombaone/webhook_event.ex:14-19.

**Impact.** A handler written from the core webhook docs reads `body.reference` and `body.createdAt` and gets `undefined` on every single delivery (I parsed a real body and confirmed both are undefined). Worse, it treats the top-level `id` as an event id: that value is `nbo…whd`, a webhook-DELIVERY reference. A consumer who takes it and calls `GET /v1/events/{id}` to fetch the event gets a 404, because `/v1/events/:id` resolves domain-event (`nbo…evt`) references only (apps/api/src/apps/main/modules/events/routes.ts:20). The docs and the SDKs teach two different, incompatible bodies for the same POST.

**Fix.** Rewrite apps/docs/content/webhooks/overview.mdx:24-34 to the real body emitted by deliver.ts:177-184:
```
{
  "id": "nbo493028471023whd",
  "type": "invoice.paid",
  "event": { "id": "nbo749201835566evt", "type": "invoice.paid", "createdAt": "2026-07-02T10:14:52.004Z" },
  "data": { "reference": "nbo749201835566inv" }
}
```
and change line 33-34 to: "`id` is the delivery id (`nbo…whd`); `event.id` (`nbo…evt`) is the event id you dedupe on; the affected resource's public id is `data.reference`." Fix apps/docs/content/webhooks/event-catalog.mdx:14 to say the reference lives in `data.reference`, not at the top level. Same for apps/docs/src/components/mdx/event-catalog.tsx:104-106 ("Every event carries a stable `reference`").

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/overview.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/event-catalog.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/event-catalog.tsx`

> **Refuter's correction — re-scopes this finding:**
> The core claim is correct and I could not refute it: apps/docs/content/webhooks/overview.mdx:24-34 publishes a webhook body that the system never sends. The only delivery-body builder (packages/sara/src/webhooks/deliver.ts:177-185, single call site at :112) emits `{ id: <nbo…whd delivery ref>, type, event: { id: <nbo…evt>, type, createdAt }, data }` — there is no top-level `reference` and no top-level `createdAt`, and there IS an `event` object the docs never mention. The code is intentional (the frozen-catalog SSOT comment at packages/core-contracts/src/types/webhook-events.ts:12 spells out the same envelope, and apps/api/test/e2e/webhooks.e2e.test.ts:111 asserts it), so overview.mdx is the
> 
> *…trimmed (1491 more chars — see the cited files).*
> The body-shape half is fully correct: apps/docs/content/webhooks/overview.mdx:24-34 publishes a top-level `reference` and `createdAt` that the API never sends, omits the real `event: {id, type, createdAt}` object, and uses an invented `evt_2a7e…` id format — a handler written from it reads `undefined` for both fields on every delivery. `data.reference` is real, so only the top-level fields are fabricated.
> 
> The dedupe half is overstated. The top-level `id` is the webhook-delivery reference (`nbo…whd`), and retries AND replays re-arm the SAME delivery row (packages/sara/src/webhooks/deliveries.ts:132-155: "re-arm the SAME row (no new WHD/EVT reference)"), so it is a stable per-endpoint dedupe 
> 
> *…trimmed (507 more chars — see the cited files).*

---

## X2. 🔴 Every published OpenAPI spec (docs + all 9 SDK repos) declares `servers: http://localhost:8000/v1`

**What we publish**

`apps/docs/src/generated/openapi.json:10` — `"url": "http://localhost:8000/v1"` (identical at `nombaone-<id>/spec/openapi.json:10` for all nine SDKs). This is the committed, shipped artifact (it is in HEAD and is what `scripts/check-openapi-honesty.ts:19`, `build-agent-native.ts:40`, the MCP route and every `/reference/*` page are generated from).

**What the code does**

`apps/api/src/shared/openapi/build.ts:117` — `export function buildOpenApiDocument(v1Router: Router, baseUrl = 'http://localhost:8000')` and `apps/api/src/apps/main/server/routes.ts:60` — `cachedOpenApiDoc ??= buildOpenApiDocument(v1Router);` — called with NO baseUrl, so the default dev placeholder is baked into the document that is served at `GET /v1/openapi.json` and snapshotted into the SDKs. The real hosts are `https://sandbox.api.nombaone.xyz` / `https://api.nombaone.xyz` (`apps/docs/content/getting-started/environments.mdx:33,37`; `nombaone-node/src/client.ts:24-26` `BASE_URLS`; `nombaone-go/client.go:12-13`).

**Impact.** Anyone who does the standard thing — `openapi-generator generate -i https://api.nombaone.xyz/v1/openapi.json`, import into Postman/Insomnia/Bruno, or point an agent at the spec — gets a client that fires every request at `http://localhost:8000` and fails with ECONNREFUSED. This is placeholder dev content on the production machine-readable surface.

**Fix.** `apps/api/src/apps/main/server/routes.ts:60`: pass the real base URL, e.g. `buildOpenApiDocument(v1Router, env.INFRA_ENVIRONMENT === 'production' ? `https://${env.INFRA_LIVE_API_HOST}` : `https://${env.INFRA_SANDBOX_API_HOST}`)`, or better, emit BOTH servers in `build.ts:161` (`[{url:'https://sandbox.api.nombaone.xyz/v1'},{url:'https://api.nombaone.xyz/v1'}]`). Then regenerate `apps/docs/src/generated/openapi.json` and re-vendor all nine `nombaone-*/spec/openapi.json`.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/server/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/build.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The defect is real but its blast radius is narrower than claimed. TRUE: `buildOpenApiDocument` (apps/api/src/shared/openapi/build.ts:117, servers emitted at :161) defaults to `http://localhost:8000` and both of its only callers — apps/api/src/apps/main/server/routes.ts:60 (live `GET /v1/openapi.json`) and apps/api/scripts/gen-openapi.ts:20 (the committed snapshot) — pass no baseUrl. No env gate or override exists. The bad `servers.url` is therefore served from the production hosts and is committed in apps/docs/src/generated/openapi.json:10 plus all nine sibling SDK repos' spec/openapi.json (five of which are additionally stale, still saying "test mode"). FALSE/overstated: the docs site and t
> 
> *…trimmed (856 more chars — see the cited files).*
> The finding is factually correct and production-reachable, but "critical" is overstated. Accurate version: the public spec (served at GET /v1/openapi.json on api.nombaone.xyz and committed into all nine SDK repos) advertises a dev placeholder host, breaking anyone who generates a client from the spec or imports it into Postman/Insomnia/an agent. It does NOT break the documented happy path — the docs playground reads only `paths` (playground-allowlist.ts:20) and every SDK hardcodes the correct BASE_URLS, so SDK users and curl-sample users are unaffected. The failure mode is loud and fails closed (ECONNREFUSED on first request), leaks nothing (localhost is a dead end for any key sent there), a
> 
> *…trimmed (130 more chars — see the cited files).*

---

## X3. 🔴 Every webhooks endpoint answers a not-found id with code SYSTEM_INTERNAL_ERROR and the message "Internal server error"

**What we publish**

apps/docs/content/errors.mdx:6-12 — "When a request fails, Nomba One returns a machine-readable `code` … Every entry below is generated straight from the API's error registry, so this page can never omit or invent a code." packages/errors/src/codes.ts:110-111 defines `WEBHOOK_ENDPOINT_NOT_FOUND` and `WEBHOOK_EVENT_NOT_FOUND` with hints ("No webhook endpoint matches that id. List your endpoints to find the correct id…", codes.ts:515-521), and apps/api/src/shared/openapi/build.ts:190 advertises `code: { type: 'string', enum: PUBLIC_ERROR_CODES_LIST }`.

**What the code does**

`WEBHOOK_ENDPOINT_NOT_FOUND`, `WEBHOOK_EVENT_NOT_FOUND` and `WEBHOOK_RAW_BODY_MISSING` are NOT members of `PUBLIC_ERROR_CODES` (packages/errors/src/codes.ts:260-333 — the set jumps from `WEBHOOK_SIGNATURE_INVALID` straight to `CUSTOMER_NOT_FOUND`). They ARE thrown on public routes: packages/sara/src/webhooks/endpoints.ts:84-88 `throw AppError.NotFound('Webhook endpoint not found', { reference }, NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND)` — reached from `getWebhookEndpoint`, which backs GET/PATCH/DELETE `/webhooks/:id`, `/webhooks/:id/rotate-secret` and all three delivery routes (apps/api/src/apps/main/modules/webhooks/routes.ts:28-40). apps/api/src/shared/http/error-handler.ts:40 `const publicCode = toPublicErrorCode(internalCode);` collapses it, and lines 55-58 then force `message: publicCode === NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR ? 'Internal server error' : …`. I executed the collapse: WEBHOOK_ENDPOINT_NOT_FOUND -> wire code SYSTEM_INTERNAL_ERROR, message forced to "Internal server error".

**Impact.** A developer who GETs `/v1/webhooks/wh_typo` gets HTTP 404 whose body says `code: "SYSTEM_INTERNAL_ERROR"`, `message: "Internal server error"`, `hint: "Something failed on our side. Retry shortly; if it persists, contact support with the requestId"` and `docUrl: …/errors#SYSTEM_INTERNAL_ERROR`. Their own typo is reported as a platform outage that tells them to open a support ticket. It is unbranchable (the code is the generic fallback), the hint is actively wrong, and `/errors` has no WEBHOOK_ENDPOINT_NOT_FOUND entry to land on. Blast radius: all 7 public webhook routes plus the inbound webhook raw-body guard (apps/api/src/apps/webhook/server/routes.ts:54).

**Fix.** Add the three codes to `PUBLIC_ERROR_CODES` in packages/errors/src/codes.ts — insert after line 278 (`NOMBAONE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,`):
  NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.WEBHOOK_EVENT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.WEBHOOK_RAW_BODY_MISSING,
They already have hints + docUrls in ERROR_CODE_META (codes.ts:515-522), so `/errors` and all nine SDK code lists pick them up automatically once they are public. Then add a unit test asserting `PUBLIC_ERROR_CODES` is a superset of every code passed to an `AppError` constructor under apps/api/src and packages/sara/src.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/errors/src/codes.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: WEBHOOK_ENDPOINT_NOT_FOUND, WEBHOOK_EVENT_NOT_FOUND and WEBHOOK_RAW_BODY_MISSING are missing from PUBLIC_ERROR_CODES (packages/errors/src/codes.ts:260-333), so apps/api/src/shared/http/error-handler.ts:40 collapses them to SYSTEM_INTERNAL_ERROR and lines 55-58 replace the message with "Internal server error" plus the generic contact-support hint and a .../errors#SYSTEM_INTERNAL_ERROR docUrl.
> 
> Scope is narrower than the finding states:
> - Developer-facing impact is WEBHOOK_ENDPOINT_NOT_FOUND only, on the 7 :id-scoped routes (GET/PATCH/DELETE /v1/webhooks/:id, POST /v1/webhooks/:id/rotate-secret, and the three delivery routes). POST /v1/webhooks and GET /v1/webhooks (list) nev
> 
> *…trimmed (1265 more chars — see the cited files).*
> The core defect is real and production-reachable, but two of the three cited codes inflate the blast radius, and the severity should be `high`, not `critical`.
> 
> Accurate version: `WEBHOOK_ENDPOINT_NOT_FOUND` is missing from `PUBLIC_ERROR_CODES` (packages/errors/src/codes.ts:260-333) and is thrown on three live code paths (packages/sara/src/webhooks/endpoints.ts:87, endpoints.ts:199, packages/sara/src/webhooks/deliveries.ts:116) backing all 7 public webhook routes, which are mounted unconditionally at apps/api/src/apps/main/server/routes.ts:43 behind ordinary apiKeyAuth. Any integrator passing a stale, deleted, or wrong-mode endpoint id receives HTTP 404 with code `SYSTEM_INTERNAL_ERROR`, mes
> 
> *…trimmed (1341 more chars — see the cited files).*

---

## X4. 🔴 The documented webhook scheme is UNIMPLEMENTABLE server-side today — the server has no plaintext secret to key on, so 'just fix the server' silently requires a production migration

**What we publish**

Multiple findings say: pick one scheme; the cheapest fix is to change the SERVER to emit the documented `t=<unix>,v1=<hex>` header, HMAC'd over `${t}.${rawBody}` keyed on the plaintext `whsec`, because then all nine SDKs and all docs are already correct and no SDK release is needed.

**What the code does**

packages/sara/src/webhooks/endpoints.ts:20-29 and :57 — the plaintext secret 'escapes exactly here, once' and only `sha256Hex(signingSecret)` is persisted (`signingSecretHash`). packages/sara/src/webhooks/deliver.ts:113 — `signWebhookPayload(endpoint.signingSecretHash, rawBody)`. There is NO column holding the plaintext (or a reversible ciphertext) of a webhook signing secret. Therefore the server CANNOT key an HMAC on the plaintext for any existing endpoint. There is also no timestamp anywhere in the delivery path to put in `t=`.

**Impact.** Whoever picks up 'fix the server, it's cheaper' will discover mid-change that the documented scheme needs a new `signing_secret_ciphertext` column → a drizzle migration against the ONE Neon DB that is SHARED WITH PRODUCTION (a production write), plus a backfill that is impossible for already-created endpoints (the plaintext is gone). They will then either half-ship (t=/v1= framing but keyed on the hash — still failing all nine SDKs, which key on plaintext) or stall.

**Fix.** Decide explicitly between the only two coherent paths, and do it FIRST — every other webhook finding (docs pages, WebhookVerifier widget, l10n mirrors, llms.txt, SDK READMEs, golden vectors, six SUMMARY.md files) is downstream of this decision and must not be touched until it lands.

PATH A (server changes, no SDK release): add an encrypted `signing_secret_ciphertext` column (packages/sara/src/crypto's encryptPii already exists and is used by the console bridge), migrate core-db, sign `${t}.${rawBody}` with the decrypted plaintext, add the `t` to the header. Cost: a PRODUCTION migration + existing endpoints have no plaintext, so they MUST be force-rotated (POST /v1/webhooks/{id}/rotate-secret) or kept on a legacy signing path — plan the dual-path window before you migrate. Docs/SDKs then become true with zero republishing.

PATH B (SDK changes, no migration): keep the server's bare-hex-o

*…trimmed (944 more chars — see the cited files).*

**Files.** `packages/sara/src/webhooks/sign.ts`, `packages/sara/src/webhooks/deliver.ts`, `packages/sara/src/webhooks/endpoints.ts`, `packages/core-db/src/schema/webhook-endpoints.ts`, `apps/docs/content/webhooks/signing-and-verification.mdx`, `apps/docs/src/components/mdx/webhook-verifier.tsx`

---

## X5. 🔴 `commsEnabled` is shipped in the console as "Send dunning emails and pay-link nudges" and stamps `comms_sent_at` — the platform has no mailer, no SMS, and sends the customer nothing, ever

**What we publish**

apps/console/src/components/console/settings/billing-settings-form.tsx:194 — `<Row label="Customer communications" desc="Send dunning emails and pay-link nudges.">` with a live toggle a merchant can switch on. apps/docs/content/merchants/set-up-dunning-messages.mdx:19-20 — "It **messages the customer** to top up or re-confirm, with a link to fix it." :36-38 — "**What you control** — **The message.** What the customer receives when a payment fails and when a card needs re-confirming, your tone, your brand." :40-44 — "When that happens, Nomba One sends them a fresh link to confirm." merchants/overview.mdx:37-38 — "If a payment fails, Nomba One retries and messages the customer. You don't have to chase it."

**What the code does**

No component of the monorepo can send an email or an SMS. `grep -rniE "resend|sendgrid|nodemailer|postmark|twilio|termii|mailgun|sms" apps/api/package.json packages/*/package.json apps/console/package.json` → ZERO hits. `grep -rniE "sendEmail|sendMail|sendSms" apps/api/src packages/sara/src` → ZERO hits. `commsEnabled`'s ONLY effect (apps/api/src/shared/services/dunning/attempt.ts:113,134-135,160) is to write `commsSentAt: commsEnabled ? now : null` and `commsEventType` onto the dunning_attempts row and to emit a `payment_method.expiring` WEBHOOK to the merchant's own endpoint. The `checkoutLink` minted by apps/api/src/shared/services/billing/actionLink.ts is only ever put in the `invoice.action_required` event payload — the merchant must deliver it. There is also no message template anywhere: BillingSettingsResponseData (packages/core-contracts/src/types/billing-settings.ts:1-16) is a boolean plus retry numbers; there is no subject, body, sender, or brand field in the schema, the console form, or the DB (packages/core-db/migrations/0009_yielding_maximus.sql:34 adds only `comms_enabl

*…trimmed (133 more chars — see the cited files).*

**Impact.** A merchant switches "Customer communications" ON, reads the docs saying Nomba One will message their failing customers with a fix-it link, and stops chasing. Nobody is ever messaged. Every dunning cycle silently fails to reach the customer, `comms_sent_at` is populated in the database recording a message that was never sent (so even internal analytics will report comms as delivered), and involuntary churn is 100% unrecovered. This is a money-losing false promise on both the product surface and the merchant docs, and no auditor examined either the console settings form or the /merchants track.

**Fix.** Two parts. (1) Product: either wire a real comms provider behind `commsEnabled` (and stop writing `comms_sent_at` when nothing was sent), or rename the console row to what it does — e.g. "Emit customer-communication webhooks (payment_method.expiring / invoice.action_required) — YOU send the message" — and add a Callout in the console settings page saying Nomba One does not contact customers directly. (2) Docs: rewrite apps/docs/content/merchants/set-up-dunning-messages.mdx to state that Nomba One emits events carrying a fresh checkout link and the merchant delivers the message; delete the "The message… your tone, your brand" and "cancel, or leave it paused" controls, which do not exist; fix merchants/overview.mdx:37-38.

**Files.** `apps/console/src/components/console/settings/billing-settings-form.tsx`, `apps/api/src/shared/services/dunning/attempt.ts`, `apps/docs/content/merchants/set-up-dunning-messages.mdx`, `apps/docs/content/merchants/overview.mdx`, `packages/core-contracts/src/types/billing-settings.ts`

---

## X6. 🟠 All nine SDK-vendored `spec/openapi.json` are stale: none knows about embedded plan prices, and five still ship the pre-rename "test mode" server + are missing API_KEY_HOST_MISMATCH from the error enum

**What we publish**

The nine vendored specs are supposed to be the same artifact but hash to FOUR distinct values. Concretely: `nombaone-go/spec/openapi.json:11` — `"description": "test mode (test-environment API keys)"` (identical in dotnet, php, ruby, rust), and `grep -c API_KEY_HOST_MISMATCH nombaone-go/spec/openapi.json` → `0`. In all nine, `POST /v1/plans` requestBody properties are `['name','description','metadata']` and there is no `PlanWithPrices` schema.

**What the code does**

The committed source spec `apps/docs/src/generated/openapi.json` (also in HEAD) has `"prices"` on the POST /v1/plans body (line 329) with it listed in `required`-adjacent structure (line 346), a `PlanWithPrices` response schema, and `"API_KEY_HOST_MISMATCH"` in the ApiError code enum (line 82). The server backs all three: `packages/core-contracts/src/validations/plan.ts:59-64` (`prices: z.array(createPriceBody).min(1).max(MAX_EMBEDDED_PRICES)…optional()`) and `apps/api/src/shared/middlewares/api-key.ts:124-129` (throws `API_KEY_HOST_MISMATCH`). The 'test mode / test-environment' wording is a leftover from the completed test→sandbox rename; the API is `sandbox`/`live` (`packages/sara/src/api-keys/keys.ts:36-39`).

**Impact.** (1) A developer who generates types/clients from an SDK repo's vendored spec cannot create a plan with its prices in one call — the flagship one-intent-one-call feature is invisible, and their generated model will strip `prices`. (2) In the go/dotnet/php/ruby/rust specs, a real 401 the server emits (`API_KEY_HOST_MISMATCH` — sandbox key sent to the live host) is not in the published error enum, so exhaustive switch/enum handling generated from the spec crashes or falls through on it. (3) The 'test mode (test-environment API keys)' server description contradicts the shipped sandbox/live vocabulary in the same repo's own README.

**Fix.** Make the vendored spec a build artifact, not a hand-copied file: add a `sync-spec` step to each SDK repo that copies `nombaone-turbo/apps/docs/src/generated/openapi.json` verbatim into `nombaone-<id>/spec/openapi.json`, and a CI check that fails on drift. Immediately: overwrite all nine `nombaone-*/spec/openapi.json` with the current generated spec (after fixing the `servers` and `pagination` defects above, so the copy is worth having).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-go/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-ruby/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-rust/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-elixir/spec/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The factual core is correct and should stand: all nine vendored specs lack embedded plan prices and PlanWithPrices; five (go, dotnet, php, ruby, rust) additionally ship the pre-rename localhost "test mode (test-environment API keys)" server and omit API_KEY_HOST_MISMATCH; the source spec and the server both support all three. Corrections:
> 
> 1. SCOPE: these files are in SIBLING repos (/Users/mac/Vault/the-60/nombaone/nombaone-*), not inside nombaone-turbo. The canonical developer-facing spec that the docs site publishes (apps/docs/src/generated/openapi.json) is CORRECT and up to date — only the cloned SDK repos are stale.
> 
> 2. IMPACT (2) IS OVERSTATED. The SDKs are hand-written, not generated f
> 
> *…trimmed (1185 more chars — see the cited files).*
> Accurate version: the nine vendored `spec/openapi.json` copies have drifted into 4 distinct artifacts and lag the committed source spec (missing embedded plan `prices`/`PlanWithPrices`; 5 of 9 also missing `API_KEY_HOST_MISMATCH` and still carrying pre-rename "test mode" server text). Reachability is real but indirect: these are published public repos, yet the vendored spec's only mechanical consumer is a route-level conformance test that cannot detect body/enum drift, and integrators consume the hand-written SDK or the (correct) docs/API spec rather than the vendored file. The unknown-error-code "crash" impact is refuted — Rust maps unknown codes to `ApiErrorKind::Other` and Go's `ErrorCode
> 
> *…trimmed (260 more chars — see the cited files).*

---

## X7. 🟠 Docs promise a zero-downtime secret rotation grace window; the code overwrites the secret in a single UPDATE with no dual-secret period

**What we publish**

apps/docs/content/webhooks/signing-and-verification.mdx:87-90:
```
<Callout type="tip" title="Rotate without downtime">
  `POST /v1/webhooks/{id}/rotate-secret` issues a new secret while briefly
  honoring the old one, so you can roll it without dropping in-flight deliveries.
</Callout>
```
The SDKs encode the same belief: nombaone-node/src/webhooks.ts:37 — "// Multiple `v1` entries are legal during secret rotation — any match passes."

**What the code does**

packages/sara/src/webhooks/endpoints.ts:128-147 `rotateWebhookSecret` performs one `db.update(...).set({ signingSecretHash: sha256Hex(signingSecret), signingSecretPrefix })` — the old hash is destroyed immediately. The table has exactly ONE secret column: packages/core-db/src/schema/webhook-endpoints.ts:19 `signingSecretHash: text('signing_secret_hash').notNull()` — there is no `previousSigningSecretHash`, no `rotatedAt`, no grace-period column. packages/sara/src/webhooks/deliver.ts:113 signs with the single current value: `signWebhookPayload(endpoint.signingSecretHash, rawBody)`. endpoints.ts:126-127 says so plainly: "In-flight deliveries re-sign with the new key on their next drain." The server also only ever sends ONE signature (deliver.ts:206), so the SDK's multi-`v1` rotation path can never trigger.

**Impact.** A live integrator follows the documented "rotate without downtime" flow: call rotate-secret, then deploy the new secret to their handler a few minutes later. In that window the old secret is already dead, so every delivery fails verification, their handler returns 4xx, and nombaone retries and then dead-letters. On a billing API that means missed `invoice.paid` / `invoice.payment_failed` during a routine credential rotation — exactly the operation the callout tells them is safe.

**Fix.** Either (a) fix the docs: replace apps/docs/content/webhooks/signing-and-verification.mdx:87-90 with an honest warning — rotation is immediate and single-secret; deploy the new secret to your handler BEFORE calling rotate-secret, or accept failed deliveries in the gap (they will be retried, so re-verify with the new secret once deployed); or (b) implement the promised behavior: add a `previous_signing_secret_hash` + `rotated_at` column, have deliver.ts emit both signatures until the window expires, and keep the docs as-is. Do not ship (a) and (b) disagreeing.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/signing-and-verification.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/webhooks/endpoints.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/core-db/src/schema/webhook-endpoints.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: this is a DOCUMENTATION defect, not a code/product bug. rotateWebhookSecret is an immediate-cutover rotation by design (endpoints.ts:126-127 states it plainly), and the docs callout at signing-and-verification.mdx:87-90 (plus its ha/yo localizations) falsely claims the old secret is "briefly honored". No dual-secret column, no grace period, and only one signature header is ever sent — so the mechanism claim is false. However, the outcome claim ("without dropping in-flight deliveries") is effectively satisfied by the retry ladder: deliver.ts re-signs with the current secret on every attempt, retrying 6 times across ~10s/1m/5m/30m/2h (~2h36m total), so an integrator who deplo
> 
> *…trimmed (902 more chars — see the cited files).*
> The impact narrative overstates the failure mode: deliveries do not dead-letter immediately. packages/sara/src/webhooks/deliver.ts:45,55 sets MAX_ATTEMPTS = 6 with a [10s, 60s, 5m, 30m, 2h] backoff ladder — roughly a 2h50m window before the row is parked as `dead`. An integrator who deploys the new secret within ~3h of rotating gets their deliveries DELAYED (and then successfully re-delivered), not lost. Permanent dead-lettering of invoice.paid / invoice.payment_failed requires a deploy window longer than ~3h (rotate-then-ticket-a-deploy, Friday rotation, CI queue), which is plausible but is not the default outcome. Accurate impact: a self-inflicted webhook outage window with 4xx/alarm noise
> 
> *…trimmed (538 more chars — see the cited files).*

---

## X8. 🟠 Docs' 422 sample shows `fields` as a map of strings; the API and the OpenAPI spec both emit a map of string ARRAYS

**What we publish**

apps/docs/content/reference/examples.mdx:103 — `"fields": { "amount": "Expected a positive integer (kobo)." }` (the value is a bare string).

**What the code does**

`ApiFieldErrors` is `Record<string, string[]>` (packages/errors/src/codes.ts:1: `export type ApiFieldErrors = Record<string, string[]>;`). The validator builds arrays — apps/api/src/shared/http/validate.ts:17-24: `const fields: ApiFieldErrors = {}; for (const issue of error.issues) { const key = issue.path.join('.') || '_root'; (fields[key] ??= []).push(issue.message); }` — and its own doc-comment at validate.ts:29 says it "Emits a structured `fields[]` map on failure, never a flat string." The OpenAPI document agrees: apps/api/src/shared/openapi/build.ts:194 `fields: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } }`. So the real wire value is `"fields": { "amountInKobo": ["Expected a positive integer (kobo)."] }`.

**Impact.** A developer who codes to the sample — `const msg = err.fields.amount` and renders it, or in a typed SDK `err.fields.amount[0]` expecting the whole message — gets either `[object Array]`/`"Expected…",` semantics wrong, or (if they wrote `.charAt(0)`-style string handling against the documented shape) the letter `E`. Every generated SDK types this field as `string[]` from the OpenAPI doc, so the sample directly contradicts the type the SDK hands them, costing real debugging time on their first validation failure.

**Fix.** apps/docs/content/reference/examples.mdx:103 — change to `"fields": { "amountInKobo": ["Expected a positive integer (kobo)."] }` (array value; and note the real field name is `amountInKobo`, not `amount` — POST /v1/examples rejects `amount`).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/reference/examples.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct but mis-severitised and under-scoped. ACCURATE VERSION: `apps/docs/content/reference/examples.mdx` contains a 422 sample that drifts from the real wire body in FOUR ways, of which the `fields` shape is one: (1) line 103 types `fields` values as bare strings, but the API emits `Record<string, string[]>` (validate.ts:17-24 -> error-handler.ts:61, verbatim JSON) and OpenAPI declares `array of string` (build.ts:194); (2) the request/response field is documented as `amount` (lines 39, 54, 64, 86, 143) but the enforced contract field is `amountInKobo` (packages/core-contracts/src/validations/example.ts:7) — a request copied from the docs would itself 422; (3) the e
> 
> *…trimmed (1055 more chars — see the cited files).*
> Accurate version: a stale snippet on the demo/teaching endpoint page (reference/examples.mdx:103) shows `fields` as string-valued and also omits the required `hint`/`docUrl` keys. The canonical error-handling docs (all nine SDK pages, e.g. sdks/node.mdx:168) already show the correct `Record<string, string[]>` shape, as do the OpenAPI doc and the runtime. Fix: `"fields": { "amount": ["Expected a positive integer (kobo)."] }` plus the missing hint/docUrl. Cost of the bug to an integrator is minutes of confusion on a page they are told is a deletable template, not a broken integration.

---

## X9. 🟠 Docs' own 422 sample uses an invented code `VALIDATION_FAILED` that the docs' own ErrorExplorer cannot resolve

**What we publish**

apps/docs/content/reference/examples.mdx:98-106 — `<Response status={422} label="Validation failed">` shows:
```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "amount must be a positive integer.",
```

**What the code does**

`VALIDATION_FAILED` does not exist. packages/errors/src/codes.ts:63 defines `CLIENT_VALIDATION_FAILED: 'CLIENT_VALIDATION_FAILED'`, and that is what apps/api/src/shared/http/validate.ts emits on a 422 (`AppError` + `NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED`, imported at validate.ts:3). I re-ran `extractCode()` from apps/docs/src/components/mdx/error-explorer.tsx:28-35 against this exact sample: it returns `null` — because `META['VALIDATION_FAILED']` is undefined and no other token in the sample is a real code. So pasting the docs' own printed sample into the docs' own Error explorer yields "code not recognized".

**Impact.** A developer writing `if (err.code === 'VALIDATION_FAILED')` — copied straight from the reference page — has a branch that can never fire; every validation failure falls through to their generic handler. `/errors#VALIDATION_FAILED` has no anchor (ErrorReference only emits `id={code}` for members of PUBLIC_ERROR_CODES, error-reference.tsx:62 + :92), so the link dead-ends at the top of the page. And the page's flagship interactive widget visibly fails on the page's own sample.

**Fix.** apps/docs/content/reference/examples.mdx:101 — change `"code": "VALIDATION_FAILED",` to `"code": "CLIENT_VALIDATION_FAILED",`. Then extend apps/docs/scripts/check-links.ts (or a new check) to assert that every `"code": "X"` string literal appearing in a fenced json block under apps/docs/content is a member of `PUBLIC_ERROR_CODES` — this class of typo is otherwise compiler-invisible.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/reference/examples.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/scripts/check-links.ts`

> **Refuter's correction — re-scopes this finding:**
> The invented code is real and confirmed: apps/docs/content/reference/examples.mdx:101 prints `"code": "VALIDATION_FAILED"`, while the API emits `CLIENT_VALIDATION_FAILED` (packages/errors/src/codes.ts:63; apps/api/src/shared/http/validate.ts:42-47; 422 default at codes.ts:242-243). It is the only occurrence in all of apps/docs/content, no CI gate catches it, and /errors#VALIDATION_FAILED has no anchor (error-reference.tsx:62,:92 only emit id for PUBLIC_ERROR_CODES). But the ErrorExplorer widget is NOT on examples.mdx — it is mounted only on apps/docs/content/errors.mdx:21, so the widget does not visibly fail on its own page; the failure only surfaces if a reader pastes the reference page's s
> 
> *…trimmed (715 more chars — see the cited files).*
> The invented code is real and reachable: examples.mdx:101 ships publicly and is the ONLY hand-written 422 sample in the entire docs corpus (zero MDX hits for the true code, CLIENT_VALIDATION_FAILED — it reaches readers only through the generated <ErrorReference />). The copy-paste dead-branch harm stands. But two parts of the claim are overstated: (a) <ErrorExplorer /> is mounted only on errors.mdx:21, not on examples.mdx, so the widget does NOT "visibly fail on the page's own sample" — and pasting a REAL 422 (which carries CLIENT_VALIDATION_FAILED) resolves fine, so explorer harm is ~nil; (b) the page is the explicitly disposable teaching slice for POST /v1/examples, touches no money/auth/b
> 
> *…trimmed (504 more chars — see the cited files).*

---

## X10. 🟠 Retry docs name the wrong terminal status (`failed`, which actually means "still retrying") and omit automatic dead-letter replay, which quadruples the real attempt count

**What we publish**

apps/docs/content/webhooks/retries-and-replay.mdx:26-28: "A delivery that keeps failing past the retry schedule is **marked failed and stops retrying**. It does not retry forever. You can always see where a delivery stands and re-drive it yourself." The word `dead` appears nowhere in apps/docs/content/webhooks/*, and automatic replay is never mentioned — replay is presented as manual-only (retries-and-replay.mdx:44-59).

**What the code does**

Two separate mismatches.
(1) TERMINAL STATUS. packages/sara/src/webhooks/deliver.ts:137-140: `status: exhausted ? 'dead' : 'failed'` where `exhausted = attempts >= MAX_ATTEMPTS` (deliver.ts:136). So `failed` is the STILL-RETRYING state (it carries a future `nextAttemptAt`, deliver.ts:142) and `dead` is terminal. The four real values are `'pending' | 'succeeded' | 'failed' | 'dead'` (packages/core-contracts/src/types/webhook.ts:13), and every SDK exposes `dead` (nombaone-go/webhookendpoints.go:50, nombaone-java/.../WebhookDeliveryStatus.java:11, nombaone-node/src/resources/webhook-endpoints.ts:39).
(2) AUTOMATIC REPLAY. packages/sara/src/webhooks/deliveries.ts:171-205 `autoReplayDeadLetters` re-arms `dead` rows (`status: 'pending', attempts: 0`) while `replayCount <= AUTO_REPLAY_CEILING - 1` (deliveries.ts:22, ceiling = 3). It is wired into a cron: apps/api/src/services/worker/modules/cron/jobs-handlers/webhook-maintenance.ts:16 `const replayed = await autoReplayDeadLetters(db, ...)`. With `MAX_ATTEMPTS = 6` (deliver.ts:47), a permanently-broken endpoint receives 6 + 3×6 = **24** POST

*…trimmed (30 more chars — see the cited files).*

**Impact.** (a) A developer building the dead-letter view the docs point them at filters `GET /v1/webhooks/{id}/deliveries?status=failed` (the filter exists — packages/sara/src/webhooks/deliveries.ts:53) and gets deliveries that are still in-flight while missing every genuinely-dead one, which live under `status=dead`. Their alerting is silently inverted. (b) A handler that 500s gets hammered 24 times per event, and rows they saw as `dead` flip back to `pending` on their own — a non-monotonic dashboard with no documented explanation.

**Fix.** apps/docs/content/webhooks/retries-and-replay.mdx:26-28 — replace with: "After 6 failed attempts a delivery is parked in the terminal `dead` status (`failed` means it is still being retried on backoff; the four statuses are `pending`, `succeeded`, `failed`, `dead`). Filter the dead-letter queue with `?status=dead`. Dead deliveries are additionally auto-replayed by the platform up to 3 more times before they are left alone for good." Also document the backoff schedule from deliver.ts:59 (10s, 1m, 5m, 30m, 2h) and the 10s per-request timeout (deliver.ts:49).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/retries-and-replay.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct; two of its supporting details are wrong and its impact is somewhat overstated.
> 
> ACCURATE VERSION: The prose at apps/docs/content/webhooks/retries-and-replay.mdx:26-28 ("marked failed and stops retrying") is wrong on both halves. (a) The terminal status is `dead`, not `failed` — packages/sara/src/webhooks/deliver.ts:138 sets `status: exhausted ? 'dead' : 'failed'`, and `failed` rows carry a future `nextAttemptAt` (deliver.ts:142) and are re-selected by the drain (deliver.ts:85), i.e. `failed` IS the still-retrying state. (b) A dead delivery does NOT stop retrying: `autoReplayDeadLetters` (packages/sara/src/webhooks/deliveries.ts:171-205) re-arms `dead` ro
> 
> *…trimmed (2105 more chars — see the cited files).*
> The finding is factually correct on both counts; only the severity should come down from high to medium. Accurate framing: `retries-and-replay.mdx:26-28` names the wrong terminal status — the real terminal value is `dead` (deliver.ts:137), while `failed` means "still retrying, has a future nextAttemptAt" — and the page omits `autoReplayDeadLetters` (deliveries.ts:171-205), which an ungated 15-minute cron (apps/api/src/services/cron/index.ts:42) uses to re-arm `dead` rows up to AUTO_REPLAY_CEILING=3 times, yielding up to 24 POSTs per event rather than the 6 implied. The consequence is a misbuilt dead-letter view (`?status=failed` returns in-flight deliveries and misses all dead ones) and a no
> 
> *…trimmed (374 more chars — see the cited files).*

---

## X11. 🟠 Ten separate findings all mutate the OpenAPI document — regenerate once, or you will re-vendor nine SDK repos ten times and redo the docs snippet fixes on a moving spec

**What we publish**

The list contains ~10 independent 'fix the spec' items: servers.url (localhost), pagination under meta, Idempotency-Key required on all mutating ops, missing RESPONSE_DATA_BY_ROUTE entries (13 ops incl. escrow/payout/refund/mandate-retrieve/webhook-delete/discount-deletes), wrong ref on subscriptions/payment-method, 201-vs-200, missing operationId/tags/description, adding WEBHOOK_*_NOT_FOUND to PUBLIC_ERROR_CODES, adding `.describe()` to fields, signingSecret on webhook create, and dropping /v1/examples.

**What the code does**

apps/api/src/shared/openapi/build.ts is the single generator; its output is committed at apps/docs/src/generated/openapi.json and vendored (verbatim, including `servers: http://localhost:8000/v1`) into all nine /Users/mac/Vault/the-60/nombaone/nombaone-*/spec/openapi.json — I confirmed nombaone-node/spec/openapi.json still carries the localhost server, still has /v1/examples, and still has POST /v1/plans body = [name, description, metadata] (no `prices`). The same generated file feeds apps/docs' API reference model, playground-allowlist.ts, the docs MCP route, check-openapi-honesty.ts, and the agent-native builders. apps/docs/src/lib/api-ref/samples.ts and snippets.ts derive every code sample FROM that file.

**Impact.** Fixing these one at a time means ten regenerations, ten re-vendors across nine external repos, and ten chances for the committed snapshot and the SDK copies to drift apart. Worse, the docs snippet-generator fixes (samples.ts money regex, enum ordering, exclusiveMinimum, format:uri, XOR bodies) are functions OF the spec — do them before the spec settles and you will redo them.

**Fix.** Batch ALL spec-affecting changes into one landing, in this order:

1. packages/errors/src/codes.ts (PUBLIC_ERROR_CODES additions AND removals — see the enum-narrowing item) — this drives the ApiError enum.
2. packages/core-contracts/src/validations/* (any `.describe()`, any enum widening, the `active` boolean parser, the mandate date validators). Do NOT rename any request field here (see the expectedAmount item).
3. apps/api/src/shared/openapi/responses.ts (the 13 missing route→schema mappings + the wrong Subscription ref on POST /v1/subscriptions/{id}/payment-method + a create-only WebhookEndpointWithSecret schema).
4. apps/api/src/shared/openapi/build.ts (servers, pagination, Idempotency-Key, per-op status codes, operationId/tags). On `servers`: change ONLY `servers: [{ url: baseUrl }]` (drop the `/v1` suffix at build.ts:161) and thread a real host in at BOTH call sites — apps/api/src/

*…trimmed (810 more chars — see the cited files).*

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/api/src/shared/openapi/responses.ts`, `apps/api/scripts/gen-openapi.ts`, `apps/docs/src/generated/openapi.json`

---

## X12. 🟠 The agent-native error reference (errors.md) contains ZERO error codes while llms.txt advertises it as containing every one

**What we publish**

apps/docs/public/llms.txt:105 — `- [Error reference](https://docs.nombaone.xyz/errors.md): Every error code, what triggers it, and exactly how to fix it.` And apps/docs/public/errors.md:14-16 repeats: "Every entry below is generated straight from the API's error registry, so this page can never omit or invent a code."

**What the code does**

apps/docs/public/errors.md is 25 lines long and contains not one of the 72 public codes. `<ErrorExplorer />` and `<ErrorReference />` (the entire body of apps/docs/content/errors.mdx:21-23) are both replaced by a single stub line — errors.md:25: `> **Interactive: \`<ErrorReference>\`.** View and run it live at https://docs.nombaone.xyz/errors`. That substitution is done by apps/docs/src/lib/md-mirror.ts:94: `out.push(\`> **Interactive: \\\`<${island[1]}>\\\`.** View and run it live at ${canonical}\`)`. Because the entire code table is rendered by a React server component, the .md mirror has nothing to mirror. I confirmed the file is COMMITTED (not gitignored), so this is what ships.

**Impact.** Nomba One's error philosophy is that `docUrl` delivers the fix with the failure, and the docs are explicitly agent-native (.md mirror + llms.txt + MCP). Any LLM agent, curl-based reader, or MCP client that follows llms.txt to `errors.md` — the single entry point advertised for "every error code and how to fix it" — receives a page with zero codes and zero hints. The promise in llms.txt:105 is false for the one page where it matters most.

**Fix.** In apps/docs/src/lib/md-mirror.ts, special-case `<ErrorReference>` (alongside the generic island stub at line 94): import `ERROR_CODE_META` + `PUBLIC_ERROR_CODES` from `@nombaone/errors` and emit a real markdown section per code — `### <CODE>` followed by its `hint` — so the .md mirror is generated from the same registry as the HTML page. Then regenerate apps/docs/public/errors.md. (`<ErrorExplorer>` is genuinely interactive and can keep the stub.)

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/md-mirror.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/public/errors.md`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: apps/docs/public/errors.md (the .md mirror of the errors page) contains none of the 72 public error codes — md-mirror.ts:92-97 collapses `<ErrorReference />` to a one-line "view it live" stub — yet the mirror's own body (errors.md:14-16) still claims "Every entry below is generated straight from the API's error registry", and llms.txt:105 describes that .md as containing "Every error code... and exactly how to fix it". Both statements are false FOR THAT FILE. They are NOT false for the agent-native surface as a whole: llms-full.txt (linked from llms.txt:4 as the full corpus) carries a generated `## Error codes` section with all 72 codes and hints (public/llms-full.txt:7288+
> 
> *…trimmed (431 more chars — see the cited files).*
> The finding is factually correct about the hollow file, but its impact claim ("Nomba One's error philosophy is that docUrl delivers the fix with the failure ... The promise is false for the one page where it matters most") is overstated. The API's docUrl points at the HTML page (DOCS_ERRORS_BASE = https://docs.nombaone.xyz/errors, codes.ts:343), which IS fully rendered from the registry with per-code anchors, and the docs MCP server's lookup_error tool resolves any code from that same registry. So error resolution works for humans, for API consumers following docUrl, and for MCP clients. The actual defect is confined to the plain-text agent-ingest surface (errors.md / llms.txt / llms-full.tx
> 
> *…trimmed (560 more chars — see the cited files).*

---

## X13. 🟠 The interactive `<WebhookVerifier />` seeds a fabricated event type (`payment.settled`) and a flat body, while its source comment claims it mirrors the server "byte-for-byte (the SSOT)"

**What we publish**

apps/docs/src/components/mdx/webhook-verifier.tsx:17-20 — "This mirrors `signWebhookPayload` / `verifyWebhookSignature` from `@nombaone/sara/webhooks` **byte-for-byte (the SSOT)**: the signed input is `${timestamp}.${rawBody}`, the algorithm is SHA-256, the encoding is hex, and the header is the Stripe-style `t=<unix>,v1=<hex>`." Its seed body, webhook-verifier.tsx:27:
`{"id":"nbo7h3k9q2x8m4evt","type":"payment.settled","createdAt":"2026-06-24T09:41:12.004Z","data":{"id":"nbo7h3k9q2x8m4npay","status":"settled","baseAmount":150000,"currency":"NGN"}}`
This component is rendered on two live pages: apps/docs/content/webhooks/signing-and-verification.mdx:85 and apps/docs/content/getting-started/verify-in-your-devtools.mdx:84.

**What the code does**

(a) `payment.settled` is not a type the platform can emit. packages/core-contracts/src/types/webhook-events.ts:14-110 is the frozen catalog; it has no `payment.*` entries at all (the settlement family is `settlement.created` / `settlement.refunded` / `settlement.payout_created`, lines 94-105). (b) The seed body is the flat shape, not the real one — no `event` object, a top-level `createdAt`, and a `data` carrying `id`/`baseAmount`/`currency` that no catalog payload declares (deliver.ts:177-184 + webhook-events.ts payload descriptors). (c) The "byte-for-byte / SSOT" claim is false on its own terms: packages/sara/src/webhooks/sign.ts:16-17 signs `rawBody` alone — `createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')` — with no timestamp prefix, and deliver.ts:206 sends a bare hex digest, not `t=…,v1=…`.

**Impact.** This is the one tool the docs offer a developer to build confidence before writing a handler ("watch the exact signature compute, the real recipe"). Its seed is a payload the API cannot produce, in a shape the API does not send, under a recipe the API does not use — and the source asserts it is the source of truth. A developer who reverse-engineers the contract from this widget (a stated goal of the page) writes a handler that fails on every real delivery, and searches the event catalog for `payment.settled` in vain.

**Fix.** apps/docs/src/components/mdx/webhook-verifier.tsx:27 — replace SEED_BODY with a real body for a real type, e.g. `{"id":"nbo493028471023whd","type":"invoice.paid","event":{"id":"nbo749201835566evt","type":"invoice.paid","createdAt":"2026-06-24T09:41:12.004Z"},"data":{"reference":"nbo749201835566inv"}}`. Then make the component actually mirror sign.ts: drop the timestamp input, HMAC the raw body alone, and compare against a bare hex `x-nombaone-signature` — or change sign.ts/deliver.ts to the Stripe scheme and keep the widget. Delete the "byte-for-byte (the SSOT)" claim at lines 17-20 until one of the two is true.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/webhook-verifier.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but under-scoped, and therefore under-rated. The widget is not the bug; it is the most self-incriminating instance of a docs-wide contract break. Accurate statement: the ENTIRE apps/docs webhook surface — overview.mdx:21 (`X-Nombaone-Signature: t=1719920092,v1=8f3c…` plus a flat body with no `event` envelope), signing-and-verification.mdx:14, guides/handle-webhooks.mdx:40, getting-started/verify-in-your-devtools.mdx:94,110, all six SDK pages, the yo/ha l10n mirrors, and the generated public/*.md — documents a Stripe-style `t=<unix>,v1=<hex>` header over a `${timestamp}.${rawBody}` signed input, while the shipped server (packages/sara/src/webhooks/sign.ts:18-19 + delive
> 
> *…trimmed (808 more chars — see the cited files).*
> The finding is true but under-stated and mis-scoped. It leads with the cosmetic part (the fabricated `payment.settled` seed and flat body — both real; `payment.settled` appears nowhere else in the repo and the catalog has no `payment.*` family) and buries the actual defect: the signature recipe divergence, which is DOCS-WIDE, not widget-scoped.
> 
> Server SSOT: packages/sara/src/webhooks/sign.ts:16-17 signs `rawBody` ALONE (`createHmac('sha256', secret).update(rawBody,'utf8').digest('hex')`), and deliver.ts:206 sends a bare hex digest in `x-nombaone-signature`. Envelope (deliver.ts:177-184) is `{id, type, event:{id,type,createdAt}, data}`.
> 
> The wrong `t=<unix>,v1=<hex>` / `HMAC(${t}.${rawBody})
> 
> *…trimmed (2128 more chars — see the cited files).*

---

## X14. 🟠 The l10n gate promises staleness "demotes" a translated page — no staleness detection exists anywhere, and the gate byte-enforces that every English code error is copied verbatim into both translations

**What we publish**

apps/docs/scripts/check-l10n.ts:10-16 — "Things an ENGLISH EDIT can make true — chiefly staleness — are warnings that DEMOTE the page, never failures. If someone edits an English paragraph on a Tuesday, the Yorùbá page quietly falls back to English; the site does not stop shipping. That asymmetry is the whole design." apps/docs/src/lib/l10n/config.ts:6 repeats it: "if a translation is missing, stale, or withdrawn, the route 308s to English."

**What the code does**

There is no staleness mechanism of any kind. `grep -rniE "stale|demote|sourceHash|source_hash|translatedAt" apps/docs/src apps/docs/scripts apps/docs/content apps/docs/l10n` returns only the two aspirational comments above and unrelated hits. check-l10n.ts's `main()` (lines 174-236) performs exactly four checks — never-translated scope, orphan (no English source), frontmatter title, orthography, and code-fence/heading parity — and emits no staleness warning. Translated pages carry no revision/hash frontmatter (apps/docs/l10n/yo/concepts/money-is-integer-kobo.mdx:1-4 is title+description only). apps/docs/src/lib/content.ts:190-245 renders the translation whenever the file exists, with no comparison against English. Worse, checkAgainstEnglish (check-l10n.ts:152-163) HARD-FAILS the build unless every code fence is byte-identical to English — so the wrong webhook scheme is guaranteed present in apps/docs/l10n/yo/webhooks/signing-and-verification.mdx:40 and l10n/ha/.../signing-and-verification.mdx:40, and there is no mechanism that un-propagates it when English is fixed.

**Impact.** The moment any English page is corrected — which is exactly what this audit's 191 findings will cause — the Yorùbá and Hausa versions keep serving the OLD, WRONG text as authoritative, indefinitely, with a green build. The one safeguard the design leans on ("stale → 308 to English") was never implemented. Every English fix in this report must be manually re-applied to two translations or it silently regresses for Yorùbá/Hausa readers, and nothing will tell anyone.

**Fix.** Add a `sourceHash` (sha256 of the English body) to each translated page's frontmatter, emit it from the drafter, and (a) fail check-l10n with a warning when it diverges, (b) actually implement the demotion: in apps/docs/src/lib/content.ts `getPage()`, if `locale !== en` and the stored hash ≠ the current English hash, return null so the route 308s to English as documented. Until then, delete the "demote"/"stale" claims from check-l10n.ts:10-16 and config.ts:6, and treat the 96 files under apps/docs/l10n/ as part of the blast radius of every docs fix in this report.

**Files.** `apps/docs/scripts/check-l10n.ts`, `apps/docs/src/lib/content.ts`, `apps/docs/src/lib/l10n/config.ts`

---

## X15. 🟠 The primary "Handle webhooks" guide reads the header `x-nomba-signature` — the server sends `x-nombaone-signature`

**What we publish**

apps/docs/content/guides/handle-webhooks.mdx:76-84, the copy-pasteable handler in the flagship webhook guide:
```ts
export async function POST(req: Request) {
  const raw = await req.text();
  verifyWebhook(raw, req.headers.get("x-nomba-signature")!, SECRET);
```

**What the code does**

packages/sara/src/webhooks/deliver.ts:206 — the header actually set on every outbound POST is `'x-nombaone-signature': signature`. `x-nomba-signature` is never sent by anything in the monorepo (grepped: apps/docs/content/guides/handle-webhooks.mdx:78 is the ONLY occurrence of `x-nomba-` anywhere in the repo). Every SDK and every SDK docs page uses the right one — e.g. apps/docs/content/sdks/node.mdx:194 `req.header('x-nombaone-signature')`, apps/docs/content/sdks/python.mdx:256 `request.headers.get("x-nombaone-signature", "")`, nombaone-go/webhook/webhook.go:11 `r.Header.Get("X-Nombaone-Signature")`.

**Impact.** `req.headers.get("x-nomba-signature")` returns `null` on every genuine delivery. The `!` non-null assertion silences TypeScript, so the handler ships, then `verifyWebhook` calls `parseHeader(null)` and throws a TypeError → the route 500s on every event. nombaone reads the non-2xx, retries 6 times (deliver.ts:47 `MAX_ATTEMPTS = 6`), and dead-letters the delivery. The developer sees 100% webhook failure with a stack trace that points at their own parser, not at the header name.

**Fix.** apps/docs/content/guides/handle-webhooks.mdx:78 — change `req.headers.get("x-nomba-signature")!` to `req.headers.get("x-nombaone-signature") ?? ""`.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/guides/handle-webhooks.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is real but understated on three counts. (1) `x-nomba-signature` appears in 5 files, not 1: apps/docs/content/guides/handle-webhooks.mdx:78, apps/docs/l10n/yo/guides/handle-webhooks.mdx:78, apps/docs/l10n/ha/guides/handle-webhooks.mdx:79, apps/docs/public/guides/handle-webhooks.md:80, and apps/docs/public/llms-full.txt:2409 (the LLM-ingestion mirror). (2) The wrong header name is the LESSER half of the defect: the same guide (lines 32-46) documents a Stripe-style `t=…,v1=…` header HMAC'd over `${t}.${rawBody}`, while packages/sara/src/webhooks/sign.ts:18 signs bare `HMAC-SHA256(secret, rawBody)` lowercase hex with no timestamp — so fixing only the header name still yields 100% ve
> 
> *…trimmed (774 more chars — see the cited files).*
> The finding is correct but incomplete on scope. `x-nomba-signature` appears in 5 published files, not 1: apps/docs/content/guides/handle-webhooks.mdx:78, apps/docs/public/guides/handle-webhooks.md:80, apps/docs/public/llms-full.txt:2409 (agent-ingested), apps/docs/l10n/yo/guides/handle-webhooks.mdx:78, apps/docs/l10n/ha/guides/handle-webhooks.mdx:79. All five need the fix, and the l10n/agent-native artifacts are regenerated, so fix the source + rerun the generators. The claimed impact ("developer sees 100% webhook failure") is accurate, but the severity framing overstates the diagnostic difficulty and omits that the failure surfaces in sandbox before any live money moves, that deliveries are
> 
> *…trimmed (379 more chars — see the cited files).*

---

## X16. 🟠 The refunds guide's worked partial-refund example is arithmetically impossible — the second call 422s, short by exactly the platform fee

**What we publish**

apps/docs/content/guides/refunds-payouts-settlement.mdx:35 — "Partial refunds accumulate: refund ₦1,000 of a ₦2,500 charge, then ₦1,500 later, and the settlement flips to fully `refunded`. You can never refund more than the net." (₦1,000 + ₦1,500 = ₦2,500, i.e. the example refunds the full GROSS.)

**What the code does**

Refunds are capped at the NET to the tenant, not the gross. apps/api/src/shared/services/settlement/split.ts:51 — `const tenantShare = input.grossKobo - input.platformFeeKobo;`. apps/api/src/shared/services/settlement/refund.ts:63,73 — `const remaining = settlement.netToTenantKobo - alreadyRefunded;` … `if (refundKobo > remaining) { throw AppError.UnprocessableEntity('refund exceeds the refundable tenant share', …, NOMBAONE_ERROR_CODES.REFUND_AMOUNT_EXCEEDS_NET); }`. I executed the real fee function (packages/sara/src/config/fees.ts:35-48, `DEFAULT_FEE_SCHEDULE = { rateBps: 150, min: 1000, max: 200_000 }`) against the doc's own figures: gross 250000 kobo → platformFee = round(250000 × 150 / 10000) = 3750 kobo (₦37.50) → netToTenant = 246250 kobo (₦2,462.50). Refund #1 (₦1,000 = 100000) passes, leaving remaining = 146250. Refund #2 (₦1,500 = 150000) > 146250 → throws, short by 3750 kobo (₦37.50). Max total refundable is ₦2,462.50, not the ₦2,500 the doc promises.

**Impact.** A developer following the guide's worked example verbatim gets a 422 `REFUND_AMOUNT_EXCEEDS_NET` on their second refund call and no fully-`refunded` settlement — with a confusing off-by-₦37.50 they must reverse-engineer the fee schedule to explain. The example also contradicts the Callout printed seven lines above it (line 28: "The platform fee is not refunded") and its own next sentence ("You can never refund more than the net") — so the page tells the reader the correct rule and then hands them a sample that violates it.

**Fix.** Rewrite apps/docs/content/guides/refunds-payouts-settlement.mdx:35 so the two partials sum to the NET, not the gross, and state the fee explicitly. Suggested: "Partial refunds accumulate against the **net**, not the gross. On a ₦2,500 charge the platform fee (1.50%, ₦37.50) is not refundable, so ₦2,462.50 is refundable: refund ₦1,000, then ₦1,462.50 later, and the settlement flips to fully `refunded`. Refunding more than the net is rejected with `REFUND_AMOUNT_EXCEEDS_NET`."

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/guides/refunds-payouts-settlement.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/public/guides/refunds-payouts-settlement.md`

> **Refuter's correction — re-scopes this finding:**
> The finding is technically CORRECT and reproducible, but its severity should be medium, not high, and it is slightly incomplete.
> 
> ACCURATE VERSION: apps/docs/content/guides/refunds-payouts-settlement.mdx contains TWO figures that treat the refundable ceiling as the GROSS when the code caps it at the NET (gross − non-refundable platform fee):
>   - line 35: "refund ₦1,000 of a ₦2,500 charge, then ₦1,500 later, and the settlement flips to fully `refunded`" — ₦1,000 + ₦1,500 = ₦2,500 = the full gross.
>   - line 25: the curl body `"amountInKobo": 250000` — also the gross.
> Under the shipped defaults (DEFAULT_FEE_SCHEDULE = 150 bps, min ₦10, max ₦2,000, reached because DEFAULT_BILLING_SETTINGS leaves
> 
> *…trimmed (1289 more chars — see the cited files).*
> The finding is factually correct and the example is genuinely unfollowable under the default fee schedule, but the severity is over-stated. Downgrade high -> medium. It is a documentation-only inaccuracy with a fail-safe failure mode: the API correctly rejects the over-refund (422 REFUND_AMOUNT_EXCEEDS_NET), no money moves incorrectly, no ledger is corrupted, nothing is exposed. The page also prints the correct rule twice adjacent to the bad example (the Callout at line 28 and the next sentence at line 36), so the reader is not actually misled about the RULE -- only handed a sample that violates it. Cost is developer confusion and a support ticket, not financial or security harm. Additionall
> 
> *…trimmed (389 more chars — see the cited files).*

---

## X17. 🟠 The ⌘K search index is English-only and its results push bare English URLs — the Yorùbá/Hausa docs ship a localized search box that ejects the reader out of the locale on every hit

**What we publish**

apps/docs/src/app/(yo)/layout.tsx and (ha)/layout.tsx render `<RootShell locale="yo">`, which mounts `<SearchProvider>` → `<SearchPalette />` (apps/docs/src/components/chrome/root-shell.tsx:93, search-provider.tsx:50). The palette calls `useL10n()` so its placeholder and empty-state are in Yorùbá — i.e. it presents itself as the locale's search. apps/docs/src/components/chrome/search-palette.tsx:38-44 even carries a comment about NFC-normalizing `ṣíṣe` so Yorùbá queries match.

**What the code does**

apps/docs/scripts/build-search-index.ts:21 sets `const CONTENT_DIR = path.join(process.cwd(), "content")` and its only walk is `listMdxFiles(CONTENT_DIR)` (line 66) — it never reads `l10n/`. So public/search-index.json contains ZERO Yorùbá or Hausa records. The palette fetches that one file (search-palette.tsx:46) and navigates with `router.push(doc.url)` (search-palette.tsx:107) — a raw English slug; `withLocale()` is never called. apps/docs/scripts/build-ask-index.ts has no locale handling either (grep for `locale`/`l10n` → 0 hits), so Ask-AI on a /yo page also answers only from the English corpus.

**Impact.** A Yorùbá reader types a Yorùbá word into a Yorùbá-labelled search box and gets nothing (their language is not in the index). If they type an English word, every result silently teleports them from /yo/... to the English page — even for the ~48 pages that ARE translated. The l10n subsystem's entire premise ("a translation is a cache of English, never a gate on it") is undermined at the one surface readers use most, and nobody audited it: the 191 findings mention l10n only as collateral for English errors.

**Fix.** apps/docs/scripts/build-search-index.ts: walk `l10n/<locale>/` as well and emit per-locale records (or emit `public/search-index.<locale>.json`); apps/docs/src/components/chrome/search-palette.tsx: fetch the index for `useL10n().locale` and route through `withLocale(doc.url, locale)` when the target slug is in the locale's coverage set (RootShell already computes `coverage` via `listTranslatedSlugs`), falling back to the English URL otherwise. Same treatment for apps/docs/scripts/build-ask-index.ts.

**Files.** `apps/docs/scripts/build-search-index.ts`, `apps/docs/src/components/chrome/search-palette.tsx`, `apps/docs/scripts/build-ask-index.ts`

---

## X18. 🟠 Webhook payloads break the `…InKobo` invariant: the SAME money field is `unitAmountInKobo` over REST but `unitAmount` over webhooks

**What we publish**

The invariant is asserted universally, with no webhook exemption. apps/docs/content/sdks/go.mdx:114 — "**Money is integer kobo.** `Kobo` is `int64`, ₦1.00 = `100`, money fields end in `InKobo`". apps/docs/content/sdks/python.mdx:108 — "every money field and param ends in `_in_kobo`". apps/docs/content/guides/create-plans-and-prices.mdx:74 — "Every money field ends in `InKobo`." The published, UNAUTHENTICATED event catalog itself declares the unsuffixed names: packages/core-contracts/src/types/webhook-events.ts:67-69 — `'invoice.payment_partially_collected': { when: '…', payload: ['reference', 'amountPaid', 'amountRemaining'] }`.

**What the code does**

Four live webhook payloads emit money fields with NO `InKobo` suffix, while the REST serializer for the very same resource uses the suffix. Webhook side: apps/api/src/shared/services/prices/create.ts:137 `unitAmount: row.unitAmount,` (also apps/api/src/shared/services/plans/create-with-prices.ts:106); apps/api/src/shared/services/invoices/markPaid.ts:115 `payload: { reference: invoice.reference, amountPaid: collected, amountRemaining },`; packages/sara/src/example/create.ts:119 `payload: { reference, amount: input.amount, kind: input.kind },`; packages/sara/src/example/confirm.ts:95 `amount: row.amount,`. REST side, same resources: apps/api/src/shared/services/prices/serialize.ts:14 `unitAmountInKobo: row.unitAmount,`; apps/api/src/shared/services/invoices/serialize.ts:33-34 `amountPaidInKobo: row.amountPaid,` / `amountRemainingInKobo: row.amountRemaining,`.

**Impact.** An integrator who writes a raw webhook handler against the documented rule ("every money field ends in InKobo") reads `payload.amountRemainingInKobo` and gets `undefined`. For `invoice.payment_partially_collected` that is a money decision: `undefined` coerces to 0/NaN, so the handler concludes nothing is outstanding and stops dunning / marks the customer current on a partially-paid invoice. Equally, a field named bare `amount`/`unitAmount` carries no unit marker at all — the suffix is the ONLY thing in this API that disambiguates kobo from naira, which is precisely the 100× hazard the convention exists to prevent. (SDK users are shielded: nombaone-go/webhook/events.go:118-119 and nombaone-no

*…trimmed (141 more chars — see the cited files).*

**Fix.** Rename the money keys in the emitted payloads to the suffixed form, matching the REST serializers: prices/create.ts:137 and plans/create-with-prices.ts:106 → `unitAmountInKobo: row.unitAmount,`; invoices/markPaid.ts:115 → `payload: { reference: invoice.reference, amountPaidInKobo: collected, amountRemainingInKobo: amountRemaining },`; sara/src/example/create.ts:119 → `amountInKobo: input.amount`; sara/src/example/confirm.ts:95 → `amountInKobo: row.amount`. Update the catalog declaration at packages/core-contracts/src/types/webhook-events.ts:67-69 to `payload: ['reference', 'amountPaidInKobo', 'amountRemainingInKobo']`, and add the (currently undeclared) money keys to the `price.created` (line 30) and `example.*` (lines 108-109) entries. Then update nombaone-go/webhook/events.go:118-119 (`AmountPaidInKobo`/`AmountRemainingInKobo` with matching json tags) and nombaone-node/src/webhook-even

*…trimmed (76 more chars — see the cited files).*

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/services/prices/create.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/services/plans/create-with-prices.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/services/invoices/markPaid.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/example/create.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/example/confirm.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/core-contracts/src/types/webhook-events.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/webhook/events.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/webhook-events.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the `InKobo` suffix convention is applied on REST serializers but omitted on webhook event payload keys — `price.created` sends `unitAmount` (prices/create.ts:137) and `invoice.payment_partially_collected` sends `amountPaid`/`amountRemaining` (invoices/markPaid.ts:115), both reaching the wire verbatim via sara/webhooks/deliver.ts:184. This is a naming-consistency defect, NOT a money-correctness defect: the values are kobo, no number is wrong, and the published event catalog (/webhooks/event-catalog, rendered from WEBHOOK_EVENT_CATALOG) lists the real unsuffixed keys, so no documented field ever returns undefined. The `example.*` citations (packages/sara/src/example/*) are t
> 
> *…trimmed (743 more chars — see the cited files).*
> The webhook payloads carry CORRECT kobo values under unsuffixed names — there is no unit/value bug and no 100x overcharge path. The defect is a naming-convention inconsistency between the REST serializer (…InKobo) and the webhook payload (bare), affecting three real emit sites (prices/create.ts:137, plans/create-with-prices.ts:106, invoices/markPaid.ts:115); the other two cited sites are the disposable `example.*` scaffold excluded from docs. The published event catalog (/webhooks/event-catalog, rendered from WEBHOOK_EVENT_CATALOG) already states the actual key names, so the "reads …InKobo and gets undefined" failure requires an integrator to ignore the canonical webhook doc. Real cost: a pu
> 
> *…trimmed (190 more chars — see the cited files).*

---

## X19. 🟠 `Idempotency-Key` is documented as required on 13 non-POST mutating ops where the middleware ignores the header completely — including the strict-idempotency money route DELETE /v1/customers/{id}/credit/{grantId}

**What we publish**

`apps/api/src/shared/openapi/build.ts:128-130` — `if (MUTATING.has(method)) { parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, ... }) }` where `MUTATING = new Set(['post','put','patch','delete'])` (`build.ts:22`). In the shipped spec this marks the header `required: true` on 13 non-POST ops: PUT /v1/organization, PUT /v1/organization/billing, PATCH /v1/{coupons,customers,plans,subscriptions,webhooks}/{id}, DELETE /v1/customers/{id}/credit/{grantId}, DELETE /v1/customers/{id}/discount, DELETE /v1/payment-methods/{id}, DELETE /v1/subscriptions/{id}/discount, DELETE /v1/subscriptions/{id}/schedule, DELETE /v1/webhooks/{id}. The routes themselves also declare idempotency middleware on them, e.g. `apps/api/src/apps/main/modules/customers/routes.ts:123-129` uses the STRICT `idempotency` on `DELETE /customers/:id/credit/:grantId`.

**What the code does**

`apps/api/src/shared/middlewares/idempotency.ts:51-55` — `// Only mutating POSTs participate.` / `if (req.method !== 'POST') { next(); return; }`. The header is never read, never enforced, and never deduped on PUT/PATCH/DELETE. So the strict `idempotency` guard on the money route (void a credit grant) is a complete no-op — no 400 when the key is absent, no replay cache when it is present — and every PATCH/DELETE claiming `required: true` accepts requests with no key at all.

**Impact.** Two harms. (1) A client generated from the spec, or a gateway that validates against it, will REJECT a perfectly valid `PATCH /v1/customers/{id}` that has no Idempotency-Key — a 'required' parameter the API does not want. (2) Worse, an integrator who reads 'Idempotency-Key: required' on `PATCH /v1/subscriptions/{id}` or `DELETE /v1/customers/{id}/credit/{grantId}` and retries after a timeout with the same key believes the retry is deduped. It is not: the request re-executes. The route authors clearly intended dedupe (they wired `idempotency`/`idempotencyOptional` onto these routes); the middleware silently drops it.

**Fix.** Two changes. (a) `apps/api/src/shared/middlewares/idempotency.ts:52`: widen participation to all mutating methods — `if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) { next(); return; }` (the store is already keyed on `hashRequest({path, body})`, so PATCH/DELETE dedupe correctly). (b) If instead POST-only is the intended contract, change `apps/api/src/shared/openapi/build.ts:22` to `const MUTATING = new Set(['post'])` so the spec stops advertising a header the server ignores. Do NOT leave both as they are.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/middlewares/idempotency.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/build.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the OpenAPI builder does mark `Idempotency-Key: required: true` on 13 non-POST ops (verified in the shipped snapshot) while `runIdempotency` short-circuits on any non-POST method, and the strict `idempotency` guard on DELETE /v1/customers/{id}/credit/{grantId} (the only non-POST route using it) is therefore a no-op — no 400 on a missing key, no replay cache, no 409 in_progress. But there is NO money-safety impact: `voidCreditGrant` (apps/api/src/shared/services/credits/void.ts:53-56) is idempotent by design — an already-voided grant is returned unchanged with no second ledger reversal — and all 13 ops are naturally idempotent (PATCH set-to-value / DELETE-by-id), so a retrie
> 
> *…trimmed (459 more chars — see the cited files).*
> The claim is factually right (13 ops, `required: true`, middleware ignores non-POST) but the impact story is wrong on its main point. Retrying a PATCH/PUT/DELETE with the same key does NOT re-execute anything harmful: `apps/api/src/shared/services/credits/void.ts:55-57` explicitly returns an already-voided grant unchanged with no second ledger reversal, and its state flip is a guarded `WHERE ... AND voided_at IS NULL` update; the PATCH/PUT ops are last-write-wins and the other DELETEs are naturally idempotent. So there is no double-move-of-money on sequential retry. The accurate harms are (a) the public, unauthenticated `/v1/openapi.json` and the committed `apps/docs/src/generated/openapi.js
> 
> *…trimmed (779 more chars — see the cited files).*

---

## X20. 🟡 /api/ask is an unauthenticated, unrate-limited public LLM proxy on the docs domain — nobody audited it

**What we publish**

apps/docs/content/agents.mdx:88-93 advertises the Ask-AI button on every page as a first-class feature. The 191 findings audit the playground proxy's missing rate limit but never mention /api/ask at all.

**What the code does**

apps/docs/src/app/api/ask/route.ts:46-108 — `export async function POST(req: Request)` accepts an arbitrary `messages[]` array from any caller, does no auth check, no origin check, no CAPTCHA, and no rate limiting (`grep -rniE "ratelimit|throttle" apps/docs/src/app/api` → ZERO hits across ask, feedback, mcp and playground), then calls `streamText({ model: groq(MODEL), system: …, messages, temperature: 0.2 })` against the deployment's `GROQ_API_KEY` (route.ts:74) with `maxDuration = 30`. The retrieved context is prepended but the caller-supplied `messages` are passed to the model verbatim, so the endpoint is a free, unmetered chat completion API keyed on the company's Groq account. /api/feedback (route.ts:23-51) is likewise unauthenticated and writes a row into the docs analytics DB on every POST with no rate limit.

**Impact.** Anyone can `curl -X POST https://docs.nombaone.xyz/api/ask -d '{"messages":[…]}'` in a loop and burn the Groq budget / exhaust the account's rate limit until the real Ask-AI button stops working for genuine readers, and can flood the docs feedback table at will. Same class as the playground gap, but a different route and a direct third-party billing exposure.

**Fix.** Put a per-IP token bucket (Upstash/@vercel/firewall, e.g. 10 req/min) and an Origin check restricting callers to https://docs.nombaone.xyz in front of both apps/docs/src/app/api/ask/route.ts and apps/docs/src/app/api/feedback/route.ts, and cap `messages.length` / total input characters before calling `streamText`.

**Files.** `apps/docs/src/app/api/ask/route.ts`, `apps/docs/src/app/api/feedback/route.ts`

---

## X21. 🟡 Docs state the signing secret is `whsec_…` on four pages; the server mints `nbo_whsec_…`

**What we publish**

Four separate docs pages: apps/docs/content/webhooks/overview.mdx:50 — "You get back a **signing secret** (`whsec_…`), shown once."; apps/docs/content/guides/handle-webhooks.mdx:26 — "The response returns a **signing secret** (`whsec_…`), shown once."; apps/docs/content/guides/going-live.mdx:44 — "store the new `whsec_…` secret"; apps/docs/content/getting-started/verify-in-your-devtools.mdx:37 — "The response includes the endpoint's **signing secret** (`whsec_…`), shown once." The docs' own interactive verifier seeds a third, invented form: apps/docs/src/components/mdx/webhook-verifier.tsx:28 — `const SEED_SECRET = "whsec_nbo_sandbox_demo_secret";`

**What the code does**

packages/sara/src/webhooks/endpoints.ts:38 — `const generateSigningSecret = (): string => \`nbo_whsec_${randomBytes(24).toString('hex')}\`;`. The prefix returned as `signingSecretPrefix` is the first 16 chars (endpoints.ts:36,49), i.e. `nbo_whsec_` + 6 hex. The SDK test vectors agree with the CODE, not the docs: nombaone-elixir/test/unit/webhooks_test.exs:7 `@secret "nbo_whsec_golden_…"`, nombaone-dotnet/test/NombaOne.Tests/Unit/WebhooksTests.cs:10 `GoldenSecret = "nbo_whsec_golden_…"`, nombaone-elixir/.env.example:13 "a webhook signing secret (nbo_whsec_…)".

**Impact.** Three concrete costs: (1) a developer who adds a secret-scanning / pre-commit rule or a Vault path pattern on `^whsec_` never matches a real nombaone secret; (2) a developer who validates the prefix before storing it rejects the real secret; (3) the docs contradict the SDK test fixtures and .env examples they ship alongside, so the first thing a careful integrator does — diff the doc against the SDK — surfaces a discrepancy in the security-critical value. Recoverable, but it costs trust on the one page where trust matters most.

**Fix.** Replace `whsec_…` with `nbo_whsec_…` at apps/docs/content/webhooks/overview.mdx:50, apps/docs/content/guides/handle-webhooks.mdx:26, apps/docs/content/guides/going-live.mdx:44, apps/docs/content/getting-started/verify-in-your-devtools.mdx:37. Change apps/docs/src/components/mdx/webhook-verifier.tsx:28 `SEED_SECRET` to a `nbo_whsec_`-prefixed hex string. Also fix nombaone-dotnet/examples/NombaOne.Examples/WebhookReceiver.cs:20 (`const string signingSecret = "whsec_example_0123456789abcdef";`).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/overview.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/guides/handle-webhooks.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/guides/going-live.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/getting-started/verify-in-your-devtools.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/webhook-verifier.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/examples/NombaOne.Examples/WebhookReceiver.cs`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but scoped too narrowly. The `whsec_` error is not on four pages — it is on four English content pages (webhooks/overview.mdx:50, guides/handle-webhooks.mdx:26, guides/going-live.mdx:44, getting-started/verify-in-your-devtools.mdx:37), PLUS the Hausa and Yoruba mirrors of those same pages under apps/docs/l10n/{ha,yo}/, PLUS the generated agent-facing outputs (apps/docs/public/*.md and apps/docs/public/llms-full.txt), PLUS webhooks/signing-and-verification.mdx:17 which names the HMAC key `whsec` in the formula, PLUS the invented third form in webhook-verifier.tsx:28/:102. The fix must sweep all of them, not four files. One qualifier on impact: no code path anywhere vali
> 
> *…trimmed (513 more chars — see the cited files).*
> The prefix mismatch is real and production-reachable, but it is a docs-accuracy/trust defect with no runtime consequence — the integrator copies the real `nbo_whsec_…` secret verbatim from the API response, and no code path (sara included) validates the prefix, so nothing breaks. Severity is low, not medium. Two corrections to the finding's scope: (1) the leak spans ~10 shipped files, not 4 — add the agent-native mirrors apps/docs/public/webhooks/overview.md:52, public/guides/going-live.md:47, public/guides/handle-webhooks.md:28, public/getting-started/verify-in-your-devtools.md:39 (these feed llms.txt/MCP, so agents are being taught the wrong prefix), plus the yo and ha localizations of the
> 
> *…trimmed (315 more chars — see the cited files).*

---

## X22. 🟡 Every error envelope printed in the docs omits `hint` and `docUrl` — the two fields the spec marks required and the errors page is built around

**What we publish**

apps/docs/content/errors.mdx:6-8 — "When a request fails, Nomba One returns a machine-readable `code`, a plain-English `hint`, and a `docUrl` that deep-links to the exact entry on this page." apps/api/src/shared/openapi/build.ts:188 — `required: ['code', 'message', 'hint', 'docUrl']`. packages/core-contracts/src/types/envelope.ts:40-43 annotates both `hint` and `docUrl` "Always present."

**What the code does**

Not one of the four error envelopes shown anywhere in the docs includes them. apps/docs/content/getting-started/authentication.mdx:54-64: `"error": { "code": "API_KEY_INVALID", "message": "Invalid or missing API key." }` — no hint, no docUrl. Same in apps/docs/content/reference/examples.mdx:98-106 (422) and :109-118 (401). Worst, the seeded sample inside the Error explorer itself — apps/docs/src/components/mdx/error-explorer.tsx:20-25, `const SAMPLE = '{ "success": false, "statusCode": 401, "error": { "code": "API_KEY_INVALID", "message": "Invalid or missing API key." }, … }'` — omits them too. The real handler always sets both: apps/api/src/shared/http/error-handler.ts:49-60 `const meta = errorMetaFor(publicCode); … hint: meta.hint, docUrl: meta.docUrl,`.

**Impact.** The docs' central differentiator ("errors are a feature — the fix arrives with the failure") is asserted in prose and then contradicted by every single example. A developer sizing their error type or writing a logger from the samples omits the two fields that carry the actionable content, and the docs never show them what a real hint/docUrl looks like. Anyone validating a real response against the printed sample also concludes the API is sending extra undocumented fields.

**Fix.** Add `"hint"` and `"docUrl"` to all four samples, using the true registry values. E.g. apps/docs/content/getting-started/authentication.mdx:58-61 becomes:
  "error": {
    "code": "API_KEY_INVALID",
    "message": "Invalid or missing API key.",
    "hint": "That key is not recognized. Copy it fresh from the dashboard (it may have been rotated or revoked) and send the whole `nbo_sandbox_`/`nbo_live_` string with no extra whitespace.",
    "docUrl": "https://docs.nombaone.xyz/errors#API_KEY_INVALID"
  },
Apply the same to reference/examples.mdx:98-118 and to the `SAMPLE` constant at error-explorer.tsx:20-25.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/getting-started/authentication.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/reference/examples.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/error-explorer.tsx`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: the four JSON error envelopes printed anywhere in the docs (apps/docs/content/getting-started/authentication.mdx:56-64, apps/docs/content/reference/examples.mdx:96-105 and :109-118, and the seeded SAMPLE in apps/docs/src/components/mdx/error-explorer.tsx:20-25) show only `code` and `message`, while apps/api/src/shared/http/error-handler.ts:49-60 always emits `hint` and `docUrl` and both apps/api/src/shared/openapi/build.ts:188 and packages/core-contracts/src/types/envelope.ts:38-43 mark them required. That sample-vs-reality drift is real and the snippets should be updated.
> 
> But the claimed impact is materially overstated on three points:
> 1. "The docs never show them what a 
> 
> *…trimmed (1662 more chars — see the cited files).*
> The finding is true but overstated on two points. First, "the docs never show them what a real hint/docUrl looks like" is wrong: apps/docs/src/components/mdx/error-reference.tsx:81-99 renders every code's actual hint and docUrl deep-link from ERROR_CODE_META on the /errors page itself. Second, the authoritative machine surface is correct — apps/docs/src/generated/openapi.json:65 lists hint and docUrl as required, so the API reference and anything generated from the spec already have them; only the four hand-written JSON code blocks (authentication.mdx:54-64, examples.mdx:98-106 and :109-118) plus the error-explorer.tsx:20-25 SAMPLE seed are short. The real defect is a docs-copy inconsistency
> 
> *…trimmed (360 more chars — see the cited files).*

---

## X23. 🟡 Four of the nine SDKs are missing the public code API_KEY_HOST_MISMATCH from their vendored code list

**What we publish**

Each SDK claims its list is the complete vendored PUBLIC_ERROR_CODES. nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java:4-5 — "Every error `code` the public API can emit, as `String` constants vendored from the platform's `PUBLIC_ERROR_CODES` (~72 codes)." nombaone-node/src/error.ts:12-13 — "Every error code the public API can emit, vendored from the platform's `PUBLIC_ERROR_CODES`." nombaone-python/src/nombaone/_constants.py:58 and nombaone-go/errors.go:12 make the same claim.

**What the code does**

I diffed all nine SDK code lists against the 72 members of PUBLIC_ERROR_CODES. Five (ruby, php, dotnet, elixir, rust) have all 72. FOUR have 71 — node, go, java and python each omit `API_KEY_HOST_MISMATCH`. Compare nombaone-java/…/ErrorCode.java:28-30, which ends the API-key family at `public static final String API_KEY_ENVIRONMENT_MISMATCH = "API_KEY_ENVIRONMENT_MISMATCH";` with no HOST_MISMATCH constant; nombaone-node/src/error.ts:29-31 likewise ends at `| 'API_KEY_ENVIRONMENT_MISMATCH'`. The code is real, public (packages/errors/src/codes.ts:272) and genuinely emitted: apps/api/src/shared/middlewares/api-key.ts:122-128 `throw AppError.Unauthorized(\`${req.hostname} only accepts ${expectedMode} keys…\`, …, NOMBAONE_ERROR_CODES.API_KEY_HOST_MISMATCH)`.

**Impact.** This is the code for the single most common first-day mistake — sending a sandbox key to the live host or vice-versa. In Python, `nombaone.PUBLIC_ERROR_CODES` is a public export (_constants.py:61, __init__.py:21/230); a developer who iterates it to build an exhaustive error handler silently has no branch for the wrong-host 401. In node/go/java there is no named constant to compare against, so `err.code === ErrorCode.API_KEY_HOST_MISMATCH` does not compile / has no symbol. All four lists are open unions (node error.ts:104-105 `| (string & {})`), so nothing hard-breaks — but the SDK's stated completeness is false and the highest-value code is the one missing.

**Fix.** Add the constant to each of the four, in the API-key family block: nombaone-node/src/error.ts after line 31 → `| 'API_KEY_HOST_MISMATCH'`; nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java after line 30 → `public static final String API_KEY_HOST_MISMATCH = "API_KEY_HOST_MISMATCH";`; nombaone-go/errors.go and nombaone-python/src/nombaone/_constants.py in the corresponding API_KEY blocks. Then add a codegen/CI check in each SDK that asserts its list equals `PUBLIC_ERROR_CODES` exactly — a hand-vendored list is exactly the compiler-invisible surface that drifts.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/error.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/errors.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/_constants.py`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: four SDKs (nombaone-node/src/error.ts, nombaone-go/errors.go, nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java, nombaone-python/src/nombaone/_constants.py) vendor only 71 of the 72 PUBLIC_ERROR_CODES, omitting API_KEY_HOST_MISMATCH, while their doc comments assert the list is complete — so the stated completeness is false and each should gain the constant (plus a parity test against packages/errors, which rust already has at nombaone-rust/src/error.rs:434). But the consequences are narrower than claimed: the error is still delivered in full (message + hint + docUrl) and all four expose `code` as an open/plain string, so `err.code === 'API_KEY_HOST_MISMATCH'` wo
> 
> *…trimmed (328 more chars — see the cited files).*
> The factual drift is correct (4 SDKs omit the code) but the impact is overstated. (a) Node exposes NombaoneErrorCode only as a TYPE alias with an open `(string & {})` union — there is no runtime ErrorCode object, so `err.code === 'API_KEY_HOST_MISMATCH'` compiles fine; the "does not compile / no symbol" claim is false for node, and Go/Java literal comparisons compile too. (b) No SDK uses the code list for exception dispatch or validation (node keys off HTTP status; python types code as plain str), so the wrong-host 401 still surfaces with its full code/message/hint/docUrl from the wire. (c) The SDKs' vendored spec/openapi.json already contains the code, so only the hand-maintained constant l
> 
> *…trimmed (283 more chars — see the cited files).*

---

## X24. 🟡 No docs page tells a developer WHICH endpoints require Idempotency-Key — the reference renderer drops every header parameter

**What we publish**

`apps/docs/src/lib/api-ref/model.ts:337-351` builds each operation and exposes only `pathParams: params.filter((p) => p.in === 'path')` and `queryParams: params.filter((p) => p.in === 'query')` — header params are parsed (`:293` accepts `p.in === 'header'`) and then thrown away. The result: no `/reference/*` page mentions the header at all, e.g. `apps/docs/public/reference/customers/grant-credit.md` (POST /v1/customers/{id}/credit) lists only Path parameters + Request body, and `apps/docs/public/reference/subscriptions/cancel.md` likewise. There is no `/getting-started/idempotency` page either (`apps/docs/content/manifest.ts` has no such entry).

**What the code does**

Eleven routes hard-fail without the header: `apps/api/src/shared/middlewares/idempotency.ts:64-72` — `if (required) { next(AppError.BadRequest('Idempotency-Key header is required for this request', undefined, NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_MISSING)); return; }`, wired as the strict `idempotency` middleware on POST /examples, POST /customers/:id/credit, POST /payment-methods/setup, POST /mandates, POST /subscriptions, POST /subscriptions/:id/{cancel,resubscribe,change}, POST /settlements/payout, POST /settlements/:id/refund (e.g. `subscriptions/routes.ts:61`, `settlements/routes.ts:25,29`). Meanwhile the OpenAPI over-corrects and marks it required on ALL 44 mutating ops.

**Impact.** A developer reading `/reference/subscriptions/create` (or its `.md` mirror, which is what agents and llms.txt consume — and which carries no code sample at all) has no way to learn the header is mandatory; their first hand-rolled POST returns 400 IDEMPOTENCY_KEY_MISSING. No surface we publish states the true 11-endpoint list: the reference says nothing, the spec says 'all 44'.

**Fix.** (a) `apps/docs/src/lib/api-ref/model.ts:348-349`: add `headerParams: params.filter((p) => p.in === 'header')` to the `ApiOperation` and render it in `api-reference.tsx` + the `.md` mirror. (b) Make the spec honest first (see the Idempotency finding above) so `required` reflects the 11 strict routes, not all 44. (c) Add a `/getting-started/idempotency` page to `apps/docs/content/manifest.ts` stating the rule: required on money-moving POSTs, accepted-and-deduped elsewhere.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/model.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/api-reference.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/manifest.ts`

> **Refuter's correction — re-scopes this finding:**
> The renderer does drop header params from the parameter tables (model.ts has no headerParams; api-operation.tsx renders only Path/Query/Body) — that part is true. But it is NOT true that "no /reference/* page mentions the header": snippets.ts:184-186 injects `-H "Idempotency-Key: $(uuidgen)"` into the cURL sample of every POST with a body, cURL is the first tab, and it renders above the tables — and all 9 public strict-idempotency operations have bodies, so each one already shows the header in a copy-pasteable sample. Idempotency is also documented in quickstart, concepts/the-ledger (with an IdempotencyLab widget), concepts/hard-parts/the-double-charge-bug, guides/going-live, reference/examp
> 
> *…trimmed (634 more chars — see the cited files).*
> The finding overstates discoverability. It is NOT true that "no surface we publish states" the header — the published OpenAPI spec (`apps/docs/src/generated/openapi.json`) declares `Idempotency-Key` as a required parameter on every mutating op, and all 9 SDK pages document that the SDKs send it automatically. What is accurate: the human-facing `/reference/*` pages and their `.md` mirrors drop every header parameter (renderer defect in `model.ts:337-351` + `api-operation.tsx`), and no page enumerates the true 11-route required list. Practical impact is one self-explanatory 400 (the error carries a hint + docUrl per `packages/errors/src/codes.ts:477`) for hand-rolled HTTP callers only — integr
> 
> *…trimmed (54 more chars — see the cited files).*

---

## X25. 🟡 No endpoint documents which errors it can raise — the OpenAPI doc advertises all 72 codes on all 83 operations via a single `default` response

**What we publish**

apps/api/src/shared/openapi/build.ts:110-115 — the doc-comment promises each operation carries "the EXACT request body + query/path parameters the route enforces (from the `validate` schemas — item 1); a typed success envelope; and the shared `ApiError` envelope (with the `PUBLIC_ERROR_CODES` enum) as the default." The API reference is generated from this document, so this is the only per-endpoint error surface a reader has.

**What the code does**

build.ts:137-143 gives every operation the same two responses: `'200': successResponse(routeKey)` and `default: { description: 'Error (ApiError envelope)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }`. That `ApiError` schema's `code` is the full 72-value enum (build.ts:190). There is no per-operation narrowing: `GET /v1/customers/{id}` advertises `ESCROW_LOCKED` and `DUNNING_CARD_UPDATE_REQUIRED` as possible codes, while the services that actually back it can only raise `CUSTOMER_NOT_FOUND`, the auth/idempotency/rate-limit family, and the system fallbacks. I also grepped apps/docs/content/reference/ — it holds only `examples.mdx` and `glossary.mdx`; no hand-written page anywhere lists an endpoint's errors, and only 9 of the 72 codes are quoted in the whole of apps/docs/content.

**Impact.** An integrator cannot discover, from the reference, which errors to handle for the call they are making — the honest answer the docs give is "any of 72". Generated SDK error-handling stubs and switch statements are correspondingly useless, and the docs' claim that they tell you the exact contract each route enforces is true for the request and false for the failure.

**Fix.** In apps/api/src/shared/openapi/build.ts, add a `ERROR_CODES_BY_ROUTE: Record<string, NombaoneErrorCode[]>` map next to `RESPONSE_DATA_BY_ROUTE` in apps/api/src/shared/openapi/responses.ts (keyed the same `"<method> <specPath>"` way), and at build.ts:139 emit per-status error responses whose `code` enum is narrowed to `[...alwaysPossible, ...ERROR_CODES_BY_ROUTE[routeKey]]` instead of the full list. Seed the map by grepping each controller's service call chain for `NOMBAONE_ERROR_CODES.*`. Guard it with an e2e that asserts every code a route actually returns is declared.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/build.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/responses.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: The OpenAPI document gives all 83 operations the same two responses — `200` and a `default` pointing at the shared `ApiError` schema whose `code` is the full 72-value `PUBLIC_ERROR_CODES` enum (apps/api/src/shared/openapi/build.ts:137-143, :190). This is confirmed in the committed snapshot (apps/docs/src/generated/openapi.json: 83 ops, response keys exactly ['200','default'], enum length 72), and apps/docs/src/components/mdx/api-reference.tsx:151-160 prints those raw keys, so each endpoint page shows "Responses: 200 default". Consequently the spec offers no per-endpoint shortlist of which codes a given call can raise — a legitimate enrichment gap (e.g. an `x-error-codes` ex
> 
> *…trimmed (1300 more chars — see the cited files).*
> The accurate finding is narrower: the OpenAPI document gives every operation a single `default` error response carrying the full 72-value PUBLIC_ERROR_CODES enum, and documents no non-200 status codes — so there is no PER-ENDPOINT narrowing of the error set, and codegen'd SDKs get a 72-wide code union rather than a per-call union. It is NOT true that the docs offer no error surface: apps/docs/content/errors.mdx renders a complete, registry-generated catalog of all 72 codes (error-reference.tsx:62 iterates PUBLIC_ERROR_CODES), every error response is required to carry `hint` and `docUrl` deep-linking to that catalog entry, and rehype-error-autolink cross-links codes in prose. The finding's "o
> 
> *…trimmed (310 more chars — see the cited files).*

---

## X26. 🟡 On a 429 QUOTA_EXCEEDED the server sends no Retry-After and no X-RateLimit-* headers, though every SDK documents them as present on 429

**What we publish**

All nine SDK doc pages promise them, e.g. `apps/docs/content/sdks/python.mdx:215` — `| 429 | \`RateLimitError\` | Adds \`retry_after\` (seconds), \`limit\`, \`remaining\`. |` (identically `sdks/node.mdx:159`, `sdks/go.mdx:182`, `sdks/java.mdx:212`, …), and the SDKs implement it (`nombaone-python/src/nombaone/_exceptions.py:170-174` reads `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`; `nombaone-python/src/nombaone/_client.py:363-364` sleeps for `Retry-After` on retry).

**What the code does**

`apps/api/src/shared/middlewares/rate-limit.ts:90-96` throws the quota 429 (`AppError.TooManyRequests('Monthly request quota exceeded', …, NOMBAONE_ERROR_CODES.QUOTA_EXCEEDED)`) BEFORE any header is set — `res.setHeader('X-RateLimit-Limit'…)` / `'X-RateLimit-Remaining'` are at lines 106-107 and `Retry-After` at line 113, all downstream of the throw. Only the RATE_LIMIT_EXCEEDED path (lines 109-118) sets them.

**Impact.** An integrator hitting the monthly quota gets a 429 whose `retryAfter`, `limit` and `remaining` are all null/None — contradicting the table we ship in every SDK's docs — and the SDK's automatic retry (`max_retries=2`) then falls back to jitter-only backoff and retries within milliseconds against a quota that will not reset for days, burning attempts and adding load.

**Fix.** `apps/api/src/shared/middlewares/rate-limit.ts`: before the throw at line 91, set `res.setHeader('Retry-After', String(secondsUntilMonthRollover))` (and X-RateLimit-* if the values are meaningful); or add a `retryAfter`/`resetAt` field to the QUOTA_EXCEEDED error details and document in the SDK 429 tables that `retryAfter`/`limit`/`remaining` are present for RATE_LIMIT_EXCEEDED only.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/middlewares/rate-limit.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the QUOTA_EXCEEDED 429 (rate-limit.ts:90-96) is thrown before any rate-limit header is set, and no other layer adds them (error-handler.ts:65 just serializes the body), so the SDKs — which parse RateLimitError exclusively from the Retry-After / X-RateLimit-Limit / X-RateLimit-Remaining headers (python _exceptions.py:127-133) — surface all three as null/None on a quota 429, while the RATE_LIMIT_EXCEEDED 429 does carry them. The sharper defect is that the SDK retry predicate ignores the error code for 429 (_constants.py:34 + _client.py:88-92), so a monthly-quota rejection is retried twice with jitter-only backoff (<=0.5s then <=1s) against a quota that will not reset for days
> 
> *…trimmed (763 more chars — see the cited files).*
> The finding is factually correct but the severity is one notch high. Two qualifications: (1) REACHABILITY — the quota path is dormant by default. monthlyRequestQuota is null out of the box (sara/src/org/billing-settings.ts:65; core-db schema line 58, nullable, no default), so the `if (cfg.monthlyQuota != null)` guard at rate-limit.ts:84 means no org hits this unless it explicitly self-caps via PUT /v1/organization or an operator writes the column. The console displays the field read-only and cannot set it. So this is not the default integrator's experience. (2) IMPACT — the 429 is thrown in middleware before any handler or ledger write, so the SDK's 2 jitter-backoff retries are harmless (no 
> 
> *…trimmed (432 more chars — see the cited files).*

---

## X27. 🟡 PUBLIC_ERROR_CODES is a published enum: ADDING codes is cheap, REMOVING them breaks exhaustive matches in the typed SDKs — and several 'dead' codes are unimplemented guards, not dead vocabulary

**What we publish**

The list contains both directions: ADD WEBHOOK_ENDPOINT_NOT_FOUND / WEBHOOK_EVENT_NOT_FOUND / WEBHOOK_RAW_BODY_MISSING / SETTLEMENT_PAYOUT_FAILED to PUBLIC_ERROR_CODES; and REMOVE PRICE_PLAN_MISMATCH, PRORATION_INTERVAL_SWITCH_UNSUPPORTED, CREDIT_GRANT_ALREADY_VOIDED, CREDIT_INSUFFICIENT_BALANCE, EXAMPLE_NOT_FOUND, and ~10 MANDATE_*/DUNNING_*/SUBSCRIPTION_SCHEDULE_* codes as unreachable.

**What the code does**

PUBLIC_ERROR_CODES (packages/errors/src/codes.ts:260-333) drives THREE surfaces at once: the /errors docs page (error-reference.tsx:62 iterates it), the OpenAPI ApiError.code enum (build.ts:12,190), and — by hand-vendoring, not codegen — the error-code list in all nine SDKs. `toPublicErrorCode` (codes.ts:335) is not status-aware, so it collapses anything not in the set to SYSTEM_INTERNAL_ERROR regardless of the HTTP status.

**Impact.** Removing a code narrows a published enum: a Rust/Java/.NET integrator with an exhaustive match on the vendored code list gets a compile break on the next SDK version. And several of the 'dead' codes are not vocabulary errors — MANDATE_NOT_ACTIVE, MANDATE_CONSENT_PENDING, MANDATE_MAX_AMOUNT_EXCEEDED and PAYMENT_METHOD_NOT_ACTIVE are unreachable because the GUARD was never written (subscriptions/create.ts resolves a payment method with no status predicate), so deleting them papers over a real missing check on the direct-debit path.

**Fix.** Triage each code into implement / delete / keep-reserved BEFORE touching the set:
- IMPLEMENT (do not delete): MANDATE_NOT_ACTIVE, MANDATE_CONSENT_PENDING, PAYMENT_METHOD_NOT_ACTIVE — add the status predicate at the subscription-create / set-default attach sites. Also map packages/sara/src/rails/mandate.ts's `mandate_max_amount_exceeded` failureReason into the PaymentFailureReason taxonomy (it currently coerces to 'unknown', so dunning retries a debit that can never clear).
- ADD: WEBHOOK_ENDPOINT_NOT_FOUND, WEBHOOK_EVENT_NOT_FOUND, WEBHOOK_RAW_BODY_MISSING, SETTLEMENT_PAYOUT_FAILED. Note adding WEBHOOK_EVENT_NOT_FOUND does NOT fix GET /v1/events/{id} — get-event.ts:29 HARDCODES SYSTEM_INTERNAL_ERROR at the throw site and must be edited separately. Same for deliveries.ts:116, which labels a missing DELIVERY as a missing ENDPOINT.
- Consider making `toPublicErrorCode` status-aware (fall b

*…trimmed (654 more chars — see the cited files).*

**Files.** `packages/errors/src/codes.ts`, `apps/api/src/apps/main/modules/events/controllers/get-event.ts`, `packages/sara/src/webhooks/deliveries.ts`, `apps/api/src/shared/services/subscriptions/create.ts`, `packages/sara/src/nomba/failure-taxonomy.ts`

---

## X28. 🟡 Provider/upstream failures report SYSTEM_INTERNAL_ERROR, not SYSTEM_UPSTREAM_ERROR — the upstream code is effectively unreachable

**What we publish**

packages/errors/src/codes.ts:246-249 maps 502/503/504 to `SYSTEM_UPSTREAM_ERROR`, whose published hint (codes.ts:861-863) is "An upstream dependency was unavailable or timed out. This is transient — retry after a short backoff." apps/docs/content/sdks/dotnet.mdx:287 tells readers a provider failure surfaces "as a `ServerException` / `SYSTEM_UPSTREAM_ERROR`".

**What the code does**

`NOMBA_REQUEST_FAILED` (codes.ts:151) and `NOMBA_UNAUTHORIZED` (codes.ts:152) are NOT in `PUBLIC_ERROR_CODES` (codes.ts:260-333). They are the codes actually attached to upstream failures: apps/api/src/shared/config/nomba.ts:78-82 `throw AppError.ServiceUnavailable('Live Nomba is only available on a production deployment', …, NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED)` (503) and packages/sara/src/nomba/client.ts:103-107 `throw AppError.ThirdPartyServiceError('nomba token issue failed', { status: res.status }, NOMBAONE_ERROR_CODES.NOMBA_UNAUTHORIZED)` (502). `toPublicErrorCode` (codes.ts:335-336) collapses ANY non-public code to `SYSTEM_INTERNAL_ERROR` — it is not status-aware — so error-handler.ts:40 emits `502 { code: 'SYSTEM_INTERNAL_ERROR', hint: 'Something failed on our side…' }`. I executed the collapse for both codes and confirmed. Because every upstream throw site passes an explicit code, the 502/503/504 branch of `getDefaultNombaoneErrorCodeForStatus` never fires, so `SYSTEM_UPSTREAM_ERROR` is never emitted for a real Nomba outage.

**Impact.** An integrator who follows the docs and branches `if (err.code === 'SYSTEM_UPSTREAM_ERROR') retryWithBackoff()` — the exact pattern the hint and the .NET SDK page prescribe — never enters that branch during a Nomba outage; they instead see SYSTEM_INTERNAL_ERROR with a hint telling them to contact support. Transient provider blips get escalated as platform bugs.

**Fix.** Make the collapse status-aware in packages/errors/src/codes.ts:335 — replace `export const toPublicErrorCode = (code: NombaoneErrorCode): NombaoneErrorCode => PUBLIC_ERROR_CODES.has(code) ? code : NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR;` with a two-arg form that takes the HTTP status and falls back to `getDefaultNombaoneErrorCodeForStatus(status)` instead of the hardcoded SYSTEM_INTERNAL_ERROR, then pass `status` at apps/api/src/shared/http/error-handler.ts:40. That yields SYSTEM_UPSTREAM_ERROR on 502/503/504 and SYSTEM_INTERNAL_ERROR on 500, with no code leak. Update the `message` guard at error-handler.ts:56 to blank the message for BOTH system fallbacks.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/errors/src/codes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/http/error-handler.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: SYSTEM_UPSTREAM_ERROR is dead on the wire — no code path in the repo can emit it, yet it is published in PUBLIC_ERROR_CODES (codes.ts:332) and therefore rendered on the docs error reference (error-reference.tsx:62 iterates PUBLIC_ERROR_CODES) with a "this is transient — retry after a short backoff" hint, and dotnet.mdx:287 promises it. Every 502/503 AppError in the codebase passes an explicit code, and none of those codes are in PUBLIC_ERROR_CODES, so toPublicErrorCode (codes.ts:335-336, not status-aware) collapses them all to SYSTEM_INTERNAL_ERROR at error-handler.ts:40 (apps/api/src/shared/http/error-handler.ts, not shared/middleware/) — which ALSO masks the message to 'I
> 
> *…trimmed (938 more chars — see the cited files).*
> Accurate version: upstream Nomba failures do return the correct 5xx HTTP STATUS (502/503) but carry `code: SYSTEM_INTERNAL_ERROR` and a "contact support" hint instead of `SYSTEM_UPSTREAM_ERROR`, because NOMBA_REQUEST_FAILED and NOMBA_UNAUTHORIZED are absent from PUBLIC_ERROR_CODES and toPublicErrorCode collapses them. SYSTEM_UPSTREAM_ERROR is therefore never emitted, making its error-reference page dead and dotnet.mdx:287 factually wrong. But SDK retry behavior is unaffected: the documented retry policy (dotnet.mdx:90, :181) keys off 5xx status and ServerException, not the code string, so an integrator following the docs still auto-retries a Nomba outage. The real cost is a misleading hint/c
> 
> *…trimmed (122 more chars — see the cited files).*

---

## X29. 🟡 SDKs advertise `limit`/`cursor` paging on three endpoints the server does not paginate (subscription events, dunning attempts, webhook endpoints)

**What we publish**

`nombaone-node/src/resources/subscriptions.ts:210-215` — `export interface SubscriptionListEventsParams { /** Page size, 1–100 (API default 20). */ limit?: number; /** Opaque cursor from a previous page's `pagination.nextCursor`. */ cursor?: string; }`, used by `listEvents()` at `:374-383` (`requestPage` → `GET /subscriptions/{id}/events`, `query: {...params}`). Same for `SubscriptionDunning.listAttempts()` at `:282-291` (`params?: { limit?: number; cursor?: string }` → `GET /subscriptions/{id}/dunning/attempts`) and `WebhookEndpoints.list()` at `resources/webhook-endpoints.ts:195-201` (returns a `PagePromise`). Python/Ruby/Go mirror this.

**What the code does**

None of those three routes paginates or even validates a query. `apps/api/src/apps/main/modules/subscriptions/routes.ts:83-89` — `subscriptionsRouter.get('/subscriptions/:id/events', apiKeyAuth, rateLimit, requireScope('subscriptions:read'), listSubscriptionEventsController)` — no `validate({query})`; the controller `apps/api/src/apps/main/modules/subscriptions/controllers/list-subscription-events.ts:12-17` is a `jsonHandler` that returns `{ data: await listSubscriptionAuditTrail(db, ctx, req.params.id ?? '') }` and never touches `req.query`. Identically `dunning/routes.ts:28-34` + `dunning/controllers/list-dunning-attempts.ts:12-21`, and `webhooks/routes.ts:28` + `webhooks/controllers/list-endpoints.ts:12-18`. All three return the FULL list with no top-level `pagination` block (the OpenAPI confirms: `GET /v1/subscriptions/{id}/events` has zero query parameters).

**Impact.** `limit: 20` is silently ignored: a subscription with 5,000 audit events returns all 5,000 in one response (a memory/latency cliff for the integrator and for us). `hasNextPage()` is always false because the SDK's `Page` falls back to `{limit: data.length, hasMore: false, nextCursor: null}` (`nombaone-node/src/pagination.ts:26-30`), so `for await` looks like it worked while the documented page size was a lie.

**Fix.** Server-side is the right fix (the SDK contract is the honest one): add `validate({ query: listEventQuery })` to `subscriptions/routes.ts:83-89` and convert `list-subscription-events.ts` to `paginatedHandler` over a keyset query; do the same for `dunning/routes.ts:28-34` and `webhooks/routes.ts:28`. If paging these is out of scope, then delete `limit`/`cursor` from `SubscriptionListEventsParams` (`nombaone-node/src/resources/subscriptions.ts:210-215`), from `listAttempts` (`:282-286`), and drop the `PagePromise` return on `webhookEndpoints.list()` — in all nine SDKs.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/subscriptions/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/subscriptions/controllers/list-subscription-events.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/dunning/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/webhooks/routes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: only ONE endpoint is genuinely affected — GET /v1/subscriptions/{id}/events. The SDKs (node subscriptions.ts:210-215/374-383, ruby :177, python list_events) advertise `limit` (documented as "Page size, 1-100, API default 20") and `cursor`, but the route has no query validation, the controller never reads req.query, jsonHandler emits no `pagination` block (so hasNextPage() is always false), and the underlying query (packages/sara/src/events/queries.ts:22-32) has NO LIMIT clause at all — it returns the subscription's entire lifetime audit trail in one response. This is not intentional: listDomainEvents in the same file (:43) and shared/http/paginated.ts:30 already provide the
> 
> *…trimmed (1136 more chars — see the cited files).*
> The finding is real and production-reachable, but its impact is mis-aimed in two ways and under-states the server-side risk.
> 
> REACHABLE: Yes, production. All three are public /v1 routes behind apiKeyAuth (not gated/test-only), and the SDKs are genuinely shipped (@nombaone/node v0.1.4, public GitHub repo, 9-language parity). The docs make the paging promise UNIVERSAL, not per-endpoint: apps/docs/content/sdks/node.mdx:118 "Every `list()` returns a `PagePromise<Item>`"; ruby.mdx:143 "Every `list` accepts `limit:` (1-100, default 20) and `cursor:`". An integrator following the docs types `limit: 50` and it is silently dropped on the first call. Server side confirmed: no validate({query}) on subs
> 
> *…trimmed (2229 more chars — see the cited files).*

---

## X30. 🟡 Several 'docs are wrong' items are actually 'engine is wrong' — fixing the prose first ships a permanent lie you will have to un-ship

**What we publish**

The list treats these as docs edits: the upcoming-invoice preview 'does not include prorations, discounts or credits'; `maxDays` on pause is 'advisory only'; dunning exhaustion emits subscription.churned; `?active=false` returns active prices; rotate-secret has no grace window.

**What the code does**

Each of these has an engine side. upcoming.ts:43-66 omits the discount/credit math the real cycle applies (runCycle.ts:154) — and apps/console/src/lib/subscription-detail.ts:273-297 already renders a 'Discounts & credits' row computed as total − subtotal, which is therefore ALWAYS zero: a merchant-facing wrong quote, not just a docs gap. `pauseMaxDays` is written (transition.ts:160) and read by nobody — and workbench/apps/api/build_plan_03.md:436 ticks item A11 as 'enforced at resume', so the plan says it works. Rotation is a hard cutover by design (endpoints.ts:126-127).

**Impact.** If you 'fix the docs' by writing down the broken behavior, you (a) publish a permanent contract you did not intend, and (b) close the ticket. The upcoming-invoice one in particular would enshrine a merchant-facing over-quote as documented behavior while the console keeps showing a dead row.

**Fix.** Split each into 'write the truth now' vs 'decide the product'.
UPCOMING INVOICE: this is an ENGINE bug, not a docs bug — run the preview through the same discount/credit resolution the cycle uses, THEN the guide (guides/proration-and-plan-changes.mdx:32-42) can stay roughly as written. If you defer, also fix apps/console/src/lib/subscription-detail.ts so it stops rendering a row that is structurally always ₦0.
maxDays: choose — implement the paused-expiry pass in lifecycle-sweep.ts, or remove `maxDays` from the contract, the spec, and the four SDKs whose doc-comments promise auto-resume. Do NOT document 'advisory only' and leave the field: an accepted-but-ignored money-path field is the worst of the three options. Untick build_plan_03 A11 either way — a checked box is why nobody revisited it.
DUNNING EVENT: pure docs (guides/dunning-and-recovery.mdx:77) — but fix BOTH errors: the event i

*…trimmed (630 more chars — see the cited files).*

**Files.** `apps/api/src/shared/services/billing/upcoming.ts`, `apps/console/src/lib/subscription-detail.ts`, `apps/api/src/shared/services/billing/lifecycle-sweep.ts`, `apps/docs/content/guides/dunning-and-recovery.mdx`, `packages/core-contracts/src/validations/price.ts`

---

## X31. 🟡 The `amount` vs `amountInKobo` 422 is wider than the quickstart: the endpoint's own reference page documents the WRONG field name, and the documented RESPONSE shape is wrong too

**What we publish**

This EXTENDS the established quickstart-curl finding with new files and a new failure mode. The endpoint's reference page names the request field `amount` in its field table, not just its samples: apps/docs/content/reference/examples.mdx:63 — `<ParamField name="amount" type="integer (kobo)" in="body" required>`, with samples at :38 (`"amount": 15000`) and :54 (`amount: 15_000, // kobo → ₦150.00`). Separately, the quickstart documents the RESPONSE as containing `amount`: apps/docs/content/getting-started/quickstart.mdx:41 — `"amount": 15000,` inside the `data` envelope.

**What the code does**

The request validator requires `amountInKobo` and rejects unknown keys: packages/core-contracts/src/validations/example.ts:7 — `amountInKobo: z.coerce.number().int().positive(), // kobo` (OpenAPI marks the body `additionalProperties: false`). The RESPONSE never contains `amount`: packages/sara/src/example/serialize.ts:30 — `amountInKobo: row.amount,`; packages/core-contracts/src/types/example.ts:17 — `amountInKobo: number; // kobo`; and the generated OpenAPI `Example` schema has `"amountInKobo": { "type": "integer" }` and no `amount`. apps/checkout consumes the real name (apps/checkout/src/app/[reference]/page.tsx:91 — `kobo={example.amountInKobo}`).

**Impact.** Two distinct breakages beyond the known one. (1) The reference page — the canonical, authoritative field table for the endpoint, not just a quickstart snippet — tells developers the field is called `amount`, so even a developer who ignores the samples and reads the spec table sends the wrong key and gets a 422. (2) Even after the developer fixes the request, the documented response shape is wrong: they parse `data.amount` and get `undefined`, so their code records a ₦0 / NaN amount for a real ₦150.00 money-path transaction that DID post to the ledger. A silently-undefined money value on a success path is worse than the 422, because nothing fails loudly.

**Fix.** In apps/docs/content/reference/examples.mdx: :38 → `"amountInKobo": 15000`; :54 → `amountInKobo: 15_000, // kobo → ₦150.00`; :63 → `<ParamField name="amountInKobo" type="integer (kobo)" in="body" required>`. In apps/docs/content/getting-started/quickstart.mdx: :30 (request) → `"amountInKobo": 15000` and :41 (response) → `"amountInKobo": 15000,`. Regenerate the .md mirrors (apps/docs/public/reference/examples.md, apps/docs/public/getting-started/quickstart.md) and llms-full.txt.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/reference/examples.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/getting-started/quickstart.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and should be BROADENED. Confirmed as stated: reference field table (examples.mdx:64) names the request field `amount` when the server requires `amountInKobo`, and the documented response (quickstart.mdx:41, examples.mdx:86) contains `amount` when the serializer only ever emits `amountInKobo`.
> 
> Additional drift the auditor missed:
> 1. apps/docs/content/reference/examples.mdx:143 — `<ResponseField name="amount" type="integer (kobo)" required>`. The RESPONSE field table is wrong too, not just the JSON samples. So both the request AND response authoritative tables on the canonical page are wrong.
> 2. apps/docs/content/reference/examples.mdx:103 — the documented 422 body key
> 
> *…trimmed (1593 more chars — see the cited files).*
> Severity medium is correct, but the impact framing needs two adjustments — one down, one up.
> 
> DOWNGRADE the money-corruption claim: impact (2) ("a silently-undefined money value on a success path… a real ₦150.00 money-path transaction that DID post to the ledger") overstates the risk. /v1/examples is explicitly a deletable teaching slice that "carries no product meaning" — no merchant records revenue through it. Every REAL money endpoint (plans, prices, subscriptions, coupons, refunds) already documents `amountInKobo` correctly; the drift is confined to the two example-slice pages and does not reach any money surface an integrator actually builds on. TS/SDK users are additionally type-protec
> 
> *…trimmed (1126 more chars — see the cited files).*

---

## X32. 🟡 The changelog claims it is generated by diffing the OpenAPI snapshot "so it can't silently omit a change" — there is no generator; the page is hand-typed MDX

**What we publish**

apps/docs/content/changelog.mdx:9-11 — "Every change to the Nomba One API, dated and grouped, newest first. Breaking changes always carry a migration note. **This log is generated by diffing the API's OpenAPI snapshot between releases, so it can't silently omit a change.**"

**What the code does**

No such generator exists. `ls apps/docs/scripts` → build-agent-native, build-ask-index, build-nav-overlay, build-search-index, check-api-ref, check-frontmatter, check-l10n, check-links, check-openapi-honesty, check-sdks, check-style, l10n-sync-code — nothing changelog-related. `grep -rniE "changelog" apps/docs/scripts apps/docs/package.json apps/api/scripts` → ZERO hits. No oasdiff / openapi-diff / spec-diff dependency exists anywhere in the repo. The only mention of the intent is workbench/apps/docs/docs-plan-02-ia-navigation-voice.md:52 ("changelog: single generated page (Phase 09, OpenAPI-diff)") — planned, ticked, never built. changelog.mdx is authored prose like any other page.

**Impact.** The changelog is the one artifact an integrator trusts to be exhaustive, and it explicitly tells them omission is structurally impossible. It is in fact hand-maintained and therefore omits exactly what a human forgets — e.g. the 2026-07-12 entry announces the atomic `prices[]` on POST /v1/plans but says nothing about the fact that none of the nine shipped SDKs can send it. A false completeness guarantee on a change log is worse than no change log.

**Fix.** Either build the generator (snapshot the previous release's openapi.json, diff paths/params/schemas, emit the Added/Changed/Removed sections) or delete the sentence at apps/docs/content/changelog.mdx:10-11 and replace it with an honest one ("maintained by hand alongside each release"). Also add the SDK-support caveat to the 2026-07-12 entry.

**Files.** `apps/docs/content/changelog.mdx`

---

## X33. 🟡 The docs MCP server's `lookup_error` tool documents an example code that does not exist, and it serves hints for INTERNAL (non-public) error codes to any agent

**What we publish**

apps/docs/src/app/api/mcp/route.ts:146-152 — the tool an agent reads before calling: `{ name: "lookup_error", description: "Look up a Nomba One error code and get its fix hint and docs URL.", inputSchema: { properties: { code: { type: "string", description: "The error code, e.g. UNAUTHORIZED." } } } }`. The MCP server is public and unauthenticated at https://docs.nombaone.xyz/api/mcp and is advertised in apps/docs/content/agents.mdx:60-79 and apps/docs/public/.well-known/mcp.json.

**What the code does**

`UNAUTHORIZED` is not an error code — it is an HTTP STATUS name (packages/errors/src/codes.ts:22 `UNAUTHORIZED: 401`, inside HTTP_STATUS_CODES). The only code containing the word is `NOMBA_UNAUTHORIZED` (codes.ts:152). So the documented example, fed to `lookupError()` (mcp/route.ts:113-126), misses `ERROR_CODE_META` and returns `{ code: "UNAUTHORIZED", found: false, hint: "Unknown error code. See the error reference." }` — the tool's own worked example fails. Separately, `lookupError` keys on the FULL `ERROR_CODE_META` registry, not `PUBLIC_ERROR_CODES`, so it happily returns hints and docUrls for internal codes the API can never emit publicly (e.g. NOMBA_REQUEST_FAILED, EXAMPLE_NOT_FOUND); it flags them with `public: false`, but an agent that ignores that field will invent handling for unreachable codes.

**Impact.** The MCP surface is the one built specifically so an agent "never hallucinates a path" (route.ts:19-24). Its first interaction with the error tool, using the example it was given, returns "Unknown error code" — which teaches the agent the tool is unreliable and pushes it back to guessing. The non-public leak also hands agents a wider code vocabulary than the API's published contract.

**Fix.** apps/docs/src/app/api/mcp/route.ts:150 — change the example to a real public code (e.g. `"The error code, e.g. API_KEY_INVALID."`). In `lookupError` (:113-126), gate on `PUBLIC_ERROR_CODES.has(code)` and return `found: false` for internal codes, or state plainly in the returned object that a `public: false` code is not part of the API contract. While there, note `TEST_METHODS` (:128-133) is a hand-copied duplicate of `testMethodBehaviors` in packages/core-contracts/src/validations/test.ts — import it instead so it cannot drift.

**Files.** `apps/docs/src/app/api/mcp/route.ts`

---

## X34. 🟡 The merchant overview's "Everything the console does, the API can do too" is inverted — the console cannot do most of what the merchant track promises, and half of it exists in neither

**What we publish**

apps/docs/content/merchants/overview.mdx:40-44 — "<Callout type=\"note\" title=\"The same engine, a simpler door\"> Everything the console does, the [API](/getting-started/quickstart) can do too. The console is just the no-code way in. You can start on the console and add code later without changing anything about how billing works." And :31-38 — "A customer subscribes: by a link you share, or one your team adds for them… If a payment fails, Nomba One retries and messages the customer."

**What the code does**

The relationship runs the other way and is broken in both directions. (a) The payment link the overview leads with exists in neither the console nor the API (see the share-a-payment-link finding). (b) The console does things the API does NOT: apps/console/src/lib/plans-actions.ts:285-301 `archivePlanAction` writes `status='archived'` straight to the DB, bypassing apps/api's archive service entirely. (c) The console messages nobody (see the commsEnabled finding). So the callout's reassurance — start no-code, add code later, nothing changes — is false at the two points a merchant actually starts (link) and stops chasing (messages).

**Impact.** The merchant track is the acquisition funnel for the non-technical buyer, and its central promise ("run subscriptions without an engineer") rests on two capabilities that do not exist. A merchant who buys on this page cannot onboard a single customer without an engineer.

**Fix.** Rewrite apps/docs/content/merchants/overview.mdx to describe only what the console can actually do today (create plans/prices, create customers, create a subscription against an existing payment method, read invoices/settlements, issue a refund/payout, configure dunning numbers) and delete the link/messaging claims until they ship.

**Files.** `apps/docs/content/merchants/overview.mdx`

---

## X35. 🟡 Three unauthenticated endpoints are published with `security: ApiKeyAuth` — the spec's security block is unconditional

**What we publish**

`apps/api/src/shared/openapi/build.ts:135` — `security: [{ ApiKeyAuth: [] }]` is attached to EVERY operation with no condition, plus a document-level `security: [{ ApiKeyAuth: [] }]` at `:203`. So `GET /v1/health`, `GET /v1/openapi.json` and `GET /v1/events/catalog` all render as authenticated in the spec, and the docs reference stamps them with `🔒 secret key` (`apps/docs/src/components/mdx/api-reference.tsx:111-115`, driven by `requiresAuth: Boolean(op.security)` in `api-ref/model.ts:347`).

**What the code does**

None of the three has `apiKeyAuth` in its chain. `apps/api/src/apps/main/modules/health/routes.ts:16-19` — `healthRouter.get('/health', jsonHandler(() => ({ data: { status: 'ok' } })))`. `apps/api/src/apps/main/modules/events/routes.ts:15-18` — `eventsRouter.get('/events/catalog', jsonHandler(() => ({ data: WEBHOOK_EVENT_CATALOG })))`. `apps/api/src/apps/main/server/routes.ts:59-62` — `v1Router.get('/openapi.json', (_req, res) => {...})`.

**Impact.** The direction is safe (over-claiming auth, not under-claiming), but it makes the spec's `security` field carry zero information: a consumer cannot tell which endpoints are actually public, and the public catalog/health/spec endpoints — the ones an unauthenticated tool most wants — are documented as requiring a secret key. It also masks the real problem that `/v1/events/catalog` is unauthenticated by choice, which nothing in the code marks.

**Fix.** `apps/api/src/shared/openapi/build.ts`: derive `security` from the route's own middleware stack (the walker in `collectRoutes` already has `layer.route.stack` — tag `apiKeyAuth` the same way `validate` is tagged with `OPENAPI_SCHEMAS`, and emit `security: []` for routes without it).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/shared/openapi/build.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: `buildOpenApiDocument` (apps/api/src/shared/openapi/build.ts:135) stamps `security: [{ ApiKeyAuth: [] }]` on every collected operation unconditionally, and also sets a document-level `security` at :203. Three genuinely public endpoints are therefore misdeclared as authenticated in the spec and in the committed snapshot apps/docs/src/generated/openapi.json: `GET /v1/health`, `GET /v1/openapi.json`, `GET /v1/events/catalog`.
> 
> User-visible fallout is limited to ONE of them. apps/docs/src/lib/api-ref/model.ts:133-152 deliberately excludes `health`, `openapi.json`, `examples` and `sandbox` from RESOURCE_ORDER (documented in its own comment), so those two never render in the API 
> 
> *…trimmed (860 more chars — see the cited files).*
> The spec/docs do incorrectly stamp the three unauthenticated endpoints as requiring a secret key, and that is visible in production docs. However: the error is in the safe direction (over-claiming auth — supplying a key to these routes still works, nothing 401s), it affects 3 of ~50 operations rather than making the `security` field meaningless, and the assertion that "nothing in the code marks" /v1/events/catalog as intentionally public is wrong — apps/api/src/apps/main/modules/events/routes.ts:13-14 and apps/api/src/apps/main/server/routes.ts:55-57 both explicitly comment these routes as public. Real consequence: a slightly wrong 🔒 badge in the docs and a redundant apiKey param in generate
> 
> *…trimmed (137 more chars — see the cited files).*

---

## X36. ⚪ GET /v1/plans/{id}/prices documents a `planRef` query filter that the handler ignores

**What we publish**

The published spec lists `planRef` as a query parameter on `GET /v1/plans/{id}/prices` (it is generated from the shared `listPriceQuery`, `packages/core-contracts/src/validations/price.ts:23-28` — `planRef: z.string().optional()`, reused by `apps/api/src/apps/main/modules/plans/routes.ts:82-89` via `validate({ query: listPriceQuery })`). The docs reference page therefore lists it as a filter on the nested route.

**What the code does**

`apps/api/src/apps/main/modules/plans/controllers/list-plan-prices.ts:24-28` — `const page = await listPricesForPlan(db, ctx, req.params.id ?? '', { active: query.active, limit: query.limit, cursor: query.cursor });` — `query.planRef` is parsed and then never used; the plan always comes from the path param.

**Impact.** A developer who calls `GET /v1/plans/{a}/prices?planRef={b}` gets plan `a`'s prices with no error and no warning — a silently-ignored filter on a catalog read, exactly the class of gotcha the API philosophy forbids.

**Fix.** Give the nested route its own query schema in `packages/core-contracts/src/validations/price.ts` (e.g. `export const listPlanPriceQuery = listPriceQuery.omit({ planRef: true })`) and use it at `apps/api/src/apps/main/modules/plans/routes.ts:87`, so `planRef` disappears from the nested op's spec and a client sending it gets stripped input rather than a phantom filter.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/core-contracts/src/validations/price.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/plans/routes.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate in substance, but misattributes the root cause to the controller. The controller and service are correct BY DESIGN: apps/api/src/shared/services/prices/queries.ts:92-98 declares `listPricesForPlan(db, ctx, planRef, opts: Omit<ListPricesOptions, 'planRef'>)` — an explicit type-level exclusion that forbids a caller from overriding the plan — and binds the path ref with `{ ...opts, planRef }`. The controller dropping `query.planRef` is therefore intentional, not an oversight.
> 
> The actual defect is at the ROUTE: apps/api/src/apps/main/modules/plans/routes.ts:87 reuses `listPriceQuery`, a schema authored for the FLAT `GET /v1/prices` (where planRef is a real, honored filte
> 
> *…trimmed (831 more chars — see the cited files).*
> The finding is accurate but should be framed as spec-generation hygiene rather than a handler bug: planRef appears on the nested route only because apps/api/src/shared/openapi/build.ts derives parameters from the shared listPriceQuery zod object, not because anyone intentionally documented it. The response is never incorrect — the path plan wins and is properly org-scoped — so the only harm is a documented parameter that does nothing. Fix: give the nested route its own schema (listPriceQuery.omit({ planRef: true })) so the spec stops emitting it, or reject a conflicting planRef with a 400.

---

## X37. ⚪ Gating /metrics will silently blind whatever is scraping it — and the docs playground's demo key is full-scope, so 'just unset it' has a UI consequence

**What we publish**

Two findings say: put a bearer-token guard on GET /metrics (apps/api/src/apps/main/server/index.ts:55); and either unset INFRA_DEMO_SANDBOX_KEY or add a per-IP rate limit to the docs playground proxy.

**What the code does**

The metrics handler (apps/api/src/shared/observability/prometheus.ts:126) is a bare registry dump with no auth. The playground's demo-key fallback (apps/docs/src/app/api/playground/route.ts:96) is what makes the docs' GET examples work without a user key, and apps/api/scripts/provision-docs-key.ts:33-49 mints that key with ALL scopes — the only thing preventing an unauthenticated write oracle is the single `method === "GET"` conjunct on that line.

**Impact.** Adding auth to /metrics without updating the deployment's Prometheus scrape job stops collection silently — you lose observability at the exact moment you are shipping a batch of money-path changes. Unsetting INFRA_DEMO_SANDBOX_KEY breaks the docs' keyless quickstart button, which is a visible product regression.

**Fix.** For /metrics: check the DigitalOcean App Platform config (apps/api/.do/app.yaml) and any external scrape job BEFORE gating; prefer binding the exposition to a separate internal port over a token, so the scraper config does not need to change at all. If you use a token, ship the scrape-config update in the same deploy.
For the playground: do NOT unset the demo key (it powers the quickstart). Instead (a) re-mint it with READ-ONLY scopes — provision-docs-key.ts currently grants every :write scope, and route.ts:96's GET check is the only guard; (b) add a per-IP limit + Origin check on the proxy; (c) fix the dead `path.startsWith("/test")` guard at route.ts:87 to `/sandbox` — it matches nothing after the test→sandbox rename, so the intended second layer does not exist. None of these three is safe to skip individually.

**Files.** `apps/api/src/apps/main/server/index.ts`, `apps/api/scripts/provision-docs-key.ts`, `apps/docs/src/app/api/playground/route.ts`, `apps/api/.do/app.yaml`

---

## X38. ⚪ The documented delivery example omits two headers the server always sends (`x-nombaone-event-type`, `x-nombaone-delivery`)

**What we publish**

apps/docs/content/webhooks/overview.mdx:18-22 presents the complete wire picture of a delivery:
```http
POST /your/endpoint HTTP/1.1
Content-Type: application/json
X-Nombaone-Signature: t=1719920092,v1=8f3c…
X-Nombaone-Delivery-Guarantee: at-least-once
```
No other docs page enumerates the outbound headers.

**What the code does**

packages/sara/src/webhooks/deliver.ts:203-211 sets six headers on every POST: `content-type`, `user-agent: nombaone-webhooks/1`, `x-nombaone-signature`, `x-nombaone-event-type` (the event type), `x-nombaone-delivery` (the delivery reference, `nbo…whd`), and `x-nombaone-delivery-guarantee`.

**Impact.** `x-nombaone-delivery` is the delivery id — the value support will ask for and the value a receiver can log/route on before parsing the body, and `x-nombaone-event-type` lets a receiver shed load or route by type without parsing. Neither is discoverable from the docs, so integrators parse the body to get information already sitting in a header. Minor, but it is the kind of omission that makes the "here is exactly what a delivery looks like" block untrustworthy.

**Fix.** apps/docs/content/webhooks/overview.mdx:18-22 — add the two missing headers to the `http` block:
```
X-Nombaone-Event-Type: invoice.paid
X-Nombaone-Delivery: nbo493028471023whd
```
and a line noting that `X-Nombaone-Delivery` is the delivery id (stable across retries and replays) and that the body's `event.id` is the event id to dedupe on.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/overview.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is CORRECT as far as it goes: overview.mdx:18-22 really does omit `x-nombaone-event-type` and `x-nombaone-delivery`, which deliver.ts:203-211 unconditionally sends on every POST, and no published docs page lists them (the correct table exists only in the unpublished internal apps/api/WEBHOOKS.md:30-36). Severity `low` is right for that omission.
> 
> But the auditor's own conclusion — "it is the kind of omission that makes the 'here is exactly what a delivery looks like' block untrustworthy" — is truer than they realized, for reasons they did not report. The SAME code block is wrong on two higher-severity points, and a header-only fix would leave a still-broken example:
> 
> 1. SIGNATURE
> 
> *…trimmed (1491 more chars — see the cited files).*
> The finding is accurate but slightly over-argued. Both omitted headers duplicate values already present in the signed body (`buildBody` sets `id` = delivery reference, `type` = event type), so an integrator loses only pre-parse routing/logging convenience — never information. Correct framing: "the delivery example under-documents the wire format; two of six real headers are missing." Severity stays low. Separately (not part of this finding): the same code block's JSON body also diverges from `buildBody` — the real body nests `event: { id, type, createdAt }` and has no top-level `reference`/`createdAt`, and top-level `id` is the *delivery* reference, not the event id the docs tell you to dedu
> 
> *…trimmed (51 more chars — see the cited files).*

---

# Part 3 — Endpoints: parameters, bodies, responses

The request surface is mostly right. The damage is in what we say comes **back**, and in the auto-generated examples — synthesised by a sampler that knows nothing about the schema's own validation rules and therefore emits bodies the API rejects.

*65 findings — 5 critical, 30 high, 27 medium, 3 low.*

## E1. 🔴 Docs say a failed first charge returns `past_due` and "dunning now owns recovery" — the API returns `incomplete` and NOTHING ever retries it

**What we publish**

apps/docs/content/guides/start-a-subscription.mdx:72-74 — "- **`past_due`**: the first charge failed; [dunning](/guides/dunning-and-recovery)\n  now owns recovery. On a thin balance this usually means \"not yet,\" not \"no.\"" (and :79-80 "Handle `past_due` and `incomplete` from day one")

**What the code does**

A fresh `charge_automatically` sub with no trial is created `incomplete` (apps/api/src/shared/services/subscriptions/create.ts:111-115 `const status: SubscriptionStatus = trialing ? 'trialing' : input.collectionMethod === 'send_invoice' ? 'active' : 'incomplete';`). `startSubscription` then runs the first cycle, and on a declined pull `collectForInvoice` calls `moveActiveSubPastDue`, which is a NO-OP for an incomplete sub: apps/api/src/shared/services/billing/collectForInvoice.ts:207-218 — "/** Move an `active`/`trialing` subscription to `past_due` ... An `incomplete` first charge stays incomplete */ ... if (sub.status === 'active' || sub.status === 'trialing') { await enterPastDue(...); }". So POST /v1/subscriptions returns `status: "incomplete"` on a failed first charge — `past_due` is unreachable from create (the FSM has no `incomplete → past_due` edge: apps/api/src/shared/services/subscriptions/fsm.ts:13-27). Dunning then never touches it: apps/api/src/shared/services/dunning/queries.ts:43 seeds attempts only for `eq(subscriptionsTable.status, 'past_due')`, and the billing sweep 

*…trimmed (245 more chars — see the cited files).*

**Impact.** A merchant who follows this guide branches on `past_due` after create — a status that never arrives — and believes the engine is recovering the failed first charge. It is not: no dunning attempt is ever scheduled, the invoice is never retried, and the subscription silently expires. Every customer whose first pull lands on a thin balance (the exact Nigerian case the guide is about) is lost with zero recovery and no signal to the merchant.

**Fix.** Two parts. (1) Docs, apps/docs/content/guides/start-a-subscription.mdx:72-75: replace the `past_due` bullet with the truth — "**`incomplete`**: the first charge failed or needs customer action (OTP); `invoice.payment_failed` / `invoice.action_required` carries the reason. The subscription does NOT enter dunning from create." — and delete "dunning now owns recovery" from the create path. (2) If recovery is the intent (it clearly is), fix the engine: add `['incomplete','past_due']` to EDGES in apps/api/src/shared/services/subscriptions/fsm.ts:13-27 and include `'incomplete'` in the guard at apps/api/src/shared/services/billing/collectForInvoice.ts:216 — then the docs become true as written.

**Files.** `apps/docs/content/guides/start-a-subscription.mdx`, `apps/api/src/shared/services/billing/collectForInvoice.ts`, `apps/api/src/shared/services/subscriptions/fsm.ts`

> **Refuter's correction — re-scopes this finding:**
> The docs are wrong on BOTH bullets, not just `past_due`. (1) `past_due` is unreachable from POST /v1/subscriptions — a declined first charge on a charge_automatically, no-trial sub stays `incomplete` (deliberate: no incomplete→past_due FSM edge), so dunning never seeds an attempt, the billing sweep never re-bills it, no retry endpoint exists, and after 24h (INCOMPLETE_EXPIRY_WINDOW_HOURS) the lifecycle sweep marks it incomplete_expired. (2) The `incomplete` bullet is also inaccurate: it says incomplete means an OTP step and that `invoice.action_required` carries a fresh checkout link — true only for the requires_action branch; on a plain decline no checkout link is minted and the only event 
> 
> *…trimmed (726 more chars — see the cited files).*
> The core claim holds: `past_due` is unreachable from create, dunning never touches an `incomplete` sub, and no retry is ever scheduled — the sub expires to `incomplete_expired`. Two overstatements should be corrected. (1) It is NOT signal-less: `invoice.payment_failed` is emitted on the failed pull (collectForInvoice.ts:239-243), `subscription.updated` is emitted on expiry (transition.ts:272), and the 201 itself returns `status: "incomplete"` — which the guide's own callout tells integrators to handle. (2) Recovery is not structurally impossible, only never automatic: `effects.ts:148` handles `incomplete -> active`, so a payment landing out-of-band (or a merchant-driven re-collect) does acti
> 
> *…trimmed (384 more chars — see the cited files).*

---

## E2. 🔴 Every 404 on the webhooks and events surface returns error code SYSTEM_INTERNAL_ERROR with message "Internal server error" — WEBHOOK_ENDPOINT_NOT_FOUND / WEBHOOK_EVENT_NOT_FOUND are missing from PUBLIC_ERROR_CODES

**What we publish**

The docs error reference renders only public codes — apps/docs/src/components/mdx/error-reference.tsx:62 `const codes = Array.from(PUBLIC_ERROR_CODES).sort();` — and the OpenAPI `ApiError.error.code` enum is built from the same set (apps/api/src/shared/openapi/build.ts:12 `const PUBLIC_ERROR_CODES_LIST = [...PUBLIC_ERROR_CODES];`, used at build.ts:190). Neither `WEBHOOK_ENDPOINT_NOT_FOUND` nor `WEBHOOK_EVENT_NOT_FOUND` appears in the generated enum (verified against apps/docs/src/generated/openapi.json: both are absent; the only WEBHOOK_* code present is `WEBHOOK_SIGNATURE_INVALID`). So the docs tell a developer the only 404-ish codes that exist are things like `CLIENT_RESOURCE_NOT_FOUND`.

**What the code does**

packages/errors/src/codes.ts:260-333 (`PUBLIC_ERROR_CODES`) lists a *_NOT_FOUND code for every other resource family (CUSTOMER_NOT_FOUND:279, PLAN_NOT_FOUND:281, SUBSCRIPTION_NOT_FOUND:295, INVOICE_NOT_FOUND:300, SETTLEMENT_NOT_FOUND:323 …) but OMITS WEBHOOK_ENDPOINT_NOT_FOUND and WEBHOOK_EVENT_NOT_FOUND (which do exist, codes.ts:110-111). packages/errors/src/codes.ts:335-336 `export const toPublicErrorCode = (code) => PUBLIC_ERROR_CODES.has(code) ? code : NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR;` and apps/api/src/shared/http/error-handler.ts:40 `const publicCode = toPublicErrorCode(internalCode);` + :55-58 `message: publicCode === NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR ? 'Internal server error' : ...`. The throw sites all use the masked code: packages/sara/src/webhooks/endpoints.ts:84-88 (`getWebhookEndpoint` → NotFound, WEBHOOK_ENDPOINT_NOT_FOUND), endpoints.ts:196-200 (`disableWebhookEndpoint`), packages/sara/src/webhooks/deliveries.ts:112-118 (`loadJoinedDelivery` → also mislabels a missing DELIVERY as WEBHOOK_ENDPOINT_NOT_FOUND). Worse, apps/api/src/apps/main/modules/even

*…trimmed (241 more chars — see the cited files).*

**Impact.** A developer who typos a webhook id on GET/PATCH/DELETE /v1/webhooks/{id}, POST /v1/webhooks/{id}/rotate-secret, GET/POST .../deliveries/{deliveryId}[/replay], or GET /v1/events/{id} receives HTTP 404 with `{"code":"SYSTEM_INTERNAL_ERROR","message":"Internal server error","hint":"Something failed on our side. Retry shortly; if it persists, contact support with the requestId..."}` (hint text from codes.ts:858). They will retry, then open a support ticket, instead of fixing their id. Ten operations across two resources are affected. It is also the only resource family in the API where a not-found is not self-describing, so it directly falsifies the project's "zero-gotchas" premise.

**Fix.** packages/errors/src/codes.ts — add two lines to the PUBLIC_ERROR_CODES set (next to the other resource not-founds, e.g. after line 278): `NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND,` and `NOMBAONE_ERROR_CODES.WEBHOOK_EVENT_NOT_FOUND,`. Then apps/api/src/apps/main/modules/events/controllers/get-event.ts:29 — change the third argument from `NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR` to `NOMBAONE_ERROR_CODES.WEBHOOK_EVENT_NOT_FOUND`. Then packages/sara/src/webhooks/deliveries.ts:116 — change `NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND` to a delivery-specific code (add `WEBHOOK_DELIVERY_NOT_FOUND` to codes.ts and to the public set) so a missing delivery is not reported as a missing endpoint. Regenerate apps/docs/src/generated/openapi.json so the ApiError enum and the /errors page pick the new codes up.

**Files.** `packages/errors/src/codes.ts`, `apps/api/src/apps/main/modules/events/controllers/get-event.ts`, `packages/sara/src/webhooks/deliveries.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct but mis-scoped and over-severed. Accurate version:
> 
> (a) PUBLIC_ERROR_CODES (packages/errors/src/codes.ts:260-333) omits WEBHOOK_ENDPOINT_NOT_FOUND and WEBHOOK_EVENT_NOT_FOUND, so toPublicErrorCode (:335-336) masks them to SYSTEM_INTERNAL_ERROR and error-handler.ts:55-58 replaces the message with 'Internal server error'. The response is HTTP **404** (not 500 — the AppError status is preserved; the workbench console plan doc's '500' claim is itself wrong) carrying code SYSTEM_INTERNAL_ERROR and a 'retry / contact support' hint. Affected: GET/PATCH/DELETE /v1/webhooks/{id}, POST /v1/webhooks/{id}/rotate-secret, GET /v1/webhooks/{id}/deliveries/{deliveryId}, 
> 
> *…trimmed (1413 more chars — see the cited files).*
> Reachability and mechanism are accurate; the severity is inflated. The HTTP status is still a correct 404 (AppError.NotFound sets status; error-handler.ts:38 preserves it) — only the body's `code`/`message`/`hint` are masked. Clients and SDKs branch on the status, so nothing retries a 404 and no automated harm follows; the impact is confined to a confusing, self-contradictory error payload for a human integrator across the 10 webhook/event operations. Real DX bug, no money/auth/data-integrity/leak dimension → medium, not critical. Note also that the fix is two-part: adding WEBHOOK_ENDPOINT_NOT_FOUND / WEBHOOK_EVENT_NOT_FOUND to PUBLIC_ERROR_CODES does NOT fix GET /v1/events/{id}, because app
> 
> *…trimmed (113 more chars — see the cited files).*

---

## E3. 🔴 POST /v1/payment-methods/setup takes a REAL charge (amountInKobo) that is never credited, applied, or refunded — no doc says so

**What we publish**

apps/docs/content/guides/start-a-subscription.mdx:18-33 — "Pull rails need an authorized instrument on file. Start a setup: the customer authorizes (and, for a card, may complete a bank OTP step) at the returned link:" … curl body `"amountInKobo": 250000` … "The customer is sent to complete authorization, then returned to your `callbackUrl`. The resulting payment method is what you charge each cycle." No sentence anywhere in the docs states that `amountInKobo` is money actually taken from the customer. The generated reference page (/reference/payment-methods/setup) shows `amountInKobo` as a bare `integer` with NO description (apps/docs/src/generated/openapi.json, POST /v1/payment-methods/setup body: `{"amountInKobo":{"type":"integer","exclusiveMinimum":true,"minimum":0}}` — no `description` key).

**What the code does**

apps/api/src/shared/services/payment-methods/attach.ts:44-59 posts a real Nomba checkout order for that amount: `endpoint: NOMBA_ENDPOINTS.checkoutOrder, body: { tokenizeCard: true, order: { orderReference: reference, amount: koboToNombaAmount(input.amount), currency: 'NGN', … } }`. `koboToNombaAmount` (packages/sara/src/nomba/money.ts:15) = `(kobo / 100).toFixed(2)` → 250000 kobo is sent to Nomba as `"2500.00"` naira. When the `payment_success` webhook returns, apps/api/src/shared/services/payment-methods/settle.ts:30-37 only calls `captureCardToken` (persists the tokenKey) and returns `{ outcome: 'captured' }`. Grep of apps/api/src/shared/services/payment-methods/ for `grantCredit|postTransaction|applyPayment|markPaid` returns ZERO hits — the collected ₦2,500 is never granted as customer credit, never applied to an invoice, and never reversed. The zod comment (packages/core-contracts/src/validations/payment-method.ts:14 `// kobo — the validation charge`) is the only place in the repo that admits it is a charge, and it is not a public surface.

**Impact.** A developer following the first step of the "Start a subscription" guide charges every customer ₦2,500 at signup. The money leaves the customer's card, lands in the merchant's Nomba balance, and is invisible to the billing engine — not a credit grant, not an invoice payment, and there is no endpoint to refund it. On a 1,000-customer onboarding that is ₦2.5M of unreconciled, undocumented collection.

**Fix.** Two changes. (1) apps/docs/content/guides/start-a-subscription.mdx: after line 33, add an explicit Callout: "`amountInKobo` is a REAL charge on the customer's card at the hosted checkout — it is how the card is validated. It is not automatically refunded and is not credited to the customer's balance. Use the smallest amount your bank accepts (e.g. `5000` = ₦50) and refund or credit it yourself if you don't intend to keep it." and change the sample from `250000` to `5000` to match the SDK's own `// ₦50 validation charge` (nombaone-node/src/resources/payment-methods.ts:92). (2) packages/core-contracts/src/validations/payment-method.ts:14 — add `.describe('The validation charge, in integer kobo. This amount is ACTUALLY CHARGED to the customer at the hosted checkout and is not auto-refunded.')` so the OpenAPI snapshot and every generated reference page carry the warning.

**Files.** `apps/docs/content/guides/start-a-subscription.mdx`, `packages/core-contracts/src/validations/payment-method.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct but should be framed as a documentation + reconciliation gap on an intentional, provider-required charge rather than a runaway code defect. Accurate version: POST /v1/payment-methods/setup mints a real Nomba hosted-checkout order for `amountInKobo` (a card-tokenization "validation charge" that Nomba requires; zod forces it > 0, so it cannot be zeroed). The engine treats the resulting payment_success purely as a token capture — no settlement row, no ledger post, no invoice payment, no customer credit — and because /v1/settlements/{id}/refund needs a settlement row that this flow never creates, there is no API path to give the money back. Two things are genuine
> 
> *…trimmed (713 more chars — see the cited files).*
> The finding is accurate on impact and reachability. Two precision refinements, neither of which reduces severity: (1) "invisible to the billing engine" is slightly overstated — the payment_success webhook IS persisted as a raw audit row by recordInboundEvent (process.ts:104-111), so a trace exists; but it never becomes a ledger credit, invoice payment, or settlement, so the operative claim (no credit, no application, no refund handle, no reconciliation) is correct. (2) The money lands in the MERCHANT's own Nomba balance, so the merchant does not lose funds — the harm falls on their end customers, who are charged and receive nothing. That makes it a customer-harm, chargeback, and conduct-risk
> 
> *…trimmed (295 more chars — see the cited files).*

---

## E4. 🔴 POST /v1/settlements/{id}/refund never returns money to the customer — it is a ledger-only entry that credits platform_revenue, but three docs pages say it "credits back the payer"

**What we publish**

apps/docs/content/guides/refunds-payouts-settlement.mdx:17 "A refund reverses a settled charge back toward the payer." and :29-31 "it debits the organization's settlement balance and **credits back the payer**". apps/docs/content/merchants/read-a-settlement.mdx:38-39 "**Refund**: you can refund a customer's payment. The platform fee on it is not refunded; **the rest goes back to the customer**." apps/docs/content/concepts/settlement-and-sub-accounts.mdx:32 "**Refund**: reverses **only the organization's leg** back toward the payer".

**What the code does**

apps/api/src/shared/services/settlement/refund.ts:119-126 posts `entries: [{ accountId: tenantAccount.id, direction: 'debit', ...}, { accountId: revenue.id, direction: 'credit', ...}]` where `revenue` is `ensureAccount(tx, ctx, { key: 'platform_revenue', kind: 'revenue' })` (refund.ts:118). The payer is never credited. refund.ts:92 inserts the row with `status: 'ledger_only'`, and refund.ts:23-24 states outright: "The real money return to the end-user is a separate, provider-guarded step (the row stays `ledger_only`, `provider_reference` null)." There is NO refund endpoint at all in packages/sara/src/nomba/endpoints.ts (NOMBA_ENDPOINTS, lines 35-70 — only tokenIssue/checkoutOrder/tokenizedCard*/bankLookup/bankTransfer), and no `client.request` call exists anywhere in apps/api/src/shared/services/settlement/refund.ts. Unlike payout (payout.ts:159 `if (input.payoutEnabled)`), refund has no provider flag to even turn on.

**Impact.** A developer or merchant calls the refund endpoint, gets HTTP 201 with `{"status": "ledger_only"}`, and reasonably believes (because all three docs pages say so) that the customer has been refunded. The customer receives nothing. Support tickets, chargebacks, and regulatory exposure follow. This is the single worst kind of docs error: the docs promise a money movement the code provably does not perform, on a page whose whole purpose is "move money back out".

**Fix.** Two changes. (1) apps/docs/content/guides/refunds-payouts-settlement.mdx:17 — replace "A refund reverses a settled charge back toward the payer" with "A refund reverses the organization's leg of a settled charge **in the ledger**. The money is NOT yet returned to the payer: the response comes back with `status: \"ledger_only\"` and `providerReference: null`. Returning funds to the customer is a separate provider step that is not yet live — issue the customer refund out-of-band." Delete the words "and credits back the payer" from the Callout at :29-31 (the credit leg goes to `platform_revenue`, not the payer). Add a `<Callout type="warning">` naming the `ledger_only` status. (2) Apply the same correction to merchants/read-a-settlement.mdx:38-39 and concepts/settlement-and-sub-accounts.mdx:32. Additionally document the `RefundResponseData.status` enum (`pending | ledger_only | succeeded | 

*…trimmed (94 more chars — see the cited files).*

**Files.** `apps/docs/content/guides/refunds-payouts-settlement.mdx`, `apps/docs/content/merchants/read-a-settlement.mdx`, `apps/docs/content/concepts/settlement-and-sub-accounts.mdx`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: POST /v1/settlements/{id}/refund is a ledger-only reversal — it debits the org's tenant_settlement liability and credits platform_revenue (the exact inverse of the tenant leg of the collection split), inserts the refund row with status 'ledger_only' and providerReference null, and never triggers any provider transfer (no refund endpoint exists in NOMBA_ENDPOINTS, and unlike payout there is no enable flag). No money reaches the end customer. Two docs pages state the contrary without caveat and must be fixed: guides/refunds-payouts-settlement.mdx:17,29-31 ("credits back the payer") and merchants/read-a-settlement.mdx:38-39 ("the rest goes back to the customer"). The third pag
> 
> *…trimmed (795 more chars — see the cited files).*
> Accurate version: POST /v1/settlements/{id}/refund is live and ungated in production and posts a ledger-only reversal (debit tenant_settlement / credit platform_revenue, status 'ledger_only', providerReference null) — no provider money-return leg exists, and unlike payout there is no flag to enable one. Three docs pages state or imply the payer is credited, which is false; additionally the reversed amount accrues to platform_revenue, not to the payer. Beyond the docs, apps/console/src/components/console/settlements/settlement-buttons.tsx ships a merchant-facing "Issue refund" button on the same endpoint, so the misleading promise reaches non-technical merchants (and thus their customers) wit
> 
> *…trimmed (150 more chars — see the cited files).*

---

## E5. 🔴 The auto-generated "Example request body" for POST /v1/coupons is guaranteed to 422 — four separate validation failures

**What we publish**

apps/docs/src/components/reference/api-operation.tsx:105-110 renders `requestExample(op.bodySchema)` under the heading "Example request body", and apps/docs/src/lib/api-ref/snippets.ts feeds the same object into all 10 language snippets. For POST /v1/coupons the generated object is (I ran the generator against apps/docs/src/generated/openapi.json):
```json
{"code":"string","duration":"once","amountOffInKobo":0,"percentOff":20,"durationInCycles":0,"redeemBy":"2026-07-01T09:30:00Z","maxRedemptions":0,"metadata":{"orderId":"ord_8812"}}
```

**What the code does**

packages/core-contracts/src/validations/coupon.ts:3-21 rejects that body four times over:
```
amountOffInKobo: z.coerce.number().int().positive().optional(),
durationInCycles: z.coerce.number().int().positive().optional(),
maxRedemptions:   z.coerce.number().int().positive().optional(),
}).refine((d) => (d.amountOffInKobo != null) !== (d.percentOff != null), {
  message: 'exactly one of amountOffInKobo or percentOff must be set',
```
Executed against the real schema, the documented body yields:
["amountOffInKobo: Number must be greater than 0", "durationInCycles: Number must be greater than 0", "maxRedemptions: Number must be greater than 0", "amountOffInKobo: exactly one of amountOffInKobo or percentOff must be set"]
Root cause is apps/docs/src/lib/api-ref/samples.ts:102-114 `requestExample()`, which emits EVERY property (required and optional) with no awareness of XOR refinements or `.positive()` bounds. PATCH /v1/coupons/{id} is broken the same way (`{"redeemBy":…,"maxRedemptions":0,…}` → 422 on `maxRedemptions`).

**Impact.** /reference/coupons/create is the canonical reference page for creating a coupon. Every field table, every JSON example and all ten SDK snippets on it are built from a body the API rejects with 422. A developer's first coupon call fails, and the error points at `amountOffInKobo` — a field the docs told them to send. This is the primary discount surface of the product.

**Fix.** apps/docs/src/lib/api-ref/samples.ts: (a) in `requestExample` (line 102), emit only `schema.required` fields plus an explicit per-operation opt-in list, so mutually-exclusive optionals are never both present; (b) never sample an integer as `0` when the schema carries `exclusiveMinimum` — return `minimum + 1` (or the kobo sample) instead of the `case "integer": return 0;` fallback at line 80-81. A per-operation override map (like OVERRIDES in model.ts:192) keyed `POST /v1/coupons` → `{code:"LAUNCH20", percentOff:20, duration:"repeating", durationInCycles:3}` is the smallest correct fix.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The defect is real but the mechanism and scope are partly wrong.
> 
> ACCURATE VERSION: The auto-generated "Example request body" on /reference/coupons/create IS guaranteed to 422 with exactly the four claimed errors (verified by executing the real createCouponBody against the real shipped HTML output). PATCH /v1/coupons/{id} likewise 422s on maxRedemptions: 0.
> 
> Correction 1 — SDK snippets: snippets.ts does NOT feed requestExample into the 10 language snippets. snippetBody() (snippets.ts:377-385) selects required scalar fields only, emitting {"code":"string","duration":"once"}. That body still fails, but on ONE error (the XOR refine: neither amountOffInKobo nor percentOff is set), not four. Righ
> 
> *…trimmed (784 more chars — see the cited files).*
> The core defect is real and reachable in production, but two details are off. (1) The 10 SDK snippets are NOT fed the same object — snippets.ts:377 snippetBody() emits required scalars only, producing `{"code":"string","duration":"once"}` for POST /v1/coupons. That body ALSO 422s, failing the XOR refine because NEITHER amountOffInKobo nor percentOff is present. So the page is broken twice over, by two different mechanisms, which is worse than the finding describes. (2) The field table is not built from the rejected body — it derives from op.bodyFields and is accurate; only the "Example request body" block and the snippets are wrong. Also, blast radius is 5 operations, not 2: POST /v1/coupons
> 
> *…trimmed (787 more chars — see the cited files).*

---

## E6. 🟠 A payout to a bad bank account returns 503 SYSTEM_INTERNAL_ERROR — SETTLEMENT_PAYOUT_FAILED is not in PUBLIC_ERROR_CODES, and the payout guide lists only two of the three failure modes

**What we publish**

apps/docs/content/guides/refunds-payouts-settlement.mdx:65-69: "Two guards protect the money: — **`ESCROW_LOCKED`**: you tried to withdraw funds still inside the escrow window… — **`PAYOUT_EXCEEDS_AVAILABLE`**: the amount is more than the available balance." Those are presented as the complete set of things that can go wrong on POST /v1/settlements/payout.

**What the code does**

apps/api/src/shared/services/settlement/payout.ts:121-137 — before either guard can even matter, the payout resolves the beneficiary via `NOMBA_ENDPOINTS.bankLookup`, and on failure marks the row `status: 'failed', failureReason: 'bank_lookup_failed'` and throws `AppError.ServiceUnavailable('bank account lookup failed', { reference: claimed.reference }, NOMBAONE_ERROR_CODES.SETTLEMENT_PAYOUT_FAILED)`. `SETTLEMENT_PAYOUT_FAILED` exists (packages/errors/src/codes.ts:195) but is NOT in the `PUBLIC_ERROR_CODES` set (codes.ts:260-333 includes SETTLEMENT_NOT_FOUND:323 and SETTLEMENT_SUBACCOUNT_NOT_FOUND:324 but not SETTLEMENT_PAYOUT_FAILED), so packages/errors/src/codes.ts:335-336 `toPublicErrorCode` collapses it to `SYSTEM_INTERNAL_ERROR`, and apps/api/src/shared/http/error-handler.ts:55-58 replaces the message with the literal string `'Internal server error'`. Confirmed absent from the ApiError enum in apps/docs/src/generated/openapi.json. Additionally, the third documented-nowhere failure is a positive-amount check that reuses the wrong code: payout.ts:65-71 throws `PAYOUT_EXCEEDS_AVAIL

*…trimmed (120 more chars — see the cited files).*

**Impact.** A developer passes a bank code / account number pair that Nomba cannot resolve (a typo, a closed account — the single most common payout failure in Nigeria). They get HTTP 503, `code: "SYSTEM_INTERNAL_ERROR"`, `message: "Internal server error"`, and the hint "Something failed on our side. Retry shortly; if it persists, contact support" (codes.ts:858). The actual cause — *your account number is wrong* — is recorded in the payout row's `failureReason: 'bank_lookup_failed'` but never surfaced. They retry the same bad account in a loop, then escalate to support. Meanwhile the guide told them there were only two ways a payout can fail, neither of which is this one.

**Fix.** (1) packages/errors/src/codes.ts — add `NOMBAONE_ERROR_CODES.SETTLEMENT_PAYOUT_FAILED,` to the `PUBLIC_ERROR_CODES` set (alongside SETTLEMENT_NOT_FOUND at line 323), and give it a hint that names the real cause, e.g. "The beneficiary bank account could not be resolved. Check `bankCode` and `accountNumber`." (2) apps/docs/content/guides/refunds-payouts-settlement.mdx:65-69 — change "Two guards" to "Three guards" and add: "- **`SETTLEMENT_PAYOUT_FAILED`**: the beneficiary bank account could not be resolved (bad `bankCode`/`accountNumber`). The payout row is recorded as `failed` with `failureReason: \"bank_lookup_failed\"`; no funds moved." (3) Regenerate apps/docs/src/generated/openapi.json.

**Files.** `packages/errors/src/codes.ts`, `apps/docs/content/guides/refunds-payouts-settlement.mdx`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct in substance, with one factual fix and one clarification:
> 
> FIX — the failureReason is NOT persisted. The auditor writes that the cause "is recorded in the payout row's failureReason: 'bank_lookup_failed' but never surfaced." It is not recorded at all. The update at payout.ts:128-131 executes inside the txDb.transaction() callback, and the throw on line 132 propagates out of that callback, so Drizzle rolls back BOTH the failureReason write and the payout row insert (lines 89-103). There is no forensic record on the wire, in the docs, or in the payouts table — only a server-side logger.error line. This makes the DX marginally worse than the finding states.
> 
> CLARIFICATION
> 
> *…trimmed (1327 more chars — see the cited files).*
> Reachability and the core defect are confirmed: the route is unconditionally mounted, the bankLookup runs regardless of NOMBA_PAYOUT_ENABLED, SETTLEMENT_PAYOUT_FAILED is not public, and the guide's "two guards" list is incomplete. Two corrections. (1) The impact narrative's claim that the cause "is recorded in the payout row's failureReason: 'bank_lookup_failed'" is FALSE — that update runs inside the txDb.transaction callback and the AppError.ServiceUnavailable throw rolls the whole transaction back, so neither the failed status nor the payout row survives. The only trace is the server error log / request_logs row keyed by requestId. This makes the opacity marginally worse for the developer
> 
> *…trimmed (956 more chars — see the cited files).*

---

## E7. 🟠 Adding `.strict()` to the request bodies is a BREAKING contract change to a live API — the spec's `additionalProperties: false` is a generator artifact, not a promise anyone is keeping

**What we publish**

Two findings say: append `.strict()` to createPlanBody / createPriceBody / updateCustomerBody / etc. so the published `additionalProperties: false` becomes true and a typo'd `interval_count` 422s instead of silently billing monthly.

**What the code does**

zod v3's default `unknownKeys` is `strip`, and zod-to-json-schema emits `additionalProperties: false` for BOTH `strip` and `strict` (it describes the parsed OUTPUT type). So the spec is not lying by accident — it is describing the output shape. Today every live integrator who sends an extra key gets a 200 and the key silently dropped. Flipping to `.strict()` turns those calls into 422s, retroactively, for every already-integrated merchant.

**Impact.** If any live caller currently sends a field the schema does not declare — a legacy `currency: "NGN"`, a client-side `idempotencyKey` in the body, a framework-injected `_csrf`, an SDK that got ahead of the server — that integration breaks the moment the change deploys, on a payments API, with no warning and no version gate. You would be converting a silent-but-working call into a hard failure.

**Fix.** Do NOT flip `.strict()` as a bug fix. Two safer orderings, pick one:

PREFERRED (spec-side, zero behavior change): change the generator so the spec stops claiming strictness — set zodToJsonSchema's `removeAdditional`/`additionalProperties` handling in apps/api/src/shared/openapi/build.ts:26 so non-strict objects emit `additionalProperties: true` (or omit it). The published contract then matches the server, no live caller breaks, and the docs stop promising a rejection the API does not perform.

IF you genuinely want strict rejection (it is the better long-term contract): (a) land the spec-side truth first; (b) add a per-request WARNING path — log/emit unknown keys via the request_logs subsystem for 2-4 weeks and look at what merchants actually send; (c) only then flip `.strict()`, announce it in apps/docs/content/changelog.mdx, and ship it as a dated breaking change. Note settings.ts:20 

*…trimmed (420 more chars — see the cited files).*

**Files.** `apps/api/src/shared/openapi/build.ts`, `packages/core-contracts/src/validations/plan.ts`, `packages/core-contracts/src/validations/price.ts`, `packages/core-contracts/src/validations/customer.ts`

---

## E8. 🟠 DELETE /v1/customers/{id}/discount is the only op in the group with no response schema — spec and docs say it returns `{}`, the API returns a full Discount

**What we publish**

apps/api/src/shared/openapi/responses.ts:413-422 — the Customers block of `RESPONSE_DATA_BY_ROUTE` maps seven routes and omits the DELETE discount:
```ts
  // Customers
  'get /v1/customers': { ref: 'Customer', list: true },
  ...
  'post /v1/customers/{id}/discount': { ref: 'Discount' },   // <- no 'delete /v1/customers/{id}/discount'
```
Consequently apps/docs/src/generated/openapi.json documents the op as `"data": {"type": "object", "description": "Resource payload"}`, and /reference/customers/remove-discount renders "Example response (200)" as `{"success": true, "statusCode": 200, "data": {}, …}`.

**What the code does**

apps/api/src/apps/main/modules/customers/controllers/remove-customer-discount.ts:21-22 returns a fully-populated Discount:
```ts
const data = await removeDiscount(db, ctx, { customerRef: req.params.id ?? '' });
return { data };
```
and apps/api/src/shared/services/discounts/remove.ts:69 ends with `return getDiscountByReference(txDb, ctx, discount.reference);` → a `DiscountResponseData` with `domain, id, couponId, customerId, subscriptionId, status: 'ended', cyclesRemaining, startAt, endAt, mode, createdAt` (packages/core-contracts/src/types/discount.ts:5-17). The `Discount` schema already exists in responses.ts:170-182 and is used by the POST on the same path.

**Impact.** Every SDK generated from the spec types the remove-discount return as an untyped `object`/`any`, and a developer reading /reference/customers/remove-discount sees an empty payload and writes no result handling — so they never learn that the response carries `endAt` (the moment the discount stopped) and `status: "ended"`, which is the only confirmation the removal took effect. The identical omission hits `delete /v1/subscriptions/{id}/discount` (responses.ts:449 maps only the POST), so both discount-removal endpoints in the product are affected.

**Fix.** apps/api/src/shared/openapi/responses.ts: add `'delete /v1/customers/{id}/discount': { ref: 'Discount' },` after line 422, and `'delete /v1/subscriptions/{id}/discount': { ref: 'Discount' },` after line 449. Then regenerate apps/docs/src/generated/openapi.json.

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The mapping omission is real and the DELETE /v1/customers/{id}/discount op genuinely ships as `data: {type:"object"}` in openapi.json while the API returns a full Discount (status:"ended", endAt). But it is NOT a two-endpoint discount bug: RESPONSE_DATA_BY_ROUTE is missing eight ops that return real typed payloads — delete /v1/customers/{id}/discount, delete /v1/subscriptions/{id}/discount, delete /v1/webhooks/{id} (returns WebhookEndpoint), get /v1/mandates/{id}, get /v1/settlements/escrow, post /v1/settlements/payout, post /v1/settlements/{id}/refund, get /v1/events/catalog — so the fix is a sweep of the map, not two added lines. The SDK-typing impact is hypothetical (no SDK is generated f
> 
> *…trimmed (401 more chars — see the cited files).*
> The defect is real and production-reachable, but it is not limited to the two discount DELETEs and it is not high severity. Accurate statement: RESPONSE_DATA_BY_ROUTE is incomplete for 13 of 83 operations in the shipped spec — `delete /v1/customers/{id}/discount`, `delete /v1/subscriptions/{id}/discount`, `get /v1/mandates/{id}`, `delete /v1/webhooks/{id}`, `get /v1/settlements/escrow`, `post /v1/settlements/payout`, `post /v1/settlements/{id}/refund`, `get /v1/events/catalog`, `get /v1/health`, the three /v1/sandbox/* routes, and `get /v1/openapi.json` — all of which render `data` as an untyped `{"type":"object","description":"Resource payload"}`. The API returns a SUPERSET of the documente
> 
> *…trimmed (498 more chars — see the cited files).*

---

## E9. 🟠 DELETE /v1/payment-methods/{id} advertises a required Idempotency-Key that the middleware structurally ignores (not merely optional — inert)

**What we publish**

apps/docs/src/generated/openapi.json, DELETE /v1/payment-methods/{id}: `"parameters": [{"name":"id",…},{"name":"Idempotency-Key","in":"header","required":true,"schema":{"type":"string"}}]` — emitted unconditionally by apps/api/src/shared/openapi/build.ts:128-130 (`if (MUTATING.has(method)) { parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, … }); }`, where `MUTATING = new Set(['post','put','patch','delete'])` at build.ts:22).

**What the code does**

Beyond the known "required vs optional" mislabel, on DELETE the header is not optional — it is a no-op. apps/api/src/apps/main/modules/payment-methods/routes.ts:83-90 mounts `idempotencyOptional`, and apps/api/src/shared/middlewares/idempotency.ts:51-55 short-circuits before any dedup logic runs: `// Only mutating POSTs participate. Anything else flows straight through.  if (req.method !== 'POST') { next(); return; }`. So a client that dutifully sends an `Idempotency-Key` on DELETE gets zero replay protection — the key is read by nobody, and `removePaymentMethod` (apps/api/src/shared/services/payment-methods/remove.ts:22-31) relies on its own status check (`if (found.method.status === 'removed') return …`) for idempotence.

**Impact.** A client library (or a careful integrator) that reads the spec and sends an `Idempotency-Key` on DELETE believes retries are deduplicated at the platform. They are not — the header is discarded. Here the operation happens to be naturally idempotent, so nothing breaks today, but the spec asserts a guarantee the middleware cannot provide on any non-POST verb, and the same mislabel is emitted for every PUT/PATCH/DELETE in the API.

**Fix.** apps/api/src/shared/openapi/build.ts:128 — narrow the header emission to the verbs that actually participate and reflect true strictness: replace `if (MUTATING.has(method))` with `if (method === 'post')` and set `required` from the route's real middleware (thread a flag off the router stack the same way `collectRoutes` already reads `OPENAPI_SCHEMAS` at build.ts:48-51, tagging `idempotency` vs `idempotencyOptional`). Alternatively, if idempotent DELETE/PATCH is intended, drop the `req.method !== 'POST'` short-circuit at apps/api/src/shared/middlewares/idempotency.ts:52 — but the spec and the middleware must agree.

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/api/src/shared/middlewares/idempotency.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate as written. Two refinements worth carrying into the fix: (1) The root cause is a two-way mismatch, not just an over-strict `required` flag. build.ts should only emit the header for operations that actually participate — i.e. POSTs mounted with `idempotency` (required: true) or `idempotencyOptional` (required: false) — rather than keying off the HTTP verb via MUTATING. Simply flipping `required: true` → `false` would still advertise a header that does nothing on the 13 non-POST ops. (2) apps/api/src/apps/main/modules/payment-methods/routes.ts:27-35 contains a comment asserting idempotency is "OPTIONAL ... on the management routes (virtual-account/default/delete)", whic
> 
> *…trimmed (338 more chars — see the cited files).*
> The finding is accurate but under-scoped and under-rated. Two corrections: (1) The inert short-circuit disables the REQUIRED `idempotency` middleware too, not just `idempotencyOptional` — so DELETE /v1/customers/:id/credit/:grantId (customers/routes.ts:122-129), which the author mounted with the REQUIRED variant precisely because "money moves" (doc-comment line 39), gets neither dedup nor the missing-key 400. (2) The claim "the operation happens to be naturally idempotent, so nothing breaks today" is false for that route: void-customer-credit.ts passes the raw pool (no tx) and credits/void.ts calls postTransaction BEFORE its `isNull(voidedAt)`-guarded UPDATE, and postTransaction mints a fres
> 
> *…trimmed (680 more chars — see the cited files).*

---

## E10. 🟠 Dunning guide tells you to cut access on `subscription.canceled`, but dunning exhaustion emits `subscription.churned` — and the cancellation is not "per your policy", it is unconditional

**What we publish**

apps/docs/content/guides/dunning-and-recovery.mdx:77 — "- **`subscription.canceled`**: dunning exhausted (if your policy cancels). Now cut access."; :23-25 — "Each retry either recovers … or exhausts the schedule (→ the subscription stays `past_due` or cancels, per your policy)."; :30-31 — "Wait for the dunning schedule to exhaust, or for `subscription.canceled`."

**What the code does**

Exhaustion always churns and always emits `subscription.churned`: apps/api/src/shared/services/dunning/attempt.ts:367-370 — "if (exhausted) { await finishAttempt(…); await churnSubscription(txDb, ctx, sub, invoice); return; }" → apps/api/src/shared/services/subscriptions/transition.ts:254-263 `churnFromPastDue` → `transition(…, 'canceled', { event: 'subscription.churned', set: { cancellationReason: 'involuntary' } })`. There is no policy switch: BillingSettingsResponseData (packages/core-contracts/src/types/billing-settings.ts:1-14) has no cancel-on-exhaustion flag. The catalog itself draws the line: packages/core-contracts/src/types/webhook-events.ts:51-58 — `'subscription.canceled': { when: 'a subscription is canceled (voluntary)' }` vs `'subscription.churned': { when: 'a subscription is canceled involuntarily (dunning exhausted)' }`.

**Impact.** A developer who wires access revocation to `subscription.canceled` — exactly what the guide instructs — never revokes access on involuntary churn, the largest churn bucket in this product. Every customer whose card ultimately fails keeps free service indefinitely, and the merchant sees nothing, because the webhook they were told to listen for is never sent.

**Fix.** apps/docs/content/guides/dunning-and-recovery.mdx:77 → "- **`subscription.churned`**: dunning exhausted — the subscription is now `canceled` with `cancellationReason: 'involuntary'`. Now cut access." Also correct :23-25 (exhaustion always cancels; there is no policy toggle) and :30-31 (wait for `subscription.churned`).

**Files.** `apps/docs/content/guides/dunning-and-recovery.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on its core claim; two details in the impact statement should be tightened.
> 
> ACCURATE VERSION: apps/docs/content/guides/dunning-and-recovery.mdx is the only page in the docs that names the wrong event for dunning exhaustion. Line 77 tells developers to cut access on `subscription.canceled`, and lines 23-25/30-31 describe a "stays past_due or cancels, per your policy" choice. In the code, dunning exhaustion (attempt.ts:367-370 -> churnSubscription -> churnFromPastDue, transition.ts:254-263) is UNCONDITIONAL and always emits `subscription.churned`; transition() emits exactly one event, and BillingSettingsResponseData has no cancel-on-exhaustion flag, so the "policy" the 
> 
> *…trimmed (1245 more chars — see the cited files).*
> Two corrections are needed, not one. (1) The terminal event for dunning exhaustion is subscription.churned, not subscription.canceled — the bullet at :77 and the callout at :30-31 must both be fixed. (2) The "per your policy / stays past_due or cancels" framing at :23-25 is false: exhaustion always cancels and always churns; there is no policy switch (BillingSettingsResponseData has no cancel-on-exhaustion flag). The guide should list BOTH events with their meanings — subscription.churned = involuntary (dunning exhausted), subscription.canceled = voluntary — so an integrator revokes access on either.

---

## E11. 🟠 Escrow, payout, and refund have NO response schema in the OpenAPI spec — the three money-movement reference pages render an empty `"data": {}` example

**What we publish**

The generated reference promises typed responses for every operation: apps/docs/src/components/reference/api-operation.tsx:9-12 "the method + path, auth, path/query params, request-body fields, code samples in every SDK, and responses with a generated example body. Nothing hand-typed". apps/api/src/shared/openapi/responses.ts:5-7 says `RESPONSE_DATA_BY_ROUTE` "maps a route … to the schema its `data` carries".

**What the code does**

apps/api/src/shared/openapi/responses.ts:480-482 registers ONLY `'get /v1/settlements'` and `'get /v1/settlements/{id}'`. There is no entry for `get /v1/settlements/escrow`, `post /v1/settlements/payout`, or `post /v1/settlements/{id}/refund` — and `RESPONSE_SCHEMAS` (responses.ts:61-405) contains a `Settlement` schema but NO `Escrow`, `Payout`, or `Refund` schema at all (the full component list in apps/docs/src/generated/openapi.json confirms: Settlement is present, Escrow/Payout/Refund are absent). apps/api/src/shared/openapi/build.ts:84-89 therefore falls through to `{ type: 'object', description: 'Resource payload' }`. Verified in the committed snapshot: `/v1/settlements/escrow` GET, `/v1/settlements/payout` POST and `/v1/settlements/{id}/refund` POST all have `data: {"type": "object", "description": "Resource payload"}`. Because apps/docs/src/lib/api-ref/samples.ts:88 returns `{}` for an object schema with no `properties`, the "Example response" block on each of those three reference pages renders literally `"data": {}`. (`delete /v1/webhooks/{id}` and `get /v1/events/catalog` a

*…trimmed (17 more chars — see the cited files).*

**Impact.** The three endpoints that move real money are the three with no documented response. A developer calling `GET /v1/settlements/escrow` cannot learn from the docs that the response carries `lockedInKobo`, `since`, `balanceInKobo`, `minWithdrawableInKobo`, `availableInKobo` (packages/core-contracts/src/types/settlement.ts:50-57) — the guide at guides/refunds-payouts-settlement.mdx:50-51 just says "The response shows the locked amount" and names no field. Same for `PayoutResponseData` (11 fields incl. `status`, `failureReason`) and `RefundResponseData` (the `ledger_only` status). Any SDK generated from this spec types these three calls as `any`/`object`, so nine SDKs lose type safety on exactly t

*…trimmed (31 more chars — see the cited files).*

**Fix.** apps/api/src/shared/openapi/responses.ts — add three schemas to `RESPONSE_SCHEMAS` mirroring packages/core-contracts/src/types/settlement.ts: `Escrow: allRequired({ domain: enm('escrow'), lockedInKobo: int(), since: dt(), balanceInKobo: int(), minWithdrawableInKobo: int(), availableInKobo: int() })`; `Payout: allRequired({ domain: enm('payout'), id: str(), subAccountRef: str(), amountInKobo: int(), bankCode: str(), accountNumber: str(), resolvedAccountName: nstr(), status: enm('pending','ledger_posted','succeeded','failed'), providerReference: nstr(), failureReason: nstr(), createdAt: dt() })`; `Refund: allRequired({ domain: enm('refund'), id: str(), settlementReference: str(), subAccountRef: str(), amountInKobo: int(), status: enm('pending','ledger_only','succeeded','failed'), providerReference: nstr(), createdAt: dt() })`. Then add to `RESPONSE_DATA_BY_ROUTE` after line 482: `'get /v1/

*…trimmed (251 more chars — see the cited files).*

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The core mechanism is confirmed exactly as claimed: RESPONSE_DATA_BY_ROUTE (responses.ts:480-482) maps only the two settlement reads, RESPONSE_SCHEMAS has no Escrow/Payout/Refund schema, build.ts:89 falls through to {type:'object', description:'Resource payload'}, and samples.ts:88 turns that into a literal `"data": {}` on the three generated reference pages (/reference/settlements/escrow, /create-payout, /refund — curated in model.ts:227-230, routes unconditionally mounted, no gate). Corrections: (a) the gap is wider than reported — nine public routes are unmapped, adding GET /v1/mandates/{id}, DELETE /v1/customers/{id}/discount and DELETE /v1/subscriptions/{id}/discount to the auditor's li
> 
> *…trimmed (548 more chars — see the cited files).*
> The facts hold (routes unmapped, pages render "data": {}) and the surface is production-public and integrator-facing, but two parts need correction. First, "any SDK generated from this spec types these three calls as any/object, so nine SDKs lose type safety" is unproven: the nine SDKs are separate repos (registry.ts:12 references ../nombaone-<id>/) with no codegen linkage to openapi.json anywhere in this repo, so SDK type safety is not demonstrably affected. The real downstream exposure is narrower — third parties generating a client from the publicly served GET /v1/openapi.json get an untyped object. Second, this is not money-endpoint-specific: 13 of 83 operations hit the same fallthrough 
> 
> *…trimmed (387 more chars — see the cited files).*

---

## E12. 🟠 Every generated price sample — the reference example body AND all 10 SDK snippets — ships `"interval": "day"`; the generator's own month-preference is dead code

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:25-27 states the intent: "Prefer the canonical case over enum[0] — the enum list is append-ordered, so whichever unit happens to sit first should not decide what every sample shows." `if (n === "interval") return schema.enum?.includes("month") ? "month" : ...`. Every hand-written doc agrees: apps/docs/content/guides/create-plans-and-prices.mdx:27 `{ "unitAmountInKobo": 500000, "interval": "month" }`, content/getting-started/your-first-subscription.mdx:71 `"interval": "month"`, content/concepts/money-is-integer-kobo.mdx:25-27 `// A ₦5,000/month price`.

**What the code does**

apps/docs/src/lib/api-ref/samples.ts:71 — `if (s.enum && s.enum.length) return s.enum[0];` runs BEFORE `const named = byName(name, s);` at samples.ts:73. `interval` is an enum, so the enum branch always wins and the month-preference at samples.ts:27 is unreachable. `PRICE_INTERVALS[0]` is `'day'` (packages/core-contracts/src/billing/interval.ts:35). I executed the generator against the committed openapi.json: /reference/plans/create-price renders `Example request body` = `{"unitAmountInKobo": 250000, "interval": "day", "intervalCount": 1, ...}`, and snippets.ts:377-384 `snippetBody` feeds the same value into all 10 languages (cURL, Node, Python, Go, Ruby, PHP, Java, Rust, .NET, Elixir), each emitting `interval: "day"`. The POST /v1/plans embedded-prices example does the same.

**Impact.** The reference page a developer lands on to create a price hands them, in their own language, a copy-runnable call that creates a ₦2,500-per-DAY price. Nothing on the page flags the cadence; the money field is correct, so it looks right. Ship it and the customer is billed ~30× as often as the merchant intended — and because `day` is a legal cadence, no validation ever catches it. The reference also silently contradicts every hand-written guide, which uses `month`.

**Fix.** apps/docs/src/lib/api-ref/samples.ts — move the `byName` lookup above the enum short-circuit: swap lines 71 and 73-74 so it reads `const named = byName(name, s); if (named !== undefined) return named; if (s.enum && s.enum.length) return s.enum[0];`. That restores the documented month preference for `interval` and leaves every other enum (status, mode, domain, usageType) unchanged.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the enum fast-path at samples.ts:71 preempts byName(), making the month-preference at samples.ts:27 dead code, so every generated price sample (reference example body + all 10 SDK snippets, plus the embedded prices[] in POST /v1/plans) ships "interval": "day" — confirmed by executing the generator. Two caveats to the finding's framing: (1) it is a docs/sample-generation bug only — the API and billing engine are correct and would faithfully create the daily price the developer asked for; the operation's field table on the same page does render the full enum ("day" | "week" | "month" | "year" | "minute"), so it is a copy-paste trap rather than a hidden mispricing; (2) the sam
> 
> *…trimmed (315 more chars — see the cited files).*
> The mechanism and unreachability are accurate as stated. Two refinements to the framing: (1) the claimed impact ("customer is billed ~30x as often, no validation ever catches it") overstates the real path — the wrong value sits in the one field the developer is explicitly choosing, is echoed back in the API response, is visible in the console price list, and contradicts the snippet's own "Pro monthly" name, so it surfaces in sandbox rather than silently in production; no production runtime code is defective. (2) The blast radius is bounded to `interval`: the other enums on the same operation (usageType, billingScheme) render correctly only because enum[0] happens to equal their canonical def
> 
> *…trimmed (228 more chars — see the cited files).*

---

## E13. 🟠 Filling the plan-archive guard while the console archives by direct DB write ships an API stricter than your own UI — and archive is still one-way with no unarchive

**What we publish**

The finding says: replace `countActiveSubscribers` (apps/api/src/shared/services/plans/archive.ts:26, `async () => 0`) with the real query so PLAN_HAS_ACTIVE_SUBSCRIBERS can actually fire, and add an e2e.

**What the code does**

Confirmed: archive.ts:26 is the Phase-01 stub and its SEAM(03) comment still says 'Phase 01 has no subscriptions table'. But apps/console/src/lib/plans-actions.ts:460-476 `archivePlanAction` bypasses apps/api entirely — it does `db.update(plansTable).set({ status: 'archived' })` straight against the DB, with no subscriber guard AND without deactivating the plan's prices (which the API path does at archive.ts:92-96). Separately, PLAN_ALREADY_ARCHIVED's published hint tells merchants to 'unarchive it first' and no unarchive endpoint exists anywhere.

**Impact.** Ship the guard alone and you get an API that returns 409 while the merchant's own console button archives the same plan anyway — with a DIFFERENT side-effect profile (prices left active). You will have made the two paths diverge instead of converge, and the direct-DB path is the one merchants actually click.

**Fix.** One change, three parts, or don't ship it:
(a) Fill the seam in apps/api/src/shared/services/plans/archive.ts:26 with the query its own doc-comment specifies, scoped to ctx.organizationId + ctx.mode.
(b) Route apps/console/src/lib/plans-actions.ts:460 through the API bridge (apps/console/src/lib/api-client.ts) instead of writing plansTable directly, so the console inherits the guard AND the price deactivation. Note BRIDGE_SCOPES (api-client.ts) currently has `plans:read` but NOT `plans:write` — you must add it, which means re-minting or re-scoping existing org bridge credentials (org_bridge_credentials, migration 0019). Check whether existing rows carry the scope set or re-derive it, or the console's archive button will start 403ing.
(c) Decide the unarchive question BEFORE enabling the guard, and fix the PLAN_ALREADY_ARCHIVED hint either way. A guard plus an irreversible one-way archive

*…trimmed (171 more chars — see the cited files).*

**Files.** `apps/api/src/shared/services/plans/archive.ts`, `apps/console/src/lib/plans-actions.ts`, `apps/console/src/lib/api-client.ts`, `packages/errors/src/codes.ts`

---

## E14. 🟠 GET /v1/subscriptions/{id}/upcoming-invoice includes no prorations, discounts or credits — the proration guide says it does and tells you to quote the customer from it

**What we publish**

apps/docs/content/guides/proration-and-plan-changes.mdx:32-42 — "## Preview before you commit\n\nShow the customer the exact cost of a change before making it:\n\n```bash\ncurl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/upcoming-invoice …```\n\nThe upcoming invoice reflects proration lines so there are no surprises on the next bill."

**What the code does**

apps/api/src/shared/services/billing/upcoming.ts:43-66 — the preview is `const amount = price.unitAmount * quantity;` returning `subtotalInKobo: amount, totalInKobo: amount, amountDueInKobo: amount` and exactly one hard-coded line item `{ id: 'upcoming', kind: 'subscription', description: `${price.reference} × ${quantity}`, amountInKobo: amount, quantity }`. It never loads proration lines, the subscription's active discount, or customer credit — unlike the real cycle, which calls `finalizeInvoiceWithAdjustments` for discount + credit (apps/api/src/shared/services/billing/runCycle.ts:154). It also accepts no query parameters (apps/api/src/apps/main/modules/subscriptions/routes.ts:151-157 has no `validate({ query })`), so it cannot preview a hypothetical change at all — it previews the current (or next scheduled) price for the current period index.

**Impact.** A merchant builds the documented "exact cost before you upgrade" screen and shows the customer a number that omits the proration charge/credit, any active coupon and any credit balance — a wrong money figure shown to an end user before they click. And the documented flow is unbuildable: there is no input for the new price/quantity.

**Fix.** Fix the docs now: apps/docs/content/guides/proration-and-plan-changes.mdx:32-42 — retitle to "Preview the next invoice" and state "the preview shows the next cycle's base amount for the current (or next scheduled) price; it does not include prorations, discounts or credits, and cannot preview a hypothetical change." Longer term, extend `getUpcomingInvoice` (apps/api/src/shared/services/billing/upcoming.ts) with optional `priceId`/`quantity` query params and the same discount/credit/proration math as `finalizeInvoiceWithAdjustments`, or delete the section.

**Files.** `apps/docs/content/guides/proration-and-plan-changes.mdx`, `apps/api/src/shared/services/billing/upcoming.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but should be restated with the right mechanism. (1) The preview at apps/api/src/shared/services/billing/upcoming.ts:43-66 returns subtotal === total === amountDue and ignores both the subscription's active discount and the customer's credit balance, which the real cycle DOES apply via finalizeInvoiceWithAdjustments (runCycle.ts:155 → adjustments.ts:109-124). The preview therefore OVERSTATES the next bill for any subscription with a coupon or credit. (2) The route (routes.ts:151-157) has no validate({ query }) and accepts no priceId/quantity, so the documented "preview the cost of a change before you commit" flow cannot be built — the endpoint only previews the next cy
> 
> *…trimmed (1038 more chars — see the cited files).*
> Two separable defects, and the finding conflates them. (1) ENGINE BUG (real, high): the preview omits the subscription's active discount and the customer's credit balance, which the real cycle does apply (finalizeInvoiceWithAdjustments, runCycle.ts:154) — so amountDueInKobo over-quotes any customer with a coupon or credit, including the downgrade credit this guide's own flow grants. This is already surfaced in the merchant console (apps/console/src/lib/subscription-detail.ts:273-297), whose "Discounts & credits" row is dead code because total always equals subtotal. (2) DOC BUG (real): the endpoint takes no query params, so it cannot preview a hypothetical change at all; the guide's "show th
> 
> *…trimmed (406 more chars — see the cited files).*

---

## E15. 🟠 PATCH /v1/customers/{id} silently swallows `email` and returns 200 — the spec's `additionalProperties: false` promises a rejection the server never performs

**What we publish**

apps/docs/src/generated/openapi.json, PATCH /v1/customers/{id} request body:
```json
{"type":"object","properties":{"name":…,"phone":…,"metadata":…},"additionalProperties":false}
```
`additionalProperties: false` tells every reader and every spec-validating SDK that an unknown key — such as `email` — is rejected. No page in apps/docs/content/** states that a customer's email is immutable (grep for "immutable" across content/ returns only price/plan statements in the SDK pages).

**What the code does**

apps/api/src/shared/http/validate.ts:35 runs `req.body = schemas.body.parse(req.body)` against a plain `z.object` (packages/core-contracts/src/validations/customer.ts:13-21), and zod v3's default unknown-key policy is **strip**, not strict. Executed against the real schema:
```
parse({name:'X', email:'new@x.com'})  ->  {"name":"X"}       // 200 OK, email dropped
parse({email:'new@x.com'})            ->  "at least one field must be provided"  // 422
```
So `PATCH /v1/customers/{id}` with `{"name":"Ada O.","email":"new@x.com"}` returns **200 with the OLD email** in the response body. Immutability lives only in a code comment (apps/api/src/shared/services/customers/update.ts:13-14 "email is immutable — the natural key") and in the sara input type (customers/types.ts:21-25 `UpdateCustomerInput` has no `email`).

**Impact.** A merchant updating a customer's contact details in one PATCH (name + email together) gets a 200 and believes the email changed. It did not. Every subsequent invoice, dunning email and receipt goes to the stale address, and the API gave no signal — no 422, no warning field. The spec actively misleads here: it declares the body strict, so a developer who read it concludes an ignored key is impossible. `POST /v1/customers` behaves the same way (unknown keys stripped, not rejected), so this is the whole customers surface.

**Fix.** Two changes. (1) Enforce what the spec advertises: make the request schemas strict so an unknown key 422s — in packages/core-contracts/src/validations/customer.ts change `z.object({…})` to `z.object({…}).strict()` on `createCustomerBody` (line 5) and `updateCustomerBody` (lines 13-18, before the `.refine`). (2) Document it: add one line to the customers guide stating that `email` is the natural key and cannot be changed after creation — create a new customer instead.

**Files.** `packages/core-contracts/src/validations/customer.ts`, `apps/docs/content/guides/coupons-and-credits.mdx`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: The OpenAPI spec declares `additionalProperties: false` on request bodies while the server actually STRIPS unknown keys (zod v3 default), so unknown/misspelled fields are silently dropped with a 200 instead of the 4xx the spec promises. This is systemic — it affects every validated route in apps/api (the `zodToJsonSchema` call at apps/api/src/shared/openapi/build.ts:26 emits `additionalProperties: false` for non-strict objects), not just the customers surface. It is NOT true that "email immutability lives only in a code comment": it is enforced by the sara input type and by a DB unique index `customers_org_env_email_unique` on (organizationId, mode, email) (packages/core-db
> 
> *…trimmed (628 more chars — see the cited files).*
> Accurate version: PATCH /v1/customers/{id} silently strips unknown keys (zod v3 default) while the generated OpenAPI declares additionalProperties:false, so a merchant sending {name, email} gets 200 and the email is never changed — and there is no email-update path in the API at all, nor any doc stating email is immutable. However, the 200 response body DOES return the customer with the unchanged email (customers/serialize.ts:12), so the API is not lying in its response, only failing to reject. And apps/api sends no email itself (no mailer dependency); the stale address only leaks into the Nomba checkout/dunning action-link via customerEmail (payment-methods/attach.ts:56,120, billing/actionL
> 
> *…trimmed (177 more chars — see the cited files).*

---

## E16. 🟠 POST /v1/subscriptions/{id}/payment-method is documented as returning a Subscription; it returns a PaymentMethod

**What we publish**

apps/api/src/shared/openapi/responses.ts:448 — "'post /v1/subscriptions/{id}/payment-method': { ref: 'Subscription' }," → apps/docs/src/generated/openapi.json, POST /v1/subscriptions/{id}/payment-method → responses.200 … properties.data = { "$ref": "#/components/schemas/Subscription" }. The generated reference page (/reference/subscriptions/update-payment-method) renders its example response from that schema, and the same wrong spec is vendored into every SDK repo (e.g. /Users/mac/Vault/the-60/nombaone/nombaone-go/spec/openapi.json — same $ref).

**What the code does**

apps/api/src/apps/main/modules/dunning/controllers/update-card.ts:17-30 — `jsonHandler<PaymentMethodResponseData>(...)` … `return { data: serializePaymentMethod(method, customerRef) };`, and apps/api/src/shared/services/payment-methods/serialize.ts:13-26 returns `{ domain: 'payment_method', id, customerId, kind, status, isDefault, brand, last4, expMonth, expYear, mode, createdAt, updatedAt }`. The Node SDK already flags the discrepancy: /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:488-495 — "Returns the updated **PaymentMethod** (not the subscription) — that is what the wire actually carries, whatever the spec says."

**Impact.** Anyone generating a client from the OpenAPI document (served publicly at /v1/openapi.json for exactly that purpose) types this response as a Subscription. At runtime `data.domain` is 'payment_method', `data.status` is a payment-method status, and `currentPeriodEnd`/`items`/`latestInvoiceId` are undefined — the mid-dunning card-update call, the product's highest-stakes recovery path, fails to deserialize in every strictly-typed language.

**Fix.** apps/api/src/shared/openapi/responses.ts:448 → "'post /v1/subscriptions/{id}/payment-method': { ref: 'PaymentMethod' }," (the PaymentMethod schema already exists at responses.ts:203), then regenerate apps/docs/src/generated/openapi.json and re-vendor the spec copies in the nine SDK repos.

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is real and correctly located, but the impact is overstated. ACCURATE VERSION: The OpenAPI mapping at apps/api/src/shared/openapi/responses.ts:448 declares `{ ref: 'Subscription' }` for POST /v1/subscriptions/{id}/payment-method, while the handler (apps/api/src/apps/main/modules/dunning/controllers/update-card.ts:30) returns `serializePaymentMethod(...)` — a `domain: 'payment_method'` object. apps/api/src/shared/openapi/build.ts consumes the map verbatim with no override, so the wrong `$ref` reaches apps/docs/src/generated/openapi.json, the publicly-served /v1/openapi.json (apps/api/src/apps/main/server/routes.ts:59), the generated docs reference example (api-operation.tsx:93 ren
> 
> *…trimmed (949 more chars — see the cited files).*
> Accurate version: the OpenAPI response ref for POST /v1/subscriptions/{id}/payment-method is wrong (Subscription vs the PaymentMethod actually returned), which corrupts the publicly-served /v1/openapi.json, the generated docs reference example, and the spec/openapi.json vendored into the SDK repos. It does NOT break the shipped SDKs (hand-written; the Node client already types the return as PaymentMethod and documents the spec discrepancy), and it does not fail at runtime — only third-party clients generated from the raw spec get a wrong static type (silently empty struct in Go, deserialization error in strict Jackson/serde).

---

## E17. 🟠 Reference request examples for payment-methods/setup and /virtual-account are guaranteed 422s (callbackUrl: "string", expectedAmount: 0)

**What we publish**

The auto-generated "Example request body" blocks on the two capture endpoints (apps/docs/src/lib/api-ref/samples.ts:102-114, rendered at apps/docs/src/components/reference/api-operation.tsx:105-110) are, verbatim:
POST /v1/payment-methods/setup → `{ "customerRef": "string", "amountInKobo": 250000, "callbackUrl": "string" }`
POST /v1/payment-methods/virtual-account → `{ "customerRef": "string", "expectedAmount": 0, "expiryDate": "string" }`
(`callbackUrl` matches no `byName` rule at samples.ts:15-40 — `n === "url"` fails because `n` is `"callbackurl"` — so it falls to samples.ts:78 and yields `"string"`; `expectedAmount` matches no rule and falls to samples.ts:80-81 `case "integer": return 0`.)

**What the code does**

packages/core-contracts/src/validations/payment-method.ts:15 — `callbackUrl: z.string().url()`. The literal `"string"` is not a URL → `validate({ body: setupCardBody })` (apps/api/src/apps/main/modules/payment-methods/routes.ts:44) rejects with 422 VALIDATION_ERROR. packages/core-contracts/src/validations/payment-method.ts:54 — `expectedAmount: z.coerce.number().int().positive().optional()`, which the spec renders as `{"type":"integer","exclusiveMinimum":true,"minimum":0}` (apps/docs/src/generated/openapi.json). `0` is NOT positive → 422. Both bodies are also `additionalProperties: false`.

**Impact.** Both capture endpoints — the two ways a customer's money can ever reach the platform — ship a documented example body that cannot succeed. The virtual-account one is the nastier: `0` is a plausible-looking "no expected amount" value, so a developer reasonably believes 0 means "open account" and instead gets a validation error with no explanation of why zero is illegal (the actual way to get an open VA is to OMIT the field — attach.ts:186 `input.expectedAmount != null ? … : undefined`).

**Fix.** apps/docs/src/lib/api-ref/samples.ts — in `byName()` (line 15), add before the `/id$/i` rule: `if (/url$/i.test(name)) return "https://example.com/billing/return";`, `if (/amount$/i.test(name)) return 250_000;`, and `if (/date$/i.test(name)) return "2026-08-01T00:00:00";`. Additionally, since `expectedAmount` is optional and 0 is illegal, teach `requestExample()` (samples.ts:102) to emit only required fields plus optionals with legal sample values. Also add `.describe(...)` to `callbackUrl` and `expectedAmount` in packages/core-contracts/src/validations/payment-method.ts so the field tables explain them.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`, `packages/core-contracts/src/validations/payment-method.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct as written, with one amendment that broadens (not narrows) it. For POST /v1/payment-methods/setup the poisoned `callbackUrl: "string"` is not limited to the "Example request body" JSON block — because `snippetBody` (apps/docs/src/lib/api-ref/snippets.ts:376-384) includes all *required* scalar fields and all three of setup's fields are required, the same `"string"` value is emitted into the cURL sample and all nine SDK snippets, so every copy-runnable sample on that page 422s. For POST /v1/payment-methods/virtual-account the opposite is true: only `customerRef` is required, so `snippetBody` emits `{customerRef}` alone and the SDK snippets are valid; the `expectedAmount:
> 
> *…trimmed (420 more chars — see the cited files).*
> The finding is factually correct but mis-scoped and over-rated. Scope is BROADER than claimed: the same sampleValue generator feeds snippets.ts:377-384 (snippetBody), which selects required scalars — so the curl/TS/Python copy-paste code tabs on POST /v1/payment-methods/setup (where callbackUrl is required) also emit "callbackUrl": "string" and 422 verbatim, not just the "Example request body" block. And the defect is systemic, not limited to the two capture endpoints: every positive-int body field that misses /inkobo$/ and byName renders as an illegal 0 — POST /v1/coupons (durationInCycles, maxRedemptions), POST /v1/subscriptions/{id}/pause (maxDays), PUT /v1/organization/billing (dunningMa
> 
> *…trimmed (552 more chars — see the cited files).*

---

## E18. 🟠 Renaming `expectedAmount` → `expectedAmountInKobo` is a live request-field rename — it cannot be 'fixed', only migrated

**What we publish**

The finding says: rename the field end-to-end (core-contracts validation, the controller, the guide, and the param struct in all nine SDK repos) so it obeys the 'every money field ends in InKobo' promise.

**What the code does**

`expectedAmount` is a property of the POST /v1/payment-methods/virtual-account request body, published in apps/docs/src/generated/openapi.json and vendored into all nine SDK specs. Renaming a request field removes the old name from a live public API. Because the body schema is a plain zod object (strip), a client still sending `expectedAmount` after the rename would have it SILENTLY DROPPED — the NUBAN would be provisioned with no expected amount, changing bank behavior (Nomba's restrictive-VA semantics are flagged unconfirmed in the integration reference).

**Impact.** The naive rename turns every existing caller's expected-amount hint into a no-op with a 200 and no error — exactly the class of silent failure the rename was meant to prevent. And it forces nine SDK releases for a cosmetic consistency win.

**Fix.** Do NOT rename in one shot. Sequence: (1) NOW, cheap and non-breaking — add `.describe('Expected funding amount in integer kobo (a hint to the bank, not an enforced ceiling). Omit for an open account.')` to packages/core-contracts/src/validations/payment-method.ts:54 so the unit reaches the OpenAPI, the reference field table, and every SDK doc; and add an explicit exception note to apps/docs/content/concepts/money-is-integer-kobo.mdx:16-20, whose absolute claim is currently false. (2) IF you still want the rename, accept BOTH names for at least one release (`z.union` / a `.transform` that reads either, preferring the new one), publish the deprecation in the changelog, then remove the old name in a dated breaking release alongside the nine SDK bumps. Do not schedule this before the webhook-scheme SDK release — bundle every SDK-breaking change into one coordinated cut.

**Files.** `packages/core-contracts/src/validations/payment-method.ts`, `apps/docs/content/concepts/money-is-integer-kobo.mdx`, `apps/docs/content/guides/start-a-subscription.mdx`

---

## E19. 🟠 SDK `@throws` annotations on four subscription ops name the wrong status/error class (409/ConflictError for 422 errors), or name codes the API never throws

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:442 (resubscribe) "@throws {ConflictError} 409 `SUBSCRIPTION_NOT_TERMINAL`"; :391 (pause) "@throws {ConflictError} 409 `SUBSCRIPTION_ILLEGAL_TRANSITION`"; :322 (create) "@throws {ConflictError} 409 `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED`"; :223 (schedule.create) "@throws {ConflictError} 409 `SUBSCRIPTION_SCHEDULE_CONFLICT`". Replicated verbatim in the other SDKs, e.g. nombaone-python/src/nombaone/resources/subscriptions.py:551 "ConflictError: 409 ``SUBSCRIPTION_NOT_TERMINAL``" and :188 "ConflictError: 409 ``SUBSCRIPTION_SCHEDULE_CONFLICT``".

**What the code does**

SUBSCRIPTION_NOT_TERMINAL is a 422: apps/api/src/shared/services/subscriptions/resubscribe.ts:31-35 `AppError.UnprocessableEntity('can only resubscribe a canceled subscription', …, NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_TERMINAL)`. SUBSCRIPTION_ILLEGAL_TRANSITION is a 422: apps/api/src/shared/services/subscriptions/fsm.ts:37-43 `AppError.UnprocessableEntity(…)`. `AppError.UnprocessableEntity` → HTTP 422 (packages/errors/src/app-error.ts:90-99), and the SDK maps 422 → ValidationError, not ConflictError (/Users/mac/Vault/the-60/nombaone/nombaone-node/src/error.ts:228-229 `if (status === 409) return new ConflictError(…); if (status === 422) return new ValidationError(…)`). SUBSCRIPTION_PAYMENT_METHOD_REQUIRED is thrown only in apps/api/src/shared/services/dunning/card-update.ts:71 — never on the create path (create's missing-method rule is the zod refine, packages/core-contracts/src/validations/subscription.ts:25-31, a 422 validation error). SUBSCRIPTION_SCHEDULE_CONFLICT is thrown nowhere in apps/api/src (createSchedule replaces a same-boundary phase instead of conflicting: apps/api/src

*…trimmed (57 more chars — see the cited files).*

**Impact.** The documented, idiomatic handling — `catch (e) { if (e instanceof ConflictError) … }` around resubscribe or pause — never matches: the real error is a ValidationError and falls through to the generic handler. Developers also write dead handlers for two codes the API cannot emit. Silent-until-production breakage in all nine languages.

**Fix.** In each SDK's subscriptions resource, correct the annotations: resubscribe → "@throws {ValidationError} 422 `SUBSCRIPTION_NOT_TERMINAL`"; pause/resume → "@throws {ValidationError} 422 `SUBSCRIPTION_ILLEGAL_TRANSITION`"; create → "@throws {ValidationError} 422 — a missing payment method without a trial" (delete the 409 line); schedule.create → delete the SUBSCRIPTION_SCHEDULE_CONFLICT line. Start at /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:223,322,391,442 and mirror to the other eight.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/resources/subscriptions.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/subscriptions.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/src/Resources/Subscriptions.php`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantially correct; two adjustments.
> 
> (1) MORE wrong than reported: SUBSCRIPTION_PAYMENT_METHOD_REQUIRED's only throw site (apps/api/src/shared/services/dunning/card-update.ts:68-72) is `AppError.NotFound` -> HTTP 404, not a 409 and not a 422. So the SDK's "@throws {ConflictError} 409 SUBSCRIPTION_PAYMENT_METHOD_REQUIRED" on `create` is wrong on BOTH the path (never thrown on create; create's missing-method rule is the zod refine at packages/core-contracts/src/validations/subscription.ts:24-31 -> 422) and the status/class at the one place the code does exist.
> 
> (2) Mitigating: `create`'s docblock (nombaone-node/src/resources/subscriptions.ts:321) ALSO carries a correct line 
> 
> *…trimmed (1134 more chars — see the cited files).*
> The finding is factually correct and reachable, but the severity is one notch high. Accurate framing: the four `@throws` annotations state the wrong error class/status (ConflictError/409 where the API returns 422/ValidationError) or name codes the create/schedule paths never emit. Consequence is a *dead* `instanceof ConflictError` branch — the error still surfaces with the right status and the right `code` string and propagates to the caller's generic handler. No incorrect money, auth, or state outcome; nothing silently succeeds. Fix = correct the annotations in all nine SDKs (say `ValidationError` 422 for SUBSCRIPTION_NOT_TERMINAL and SUBSCRIPTION_ILLEGAL_TRANSITION; drop SUBSCRIPTION_PAYME
> 
> *…trimmed (298 more chars — see the cited files).*

---

## E20. 🟠 The "100× trap" money callout is inverted: sending naira where kobo is expected UNDER-charges by 100×, not over-charges

**What we publish**

apps/docs/content/concepts/money-is-integer-kobo.mdx:42-43 — "If you ever compute an amount as naira and send it where kobo is expected, you **overcharge by 100×**. Send integer kobo. `₦2,500` is `250000`, not `2500`." Repeated at apps/docs/content/getting-started/your-first-subscription.mdx:88-89 — "Sending naira where kobo is expected **overcharges by 100×**." And in the page's own frontmatter, money-is-integer-kobo.mdx:3 — "how the 100× overcharge trap is designed out." Both pages are what the price docs link to (guides/create-plans-and-prices.mdx:75).

**What the code does**

₦1 = 100 kobo, and `unitAmountInKobo` is integer kobo (apps/api/src/shared/services/prices/serialize.ts:14 `unitAmountInKobo: row.unitAmount`, validated positive-integer at packages/core-contracts/src/validations/price.ts:13). To charge ₦2,500 you must send `250000`. Sending the NAIRA figure `2500` into that field charges 2500 kobo = ₦25.00 — one hundredth of the intent. That is a 100× UNDERCHARGE. The doc's own next sentence ("`₦2,500` is `250000`, not `2500`") proves the direction. The genuine over-charge direction is the opposite one (kobo sent where naira is expected, i.e. the Nomba checkout boundary described at money-is-integer-kobo.mdx:33-39).

**Impact.** This is the canonical money page, and it names the wrong failure mode. A team that mis-sends naira loses 99% of every subscription's revenue while every charge succeeds and no customer complains — the silent, un-detectable failure. Having been told to watch for angry over-billed customers, they monitor for the one signal that will never appear. It also costs the docs their credibility on the one invariant the whole API is built around.

**Fix.** apps/docs/content/concepts/money-is-integer-kobo.mdx:42-43 — rewrite to: "If you ever compute an amount in naira and send it where kobo is expected, you **undercharge by 100×** — `2500` in a `…InKobo` field bills ₦25, not ₦2,500, and nothing errors. Send integer kobo: multiply the naira figure by 100." Fix the frontmatter at line 3 ("the 100× trap", not "the 100× overcharge trap"). Apply the same correction to apps/docs/content/getting-started/your-first-subscription.mdx:88-89.

**Files.** `apps/docs/content/concepts/money-is-integer-kobo.mdx`, `apps/docs/content/getting-started/your-first-subscription.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding's core claim is CORRECT — the callout names the wrong failure direction — but the severity is one notch too high and the file list is incomplete.
> 
> ACCURATE VERSION: Sending a naira figure into a kobo-typed field is a 100× UNDERCHARGE, not an overcharge. Proof chain, from code: `unitAmountInKobo` is validated as positive integer kobo (packages/core-contracts/src/validations/price.ts:13, `z.coerce.number().int().positive(), // kobo`), stored and serialized pass-through (apps/api/src/shared/services/prices/serialize.ts:14), and DIVIDED by 100 on the way out to Nomba (packages/sara/src/nomba/money.ts:15, `koboToNombaAmount = (kobo) => (kobo / 100).toFixed(2)`). Sending `2500` for a ₦
> 
> *…trimmed (2158 more chars — see the cited files).*
> The direction claim is correct: sending naira where integer kobo is expected UNDERcharges by 100× (2500 → ₦25 instead of ₦2,500). Five surfaces say "overcharge": money-is-integer-kobo.mdx:3 (frontmatter) and :42, your-first-subscription.mdx:88, going-live.mdx:56, and manifest.ts:190 ("the 100× naira trap"). However, the severity should be medium, not high, because every occurrence pairs the wrong direction-word with the CORRECT actionable instruction on the same line ("Send 250000, not 2500", "multiply the naira figure by 100"), plus a live <MoneyUnit /> converter — so no integrator following the docs actually sends the wrong integer. The real cost is a wrong mental model and lost credibilit
> 
> *…trimmed (399 more chars — see the cited files).*

---

## E21. 🟠 The "Start a subscription" guide's first curl (payment-methods/setup) omits Idempotency-Key, but that route strictly requires it → 400 on the very first call

**What we publish**

apps/docs/content/guides/start-a-subscription.mdx:21-29:
```
curl -X POST https://sandbox.api.nombaone.xyz/v1/payment-methods/setup \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "customerRef": …, "amountInKobo": 250000, "callbackUrl": … }'
```
No `Idempotency-Key` header. The very next curl in the same file (lines 56-67, POST /v1/subscriptions) DOES send `-H "Idempotency-Key: $(uuidgen)"` — so the omission is an error, not a deliberate statement that the header is optional here.

**What the code does**

apps/api/src/apps/main/modules/payment-methods/routes.ts:36-45 mounts the STRICT middleware on this exact route: `paymentMethodsRouter.post('/payment-methods/setup', apiKeyAuth, rateLimit, requireScope('payment_methods:write'), idempotency, validate({ body: setupCardBody }), setupCardController);` — `idempotency`, not `idempotencyOptional`. apps/api/src/shared/middlewares/idempotency.ts:60-72: when no key is present and `required` is true it calls `next(AppError.BadRequest('Idempotency-Key header is required for this request', undefined, NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_MISSING))` → HTTP 400. The routes.ts doc-comment at lines 30-33 confirms intent: "Idempotency is REQUIRED (`idempotency`) on card setup (it initiates a charge)".

**Impact.** A developer copy-pastes the first code block of the guide named "Start a subscription" and gets `400 IDEMPOTENCY_KEY_MISSING`. They cannot discover the fix from the docs: the generated reference page for this operation never renders header parameters at all (apps/docs/src/components/reference/api-operation.tsx:101-102 renders only `op.pathParams` and `op.queryParams`; the `Idempotency-Key` header param the spec emits is silently dropped), and no MDX page for payment-methods mentions the header. The same break applies to POST /v1/mandates, which also uses strict `idempotency` (apps/api/src/apps/main/modules/mandates/routes.ts:16-23) and has no hand-written curl anywhere in content/.

**Fix.** apps/docs/content/guides/start-a-subscription.mdx:24 — add `  -H "Idempotency-Key: $(uuidgen)" \` to the setup curl, matching line 60. Separately, in apps/docs/src/components/reference/api-operation.tsx, add a third FieldTable for header params (they are currently discarded): compute `headerParams` in apps/docs/src/lib/api-ref/model.ts:348-349 (`params.filter((p) => p.in === 'header')`) and render `<FieldTable title="Headers" rows={paramRows(op.headerParams)} />` after line 101.

**Files.** `apps/docs/content/guides/start-a-subscription.mdx`, `apps/docs/src/components/reference/api-operation.tsx`, `apps/docs/src/lib/api-ref/model.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: Two hand-written docs curls omit `Idempotency-Key` on routes that mount the STRICT `idempotency` middleware, so a copy-paste yields a deterministic 400 IDEMPOTENCY_KEY_MISSING:
>   1. apps/docs/content/guides/start-a-subscription.mdx:21-30 → POST /v1/payment-methods/setup (strict per apps/api/src/apps/main/modules/payment-methods/routes.ts:39-47)
>   2. apps/docs/content/guides/coupons-and-credits.mdx:65-70 → POST /v1/customers/{id}/credit (strict per apps/api/src/apps/main/modules/customers/routes.ts:108) — MISSED by the auditor.
> 
> The 400 is unconditional: apps/api/src/shared/middlewares/idempotency.ts:60-76 rejects before the Redis FAIL-OPEN path and before `validate`, with n
> 
> *…trimmed (884 more chars — see the cited files).*
> The docs bug is real (guide's first curl omits a header the route strictly requires → 400 IDEMPOTENCY_KEY_MISSING), but the "developer cannot discover the fix" framing is wrong: the generated API reference curl for this operation DOES include `-H "Idempotency-Key: $(uuidgen)"` (snippets.ts:183-186 adds it to every POST with a body), the 400's message names the missing header explicitly, and the same guide shows the header correctly at line 60. Only the header *parameter table* is missing from api-operation.tsx. The POST /v1/mandates extension is a docs-coverage gap, not a broken example, since no curl for it exists in content/.

---

## E22. 🟠 The `incomplete`-vs-`past_due` first-charge item has a docs fix and an ENGINE fix — take the docs fix, and fix the code's own doc-comment in the same commit or it will be 'corrected' back

**What we publish**

The finding offers both: (1) rewrite guides/start-a-subscription.mdx to say a failed first charge yields `incomplete` and does NOT enter dunning; or (2) add an `incomplete → past_due` FSM edge and include `incomplete` in collectForInvoice's guard so the docs become true.

**What the code does**

apps/api/src/shared/services/billing/collectForInvoice.ts:208 documents the current behavior deliberately ('An `incomplete` first charge stays incomplete (its window is 04's sweep)'). But apps/api/src/shared/services/billing/startSubscription.ts:12 says the opposite in its own doc-comment: 'flipping it to `active` on success or `past_due` on a failed first charge'. The code and one of its own comments already disagree.

**Impact.** Option (2) is not a bug fix — it is a product change that starts scheduling retries and charging cards where none happened before, and starts emitting dunning events to integrators who have never received them. Shipping it as a 'docs correctness' fix would move money on a path nobody signed off on. Conversely, shipping only the docs fix without correcting startSubscription.ts:12 leaves a lie inside the engine that the next reader will treat as the spec and 'restore'.

**Fix.** Take the docs fix now, and in the SAME commit correct the startSubscription.ts:12 doc-comment so the code's stated intent matches its behavior. Then raise first-charge recovery as a separate product decision with its own review: it changes money movement, adds webhook traffic, and interacts with the dunning + BILLING_SWEEP_CRON coupling. If you do build it, note the current signal is not zero — `invoice.payment_failed` fires and the 201 returns `status: "incomplete"` — so the migration story for integrators is 'you may now ALSO see dunning events', not 'you were blind'.

**Files.** `apps/docs/content/guides/start-a-subscription.mdx`, `apps/api/src/shared/services/billing/startSubscription.ts`, `apps/api/src/shared/services/billing/collectForInvoice.ts`, `apps/api/src/shared/services/subscriptions/fsm.ts`

---

## E23. 🟠 The error reference and all nine SDKs tell integrators a mid-cycle interval switch is UNSUPPORTED and throws `PRORATION_INTERVAL_SWITCH_UNSUPPORTED` — POST /v1/subscriptions/{id}/change fully supports it and never throws that code

**What we publish**

packages/errors/src/codes.ts:729-732 (rendered on the public /errors page): "PRORATION_INTERVAL_SWITCH_UNSUPPORTED: { hint: 'Prorating across a change of billing interval (e.g. monthly to yearly) is not supported. Schedule the interval change at the next period boundary instead.' }". Mirrored in every SDK's `change()` doc: /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:458-461 "Switching the billing interval mid-cycle is unsupported (`PRORATION_INTERVAL_SWITCH_UNSUPPORTED`) — queue it with {@link SubscriptionSchedules.create} instead."; nombaone-python/src/nombaone/resources/subscriptions.py:573-574; nombaone-go/subscriptions.go:527; nombaone-php/src/Resources/Subscriptions.php:211-212.

**What the code does**

The change endpoint implements interval switching as a first-class, money-moving path: packages/core-contracts/src/validations/subscription-change.ts:12 exposes `intervalSwitch: z.boolean().optional()`, and apps/api/src/shared/services/billing/changeSubscription.ts:92-111 + 158-167 computes `const isIntervalSwitch = cadenceChanged || input.intervalSwitch === true;`, re-anchors via `reanchorForIntervalSwitch(...)` and calls `applyIntervalSwitch(...)` (credit the unused old-cadence remainder, charge a full fresh new-cadence period). `PRORATION_INTERVAL_SWITCH_UNSUPPORTED` is defined in codes.ts but thrown NOWHERE — a grep across apps/api/src and packages/sara/src returns zero throw sites (changeSubscription's only 422 is PRORATION_NOT_APPLICABLE, for a terminated sub, changeSubscription.ts:57-63). The docs' own guide says the opposite of the SDKs: apps/docs/content/guides/proration-and-plan-changes.mdx:44-53 "## Switch intervals … Set `intervalSwitch: true` so the engine aligns the billing anchor".

**Impact.** A developer reading the SDK (the surface all 9 languages ship) or the /errors page believes monthly→yearly upgrades must be deferred to the next boundary, so they build a scheduling workaround and delay revenue — or they write a catch for an error that can never fire. Two official doc surfaces flatly contradict each other on a money path.

**Fix.** Delete the false claim from every SDK `change()` doc (start at /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:458-461) and replace with: "Pass `intervalSwitch: true` to switch cadence: the engine credits the unused old-cadence remainder, charges a full new-cadence period, and re-anchors the cycle." Then either delete `PRORATION_INTERVAL_SWITCH_UNSUPPORTED` from packages/errors/src/codes.ts:177/:308/:729-732 (it is dead) or rewrite its hint to describe a condition the engine actually raises.

**Files.** `packages/errors/src/codes.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/resources/subscriptions.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/subscriptions.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/src/Resources/Subscriptions.php`

> **Refuter's correction — re-scopes this finding:**
> The technical claim is correct and verified: PRORATION_INTERVAL_SWITCH_UNSUPPORTED is defined in packages/errors/src/codes.ts (enum:177, public catalog:308, hint:729-732) and thrown at ZERO sites, while POST /v1/subscriptions/{id}/change fully implements interval switching as a money-moving path (changeSubscription.ts:94 isIntervalSwitch, :105-111 reanchorForIntervalSwitch, :158-167 applyIntervalSwitch -> invoice+collect or credit grant), fed by contracts (subscription-change.ts:12) and the route (routes.ts:141-147). What should be adjusted is the framing of impact: this is a docs/SDK-comment/error-catalog correctness bug, NOT a product or money bug. The API behaves correctly; no integrator 
> 
> *…trimmed (812 more chars — see the cited files).*
> The finding is factually correct and reachable, but its impact framing picks the weaker of two arguments and should be re-centered.
> 
> WEAKER (what the finding claimed): "integrator builds a scheduling workaround and delays revenue." This is softened by two things the finding missed: (a) every SDK ALREADY exposes the parameter — `intervalSwitch?: boolean` sits at nombaone-node/src/resources/subscriptions.ts:184, three lines below the docstring calling it unsupported; same in Go (`IntervalSwitch *bool`, subscriptions.go:278), Python (`interval_switch`, subscriptions.py:567), Java (SubscriptionChangeParams.java). Autocomplete surfaces the contradiction instantly. (b) SubscriptionSchedules.create
> 
> *…trimmed (1688 more chars — see the cited files).*

---

## E24. 🟠 The flagship webhook-handler snippet reads the header `x-nomba-signature`; the server sends `x-nombaone-signature` — the copy-pasted handler rejects 100% of deliveries

**What we publish**

apps/docs/content/guides/handle-webhooks.mdx:78 — inside the "Respond fast, act async" reference handler: `verifyWebhook(raw, req.headers.get("x-nomba-signature")!, SECRET);`

**What the code does**

packages/sara/src/webhooks/deliver.ts:206 sets the header as `'x-nombaone-signature': signature,` in the outbound POST's `headers` object. The docs' own other pages agree with the server and contradict this snippet: apps/docs/content/webhooks/overview.mdx:21 shows `X-Nombaone-Signature: t=1719920092,v1=8f3c…` and apps/docs/content/webhooks/signing-and-verification.mdx:9 says "Every genuine delivery carries an `X-Nombaone-Signature` header".

**Impact.** `/guides/handle-webhooks` is the page linked from the webhooks overview, the delivery-guarantee page, and the simulate page as *the* handler pattern. A developer copies it verbatim into a Next.js route. `req.headers.get("x-nomba-signature")` returns `null`; the `!` non-null assertion suppresses the TS error, so it compiles and ships. At runtime `parseHeader(null)` throws (or `verifyWebhook` throws "invalid signature"), the handler 500s, and every single delivery fails and enters the retry/dead-letter path. The developer's first webhook never works, and the bug is a one-character-class typo they will not spot because the prose above it is correct.

**Fix.** apps/docs/content/guides/handle-webhooks.mdx:78 — change `req.headers.get("x-nomba-signature")` to `req.headers.get("x-nombaone-signature")`. (Note: this fix alone still leaves the snippet non-functional because of the already-established Stripe-vs-bare-hex scheme divergence; both must land together.)

**Files.** `apps/docs/content/guides/handle-webhooks.mdx`

> **Refuter's correction — re-scopes this finding:**
> The header mismatch is real and exactly as quoted (docs `x-nomba-signature` at handle-webhooks.mdx:78 vs server `x-nombaone-signature` at deliver.ts:206; no alias or fallback exists anywhere), but it is a symptom, not the bug. The ACCURATE finding is broader:
> 
> The docs describe a webhook signature scheme the server does not implement. The server (packages/sara/src/webhooks/sign.ts:18, used at deliver.ts:113 and set at :206) sends `x-nombaone-signature: <lowercase-hex HMAC-SHA256(secret, rawBody)>` — raw body only, NO timestamp, NO `t=`/`v1=` envelope, NO replay window. The docs instead teach a Stripe-style `t=<unix>,v1=<hex>` header whose HMAC covers `` `${t}.${rawBody}` ``, in THREE places:
> 
> *…trimmed (1972 more chars — see the cited files).*
> The accurate finding is broader than stated: the reference handler is wrong in THREE independent ways, and the header name is the least of them. (1) header name: reads x-nomba-signature, server sends x-nombaone-signature (deliver.ts:206). (2) signature FORMAT: the guide parses `t=<unix>,v1=<hex>` and HMACs `${t}.${rawBody}`; the server sends a bare lowercase-hex HMAC-SHA256 of the raw body only, with no timestamp component anywhere in the product (sign.ts: signWebhookPayload = createHmac('sha256', secret).update(rawBody).digest('hex')). (3) KEY: the guide keys the HMAC with the plaintext whsec_ secret; deliver.ts:113 signs with endpoint.signingSecretHash, i.e. the sha256 of that plaintext (d
> 
> *…trimmed (683 more chars — see the cited files).*

---

## E25. 🟠 The money-sample regex never matches camelCase `…InKobo`, so `amountOffInKobo`, `remainingInKobo` and `balanceInKobo` are all documented as 0

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:10-12 states the invariant: "Money is ALWAYS integer kobo (manifesto tenet 1): any `*InKobo` field samples a whole-naira amount and never a float." The implementation, samples.ts:17:
```ts
if (/inkobo$/.test(name) || /amountinkobo/i.test(name)) return 250_000; // ₦2,500.00
```

**What the code does**

`/inkobo$/` is CASE-SENSITIVE and every real field ends in `InKobo` (capital I, capital K), so it never matches. The only reason `amountInKobo` samples correctly is the second alternative `/amountinkobo/i`, which matches the literal substring — so a name must CONTAIN "amountinkobo" to get the kobo value. Field-by-field, from the generator run:
- `amountInKobo` → 250000 ✔ (matches /amountinkobo/i)
- `amountOffInKobo` → **0** ✘ ("amountoffinkobo" does not contain "amountinkobo")
- `remainingInKobo` → **0** ✘
- `balanceInKobo` → **0** ✘
So /reference/coupons/* documents `"amountOffInKobo": 0` in both the request and the response example; /reference/customers/credit-balance documents `"balanceInKobo": 0`; and /reference/customers/grant-credit documents a freshly-granted grant as `"remainingInKobo": 0` (a grant is minted with `remaining = amount` — apps/api/src/shared/services/credits/grant.ts:74-75 `amount: input.amount, remaining: input.amount`).

**Impact.** Two concrete harms. (1) `"amountOffInKobo": 0` is not just cosmetic — it is one of the four things that makes the POST /v1/coupons example 422 (zod `.positive()`), and it teaches that a fixed-amount coupon can be zero. (2) The credit-grant response example shows a brand-new ₦2,500 grant with `remainingInKobo: 0`, i.e. fully consumed — a developer reading the reference to build a credit-balance UI will conclude a grant is spent the moment it is created. Both appear on production reference pages, and the file's own docstring asserts the opposite behaviour, so nobody will look here.

**Fix.** apps/docs/src/lib/api-ref/samples.ts:17 — replace `if (/inkobo$/.test(name) || /amountinkobo/i.test(name)) return 250_000;` with a case-insensitive suffix test: `if (/inkobo$/i.test(name)) return 250_000; // ₦2,500.00`. That single change makes every `*InKobo` field (amountOffInKobo, remainingInKobo, balanceInKobo, subtotalInKobo, discountTotalInKobo, creditTotalInKobo, …) sample 250000 as the docstring already promises.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on mechanism, impact and both cited files. Three refinements:
> 
> (1) SCOPE IS 16 FIELDS, NOT 3. `/inkobo$/` is case-sensitive and is tested against the raw `name` (the only branch in `byName` that does not use the lowercased `n` or an `/i` flag), so it never fires. Everything therefore depends on the second alternative `/amountinkobo/i`, which requires the name to CONTAIN the literal substring "amountinkobo". Exactly three fields do — `amountInKobo`, `unitAmountInKobo`, `maxAmountInKobo` — and they sample 250000. All sixteen others fall through to the `integer → 0` fallback: amountOffInKobo, remainingInKobo, balanceInKobo, totalInKobo, subtotalInKobo, amountDueInKobo, am
> 
> *…trimmed (867 more chars — see the cited files).*
> The finding is factually correct and reachable in the shipped production docs build, but "high" is one notch too hot. Two adjustments: (a) the POST /v1/coupons example would 422 regardless of this bug, because packages/core-contracts/src/validations/coupon.ts:14 enforces an XOR refine between amountOffInKobo and percentOff and the sample emits both — so this defect is a contributor to, not the cause of, the broken coupon example; (b) impact is confined to documentation (no runtime, money-movement, or security consequence). The strongest, self-standing harm is the credit surface: /reference/customers/grant-credit and /reference/customers/credit-balance document a freshly-minted grant as remai
> 
> *…trimmed (398 more chars — see the cited files).*

---

## E26. 🟠 The reference page's own request example for POST /v1/mandates sends startDate/endDate: "string" → uncaught RangeError → HTTP 500, not a validation error

**What we publish**

The auto-generated "Example request body" on /reference/mandates/create (rendered by apps/docs/src/components/reference/api-operation.tsx:105-110 from `requestExample()` in apps/docs/src/lib/api-ref/samples.ts:102-114) is, verbatim (I ran the generator against apps/docs/src/generated/openapi.json):
```json
{ "customerRef": "string", "customerAccountNumber": "string", "bankCode": "string", "customerName": "string", "customerAccountName": "string", "customerPhoneNumber": "string", "customerAddress": "string", "narration": "string", "maxAmountInKobo": 250000, "frequency": "variable", "startDate": "string", "endDate": "string" }
```
(`startDate`/`endDate` fall through samples.ts `byName()` — they do not match `/_?at$/i` — to the `case "string"` fallback at samples.ts:78, which returns the literal `"string"`.)

**What the code does**

packages/core-contracts/src/validations/payment-method.ts:46-47 validates them as `startDate: z.string().optional(), endDate: z.string().optional()` — any string passes, including `"string"`. apps/api/src/shared/services/payment-methods/attach.ts:102-105 then does: `const toLocalDateTime = (iso: string): string => new Date(iso).toISOString().slice(0, 19); const startDate = input.startDate ? toLocalDateTime(input.startDate) : …`. `new Date('string').toISOString()` throws `RangeError: Invalid time value` (verified in node). apps/api/src/shared/http/json.ts:19-28 catches and forwards to apps/api/src/shared/http/error-handler.ts:36-38, where a non-AppError gets `status = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR` and the message is collapsed to `'Internal server error'` with code `SYSTEM_INTERNAL_ERROR`.

**Impact.** A developer who copies the reference page's own example body for the mandate-create endpoint gets an opaque `500 Internal server error` with no field information, and pages the on-call. The underlying validator hole is worse than the sample: ANY malformed date string a real integrator sends (`"2026-07-15"` is fine, `"15/07/2026"` is not) produces a 500 instead of a 422 with `fields`.

**Fix.** (1) packages/core-contracts/src/validations/payment-method.ts:46-47 — replace `startDate: z.string().optional()` / `endDate: z.string().optional()` with a date-validated schema (e.g. `z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/)).optional()`, or at minimum `.refine((s) => !Number.isNaN(Date.parse(s)), 'must be a parseable date')`), so a bad date is a 422 with `fields`, and add `.describe('Local date-time, e.g. 2026-08-01T00:00:00. Defaults to tomorrow.')`. This also fixes the sample, because samples.ts:79 emits an ISO timestamp for `format: "date-time"`. (2) Harden apps/api/src/shared/services/payment-methods/attach.ts:102 to throw `AppError.UnprocessableEntity` on `Number.isNaN(Date.parse(iso))` rather than letting `.toISOString()` throw.

**Files.** `packages/core-contracts/src/validations/payment-method.ts`, `apps/api/src/shared/services/payment-methods/attach.ts`

> **Refuter's correction — re-scopes this finding:**
> The docs-sample angle is wrong. Posting the reference page's example body verbatim does NOT hit the RangeError: apps/api/src/shared/services/payment-methods/attach.ts:95 resolves the customer BEFORE the date normalization at lines 102-108, and the sample's customerRef: "string" fails that lookup, so apps/api/src/shared/services/payment-methods/internal.ts:32-38 throws AppError.NotFound('customer not found', { reference }, CUSTOMER_NOT_FOUND) -> a clean 404 that echoes the offending reference. No 500, no on-call page.
> 
> The real (narrower) defect: packages/core-contracts/src/validations/payment-method.ts:46-47 validates startDate/endDate as plain z.string().optional(), and attach.ts:102 does `
> 
> *…trimmed (1107 more chars — see the cited files).*
> The docs' own example body does NOT produce a 500. createMandate resolves the customer first (attach.ts:95, before the date parse at 102-105), so the sample's customerRef: "string" throws AppError.NotFound → HTTP 404 CUSTOMER_NOT_FOUND and never reaches toLocalDateTime. The accurate finding is narrower: POST /v1/mandates (mounted unconditionally at apps/api/src/apps/main/server/routes.ts:37, behind apiKeyAuth + requireScope('mandates:write')) validates startDate/endDate as bare z.string().optional() (packages/core-contracts/src/validations/payment-method.ts:46-47), so ANY caller with a VALID customerRef who sends a date string Date.parse cannot handle (e.g. "15/07/2026") hits `new Date(iso).
> 
> *…trimmed (643 more chars — see the cited files).*

---

## E27. 🟠 The refund guide's worked example refunds MORE than the refundable net — both amounts 422 with REFUND_AMOUNT_EXCEEDS_NET under the default 1.5% platform fee

**What we publish**

apps/docs/content/guides/refunds-payouts-settlement.mdx:20-26 — `curl -X POST .../v1/settlements/{id}/refund … -d '{ "amountInKobo": 250000 }'` (₦2,500), introduced at :17-18 as "By default it refunds the full net; pass `amountInKobo` for a partial". Then :35-37: "Partial refunds accumulate: refund ₦1,000 of a ₦2,500 charge, then ₦1,500 later, and the settlement flips to fully `refunded`."

**What the code does**

The refundable ceiling is `settlement.netToTenantKobo`, not the gross charge: apps/api/src/shared/services/settlement/refund.ts:63-64 `const remaining = settlement.netToTenantKobo - alreadyRefunded;` and :73-79 `if (refundKobo > remaining) throw AppError.UnprocessableEntity('refund exceeds the refundable tenant share', …, NOMBAONE_ERROR_CODES.REFUND_AMOUNT_EXCEEDS_NET);`. The default fee is packages/sara/src/config/fees.ts:44-48 `{ rateBps: 150, min: 1000, max: 200_000 }` (1.50%, ₦10 floor, ₦2,000 ceiling). For a ₦2,500 gross (250,000 kobo): fee = clamp(250000 × 150/10000 = 3,750) = 3,750 kobo (₦37.50); netToTenantKobo = 250,000 − 3,750 = **246,250 kobo (₦2,462.50)**. The guide's own Callout at :28-33 concedes the fee is never refunded, which is exactly why the numbers cannot work.

**Impact.** The single curl on the page — the first thing a developer runs — sends 250,000 against a 246,250 ceiling and returns 422 `REFUND_AMOUNT_EXCEEDS_NET`. The prose example is worse: ₦1,000 + ₦1,500 = ₦2,500 > ₦2,462.50, so the *second* call 422s and the settlement never "flips to fully `refunded`" as promised. A developer who trusts the page concludes the refund endpoint is broken; one who doesn't must reverse-engineer the fee schedule (which is documented nowhere on this page) to compute a legal amount.

**Fix.** apps/docs/content/guides/refunds-payouts-settlement.mdx — (a) at :17-18, state the ceiling explicitly: "By default it refunds the full **net to your organization** (gross minus the platform fee), which is the maximum refundable. Pass `amountInKobo` for a partial." (b) at :25, change `-d '{ "amountInKobo": 250000 }'` to `-d '{ "amountInKobo": 100000 }'` (₦1,000 — safely under the net) or omit the body entirely to take the default full-net refund. (c) at :35-37, rewrite the accumulation example against the NET: "Partial refunds accumulate: on a ₦2,500 charge the platform fee is ₦37.50, so ₦2,462.50 is refundable. Refund ₦1,000, then ₦1,462.50 later, and the settlement flips to `refunded`." (d) add `REFUND_AMOUNT_EXCEEDS_NET` and `REFUND_ALREADY_REFUNDED` to the page — it currently lists only the two payout errors at :67-69 and names zero refund errors.

**Files.** `apps/docs/content/guides/refunds-payouts-settlement.mdx`

> **Refuter's correction — re-scopes this finding:**
> Narrow the finding to the prose only. ACCURATE version: apps/docs/content/guides/refunds-payouts-settlement.mdx:35-37 gives an example that cannot happen under the default fee schedule — "refund ₦1,000 of a ₦2,500 charge, then ₦1,500 later, and the settlement flips to fully `refunded`". With DEFAULT_FEE_SCHEDULE (150 bps, ₦10 floor), a ₦2,500 gross settles to netToTenantKobo = 246,250 kobo, so the second ₦1,500 call exceeds `remaining` (146,250) and 422s with REFUND_AMOUNT_EXCEEDS_NET; the settlement never flips. Fix: use net-denominated numbers (e.g. "refund ₦1,000 of a ₦2,462.50 net, then ₦1,462.50") or drop the exact figures and say the settlement flips once cumulative refunds reach the n
> 
> *…trimmed (268 more chars — see the cited files).*
> The accurate finding is narrower: the PROSE at apps/docs/content/guides/refunds-payouts-settlement.mdx:35-37 is arithmetically impossible — "₦1,000 + ₦1,500 of a ₦2,500 charge → flips to fully refunded" cannot happen, because the refundable ceiling is settlement.netToTenantKobo (gross minus the non-refundable platform fee), not the gross charge. Under the default 150bps schedule net is ₦2,462.50, so the second call 422s with REFUND_AMOUNT_EXCEEDS_NET. The curl at :20-26 is NOT independently broken — it targets a placeholder {id} with an arbitrary amount, so it cannot be shown to 422; and :17-18 ("by default it refunds the full net") is actually correct, since the omit-amount path uses `remai
> 
> *…trimmed (460 more chars — see the cited files).*

---

## E28. 🟠 The settlement refund docs fix is safe, but the console ships an 'Issue refund' button on the same endpoint — and any real provider leg added later must reconcile the ledger_only rows already posted

**What we publish**

The finding says: rewrite three docs pages so they stop claiming the payer is credited, and document the `ledger_only` status.

**What the code does**

apps/api/src/shared/services/settlement/refund.ts:24 states outright that 'the real money return to the end-user is a separate, provider-guarded step (the row stays `ledger_only`, `provider_reference` null)', :92 inserts `status: 'ledger_only'`, and there is no refund endpoint in NOMBA_ENDPOINTS and no enable flag (unlike payout, which IS gated: apps/api/src/shared/services/settlement/payout.ts:159 `if (input.payoutEnabled)` off NOMBA_PAYOUT_ENABLED). apps/console/src/components/console/settlements/settlement-buttons.tsx puts a merchant-facing refund button on this endpoint.

**Impact.** Correcting the docs still leaves a merchant clicking 'Issue refund' in their own console, seeing a success, and telling their customer the money is coming. The docs are not where that merchant is. Worse: every ledger_only refund already posted has debited tenant_settlement and credited platform_revenue. When you eventually wire a real provider transfer, those rows are NOT 'pending' — the money already moved on the books to platform_revenue. Adding a provider leg on top without reconciling them double-books.

**Fix.** Order: (1) console FIRST — either gate/hide the refund button behind the same kind of flag payout uses, or relabel it unambiguously ('Record refund (ledger only — no money is returned)') and surface `status: ledger_only` in the UI. A merchant-facing false promise outranks a docs one. (2) Docs second (guides/refunds-payouts-settlement.mdx:17,29-31; merchants/read-a-settlement.mdx:38-39; concepts/settlement-and-sub-accounts.mdx:32) plus publish the RefundStatus enum and a Refund response schema in responses.ts (it is one of the 13 unmapped routes). (3) When you build the real leg, treat the existing ledger_only rows as a DATA problem, not a code problem: they need either a reversing entry or an explicit exclusion from the new flow. Write that reconciliation down before you write the transfer call. (4) Introduce a NOMBA_REFUND_ENABLED flag mirroring payout so the two money-out paths are gat

*…trimmed (16 more chars — see the cited files).*

**Files.** `apps/console/src/components/console/settlements/settlement-buttons.tsx`, `apps/docs/content/guides/refunds-payouts-settlement.mdx`, `apps/api/src/shared/openapi/responses.ts`, `apps/api/src/shared/services/settlement/refund.ts`

---

## E29. 🟠 The setup-charge disclosure is urgent and cheap; the 'auto-credit it' remedy is a money-engine change with no refund path — do not bundle them

**What we publish**

The finding says: document that `amountInKobo` on POST /v1/payment-methods/setup is a real charge, lower the sample from ₦2,500 to ₦50, and either auto-grant the captured amount as customer credit or record it as a settlement so it becomes refundable.

**What the code does**

apps/api/src/shared/services/payment-methods/attach.ts:44-59 posts a real Nomba checkout order; settle.ts:30-37 only captures the token. The charge cannot be zeroed (zod `.positive()`). And POST /v1/settlements/{id}/refund requires a settlement row this flow never creates — so there is genuinely no in-product way to give the money back today.

**Impact.** Bundling the disclosure with the auto-credit remedy delays the disclosure. The disclosure is the part that stops the bleeding (customers being charged with no explanation); the remedy is a ledger change that alters money movement and interacts with the refund gap above.

**Fix.** Ship in two waves. WAVE 1 (docs + contract description only, this week): add the Callout to apps/docs/content/guides/start-a-subscription.mdx, add `.describe()` to packages/core-contracts/src/validations/payment-method.ts:14 so the warning reaches the OpenAPI and all nine SDK reference pages, and drop the guide's sample to the smallest amount the bank accepts. Also consider relaxing `.positive()` to allow 0 IF Nomba tokenization permits a zero-amount auth — that is a validator LOOSENING, therefore non-breaking, and it is the only way an informed integrator can opt out today. WAVE 2 (money engine, separately reviewed): auto-granting the captured amount as customer credit changes the ledger and creates a liability; recording it as a settlement makes it refundable but only once the refund provider leg exists (see the refund item). Do not start Wave 2 before the refund path is decided, or yo

*…trimmed (45 more chars — see the cited files).*

**Files.** `apps/docs/content/guides/start-a-subscription.mdx`, `packages/core-contracts/src/validations/payment-method.ts`, `apps/api/src/shared/services/payment-methods/attach.ts`

---

## E30. 🟠 The spec documents list pagination under `meta.pagination`; the API returns it as a TOP-LEVEL `pagination` block — GET /v1/subscriptions is uncursorable if you follow the docs

**What we publish**

apps/api/src/shared/openapi/build.ts:167-179 — "ResponseMeta: { type: 'object', properties: { requestId: {…}, pagination: { type: 'object', properties: { nextCursor: {…}, hasMore: {…} } } } }", while the list success envelope (build.ts:90-106) declares only `success`/`statusCode`/`data`/`meta`. The reference page for "List subscriptions" builds its example response from that schema (apps/docs/src/lib/api-ref/samples.ts:115-117 `responseExample`), so it prints `"meta": { "requestId": …, "pagination": { "nextCursor": …, "hasMore": … } }` and no top-level `pagination`.

**What the code does**

packages/core-contracts/src/types/envelope.ts:8-32 — `export interface ApiMeta { requestId: string; }` (no pagination) and `export interface ApiPaginated<T> { success: true; statusCode: number; data: T[]; pagination: ApiPagination; meta: ApiMeta; }` with `ApiPagination = { limit; hasMore; nextCursor }`. The list handler writes exactly that: apps/api/src/shared/http/paginated.ts:26-32 — `const body: ApiPaginated<T> = { success: true, statusCode, data, pagination: { limit, hasMore, nextCursor }, meta: { requestId } };`. GET /v1/subscriptions uses `paginatedHandler` (apps/api/src/apps/main/modules/subscriptions/controllers/list-subscriptions.ts:13).

**Impact.** An integrator coding against the spec or the reference reads `response.meta.pagination.nextCursor` → `undefined` → concludes there is no next page and silently truncates every list at 20 rows. The real cursor lives at `response.pagination.nextCursor`, which the spec never mentions; the documented block also omits `limit`, which the API does return.

**Fix.** apps/api/src/shared/openapi/build.ts: drop `pagination` from the ResponseMeta schema (:171-177), and in `successResponse(routeKey)` (:83-107) add a top-level `pagination: { type: 'object', required: ['limit','hasMore','nextCursor'], properties: { limit: {type:'integer'}, hasMore: {type:'boolean'}, nextCursor: {type:'string', nullable:true} } }` for routes whose mapping has `list: true`. Regenerate apps/docs/src/generated/openapi.json.

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the generated OpenAPI schema (apps/api/src/shared/openapi/build.ts:167-179) wrongly nests the cursor block as `meta.pagination` and the list success envelope (build.ts:90-106) never declares the real top-level `pagination`, while the API actually returns `{ ..., pagination: { limit, hasMore, nextCursor }, meta: { requestId } }` (paginated.ts:26-32, envelope.ts:8-32). The stale schema flows into apps/docs/src/generated/openapi.json and into the auto-generated "List subscriptions" response example (samples.ts responseExample -> resolveSchema follows the $ref), so the reference prints a phantom `meta.pagination` (missing `limit`) and no top-level `pagination`. Two corrections 
> 
> *…trimmed (593 more chars — see the cited files).*
> The defect is real but should be restated: (1) It affects ALL 12 paginated list endpoints, not just GET /v1/subscriptions — every route using paginatedHandler. (2) The dominant integration path is NOT broken: all 9 SDKs document and expose top-level `pagination` correctly, so only raw-HTTP and OpenAPI-codegen integrators are affected. (3) "Silently truncates at 20 rows" only holds if the integrator uses optional chaining; a direct `meta.pagination.nextCursor` read throws a loud TypeError. The strongest true impact is that OpenAPI-codegen clients built from this spec have no top-level pagination field at all and therefore cannot paginate. (4) The documented block also omits `limit`, which the
> 
> *…trimmed (226 more chars — see the cited files).*

---

## E31. 🟠 The spec puts list pagination at `meta.pagination`; the API returns it top-level as `pagination` (and with a `limit` field the spec omits) — following the reference truncates every list at 20

**What we publish**

apps/api/src/shared/openapi/build.ts:167-176 — `ResponseMeta: { type: 'object', properties: { requestId: {...}, pagination: { type: 'object', properties: { nextCursor: {...}, hasMore: {...} } } } }`. The list success envelope (build.ts:92-104) is `{ success, statusCode, data: [Ref], meta: $ref ResponseMeta }` — there is NO top-level `pagination` property. So openapi.json tells GET /v1/plans, GET /v1/prices and GET /v1/plans/{id}/prices consumers that the cursor lives at `meta.pagination.nextCursor`, and the generated reference (api-operation.tsx:127-133 `Example response`) renders exactly that shape.

**What the code does**

apps/api/src/shared/http/paginated.ts:26-31 — the real body is `{ success: true, statusCode, data, pagination: { limit, hasMore, nextCursor }, meta: { requestId: req.requestId } }`. The DTO agrees: packages/core-contracts/src/types/envelope.ts:26-32 `ApiPaginated` has TOP-LEVEL `pagination: ApiPagination` with THREE fields (`limit`, `hasMore`, `nextCursor`), and envelope.ts:8-10 `ApiMeta` contains ONLY `requestId`. `meta.pagination` does not exist on the wire; top-level `pagination` is not in the spec.

**Impact.** A developer paginating a catalog against the generated reference (or against a client generated from openapi.json) reads `response.meta.pagination.hasMore` → `undefined` → falsy → they stop after the first page and never see plan or price #21. Silent truncation, 200 status, no error. Conversely a spec-generated typed client has no `pagination` field on list responses at all, so the cursor is unreachable through the typed surface. Hits all three list ops in this group plus every other list endpoint in the API.

**Fix.** apps/api/src/shared/openapi/build.ts — in `successResponse` (build.ts:82-107), when `mapped.list` is true add a top-level `pagination: { type: 'object', required: ['limit','hasMore','nextCursor'], properties: { limit: { type: 'integer' }, hasMore: { type: 'boolean' }, nextCursor: { type: 'string', nullable: true } } }` to the envelope properties, and DELETE the `pagination` sub-object from `ResponseMeta` (build.ts:171-176) so `meta` carries only `requestId`, matching `ApiMeta`.

**Files.** `apps/api/src/shared/openapi/build.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is technically correct in every particular; only its blast radius needs scoping. Accurate version: the OpenAPI spec (build.ts:90-106 + 167-179, and the shipped apps/docs/src/generated/openapi.json) places list pagination at `meta.pagination` with only `{nextCursor, hasMore}`, while the wire (paginated.ts:26-32) and the DTO (core-contracts envelope.ts:26-32) put it top-level as `pagination: {limit, hasMore, nextCursor}`. This affects EVERY list endpoint, not just the three catalog ops. However: no shipped code reads `meta.pagination` (zero grep hits), and all nine SDK docs pages document the top-level shape correctly — so SDK users are unaffected and nothing breaks at runtime. Thi
> 
> *…trimmed (676 more chars — see the cited files).*
> The finding is accurate on facts and mechanism, with two refinements. (1) It slightly over-reaches on blast radius: the nine official SDKs and their docs all use the CORRECT top-level `pagination` shape, so SDK users are unaffected. Only raw-REST integrators reading the generated reference and consumers doing codegen from openapi.json are hit. (2) It under-reports two details that make the fix bigger: `ResponseMeta` is $ref'd into EVERY operation's success envelope (build.ts:101), not just list ops, so the phantom `meta.pagination` pollutes non-list endpoints too; and the spec's pagination object also omits the `limit` field the wire actually returns. Fix is to drop `pagination` from `Respon
> 
> *…trimmed (120 more chars — see the cited files).*

---

## E32. 🟠 Widening the idempotency middleware to PUT/PATCH/DELETE is a breaking change that will start 400ing a live money route — and it is the WRONG fix for the ledger race it is supposed to close

**What we publish**

One finding says: fix `apps/api/src/shared/middlewares/idempotency.ts:52` by widening participation to all mutating methods, because the strict `idempotency` mounted on DELETE /v1/customers/{id}/credit/{grantId} is currently a no-op and the double-reversal race is real.

**What the code does**

idempotency.ts:51-55 short-circuits every non-POST. Widening it makes the STRICT variant on that DELETE start enforcing — i.e. any caller who omits `Idempotency-Key` on `DELETE /v1/customers/{id}/credit/{grantId}` goes from 200 to 400 IDEMPOTENCY_KEY_MISSING overnight. Separately, the race is real and independent of the middleware: apps/api/src/apps/main/modules/customers/controllers/void-customer-credit.ts:19 passes the raw pool `db` (no transaction), and apps/api/src/shared/services/credits/void.ts posts the `reversal` transaction at :67-75 BEFORE the `voidedAt IS NULL`-guarded UPDATE at :77-80. Two concurrent DELETEs both pass the `grant.voidedAt` check, both post a reversal, and only one wins the UPDATE — a double debit of customer_credit / double credit of platform_revenue that no idempotency header can prevent when the keys differ.

**Impact.** Naively 'fixing the middleware' (a) breaks a live public route for anyone not sending the header, and (b) leaves the actual money bug open, because idempotency only dedupes IDENTICAL keys — two genuinely-concurrent voids with different keys still double-post.

**Fix.** Split it into three, in this order:

1. FIX THE LEDGER RACE FIRST, in code, independent of the middleware: wrap voidCreditGrant in a transaction and `SELECT ... FOR UPDATE` the grant row (or move the guarded UPDATE ahead of the postTransaction and post only when it returns a row). This is the only fix that actually closes the double-reversal, and it is non-breaking. postTransaction already accepts an InfraTxScope and nests as a SAVEPOINT, so it composes with the surrounding tx.

2. FIX THE SPEC TO MATCH REALITY (no behavior change): in apps/api/src/shared/openapi/build.ts:128 stop emitting `Idempotency-Key` for non-POST verbs, and derive `required` from the route's real middleware (tag the strict `idempotency` handler with a symbol the collectRoutes walker reads, exactly as `validate` is tagged with OPENAPI_SCHEMAS). Today the spec marks it required on 44 mutating ops while only ~13 rout

*…trimmed (573 more chars — see the cited files).*

**Files.** `apps/api/src/shared/services/credits/void.ts`, `apps/api/src/apps/main/modules/customers/controllers/void-customer-credit.ts`, `apps/api/src/shared/middlewares/idempotency.ts`, `apps/api/src/shared/openapi/build.ts`

---

## E33. 🟠 `?active=false` on GET /v1/prices and GET /v1/plans/{id}/prices returns ACTIVE prices — `z.coerce.boolean()` maps the string "false" to `true`

**What we publish**

apps/docs/src/generated/openapi.json — GET /v1/prices and GET /v1/plans/{id}/prices both declare `{ "name": "active", "in": "query", "required": false, "schema": { "type": "boolean" } }`. The generated reference (apps/docs/src/components/reference/api-operation.tsx:102, `FieldTable title="Query parameters"`) renders it as `active  boolean  optional` on /reference/prices/list and /reference/plans/list-prices, so `active=false` reads as a supported value.

**What the code does**

packages/core-contracts/src/validations/price.ts:25 — `active: z.coerce.boolean().optional(),`. Express delivers query values as STRINGS, and zod 3.25.76's `z.coerce.boolean()` is `Boolean(input)`. I ran it against the exact schema: `"false" -> true`, `"0" -> true`, `"no" -> true`, `"true" -> true`. Only an empty string yields `false`. The coerced value then reaches apps/api/src/shared/services/prices/queries.ts:62 — `opts.active !== undefined ? eq(pricesTable.active, opts.active) : undefined` — so the WHERE clause becomes `active = true` for every non-empty input.

**Impact.** A developer building a "retired prices" view calls `GET /v1/plans/{planId}/prices?active=false` and gets back the plan's LIVE, SELLABLE prices — the exact inverse of what they asked for, with a 200 and no error. There is no input that can retrieve inactive prices through this filter. Anyone who ships a UI or a reconciliation job on that filter is silently showing/acting on the wrong set of prices.

**Fix.** packages/core-contracts/src/validations/price.ts:25 — replace `active: z.coerce.boolean().optional()` with a string-aware parser, e.g. `active: z.enum(['true','false']).transform((v) => v === 'true').optional()` (which also makes `?active=bogus` a clean 422 instead of a silent `true`). Add a unit case in apps/api/test/unit/catalog.test.ts asserting `listPriceQuery.parse({ active: 'false' }).active === false`.

**Files.** `packages/core-contracts/src/validations/price.ts`, `apps/api/test/unit/catalog.test.ts`

> **Refuter's correction — re-scopes this finding:**
> The core defect is CONFIRMED: `z.coerce.boolean()` at packages/core-contracts/src/validations/price.ts:25 is `Boolean(input)`, so the string "false" (and "0", "no", any non-empty string) coerces to `true`, and apps/api/src/shared/services/prices/queries.ts:62 then builds `WHERE active = true`. `GET /v1/prices?active=false` and `GET /v1/plans/{id}/prices?active=false` therefore return ACTIVE prices — the inverse of the request — with a 200 and no error. There is no guard, no query-string normalizer (validate.ts:36 parses req.query raw and its comment explicitly delegates coercion to the schema), and no test coverage. OpenAPI advertises `active` as a boolean, so generated SDKs serialize `false
> 
> *…trimmed (1004 more chars — see the cited files).*
> Facts hold, severity is inflated. Correct framing: a public, documented list filter on GET /v1/prices and GET /v1/plans/{id}/prices is permanently broken for `active=false` (returns the active set with a 200), reachable by any integrator following the API reference — but it is read-only, correctly tenant/mode-scoped, touches no money or auth path, and no first-party surface (console reads the DB directly) consumes it today. Severity: medium, not high. Also note it's a class bug: every `z.coerce.boolean()` in a query schema has the same defect.

---

## E34. 🟠 `additionalProperties: false` in the spec is a lie — every plans/prices zod body silently STRIPS unknown keys, so a typo'd `intervalCount` bills 3× as often with a 201

**What we publish**

apps/docs/src/generated/openapi.json — the POST /v1/plans body schema ends `"required": ["name"], "additionalProperties": false`, and each embedded `prices[]` item ends `"required": ["unitAmountInKobo", "interval"], "additionalProperties": false`. Same on POST /v1/plans/{id}/prices and PATCH /v1/plans/{id}. A strict-object contract promises that an unrecognised key is REJECTED — that is the whole safety value of publishing it.

**What the code does**

The schemas are plain `z.object(...)` with no `.strict()`: packages/core-contracts/src/validations/price.ts:12 `export const createPriceBody = z.object({...})` and validations/plan.ts:44 `export const createPlanBody = z.object({...})`. zod 3's default `unknownKeys` is `"strip"`, and apps/api/src/shared/http/validate.ts:34 does `req.body = schemas.body.parse(req.body)` — so unknown keys are silently DROPPED, never rejected. `additionalProperties: false` is emitted by `zodToJsonSchema(schema, { target: 'openApi3' })` (build.ts:26), which assumes strict semantics the schema does not have. I ran the exact createPriceBody: `parse({ unitAmountInKobo: 250000, interval: 'month', interval_count: 3, trialDays: 14, currency: 'NGN' })` → `{"unitAmountInKobo":250000,"interval":"month","intervalCount":1,"usageType":"licensed","billingScheme":"per_unit","trialPeriodDays":0}` — no error, 201.

**Impact.** A developer sending `interval_count: 3` (snake_case, the natural slip in Python/Ruby/Go) intends quarterly billing. They get a 201, a price object back, and `intervalCount: 1` — the customer is billed MONTHLY, three times as often as intended, forever. Same class: `trialDays: 14` → a 201 with `trialPeriodDays: 0`, so the promised free trial never happens and the customer is charged on day one. The spec explicitly promised these would be rejected. This is precisely the failure `additionalProperties: false` exists to prevent, and the API does the opposite of what it publishes.

**Fix.** packages/core-contracts/src/validations/price.ts:12 and :23, and validations/plan.ts:44, :68, :79 — append `.strict()` to each `z.object(...)` (for plan.ts:68 apply `.strict()` before the `.refine(...)`). That makes the published `additionalProperties: false` true, turns the typos above into a 422 with a `fields` map, and requires no spec change.

**Files.** `packages/core-contracts/src/validations/price.ts`, `packages/core-contracts/src/validations/plan.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and, if anything, understates its scope. Accurate version:
> 
> The API publishes `additionalProperties: false` on 32 of 32 request bodies in apps/docs/src/generated/openapi.json — not just the three plans/prices endpoints — while every corresponding zod schema is a plain non-strict `z.object` (zod ^3.23, default `unknownKeys: "strip"`). apps/api/src/shared/http/validate.ts calls `schemas.body.parse(req.body)`, so unknown keys are silently dropped and defaults are applied, never rejected. Verified by execution: `createPriceBody.parse({unitAmountInKobo:250000, interval:'month', interval_count:3, trialDays:14, currency:'NGN'})` returns `intervalCount:1, trialPeriodDays:0` wi
> 
> *…trimmed (1145 more chars — see the cited files).*
> The finding is accurate but scoped too narrowly. It is not a plans/prices bug -- it is an API-wide contract lie. Only settings.ts uses .strict(); all 32 other request bodies in the published spec emit additionalProperties:false while zod silently strips unknown keys. The highest-money instances are on subscriptions, not plans: POST /v1/subscriptions (quantity -> 1, collectionMethod -> charge_automatically), POST /v1/subscriptions/{id}/change (prorationBehavior -> create_prorations), POST /v1/subscriptions/{id}/cancel (mode -> now), POST /v1/customers/{id}/credit (source), POST /v1/mandates (frequency), POST /v1/webhooks (enabledEvents). Also worth noting the spec is consumed by the docs MCP 
> 
> *…trimmed (376 more chars — see the cited files).*

---

## E35. 🟠 `maxDays` on pause is documented as "auto-resume after this many days" — nothing ever reads it, so the subscription stays paused forever

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:168-171 — "export interface SubscriptionPauseParams { /** Auto-resume after this many days. */ maxDays?: number; }" (the field is also published in the spec and on /reference/subscriptions/pause).

**What the code does**

`maxDays` is written and read by nobody: apps/api/src/shared/services/subscriptions/transition.ts:158-161 — `await transition(txDb, ctx, sub, 'paused', { event: 'subscription.paused', set: { pausedAt: new Date(), pauseMaxDays: input.maxDays ?? null } });`. A repo-wide grep for `pauseMaxDays`/`pause_max_days` yields exactly three hits: the type union (transition.ts:55), that write (transition.ts:160), and the column (packages/core-db/src/schema/subscriptions.ts:80). No sweep selects paused subs — the lifecycle sweep does incomplete-expiry, trial notices and PM-expiry notices only (apps/api/src/shared/services/billing/lifecycle-sweep.ts:42-80), and the billing sweep bills only `['active','trialing']` (apps/api/src/shared/services/billing/queries.ts:17). Resuming happens only via an explicit POST …/resume.

**Impact.** A merchant pauses with `maxDays: 30` believing billing restarts automatically and never calls resume. The subscription is never resumed and never billed again — straight lost revenue, discovered months later.

**Fix.** Either implement it (add a pass in `runLifecycleSweep`, apps/api/src/shared/services/billing/lifecycle-sweep.ts, that resumes `paused` subs where `pausedAt + pauseMaxDays days <= now`) or tell the truth: change /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:169 (and the eight mirrors) to "Advisory only — recorded on the subscription; you must still call `resume()`."

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts`, `apps/api/src/shared/services/billing/lifecycle-sweep.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and, if anything, understated. All quotes verified verbatim at the cited lines. `pauseMaxDays` has exactly three TS source hits repo-wide (schema column at packages/core-db/src/schema/subscriptions.ts:80, the type union at transition.ts:55, the write at transition.ts:160) and zero reads. No guard/env-gate/default/reassignment exists. Confirmed the two candidate readers do not touch it: resumeSubscription (transition.ts:175-204) reads only pausedAt/priceId/currentPeriodIndex/billingCycleAnchor — its design comment concerns anchor-shifting, not auto-resume, so this is not a missed-design-comment false positive; and lifecycle-sweep.ts has only three passes (incomplete-exp
> 
> *…trimmed (1820 more chars — see the cited files).*
> The finding is accurate as written; two amplifications. (1) It is not only the Node SDK — the same "auto-resume after this many days" doc comment ships in the Go, PHP, and Ruby SDKs (nombaone-go/subscriptions.go:261, nombaone-php/src/Resources/Subscriptions.php:139, nombaone-ruby/lib/nombaone/resources/subscriptions.rb:185), so the false promise is spread across the published SDK surface. (2) The OpenAPI entry (apps/docs/src/generated/openapi.json:5003) exposes `maxDays` as a bare integer with NO description — the auto-resume semantics exist only in SDK doc comments, and the API 200s on the field with no warning, giving the integrator zero signal. Fix: either add a paused-expiry pass to the 
> 
> *…trimmed (71 more chars — see the cited files).*

---

## E36. 🟡 /errors documents CREDIT_GRANT_ALREADY_VOIDED and CREDIT_INSUFFICIENT_BALANCE — the API has zero throw sites for either, and void is explicitly idempotent

**What we publish**

Both codes are in `PUBLIC_ERROR_CODES` (packages/errors/src/codes.ts:316-317), so apps/docs/src/components/mdx/error-reference.tsx renders them on /errors — a page whose own copy says the list is "straight from the API's registry, so this list is complete and never drifts". Their hints (codes.ts:761-768):
```
CREDIT_GRANT_ALREADY_VOIDED: hint: 'This credit grant is already voided and cannot be voided or spent again. Issue a new credit grant if the customer needs more credit.'
CREDIT_INSUFFICIENT_BALANCE: hint: "The customer's credit balance is too low to cover this amount. Grant more credit, or apply a smaller amount."
```

**What the code does**

Neither code is ever thrown. `grep -rn "NOMBAONE_ERROR_CODES.CREDIT_GRANT_ALREADY_VOIDED" apps/api/src packages/sara/src` → 0 hits; same for CREDIT_INSUFFICIENT_BALANCE. The actual behaviour is the opposite of what the first hint describes — apps/api/src/shared/services/credits/void.ts:54-57:
```ts
// Idempotent: an already-voided grant is returned as-is (no second reversal).
if (grant.voidedAt) {
  return serializeCreditGrant(grant, customerRef);
}
```
DELETE /v1/customers/{id}/credit/{grantId} on an already-voided grant returns **200 with the grant**, never an error. And credit application is best-effort by design (credits/apply.ts consumes up to the available remainder), so there is no insufficient-balance path.

**Impact.** A developer writes a `catch (CREDIT_GRANT_ALREADY_VOIDED)` branch for double-void — dead code that never fires — and, worse, assumes a repeat DELETE is unsafe and adds their own guard, when the endpoint is already idempotent. The /errors page explicitly promises completeness and non-drift, so these entries are trusted. Note the framing: the codes are *documented but unreachable*, the inverse of an undocumented error.

**Fix.** packages/errors/src/codes.ts: remove `NOMBAONE_ERROR_CODES.CREDIT_GRANT_ALREADY_VOIDED` and `NOMBAONE_ERROR_CODES.CREDIT_INSUFFICIENT_BALANCE` from the `PUBLIC_ERROR_CODES` list (lines 316-317) and drop their `ERROR_CODE_META` entries (lines 761-768). Then add one sentence to the credit section of apps/docs/content/guides/coupons-and-credits.mdx: "Voiding an already-voided grant is a no-op and returns 200 with the grant unchanged."

**Files.** `packages/errors/src/codes.ts`, `apps/docs/content/guides/coupons-and-credits.mdx`

> **Refuter's correction — re-scopes this finding:**
> The facts are right; the impact framing is overstated, which is why this is LOW, not medium.
> 
> 1. The "completeness promise" is one-directional. error-reference.tsx's copy — "Every public error code, straight from the API's registry, so this list is complete and never drifts" — promises that every code the API *emits* is listed. It does not promise every listed code is *reachable*. The page is a flat registry dump with no per-endpoint mapping, so it never tells a developer "DELETE credit can return CREDIT_GRANT_ALREADY_VOIDED."
> 
> 2. Same for OpenAPI. apps/docs/src/generated/openapi.json:126-127 puts these codes in a single shared `code` enum on the global Error schema — it is not a per-endpoin
> 
> *…trimmed (1133 more chars — see the cited files).*

---

## E37. 🟡 A duplicate coupon `code` returns 409 COUPON_INVALID_DEFINITION, whose documented fix is about percent-vs-amount and cannot resolve it

**What we publish**

packages/errors/src/codes.ts:745-748, on /errors#COUPON_INVALID_DEFINITION:
```ts
COUPON_INVALID_DEFINITION: {
  hint: "The coupon's definition is inconsistent (e.g. both a percent and a fixed amount, or a non-positive value). Fix the definition so exactly one valid discount is specified.",
```

**What the code does**

apps/api/src/shared/services/coupons/create.ts:50-56 reuses that same code for a completely different failure — a `code` collision, returned as HTTP 409:
```ts
if (existing) {
  throw AppError.Conflict(
    'a coupon with this code already exists',
    { code: input.code },
    NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION
  );
}
```
So COUPON_INVALID_DEFINITION is emitted at four sites with two different HTTP statuses (422 for the XOR/repeating-cycles rules at create.ts:24-37, 409 for the duplicate code). The codebase already has the right pattern for this: a duplicate customer email gets its own dedicated `CUSTOMER_EMAIL_TAKEN` (customers/create.ts:42-48). Coupons got none.

**Impact.** Re-running a seed/setup script — the single most common way to hit this — produces `409 COUPON_INVALID_DEFINITION` whose documented remedy is "fix the definition so exactly one valid discount is specified". The definition is fine; the code is taken. The developer edits amountOffInKobo/percentOff, re-sends, and gets the same 409. They also cannot branch on it programmatically: the same code means "your XOR is wrong" (422) and "this code is taken" (409).

**Fix.** Add `COUPON_CODE_TAKEN: 'COUPON_CODE_TAKEN'` to packages/errors/src/codes.ts (alongside COUPON_NOT_FOUND at line 178), add it to PUBLIC_ERROR_CODES (near line 309) with hint 'A coupon with this code already exists in your organization. Reuse the existing coupon, or create this one with a different code.' — mirroring CUSTOMER_EMAIL_TAKEN — and use it at apps/api/src/shared/services/coupons/create.ts:54 in place of NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION.

**Files.** `packages/errors/src/codes.ts`, `apps/api/src/shared/services/coupons/create.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: COUPON_INVALID_DEFINITION is overloaded across FOUR emission sites with THREE distinct semantics and two HTTP statuses — 422 XOR (coupons/create.ts:28, the only one the hint actually describes), 422 repeating-needs-durationInCycles (create.ts:35, not covered by the hint), 409 duplicate `code` (create.ts:54), and 422 "a customer or subscription target is required" (discounts/apply.ts:94, not a definition error at all). On the duplicate-code path the API returns 409 with a correct, specific `message` ("a coupon with this code already exists") but a contradictory `hint` and a docUrl pointing at guidance about percent-vs-amount. The fix is a dedicated COUPON_CODE_TAKEN (mirrori
> 
> *…trimmed (381 more chars — see the cited files).*
> The finding is true and production-reachable, but its impact story is overstated. It ignores that the error handler (apps/api/src/shared/http/error-handler.ts:50-63) returns `message` in the same payload as `hint`/`docUrl`. The actual 409 body is code=COUPON_INVALID_DEFINITION, message="a coupon with this code already exists", hint="The coupon's definition is inconsistent...". The developer therefore reads an accurate, self-explanatory message; they will not plausibly loop editing amountOffInKobo as claimed. Likewise, "cannot branch on it programmatically" is only partly right — the HTTP status disambiguates (409 = duplicate code, 422 = XOR/repeating-cycles rule), so status+code is a workabl
> 
> *…trimmed (647 more chars — see the cited files).*

---

## E38. 🟡 All five plans/prices mutating ops are marked `Idempotency-Key: required` in the spec but every one uses `idempotencyOptional`

**What we publish**

apps/api/src/shared/openapi/build.ts:128-130 — `if (MUTATING.has(method)) { parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }); }`. openapi.json therefore marks the header `"required": true` on POST /v1/plans, PATCH /v1/plans/{id}, POST /v1/plans/{id}/archive, POST /v1/plans/{id}/prices and POST /v1/prices/{id}/deactivate.

**What the code does**

apps/api/src/apps/main/modules/plans/routes.ts:39, :57, :68, :78 and apps/api/src/apps/main/modules/prices/routes.ts:43 — every one of those five routes uses `idempotencyOptional`, not the strict `idempotency` middleware. None of the five plans/prices routes uses the strict variant. Omitting the header is a 2xx, never `IDEMPOTENCY_KEY_MISSING`. Corroborated by the docs' own guide, which shows POST /v1/plans/{id}/prices WITHOUT the header at apps/docs/content/guides/create-plans-and-prices.mdx:95-98 — a call the spec says is invalid.

**Impact.** ADDS to the known build.ts finding: (a) names the five catalog ops and confirms ZERO of them are strict; (b) a NEW nuance that bounds the blast radius honestly — apps/docs/src/components/reference/api-operation.tsx:101-103 renders only `pathParams` and `queryParams`, and model.ts:348-349 filters headers out of both, so the false `required` never appears in the reference UI. It reaches consumers of the RAW openapi.json only: a spec-validating gateway or a generated client will hard-require a header the server does not want, and a strict request validator will 400 the guide's own example at create-plans-and-prices.mdx:95-98 before it leaves the client.

**Fix.** apps/api/src/shared/openapi/build.ts:128-130 — derive `required` from the route's actual stack instead of from `MUTATING`. The `validate` middleware already tags itself with `OPENAPI_SCHEMAS` (apps/api/src/shared/http/validate.ts:15) for exactly this pattern; tag `idempotency` (strict) with an analogous `Symbol.for('nombaone.openapi.idempotency')`, read it in `collectRoutes` (build.ts:44-51), and emit `required: <strict>` — `false` for all five catalog ops.

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/api/src/shared/middlewares/idempotency.ts`

> **Refuter's correction — re-scopes this finding:**
> The mechanism is real but the scoping is wrong. build.ts:128-130 marks `Idempotency-Key` as `required: true` on EVERY mutating operation — 44 of them in the generated openapi.json — while only 13 routes API-wide actually mount the strict `idempotency` middleware. So roughly 31 operations (not just the five plans/prices ones) advertise a header the server does not require; the five catalog ops are a subset, not a separate finding, and should be folded into the single build.ts bug. The correct fix is to derive the header's `required` from the route's actual middleware (e.g. tag the strict `idempotency` handler with a symbol the walker reads, exactly as `validate` is tagged with OPENAPI_SCHEMAS
> 
> *…trimmed (356 more chars — see the cited files).*
> The accurate version: build.ts:128-130 stamps `required: true` on the Idempotency-Key header for EVERY mutating op — 44 of 44 in the generated spec, not just the five plans/prices routes — while the strict `idempotency` middleware is intentionally reserved for money-movement routes and everything else (including all five catalog ops) uses `idempotencyOptional`. The spec is served publicly at GET /v1/openapi.json, so codegen consumers do see it. However, the divergence over-requires rather than under-requires: the server accepts the header on those routes, so a generated client that demands it still succeeds. The realistic harm is spec inaccuracy / forced parameter in generated SDKs and a doc
> 
> *…trimmed (326 more chars — see the cited files).*

---

## E39. 🟡 Coupon `metadata` is write-only: accepted and stored, never returned by any endpoint

**What we publish**

The OpenAPI body for POST /v1/coupons and PATCH /v1/coupons/{id} both advertise `"metadata": {"type":"object","additionalProperties":{}}`, so /reference/coupons/create and /reference/coupons/update both list `metadata` in the "Request body" table and both put `"metadata": {"orderId": "ord_8812"}` in the example body. Nothing tells the reader it is unreadable.

**What the code does**

It is accepted (packages/core-contracts/src/validations/coupon.ts:12 `metadata: z.record(z.string(), z.unknown()).optional()`), persisted (apps/api/src/shared/services/coupons/create.ts:72 `metadata: input.metadata ?? {}`, into a real column — packages/core-db/src/schema/coupons.ts:46), and then dropped on the floor: `serializeCoupon` (apps/api/src/shared/services/coupons/serialize.ts:6-19) emits `domain, id, code, duration, amountOffInKobo, percentOff, durationInCycles, redeemBy, maxRedemptions, timesRedeemed, mode, createdAt` — no `metadata`. `CouponResponseData` (packages/core-contracts/src/types/coupon.ts:5-19) has no `metadata` field, and the `Coupon` response schema (apps/api/src/shared/openapi/responses.ts:155-168) has none either. Every other resource in the group returns it (Customer — responses.ts:68; Plan — responses.ts:55; Price — responses.ts:92). Same story for `updatedAt`: the column exists (coupons.ts:48), PATCH mutates the row, and no coupon response ever carries it.

**Impact.** A developer attaches their internal promo/campaign id to a coupon as metadata (exactly what the reference example shows), then finds it is unreadable through GET /v1/coupons/{id} or GET /v1/coupons — the data is in the database and there is no API path to it. They must maintain a side table keyed by coupon code, defeating the purpose of the field. There is also no way to detect a coupon was modified (no `updatedAt`), despite PATCH being a documented operation.

**Fix.** apps/api/src/shared/services/coupons/serialize.ts: add `metadata: row.metadata,` and `updatedAt: new Date(row.updatedAt).toISOString(),`. packages/core-contracts/src/types/coupon.ts:5-19: add `metadata: Record<string, unknown>;` and `updatedAt: string;` to `CouponResponseData`. apps/api/src/shared/openapi/responses.ts:155-168: add `metadata: bag(),` and `updatedAt: dt(),` to the `Coupon` schema, then regenerate the spec.

**Files.** `apps/api/src/shared/services/coupons/serialize.ts`, `packages/core-contracts/src/types/coupon.ts`, `apps/api/src/shared/openapi/responses.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: Coupon `metadata` is genuinely write-only — accepted (validations/coupon.ts:12,28), persisted (coupons/create.ts:72, update.ts:23, schema/coupons.ts:46), and omitted by the single serializer that backs every coupon response (coupons/serialize.ts:6-19, used by create/update/get/list), by `CouponResponseData`, by the OpenAPI `Coupon` schema, and by the `coupon.created` webhook payload. Every sibling resource (Customer, Plan, Price) returns `metadata`, so this is a real one-off gap. However, the `updatedAt` half of the finding should be DROPPED: omitting `updatedAt` from responses is the house convention here (Price, Subscription, Invoice and Discount all omit it; only Custome
> 
> *…trimmed (208 more chars — see the cited files).*
> The `metadata` half is fully correct and correctly rated medium: it is production-reachable via an ungated API-key-authed route, silently write-only, documented as if readable, and inconsistent with Customer/Plan/Price which all return metadata. The `updatedAt` half is overstated — Price, Subscription, Invoice, and Discount response schemas also omit `updatedAt` (only Customer and Plan include it), so its absence on Coupon reflects an API-wide convention rather than a coupon-specific bug. Report the metadata gap as the finding; raise `updatedAt` separately as an API-wide consistency question, not as part of this one.

---

## E40. 🟡 DELETE /v1/customers/{id}/credit/{grantId} ignores {id} — the documented "belongs to the customer" check does not exist

**What we publish**

The path shape and the error hint both promise the grant is scoped to the customer. packages/errors/src/codes.ts:757-760:
```ts
CREDIT_GRANT_NOT_FOUND: {
  hint: 'No credit grant exists with that id for this customer. Check the id, and that it belongs to the customer and environment you are calling with.',
```
and apps/docs/src/generated/openapi.json declares `id` a required path parameter on the op, which /reference/customers/void-credit-grant renders in the "Path parameters" table as `id  string  required`.

**What the code does**

`{id}` is never read. apps/api/src/apps/main/modules/customers/controllers/void-customer-credit.ts:19:
```ts
const data = await voidCreditGrant(db, ctx, { reference: req.params.grantId ?? '' });
```
and apps/api/src/shared/services/credits/void.ts:28-38 resolves the grant on `(organizationId, mode, reference)` only — no `customerId` predicate. So `DELETE /v1/customers/<any-customer-in-my-org>/credit/<grantRef>` voids that grant and returns 200; the customer segment is inert. (Cross-tenant access is still impossible — the org/mode scope holds — so this is a correctness bug, not a security hole.)

**Impact.** A merchant who passes the wrong customer id (a stale variable, a copy-paste from another row) expects a 404 telling them the grant does not belong to that customer, because that is exactly what the documented error hint promises. Instead the void succeeds silently — real money is reversed out of a customer_credit ledger account (void.ts:61-75 posts a `reversal`) with no signal that the caller addressed the wrong customer. The documented safety check simply is not implemented.

**Fix.** apps/api/src/shared/services/credits/void.ts — take the customer reference and enforce it. Change the signature to `input: { customerRef: string; reference: string }`, resolve the customer id first (reuse `resolveCustomerId` from credits/queries.ts:11), and add `eq(creditGrantsTable.customerId, customerId)` to the WHERE at lines 31-37 so a mismatched customer yields the CREDIT_GRANT_NOT_FOUND it already documents. Then pass it from apps/api/src/apps/main/modules/customers/controllers/void-customer-credit.ts:19: `{ customerRef: req.params.id ?? '', reference: req.params.grantId ?? '' }`.

**Files.** `apps/api/src/shared/services/credits/void.ts`, `apps/api/src/apps/main/modules/customers/controllers/void-customer-credit.ts`

> **Refuter's correction — re-scopes this finding:**
> The code fact is confirmed: DELETE /v1/customers/{id}/credit/{grantId} never reads {id}, and voidCreditGrant scopes only on (organizationId, mode, reference) — the documented "belongs to the customer" check is not implemented, and the path's customer segment is inert. But the impact is smaller than claimed. Because credit_grants.reference has a global unique index (packages/core-db/src/schema/credit-grants.ts:58), the lookup always resolves to exactly the grant named by {grantId}; the reversal posted at void.ts:61-75 debits that grant's TRUE owner's customer_credit account. So a wrong/stale customer id does not reverse money out of the wrong customer and does not misapply funds — it voids pr
> 
> *…trimmed (628 more chars — see the cited files).*
> The bug is real and production-reachable, but the impact is narrower than stated. The finding implies the wrong customer's ledger gets debited; it does not. void.ts:47-52 re-derives the customer from `grant.customerId` (the grant row itself), and `customerCreditAccountKey(customerRef)` at line 63 is built from that — so the `reversal` posting always hits the grant's TRUE owner's customer_credit account. No cross-customer ledger corruption, no cross-tenant exposure (org/mode scope holds).
> 
> The accurate defect: `DELETE /v1/customers/{id}/credit/{grantId}` ignores `{id}`, so an integrator who supplies customer A's id alongside a grant reference belonging to customer B voids B's grant and receiv
> 
> *…trimmed (1219 more chars — see the cited files).*

---

## E41. 🟡 DELETE /v1/subscriptions/{id}/discount is missing from the response map, so the spec documents its body as an untyped `{}` instead of a Discount

**What we publish**

apps/docs/src/generated/openapi.json, DELETE /v1/subscriptions/{id}/discount → `"data": { "type": "object", "description": "Resource payload" }` — the generic fallback from apps/api/src/shared/openapi/build.ts:89 (`: { type: 'object', description: 'Resource payload' }`), produced because apps/api/src/shared/openapi/responses.ts:439-456 maps every other subscription route but has no `'delete /v1/subscriptions/{id}/discount'` entry (its POST twin is mapped at :449).

**What the code does**

apps/api/src/apps/main/modules/subscriptions/controllers/remove-subscription-discount.ts:12-22 — `jsonHandler<DiscountResponseData>(…)` returning `await removeDiscount(db, ctx, { subscriptionRef: req.params.id ?? '' })`, which returns the full ended Discount DTO (apps/api/src/shared/services/discounts/remove.ts:60-69 → `getDiscountByReference(…)` with `status: 'ended'`, `endAt` set). The Node SDK types it correctly: /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:527-534 `removeDiscount(…): APIPromise<Discount>`.

**Impact.** Codegen from the spec yields `unknown`/`object` for this response, so a generated client cannot read `status`, `endAt` or `couponId` off the removed discount without a cast, and /reference/subscriptions/remove-discount shows an empty `{}` example response, which reads as an unfinished endpoint.

**Fix.** apps/api/src/shared/openapi/responses.ts — add `'delete /v1/subscriptions/{id}/discount': { ref: 'Discount' },` beside line 449 and regenerate apps/docs/src/generated/openapi.json. (`'delete /v1/customers/{id}/discount'` is missing for the same reason.)

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but incomplete: the missing mapping is not only 'delete /v1/subscriptions/{id}/discount' — 'delete /v1/customers/{id}/discount' is also absent from RESPONSE_DATA_BY_ROUTE (apps/api/src/shared/openapi/responses.ts:422 maps only its POST twin), and the generated apps/docs/src/generated/openapi.json emits the same untyped {"type":"object","description":"Resource payload"} for it. Both DELETEs funnel into the same removeDiscount() service (apps/api/src/shared/services/discounts/remove.ts:60-69) and return a full ended Discount DTO. The fix is two entries, not one: `'delete /v1/subscriptions/{id}/discount': { ref: 'Discount' }` and `'delete /v1/customers/{id}/discount': { r
> 
> *…trimmed (225 more chars — see the cited files).*
> The finding is factually correct and reachable on a live public surface (unauthenticated-to-read docs page + production endpoint), but "medium" over-states it. There is no runtime defect: the endpoint returns the full ended Discount, and all nine hand-written SDKs type it correctly (nombaone-node/src/resources/subscriptions.ts:527 → APIPromise<Discount>), so the SDK path — which is what most integrators use — is unaffected. Impact is confined to raw-OpenAPI codegen consumers (who still receive the data, but untyped) and to the /reference/subscriptions/remove-discount page rendering `data: {}`. That is a polish/credibility issue, i.e. low.
> 
> The finding also under-scopes the problem: it presen
> 
> *…trimmed (889 more chars — see the cited files).*

---

## E42. 🟡 DISCOUNT_NOT_FOUND's documented fix tells you to verify a discount id and list discounts — the API has neither

**What we publish**

packages/errors/src/codes.ts:753-756, rendered verbatim on /errors#DISCOUNT_NOT_FOUND and linked from the live error envelope's `docUrl`:
```ts
DISCOUNT_NOT_FOUND: {
  hint: 'No discount exists with that id on this subscription or invoice. Verify the id, or list discounts to find the correct one.',
  docUrl: `${DOCS_ERRORS_BASE}#DISCOUNT_NOT_FOUND`,
},
```

**What the code does**

Three things in that one sentence are false. (1) There is no discount id in the request: apps/api/src/apps/main/modules/customers/routes.ts:97-104 registers `DELETE /customers/:id/discount` with no `:discountId` param — `:id` is the CUSTOMER. (2) The real trigger is "this customer has no ACTIVE discount" — apps/api/src/shared/services/discounts/remove.ts:52-58:
```ts
if (!discount) {
  throw AppError.NotFound('no active discount on the target', { ...target }, NOMBAONE_ERROR_CODES.DISCOUNT_NOT_FOUND);
}
```
(3) There is no list-discounts endpoint anywhere: the only discount paths in apps/docs/src/generated/openapi.json are `/v1/customers/{id}/discount` and `/v1/subscriptions/{id}/discount`. The word "invoice" in the hint is also wrong — discounts attach to customers and subscriptions (packages/core-contracts/src/types/discount.ts:9-10 `customerId`, `subscriptionId`).

**Impact.** A developer who calls DELETE twice (or removes a discount that already ended) gets a 404 whose official fix is to "verify the id" (there is no id) and "list discounts" (there is no such call). They will burn time hunting for an endpoint that does not exist before working out that 404 here simply means "nothing active to remove".

**Fix.** packages/errors/src/codes.ts:754 — replace the hint with: 'This customer or subscription has no active discount to remove. A discount that already ended (or was never applied) cannot be removed again; apply a coupon first via POST /v1/customers/{id}/discount.'

**Files.** `packages/errors/src/codes.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantially correct but overstated in one respect and should be downgraded to low.
> 
> ACCURATE VERSION: The DISCOUNT_NOT_FOUND hint (packages/errors/src/codes.ts:753-756), rendered verbatim to users via apps/docs/src/components/mdx/error-reference.tsx:99 and linked from the live error envelope's docUrl, is misleading in three ways:
> 
> 1. It instructs the developer to "list discounts", but no list-discounts endpoint exists. The only discount operations in the API are POST/DELETE on /v1/customers/{id}/discount and /v1/subscriptions/{id}/discount. This is the most damaging part: it sends developers hunting for an endpoint that was never built.
> 
> 2. It says discounts live on a "subsc
> 
> *…trimmed (1309 more chars — see the cited files).*
> The finding is accurate on facts but should be scoped as a documentation/DX copy defect, severity low. Accurate framing: the `DISCOUNT_NOT_FOUND` hint (packages/errors/src/codes.ts:753-756), which is served verbatim in the live error envelope (apps/api/src/shared/http/error-handler.ts:23,59) on the public `DELETE /v1/customers/{id}/discount` and `DELETE /v1/subscriptions/{id}/discount` routes, gives advice that cannot be followed: it tells the caller to verify a discount id (the request carries none — `:id` is the customer/subscription) and to list discounts (no such endpoint exists), and it names "invoice" as a discount target (discounts attach to customers and subscriptions only). The real
> 
> *…trimmed (413 more chars — see the cited files).*

---

## E43. 🟡 Docs say the webhook signing secret looks like `whsec_…`; the API mints `nbo_whsec_…`

**What we publish**

Three pages state the prefix. apps/docs/content/webhooks/overview.mdx:50 "You get back a **signing secret** (`whsec_…`), shown once." apps/docs/content/guides/handle-webhooks.mdx:26 "The response returns a **signing secret** (`whsec_…`), shown once." apps/docs/content/getting-started/verify-in-your-devtools.mdx:37 "The response includes the endpoint's **signing secret** (`whsec_…`), shown once." The interactive verifier seeds and placeholders the same shape: apps/docs/src/components/mdx/webhook-verifier.tsx:28 `const SEED_SECRET = "whsec_nbo_sandbox_demo_secret";` and :102 `placeholder: "whsec_…"`.

**What the code does**

packages/sara/src/webhooks/endpoints.ts:38 — `const generateSigningSecret = (): string => \`nbo_whsec_${randomBytes(24).toString('hex')}\`;`. The real secret is `nbo_whsec_` + 48 hex chars. The stored display prefix is the first 16 chars (endpoints.ts:36 `SIGNING_SECRET_PREFIX_LEN = 16`, :49), i.e. `nbo_whsec_xxxxxx` — which is what `signingSecretPrefix` returns on every read.

**Impact.** Low-blast-radius but it corrodes trust exactly where trust is the product. A developer who wrote a `startsWith("whsec_")` guard, a secret-scanner rule, or a config validator against the documented prefix rejects their own real secret. More practically: the `signingSecretPrefix` the API returns on `GET /v1/webhooks/{id}` and on `GET /v1/organization` (`webhook.signingSecretPrefix`) begins `nbo_whsec_`, so it does not match the `whsec_…` the docs told them to look for, and they cannot tell which stored secret corresponds to which endpoint. It also reads as copied-from-Stripe rather than written-from-the-code.

**Fix.** Replace `whsec_…` with `nbo_whsec_…` at apps/docs/content/webhooks/overview.mdx:50, apps/docs/content/guides/handle-webhooks.mdx:26, and apps/docs/content/getting-started/verify-in-your-devtools.mdx:37. In apps/docs/src/components/mdx/webhook-verifier.tsx, change line 28 to `const SEED_SECRET = "nbo_whsec_demo0000000000000000000000000000000000000000000000";` and line 102's placeholder to `"nbo_whsec_…"`.

**Files.** `apps/docs/content/webhooks/overview.mdx`, `apps/docs/content/guides/handle-webhooks.mdx`, `apps/docs/content/getting-started/verify-in-your-devtools.mdx`, `apps/docs/src/components/mdx/webhook-verifier.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but needs two adjustments — one widening, one narrowing.
> 
> WIDER THAN CLAIMED: it is 4 English content pages, not 3. The auditor missed apps/docs/content/guides/going-live.mdx:44 ("store the new `whsec_…` secret"). The drift also propagates to the built mirrors (apps/docs/public/webhooks/overview.md:52, public/guides/handle-webhooks.md:28, public/guides/going-live.md:47, public/getting-started/verify-in-your-devtools.md:39, and public/llms-full.txt:1589/2280/2357/6918) and to the Yoruba and Hausa localizations (apps/docs/l10n/yo/… and apps/docs/l10n/ha/…). llms-full.txt is the agent-ingestion surface, so the wrong prefix is served to LLM consumers too. Also apps/docs/co
> 
> *…trimmed (1975 more chars — see the cited files).*
> The prefix claim is factually correct (docs say `whsec_…`, `packages/sara/src/webhooks/endpoints.ts:38` mints `nbo_whsec_` + 48 hex), and the pages listed are right — but the finding under-counts the blast radius and slightly over-claims the harm. Under-counted: the same wrong prefix is also in `apps/docs/content/guides/going-live.mdx:44`, in the agent-readable mirrors `apps/docs/public/{webhooks/overview,guides/handle-webhooks,guides/going-live,getting-started/verify-in-your-devtools}.md`, and in both localized trees (`apps/docs/l10n/yo/**`, `apps/docs/l10n/ha/**`) — 12+ files, not 3. Over-claimed: "they cannot tell which stored secret corresponds to which endpoint" is wrong — the returned 
> 
> *…trimmed (813 more chars — see the cited files).*

---

## E44. 🟡 Every mandate/payment-method sample id uses an id shape the API can never mint (`…mnd` / `…pm` vs the real `…pmt`), and nothing says GET /v1/mandates/{id} wants `reference`, not `mandateRef`

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:94 — `invoices: "inv", coupons: "cpn", mandates: "mnd", settlements: "stl",` and :95 — `"payment-methods": "pm"` — so every code sample for GET /v1/mandates/{id} reads `nombaone.mandates.retrieve("nbo000000000001mnd")` and every payment-method sample uses `nbo000000000001pm`. apps/docs/src/lib/api-ref/samples.ts:52-54 repeats it (`paymentmethodid: "nbo000000000001pm"`, `mandateid: "nbo000000000001mnd"`). The path param renders as a bare `id  string  required` with no description (apps/api/src/shared/openapi/build.ts:79 emits `{ name, in: 'path', required: true, schema: { type: 'string' } }` — no description is ever attached).

**What the code does**

There is no `mnd`- or `pm`-suffixed reference in the system. Mandates, cards and virtual accounts are ALL rows in `payment_methods`, minted with `mintReference('PMT')` (apps/api/src/shared/services/payment-methods/attach.ts:96 for `createMandate`, :42 for `setupCard`, :175 for `issueVirtualAccount`) — the e2e asserts the shape: apps/api/test/e2e/payment-methods.e2e.test.ts:76 — `expect(pmtRef).toMatch(/pmt$/);`. And `GET /v1/mandates/{id}` resolves ONLY against that reference: apps/api/src/shared/services/payment-methods/queries.ts:171-175 filters `eq(paymentMethodsTable.reference, reference)` (no `mandateId` branch) and throws `PAYMENT_METHOD_NOT_FOUND` at :181. But `POST /v1/mandates` returns TWO ids — `{ reference, mandateRef, status, consentInstruction }` (apps/api/src/shared/services/payment-methods/attach.ts:160, typed at packages/core-contracts/src/types/nomba.ts:15-22) — where `mandateRef` is the Nomba-side `mandateId`. Nothing in the docs says which one to poll with.

**Impact.** The mandate flow is exactly two calls, and the docs get the join between them wrong. A developer creates a mandate, receives `{ reference, mandateRef }`, sees the reference page's sample id `nbo000000000001mnd` (which looks like a mandate-specific id and therefore like `mandateRef`), calls `GET /v1/mandates/{mandateRef}`, and gets `404 PAYMENT_METHOD_NOT_FOUND` on a mandate they just successfully created. The correct value is `reference` — the `…pmt` payment-method ref — and no page, sample, or field description says so.

**Fix.** (1) apps/docs/src/lib/api-ref/snippets.ts:94 and apps/docs/src/lib/api-ref/samples.ts:52-54 — change the payment-methods and mandates id suffixes from `pm`/`mnd` to `pmt` so the samples show a shape the API can actually mint. (2) apps/api/src/shared/openapi/responses.ts:396 — add descriptions to the MandateSetup schema so the reference page distinguishes the two ids: `reference` = "The payment-method reference (`nbo…pmt`). **This is the id you pass to `GET /v1/mandates/{id}`.**", `mandateRef` = "The provider-side (NIBSS) mandate id. Informational — not accepted by any Nomba One endpoint." (3) Teach apps/api/src/shared/openapi/build.ts:77-80 `pathParameters()` to attach a per-route description, and give `GET /v1/mandates/{id}` the text "The payment-method reference returned as `reference` by POST /v1/mandates (not `mandateRef`)."

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`, `apps/docs/src/lib/api-ref/samples.ts`, `apps/api/src/shared/openapi/responses.ts`, `apps/api/src/shared/openapi/build.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is right but two details in it are slightly off. (1) `samples.ts:54` (`mandateid: "nbo000000000001mnd"`) appears to be a DEAD map entry — no schema field is named `mandateId`; the mandate response field is `mandateRef` (openapi/responses.ts:396). The live mandate leak is snippets.ts:94 alone, not "samples.ts repeats it". (2) Conversely the `pm` half is WORSE than stated: `samples.ts:52` (`paymentmethodid`) is live, because `paymentMethodId` is a real request-body field on POST /v1/subscriptions (packages/core-contracts/src/validations/subscription.ts:17,58) whose accepted value is a `…pmt` payment-method reference (subscriptions/create.ts:83-102 resolves it via `eq(paymentMethods
> 
> *…trimmed (655 more chars — see the cited files).*
> The severity is carried almost entirely by the second half of the finding (nothing states that `GET /v1/mandates/{id}` takes `reference`, not `mandateRef`), not the first. The wrong id suffixes are a cosmetic consistency bug on their own — all sample ids are obviously-fake `nbo000000000001…` placeholders, and using one fails loudly. The fix that actually matters is a description on the mandate/payment-method path param (and a line in the `POST /v1/mandates` response docs) saying to poll with the `…pmt` `reference`; correcting the suffix map to `pmt` for both `mandates` and `payment-methods` is worth doing in the same change because the sample id is what makes `mandateRef` look like the right
> 
> *…trimmed (43 more chars — see the cited files).*

---

## E45. 🟡 GET /v1/invoices cannot filter by `partially_paid` — the query enum omits a status the service implements and the response schema documents

**What we publish**

The reference page for GET /v1/invoices documents the query param as `status  "draft" | "open" | "paid" | "void" | "uncollectible"` (apps/docs/src/generated/openapi.json: `{"name":"status","in":"query","required":false,"schema":{"type":"string","enum":["draft","open","paid","void","uncollectible"]}}`), while the SAME page's Invoice response schema documents `status` as `enum('draft','open','partially_paid','paid','void','uncollectible')` (apps/api/src/shared/openapi/responses.ts:134). The docs simultaneously tell you an invoice can BE `partially_paid` and that you may not filter for it.

**What the code does**

The omission is in the validator only — the service fully supports the filter. packages/core-contracts/src/validations/invoice.ts:6 — `status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),` (no `partially_paid`). But apps/api/src/shared/services/invoices/status.ts:24 derives it — `if (invoice.amountPaid > 0) return 'partially_paid';` — and apps/api/src/shared/services/invoices/queries.ts:58-65 already implements the SQL predicate for it:
```
    case 'partially_paid':
      return and(isNotNull(invoicesTable.finalizedAt), isNull(invoicesTable.paidAt), isNull(invoicesTable.voidedAt), isNull(invoicesTable.uncollectibleAt), gt(invoicesTable.amountPaid, 0));
```
Because the route runs `validate({ query: listInvoiceQuery })` (apps/api/src/apps/main/modules/invoices/routes.ts:25), `GET /v1/invoices?status=partially_paid` is rejected 422 before the working predicate is ever reached.

**Impact.** Partial collection is a first-class state of this engine (thin-balance Nigerian customers pay part of an invoice). A developer building the "chase the remainder" queue reads the response schema, sees `partially_paid`, filters for it, and gets a 422 VALIDATION_ERROR on a status the API itself returns. There is no workaround except pulling every invoice and filtering client-side.

**Fix.** packages/core-contracts/src/validations/invoice.ts:6 — change to `status: z.enum(['draft', 'open', 'partially_paid', 'paid', 'void', 'uncollectible']).optional(),` so the query enum matches `InvoiceStatus` (packages/core-contracts/src/types/invoice.ts:3-9) and the already-written predicate at queries.ts:58. Regenerate apps/docs/src/generated/openapi.json.

**Files.** `packages/core-contracts/src/validations/invoice.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: GET /v1/invoices cannot filter by `partially_paid` — the listInvoiceQuery zod enum (packages/core-contracts/src/validations/invoice.ts:6) omits it, so the route's validate({ query: listInvoiceQuery }) (apps/api/src/apps/main/modules/invoices/routes.ts:28) rejects `?status=partially_paid` with 422 even though queries.ts:97-104 (NOT 58-65, as the auditor cited) already implements the correct SQL predicate. The filter capability exists and is unreachable.
> 
> What the finding gets WRONG:
> - It is NOT a docs/spec-vs-code contradiction. The OpenAPI query enum is GENERATED from that same zod schema (apps/api/src/shared/openapi/build.ts:63, `queryParameters` + zodToJsonSchema), so app
> 
> *…trimmed (1710 more chars — see the cited files).*
> Adjust two claims: (a) "no workaround except pulling every invoice and filtering client-side" — that IS a viable workaround, so the surface is degraded, not blocked; (b) the docs are not uniformly contradictory — apps/docs/content/sdks/python.mdx:338 (and java/rust) already document the omission as a known quirk; the contradiction is confined to the OpenAPI reference page. Add the sharper point the finding missed: because the 'open' predicate requires amountPaid = 0 (queries.ts:110), partially-paid invoices are invisible to EVERY accepted status value, so no filter at all exposes the outstanding-remainder set. Also scope it: partially_paid only occurs for orgs with partialCollectionEnabled =
> 
> *…trimmed (23 more chars — see the cited files).*

---

## E46. 🟡 GET /v1/mandates/{id} is missing from RESPONSE_DATA_BY_ROUTE → the reference page documents its response as an empty object `{}`

**What we publish**

apps/api/src/shared/openapi/responses.ts:477-478 maps only the create:
```
  // Mandates
  'post /v1/mandates': { ref: 'MandateSetup' },
```
There is no `'get /v1/mandates/{id}'` key. Consequently apps/docs/src/generated/openapi.json emits, for GET /v1/mandates/{id}, `"data": {"type":"object","description":"Resource payload"}`, and the generated "Example response (200)" on /reference/mandates/retrieve renders literally `"data": {}` (verified by running samples.ts's `sampleValue` against the committed spec). It is the ONLY operation in invoices + payment-methods + mandates with an untyped response.

**What the code does**

The endpoint returns a full, fully-typed PaymentMethod. apps/api/src/apps/main/modules/mandates/controllers/get-mandate-status.ts:15-30 is `jsonHandler<Awaited<ReturnType<typeof pollMandateActive>>>` and returns `{ data: method }`, where `pollMandateActive` (apps/api/src/shared/services/payment-methods/capture.ts:72-117) returns `serializePaymentMethod(...)` → `PaymentMethodResponseData` (packages/core-contracts/src/types/payment-method.ts:16-30: domain, id, customerId, kind, status, isDefault, brand, last4, expMonth, expYear, mode, createdAt, updatedAt). The `PaymentMethod` schema is already defined at apps/api/src/shared/openapi/responses.ts:203-217 — it is simply not wired to this route. The fallback is apps/api/src/shared/openapi/build.ts:85-89: `const data = mapped ? … : { type: 'object', description: 'Resource payload' };`

**Impact.** The mandate status poll is the ONE call that tells you whether a direct debit is chargeable. Its reference page documents zero response fields and an empty example, so a developer cannot learn — from the docs — that the field to check is `status` transitioning `consent_pending` → `active`. Typed-client codegen from the published spec produces `data: object` for this operation.

**Fix.** apps/api/src/shared/openapi/responses.ts:478 — add `'get /v1/mandates/{id}': { ref: 'PaymentMethod' },` immediately after the `post /v1/mandates` entry, then regenerate apps/docs/src/generated/openapi.json. Add a build.ts assertion that every collected route has a RESPONSE_DATA_BY_ROUTE entry so this cannot silently recur.

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The core finding is correct and reproducible: `get /v1/mandates/{id}` is absent from RESPONSE_DATA_BY_ROUTE (apps/api/src/shared/openapi/responses.ts:440-509), so build.ts:85-89 falls back to `{ type: 'object', description: 'Resource payload' }`; the committed apps/docs/src/generated/openapi.json confirms this, and samples.ts's `sampleValue` (which returns `{}` for a property-less object) makes the reference page's "Example response (200)" render `"data": {}`. The endpoint really does return a fully-typed PaymentMethod (get-mandate-status.ts:15-30 -> pollMandateActive, capture.ts:72-117, `Promise<PaymentMethodResponseData>`), and the `PaymentMethod` schema already exists unused at responses.
> 
> *…trimmed (1654 more chars — see the cited files).*
> Accurate version: GET /v1/mandates/{id} is missing from RESPONSE_DATA_BY_ROUTE, so the published spec and the /reference/mandates/retrieve page document its response body as an untyped object (empty example), and codegen from the spec produces `data: object` for that one operation. Fix is one line: `'get /v1/mandates/{id}': { ref: 'PaymentMethod' }`. It is NOT true that this is the only way to observe mandate activation (a cron sweep emits `payment_method.updated`, and the SDK docs tell integrators to use that webhook and explicitly "do not poll"), nor that the status enum is undiscoverable (the fully-typed PaymentMethod schema, including consent_pending -> active, is already published on GE
> 
> *…trimmed (171 more chars — see the cited files).*

---

## E47. 🟡 GET /v1/metrics/billing accepts `from`/`to` and echoes them as `windowFrom`/`windowTo`, but `dunningFunnel` is computed all-time and ignores the window entirely

**What we publish**

The response is presented as a single windowed report. apps/api/src/shared/openapi/responses.ts:341-352 puts `dunningFunnel: ref('DunningFunnel')` in the same required object as `windowFrom: dt(), windowTo: dt()`, and the generated reference page for "Retrieve billing metrics" lists `from`/`to` as the operation's only two query parameters — so every field in the body reads as scoped to that window. packages/core-contracts/src/types/metrics.ts:10 calls the whole DTO "Derived billing metrics (M ★) — computed from the ledger/events", and apps/api/src/shared/services/metrics/compute.ts:98 documents `computeBillingMetrics` as "Compose all billing metrics for a tenant **over a window**".

**What the code does**

apps/api/src/shared/services/metrics/compute.ts:74-83 — `dunningFunnel(db, ctx)` takes no window and its WHERE clause is only `and(eq(dunningAttemptsTable.organizationId, ctx.organizationId), eq(dunningAttemptsTable.mode, ctx.mode))`. It is called at compute.ts:115 as `dunningFunnel(db, ctx)` — the `from`/`to` in scope at that line are simply not passed. Every sibling counter IS windowed: compute.ts:109-114 all call `countEvents(db, ctx, <type>, from, to)`, which applies `between(domainEventsTable.createdAt, from, to)` (compute.ts:68).

**Impact.** A developer builds a monthly dashboard: `GET /v1/metrics/billing?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z`. `voluntaryChurn`, `involuntaryChurn`, `failedChargeRate` and `dunningRecoveryRate` correctly cover June; `dunningFunnel.{scheduled,attempting,cardUpdateRequired,rescheduled,succeeded,exhausted}` silently covers all time since the account was created. The funnel counts grow monotonically and never match the windowed rates rendered beside them — e.g. `dunningRecoveryRate` says 40% for June while `dunningFunnel.succeeded` shows every recovery ever. The numbers don't reconcile and the developer has no way to know why, because `windowFrom`/`windowTo` in the same payload assert that

*…trimmed (242 more chars — see the cited files).*

**Fix.** Pick one and make it explicit. Preferred: apps/api/src/shared/services/metrics/compute.ts:74-83 — change the signature to `dunningFunnel(db, ctx, from: Date, to: Date)` and add `between(dunningAttemptsTable.createdAt, from, to)` to the `and(...)` at :78-83; update the call at compute.ts:115 to `dunningFunnel(db, ctx, from, to)`. Otherwise, if lifetime is intended, rename the field to `dunningFunnelAllTime` in packages/core-contracts/src/types/metrics.ts:19 and apps/api/src/shared/openapi/responses.ts:349 and add a `description` on the schema saying it is not windowed.

**Files.** `apps/api/src/shared/services/metrics/compute.ts`, `packages/core-contracts/src/types/metrics.ts`, `apps/api/src/shared/openapi/responses.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct that `dunningFunnel` ignores the `from`/`to` window while every sibling counter honors it, and that this is a genuine defect (the build plan at workbench/apps/api/build_plan_09.md:225 explicitly specified `dunningFunnel(db, ctx, window)` and the item is ticked done, so the missing window is a silent spec deviation, not a deliberate lifetime-snapshot design).
> 
> The auditor's characterization of the mechanism is slightly wrong, and this narrows the blast radius: the funnel fields are NOT event-counts. Per packages/core-db/src/schema/dunning-attempts.ts:36-42, `dunning_attempts` is one append-only row per retry whose `status` transitions IN PLACE. So `dunningFunnel` counts
> 
> *…trimmed (1079 more chars — see the cited files).*
> The un-windowed dunningFunnel call is real and the endpoint is production-reachable, but the finding overstates it. Its core argument — that windowFrom/windowTo make every sibling field read as windowed — does not hold, because mrrInKobo and activeCount (compute.ts:107-108) are already un-windowed point-in-time snapshots in that same required object. The response is by design a mixed snapshot+window payload, and dunningFunnel is best understood as a lifetime status-distribution snapshot over a mutable `status` column, not an event count. Impact is bounded to a reporting/contract-clarity gap: no money movement, no auth issue, and no cross-tenant leak (the funnel IS correctly scoped by organiz
> 
> *…trimmed (526 more chars — see the cited files).*

---

## E48. 🟡 GET /v1/plans/{id}/prices documents a `planRef` query param that the controller silently ignores

**What we publish**

apps/docs/src/generated/openapi.json — GET /v1/plans/{id}/prices lists FOUR query parameters: `planRef` (string), `active`, `limit`, `cursor`. The generated reference renders all four in the "Query parameters" table on /reference/plans/list-prices (api-operation.tsx:102). It comes from apps/api/src/shared/openapi/build.ts:131 (`if (schemas?.query) parameters.push(...queryParameters(schemas.query))`) reflecting `listPriceQuery` (packages/core-contracts/src/validations/price.ts:23-28), which the route reuses wholesale at apps/api/src/apps/main/modules/plans/routes.ts:87 `validate({ query: listPriceQuery })`.

**What the code does**

apps/api/src/apps/main/modules/plans/controllers/list-plan-prices.ts:24-28 — `const page = await listPricesForPlan(db, ctx, req.params.id ?? '', { active: query.active, limit: query.limit, cursor: query.cursor });`. `query.planRef` is never read. And even if it were, apps/api/src/shared/services/prices/queries.ts:98 `return listPrices(db, ctx, { ...opts, planRef });` puts the PATH id last, so it would overwrite any query value. The parameter is inert on this route.

**Impact.** A developer who reads the parameter table and calls `GET /v1/plans/{planA}/prices?planRef={planB}` gets planA's prices back with a 200 and no warning — a documented filter that quietly does nothing. On a catalog surface this reads as data corruption until they diff the ids by hand.

**Fix.** packages/core-contracts/src/validations/price.ts — split the schema: keep `listPriceQuery` (with `planRef`) for the global GET /v1/prices, and add `export const listPlanPriceQuery = listPriceQuery.omit({ planRef: true });`. Use it at apps/api/src/apps/main/modules/plans/routes.ts:87 (`validate({ query: listPlanPriceQuery })`) so the spec — which is walked from the enforced schema — stops advertising the param.

**Files.** `packages/core-contracts/src/validations/price.ts`, `apps/api/src/apps/main/modules/plans/routes.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate in substance, but misattributes the root cause to the controller. The controller and service are correct BY DESIGN: apps/api/src/shared/services/prices/queries.ts:92-98 declares `listPricesForPlan(db, ctx, planRef, opts: Omit<ListPricesOptions, 'planRef'>)` — an explicit type-level exclusion that forbids a caller from overriding the plan — and binds the path ref with `{ ...opts, planRef }`. The controller dropping `query.planRef` is therefore intentional, not an oversight.
> 
> The actual defect is at the ROUTE: apps/api/src/apps/main/modules/plans/routes.ts:87 reuses `listPriceQuery`, a schema authored for the FLAT `GET /v1/prices` (where planRef is a real, honored filte
> 
> *…trimmed (831 more chars — see the cited files).*
> The finding is accurate but should be framed as spec-generation hygiene rather than a handler bug: planRef appears on the nested route only because apps/api/src/shared/openapi/build.ts derives parameters from the shared listPriceQuery zod object, not because anyone intentionally documented it. The response is never incorrect — the path plan wins and is properly org-scoped — so the only harm is a documented parameter that does nothing. Fix: give the nested route its own schema (listPriceQuery.omit({ planRef: true })) so the spec stops emitting it, or reject a conflicting planRef with a 400.

---

## E49. 🟡 GET /v1/subscriptions always returns `latestInvoiceId: null` — the documented (required) field is populated only on the single retrieve

**What we publish**

apps/docs/src/generated/openapi.json, GET /v1/subscriptions → `data: { type: 'array', items: { $ref: '#/components/schemas/Subscription' } }`, and the `Subscription` schema lists `latestInvoiceId` among its `required` properties with no note that it is always null in lists (mirror in apps/api/src/shared/openapi/responses.ts). The Node SDK types list items with the same `Subscription` interface (`latestInvoiceId: string | null`, /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:45).

**What the code does**

apps/api/src/shared/services/subscriptions/queries.ts:197-206 — the list serializer hard-codes it: `data: page.data.map((r) => serializeSubscription(r.sub, { … }, itemsMap.get(r.sub.id) ?? [], null))` (the 4th argument is `latestInvoiceId`). The single retrieve resolves it for real: queries.ts:128-135 `const latest = await latestInvoiceRef(db, ctx, found.sub.id); return serializeSubscription(found.sub, { … }, items, latest);`.

**Impact.** A dashboard that lists subscriptions and links each row to its latest invoice renders a dead link on every row, and nothing in the docs says whether the subscription truly has no invoice or the field is simply not populated in lists — so the developer re-fetches each subscription individually (N+1) or files a bug.

**Fix.** Populate it: in apps/api/src/shared/services/subscriptions/queries.ts, batch-resolve the latest invoice reference for the page (one grouped query over `invoicesTable` keyed by `subscriptionId`, the way `loadItems` batches items) and pass it to `serializeSubscription` at :199-205 instead of `null`. If the null is deliberate, document it in the `Subscription` mirror in apps/api/src/shared/openapi/responses.ts so the reference page says so.

**Files.** `apps/api/src/shared/services/subscriptions/queries.ts`, `apps/api/src/shared/openapi/responses.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct but its framing overstates the contract violation in one respect, and understates the supporting evidence in another.
> 
> NOT a schema violation. `nstr()` emits `{"type":"string","nullable":true}` (openapi.json:549). A field that is both `required` and `nullable` legally admits `null`, so list responses are type-conformant and an OpenAPI conformance test would pass. The defect is therefore SEMANTIC and DOCUMENTARY, not a broken required-field contract: the API reports `latestInvoiceId: null` for subscriptions that demonstrably have invoices, and neither the spec nor apps/docs (zero .mdx mentions of the field) discloses that list and retrieve differ in how th
> 
> *…trimmed (1449 more chars — see the cited files).*
> The finding stands as written, with two refinements: (1) no first-party consumer is affected — nothing in apps/console reads `latestInvoiceId`, so the impact is confined to third-party API/SDK integrators, not our own UI; (2) there is no runtime breakage — the field is declared `string | null` in both the OpenAPI schema and the Node SDK, so clients still type-check and don't crash. The actual defect is silent data infidelity: `null` in a list row is indistinguishable from "this subscription genuinely has no invoice yet", so an integrator cannot detect that the value is simply unpopulated. Fix by batching `latestInvoiceRef` across the page's subscription ids (mirroring `loadItems`) rather tha
> 
> *…trimmed (85 more chars — see the cited files).*

---

## E50. 🟡 GET /v1/webhooks/{id}/deliveries documents an `endpoint` query parameter that the controller silently overwrites and ignores

**What we publish**

apps/docs/src/generated/openapi.json advertises six parameters on `GET /v1/webhooks/{id}/deliveries`, including `{"name": "endpoint", "in": "query", "required": false, "schema": {"type": "string", "minLength": 1}}`. It reaches the spec because apps/api/src/apps/main/modules/webhooks/routes.ts:38 attaches `validate({ query: listWebhookDeliveryQuery })`, and that validator declares it: packages/core-contracts/src/validations/webhook.ts:38 `endpoint: z.string().min(1).optional(),`. apps/api/src/shared/openapi/build.ts:131 then emits one parameter per top-level property of the query schema. The generated reference page for "List deliveries" renders it in the Query-parameters table as a real, usable filter.

**What the code does**

apps/api/src/apps/main/modules/webhooks/controllers/list-deliveries.ts:18-20 discards it: `const page = await listWebhookDeliveries(db, ctx, { limit: q.limit, cursor: q.cursor, status: q.status, eventType: q.eventType, endpoint: req.params.id });` — `endpoint` is hard-wired to the path param `:id`, never `q.endpoint`. The query value is parsed, validated, and thrown away.

**Impact.** A developer sees `endpoint` in the reference's query-parameter table for the deliveries list and reasonably passes `?endpoint=nbo…whk` (e.g. to cross-filter, or because they copied the param list). It is silently ignored — no 400, no warning — and they get the deliveries of the path endpoint instead. A silently-ignored filter is worse than a rejected one: the response looks plausible, so the developer may ship a UI that shows the wrong endpoint's deliveries and only discover it in production.

**Fix.** packages/core-contracts/src/validations/webhook.ts — delete line 38 (`endpoint: z.string().min(1).optional(),`) from `listWebhookDeliveryQuery`. The field is dead: the only route that uses this validator is the nested `/webhooks/:id/deliveries` (routes.ts:38), which always takes the endpoint from the path. If a flat `GET /v1/webhooks/deliveries?endpoint=…` is wanted later, reintroduce it on that route with a controller that actually reads `q.endpoint`. Regenerate apps/docs/src/generated/openapi.json.

**Files.** `packages/core-contracts/src/validations/webhook.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: `listWebhookDeliveryQuery` (packages/core-contracts/src/validations/webhook.ts:38) carries a vestigial `endpoint` field — a leftover from the flat sara `listWebhookDeliveries` filter (packages/sara/src/webhooks/deliveries.ts:54) that no route exposes flat. Because the nested route validates against that schema (apps/api/.../webhooks/routes.ts:38) and the OpenAPI builder emits one query parameter per top-level property with no allowlist (apps/api/src/shared/openapi/build.ts:131), `endpoint` leaks into apps/docs/src/generated/openapi.json and into the rendered "Query parameters" table for List deliveries. The controller (apps/api/.../webhooks/controllers/list-deliveries.ts:19
> 
> *…trimmed (507 more chars — see the cited files).*
> The finding is factually accurate but the severity is overstated. Accurate version: the public OpenAPI spec (and therefore the docs "List deliveries" query-parameter table) advertises an `endpoint` query filter that the controller silently discards in favor of the path param `:id`. This is a contract/DX inaccuracy on a live public read-only endpoint, not a data-correctness or security hazard: the domain call remains scoped by organizationId + mode, so the override can only ever return the path endpoint's deliveries within the caller's own org — it cannot leak or mis-attribute data. Harm requires a developer to deliberately pass a query `endpoint` that contradicts the `:id` already in the pat
> 
> *…trimmed (265 more chars — see the cited files).*

---

## E51. 🟡 POST /v1/plans and POST /v1/plans/{id}/prices return 201, but the reference says 200 — and the docs now contradict themselves in print

**What we publish**

apps/api/src/shared/openapi/build.ts:138 — `responses: { '200': successResponse(routeKey), default: {...} }`, hardcoded for every operation. So openapi.json gives POST /v1/plans and POST /v1/plans/{id}/prices only a `200` (and `default`), and api-operation.tsx:114-125 renders a single `200 Success` chip. Worse, the generated "Example response" body for /reference/plans/create literally contains `"statusCode": 200` (samples.ts:18 `if (n === "statuscode") return 200;`) — the envelope field the API populates from the real status.

**What the code does**

apps/api/src/apps/main/modules/plans/controllers/create-plan.ts:51 and :67 both `return { ..., statusCode: 201 }`, and create-plan-price.ts:38 `return { data: price, statusCode: 201 };`. apps/api/src/shared/http/json.ts:27 does `res.status(statusCode).json(body)` with `statusCode` also written into the body at json.ts:23. So the wire truth is HTTP 201 and `"statusCode": 201`. The hand-written docs know this — apps/docs/content/getting-started/quickstart/curl.mdx:20 says "A `201` comes back with the plan's `data.id`" — so the docs assert 201 on one page and 200 on the generated reference page for the same call.

**Impact.** NEW SPECIFICS beyond the known build.ts:138 bug: the two catalog creates are the FIRST calls in every quickstart, and the docs disagree with themselves in print. A developer writing `if (res.status === 200)` from the reference — or generating a client from openapi.json, where 201 is an undeclared response — treats a successful plan/price create as an error and retries or aborts. Their own eyes tell them the docs are unreliable on the very first request.

**Fix.** apps/api/src/shared/openapi/build.ts — thread the controller's success status into the spec. Add the status to `RESPONSE_DATA_BY_ROUTE` in apps/api/src/shared/openapi/responses.ts (e.g. `'post /v1/plans': { ref: 'PlanWithPrices', status: 201 }`, `'post /v1/plans/{id}/prices': { ref: 'Price', status: 201 }`; archive/deactivate/update stay 200) and key `responses` off it at build.ts:138 instead of the literal `'200'`. Also fix apps/docs/src/lib/api-ref/samples.ts:18 to sample `statusCode` from the response's declared status rather than the constant 200.

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate as far as it goes, with two scope refinements. (1) NOT plans-specific: build.ts:138 hardcodes '200' inside the per-route loop, so EVERY 201-returning create route across the API (customers, subscriptions, etc.) is mis-declared — plans/prices are just the most visible instance because they lead the quickstart. (2) It is a spec/docs-accuracy bug only, with NO runtime defect: the server correctly returns HTTP 201 with `"statusCode": 201` (create-plan.ts:51/:67, create-plan-price.ts:38 -> json.ts:23/:27), and hand-written SDK users doing normal 2xx checks are unaffected. The auditor also UNDERSTATED the codegen impact: 201 is not merely undeclared — OpenAPI's `default` ca
> 
> *…trimmed (381 more chars — see the cited files).*
> The finding is accurate but scoped too narrowly and its worst-case tail is overstated. Accurate version: build.ts:138 hardcodes responses: { '200': ... } for EVERY operation, so all 31 POST operations in the published spec declare only 200 + default, while 21 controllers actually return 201 (not just the 2 catalog creates — also POST /v1/subscriptions, /v1/customers, setup-card, issue-virtual-account, create-mandate, create-payout, refund-settlement, create-coupon, webhooks/create-endpoint, etc.). The spec is served in production at /v1/openapi.json, whose own code comment states it is "public (codegen tools fetch it)", and the committed snapshot also drives the docs reference, the docs MCP 
> 
> *…trimmed (474 more chars — see the cited files).*

---

## E52. 🟡 Rate limiting is enforced on every route in the group and appears nowhere in the docs content

**What we publish**

`grep -rni "ratelimit|rate.limit|429|Retry-After" apps/docs/content/` (excluding content/sdks/) returns **zero** matches. No page states that a limit exists, what it is, what window it uses, or which headers carry it. The generated reference pages show only path params, query params and body fields (apps/docs/src/components/reference/api-operation.tsx:101-103) — headers are never rendered, so no operation page shows rate-limit information either.

**What the code does**

Every customers and coupons route runs the limiter — apps/api/src/apps/main/modules/customers/routes.ts:47-129 and coupons/routes.ts:26-58 both place `rateLimit` immediately after `apiKeyAuth` on all 13 routes. apps/api/src/shared/middlewares/rate-limit.ts:12-29 documents the contract the docs never state: "a fixed-window counter in Redis, keyed per authenticated API key" with `WINDOW_SECONDS = 60` (line 32), a per-ORG cap shared across a tenant's keys, rejection with "429 RATE_LIMIT_EXCEEDED and a `Retry-After` header", and "Headers emitted on every limited request: `X-RateLimit-Limit`, `X-RateLimit-Remaining`".

**Impact.** A developer bulk-importing customers (POST /v1/customers in a loop — the most common first integration job) hits 429 with no documented budget, no documented window, and no documented backoff signal. `RATE_LIMIT_EXCEEDED` does appear on the /errors page (it is in PUBLIC_ERROR_CODES), so the failure is not undiscoverable — which is why this is medium and not high — but nothing tells them the window is 60s, that `Retry-After` is authoritative, or that all their keys share one org-wide budget (so minting a second key will not help). I could not establish the default `perMinute` value: it is resolved per-tenant at runtime via `resolveRateLimit` (rate-limit.ts:55) and I did not trace it to a plat

*…trimmed (13 more chars — see the cited files).*

**Fix.** Add a `content/getting-started/rate-limits.mdx` page (registered in apps/docs/content/manifest.ts under the get-started section) documenting: the 60-second fixed window, the per-organization cap shared across all of an org's keys, the `X-RateLimit-Limit` / `X-RateLimit-Remaining` response headers, and `Retry-After` on 429 — sourced from apps/api/src/shared/middlewares/rate-limit.ts:12-32. Link it from getting-started/authentication.mdx and from /errors#RATE_LIMIT_EXCEEDED.

**Files.** `apps/docs/content/getting-started/rate-limits.mdx`, `apps/docs/content/manifest.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: rate limiting IS enforced on all 13 customers/coupons routes (fixed 60s window, per-API-key counter, per-ORG cap; platform default/floor = 120 req/min per apps/api/src/shared/services/tenant-config/limits.ts:6, operator overrides may only raise it; monthly org quota optional; fails OPEN on Redis outage; disabled only by env.DISABLE_API_RATE_LIMIT locally). What the docs actually omit is narrower than claimed: (a) no prose page states the 120/min default, the 60s window, or that the cap is shared org-wide across every key (so minting a second key does not help); (b) the generated OpenAPI (apps/docs/src/generated/openapi.json) declares no 429 response and no X-RateLimit-*/Ret
> 
> *…trimmed (590 more chars — see the cited files).*
> Two corrections, both making the finding stronger, not weaker. (1) The unresolved default IS resolvable: `PLATFORM_RATE_LIMIT = 120` req/min in apps/api/src/shared/services/tenant-config/limits.ts:6, acting as a floor that operator overrides may only raise — so undocumented budget is ~2 req/s per org per mode. (2) The blast radius is not just customers + coupons (13 routes): `rateLimit` is mounted in 17 route modules covering every /v1 resource group (subscriptions, invoices, plans, prices, mandates, payment-methods, events, webhooks, settlements, dunning, metrics, settings, billing-settings, plus customers/coupons). Additionally the same middleware can return an undocumented `QUOTA_EXCEEDED
> 
> *…trimmed (335 more chars — see the cited files).*

---

## E53. 🟡 Response examples show impossible objects: a coupon with BOTH amountOffInKobo and percentOff, and a just-created credit grant with voidedAt set

**What we publish**

Generated by apps/docs/src/lib/api-ref/samples.ts `responseExample()` (line 117) and rendered under "Example response (200)" by apps/docs/src/components/reference/api-operation.tsx:127-134. On /reference/coupons/* the data object is:
`{"domain":"coupon","id":"nbo000000000001","code":"string","duration":"once","amountOffInKobo":0,"percentOff":20,…}` — both discount fields populated. On /reference/customers/grant-credit: `{"domain":"credit_grant",…,"source":"downgrade_proration","voidedAt":"2026-07-01T09:30:00Z",…}`.

**What the code does**

A coupon can never carry both. packages/core-contracts/src/validations/coupon.ts:14-17 enforces `(d.amountOffInKobo != null) !== (d.percentOff != null)`, and apps/api/src/shared/services/coupons/create.ts:24-30 re-asserts it server-side, so `serializeCoupon` (coupons/serialize.ts:11-12) always emits exactly one of them non-null and the other `null`. A freshly created grant can never have `voidedAt` set — apps/api/src/shared/services/credits/grant.ts:67-81 inserts with no `voidedAt` (it is only stamped in void.ts:79). And `source` can never be `downgrade_proration` on this endpoint: the request enum is `['manual','goodwill']` (packages/core-contracts/src/validations/credit.ts:5) and the controller passes it straight through (grant-customer-credit.ts:27). The sampler picks `enum[0]` blindly (samples.ts:71) and has no notion of nullable-XOR or of which enum members a given endpoint can actually produce.

**Impact.** A developer writing a coupon display component from the reference response reads `amountOffInKobo: 0, percentOff: 20` and codes for both being present, missing that exactly one is always `null` — a null-deref waiting to happen the first time they format a fixed-amount coupon. The credit example implies grants arrive pre-voided. These are the reference's only worked response payloads, so there is no correct example to compare against.

**Fix.** apps/docs/src/lib/api-ref/samples.ts: honour `nullable: true` — in `sampleValue` (line 67), when a schema is nullable and the field is part of a known XOR pair, emit `null`. Practically: add a schema-level override map (mirroring OVERRIDES in api-ref/model.ts:192) so `Coupon` samples `{amountOffInKobo: null, percentOff: 20}` and `CreditGrant` samples `{source: "manual", remainingInKobo: 250000, voidedAt: null}`. Also fix the id sample at samples.ts:46 (`id: "nbo000000000001"`) to carry the resource suffix, so a customer response shows `nbo…cus` and a coupon `nbo…cpn` as packages/core-contracts/src/types/customer.ts:10 documents.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but understates the blast radius. The same sampler also feeds requestExample() (samples.ts:102), which iterates ALL body properties, so the "Example request body" for POST /v1/coupons renders {"code":"string","duration":"once","amountOffInKobo":0,"percentOff":20,...} — a body the API rejects twice over (the XOR refinement, plus amountOffInKobo:0 failing .int().positive()). That is a broken copy-paste path, not merely a misleading read, which is why severity should be medium rather than low. SDK snippets are NOT affected: snippets.ts:377 only emits required scalar fields, so the coupon snippet shows just code/duration. The real defect is structural in sampleValue(): it 
> 
> *…trimmed (153 more chars — see the cited files).*
> Two refinements. (1) The finding understates the lack of a counter-signal: `api-operation.tsx` renders field tables only for path/query/request-body — responses get no field table at all, and `typeLabel()` (apps/docs/src/lib/api-ref/model.ts:68-75) discards `nullable`, so nothing on the page contradicts the impossible example. (2) `amountOffInKobo: 0` is itself a second sampler miss: the money heuristic at samples.ts:16 (`/inkobo$/` case-sensitive, `/amountinkobo/i`) does not match "amountOffInKobo", so the field falls through to the generic integer `0` — the coupon example advertises a ₦0.00 fixed discount alongside 20% off. Severity stays low: docs-only, no runtime/money/auth impact, and t
> 
> *…trimmed (49 more chars — see the cited files).*

---

## E54. 🟡 The GET /v1/invoices example response shows every invoice line item with all-null fields

**What we publish**

The "Example response (200)" rendered on /reference/invoices/list (apps/docs/src/components/reference/api-operation.tsx:127-133 via `responseExample()`) is, verbatim (I ran samples.ts's generator against the committed spec):
```json
"lineItems": [ { "id": null, "kind": null, "description": null, "amountInKobo": null, "quantity": null } ]
```
The single-invoice page (/reference/invoices/retrieve) renders the same field correctly (`"amountInKobo": 250000, "quantity": 1, …`) — the list page is one nesting level deeper.

**What the code does**

apps/docs/src/lib/api-ref/samples.ts:68-69 — `export function sampleValue(schema, name = "", depth = 0) { const s = resolveSchema(schema); if (!s || depth > 4) return null;`. For a list operation the walk is envelope(0) → `data` array(1) → Invoice(2) → `lineItems` array(3) → InvoiceLineItem(4) → its properties(5), which trips `depth > 4` and returns `null` for every field. The real DTO (packages/core-contracts/src/types/invoice.ts:17-23) has non-nullable `id`, `kind`, `description`, `amountInKobo`, `quantity`; the response schema (apps/api/src/shared/openapi/responses.ts:122-128) wraps them all in `allRequired(...)`, so `null` is not even a legal value.

**Impact.** On the most-read invoice page (the list), the money field `amountInKobo` is documented as `null`. A developer writing a defensive client adds null-guards for line-item amounts that can never be null, or — worse — concludes list responses return skeleton line items and issues an extra GET per invoice to hydrate them.

**Fix.** apps/docs/src/lib/api-ref/samples.ts:69 — raise the guard to `depth > 6` (the deepest real nesting in the spec is envelope→array→resource→array→item→scalar = 5). No schema in apps/docs/src/generated/openapi.json is cyclic (`$refStrategy: 'none'` inlines them at apps/api/src/shared/openapi/build.ts:26), so the depth cap is purely a safety rail and can be raised without risk.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The core defect is real and reproduces exactly as quoted — but the finding needs two amendments.
> 
> (1) SCOPE IS WIDER: it is not only the invoices list. Sweeping every 200-response schema in the committed spec for depth-5 null leaks yields TWO operations:
>   - GET /v1/invoices → `lineItems: [{id: null, kind: null, description: null, amountInKobo: null, quantity: null}]`
>   - GET /v1/subscriptions → `items: [{id: null, priceId: null, quantity: null}]` (SubscriptionItem, responses.ts:97)
> Any list endpoint whose resource embeds an array of objects hits it; those are the only two today.
> 
> (2) IMPACT IS OVERSTATED: the claim that a developer "issues an extra GET per invoice to hydrate skeleton line i
> 
> *…trimmed (854 more chars — see the cited files).*
> The finding is factually correct and reproducible, but its severity and impact are overstated. Accurate version: a depth cap (`depth > 4`) in apps/docs/src/lib/api-ref/samples.ts:69 causes the generated "Example response" on TWO public reference pages — /reference/invoices/list AND /reference/subscriptions/list (the finding names only invoices) — to render nested array-of-object fields with all-null properties. It is display-only: requestExample() starts at depth=1 and is unaffected, so no SDK snippet, client, or runtime path consumes the null. The claimed integrator harm (adding null-guards, or issuing an extra GET per invoice to "hydrate" skeleton line items) is speculative and undercut by
> 
> *…trimmed (426 more chars — see the cited files).*

---

## E55. 🟡 The Java code sample for "Void an invoice" calls a method named `void` — a Java reserved word; the real SDK method is `voidInvoice`

**What we publish**

apps/docs/src/lib/api-ref/sdk-map.ts:78 — `"POST /v1/invoices/{id}/void": { method: "void" },`. The Java renderer at apps/docs/src/lib/api-ref/snippets.ts:314-316 builds `const chain = \`nombaone.${call.namespace.map((n) => \`${n}()\`).join(".")}.${call.method}\`;` → the published Java tab on /reference/invoices/void reads `var invoice = nombaone.invoices().void("nbo000000000001inv", InvoiceVoidParams.builder().comment("string").build());`

**What the code does**

`void` is a reserved keyword in Java — that snippet is a syntax error, not merely a wrong name. The real SDK method is `voidInvoice`, and the SDK's own javadoc says exactly why: /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/invoices/Invoices.java:61 — `* <p>Named {@code voidInvoice} because {@code void} is a reserved word in Java.` and :66 — `public Invoice voidInvoice(String id) {`. (Every other binding is fine: Go ships `Void` (nombaone-go/invoices.go:115), .NET ships `VoidAsync` (nombaone-dotnet/src/NombaOne/Resources/Invoices.cs:187), and node/python/ruby/php/elixir all ship a literal `void`, so this is Java-specific.)

**Impact.** A Java integrator copies the only Java sample for voiding an invoice and it does not compile — javac rejects `.void(` at the parse stage with `<identifier> expected`, which gives no hint that the method is called `voidInvoice`. The SDK author anticipated the collision and documented the workaround; the docs generator throws it away.

**Fix.** apps/docs/src/lib/api-ref/sdk-map.ts — add a per-language method-name override table for reserved-word collisions and register `void` → `voidInvoice` for Java. Minimal version: in apps/docs/src/lib/api-ref/snippets.ts:314 `java(ctx)`, add `const JAVA_RESERVED: Record<string, string> = { void: "voidInvoice" };` and use `const method = JAVA_RESERVED[call.method] ?? call.method;` when building `chain`. Add a check:sdks gate assertion that every emitted method name is a legal identifier in its target language.

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`, `apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and, if anything, understated. Two corrections/extensions:
> 
> 1. BLAST RADIUS IS BIGGER THAN THE FINDING SAYS. `sdkCall()` is consumed by TWO surfaces, not one. Besides the Java snippet tab on /reference/invoices/void (apps/docs/src/lib/api-ref/snippets.ts:314-333), the generated Java SDK method index at /sdks/java also renders it: apps/docs/src/components/mdx/sdk-method-index.tsx:79 calls `sdkCall(op)` and `LANG_CASE.java = "camel"` (line 44) leaves the name untouched, so that page publishes `invoices.void` as a real Java SDK method. So the docs advertise a nonexistent (uncompilable) Java method in two places.
> 
> 2. THE SNIPPET IS OTHERWISE CORRECT. The param type `Invoic
> 
> *…trimmed (724 more chars — see the cited files).*
> The finding is factually and mechanically correct — the Java tab on the production-prerendered /reference/invoices/void page does emit `.void(`, which is a syntax error — but "medium" over-rates it. It is a low: a docs-only, compile-time, fail-loud defect confined to one language and one operation, with no runtime, money, auth, or data-correctness consequence, and a trivially self-correcting workaround (IDE autocomplete reveals voidInvoice). Fix by adding a per-language method override to the sdk-map entry so `java` maps to `voidInvoice` while the other eight bindings keep their existing names.

---

## E56. 🟡 The interactive <WebhookVerifier /> claims in its own header comment to mirror sara's signer "byte-for-byte (the SSOT)" while implementing the Stripe scheme — it will green-light a signature the server never sends

**What we publish**

apps/docs/src/components/mdx/webhook-verifier.tsx:11-18 — "Paste a raw body, the unix timestamp, and the endpoint's signing secret; it computes `HMAC_SHA256(`${timestamp}.${body}`, secret)` (hex) … This mirrors `signWebhookPayload` / `verifyWebhookSignature` from `@nombaone/sara/webhooks` **byte-for-byte (the SSOT)**". The implementation matches its own comment: :43 `encoder.encode(secret)` is imported directly as the HMAC key, and :48 `crypto.subtle.sign("HMAC", key, encoder.encode(\`${timestamp}.${body}\`))`.

**What the code does**

packages/sara/src/webhooks/sign.ts:18-19 — `export const signWebhookPayload = (secret: string, rawBody: string): string => createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');`. The message is the raw body ONLY — there is no `${timestamp}.` prefix. And the key is not the plaintext secret: packages/sara/src/webhooks/deliver.ts:113 calls `signWebhookPayload(endpoint.signingSecretHash, rawBody)`, i.e. the key is `sha256(plaintextSecret)` (packages/sara/src/webhooks/endpoints.ts:40, :57). So the widget differs from the SSOT on BOTH inputs — the message and the key.

**Impact.** This extends the already-established docs/SDK Stripe-scheme divergence with a new affected file and a new failure mode: an *interactive* tool, embedded on two pages (webhooks/signing-and-verification.mdx:85 and getting-started/verify-in-your-devtools.mdx:84), that a developer uses specifically to confirm their understanding before writing code. It prints a confident hex digest under a header that asserts it is the SSOT — and that digest will never equal the `x-nombaone-signature` on a real delivery. The false "byte-for-byte (the SSOT)" claim in the source comment is the reason this survived: a reviewer reading the component would believe it had been checked against sara.

**Fix.** apps/docs/src/components/mdx/webhook-verifier.tsx — align with sara or delete the widget until the scheme question is settled repo-wide. To align: (a) lines 39-48, change `computeSignature` to key on the sha256 of the plaintext secret and to HMAC the raw body alone — `const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(secret)); const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));` (b) drop the timestamp field (line 101, and the `t=`/`v1=` parsing at :82) since the real header `x-nombaone-signature` is a bare hex digest. (c) Rewrite the header comment at :11-18 so it describes what the code does. Do this in the same change as the SDK/docs signature fix so all surfaces move together.

**Files.** `apps/docs/src/components/mdx/webhook-verifier.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate and, if anything, understated on one detail: there are THREE divergences, not two. (1) message — server signs the raw body only, widget signs `${timestamp}.${body}`; (2) key — server keys the HMAC with `endpoint.signingSecretHash` = sha256(plaintext secret) (deliver.ts:113, endpoints.ts:40/57), widget keys with the plaintext secret; (3) header format — server sends a bare lowercase-hex `x-nombaone-signature` (deliver.ts:206), widget both emits and parses a Stripe-style `t=<unix>,v1=<hex>`. Consequence: pasting a real delivery's bare-hex header into the widget makes `parseV1` return null, so the widget shows NO verdict rather than a mismatch — it fails silently. Also w
> 
> *…trimmed (227 more chars — see the cited files).*
> Two refinements. (1) The finding says the widget's digest "will never equal the x-nombaone-signature on a real delivery" — true but understated: the widget's entire header FORMAT is fabricated. The product sends a bare hex digest with no t=/v1= fields at all (deliver.ts:206), so parseV1() cannot even parse a real header and the widget can never render a verdict against a genuine delivery unless the user hand-wraps it. That means the `t=<unix>,v1=<hex>` header-shape claim on the two MDX pages is likely wrong too and must be fixed in the same change. (2) The widget cannot be corrected merely by fixing the message: the HMAC key is sha256(plaintextSecret), a value the merchant does not hold in t
> 
> *…trimmed (79 more chars — see the cited files).*

---

## E57. 🟡 The interval-switch curl in the proration guide omits `Idempotency-Key` on a strict-idempotency route → copy-paste returns 400

**What we publish**

apps/docs/content/guides/proration-and-plan-changes.mdx:49-54 — "curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/change \\\n  -H \"Authorization: Bearer nbo_sandbox_…\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{ \"priceId\": \"{yearlyPriceId}\", \"intervalSwitch\": true }'" — no Idempotency-Key header, unlike the price-change curl 25 lines above (:20-26).

**What the code does**

POST /v1/subscriptions/{id}/change is mounted with the STRICT idempotency middleware: apps/api/src/apps/main/modules/subscriptions/routes.ts:140-148 — `subscriptionsRouter.post('/subscriptions/:id/change', apiKeyAuth, rateLimit, requireScope('subscriptions:write'), idempotency, validate({ body: changeSubscriptionBody }), changeSubscriptionController);`, and apps/api/src/shared/middlewares/idempotency.ts:62-74 — "if (!idempotencyKey || idempotencyKey.trim().length === 0) { if (required) { next(AppError.BadRequest('Idempotency-Key header is required for this request', undefined, NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_MISSING)); return; } }" → HTTP 400.

**Impact.** A developer copy-pastes the documented monthly→yearly upgrade and gets `400 IDEMPOTENCY_KEY_MISSING` on the exact call the guide exists to teach.

**Fix.** apps/docs/content/guides/proration-and-plan-changes.mdx:52 — add `  -H "Idempotency-Key: $(uuidgen)" \` to the interval-switch curl, matching the first change example at :24.

**Files.** `apps/docs/content/guides/proration-and-plan-changes.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct as stated. Two refinements: (a) the break is confined to the raw-curl path — all nine shipped SDKs auto-generate a UUID Idempotency-Key (documented in apps/docs/content/sdks/*.mdx), so SDK users are unaffected; the guide's curl is nevertheless the thing being taught. (b) The fix is to add `-H "Idempotency-Key: $(uuidgen)" \` to the curl at proration-and-plan-changes.mdx:52-53, matching line 24 of the same file. A docs-lint gate asserting that every POST /v1/* curl targeting a required-idempotency route carries the header would prevent recurrence, since this omission class already slipped past the existing docs CI gates.
> The technical claim is accurate as stated; only the severity is off. Correct framing: this is a low-severity docs defect — a documented curl on a public guide fails with a 400 on copy-paste, but the error is self-explanatory, a correct example of the same header appears 25 lines above on the same page, and no money, auth, or data correctness is affected. Fix is one line (add `-H "Idempotency-Key: $(uuidgen)"` to the interval-switch curl); worth doing immediately given the repo's zero-gotchas docs ethos, but it does not rise to medium.

---

## E58. 🟡 The spec marks Idempotency-Key `required: true` on PATCH/DELETE /v1/webhooks/{id} and PUT /v1/organization, where the middleware is not merely optional but structurally inert (it only runs for POST)

**What we publish**

apps/api/src/shared/openapi/build.ts:128-130 — `if (MUTATING.has(method)) { parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }); }` with `MUTATING = new Set(['post', 'put', 'patch', 'delete'])` (build.ts:22). Verified in apps/docs/src/generated/openapi.json: `PATCH /v1/webhooks/{id}`, `DELETE /v1/webhooks/{id}`, and `PUT /v1/organization` each carry `{"name": "Idempotency-Key", "in": "header", "required": true}`.

**What the code does**

This ADDS to the established build.ts:129-131 finding, which noted only that 33 of the 44 mutating ops use `idempotencyOptional` rather than strict `idempotency`. The stronger fact: the middleware short-circuits on method before it ever looks at the header — apps/api/src/shared/middlewares/idempotency.ts:51-55, `// Only mutating POSTs participate. Anything else flows straight through.` / `if (req.method !== 'POST') { next(); return; }`. So for PATCH /v1/webhooks/{id} (webhooks/routes.ts:30), DELETE /v1/webhooks/{id} (webhooks/routes.ts:31) and PUT /v1/organization (settings/routes.ts:13), the `idempotencyOptional` in the chain is a no-op regardless of what the caller sends. The header is not "optional" — it is read by nothing and does nothing. Within this audit group the strict `idempotency` middleware is used on exactly two routes, both POST: settlements/routes.ts:25 (payout) and :29 (refund).

**Impact.** Two distinct harms beyond the established one. (1) Codegen: an SDK generated from this spec will emit a mandatory `idempotencyKey` argument on `webhooks.update()`, `webhooks.delete()` and `organization.update()`, forcing callers to invent and thread a key that the server never reads — permanently, since it is baked into nine SDK signatures. (2) A developer building a retry wrapper will assume PATCH/PUT/DELETE are deduplicated because the spec says the key is required; they are not, so a retried PATCH re-applies unconditionally. The correct mental model — "idempotency exists on POST only, and is *enforced* only on the money-movement POSTs" — is not derivable from the spec.

**Fix.** apps/api/src/shared/openapi/build.ts — make the header reflect the actual middleware instead of the HTTP method. Narrow the guard at :128 to `if (method === 'post')` (PUT/PATCH/DELETE never participate), and set `required` from the route's real middleware rather than hardcoding `true`: tag the strict `idempotency` middleware with a symbol the way `validate` is tagged with `OPENAPI_SCHEMAS` (build.ts:48-51 already walks `layer.route.stack` for exactly this), detect it in `collectRoutes`, and emit `required: <strict>`. Add `description: 'Required. Deduplicates this money-moving request.'` when strict, `'Optional. Supply a key to make this request safely retryable.'` when not. Regenerate apps/docs/src/generated/openapi.json.

**Files.** `apps/api/src/shared/openapi/build.ts`, `apps/docs/src/generated/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: buildOpenApiDocument stamps `Idempotency-Key: required: true` on all 44 mutating operations (build.ts:22 + 128-130), but the middleware only participates on POST (idempotency.ts:52). So for the 13 non-POST mutating ops in the spec — including PATCH/DELETE /v1/webhooks/{id} and PUT /v1/organization — the header is not merely "optional", it is read by no enforcement path at all (only request-log.ts:62 records it). This is a documentation/spec-accuracy defect, not a runtime or money-safety defect.
> 
> What the finding gets WRONG:
> - The SDK-codegen impact is fabricated. No SDK source and no OpenAPI codegen tooling exists in the repo, and the repo's own SDK design doc (workbench/pa
> 
> *…trimmed (943 more chars — see the cited files).*
> Accurate as stated on the facts, but two impact claims are overstated. (a) The SDK-codegen harm is hypothetical: no spec-driven codegen exists in the repo and the nine shipped SDKs are hand-written and already document POST-only auto-idempotency, so no mandatory `idempotencyKey` argument exists or is scheduled to exist. (b) The retry-wrapper harm is near-nil in practice because the three affected operations (PATCH /v1/webhooks/{id}, DELETE /v1/webhooks/{id}, PUT /v1/organization) are naturally idempotent and move no money; the money POSTs correctly use the strict `idempotency` middleware. The residual, real harm is that the published spec (and therefore the live docs API reference, MCP serve
> 
> *…trimmed (199 more chars — see the cited files).*

---

## E59. 🟡 `PLAN_ALREADY_ARCHIVED` tells you to "unarchive it first" — there is no unarchive endpoint, and an archived plan can in fact still be PATCHed

**What we publish**

packages/errors/src/codes.ts:585-588 — `PLAN_ALREADY_ARCHIVED: { hint: 'This plan is already archived, so it cannot be archived or modified again. Unarchive it first if you need to change it.' }`. It is public (codes.ts:283) so /errors renders it verbatim (confirmed in apps/docs/public/llms-full.txt:7312), and the live API ships this exact `hint` in the error body on every 409 (apps/api/src/shared/http/error-handler.ts:59 `hint: meta.hint`).

**What the code does**

(a) There is no unarchive operation anywhere: apps/api/src/apps/main/modules/plans/routes.ts declares only POST /plans, GET /plans/:id, GET /plans, PATCH /plans/:id, POST /plans/:id/archive, POST /plans/:id/prices, GET /plans/:id/prices. A case-insensitive grep for "unarchive" across apps/ and packages/ matches only the hint string itself echoed into the docs' generated llms-full.txt and ask-index.json. (b) "cannot be … modified again" is false: apps/api/src/shared/services/plans/update.ts checks only existence (update.ts:35-37 `if (!existing) throw AppError.NotFound`) and never inspects `status` — `PATCH /v1/plans/{id}` on an archived plan updates name/description/metadata and returns 200.

**Impact.** A developer hits the 409, reads the hint returned by the API itself, and goes looking for `POST /v1/plans/{id}/unarchive` — which does not exist and is not in the OpenAPI spec, the reference, or any guide. They burn time, then conclude the plan is permanently frozen and rebuild it under a new name (paying the `PLAN_NAME_TAKEN` tax), when a plain PATCH would have worked all along.

**Fix.** packages/errors/src/codes.ts:586 — replace the hint with what is actually true: "This plan is already archived. Archiving is one-way: there is no unarchive. You can still PATCH its name, description and metadata; to sell it again, create a new plan and its prices." (Or, if unarchive is intended to exist, build it — but the hint must not promise it before then.)

**Files.** `packages/errors/src/codes.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct but slightly overstated in wording and severity.
> 
> ACCURATE VERSION: The `PLAN_ALREADY_ARCHIVED` hint (packages/errors/src/codes.ts:585-588), which is public (codes.ts:283) and returned in the live 409 body (apps/api/src/shared/http/error-handler.ts:59), ends with "Unarchive it first if you need to change it." No unarchive operation exists anywhere in the codebase — apps/api/src/apps/main/modules/plans/routes.ts has no such route, and a repo-wide grep for "unarchive" matches only the hint string and the two generated docs artifacts that echo it. That imperative is dead-end advice.
> 
> The clause "cannot be ... modified again" is only PARTLY false, not false. The 
> 
> *…trimmed (1184 more chars — see the cited files).*
> Two corrections. (1) Reachability is broader than claimed: PLAN_ALREADY_ARCHIVED is also thrown from apps/api/src/shared/services/prices/create.ts:65 on POST /v1/plans/{id}/prices against an archived plan — a more likely trigger than double-archive, and the case where the misleading hint does real damage (the merchant genuinely cannot add the price, and the only remedy the API names does not exist). (2) The claimed PLAN_NAME_TAKEN tax is wrong: a developer who gives up and rebuilds the plan under a NEW name will not hit a name collision by definition. Drop that from the impact story; the real harm is a false remedy pointing out of a genuine dead-end.

---

## E60. 🟡 `PRICE_PLAN_MISMATCH` is published on /errors as a live catalog error but is thrown nowhere in the codebase

**What we publish**

packages/errors/src/codes.ts:286 puts `PRICE_PLAN_MISMATCH` in `PUBLIC_ERROR_CODES`, and codes.ts:597-600 gives it a hint ("That price does not belong to the plan you referenced. Use a price that belongs to this plan…"). apps/docs/src/components/mdx/error-reference.tsx:62 renders every member of that set, grouped under "Plans & prices" (error-reference.tsx:32-33), beneath the claim at error-reference.tsx:78-79 that the list is "complete and never drifts". It is also injected into the `ApiError.error.code` enum in openapi.json (build.ts:189 `code: { type: 'string', enum: PUBLIC_ERROR_CODES_LIST }`), so every generated SDK's error union carries it.

**What the code does**

A repo-wide grep for `PRICE_PLAN_MISMATCH` across apps/api, apps/console, apps/checkout and packages returns ONLY its three declarations in packages/errors/src/codes.ts (:138 the constant, :286 the public set, :597 the registry entry). No service, controller, or middleware ever constructs an AppError with it. It cannot be emitted.

**Impact.** A developer writing an exhaustive error handler (which the docs actively encourage, and which the typed SDK error union forces in Rust/Java/Go) adds a branch for a code that will never arrive — dead code they must reason about and test. More corrosively, it falsifies the /errors page's headline promise that the list is exactly what the API answers with, which is the one reason to trust that page over guessing.

**Fix.** Remove `NOMBAONE_ERROR_CODES.PRICE_PLAN_MISMATCH` from `PUBLIC_ERROR_CODES` at packages/errors/src/codes.ts:286 (leave the constant and registry entry for a future release, as is already done for `PRICE_IMMUTABLE` and `CATALOG_INVALID_INTERVAL`, both of which are correctly kept OUT of the public set). Alternatively, wire the guard: apps/api/src/shared/services/subscriptions/create.ts is the only place a (planId, priceId) pair could disagree.

**Files.** `packages/errors/src/codes.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: PRICE_PLAN_MISMATCH is indeed published in PUBLIC_ERROR_CODES (codes.ts:286), given a hint (:597-600), rendered on /errors, and injected into the ApiError code enum in the generated OpenAPI — and it is thrown nowhere. All of that checks out. But: (a) it is NOT an isolated case — about fifteen public codes are unthrown (MANDATE_NOT_ACTIVE, MANDATE_MAX_AMOUNT_EXCEEDED, MANDATE_CONSENT_PENDING, PAYMENT_METHOD_NOT_ACTIVE, INVOICE_ALREADY_PAID, CREDIT_INSUFFICIENT_BALANCE, CREDIT_GRANT_ALREADY_VOIDED, four DUNNING_*, two SUBSCRIPTION_SCHEDULE_*, PRORATION_INTERVAL_SWITCH_UNSUPPORTED), so the correct finding is systemic: "the public error catalog is declared ahead of implementati
> 
> *…trimmed (859 more chars — see the cited files).*
> Accurate version: PRICE_PLAN_MISMATCH is one of FIFTEEN public error codes (~21% of the 72-code PUBLIC_ERROR_CODES set) that are published on /errors, baked into the openapi.json ApiError.error.code enum, and shipped in every generated SDK's error union, yet are thrown nowhere: PRICE_PLAN_MISMATCH, PAYMENT_METHOD_NOT_ACTIVE, MANDATE_NOT_ACTIVE, MANDATE_MAX_AMOUNT_EXCEEDED, MANDATE_CONSENT_PENDING, INVOICE_ALREADY_PAID, SUBSCRIPTION_SCHEDULE_CONFLICT, SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT, PRORATION_INTERVAL_SWITCH_UNSUPPORTED, CREDIT_GRANT_ALREADY_VOIDED, CREDIT_INSUFFICIENT_BALANCE, DUNNING_NO_OPEN_INVOICE, DUNNING_ATTEMPT_NOT_FOUND, DUNNING_CARD_UPDATE_REQUIRED, DUNNING_ALREADY_TERMIN
> 
> *…trimmed (1574 more chars — see the cited files).*

---

## E61. 🟡 `comment` on POST /v1/subscriptions/{id}/cancel is documented and accepted, then silently discarded

**What we publish**

apps/docs/src/generated/openapi.json, POST /v1/subscriptions/{id}/cancel requestBody: `"comment": { "type": "string", "maxLength": 500 }` (from packages/core-contracts/src/validations/subscription.ts:44 `comment: z.string().max(500).optional()`), rendered as a request-body row on /reference/subscriptions/cancel; /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:162-166 `export interface SubscriptionCancelParams { mode?: 'now' | 'at_period_end'; comment?: string; }`.

**What the code does**

apps/api/src/apps/main/modules/subscriptions/controllers/cancel-subscription.ts:27 — `const data = await cancelSubscription(db, ctx, (req.params.id ?? ''), { mode: body.mode });` — `comment` is never forwarded. The service takes no such field (apps/api/src/shared/services/subscriptions/transition.ts:112-117 `input: { mode: 'now' | 'at_period_end' }`), never persists it, and the emitted event carries only `{ reference, status }` (transition.ts:144-147). Repo-wide, `comment` appears only in the zod schema.

**Impact.** A merchant collects a cancellation reason from the customer and sends it as documented; it vanishes — not on the subscription object, not in the `subscription.canceled` webhook, not retrievable anywhere. They find out only after shipping the churn-survey feature.

**Fix.** Either wire it through — pass `comment` from cancel-subscription.ts:27 into `cancelSubscription`, persist it (add a `cancellation_comment` column via drizzle-kit generate/migrate) and include it in the `subscription.canceled` payload (transition.ts:144-147) — or delete `comment` from packages/core-contracts/src/validations/subscription.ts:44 so it stops appearing in the spec, the reference page and all nine SDKs.

**Files.** `packages/core-contracts/src/validations/subscription.ts`, `apps/api/src/apps/main/modules/subscriptions/controllers/cancel-subscription.ts`, `apps/api/src/shared/services/subscriptions/transition.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate as written but understated in two respects. First, the identically-declared `comment` on POST /v1/invoices/{id}/void IS implemented (apps/api/src/shared/services/invoices/void.ts:35 persists it as `metadata.voidComment`, forwarded by void-invoice.ts:27), which establishes this as an omission in cancel's wiring rather than an undesigned/aspirational field. Second, the impact is already live in first-party code, not only hypothetical for third-party merchants: apps/console/src/components/console/subscription-actions.tsx:212 renders a "Why is this canceling?" input and apps/console/src/lib/engine-actions.ts:281-285 sends it in the cancel body, so Nomba's own console chur
> 
> *…trimmed (296 more chars — see the cited files).*
> Severity should be low, not medium. "It vanishes / they lose the churn reason" overstates it: the merchant collected the comment themselves and still has it — what breaks is round-tripping it through the API. No money, auth, or persisted-state impact, and it is trivially workaroundable via metadata. The defect is real (a documented + SDK-typed + zod-validated field that the controller never forwards), and the right fix is to either persist it or remove it from the schema/OpenAPI/SDK.

---

## E62. 🟡 `limit`/`cursor` on subscriptions.listEvents and dunning.listAttempts are documented as working pagination; the server ignores them and returns the whole unbounded collection

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts:210-215 — "export interface SubscriptionListEventsParams { /** Page size, 1–100 (API default 20). */ limit?: number; /** Opaque cursor from a previous page's `pagination.nextCursor`. */ cursor?: string; }", consumed by `listEvents(…): PagePromise<DomainEvent>` (:374-385) and `dunning.listAttempts(id, { limit, cursor }): PagePromise<DunningAttempt>` (:282-293), both of which serialize the params into the query string.

**What the code does**

Neither route validates or reads a query: apps/api/src/apps/main/modules/subscriptions/routes.ts:83-89 mounts GET '/subscriptions/:id/events' with NO `validate({ query })` and its controller uses `jsonHandler`, returning the whole array (apps/api/src/apps/main/modules/subscriptions/controllers/list-subscription-events.ts:12-17); the underlying query has no limit and no cursor (packages/sara/src/events/queries.ts:17-34 `listSubscriptionAuditTrail` selects every matching row). Same for dunning: apps/api/src/apps/main/modules/dunning/routes.ts:28-34 (no query validator) and controllers/list-dunning-attempts.ts:20-21 returns every attempt. The `listDunningAttemptsQuery` validator (packages/core-contracts/src/validations/dunning.ts:18-21) is wired to no route. Because the responses carry no `pagination` block, the SDK's Page silently falls back to `{ hasMore: false }` (/Users/mac/Vault/the-60/nombaone/nombaone-node/src/pagination.ts:27-31).

**Impact.** `subscriptions.listEvents(id, { limit: 20 })` on a long-lived subscription returns every event ever emitted for it — no error, no truncation warning — growing without bound as the subscription ages, and the documented cursor loop is dead code.

**Fix.** Wire the pagination that is already written: mount `validate({ query: listDunningAttemptsQuery })` on apps/api/src/apps/main/modules/dunning/routes.ts:28-34 and an equivalent schema on subscriptions/routes.ts:83-89, switch both controllers to `paginatedHandler`, and add limit + keyset cursor to `listSubscriptionAuditTrail` (packages/sara/src/events/queries.ts:17) and the dunning-attempts query. Until then, remove `limit`/`cursor` from `SubscriptionListEventsParams` and `listAttempts` in all nine SDKs.

**Files.** `apps/api/src/apps/main/modules/subscriptions/routes.ts`, `apps/api/src/apps/main/modules/dunning/routes.ts`, `packages/sara/src/events/queries.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/subscriptions.ts`

> **Refuter's correction — re-scopes this finding:**
> The Node SDK exposes `limit`/`cursor` on `subscriptions.listEvents` and `dunning.listAttempts` (and serializes them), but the server never validates or reads them: neither route has a query validator, both controllers return the full array via `jsonHandler` (no `pagination` block), and `listDunningAttemptsQuery` is defined but wired to nothing. Consequences, accurately: (1) `/subscriptions/:id/events` returns the subscription's entire audit trail regardless of `limit` — the only genuinely growing payload, since `listSubscriptionAuditTrail` (packages/sara/src/events/queries.ts:17-34) has no LIMIT; (2) `/subscriptions/:id/dunning/attempts` is NOT unbounded — attempts are scoped to a single unp
> 
> *…trimmed (656 more chars — see the cited files).*
> Correct on the facts, but mis-framed in two ways. (a) The generated OpenAPI/docs do NOT document limit/cursor on these routes — build.ts only emits query params for routes that have a validator — so the false promise is confined to the nombaone-node SDK typings, not the docs an integrator follows. (b) The documented cursor loop is not dangerous dead code: Page defaults to hasMore:false, so auto-pagination terminates after one page having already yielded every item; callers get complete (superset) data, never truncated, never duplicated. The true cost is an oversized response plus an unbounded, unindexable `payload ->> 'reference'` scan on domain_events — a latency hazard that only bites long
> 
> *…trimmed (85 more chars — see the cited files).*

---

## E63. ⚪ Credit-grant sample ids use the suffix `grn`; the API mints `crg`

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:56 (`grantid: "nbo000000000001grn",`) and apps/docs/src/lib/api-ref/snippets.ts:88 (`if (n === "grantid") return "nbo000000000001grn";`). So /reference/customers/void-credit-grant shows `DELETE /v1/customers/nbo000000000001cus/credit/nbo000000000001grn` in the cURL tab and in all nine SDK tabs.

**What the code does**

A credit grant's public reference always ends in `crg`. apps/api/src/shared/services/credits/grant.ts:66 `const reference = mintReference('CRG');`, and packages/sara/src/reference.ts:43 `return \`nbo${randomDigits(12)}${domain.toLowerCase()}\`;` → `nbo…crg`. The `CRG` domain is declared at reference.ts:32 (`| 'CRG' // credit grant`). No reference in this system ever ends in `grn`.

**Impact.** Small but real: the reference page teaches a reference format the platform never emits, so a developer pattern-matching on the id suffix (or writing a validation regex from the docs, which the docs' own `nbo…cus` / `nbo…cpn` conventions invite) builds it against a suffix that will never appear. The neighbouring coupon suffix in the same map (`couponid: "nbo000000000001cpn"`) is correct, which makes the wrong one look authoritative.

**Fix.** apps/docs/src/lib/api-ref/samples.ts:56 — change to `grantid: "nbo000000000001crg",`. apps/docs/src/lib/api-ref/snippets.ts:88 — change to `if (n === "grantid") return "nbo000000000001crg";`. (Cross-check the same map against packages/sara/src/reference.ts:13-38: `paymentmethodid: "…pm"` should be `pmt`, and snippets.ts idSuffix maps `webhooks: "whe"` where reference.ts declares `WHK` — both outside this group, same defect.)

**Files.** `apps/docs/src/lib/api-ref/samples.ts`, `apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on substance: a credit grant's public reference always ends in `crg` (mintReference('CRG') in apps/api/src/shared/services/credits/grant.ts:66), the `:grantId` path param is resolved as `creditGrantsTable.reference` (apps/api/src/shared/services/credits/void.ts:35), and the docs sample `nbo000000000001grn` is a suffix the platform never emits. Two corrections to the report: (1) the snippets.ts line is 86, not 88; (2) only snippets.ts:86 is user-visible — it flows through pathArgSamples -> samplePath (snippets.ts:403, :179) into the cURL URL and all nine SDK tabs on /reference/customers/void-credit-grant. samples.ts:56 is an unreachable map entry, because sampleId is on
> 
> *…trimmed (295 more chars — see the cited files).*

---

## E64. ⚪ The changelog links `POST /v1/plans/{id}/prices` to /reference/prices, a page that has no create operation

**What we publish**

apps/docs/content/changelog.mdx:37-38 — "the nested [`POST /v1/plans/{id}/prices`](/reference/prices) is unchanged — it is still how you add a cadence, or a new amount, to a plan that already exists."

**What the code does**

apps/docs/src/lib/api-ref/model.ts:249-251 assigns an operation to a resource by its FIRST path segment (`pathResource`), so `/v1/plans/{id}/prices` belongs to `plans`, and model.ts:201 gives it the slug `create-price`. Its real URL is /reference/plans/create-price. I enumerated the model: /reference/prices contains exactly three operations — `list` (GET /v1/prices), `retrieve` (GET /v1/prices/{id}) and `deactivate` (POST /v1/prices/{id}/deactivate). There is no create op on that page. The link resolves (so the docs' link-check gate passes) but lands on a page that cannot answer the sentence it is attached to.

**Impact.** A developer following the changelog's pointer to the one call it says is "still how you add a cadence" arrives at a Prices reference page that offers no way to create a price at all, and reasonably concludes the endpoint was removed by the same release the changelog is announcing.

**Fix.** apps/docs/content/changelog.mdx:37 — change the link target from `/reference/prices` to `/reference/plans/create-price`.

**Files.** `apps/docs/content/changelog.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct in mechanism and truth, with two amendments. SCOPE: the mislink occurs twice, not once — changelog.mdx:37 AND changelog.mdx:49 ("nested [`/v1/plans/{id}/prices`](/reference/prices)" in the 2026-07-01 release entry). Both should point to /reference/plans/create-price. (The third hit, content/migrate/from-flutterwave.mdx:17, links the word "Price" to /reference/prices as a generic resource pointer and is fine.) IMPACT: milder than claimed. The link is not broken and the page is not empty — the reader lands on a Prices page listing list/retrieve/deactivate, with Plans adjacent in the sidebar; "reasonably concludes the endpoint was removed" is a stretch. The accurate impac
> 
> *…trimmed (202 more chars — see the cited files).*
> The defect is real and public-facing, but the stated consequence is overstated. Accurate version: both changelog links for `POST /v1/plans/{id}/prices` point at /reference/prices, while the operation actually lives at /reference/plans/create-price. The link resolves to a topically-adjacent page (Prices: list/retrieve/deactivate) that simply lacks the create operation — the endpoint remains fully documented under Plans. Cost is navigation friction, not a plausible belief that the endpoint was removed.

---

## E65. ⚪ The generated "Create a payout" reference page shows `"bankCode": "string", "accountNumber": "string"` as the example request body

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:3-12 promises the opposite in its own header: "it produces a value a developer would actually send or receive — a real email, integer kobo, an `nbo…` id, an ISO timestamp — **not `"string"` placeholders**."

**What the code does**

apps/docs/src/lib/api-ref/samples.ts:15-41 (`byName`) has no rule for `bankCode` or `accountNumber`: `bankcode` matches none of the listed names, and `/id$/i.test("bankCode")` is false; `accountNumber` likewise falls through. Both therefore hit the type fallback at samples.ts:77-78 `case "string": return s.format === "date-time" ? "2026-07-01T09:30:00Z" : "string";`. `requestExample` (samples.ts:102-114) is what renders the "Example request body" block on the operation page (apps/docs/src/components/reference/api-operation.tsx:91, :105-110), so `POST /v1/settlements/payout` — whose body is `{ amountInKobo, bankCode, accountNumber }` (packages/core-contracts/src/validations/settlement.ts:17-21) — renders as `{"amountInKobo": 250000, "bankCode": "string", "accountNumber": "string"}`. The same values are fed into the SDK snippets on that page (snippets.ts consumes the same generator).

**Impact.** Cosmetic but it lands on a money page and it is self-inflicted: the hand-written guide (apps/docs/content/guides/refunds-payouts-settlement.mdx:62) already shows the right shape — `"bankCode": "058", "accountNumber": "0123456789"` — so the auto-generated reference page is strictly worse than the prose it is supposed to supersede, and it visibly breaks the "no `"string"` placeholders" promise the file makes about itself. A developer copying the reference's snippet sends the literal string "string" as a bank code.

**Fix.** apps/docs/src/lib/api-ref/samples.ts — add two rules to `byName` (alongside the existing ones at lines 20-37, before the `/id$/i` catch at :38): `if (n === "bankcode") return "058";` and `if (n === "accountnumber") return "0123456789";` (matching the values already used in guides/refunds-payouts-settlement.mdx:62). While there, `if (n === "resolvedaccountname") return "Ada Lovelace";` for the payout response example.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but narrower than reality. The same fallback hits 25 request-body fields across the generated reference, not 2. POST /v1/mandates is the worst page: bankCode, customerAccountNumber, customerName (misses the exact n === "name" rule), customerAccountName, customerPhoneNumber, customerAddress, narration, startDate and endDate (miss /_?at$/i) all render "string". Also affected: coupon (customer + subscription apply-discount), code (create coupon), customerRef and callbackUrl (payment-method setup), customerRef and expiryDate (virtual-account), sourceReference (grant credit), paymentMethodReference and checkoutToken (update payment method), comment (cancel subscription, voi
> 
> *…trimmed (422 more chars — see the cited files).*
> The finding is accurate but under-scoped. It is not one page: 12 generated operation pages render `"string"` placeholders in the Example request body and in all 10 code-tab snippets. `POST /v1/mandates` is the worst offender with ten placeholder fields (customerRef, customerAccountNumber, bankCode, customerName, customerAccountName, customerPhoneNumber, customerAddress, narration, startDate, endDate), followed by payment-methods setup/virtual-account, subscriptions update-payment-method, coupons create, and the payout page named in the finding. All are prerendered public docs pages, so this is production-reachable, not dev/sandbox-only. Severity stays low: a literal `"string"` bank code is r
> 
> *…trimmed (174 more chars — see the cited files).*

---

# Part 4 — SDK methods, calls and parameters

**All nine SDKs are real, substantial implementations — not one is a stub.** The problem is that the docs *generate* their samples and method indexes from the OpenAPI spec by naming convention, and never open an SDK repo. So published samples call methods that do not exist, in languages that will not compile.

*49 findings — 10 critical, 21 high, 15 medium, 3 low.*

## K1. 🔴 Every nested-namespace Rust snippet renders the accessor as a struct field, not a method call — 12/75 ops fail with E0615

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:337 — `const chain = \`nombaone.${call.namespace.map(snake).join(".")}().${snake(call.method)}\`;` — the `()` is appended ONCE, after the whole joined chain. For `namespace: ["plans","prices"]` (sdk-map.ts:53) this emits, on https://docs.nombaone.xyz/reference/plans/create-price:

    let plan = nombaone.plans.prices().create("nbo000000000001pln", PlanCreateParams { … }).await?;

and sdk-method-index.tsx:102-105 labels the page "Every method in nombaone … a ready-to-run Rust sample."

**What the code does**

In the real crate `plans` is a METHOD, not a field: /Users/mac/Vault/the-60/nombaone/nombaone-rust/src/resources/plans.rs:223 `pub fn plans(&self) -> Plans {`. There is no public field on `Nombaone` at all (client.rs:52-54 — all fields are private). The correct chain is `nombaone.plans().prices().create(...)`.

I compiled all 75 emitted Rust snippets against the real crate (cargo 1.85.0, `cargo check --offline`). Exact compiler output:
    src/main.rs:133:21: error[E0615]: attempted to take value of method `plans` on type `nombaone::Nombaone`: method, not a field
    src/main.rs:275:29: error[E0615]: attempted to take value of method `subscriptions` on type `nombaone::Nombaone`
    src/main.rs:614:24: error[E0615]: attempted to take value of method `webhook_endpoints` on type `nombaone::Nombaone`
    src/main.rs:690:29: error[E0615]: attempted to take value of method `organization` on type `nombaone::Nombaone`
12 E0615 errors, hitting exactly these ops: GET+POST /v1/plans/{id}/prices, GET /v1/subscriptions/{id}/dunning, GET /v1/subscriptions/{id}/dunning/attempts, GET+POST+DELETE /v1

*…trimmed (130 more chars — see the cited files).*

**Impact.** SYSTEMATIC, not isolated: every one of the 12 nested-namespace operations ships a Rust sample that cannot compile. These are the highest-value flows in the product — reading dunning state, scheduling a plan change, replaying a failed webhook delivery, creating a price. A developer copies the sample the docs call "ready-to-run", gets E0615, and has no way to guess the fix from the page (the page never shows the correct `nombaone.plans().prices()` form anywhere — only the hand-written guide does).

**Fix.** apps/docs/src/lib/api-ref/snippets.ts:337 — change to:
    const chain = `nombaone.${call.namespace.map((n) => `${snake(n)}()`).join(".")}.${snake(call.method)}`;
That emits `nombaone.plans().prices().create` and leaves single-segment namespaces (`nombaone.customers().create`) byte-identical to today.

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The nested-namespace E0615 claim is correct and systematic (12 ops: plans/prices ×2, subscriptions/schedule ×3, subscriptions/dunning ×2, webhooks/deliveries ×3, organization/billing ×2) — the fix is to mirror the Java renderer: `call.namespace.map((n) => `${snake(n)}()`).join(".")`. But the finding understates the blast radius and its compile transcript is not reproducible: snippets.ts:349 emits `let nombaone = Nombaone::new()?;` while the crate's `Nombaone::new` (client.rs:63) requires an api_key argument (the no-arg constructor is `from_env()`, client.rs:73), so ALL 75 Rust snippets fail to compile (E0061), not 12. Both lines must be fixed. Severity is high, not critical — this is a docs/
> 
> *…trimmed (105 more chars — see the cited files).*
> The mechanism, the 12 affected ops, and the emitted chain are all accurate — no factual correction needed. Only the severity is wrong: 'critical' should be 'medium'. The claimed impact ('a developer... has no way to guess the fix from the page') overstates it: rustc's E0615 diagnostic explicitly says 'method, not a field' and suggests adding parentheses, so the fix is handed to the developer by the compiler. Scope is also 1 of 10 language tabs and 12 of 75 ops, not the whole reference. Fix: in apps/docs/src/lib/api-ref/snippets.ts:337 change the chain to `nombaone.${call.namespace.map((n) => `${snake(n)}()`).join(".")}.${snake(call.method)}` (mirroring the java() renderer at line 316), and a
> 
> *…trimmed (88 more chars — see the cited files).*

---

## K2. 🔴 Generated Java snippet for POST /v1/invoices/{id}/void emits `invoices().void(...)` — `void` is a Java reserved keyword, so the sample is a hard syntax error, and the Java guide's own callout says the opposite

**What we publish**

apps/docs/src/lib/api-ref/sdk-map.ts:78 — `"POST /v1/invoices/{id}/void": { method: "void" },`. Fed through the Java renderer (apps/docs/src/lib/api-ref/snippets.ts:316 `const chain = `nombaone.${call.namespace.map((n) => `${n}()`).join(".")}.${call.method}`;`) this emits, on /reference/invoices/void and on /sdks/java/reference: `var invoice = nombaone.invoices().void("nbo000000000001inv", InvoiceVoidParams.builder().comment("string").build());`

**What the code does**

`void` is a Java reserved word. javac (OpenJDK 17.0.15) against the real 0.1.0 jar: `VoidOp.java:6: error: <identifier> expected — var invoice = nombaone.invoices().void("nbo000000000001inv", ...` — a PARSE error, so it kills the whole file, not just the statement. The real method is `voidInvoice`: /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/invoices/Invoices.java:66 `public Invoice voidInvoice(String id) {`. The hand-written guide already knows this — apps/docs/content/sdks/java.mdx:311 `<Callout type="warning" title="The method is voidInvoice, because void is a Java keyword">`. Two docs surfaces on the same site contradict each other.

**Impact.** A developer voiding an invoice from the API reference copies a sample that will not even parse. Worse, the two docs pages disagree, so they cannot tell which one is a typo. Because `void` cannot appear as a method name, no amount of imports or wrapping fixes it — the reader must guess `voidInvoice` from a different page.

**Fix.** apps/docs/src/lib/api-ref/sdk-map.ts:78 — the SdkCall map needs a per-language method override, because `void` is only illegal in Java (Node/Python/Go SDKs may legitimately name it `void`). Add an optional `perLang?: Partial<Record<SdkId,string>>` to `SdkCall` and set `{ method: "void", perLang: { java: "voidInvoice" } }`; have snippets.ts:314-333 (`java()`) and src/components/mdx/sdk-method-index.tsx:92 (`signature(...)`) consult it. Minimum viable fix if you will not extend the type: special-case `if (lang === "java" && call.method === "void") method = "voidInvoice"` in snippets.ts java() and in sdk-method-index.tsx.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct, with two refinements. (1) Only the method NAME is wrong, not the call shape: the auditor cited the 1-arg `voidInvoice(String id)` overload, but a 2-arg `voidInvoice(String id, InvoiceVoidParams params)` overload also exists in Invoices.java, so the snippet's arity and `InvoiceVoidParams.builder()` argument are correct as emitted. (2) Scope is Java-only, not a bad map entry: the canonical `method: "void"` is correct for the other SDKs (Python `def void`, Go `Void`, .NET `VoidAsync` — the pascal+Async suffix sidesteps the C# keyword), so the root cause is the absence of a reserved-word escape in the Java renderer, not a wrong sdk-map value. Both broken surfaces are conf
> 
> *…trimmed (405 more chars — see the cited files).*

---

## K3. 🔴 Go snippet emitter omits the required params struct on 14 of 75 operations — every List call is 'not enough arguments'

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:277 `const params = body ? [`${paramsType}{\n${goFields(body)}\t}`] : [];` — a params struct is appended ONLY when the operation has a request body. For GET/DELETE ops the emitted Go is e.g. `customers, err := client.Customers.List(ctx)` and `metric, err := client.Metrics.RetrieveBilling(ctx)` (dumped from getApiResources() + buildOperationSnippets()).

**What the code does**

The real Go SDK types filters as a REQUIRED positional struct, not a variadic option. /Users/mac/Vault/the-60/nombaone/nombaone-go/customers.go:191 `func (s *CustomersService) List(ctx context.Context, params CustomerListParams, opts ...RequestOption) (*Page[Customer], error)`. Same for plans.go:154, prices.go:123, subscriptions.go:457, subscriptions.go:465 (ListEvents), subscriptions.go:390 (ListAttempts), invoices.go:105, coupons.go:130, events.go:47, paymentmethods.go:159, settlements.go:144, plans.go:100 (Plans.Prices.List), webhookendpoints.go:115 (Deliveries.List), metrics.go:60 (`Billing(ctx, params BillingMetricsParams, ...)`). Compiler, go1.23.4: `not enough arguments in call to client.Customers.List / have (context.Context) / want (context.Context, nombaone.CustomerListParams, ...nombaone.RequestOption)`.

**Impact.** 14 operations' Go samples on the API reference cannot compile even after the reader fixes the known undeclared-`ctx` bug. A Go developer copying the `GET /v1/customers` sample gets a hard compile error with no hint that a `CustomerListParams{}` is required — this is the single most-copied call shape in any billing SDK (list invoices, list subscriptions). Note the emitter is correct for the ONE list that genuinely takes no params (WebhookEndpoints.List, webhookendpoints.go:195), which makes the failure look arbitrary rather than systematic.

**Fix.** In `go()` (snippets.ts:272-284), always emit the params struct for Go — `const params = [body ? `${paramsType}{\n${goFields(body)}\t}` : `${paramsType}{}`]` — gated by whether the SDK method actually takes one (only WebhookEndpoints.List does not). Go's params structs are positional and required; they are not the optional kwargs that node/python assume.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The core claim is CONFIRMED and reproducible: snippets.ts:277 appends the params struct only when the op has a request body, so all 14 Go SDK methods that take a REQUIRED positional params struct without a request body are emitted with it missing (the 13 lists + Metrics.Billing). Verified by running the emitter over all 75 ops and by grepping every Go service signature. WebhookEndpoints.List is the one genuine no-params list, so the failure is systematic, not arbitrary.
> 
> Two corrections:
> 
> (a) SEVERITY: medium, not critical. Docs-only, one of ten languages, no runtime/money/security impact. Every Go snippet is already an un-compilable fragment by design (no package/imports, undeclared `ctx`, 
> 
> *…trimmed (1366 more chars — see the cited files).*
> The defect is real and reachable on the public docs site, but "critical" is inflated. Accurate framing: the Go emitter (apps/docs/src/lib/api-ref/snippets.ts:277) appends the required params struct only when the op has a request body, so all GET/DELETE ops (14, incl. every List and Metrics.Billing) emit a Go call missing its required positional params struct. Verified reachable: routing.ts -> reference-article.tsx:129 -> ApiOperationView (api-operation.tsx:82) -> buildOperationSnippets -> go(); a Go tab renders on all 75 shipped reference pages. Verified against the real SDK: nombaone-go/customers.go:191 List(ctx, params CustomerListParams, opts ...RequestOption) and metrics.go:60 Billing(ct
> 
> *…trimmed (909 more chars — see the cited files).*

---

## K4. 🔴 Java webhook verifier rejects 100% of real deliveries — RUNTIME-PROVEN, and the SDK's green test suite proves nothing because it verifies a header it generated itself

**What we publish**

apps/docs/content/sdks/java.mdx:242-250 tells the reader to do exactly this in Spring: `@RequestHeader("X-Nombaone-Signature") String signature` … `event = webhooks.constructEvent(rawBody, signature, System.getenv("NOMBAONE_WEBHOOK_SECRET"));`. The SDK implements a Stripe scheme: /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/webhook/Webhooks.java:203-206 throws `"Malformed X-Nombaone-Signature header — expected \"t=<unix>,v1=<hex>\"."` unless the header parses as `t=…,v1=…`, and Webhooks.java:212-216 HMACs `(timestamp + ".")` then the body, keyed on the PLAINTEXT secret.

**What the code does**

The server sends a BARE hex digest, keyed on sha256(plaintext). packages/sara/src/webhooks/sign.ts:18-19 `export const signWebhookPayload = (secret: string, rawBody: string): string => createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');` and packages/sara/src/webhooks/deliver.ts:113 `const signature = signWebhookPayload(endpoint.signingSecretHash, rawBody);`. I RAN it: built the real server header (`788855eaa2e06454b7a0f85d690b121f0861005c54cfe1c21ca9507fc67fd0e6`) and fed it to the published SDK's `Webhooks.constructEvent` on OpenJDK 17 against nombaone-0.1.0.jar. Output: `RESULT: WebhookVerificationException: Malformed X-Nombaone-Signature header — expected "t=<unix>,v1=<hex>".` — and the SAME rejection with the derived sha256 key (`RESULT(derived key): WebhookVerificationException: Malformed …`), so no choice of secret rescues it. It fails on header SHAPE, before any crypto. NEW SPECIFICS beyond the known cross-SDK finding: (a) the SDK's own suite cannot catch this — src/test/java/xyz/nombaone/webhook/WebhooksTest.java:35 asserts `assertEquals(HEADER, webhooks.gene

*…trimmed (465 more chars — see the cited files).*

**Impact.** Every Java merchant who follows the guide gets 400 on every single delivery, forever. Because the exception message says "Malformed … header", they will conclude their framework is mangling the header or their proxy is stripping it, and will not suspect the SDK. Payment recovery (`invoice.action_required` → checkout link), dunning, and mandate activation (`payment_method.updated`, which the guide at java.mdx:322-325 tells them to WAIT for and explicitly not poll) all silently never fire — a Java merchant's involuntary churn goes uncollected.

**Fix.** Rewrite /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/webhook/Webhooks.java to the scheme the server actually sends: drop `parseSignatureHeader` (lines 176-196), and make `computeSignatureHex` (lines 212-221) key on `sha256(plaintextSecret)` hex and HMAC the raw body ALONE (no `t.` prefix), comparing constant-time against the bare hex header. Delete `generateTestHeader` (lines 165-174) or re-point it at the same scheme. Then fix WebhooksTest.java's golden vector to a byte-vector taken from the SERVER (`signWebhookPayload`), not from the SDK, so the test can fail. Then update apps/docs/content/sdks/java.mdx:230-277 and apps/docs/content/webhooks/signing-and-verification.*. Alternatively — and this is the cheaper call if you have not launched — change the SERVER to the Stripe scheme all nine SDKs and the docs already implement (packages/sara/src/webhooks/sign.ts

*…trimmed (126 more chars — see the cited files).*

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/webhook/Webhooks.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/test/java/xyz/nombaone/webhook/WebhooksTest.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/examples/src/main/java/xyz/nombaone/examples/WebhookReceiver.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/webhooks/sign.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/java.mdx`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: this is NOT a Java-SDK bug — it is a server-vs-contract divergence that breaks webhook verification for EVERY SDK and for the docs' own reference implementations. packages/sara/src/webhooks/sign.ts + deliver.ts:113,206 send `x-nombaone-signature: <bare hex>` where the HMAC key is sha256(plaintextSecret), while apps/docs/content/webhooks/signing-and-verification.mdx:13-19 (the merchant-facing spec), webhooks/overview.mdx:21, the docs' WebhookVerifier component, and all nine SDKs (Java included) implement `t=<unix>,v1=hex` over `${t}.${rawBody}` keyed on the plaintext whsec. There are therefore TWO breaks, not one: (1) header shape (t/v1 vs bare hex) — the Java SDK fails here
> 
> *…trimmed (951 more chars — see the cited files).*
> Accurate on the mechanism, overstated on impact and framing. (a) The rejection is real and unconditional — server sends bare hex (sara/src/webhooks/sign.ts:18-19, deliver.ts:113), Java demands t=,v1= (Webhooks.java:203-206) — so every delivery to a guide-following Java merchant is rejected. (b) But it is NOT Java-specific: nombaone-node/src/webhooks.ts:42,181, nombaone-python/src/nombaone/webhooks.py:55,188 and nombaone-go/webhook/webhook.go:157,189 ship the exact same wrong scheme; this is one instance of the systemic cross-SDK mismatch, not an independent critical. (c) "Silently never fire" is wrong — it fails closed and loudly: 400s on every attempt, deliveries retry then land in `dead`, 
> 
> *…trimmed (566 more chars — see the cited files).*

---

## K5. 🔴 PHP webhook verifier rejects 100% of real deliveries — proven by running it (throws "Malformed X-Nombaone-Signature header")

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-php/src/Webhooks/Webhooks.php:150 computes `return hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);` and :177 hard-requires the header shape: `'Malformed X-Nombaone-Signature header — expected "t=<unix>,v1=<hex>".'`. The guide /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/php.mdx:204-208 tells the integrator to feed it the raw header and the PLAINTEXT secret: `$event = $wh->constructEvent(file_get_contents('php://input'), $_SERVER['HTTP_X_NOMBAONE_SIGNATURE'] ?? '', getenv('NOMBAONE_WEBHOOK_SECRET'), // shown once at endpoint creation)`.

**What the code does**

The server never sends that header shape. /Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/webhooks/deliver.ts:113 `const signature = signWebhookPayload(endpoint.signingSecretHash, rawBody);` and :206 `'x-nombaone-signature': signature,` — with packages/sara/src/webhooks/sign.ts:20 `createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')`. So the wire value is a BARE lowercase hex digest over the raw body, keyed on sha256(plaintext secret). I ran the real SDK (PHP 8.5.8, composer autoload) against a byte-exact reproduction of deliver.ts's buildBody + header: (A) plaintext secret => THROWS 'Malformed X-Nombaone-Signature header — expected "t=<unix>,v1=<hex>".' (B) sha256(secret) as the key => THROWS the same. There is NO secret value that makes it pass, because it dies in parseHeader() before any HMAC is computed. (C) The SDK's own `generateTestHeader()` output verifies fine — which is the only thing its tests ever feed it.

**Impact.** NEW SPECIFICS beyond the established cross-SDK note: (1) executed proof, not inference — the failure is a header-PARSE failure, so it is unrecoverable by any secret rotation or config the integrator can reach; (2) the PHP guide's own sample does `catch (WebhookVerificationException $e) { http_response_code(400); exit; }` (php.mdx:209-212), so a PHP merchant who follows the docs exactly 400s every single delivery — every `invoice.paid` is dropped, subscribers are never unlocked, and the merchant's only signal is a wall of failed deliveries; (3) the SDK's test suite CANNOT catch this: tests/Unit/WebhooksTest.php:17-20 pins a self-referential "golden vector" (`GOLDEN_HEADER = 't=1751600000,v1=b

*…trimmed (217 more chars — see the cited files).*

**Fix.** Two coherent options, pick one and apply it to all nine SDKs + docs. (a) Change the SDK to the scheme the server actually uses: in src/Webhooks/Webhooks.php replace parseHeader() with a raw-hex read of the header, replace computeSignature() with `hash_hmac('sha256', $payload, hash('sha256', $secret))`, drop the timestamp/tolerance logic (the wire carries no `t`), and regenerate the golden vector from a real captured delivery. (b) Change the server to emit `t=<unix>,v1=<hex>` over `{t}.{body}` keyed on the plaintext secret (packages/sara/src/webhooks/sign.ts:20 + deliver.ts:113,206) — this also requires storing the plaintext (endpoints.ts currently stores only sha256), so (a) is far cheaper. Either way, add ONE cross-repo conformance test that signs with the server's real `signWebhookPayload` and verifies with the PHP SDK.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-php/src/Webhooks/Webhooks.php`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/tests/Unit/WebhooksTest.php`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/php.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/sara/src/webhooks/sign.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct as stated. Three refinements for accuracy: (1) The defect is not PHP-specific — the same `t=,v1=` scheme is baked into the docs corpus (apps/docs/content/webhooks/signing-and-verification.mdx:14, webhooks/overview.mdx:21, guides/handle-webhooks.mdx:40, getting-started/verify-in-your-devtools.mdx, the ha/yo localizations) and every SDK guide, so the PHP SDK is one instance of a platform-wide verification-contract break. (2) There is a SECOND, independent mismatch the auditor did not name: deliver.ts signs with `endpoint.signingSecretHash` = `sha256Hex(plaintextSecret)` (packages/sara/src/webhooks/endpoints.ts:24-29,57), while php.mdx:206 tells the integrator to pass the
> 
> *…trimmed (616 more chars — see the cited files).*

---

## K6. 🔴 The .NET SDK's webhook verifier implements a Stripe-style scheme the server does not use — and ships a `GenerateTestHeader` that makes the developer's own tests pass against the wrong scheme

**What we publish**

ADDS SPECIFICS to the established cross-SDK webhook-scheme bug: the .NET coordinates, plus a new failure mode nobody has flagged. `nombaone-dotnet/src/NombaOne/Webhooks/WebhookVerifier.cs:129-137`: `// hex(HMAC_SHA256(secret, "{t}." + rawBody)).` — the verifier HMACs `timestamp + "." + payload`. `:172-176` requires the header to parse as `t=<unix>,v1=<hex>`, else `"Malformed X-Nombaone-Signature header — expected \"t=<unix>,v1=<hex>\""`. And `:117-119` `public static string GenerateTestHeader(...)` → `return $"t={seconds},v1={ComputeSignature(secret, seconds, payload)}";`.

**What the code does**

The server sends a BARE lowercase-hex digest with no timestamp and no `t=`/`v1=` structure. `packages/sara/src/webhooks/sign.ts:18-19`: `export const signWebhookPayload = (secret: string, rawBody: string): string => createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');` — HMAC over the raw body ONLY. `packages/sara/src/webhooks/deliver.ts:113`: `const signature = signWebhookPayload(endpoint.signingSecretHash, rawBody);`. A real delivery's `X-Nombaone-Signature` therefore has no comma and no `=`, so `ParseSignatureHeader` (WebhookVerifier.cs:148-181) finds no `t` and no `v1` and throws `WebhookVerificationException` — 100% of real deliveries are rejected before the HMAC is even computed. NEW SPECIFIC: the SDK's entire webhook test suite is self-referential — `test/NombaOne.Tests/Unit/WebhooksTests.cs:34,57,66,75,111,121,136` all build their input with `WebhookVerifier.GenerateTestHeader(...)` and feed it back to `WebhookVerifier.VerifySignature(...)`. Generator and verifier share the same wrong scheme, so the suite is green.

**Impact.** The .NET webhook path is not merely undocumented-wrong, it is **untestable-wrong**: a developer follows dotnet.mdx:206-234, wires the receiver, writes a handler test using the SDK's own `GenerateTestHeader` (which the XML doc at WebhookVerifier.cs:112-115 explicitly recommends: "for testing your own handler without waiting on a real delivery"), watches it go green, ships — and then every single production delivery is rejected with 'Malformed X-Nombaone-Signature header'. The one tool the SDK gives them to catch this is the tool that hides it. Subscription state silently stops advancing in their system.

**Fix.** Pick the scheme, then make all three sides agree. Cheapest correct move given the server is self-consistent and deployed: change the .NET verifier to match the server. In `nombaone-dotnet/src/NombaOne/Webhooks/WebhookVerifier.cs`, replace `ComputeSignature` (:129-137) with `hex(HMAC_SHA256(sha256Hex(secret), rawBody))` per `packages/sara/src/webhooks/endpoints.ts:24-30`, delete `ParseSignatureHeader` (:148-181) and the timestamp/tolerance logic (:71-88), and make `GenerateTestHeader` (:117-119) emit the bare hex digest. Update `test/NombaOne.Tests/Unit/WebhooksTests.cs:14` golden vector to a digest computed by `packages/sara/src/webhooks/sign.ts`, NOT by `GenerateTestHeader` — a golden vector produced by the code under test proves nothing. Mirror in the other 8 SDKs and in `apps/docs/content/webhooks/signing-and-verification.mdx`.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/Webhooks/WebhookVerifier.cs`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/test/NombaOne.Tests/Unit/WebhooksTests.cs`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/dotnet.mdx`

> **Refuter's correction — re-scopes this finding:**
> The mismatch and its impact are real, but the blame is inverted. The documented contract (apps/docs/content/webhooks/signing-and-verification.mdx:14 — `t=<unix>,v1=<hex>` where v1 = hex HMAC-SHA256 of `${t}.${rawBody}`) and the cross-SDK golden vector (nombaone-dotnet/test/NombaOne.Tests/Unit/WebhooksTests.cs:12-13, which I verified computes to ba56a072…b374 under exactly that scheme) both match the .NET verifier. The deviant component is the SERVER: packages/sara/src/webhooks/sign.ts:18-19 signs the raw body only, with no timestamp and no t=/v1= envelope, and packages/sara/src/webhooks/deliver.ts:206 ships that bare hex as `x-nombaone-signature` on the live cron-driven delivery path. So the
> 
> *…trimmed (1022 more chars — see the cited files).*
> The scheme mismatch and the self-referential test suite are confirmed. What is wrong is the 'untestable-wrong / silently stops advancing' framing: the failure is fail-closed and loud at the first production delivery (explicit 'Malformed X-Nombaone-Signature header' exception, non-2xx, deliveries retrying then dead in the console's request/delivery logs). GenerateTestHeader creates a pre-launch false-green, not a hidden production failure. No forged webhook is accepted, no auth or money surface is compromised. It is also the same root cause as the already-flagged cross-SDK webhook-scheme bug (the docs themselves, guides/handle-webhooks.mdx:32, assert the timestamped scheme) — fix is one schem
> 
> *…trimmed (66 more chars — see the cited files).*

---

## K7. 🔴 The generated .NET method index drops the `Async` suffix — all 75 method names on /sdks/dotnet/reference do not exist

**What we publish**

`apps/docs/src/components/mdx/sdk-method-index.tsx:51` maps `dotnet: "pascal"`; `:36-38` `function toPascal(s) { return s.charAt(0).toUpperCase() + s.slice(1); }`; `:61-63` `function signature(namespace, method, style) { return [...namespace.map(...), applyCase(method, style)].join("."); }`. Rendering `<SdkMethodIndex lang="dotnet" />` (content/sdks/dotnet/reference.mdx:13) therefore prints, for all 75 ops: `nombaone.Customers.Create`, `nombaone.Subscriptions.Cancel`, `nombaone.Invoices.Void`, `nombaone.Plans.Prices.Create`, `nombaone.WebhookEndpoints.RotateSecret`, … The file's own docstring (`:11-13`) asserts the names are "correct by construction" and "can never miss a method".

**What the code does**

Every public method on every resource in the real SDK ends in `Async` — there is not one non-`Async` public method in the library. `nombaone-dotnet/src/NombaOne/Resources/Customers.cs:237`: `public Task<Customer> CreateAsync(CustomerCreateParams parameters, …)`. `Subscriptions.cs:690`: `public Task<Subscription> CancelAsync(…)`. `Invoices.cs:187`: `public Task<Invoice> VoidAsync(…)`. `Plans.cs:136`: `public Task<Price> CreateAsync(string planId, PriceCreateParams …)`. Compiler proof: `nombaone.Customers.Create(…)` → `error CS1061: 'CustomersResource' does not contain a definition for 'Create'`. This is the .NET-only wrinkle: Go is also `pascal` in LANG_CASE and is correct there, so the shared casing table is right for Go and wrong for .NET.

**Impact.** SYSTEMATIC, not isolated: /sdks/dotnet/reference is the page the .NET guide sends you to ("Method reference — Every method in the SDK", dotnet.mdx:303-305), and 75/75 entries name a method that does not compile. A C# developer who reads the index and writes `await nombaone.Subscriptions.Cancel(id)` gets CS1061 on every single call. Worse, the index contradicts the guide on the same site: dotnet.mdx:41 shows `Plans.CreateAsync` while the index shows `Plans.Create`.

**Fix.** In `apps/docs/src/components/mdx/sdk-method-index.tsx`, give .NET its own suffix. Add after `applyCase` (line 58): `const LANG_SUFFIX: Partial<Record<SdkId, string>> = { dotnet: "Async" };` and change `signature()` (line 61-63) to take the lang and append the suffix to the final method segment only — i.e. `applyCase(method, style) + (LANG_SUFFIX[lang] ?? "")`, leaving namespace segments untouched (`Plans.Prices.CreateAsync`, not `PlansAsync.PricesAsync…`). Thread `lang` through from `SdkMethodIndex` (line 92). This is exactly what snippets.ts already does correctly at line 293 (`${pascal(call.method)}Async`), so the two generators should agree.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and, if anything, slightly UNDERSTATED on the fix — but the severity is overstated at "critical".
> 
> Accurate version: sdk-method-index.tsx applies only `toPascal` for `dotnet` (LANG_CASE:51), so all 75 entries on /sdks/dotnet/reference drop the `Async` suffix that every one of the 92 public methods in nombaone-dotnet carries. Verified by executing the component's own code path (75 ops, 0 containing "Async") and by exhaustive grep of the SDK (zero public non-Async methods).
> 
> Two refinements the auditor did not state:
> 1. The repo ALREADY has the correct rule in a sibling renderer: snippets.ts:293 appends `Async` for the .NET sample. So the bug is a missed-suffix in one of
> 
> *…trimmed (749 more chars — see the cited files).*
> The technical facts hold: /sdks/dotnet/reference is a live, ungated production docs page linked from the .NET guide, and all 75 entries omit the Async suffix because dotnet shares the "pascal" case style with Go (which is correct under pascal). It genuinely contradicts both the guide (dotnet.mdx:41) and the site's own generated C# samples (snippets.ts:293, which DOES append Async), and check:sdks does not gate casing — so the "correct by construction" docstring only guarantees coverage, not names. What is overstated is the severity. This is docs-only: no money, auth, data, or runtime path is affected. It fails at COMPILE time (CS1061) — the earliest and cheapest failure mode — the correct na
> 
> *…trimmed (451 more chars — see the cited files).*

---

## K8. 🔴 The published Java SDK leaks the `example.*` scaffold into its PUBLIC API on Maven Central: `ErrorCode.EXAMPLE_NOT_FOUND` under a literal `// ---- Example scaffold ----` header, and its vendored spec still carries `/v1/examples`

**What we publish**

The Java SDK presents itself as the finished, official surface — pom.xml:16 `<name>NombaOne Java SDK</name>`, and it IS live: `https://repo1.maven.org/maven2/xyz/nombaone/nombaone/maven-metadata.xml` returns `<release>0.1.0</release>` `<lastUpdated>20260707074202</lastUpdated>`. apps/docs/src/lib/sdks/registry.ts:142-147 points every reader at it (`package: "xyz.nombaone:nombaone"`, `version: "0.1.0"`).

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java:114-115 —
```
  // ---- Example scaffold ----
  public static final String EXAMPLE_NOT_FOUND = "EXAMPLE_NOT_FOUND";
```
`ErrorCode` is a `public final class` of `public static final String` constants, so `EXAMPLE_NOT_FOUND` autocompletes in every Java IDE next to `SETTLEMENT_NOT_FOUND` and `PAYOUT_EXCEEDS_AVAILABLE`. Separately, the SDK's vendored /Users/mac/Vault/the-60/nombaone/nombaone-java/spec/openapi.json still lists the scaffold paths: `['/v1/examples', '/v1/examples/{id}']` — and that spec is what `src/test/java/xyz/nombaone/conformance/OpenApiConformanceTest.java` asserts "bidirectional coverage" against (CHANGELOG.md: "OpenAPI conformance suite proving bidirectional coverage of the surface").

**Impact.** A paying integrator typing `ErrorCode.` in IntelliJ sees a constant named EXAMPLE_NOT_FOUND with a comment calling it a scaffold, on a jar published to Maven Central. It is the single most visible signal that the product is a template that was never cleaned up, and it is permanently in the 0.1.0 artifact (Maven Central is immutable — you can only publish 0.1.1 over it). The stale vendored spec means the SDK's own conformance gate is asserting against the scaffold surface, which is why nothing caught it.

**Fix.** Delete /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java:114-115 (the comment and the constant). Re-vendor spec/openapi.json from the current apps/api build (which must itself drop `/v1/examples` — exampleRouter is still mounted UNGATED at apps/api/src/apps/main/server/routes.ts:48). Cut 0.1.1 and bump apps/docs/src/lib/sdks/registry.ts:145 to `version: "0.1.1"` and line 147's install string to match.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/error/ErrorCode.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/sdks/registry.ts`

> **Refuter's correction — re-scopes this finding:**
> The public-API leak is real and verified: xyz.nombaone:nombaone 0.1.0 on Maven Central exposes `public static final String EXAMPLE_NOT_FOUND` under a literal `// ---- Example scaffold ----` header (ErrorCode.java:114-115). But the root cause is the opposite of what the auditor claims: the vendored spec is NOT stale — apps/api STILL MOUNTS the scaffold resource in production. `apps/api/src/apps/main/server/routes.ts:48` runs `v1Router.use(exampleRouter)` with no env gate, and `apps/api/src/apps/main/modules/example/routes.ts` serves POST /v1/examples, GET /v1/examples, GET /v1/examples/{id} behind real API-key auth and `example:read`/`example:write` scopes. `EXAMPLE_NOT_FOUND` is likewise a l
> 
> *…trimmed (1095 more chars — see the cited files).*
> The constant is real and publicly visible in the Maven Central 0.1.0 jar, but it is not a Java-SDK-specific leak and the vendored spec is not stale. `EXAMPLE_NOT_FOUND` is defined in the shared error SSOT (packages/errors/src/codes.ts:212, exported as a public code at :330 with a docs hint at :851), POST/GET /v1/examples is mounted unconditionally on the production v1 router (apps/api/src/apps/main/server/routes.ts:9,48 — no env gate), and it has a published docs reference page (apps/docs/content/reference/examples.mdx). The Java spec therefore matches upstream exactly, and the conformance suite is asserting against the true current surface — "nothing caught it" because there is nothing to c
> 
> *…trimmed (314 more chars — see the cited files).*

---

## K9. 🔴 The published PHP SDK leaks the `example` scaffold into its public API: `ErrorCode::EXAMPLE_NOT_FOUND` and `/v1/examples` in the spec it ships

**What we publish**

The PHP SDK presents `NombaOne\ErrorCode` as the branchable error-code catalog — /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/php.mdx:186-189: "The machine code lives on `$errorCode` … Branch on `$errorCode` or the exception class … Every code and its fix is in the [error reference](/errors)."

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-php/src/ErrorCode.php:126-127 ships, verbatim: `    // ---- Example scaffold ----` / `    public const EXAMPLE_NOT_FOUND = 'EXAMPLE_NOT_FOUND';` — and it is registered as a known code at :208 `self::EXAMPLE_NOT_FOUND => true,`. It is a public const on a published package (Packagist `nombaone/nombaone-php` v0.1.2, tag confirmed in the repo's `git tag`). Separately, the SDK PACKAGE ships /Users/mac/Vault/the-60/nombaone/nombaone-php/spec/openapi.json, which still contains `/v1/examples` and `/v1/examples/{id}` (verified by parsing it) — the SDK's own conformance test at tests/Conformance/OpenApiCoverageTest.php:25-29 has to explicitly exclude them: `'post /v1/examples', 'get /v1/examples', 'get /v1/examples/{id}'`.

**Impact.** Every PHP integrator who types `ErrorCode::` gets `EXAMPLE_NOT_FOUND` in IDE autocomplete, sitting between `PAYOUT_EXCEEDS_AVAILABLE` and `SYSTEM_INTERNAL_ERROR`, under a literal `// ---- Example scaffold ----` comment. It is placeholder/scaffold content on a production surface (a published, versioned package a paying merchant installs), and it advertises to anyone reading the source that a scaffold route was never deleted. This is a *new* finding — the established list covers the /v1/examples route and the /errors page, but not that the shipped SDK bakes the scaffold into its public type surface and vendors a spec containing the scaffold paths.

**Fix.** Delete src/ErrorCode.php:126-127 (the `// ---- Example scaffold ----` header and the `EXAMPLE_NOT_FOUND` const) and its registration at :208. Regenerate /Users/mac/Vault/the-60/nombaone/nombaone-php/spec/openapi.json from a server build that no longer mounts exampleRouter, then delete the three `/v1/examples` entries from `OpenApiCoverageTest::EXCLUDED` (lines 26-28) so the drift alarm proves the scaffold is gone rather than papering over it. Cut a 0.1.3 tag (registry.ts:115 must be bumped in lockstep).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-php/src/ErrorCode.php`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-php/tests/Conformance/OpenApiCoverageTest.php`

> **Refuter's correction — re-scopes this finding:**
> The accurate version: the published PHP package (v0.1.2, `composer require`) ships exactly one scaffold artifact — `NombaOne\ErrorCode::EXAMPLE_NOT_FOUND` (src/ErrorCode.php:126-127, registered in KNOWN at :208) under a literal `// ---- Example scaffold ----` header. It does NOT ship spec/openapi.json or the conformance test: .gitattributes export-ignores `/spec` and `/tests`, and `git archive v0.1.2` confirms the published tree is only CHANGELOG.md, LICENSE, PUBLISHING.md, README.md, composer.json and src/**. Furthermore the const is not an SDK defect in its own right — it mirrors packages/errors/src/codes.ts:211-212, the SSOT, whose own comment marks it as "the deletable example slice (del
> 
> *…trimmed (285 more chars — see the cited files).*
> Severity is low, not critical. The finding is factually correct and reachable (published package, public const, IDE autocomplete, docs point integrators at the class), but the impact is cosmetic/credibility only — no money, auth, data, or behavioral consequence. It is also not an independent defect: the root cause is the single un-deleted scaffold in packages/errors/src/codes.ts:212/:330/:851, which the PHP SDK, the /errors docs page, and the vendored OpenAPI spec all mirror; filing it separately double-counts. The one genuinely new, actionable fact is that the leak has escaped into a published Packagist artifact (v0.1.2), so the fix is delete-upstream + regenerate + patch-release across the
> 
> *…trimmed (28 more chars — see the cited files).*

---

## K10. 🔴 The published npm package @nombaone/node@0.1.4 ships `example.created`/`example.settled` scaffold events in its public WebhookEvent type union

**What we publish**

nombaone-node/src/webhook-events.ts:1-4 — "The typed outbound event catalog — one union member per event type the platform emits, mirrored from the API's frozen catalog." And apps/docs/content/sdks/node.mdx:204 — "switch (event.type) { // 3. fully typed — data narrows on type", presenting the union as the product's event surface.

**What the code does**

nombaone-node/src/webhook-events.ts:94-97 — "/** @deprecated Reference-scaffold event; not part of the billing product. */\nexport type ExampleCreatedEvent = WebhookEventBase<'example.created', RefData>;" ... and these are MEMBERS of the shipped union at webhook-events.ts:159-160 — "| ExampleCreatedEvent\n  | ExampleSettledEvent;". This is not source-only: it is compiled into the distributed types (nombaone-node/dist/index.d.ts:1867,1869,1896 and dist/index.d.cts:1867,1869,1896), and I downloaded the LIVE tarball from npm (`npm pack @nombaone/node@0.1.4`) — package/dist/index.d.ts:1867 and :1869 contain `type ExampleCreatedEvent = WebhookEventBase<'example.created', RefData>;` / `ExampleSettledEvent`. `npm view @nombaone/node dist-tags` → `{ latest: '0.1.4' }`, so this is what every integrator installs today. Notably the SDK's own conformance test ALREADY knows `examples` is scaffold — test/conformance/openapi-coverage.test.ts:38-40 excludes "post /v1/examples" with the comment "// deletable reference scaffold" — so the routes were quarantined but the EVENT TYPES were not.

**Impact.** Every TypeScript integrator who writes `switch (event.type)` on a NombaOne webhook gets IntelliSense/autocomplete offering `'example.created'` and `'example.settled'` alongside `invoice.paid`. `WebhookEventType` (webhook-events.ts:163) resolves to a union that includes them. A paying merchant reading their editor's completion list sees internal reference-scaffold identifiers presented as first-class product events on a production, already-published artifact. It also means a `switch` with `default: assertNever(event)` forces them to handle two fake events.

**Fix.** In /Users/mac/Vault/the-60/nombaone/nombaone-node/src/webhook-events.ts delete lines 94-97 (both `@deprecated` type aliases) and delete the two union members `| ExampleCreatedEvent` and `| ExampleSettledEvent` at lines 159-160. Rebuild (`pnpm build`) and publish 0.1.5. This must be sequenced with removing `example.created`/`example.settled` from packages/core-contracts/src/types/webhook-events.ts:108-109 so the SDK stays a faithful mirror of the catalog.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-node/src/webhook-events.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/packages/core-contracts/src/types/webhook-events.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually accurate in every particular (I re-verified the live npm tarball and proved the exhaustiveness break with tsc), but it is misattributed and mis-severitized.
> 
> ACCURATE VERSION: The published @nombaone/node@0.1.4 does ship `example.created`/`example.settled` in its exported `WebhookEvent` union, and this genuinely breaks any consumer using `default: assertNever(event)` (confirmed: TS2345 against the live tarball) and pollutes autocomplete for all TS integrators. The `@deprecated` JSDoc does not mitigate it, because it sits on the type alias rather than the string literal.
> 
> However: (a) The ROOT CAUSE is upstream, not in the SDK. packages/core-contracts/src/types/webhoo
> 
> *…trimmed (1218 more chars — see the cited files).*
> Accurate version: the shipped @nombaone/node@0.1.4 `WebhookEvent` union does include `example.created`/`example.settled` (src/webhook-events.ts:94-97,159-160 → dist/index.d.ts:1867,1869), so every TypeScript integrator gets them in IntelliSense and must handle them under an exhaustive `switch`. That is real and reachable. However, the claim that "the routes were quarantined but the EVENT TYPES were not" is false: apps/api/src/apps/main/server/routes.ts:48 mounts `exampleRouter` on the live `/v1` router, packages/sara/src/example/create.ts:118 and confirm.ts:91 emit these events, and packages/core-contracts/src/types/webhook-events.ts:108-109 keeps them in the catalog. The SDK is faithfully m
> 
> *…trimmed (622 more chars — see the cited files).*

---

## K11. 🟠 5 of 75 reference snippets AND the /sdks/php/reference method index name PHP methods that do not exist — proven by reflection against the installed SDK

**What we publish**

The generated PHP samples (from /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts) emit these five calls, which I dumped verbatim: `$nombaone->customers->voidCreditGrant("nbo000000000001cus", "nbo000000000001grn");` (sdk-map.ts:50), `$nombaone->subscriptions->schedule->cancel("nbo000000000001sub");` (:67), `$nombaone->paymentMethods->delete("nbo000000000001pm");` (derived via CRUD_METHOD at :37), `$nombaone->events->retrieveCatalog();` (:89), `$nombaone->metrics->retrieveBilling();` (:94). The SAME five names are ALSO rendered onto the PHP method-reference page: content/sdks/php/reference.mdx:13 `<SdkMethodIndex lang="php" />` → src/components/mdx/sdk-method-index.tsx:92 `{signature(call.namespace, call.method, style)}`, fed by the same `sdkCall()`.

**What the code does**

I loaded the real SDK (`vendor/autoload.php`), constructed `new NombaOne\Nombaone()` exactly as the snippet does, walked every one of the 75 emitted accessor chains, and reflected each method. Result: `75 ops; 5 broken; 70 resolve.` — `UNDEFINED METHOD NombaOne\Resources\Customers::voidCreditGrant()` (real: `voidCredit`, src/Resources/Customers.php:213), `NombaOne\Resources\SubscriptionSchedules::cancel()` (real: `release`, SubscriptionSchedules.php:57), `NombaOne\Resources\PaymentMethods::delete()` (real: `remove`, PaymentMethods.php:125), `NombaOne\Resources\Events::retrieveCatalog()` (real: `catalog`, Events.php:59), `NombaOne\Resources\Metrics::retrieveBilling()` (real: `billing`, Metrics.php:25).

**Impact.** NEW SPECIFICS beyond the established note: (1) executed reflection, so the count is exact and the surviving 70 are certified correct — this is ISOLATED (5/75), not systematic, which matters because the PHP accessor chains, constructor, param shapes and body keys are all *fine*; (2) the blast radius is wider than snippets — the fabricated names are also printed on /sdks/php/reference, the page the docs sell as the authoritative method list, so a developer who never opens a snippet still gets `customers.voidCreditGrant`; (3) PHP dispatches dynamically, so unlike Go/Rust there is no compile step to catch it — the developer ships and gets `PHP Fatal error: Uncaught Error: Call to undefined metho

*…trimmed (99 more chars — see the cited files).*

**Fix.** In /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts, change the four OVERRIDES to the real names — :50 `"DELETE /v1/customers/{id}/credit/{grantId}": { method: "voidCredit" }`, :67 `"DELETE /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "release" }`, :89 `"GET /v1/events/catalog": { method: "catalog" }`, :94 `"GET /v1/metrics/billing": { method: "billing" }` — and ADD a fifth override for the CRUD-derived one, `"DELETE /v1/payment-methods/{id}": { method: "remove" }` (it currently falls through CRUD_METHOD at :37). Then add a gate that reflects the emitted names against each SDK's real surface; the existing check:sdks proves coverage but never proves the names exist.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but under-scoped. It is not a PHP-only defect: sdk-map.ts is the single source feeding all ten snippet renderers and all nine <SdkMethodIndex> pages, and the node/python/etc. SDKs use the same real names as PHP (voidCredit, release, remove, catalog, billing). So the five fabricated method names (voidCreditGrant, schedule.cancel, paymentMethods.delete, retrieveCatalog, retrieveBilling) are wrong for EVERY SDK's samples and method index — roughly 5 ops x 10 languages + 9 reference pages. PHP is simply the language where it surfaces as a runtime fatal (no __call magic in the SDK) rather than a compile error. Fix is one file: apps/docs/src/lib/api-ref/sdk-map.ts — rename t
> 
> *…trimmed (386 more chars — see the cited files).*
> The finding is correct but scoped too narrowly to PHP. sdk-map.ts is language-neutral, so the same five fabricated names (voidCreditGrant, schedule.cancel, paymentMethods.delete, retrieveCatalog, retrieveBilling) are emitted for all nine SDKs -- the real SDKs use voidCredit / release / remove / catalog / billing across node, go, python (verified in the sibling repos). Blast radius is ~45 broken snippets and nine method-reference pages, not 5 and one. Fix is five entries in apps/docs/src/lib/api-ref/sdk-map.ts (:37 CRUD_METHOD delete mapping, :50, :67, :89, :94), plus extending the check:sdks gate to assert every sdkCall() name resolves against the real SDK surface.

---

## K12. 🟠 Compiler-verified: exactly 5 of the 75 generated Elixir calls raise UndefinedFunctionError — and I can name the real function for each

**What we publish**

apps/docs/src/lib/api-ref/sdk-map.ts declares these calls, which snippets.ts:259-270 renders into the Elixir sample on the corresponding /reference page AND sdk-method-index.tsx renders into the /sdks/elixir/reference row: sdk-map.ts:50 `"DELETE /v1/customers/{id}/credit/{grantId}": { method: "voidCreditGrant" },`; sdk-map.ts:67 `"DELETE /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "cancel" },`; sdk-map.ts:37 `delete: "delete",` (the derived CRUD name, applied to `DELETE /v1/payment-methods/{id}`); sdk-map.ts:89 `"GET /v1/events/catalog": { method: "retrieveCatalog" },`; sdk-map.ts:94 `"GET /v1/metrics/billing": { method: "retrieveBilling" },`.

**What the code does**

NEW EVIDENCE — this is not an eyeball diff. I compiled the real SDK (`mix compile`, Elixir 1.20.2/OTP 29) and resolved every one of the 75 emitted (module, function, arity) triples against the loaded BEAM files with `Code.ensure_loaded?/1` + `function_exported?/3`. Result: 75 total, 70 resolve, 0 missing modules, 0 syntax errors, and exactly 5 undefined — with the real exports dumped from `__info__(:functions)`: (1) emitted `Nombaone.Customers.void_credit_grant/3` — module exports `[:apply_discount, :create, :grant_credit, :list, :remove_discount, :retrieve, :retrieve_credit_balance, :update, :void_credit]`; real is `void_credit/4` (customers.ex:229 `def void_credit(client, id, grant_id, opts \\ [])`). (2) emitted `Nombaone.Subscriptions.Schedule.cancel/2` — module exports `[:create, :release, :retrieve]`; real is `release/3` (subscriptions.ex:408). (3) emitted `Nombaone.PaymentMethods.delete/2` — module exports `[:create_virtual_account, :list, :remove, :retrieve, :set_default, :setup]`; real is `remove/3` (payment_methods.ex:123). (4) emitted `Nombaone.Events.retrieve_catalog/1` — 

*…trimmed (307 more chars — see the cited files).*

**Impact.** Five /reference operation pages ship an Elixir sample that raises `UndefinedFunctionError` the instant it is pasted. `Nombaone.Metrics` is the worst: the module exports exactly one public function, `billing`, and the docs get its name wrong — so 100% of the Metrics surface is undocumented-by-any-correct-name. Each of the 5 also poisons its row in the /sdks/elixir/reference index, so a developer who searches the index for the right name is sent to the same wrong name.

**Fix.** In apps/docs/src/lib/api-ref/sdk-map.ts, change the four OVERRIDES to the names the SDKs actually export: line 50 -> `{ method: "voidCredit" }`; line 67 -> `{ ns: ["schedule"], method: "release" }`; line 89 -> `{ method: "catalog" }`; line 94 -> `{ method: "billing" }`. For `DELETE /v1/payment-methods/{id}` the derived CRUD name at line 37 is wrong for this one resource, so add an explicit override alongside the other payment-methods entries (near line 79): `"DELETE /v1/payment-methods/{id}": { method: "remove" },`. Then re-run the resolve check to confirm 75/75.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but scoped too narrowly to Elixir. Because every language renderer in apps/docs/src/lib/api-ref/snippets.ts (lines 196/212/228/244/261/274/293/316/337) interpolates the same `call.method` from sdk-map.ts, these five wrong names propagate to ALL NINE SDK samples on the five affected /reference pages, not just Elixir — verified against the shipped Node SDK (`events.catalog`, `metrics.billing`) and Python SDK (`void_credit`, `remove`, `release`, `catalog`, `billing`), which use the same real names the Elixir SDK does. So the blast radius is ~45 non-compiling samples across 5 reference pages plus a poisoned row in all nine /sdks/<lang>/reference indexes. The fix is five ed
> 
> *…trimmed (457 more chars — see the cited files).*
> Impact is accurate as to mechanism (5 broken Elixir samples on live /reference + /sdks/elixir/reference rows), but "high" overstates it: the failure is a loud UndefinedFunctionError at first run, not silent misbehavior, and touches no money/auth/data path — it costs an integrator minutes, not correctness. Severity is medium. The under-reported angle is that sdk-map.ts is the cross-language SSOT with no CI check against actual SDK exports, so the same five names are likely wrong in the other eight language tabs — the right fix is a name-resolution gate, not five one-line edits.

---

## K13. 🟠 Every Rust `list` snippet omits the required *ListParams argument — 13 ops fail with E0061 (Rust list methods are NOT zero-arg, unlike the other SDKs)

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:340-345 — `const params = body ? [...] : [];` then `const invocation = \`${chain}(${[...pos, ...params].join(", ")}).await?\`;`. `snippetBody()` (snippets.ts:377) returns `undefined` for any op with no request body, so every GET/list op emits ZERO params. Emitted on /reference/customers/list:

    let customers = nombaone.customers().list().await?;

**What the code does**

The real Rust list methods take the params struct BY VALUE and it is NOT optional:
  nombaone-rust/src/resources/customers.rs:268 `pub fn list(&self, params: CustomerListParams) -> Paginator<Customer> {`
  nombaone-rust/src/resources/plans.rs:171   `pub fn list(&self, params: PlanListParams) -> Paginator<Plan> {`
  nombaone-rust/src/resources/plans.rs:213   `pub fn list(&self, plan_id: &str, params: PlanPriceListParams) -> Paginator<Price> {`
  nombaone-rust/src/resources/metrics.rs:81  `pub fn billing(&self, params: BillingMetricsParams) -> ApiCall<BillingMetrics> {`
The correct call is `nombaone.customers().list(CustomerListParams::default()).await?` — exactly as the hand-written guide writes it (content/sdks/rust.mdx:203).

cargo check --offline output over the 75 generated snippets:
    src/main.rs:20:38: error[E0061]: this method takes 1 argument but 0 arguments were supplied
    src/main.rs:235:45: error[E0061]: this method takes 2 arguments but 1 argument was supplied
10 E0061 "method takes N arguments" errors fired on: customers.list, plans.list, prices.list, subscriptions.li

*…trimmed (342 more chars — see the cited files).*

**Impact.** SYSTEMATIC across the whole listing surface. This is a Rust-specific trap the generator cannot see: in Node/Python the params object genuinely IS optional, so the shared `hasBody`-driven emitter produces valid code there and invalid code here. A developer pastes `nombaone.customers().list().await?` and gets E0061 on the very first pagination call they try. Notably `nombaone.webhook_endpoints().list()` (op 60) is the ONE list that is correct — because webhook_endpoints.rs:207 really is `pub fn list(&self) -> Paginator<WebhookEndpoint>` — which makes the failure look random rather than structural.

**Fix.** apps/docs/src/lib/api-ref/snippets.ts — in `rust()` (line 335), when `body` is undefined AND the op returns a paginator (or, simply, when the real Rust method takes a params struct), emit the params struct's `::default()`. Minimal correct change: give `SdkCall` a `listParamsType?: string` (populated in sdk-map.ts for the 14 list ops, `undefined` for `webhookEndpoints.list`) and in `rust()` push `` `${call.listParamsType}::default()` `` into `params` when `!body && call.listParamsType`. Emits `nombaone.customers().list(CustomerListParams::default()).await?`.

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`, `apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding stands as written; only two cosmetic sharpenings, neither of which changes the bug or its severity (the auditor actually already flagged both in their body text, so this is precision rather than correction):
> 
> 1. Arity count: 13 ops emit an arity-mismatched Rust call (customers.list, plans.list, plans.prices.list, prices.list, subscriptions.list, subscriptions.list_events, subscriptions.dunning.list_attempts, payment_methods.list, invoices.list, coupons.list, settlements.list, events.list, webhook_endpoints.deliveries.list). Only 10 surface as E0061 in a real `cargo check` today, because 3 of them (plans.prices.list, webhook_endpoints.deliveries.list, subscriptions.dunning.list_at
> 
> *…trimmed (1296 more chars — see the cited files).*
> The bug and its production reachability are accurate (live docs.nombaone.xyz/reference/* Rust tab + MCP mirror, shipped crates.io SDK). Only the severity is overstated: it is a compile-time, fail-loud docs defect with the correct usage published on the same site (content/sdks/rust.mdx:203), touching no money/auth/data path — medium, not high. It is also not independently user-blocking, since the finding notes E0615/E0599 already abort the same Rust snippets first; it should be fixed as part of that cluster. Fix belongs in rust() (snippets.ts:333-352): emit `${paramsType}::default()` when body is undefined for params-taking ops, with webhook_endpoints.list as the known genuinely-zero-arg exce
> 
> *…trimmed (6 more chars — see the cited files).*

---

## K14. 🟠 Go snippets assign bare literals to optional fields the SDK types as pointers — the SDK's own `nombaone.String/Int/Set` helpers are never used in any of the 75 samples

**What we publish**

snippets.ts:285-289 `goFields()` renders every value with `lit(v, "go", ...)` — a raw literal. Emitted for PATCH /v1/customers/{id}: `nombaone.CustomerUpdateParams{ Name: "Ada Lovelace", Phone: "+2348012345678", }`. Also `Quantity: 1` and `MaxDays: 0` and `Comment: "string"` and `Description: "Pro plan — monthly"` and `MaxRedemptions: 0` and `Disabled: false` and `AmountInKobo: 250000` (on refund).

**What the code does**

Optional fields in the Go SDK are pointers so that unset stays distinct from zero. /Users/mac/Vault/the-60/nombaone/nombaone-go/customers.go:75-80: `type CustomerUpdateParams struct { Name *string `json:"name,omitempty"` ... Phone *Optional[string] `json:"phone,omitempty"` }`. subscriptions.go:275-278: `Quantity *int`. invoices.go:74-76: `Comment *string`. settlements.go:109-112: `AmountInKobo *Kobo`. The SDK ships the exact helpers for this at params.go:17-27 (`func String(v string) *string`, `func Int(v int) *int`, `func Int64(v int64) *int64`, `func Bool(v bool) *bool`) and params.go:45-49 (`Set[T]`/`Null[T]` for the `*Optional[T]` nullable fields) — and go.mdx:119-121 tells readers to use them. No generated snippet does. Compiler: `cannot use "Ada Lovelace" (untyped string constant) as *string value in struct literal`; `cannot use "+2348012345678" (untyped string constant) as *nombaone.Optional[string] value in struct literal`; `cannot use 1 (untyped int constant) as *int value in struct literal`.

**Impact.** 11 operations' Go samples fail to build on the pointer-vs-value mismatch. Worse for credibility: the pointer/`nombaone.String()` idiom is the single Go-specific ergonomic the SDK invested in and the guide advertises — and the auto-generated reference, which is the surface most developers actually copy from, contradicts it 75 times out of 75.

**Fix.** In `goFields()` (snippets.ts:285-289), wrap values for optional fields: `nombaone.String("…")` for `*string`, `nombaone.Int(n)` for `*int`, `nombaone.Int64(n)` for `*Kobo`, `nombaone.Bool(b)` for `*bool`, and `nombaone.Set("…")` for the `*Optional[T]` nullable fields (customerUpdate.phone, planUpdate.description). Required fields (`op.bodyFields[].required`) stay bare — the OpenAPI model already carries `required`, so this is a mechanical branch, not a hand-maintained list.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but undercounts the blast radius: 13 operations (not 11) emit Go samples that fail to compile on pointer-vs-value — PATCH /v1/customers/{id}, PATCH /v1/plans/{id}, PATCH /v1/subscriptions/{id}, POST /v1/subscriptions/{id}/pause, /cancel, /change, /resubscribe, /payment-method, PATCH /v1/coupons/{id}, POST /v1/settlements/{id}/refund, PATCH /v1/webhooks/{id}, PUT /v1/organization, PUT /v1/organization/billing. Create-style operations (customers/plans/mandates/payment-methods create, grant-credit, apply-discount) are NOT affected by this particular defect because their required fields are genuine value types (string/Kobo/named enum types), so "75 out of 75 samples are br
> 
> *…trimmed (801 more chars — see the cited files).*
> The mechanism and reachability hold, but the impact count is inflated. goFields() never wraps values, so every Go sample field is a bare literal — but only the samples that actually include optional (pointer-typed) fields fail to compile (~11 operations, matching the finding's own operation count). Samples whose bodies contain only required value-typed fields (e.g. Email/Name on customer create, PriceID/CustomerID on subscription create, payout AmountInKobo which is a non-pointer Kobo) compile fine. So "75 out of 75 samples fail to build" is wrong; "75 out of 75 samples never use the SDK's pointer helpers" is right, and that is a style/credibility claim, not a build-breakage claim. Also note
> 
> *…trimmed (371 more chars — see the cited files).*

---

## K15. 🟠 Go snippets emit `CustomerId`/`PriceId`/`Url` — the SDK uses Go initialisms `CustomerID`/`PriceID`/`URL`, so 8 struct literals reference fields that do not exist

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:287 `.map(([k, v]) => `\t\t${pascal(k)}: ${lit(v, "go", "\t\t")},`)` with `pascal()` at snippets.ts:60-62 only upper-cases the leading char, so wire key `customerId` becomes `CustomerId`. Emitted for POST /v1/subscriptions: `nombaone.SubscriptionCreateParams{ CustomerId: "nbo000000000001cus", PriceId: "nbo000000000001prc", }`. Also `Url:` (POST/PATCH /v1/webhooks), `CallbackUrl:` (POST /v1/payment-methods/setup), `DefaultPaymentMethodId:` (PATCH /v1/subscriptions/{id}), `PaymentMethodId:` (POST .../resubscribe).

**What the code does**

The Go SDK follows Go initialism convention. /Users/mac/Vault/the-60/nombaone/nombaone-go/subscriptions.go:197-204: `type SubscriptionCreateParams struct { CustomerID string `json:"customerId"` ... PriceID string `json:"priceId"` }`. webhookendpoints.go:73-74: `type WebhookEndpointCreateParams struct { URL string `json:"url"` }`. paymentmethods.go:68-75: `CallbackURL string `json:"callbackUrl"``. Compiler: `unknown field CustomerId in struct literal of type nombaone.SubscriptionCreateParams, but does have CustomerID` and `unknown field PriceId ... but does have PriceID`.

**Impact.** This is Go-ONLY (no other SDK has the ID/URL initialism rule) and it hits the two most important money calls in the product: creating a subscription and registering a webhook endpoint. The developer's first `client.Subscriptions.Create` copy-paste does not build. Go's compiler is unusually helpful here ('but does have CustomerID'), so it is recoverable — but the reference is emitting a call that has never been compiled once.

**Fix.** Add a Go initialism transform used only by `go()`/`goFields()` in snippets.ts: after `pascal(k)`, rewrite trailing/embedded initialisms — `Id`→`ID`, `Url`→`URL`, `Ref` is fine — matching the SDK's actual exported field names. Minimum map from the real structs: customerId→CustomerID, priceId→PriceID, paymentMethodId→PaymentMethodID, defaultPaymentMethodId→DefaultPaymentMethodID, url→URL, callbackUrl→CallbackURL.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and slightly understated. Accurate version: snippets.ts's Go renderer (goFields, lines 285-289) uses the generic `pascal()` (lines 60-62), which has no Go-initialism rule, so it emits 11 non-existent struct fields across 10 operations — POST /v1/payment-methods/setup (CallbackUrl vs CallbackURL); POST /v1/subscriptions (CustomerId, PriceId); PATCH /v1/subscriptions/{id} (DefaultPaymentMethodId); POST /v1/subscriptions/{id}/resubscribe (PriceId, PaymentMethodId); POST /v1/subscriptions/{id}/change (PriceId); POST /v1/subscriptions/{id}/schedule (PriceId); POST /v1/webhooks (Url); PATCH /v1/webhooks/{id} (Url); POST /v1/sandbox/payment-methods (CustomerId). Additionally,
> 
> *…trimmed (557 more chars — see the cited files).*
> The finding is factually right and reachable in production, but "high" overstates it. The failure mode is a compile-time error with a self-describing message, on one language tab of the docs site — zero runtime, money, auth, or data risk. It is a deterministic docs-correctness/DX defect (every body-carrying Go snippet with an Id/Url key is wrong, because the bug is in the goFields emitter, not in 8 individual samples), which is medium. Fix belongs in pascal()/goFields() with a go-build CI gate over generated snippets.

---

## K16. 🟠 Java SDK ships a stale spec and cannot express the `minute` billing interval at all — the docs document it, the API accepts it, Node supports it, `PriceInterval` has no `MINUTE` constant and there is no String escape hatch

**What we publish**

apps/docs/content/guides/create-plans-and-prices.mdx:67-71 — "`interval` is one of `minute`, `day`, … and `interval: "minute"` with `intervalCount: 10` bills every ten minutes." The API agrees: apps/docs/src/generated/openapi.json, POST /v1/plans/{id}/prices → `interval.enum = ["day","week","month","year","minute"]`, and packages/core-contracts/src/billing/interval.ts:35 `export const PRICE_INTERVALS = ['day', 'week', 'month', 'year', 'minute'] as const;`. apps/docs/content/sdks.mdx:8 promises every SDK wraps "the same API — so a subscription you create in Go behaves exactly like one you [create anywhere else]".

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/prices/PriceInterval.java:7-12 —
```
public enum PriceInterval {
  DAY("day"),
  WEEK("week"),
  MONTH("month"),
  YEAR("year"),
  UNKNOWN("unknown");
```
No MINUTE. And the only setter is prices/PriceCreateParams.java:49 `public Builder interval(PriceInterval interval) {` — there is no `interval(String)` overload, so a Java caller literally cannot send `"minute"`; the closest they can do is `PriceInterval.UNKNOWN`, whose `@JsonValue` serializes to `"unknown"` → 422. Root cause: the SDK's vendored /Users/mac/Vault/the-60/nombaone/nombaone-java/spec/openapi.json has `interval.enum = ["day","week","month","year"]` — it predates the `minute` migration. This is Java-specific: /Users/mac/Vault/the-60/nombaone/nombaone-node/src/resources/prices.ts:17 has `export type PriceInterval = 'day' | 'week' | 'month' | 'year' | 'minute';`.

**Impact.** A Java merchant cannot create a sub-day-cadence price at all — the feature the docs advertise in a dedicated callout is unreachable from the JVM. Reading is broken too: a `minute` price created in the console or by another SDK deserializes into Java as `PriceInterval.UNKNOWN`, so a Java service reconciling the catalog silently misclassifies it. The `/sdks` parity matrix shows Java as at-parity, so nobody is warned.

**Fix.** Add `MINUTE("minute")` to /Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/prices/PriceInterval.java (between YEAR and UNKNOWN), re-vendor spec/openapi.json from the current API build so OpenApiConformanceTest actually guards this, and cut 0.1.1. Until it ships, either add a `minute` row to the parity matrix caveats in apps/docs/content/sdks.mdx or note it under "The honest hard parts" in apps/docs/content/sdks/java.mdx:307-338.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-java/src/main/java/xyz/nombaone/prices/PriceInterval.java`, `/Users/mac/Vault/the-60/nombaone/nombaone-java/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/java.mdx`

> **Refuter's correction — re-scopes this finding:**
> The Java SDK genuinely cannot express the `minute` billing interval — that part is fully confirmed. `PriceInterval` (nombaone-java/src/main/java/xyz/nombaone/prices/PriceInterval.java:7-12) has no MINUTE constant, `PriceCreateParams.Builder.interval(PriceInterval)` (line 49) is the only setter in the entire SDK, the record's canonical constructor is likewise PriceInterval-typed, and there is no @JsonAnySetter/extraParams/raw-body hatch — `PlanPrices.create` hands the record straight to Jackson. Root cause is the stale vendored spec (nombaone-java/spec/openapi.json: interval.enum = ["day","week","month","year"]) versus the live contract (packages/core-contracts/src/validations/price.ts:14 -> 
> 
> *…trimmed (1934 more chars — see the cited files).*
> Two corrections. (1) SCOPE: the finding calls this "Java-specific" — it is not. All eight non-Node SDKs ship the stale vendored spec (verified: go/python/php/ruby/rust/dotnet/elixir/java all have Price.interval.enum = ["day","week","month","year"]; only nombaone-node has "minute"). Java is merely the only one where the drift becomes a HARD block, because its PriceInterval is a closed Jackson enum with no interval(String) overload. Go (type PriceInterval string), .NET (public required string Interval), Python (interval: str) and Rust (open_string_enum! with an Other variant) all have a String escape hatch, so they are missing a named constant but can still send "minute". The real defect is fl
> 
> *…trimmed (822 more chars — see the cited files).*

---

## K17. 🟠 Nine SDKs are PUBLISHED and immutable — every SDK-touching fix in the list must be collapsed into ONE coordinated release, not shipped as it is found

**What we publish**

The list contains ~12 separate SDK-side fixes: the webhook verifier (all 9), EXAMPLE_NOT_FOUND in the error enum (all 9), example.created/settled in Node's WebhookEvent union, the missing API_KEY_HOST_MISMATCH constant (node/go/java/python), `prices[]` on plans.create (all 9), the `minute` interval (Java's closed enum blocks it entirely), `dunning_intervals_hours` typed as int-not-float (python/go/rust/dotnet — a RUNTIME pydantic/serde failure, not just a type hint), `maxDays` auto-resume doc lies, the wrong @throws classes, the stale registry.ts version pin, and re-vendoring spec/openapi.json into all nine.

**What the code does**

@nombaone/node is at `latest: 0.1.4` on npm; xyz.nombaone:nombaone 0.1.0 is on Maven Central (immutable — you can only publish over it); nombaone 0.1.0 is on PyPI and Hex; NombaOne 0.1.0 is on NuGet. The vendored specs are all stale (nombaone-node/spec/openapi.json still has localhost servers, /v1/examples, and no `prices` on POST /v1/plans). Some of these are BREAKING (removing types from Node's exported WebhookEvent union; changing Java's PriceInterval enum; changing the webhook verifier's scheme), so they are 0.2.0-class, not patches.

**Impact.** Shipping these one at a time means up to a dozen coordinated releases across six package registries, with apps/docs/src/lib/sdks/registry.ts version pins drifting behind each one (it already pins node at 0.1.3 while npm serves 0.1.4). Every intermediate release leaves the SDKs partially wrong.

**Fix.** Freeze SDK releases until the OpenAPI batch (item 3) and the webhook-scheme decision (item 1) have landed server-side. Then cut ONE 0.2.0 across all nine, in this order:
1. Land the server/spec changes and regenerate the spec.
2. Re-vendor spec/openapi.json into all nine repos AND update each conformance suite's EXCLUDED list in the same commit (nombaone-node/test/conformance/openapi-coverage.test.ts:229-232 asserts excluded entries still exist in the spec — a stale exclusion FAILS the suite).
3. Apply the code changes per SDK: webhook verifier (if Path B), error-enum add/remove, `prices[]` on plans.create, `minute` on the closed enums (Java PriceInterval, and check .NET/Rust/Go), `dunning_intervals_hours` → float/Sequence[float] (this is a RUNTIME crash on read today, not cosmetic — fix apps/api/src/shared/openapi/responses.ts:303 `arr(int())` → a number type FIRST or the regenerated sp

*…trimmed (535 more chars — see the cited files).*

**Files.** `apps/api/src/shared/openapi/responses.ts`, `apps/docs/src/lib/sdks/registry.ts`, `apps/docs/scripts/check-sdks.ts`, `apps/docs/src/lib/api-ref/sdk-map.ts`

---

## K18. 🟠 Params type is derived from the URL resource, not the SDK sub-namespace — nested creates get a REAL but WRONG type (`Plans.Prices.Create` gets `PlanCreateParams`)

**What we publish**

`apps/docs/src/lib/api-ref/snippets.ts:295`: `const paramsType = `${singularPascal(op.resource)}${pascal(call.method)}Params`;` — the type name is built from `op.resource` (the URL's top-level resource) and ignores `call.namespace`. So for `POST /v1/plans/{id}/prices` (resource `plans`, sdk-map.ts:53 → `ns: ["prices"], method: "create"`) it emits:
```csharp
var plan = await nombaone.Plans.Prices.CreateAsync("nbo000000000001pln", new PlanCreateParams
{
    UnitAmountInKobo = 250000,
    Interval = "day",
});
```
and for `POST /v1/subscriptions/{id}/schedule` (sdk-map.ts:65) it emits `nombaone.Subscriptions.Schedule.CreateAsync("nbo…sub", new SubscriptionCreateParams { PriceId = "nbo…prc" })`.

**What the code does**

`nombaone-dotnet/src/NombaOne/Resources/Plans.cs:136`: `public Task<Price> CreateAsync(string planId, PriceCreateParams parameters, …)` — the type is `PriceCreateParams` (Prices.cs:76), and `PlanCreateParams` (Plans.cs:55) is a *different real type* with a `required Name` and no `UnitAmountInKobo`/`Interval`. `nombaone-dotnet/src/NombaOne/Resources/Subscriptions.cs:512`: `public Task<SubscriptionSchedule> CreateAsync(string subscriptionId, SubscriptionScheduleCreateParams parameters, …)` — not `SubscriptionCreateParams` (which has a `required CustomerId`). `dotnet build` against the real SDK:
- `error CS9035: Required member 'PlanCreateParams.Name' must be set in the object initializer`
- `error CS0117: 'PlanCreateParams' does not contain a definition for 'UnitAmountInKobo'`
- `error CS0117: 'PlanCreateParams' does not contain a definition for 'Interval'`
- `error CS9035: Required member 'SubscriptionCreateParams.CustomerId' must be set in the object initializer`

**Impact.** This is nastier than a missing type. A missing type gives a clean 'type not found'; here the type *exists*, so the developer is told their **fields are wrong** and a **required field is missing** — sending them hunting through the price schema for a `Name` field that has nothing to do with prices. And `POST /v1/plans/{id}/prices` is not an edge case: it is step 2 of the quickstart and the second call in the .NET guide's own 'Your first subscription' (dotnet.mdx:42). The reference page for the single most-used create in the API ships a .NET sample that cannot compile. The bug is in the shared emitter, so the same wrong-namespace derivation hits the other 8 SDKs' snippets for these 2 ops too.

**Fix.** In `apps/docs/src/lib/api-ref/snippets.ts:295` (and the identical line in the `java` renderer at :317 and `rust` at :338), derive the noun from the SDK call's deepest namespace rather than the URL resource: `const paramsType = `${singularPascal(call.namespace[call.namespace.length - 1]!)}${pascal(call.method)}Params`;`. That yields `PriceCreateParams` for `plans.prices.create` and `ScheduleCreateParams` for `subscriptions.schedule.create` — so also add an explicit override map for the handful of names the SDKs spell differently (`subscriptions.schedule.create` → `SubscriptionScheduleCreateParams`).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The bug is real and confirmed, with three refinements. (1) Scope by language: only the typed-param renderers use `paramsType` — Go (snippets.ts:276), .NET (:295), Java (:317), Rust (:338). The dynamic-language snippets (node/python/ruby/php/elixir) and curl pass an inline dict/JSON and are unaffected, so this hits 4 of 9 SDKs, not "the other 8". (2) Scope by operation: three body-carrying ops have a sub-namespace, not two — `POST /v1/plans/{id}/prices` (emits PlanCreateParams, should be PriceCreateParams), `POST /v1/subscriptions/{id}/schedule` (emits SubscriptionCreateParams, should be SubscriptionScheduleCreateParams), and `PUT /v1/organization/billing` (emits OrganizationUpdateParams, sho
> 
> *…trimmed (517 more chars — see the cited files).*
> The bug is real and production-reachable, but it affects 4 typed-language snippets (Go, Java, Rust, .NET) -- not all 9 SDKs, since the 5 dynamic-language renderers never name a params type -- and only 2 operations (POST /v1/plans/{id}/prices, POST /v1/subscriptions/{id}/schedule), the only `ns`-override ops that carry a body. It surfaces as a compile-time error, not a runtime/money/auth defect, so it is medium, not high. Same-root sibling: resultVar (snippets.ts:358) also derives from op.resource, so the prices snippet names its variable `plan` while it holds a Price. Fix both by deriving the noun from call.namespace.at(-1) instead of op.resource.

---

## K19. 🟠 Ruby quickstart tells you NOMBAONE_API_KEY, then renders a snippet that reads NOMBAONE_SECRET_KEY — first call 401s

**What we publish**

`/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/getting-started/quickstart/ruby.mdx:14` — "Standard library only: `net/http`. Read the key from `ENV['NOMBAONE_API_KEY']`." And `registry.ts:14` — "every SDK reads its key from `NOMBAONE_API_KEY`". The very next line of the page, `quickstart/ruby.mdx:18`, renders the code: `<Snippet method="POST" path="/v1/plans" body={{ name: "Pro" }} idempotent defaultLang="ruby" />`.

**What the code does**

That `<Snippet>` is generated by `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/snippets.ts:132`, which emits: `req["Authorization"] = "Bearer #{ENV['NOMBAONE_SECRET_KEY']}"`. I rendered and ran the exact emitted Ruby: it executes cleanly and builds `Authorization: Bearer ` (empty) because `ENV['NOMBAONE_SECRET_KEY']` is nil. The env var the page just told the reader to set is never read. The `check:sdks` honesty gate at `scripts/check-sdks.ts:87-89` explicitly fails any page that "uses NOMBAONE_SECRET_KEY (every SDK reads NOMBAONE_API_KEY)" — but it only scans `content/`, so the string hiding in `src/lib/snippets.ts` sails through the build gate.

**Impact.** A developer follows the Ruby quickstart literally: exports NOMBAONE_API_KEY as instructed at line 14, copies the code block at line 18, runs it, and gets 401 API_KEY_MISSING on their literal first call to Nomba One. Nothing on the page explains why — the prose and the code disagree, and the code silently sends an empty bearer token instead of erroring. SYSTEMATIC, not isolated: the same wrong env var is hardcoded in the node (`snippets.ts:56`), python (`:75`), go (`:99`) and php (`:107`) emitters of the same file, so all six quickstart pages (`content/getting-started/quickstart/{ruby,node,python,go,php,nextjs}.mdx`) plus `content/getting-started/authentication.mdx` and `content/getting-start

*…trimmed (40 more chars — see the cited files).*

**Fix.** In `apps/docs/src/lib/snippets.ts`, replace `NOMBAONE_SECRET_KEY` with `NOMBAONE_API_KEY` at lines 56, 75, 99, 107 and 132 (5 occurrences, one per language emitter). Then widen the gate: in `apps/docs/scripts/check-sdks.ts` (or `check-style.ts`), also grep `src/lib/**` and `src/components/**` for `NOMBAONE_SECRET_KEY`, not just `content/` — the current gate's blind spot is exactly what let this ship.

**Files.** `apps/docs/src/lib/snippets.ts`, `apps/docs/scripts/check-sdks.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding stands. Accurate version with three amendments:
> 
> (a) GATE SCOPE — the auditor says check-sdks.ts "only scans content/". It is narrower: scripts/check-sdks.ts:81 walks SDK_DIR = content/sdks/** and appends only content/sdks.mdx. Quickstart pages are never scanned at all, so even a hardcoded NOMBAONE_SECRET_KEY inside quickstart/ruby.mdx would pass the gate. Conclusion (nothing catches snippets.ts) is right; the reason is different.
> 
> (b) BLAST RADIUS is 13 pages, not 8. Pages rendering <Snippet>: content/getting-started/{authentication,quickstart}.mdx, content/getting-started/quickstart/{curl,go,nextjs,node,php,python,ruby}.mdx, plus l10n/ha/getting-started/{authentication,quicksta
> 
> *…trimmed (1375 more chars — see the cited files).*
> The defect is real for the node, go, php and ruby emitters (silent empty bearer -> 401). But curl is NOT affected: snippets.ts:23-24 defines KEY = "nbo_sandbox_…" as a literal placeholder, so quickstart/curl.mdx renders correctly. And the python emitter (snippets.ts:75) emits f"Bearer {NOMBAONE_SECRET_KEY}" as a bare Python identifier, not an env read, so that snippet raises NameError before sending a request rather than producing a 401. So it is 4 broken pages via empty-bearer 401, 1 broken via NameError, and 1 (curl) fine.

---

## K20. 🟠 Rust snippets assign bare literals and `"…".into()` to `Option<T>` / `Field<T>` fields — 13 ops fail with E0277/E0308

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:341-343 — `.map(([k, v]) => \`        ${snake(k)}: ${typeof v === "string" ? \`"${v}".into()\` : lit(v, "rust", "        ")},\`)`. Strings become `"x".into()`; numbers and booleans are emitted bare. Emitted on /reference/subscriptions/cancel and /reference/subscriptions/pause:

    nombaone.subscriptions().cancel("nbo000000000001sub", SubscriptionCancelParams {
            mode: "now".into(),
            comment: "string".into(),
            ..Default::default()
        })
    nombaone.subscriptions().pause("nbo000000000001sub", SubscriptionPauseParams {
            max_days: 0,
            ..Default::default()
        })

**What the code does**

Those fields are `Option<T>` / `Field<T>`, and neither has a `From<&str>` or a `From<i64>` impl:
  nombaone-rust/src/resources/subscriptions.rs:381-386 `pub mode: Option<CancelMode>,` … `pub comment: Option<String>,`
  nombaone-rust/src/resources/subscriptions.rs:394 `pub max_days: Option<i64>,`
  nombaone-rust/src/types.rs:106-110 `impl<T> From<T> for Field<T> { fn from(value: T) -> Self { Field::Value(value) } }` — i.e. `Field<String>` is `From<String>`, NOT `From<&str>`.
The hand-written guide gets this right — content/sdks/rust.mdx:140 writes `// phone: "+2348012345678".to_string().into(),`.

cargo check --offline:
    src/main.rs:244:21: error[E0277]: the trait bound `Option<CancelMode>: From<&str>` is not satisfied
    src/main.rs:245:27: error[E0277]: the trait bound `Option<String>: From<&str>` is not satisfied
    src/main.rs:38:33:  error[E0277]: the trait bound `Field<String>: From<&str>` is not satisfied
    src/main.rs:225:19: error[E0308]: mismatched types: expected `Option<i64>`, found integer
10 ops hit E0277 (customers.update, plans.update, subscriptions.update, subs

*…trimmed (247 more chars — see the cited files).*

**Impact.** SYSTEMATIC across every optional-field snippet. Includes money paths: /reference/settlements/refund emits `SettlementRefundParams { amount_in_kobo: 250000 }` against `pub amount_in_kobo: Option<Kobo>` (settlements.rs:171) — a developer trying to issue a partial refund gets E0308 on the amount field. Because these E0277 messages name std traits (`Option<String>: From<&str>`), the developer's instinct is to blame their toolchain, not the docs.

**Fix.** apps/docs/src/lib/api-ref/snippets.ts:341-343 — the emitter needs to know each field's optionality (it already has `op.bodyFields[].required`). Render required strings as `"x".into()`, required scalars bare, and every NON-required field as `Some(...)`: strings `Some("x".to_string())`, numbers/bools `Some(0)` / `Some(false)`, enums `Some(CancelMode::Now)`. For the two `Field<T>` fields (customer `phone`, plan/customer `description`) emit `"x".to_string().into()`.

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The mechanism and the fix are exactly as reported, but the tally is off. Verified via `cargo check --offline` on the generated snippets: 11 distinct ops break, not 13 — E0277 `From<&str>` on customers.update, plans.update, subscriptions.update, subscriptions.cancel, subscriptions.change, subscriptions.resubscribe, subscriptions.update_payment_method, invoices.void, coupons.update; E0308 bare-integer→`Option<i64>` on subscriptions.pause, subscriptions.change, coupons.update, settlements.refund. coupons.create is NOT an instance of this bug — its required `String`/enum fields take `.into()` correctly; it fails on a separate defect (`CouponCreateParams` does not derive `Default`, so `..Default:
> 
> *…trimmed (420 more chars — see the cited files).*
> The bug and its reach are real and systematic across the public /reference/* Rust tab, but the impact is bounded to compile-time failure and developer friction: broken snippets cannot execute, so the "money path" framing (settlements/refund amount_in_kobo) carries no financial risk — an E0308 on the amount field prevents any refund from being issued, wrong or otherwise. Fail-loud + trivially self-diagnosable + smallest-audience SDK means medium, not high. Fix is localized to the rust() renderer at apps/docs/src/lib/api-ref/snippets.ts:341-343 (needs optionality-aware emission: Some(...) for Option<T>, .to_string().into() for Field<String>).

---

## K21. 🟠 SYSTEMATIC: every enum-typed builder argument in the Java snippets is emitted as a String literal — `lit()` has no Java-enum branch, so 5 operations fail with `incompatible types: String cannot be converted to <Enum>`

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:118-120 — `function str(v: string, lang: SnippetLang): string { return lang === "python" || lang === "ruby" || lang === "elixir" ? `"${v}"` : `"${v}"`; }` — every string, including an OpenAPI `enum` value, is emitted as a quoted Java String. Shipped snippets: `.interval("day")` (POST /v1/plans/{id}/prices), `.mode("now")` (POST /v1/subscriptions/{id}/cancel), `.duration("once")` (POST /v1/coupons), `.settlementMode("split_at_collection")` (PUT /v1/organization), `.prorationCreditPolicy("credit_next_cycle")` (PUT /v1/organization/billing).

**What the code does**

Every one of those builder setters takes a typed enum, not a String. javac 17 against the real jar: `Rest.java:15: error: incompatible types: String cannot be converted to CancelMode` and `GenSnippets.java:55: error: incompatible types: String cannot be converted to CouponDuration`. Sources: subscriptions/SubscriptionCancelParams.java:22 `public Builder mode(CancelMode mode) {`; coupons/CouponCreateParams.java:52 `public Builder duration(CouponDuration duration) {`; prices/PriceCreateParams.java:49 `public Builder interval(PriceInterval interval) {`; organization/TenantSettingsUpdateParams.java:30 `public Builder settlementMode(SettlementMode settlementMode) {`; organization/BillingSettingsUpdateParams.java:59 `public Builder prorationCreditPolicy(ProrationCreditPolicy prorationCreditPolicy) {`. There is no String overload on any of them.

**Impact.** Java is the one SDK in the set with no implicit string→enum coercion, so this is a compile error rather than a runtime surprise. Five reference samples — including the price-create sample, which is the very first thing a Java integrator writes — fail to compile on a line that LOOKS right. The correct call is `.interval(PriceInterval.MONTH)`, which the reader can only learn from a different page (the hand-written guide, java.mdx:61, gets it right).

**Fix.** apps/docs/src/lib/api-ref/snippets.ts — in `java()` (line 314), when the body field's schema has an `enum`, emit `EnumName.SCREAMING_SNAKE` instead of a quoted string. `ApiOperation["bodyFields"][number].schema.enum` is already available (model.ts exposes it and `typeLabel` reads it), so: if `schema.enum` is present, render `${enumTypeFor(op, fieldName)}.${value.toUpperCase().replace(/-/g,"_")}` — e.g. `PriceInterval.DAY`, `CancelMode.NOW`, `CouponDuration.ONCE`, `SettlementMode.SPLIT_AT_COLLECTION`, `ProrationCreditPolicy.CREDIT_NEXT_CYCLE`. The SDK's enum constants are exactly the wire value upper-cased (see prices/PriceInterval.java:8-12).

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate as written. Two refinements worth carrying into the fix:
> 
> (1) ROOT CAUSE IS DEEPER THAN `str()`. Patching `str()` alone cannot fix this: the `Body` handed to the renderers is a bag of raw JSON sample values (built by `snippetBody`/`fieldSample`) with no enum metadata attached, so `lit()` has no way to distinguish an enum value from a free-form string. The fix requires plumbing the field schema (or a marker such as `{__enum: "PriceInterval", value: "day"}`) from `snippetBody` into `lit()`, then emitting `PriceInterval.DAY` for the `java` lang only — e.g. `.interval(PriceInterval.DAY)`, `.mode(CancelMode.NOW)`, `.duration(CouponDuration.ONCE)`, `.settlementMode(Settleme
> 
> *…trimmed (460 more chars — see the cited files).*
> Two corrections, one widening and one narrowing.
> 
> WIDER THAN CLAIMED — the count is wrong. The finding says 5 operations; the real number is ~11. `requestExample` (samples.ts:102-113) emits EVERY property in the request body, not just required ones — it merely sorts required-first. So every enum-typed body field in the spec becomes a Java String literal. Full list: POST /v1/customers/{id}/credit (source); POST /v1/plans/{id}/prices (interval, usageType, billingScheme — three enums in one op); POST /v1/mandates (frequency); POST /v1/subscriptions (collectionMethod); POST /v1/subscriptions/{id}/cancel (mode); POST /v1/subscriptions/{id}/change (prorationBehavior); POST /v1/subscriptions/{id}/s
> 
> *…trimmed (1273 more chars — see the cited files).*

---

## K22. 🟠 Six SDK method names in the generated Java index/snippets do not exist on the Java client (adding the exact Java call sites and the `paymentMethods.delete` twist)

**What we publish**

apps/docs/src/lib/api-ref/sdk-map.ts OVERRIDES + CRUD_METHOD produce these Java calls, shipped on /sdks/java/reference and in the reference snippets: `nombaone.customers().voidCreditGrant(id, grantId)` (line 50), `nombaone.subscriptions().schedule().cancel(id)` (line 67), `nombaone.paymentMethods().delete(id)` (CRUD_METHOD line 37), `nombaone.events().retrieveCatalog()` (line 89), `nombaone.metrics().retrieveBilling()` (line 94), `nombaone.invoices().void(...)` (line 78, covered separately).

**What the code does**

javac 17 against nombaone-0.1.0.jar, all packages star-imported: `error: cannot find symbol — method voidCreditGrant(String,String)`; `error: cannot find symbol — method cancel(String)`; `error: cannot find symbol — method retrieveCatalog()`; `error: cannot find symbol — method retrieveBilling()`. The real names: customers/Customers.java:183 `public CreditGrant voidCredit(String id, String grantId) {`; subscriptions/SubscriptionSchedules.java:57 `public SubscriptionSchedule release(String subscriptionId) {`; events/Events.java:64 `public Map<String, EventCatalogEntry> catalog() {`; metrics/Metrics.java:26 `public BillingMetrics billing() {`. NEW SPECIFIC, Java-only: `paymentMethods().delete(id)` produces a *different and more confusing* error than the others — `GenSnippets.java:45: error: method delete in class AbstractResource cannot be applied to given types;` — because the SDK's internal base class `xyz.nombaone.internal.AbstractResource` has a protected `delete(...)` HTTP helper that the compiler resolves to first. So instead of an honest "no such method", the developer gets an a

*…trimmed (182 more chars — see the cited files).*

**Impact.** Six methods listed in the Java method reference — the page whose entire purpose is "Every method in the SDK" (reference.mdx:8) — do not exist. A developer trying to void a credit grant, release a schedule, detach a payment method, read the event catalog, or read billing metrics from Java is sent to a method that isn't there, with no hint of the real name anywhere on the page. The `delete`→`AbstractResource` misdirection is the worst of them.

**Fix.** apps/docs/src/lib/api-ref/sdk-map.ts — carry per-language method overrides on `SdkCall` (same mechanism as the `void`→`voidInvoice` fix) and set for java: `voidCreditGrant`→`voidCredit` (line 50), `schedule.cancel`→`schedule.release` (line 67), `delete`→`remove` for the `payment-methods` resource (CRUD_METHOD, line 37), `retrieveCatalog`→`catalog` (line 89), `retrieveBilling`→`billing` (line 94). Both consumers must read it: snippets.ts:316 (`java()`) and src/components/mdx/sdk-method-index.tsx:92 (`signature(...)`). If instead you decide the SDK should conform to the docs, rename the six Java methods and cut 0.2.0 — but do not leave them disagreeing.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct as stated but UNDERSTATES the blast radius: it is not a Java-only bug. sdk-map.ts is the single shared source for all nine SDK reference pages and all reference snippets, and at least `voidCreditGrant` is wrong for every language — the Node SDK (nombaone-node/src/resources/customers.ts:259) is also `voidCredit`, not `voidCreditGrant`. The Java compile only makes the drift *provable*; the same wrong names render on /sdks/{node,python,go,php,ruby,dotnet,rust,elixir}/reference in their respective casings. The correct fix is upstream in sdk-map.ts (voidCreditGrant→voidCredit, schedule.cancel→schedule.release, invoices.void→voidInvoice, events.retrieveCatalog→catalog, metri
> 
> *…trimmed (464 more chars — see the cited files).*
> The finding is accurate as to reachability — these names ship on the public /sdks/java/reference page, in the Java tab of every API-reference snippet, and in the .md mirror consumed by the docs MCP/Ask-AI. But the severity should be medium, not high: all six failures are compile-time errors surfaced instantly by javac/the IDE (with autocomplete revealing the correct name), not runtime, money, or auth defects. The `paymentMethods().delete(id)` → `AbstractResource.delete` arity misdirection is the only item with meaningfully higher diagnosis cost. Also: because sdk-map.ts is language-neutral, these six entries are probably wrong for the other eight SDKs as well — fix the map, then re-audit per
> 
> *…trimmed (10 more chars — see the cited files).*

---

## K23. 🟠 The Go guide's headline auto-pager sample does not compile — it chains `.All(ctx)` onto a two-value return, and contradicts its own prose three lines above

**What we publish**

apps/docs/content/sdks/go.mdx:148-155: `// Every item across every page — a Go 1.23 range-over-func iterator` / `for inv, err := range client.Invoices.List(ctx, nombaone.InvoiceListParams{}).All(ctx) {`

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-go/invoices.go:105 `func (s *InvoicesService) List(ctx context.Context, params InvoiceListParams, opts ...RequestOption) (*Page[Invoice], error)` returns TWO values; pagination.go:90 `func (p *Page[T]) All(ctx context.Context) iter.Seq2[T, error]` is a method on `*Page[T]`. Go forbids selecting a method on a multi-value call. Compiled against the real SDK (go1.23.4): `./p.go:14:24: multiple-value client.Invoices.List(ctx, nombaone.InvoiceListParams{}) (value of type (*nombaone.Page[nombaone.Invoice], error)) in single-value context`. The same file states the correct signature at go.mdx:134-135 — "every `List` returns `(*nombaone.Page[T], error)`" — so the page refutes itself.

**Impact.** Auto-pagination is the feature the guide sells hardest (it is in the page description: "range-over-func pagination"). Every Go developer who wants to iterate all invoices copies these 6 lines and gets a compile error that does not obviously point at the fix. This is the only non-compiling sample in the hand-written guide — I compiled the other four (first-subscription, errors, webhooks, sandbox) and all pass — which makes it a genuinely isolated defect, not a systemic one.

**Fix.** apps/docs/content/sdks/go.mdx:150 — split the call: `page, err := client.Invoices.List(ctx, nombaone.InvoiceListParams{})` / `if err != nil { return }` / `for inv, err := range page.All(ctx) {`. (Alternatively add a `ListAll` convenience to the SDK, but the docs must not claim one that does not exist.)

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/go.mdx`

> **Refuter's correction — re-scopes this finding:**
> The finding is CORRECT and reproducible, but understates its blast radius and overstates its severity.
> 
> ACCURATE VERSION: The `.All(ctx)` auto-pager is documented as if `List` returned a single `*Page[T]`, but it returns `(*Page[T], error)`. Go forbids selecting a method on a multi-value call, so the snippet does not compile. Confirmed by building it against the real SDK (go1.23.4): `multiple-value client.Invoices.List(ctx, nombaone.InvoiceListParams{}) ... in single-value context`.
> 
> BROADER THAN CLAIMED (auditor said "isolated"): the identical broken pattern is also in the SDK's own godoc, which ships to pkg.go.dev, so the docs page is downstream of a wrong godoc. Fix all four sites:
> - apps
> 
> *…trimmed (946 more chars — see the cited files).*
> The finding is accurate about the defect but wrong that it is isolated to the docs. Accurate version: the non-compiling `List(...).All(ctx)` chain appears BOTH at apps/docs/content/sdks/go.mdx:150 AND in the shipped SDK's godoc at /Users/mac/Vault/the-60/nombaone/nombaone-go/invoices.go:98-104 (which renders publicly on pkg.go.dev). The fix is the two-step form already used correctly in the SDK's own README.md:101 and examples/pagination/main.go:40: assign `page, err := client.Invoices.List(ctx, params)`, handle err, then `for inv, err := range page.All(ctx)`. Severity is medium, not high: it fails at compile time (loud, no silent money/auth/runtime damage) and the correct signature is state
> 
> *…trimmed (218 more chars — see the cited files).*

---

## K24. 🟠 The Python webhook test suite fabricates its own signature header, so the scheme mismatch is invisible to CI — and python.mdx's Flask handler 400s every genuine delivery

**What we publish**

apps/docs/content/sdks/python.mdx:244-273 ships a Flask receiver as the copy-paste path: 'event = webhooks.construct_event(request.get_data(), request.headers.get("x-nombaone-signature", ""), os.environ["NOMBAONE_WEBHOOK_SECRET"])' ... 'except WebhookVerificationError: return "bad signature", 400'. registry.ts:91 pins 'webhookHelper: "webhooks.construct_event"'. The SDK's own suite asserts it works: nombaone-python/tests/test_webhooks.py:21 'GOLDEN_HEADER = "t=1751600000,v1=ba56a072beccddbc014a3f72ef1b4a30e2008b61dcbcca4ae2f16c7e4427b374"'.

**What the code does**

That GOLDEN vector is generated BY THE SDK, never captured from the server. Every positive test in tests/test_webhooks.py uses either GOLDEN_HEADER (a t=,v1= string the SDK itself defines) or webhooks.generate_test_header(...) (lines 56, 63, 69, 75, 104, 119, 139), which is src/nombaone/webhooks.py:188 'return f"t={ts},v1={_compute_signature(secret, ts, _to_bytes(payload))}"'. The server sends a BARE HEX digest: packages/sara/src/webhooks/sign.ts:18-19 "createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')", set at packages/sara/src/webhooks/deliver.ts:206 "'x-nombaone-signature': signature". I reproduced a real delivery byte-for-byte and fed it to the shipped SDK: both the plaintext secret and the sha256-derived key raise 'WebhookVerificationError: Malformed X-Nombaone-Signature header — expected "t=<unix>,v1=<hex>".' (webhooks.py:54-56, because _parse_signature_header at webhooks.py:39-57 requires an '=' and a 't' key; a bare hex digest has neither). 226 tests pass and mypy --strict is clean — the suite is entirely self-confirming.

**Impact.** Every genuine webhook delivered to a Python integrator who copied python.mdx:244-273 is rejected with HTTP 400. Not one event is ever processed, and no test in the SDK or the docs can catch it, because the only signature the suite has ever verified is one it wrote itself. This is WHY the known scheme mismatch has survived: there is no test anywhere that crosses the SDK/server boundary.

**Fix.** Add a cross-boundary golden vector generated by the SERVER (packages/sara signWebhookPayload), not by the SDK, to nombaone-python/tests/test_webhooks.py — a bare hex digest of a known body under sha256(plaintext_secret) — and assert construct_event succeeds. It will fail today, which is the point: it pins the contract. Then fix webhooks.py:34-57 to accept the server's actual scheme (or change the server to emit t=,v1=), and update apps/docs/content/webhooks/signing-and-verification.mdx:53-68 and content/getting-started/verify-in-your-devtools.mdx:106-116 to match.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-python/tests/test_webhooks.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/webhooks.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/python.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/webhooks/signing-and-verification.mdx`

> **Refuter's correction — re-scopes this finding:**
> The scheme mismatch is real and the Python Flask handler in python.mdx:254-260 does 400 every genuine delivery — but it is a KNOWN, already-documented divergence, not an undetected bug: apps/docs/content/sdks/ruby.mdx:253-259 ships an explicit "Webhook signature verification is not live yet — the backend still signs outbound deliveries with the legacy bare-hex scheme" callout. The accurate finding is threefold: (1) the server (packages/sara/src/webhooks/sign.ts:18 + deliver.ts:113,206) sends a BARE hex HMAC keyed with sha256(secret), while the docs (webhooks/signing-and-verification.mdx:14) and every SDK implement t=<unix>,v1=<hex> over `${t}.${rawBody}` keyed with the plaintext whsec — so t
> 
> *…trimmed (701 more chars — see the cited files).*
> The finding is true but under-scoped. (a) It is not specific to python.mdx: signing-and-verification.mdx:14 and overview.mdx:21 document the `t=,v1=` scheme, and all 9 SDKs in registry.ts:76-196 implement it, so every SDK and every docs recipe rejects every genuine delivery, not just the Flask snippet. (b) There is a second, independent break: deliver.ts:113 signs with `endpoint.signingSecretHash` (the stored sha256), not the plaintext secret the tenant was shown, so even a client that parses a bare-hex header still cannot reproduce the digest. (c) The self-confirming test suite is the reason this survived, not the bug itself — the bug is the sender/docs wire-contract mismatch; the missing a
> 
> *…trimmed (84 more chars — see the cited files).*

---

## K25. 🟠 The generated /sdks/ruby/reference method index prints 5 method names that raise NoMethodError — proven by running all 75 against the real gem

**What we publish**

`/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/ruby/reference.mdx:13` renders `<SdkMethodIndex lang="ruby" />`, whose source claims at `src/components/mdx/sdk-method-index.tsx:15-17`: "The method *names* come from the shared `sdkCall` map (correct by construction); only the *casing* is applied per language here (a deterministic transform), so nothing is invented." It renders `signature(call.namespace, call.method, "snake")` from `src/lib/api-ref/sdk-map.ts`, whose OVERRIDES declare `voidCreditGrant` (line 50), `{ ns: ["schedule"], method: "cancel" }` (line 67), `retrieveCatalog` (line 89), `retrieveBilling` (line 94), and lets `DELETE /v1/payment-methods/{id}` fall through to `CRUD_METHOD.delete` (line 37).

**What the code does**

I executed all 75 emitted Ruby snippets against the real gem (`/Users/mac/Vault/the-60/nombaone/nombaone-ruby/lib`, Ruby 4.0.1, stubbed transport). Result: OK=70 FAILS=5, all five NoMethodError: `undefined method 'void_credit_grant' for an instance of Nombaone::Resources::Customers`; `undefined method 'cancel' for an instance of Nombaone::Resources::SubscriptionSchedules`; `undefined method 'delete' for an instance of Nombaone::Resources::PaymentMethods`; `undefined method 'retrieve_catalog' for an instance of Nombaone::Resources::Events`; `undefined method 'retrieve_billing' for an instance of Nombaone::Resources::Metrics`. The real names are `customers.rb:154 def void_credit(id, grant_id, ...)`, `subscriptions.rb:41 def release(subscription_id, ...)`, `payment_methods.rb:97 def remove(id, ...)`, `events.rb:41 def catalog(...)`, `metrics.rb:19 def billing(from: OMIT, to: OMIT, ...)`. The SDK is the correct side: `nombaone-ruby/spec/conformance/openapi_coverage_spec.rb` is a bidirectional drift alarm proving every SDK method maps to a spec operation and vice versa.

**Impact.** NEW BLAST RADIUS beyond the already-known snippets.ts issue: these 5 wrong names are also printed as the *canonical method list* on the shipped `/sdks/ruby/reference` page — the page a Ruby developer opens to learn the API surface. They will type `nombaone.metrics.retrieve_billing` / `nombaone.payment_methods.delete(id)` and get a NoMethodError with no hint of the real name. Worse, the `check:sdks` build gate advertises itself (`scripts/check-sdks.ts:3-5`) as proving "the docs can't drift" and prints `OK — 9 SDKs ... identity facts single-sourced`, yet it only checks that the MDX files exist and contain the right component tags — it never resolves a single method name against a real SDK. The

*…trimmed (110 more chars — see the cited files).*

**Fix.** In `apps/docs/src/lib/api-ref/sdk-map.ts`: line 50 → `"DELETE /v1/customers/{id}/credit/{grantId}": { method: "voidCredit" }`; line 67 → `"DELETE /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "release" }`; line 89 → `"GET /v1/events/catalog": { method: "catalog" }`; line 94 → `"GET /v1/metrics/billing": { method: "billing" }`; and ADD a new override `"DELETE /v1/payment-methods/{id}": { method: "remove" }` (do NOT change `CRUD_METHOD.delete` — `webhookEndpoints.delete` is correct and verified). Then add a real check to `apps/docs/scripts/check-sdks.ts`: for each SDK, assert every `sdkCall()` name exists in that SDK's source, so the gate actually proves what its header comment claims.

**Files.** `apps/docs/src/lib/api-ref/sdk-map.ts`, `apps/docs/scripts/check-sdks.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on every material point; only its framing needs a small adjustment. It is NOT a new defect with a new blast radius — it is the SAME single defect (the five entries in sdk-map.ts) surfacing in a SECOND rendered location. Both `src/lib/api-ref/snippets.ts:3` and `src/components/mdx/sdk-method-index.tsx:4` import `sdkCall` from the same `src/lib/api-ref/sdk-map.ts`, so the already-known snippets.ts issue and this method-index issue share one root cause and one fix.
> 
> Precise breakdown of the five: four are wrong OVERRIDE entries (sdk-map.ts:50 `voidCreditGrant` should be `voidCredit`; :67 `{ns:["schedule"],method:"cancel"}` should be `release`; :89 `retrieveCatalog` should
> 
> *…trimmed (618 more chars — see the cited files).*
> Three refinements. (1) The finding is framed as a Ruby issue but the defect is language-agnostic: the same five names are wrong on all nine /sdks/*/reference pages, since sdkCall() is shared and SdkMethodIndex only re-cases it. Verified independently against the Node SDK, which confirms voidCredit / remove / catalog / billing / release as the real names. (2) In the four statically-typed SDKs (Go, Rust, Java, .NET) the consequence is a compile error rather than a runtime NoMethodError — louder still, and further evidence that nothing ships broken. (3) Severity is medium, not high: the failure mode is immediate and self-announcing with zero runtime, money, auth, or data consequence. Fix = corr
> 
> *…trimmed (313 more chars — see the cited files).*

---

## K26. 🟠 The shipped Go SDK leaks the `example.*` reference scaffold into its public API surface: an exported `ErrCodeExampleNotFound` and three `/v1/examples` operations vendored into its spec

**What we publish**

The Go SDK is presented as the production client for the billing API (registry.ts:96-108, published as `github.com/nombaone/nombaone-go` v0.1.0).

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-go/errors.go:114-115 exports the scaffold verbatim, comment included:
	// Example scaffold.
	ErrCodeExampleNotFound ErrorCode = "EXAMPLE_NOT_FOUND"
This is an exported const in the root package — it renders on pkg.go.dev in the `ErrorCode` constant block alongside the ~72 real codes. Additionally, the SDK vendors the scaffold into its shipped spec: `spec/openapi.json` contains `POST /v1/examples`, `GET /v1/examples`, `GET /v1/examples/{id}` (3 of its 83 operations), and conformance_test.go:267-269 explicitly allowlists them:
	"post /v1/examples":     true, // deletable reference scaffold
	"get /v1/examples":      true,
	"get /v1/examples/{id}": true,
so the SDK's own conformance gate SEES the scaffold and passes anyway.

**Impact.** This is placeholder/scaffold content on a published production surface — the exact class the rubric calls critical. A Go integrator browsing pkg.go.dev for the error codes to switch on sees `ErrCodeExampleNotFound` and a literal `// Example scaffold.` comment in the official SDK, which reads as an unfinished library. It also widens the known `/v1/examples` blast radius beyond apps/api and apps/docs into a third artifact that is versioned and published independently — deleting the router will not retract the tagged v0.1.0 module. NOTE the SDK is otherwise clean here: `client.go:32-63` wires 15 namespaces and none of them is an Examples service, so no scaffold *methods* are reachable.

**Fix.** Delete /Users/mac/Vault/the-60/nombaone/nombaone-go/errors.go:114-115 (the comment and the const). Regenerate `spec/openapi.json` after the `/v1/examples` router is removed from apps/api, and delete the conformance_test.go:267-269 allowlist entries so the gate fails if the scaffold ever returns. Cut a v0.1.1 — a published module version cannot be un-shipped.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-go/errors.go`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-go/conformance_test.go`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the `example.*` reference scaffold is shipped as a LIVE part of the production API, not merely "leaked into the Go SDK". apps/api/src/apps/main/server/routes.ts:48 mounts `exampleRouter` on /v1 with no environment gate, and packages/errors/src/codes.ts:212/:330 lists EXAMPLE_NOT_FOUND in PUBLIC_ERROR_CODES. Consequently ALL NINE published SDKs (Go, Node, Python, Ruby, PHP, Java, Rust, .NET, Elixir) correctly vendor the code into their error enums and the three /v1/examples ops into their shipped specs — the Go SDK is one instance of a platform-wide condition, and its spec + conformance allowlist are behaving correctly given the API actually exposes the route. The only Go-sp
> 
> *…trimmed (465 more chars — see the cited files).*
> The facts are accurate but the severity is inflated. This is a cosmetic public-API-surface hygiene issue, not a high. `ErrCodeExampleNotFound` is an inert exported constant — it can only be returned by `/v1/examples`, which the SDK exposes no service for (client.go:32-63), so no integrator code path, error switch, or `errors.As` branch is ever affected. The vendored spec paths are consumed only by the SDK's own conformance test and generate nothing. The sole real cost is credibility on pkg.go.dev (a literal `// Example scaffold.` comment in the official client). The "tagged v0.1.0 is unretractable" argument is weak — the repo has merge-triggered auto-tagging (commit 2bed763), so the fix ship
> 
> *…trimmed (220 more chars — see the cited files).*

---

## K27. 🟠 The shipped NuGet package NombaOne 0.1.0 exposes `NombaoneErrorCodes.ExampleNotFound` documented as "(reference scaffold)" in its public IntelliSense

**What we publish**

The .NET SDK's public, documented error-code surface. `nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs:193-196`:
```csharp
    // ---- Example scaffold ----

    /// <summary>No example resource exists with that id (reference scaffold).</summary>
    public const string ExampleNotFound = "EXAMPLE_NOT_FOUND";
```
The docs point every C# developer straight at this class: `apps/docs/content/sdks/dotnet.mdx:194-196` — "Branch on `ex.Code` — against the `NombaoneErrorCodes` constants (`NombaoneErrorCodes.CustomerNotFound`)".

**What the code does**

This is scaffold, not product. `NombaOne.csproj:8` sets `<GenerateDocumentationFile>true</GenerateDocumentationFile>` and `:15` `<PackageId>NombaOne</PackageId>` / `:16` `<Version>0.1.0</Version>`, and NombaOne 0.1.0 is live on NuGet (I fetched `https://api.nuget.org/v3-flatcontainer/nombaone/index.json` → `{"versions":["0.1.0"]}`). So the XML doc file ships inside the published `.nupkg`, and the literal string "(reference scaffold)" is what Visual Studio / Rider display in the tooltip when a developer types `NombaoneErrorCodes.` and scrolls the completion list. This is the SDK-side twin of the already-confirmed `/v1/examples` + "(reference scaffold)" event-catalog leaks — but it is a **new surface**: it is inside a package already distributed to the public registry, which the previously-established server-side and docs-side findings do not cover.

**Impact.** A paying integrator's autocomplete list, on a production NuGet package, contains a constant whose own documentation admits it is scaffold. It is the single most credibility-destroying thing a developer can see in an SDK — it says 'this library was generated and never reviewed'. Unlike the server routes and docs pages, this one cannot be un-shipped: NuGet versions are immutable, so deleting it requires a 0.1.1 release.

**Fix.** Delete `nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs:193-196` (the `// ---- Example scaffold ----` banner and the `ExampleNotFound` constant), bump `<Version>` in `nombaone-dotnet/src/NombaOne/NombaOne.csproj:16` to `0.1.1`, publish, and bump `version: "0.1.0"` → `"0.1.1"` at `apps/docs/src/lib/sdks/registry.ts` (the `dotnet` entry). Grep the other eight SDK repos for `EXAMPLE_NOT_FOUND` / `ExampleNotFound` — the constant almost certainly leaked into all nine from the same shared code list.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/NombaoneErrorCodes.cs`, `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/NombaOne.csproj`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/sdks/registry.ts`

> **Refuter's correction — re-scopes this finding:**
> The facts are all true and I confirmed them against the published artifact, not just the repo: the shipped nombaone.0.1.0.nupkg contains lib/net8.0/NombaOne.xml with `<member name="F:NombaOne.NombaoneErrorCodes.ExampleNotFound"><summary>No example resource exists with that id (reference scaffold).</summary>`, so the scaffold admission is really in public IntelliSense. But the accurate version is:
> 
> 1. This is NOT a .NET SDK defect — it is one downstream mirror of an upstream one. NombaoneErrorCodes.cs's own header declares the set is "vendored from the platform's PUBLIC_ERROR_CODES set (72 codes)", and packages/errors/src/codes.ts:212 defines EXAMPLE_NOT_FOUND with :330 placing it inside PUBL
> 
> *…trimmed (1228 more chars — see the cited files).*
> Severity is low, not high: the constant is inert (no money/auth/correctness impact) and the remedy is a routine 0.1.1 patch on a pre-1.0 SDK. It is also NOT a .NET-specific "new surface" — EXAMPLE_NOT_FOUND originates in the server SSOT (packages/errors/src/codes.ts:212, hint/docUrl :851-853, public-code allowlist :330) and is mirrored in all nine SDKs (Go errors.go:114-115 even carries a public "// Example scaffold." doc comment that pkg.go.dev renders). Fixing only NombaoneErrorCodes.cs leaves eight other published surfaces leaking it; delete the example slice at the SSOT and re-cut all nine SDKs.

---

## K28. 🟠 `check:sdks`, the build gate that claims to prove the SDK docs cannot drift, never opens a single SDK repo — it is why the fabricated method names and stale version shipped

**What we publish**

apps/docs/src/lib/sdks/registry.ts:12-13 — "Facts are lifted from the shipped SDK repos (the SSOT, `../nombaone-<id>/`) and their briefs". apps/docs/scripts/check-sdks.ts:3-5 — "whose method index is generated from the OpenAPI model. This proves the docs can't drift". apps/docs/src/components/mdx/sdk-method-index.tsx:11-13 — "The method *names* come from the shared `sdkCall` map (correct by construction) ... so nothing is invented" and :12-13 "it can never miss a method the API adds — `check:sdks` proves coverage".

**What the code does**

apps/docs/scripts/check-sdks.ts reads ONLY MDX under apps/docs/content: line 24-25 `const CONTENT = path.join(process.cwd(), "content"); const SDK_DIR = path.join(CONTENT, "sdks");`, lines 59-60 read `content/sdks/<id>.mdx` and `content/sdks/<id>/reference.mdx`, line 81 `listMdx(SDK_DIR)`. There is no `../nombaone-node` path, no `package.json` read, no network call, and no reference to `sdkCall`/`getApiResources` anywhere in the file. Its three assertions are: the MDX files exist; they contain the literal strings `<SdkHeader id="node"` / `<SdkMethodIndex lang="node"`; and they contain the string `NOMBAONE_API_KEY`. It asserts nothing about method names, class names, or versions. Proof of consequence: I generated all 75 node snippets from `buildOperationSnippets()` and type-checked them against the real SDK with the SDK's own TypeScript (`tsc --strict --module nodenext`) — exactly 5 fail: TS2551 `'voidCreditGrant' does not exist on type 'Customers'. Did you mean 'voidCredit'?`, TS2339 `'cancel' does not exist on type 'SubscriptionSchedules'`, TS2339 `'delete' does not exist on type 'P

*…trimmed (175 more chars — see the cited files).*

**Impact.** The gate is decorative, and it is the root cause that let every other SDK-docs defect through. The docs assert to their own maintainers that drift is impossible, so nobody looks — five fabricated method names and a stale pinned version are currently shipping with a green build. Any future SDK rename (e.g. a 0.2.0 that renames `voidCredit`) will ship silently broken snippets on 9 SDK reference surfaces × 75 operations.

**Fix.** Extend /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/scripts/check-sdks.ts with two real assertions. (1) After line 58's `for (const sdk of SDKS)`, read `../../../nombaone-${sdk.id}/package.json` (or the language's manifest) and fail unless its `version` equals `sdk.version` and its `name` equals `sdk.package`. (2) Add a node-specific step that runs `buildOperationSnippets(op).node` for every op from `getApiResources()`, writes them to a temp file, and type-checks against an installed `@nombaone/node` — failing the build on any TS2339/TS2551. Until (2) exists, at minimum fix the five names in apps/docs/src/lib/api-ref/sdk-map.ts (lines 50, 67, 89, 94 and the `paymentMethods` delete derivation) and soften the false claims at sdk-method-index.tsx:11-13 and check-sdks.ts:3-5.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/scripts/check-sdks.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct on every checkable fact. One wording refinement: check:sdks is not literally "decorative" — the three assertions its docblock enumerates (coverage, component integrity, env-var honesty) are honestly implemented and do prevent package names/versions from being retyped into prose. The real defect is narrower and still high-severity: the gate's headline claim ("proves the docs can't drift"), registry.ts:12-13 ("facts are lifted from the shipped SDK repos (the SSOT, ../nombaone-<id>/)"), and sdk-method-index.tsx:11-17 ("correct by construction ... nothing is invented") all assert a verification link to the SDK repos that NO code anywhere establishes. sdkCall (apps/docs/src
> 
> *…trimmed (478 more chars — see the cited files).*
> The gate is not "decorative" — it does enforce page coverage, component wiring, env-var honesty, and registry-id validity. The accurate charge is narrower and still damning: check:sdks verifies the docs against ITSELF (registry.ts + MDX string matching) and never against the nine shipped SDK repos that sit on disk at ../nombaone-<id>/, so no gate in the docs build can catch a wrong method name, class name, or version. The companion gate check-api-ref.ts only asserts snippets are non-empty, not that they compile, so the hand-authored src/lib/api-ref/sdk-map.ts is entirely unverified. Three docstrings are affirmatively false and should be deleted or corrected: check-sdks.ts:3-5 ("proves the do
> 
> *…trimmed (594 more chars — see the cited files).*

---

## K29. 🟠 `var event = …` — the snippet emitter produces a C# reserved keyword, so 2 of 75 .NET samples are not parseable C# at all

**What we publish**

`apps/docs/src/lib/api-ref/snippets.ts:357-362`: `function resultVar(ctx) { const noun = singularPascal(ctx.op.resource); const lc = noun.charAt(0).toLowerCase() + noun.slice(1); if (ctx.op.slug === "list") return `${lc}s`; return lc || "result"; }` — and `:305` `var ${resultVar(ctx)} = await ${invocation};`. For `resource: "events"`, `singularPascal("events") = "Event"` → `lc = "event"`. The emitted .NET snippet for GET /v1/events/{id} is literally:
```csharp
var event = await nombaone.Events.RetrieveAsync("nbo000000000001");
```
and the same for GET /v1/events/catalog.

**What the code does**

`event` is a reserved keyword in C# (it declares an event member). Compiled against the real SDK, that line is not a semantic error — it is a *syntax* error that destroys the parse: `error CS1002: ; expected`, `error CS1031: Type expected`, `error CS1055: An add or remove accessor expected`, `error CS1519: Invalid token '"nbo000000000001"' in class, record, struct, or interface member declaration`. I compiled it against `/Users/mac/Vault/the-60/nombaone/nombaone-dotnet/src/NombaOne/NombaOne.csproj` with `dotnet build` (SDK 8.0.422) and got 17 cascading parse errors from that one line. The legal spelling is `var @event = …`. No other resource noun collides (customer/plan/price/subscription/invoice/coupon/mandate/settlement/webhook/organization/metric are all fine), so the blast radius is exactly 2 ops.

**Impact.** The .NET tabs on /reference/events/retrieve and /reference/events/catalog show code that a C# compiler cannot even tokenize. Pasting it into a file breaks the *whole file*, not just the line — the developer sees a wall of nonsense errors about 'add or remove accessors' with no hint that the real problem is the variable name. This is the single most confusing failure mode in the whole .NET surface.

**Fix.** In `apps/docs/src/lib/api-ref/snippets.ts`, escape C# keywords in the .NET renderer. In `dotnet()` (line 291-307) replace `resultVar(ctx)` at line 305 with a guarded name, e.g. add `const CS_KEYWORDS = new Set(["event","object","string","base","default","params","operator","fixed","lock"]);` and `function csVar(ctx: Ctx) { const v = resultVar(ctx); return CS_KEYWORDS.has(v) ? `@${v}` : v; }`, then emit `var ${csVar(ctx)} = await …`. (Do NOT change `resultVar` globally — `event` is a valid identifier in Node/Python/Go/Ruby/PHP/Rust/Elixir.)

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is technically CORRECT and I confirmed it end-to-end; only the severity is overstated (high -> medium).
> 
> CONFIRMED BY EXECUTION, not by reading:
> - Ran the real emitter (tsx over the actual apps/docs/src/lib/api-ref/model.ts + snippets.ts against the committed src/generated/openapi.json). Result: 75 operations, exactly 2 C#-reserved-keyword result vars. Both are events: `GET /v1/events/{id}` (slug `retrieve`) and `GET /v1/events/catalog` (slug `catalog`), each emitting `var event = await nombaone.Events.RetrieveAsync("nbo000000000001");` / `var event = await nombaone.Events.RetrieveCatalogAsync();`. `GET /v1/events` is safe only because `slug === "list"` takes the `${lc}s` branch 
> 
> *…trimmed (1647 more chars — see the cited files).*
> The finding is accurate on facts and reachability; only the severity and the confusion framing are overstated. It is a fail-loud, docs-only defect on 2 read-only Events endpoints with a one-character fix (`@event`), not a trap that leads to shipped bugs. Fix should be scoped to the `dotnet` renderer (or a per-language reserved-word escape) — `event` is a legal identifier in Java, Rust, Go, Python, Ruby, PHP and Elixir, so a global rename in resultVar would needlessly degrade the other 8 tabs.

---

## K30. 🟠 dunning_intervals_hours is typed list[int] but the API now takes fractional hours — mypy --strict rejects the documented value

**What we publish**

apps/docs/src/generated/openapi.json, PUT /v1/organization/billing: '"dunningIntervalsHours": {"type": "array", "items": {"type": "number", "exclusiveMinimum": true, "minimum": 0}, "minItems": 1}'. That is 'number', not 'integer' — the reference field table for 'Update billing settings' renders it, and fractional hours are exactly what the new minute cadence needs (a 1-minute retry is 0.0167h).

**What the code does**

nombaone-python/src/nombaone/resources/organization.py:110 — 'dunning_intervals_hours: Union[list[int], NotGiven] = NOT_GIVEN,' and the response model at organization.py:34 — 'dunning_intervals_hours: list[int] = []'. The SDK's stale vendored spec still says {'items': {'type': 'integer'}}, which is why nothing flagged it. Proven with the compiler: 'c.organization.billing.update(dunning_intervals_hours=[0.5, 1.5])' under mypy --strict gives 'error: List item 0 has incompatible type "float"; expected "int"  [list-item]' (2 errors).

**Impact.** A typed Python codebase — and python.mdx:20 sells exactly that ('The SDK ships py.typed for complete type hints') — cannot set a sub-hour dunning interval without a '# type: ignore'. The value is sent correctly at runtime (the body is an unvalidated dict), so this is a type-level lie rather than a wire break, but CI turns red on the documented, supported value. The response model is worse: list[int] against a float payload will coerce or reject a fractional interval the org actually has set.

**Fix.** organization.py:110 -> 'dunning_intervals_hours: Union[list[float], NotGiven] = NOT_GIVEN' (and the async twin at organization.py:158ff), and organization.py:34 -> 'dunning_intervals_hours: list[float] = []'. Re-vendor spec/openapi.json in the same change.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/resources/organization.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/spec/openapi.json`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but understated in two ways, and its root cause is misattributed.
> 
> 1) It is NOT merely a type-level lie / CI-red issue. `NombaModel` is a pydantic `BaseModel` and `_client.py:220` does `cast_to.model_validate(envelope.data)`, so the response is validated. A fractional interval raises `ValidationError: Input should be a valid integer, got a number with a fractional part [type=int_from_float]`. Since PUT echoes the settings object back, BOTH `organization.billing.update()` and `organization.billing.retrieve()` throw at runtime for any org with a sub-hour dunning ladder. Reading the endpoint is broken, not just writing it. A `# type: ignore` does NOT fix it (it silences m
> 
> *…trimmed (1020 more chars — see the cited files).*
> The finding's severity and mechanism are both understated. It is not confined to mypy --strict / type-level: the Python response model raises a pydantic ValidationError at runtime (verified: list[int] vs [0.25, 1.5] -> int_from_float error, no coercion), so both organization.billing.retrieve() and organization.billing.update() crash for any org with a fractional interval — including crashing on the successful write's own response. The same runtime break exists in the Go ([]int), Rust (Vec<i64>), and .NET (IReadOnlyList<int>) SDKs. The root cause lives in this repo, not the SDKs: apps/api/src/shared/openapi/responses.ts:303 declares the response field as arr(int()) even though packages/core-c
> 
> *…trimmed (251 more chars — see the cited files).*

---

## K31. 🟠 nombaone 0.1.0 cannot send prices[] on plan create — the headline flow of the #1 guide; its vendored spec is stale so the SDK's own drift alarm is blind

**What we publish**

apps/docs/content/guides/create-plans-and-prices.mdx:13 '## Create a plan and its prices in one call'; :26 '"prices": ['; :36 'The call is **atomic**: either the plan and every price land, or nothing does.' The generated spec agrees: apps/docs/src/generated/openapi.json POST /v1/plans requestBody has 'prices': {'type':'array',...}. And apps/docs/content/sdks/python/reference.mdx:13 '<SdkMethodIndex lang="python" />' maps POST /v1/plans to plans.create for Python. Server confirms: apps/api/src/apps/main/modules/plans/controllers/create-plan.ts:14-15 'POST /v1/plans — create a plan, optionally WITH the prices it launches at (`prices: [...]`, atomic: every row lands or none does).'

**What the code does**

nombaone-python/src/nombaone/resources/plans.py:192-216 — 'def create(self, *, name: str, description=NOT_GIVEN, metadata=NOT_GIVEN, options=None) -> Plan:' with plans.py:213 'body={"name": name, "description": description, "metadata": metadata},'. No prices parameter. Proven by execution: Nombaone('nbo_sandbox_x').plans.create(name='Pro', prices=[...]) -> 'TypeError: Plans.create() got an unexpected keyword argument prices'. Root cause: nombaone-python/spec/openapi.json POST /v1/plans requestBody is {properties: name/description/metadata, required:[name], additionalProperties:false} — no prices — and nombaone-python/tests/test_conformance.py:25 loads that stale snapshot ('_SPEC = json.loads((_ROOT / "spec" / "openapi.json").read_text("utf-8"))'), so the drift alarm cannot see it. I diffed both specs: identical 83-op surface, but 3 path definitions drift (/v1/plans, /v1/plans/{id}/prices, /v1/organization/billing).

**Impact.** A Python integrator following the first guide in the Guides section cannot perform the flow it teaches — they get a TypeError, fall back to plans.create() + N x plans.prices.create(), and lose the exact guarantee the guide sells ('A rejected price never creates a half-built plan'). A rejected 2nd price now leaves a live plan with one price. The SDK README:188 further claims 'every operation in the API reference, 1:1', which is now false.

**Fix.** 1) plans.py:192 — add 'prices: Union[list[Mapping[str, Any]], NotGiven] = NOT_GIVEN' to Plans.create (and AsyncPlans.create, plans.py:289) and add '"prices": prices' to the body dict at plans.py:213 and :302. 2) Re-vendor nombaone-python/spec/openapi.json from the live API so test_conformance.py sees the real contract. 3) Release 0.1.1 and bump apps/docs/src/lib/sdks/registry.ts:85 version '0.1.0' -> '0.1.1'. If no release is possible now, add a Callout to create-plans-and-prices.mdx saying the one-call form is HTTP-only until SDK 0.1.1.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/resources/plans.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/spec/openapi.json`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/sdks/registry.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/guides/create-plans-and-prices.mdx`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: The nombaone API gained an atomic `prices[]` array on POST /v1/plans (commit 1c9eca4; apps/api/src/apps/main/modules/plans/controllers/create-plan.ts -> createPlanWithPrices, gated on prices:write) and apps/docs shipped it as the headline of the #1 guide plus the generated OpenAPI. NONE of the nine published SDKs can send it: all nine vendored snapshots (nombaone-{python,node,go,ruby,php,java,dotnet,elixir,rust}/spec/openapi.json) still describe POST /v1/plans as name/description/metadata with additionalProperties:false, and the generated clients match — nombaone-python's Plans.create raises TypeError on prices=, nombaone-node's PlanCreateParams has no prices field. Python 
> 
> *…trimmed (910 more chars — see the cited files).*
> Three corrections. (1) SCOPE IS WIDER: this is not Python-specific — all nine SDKs (python, node, go, ruby, php, java, rust, elixir, dotnet) ship a vendored spec whose POST /v1/plans body is ['name','description','metadata'] and typed params to match (e.g. nombaone-node/src/resources/plans.ts:26-30 PlanCreateParams has no `prices`). The false 'API reference, 1:1' README claim therefore applies to every SDK, and the conformance gate is blind in every SDK, not just Python. (2) FAILURE IS LOUD, NOT SILENT: the integrator gets an immediate TypeError/compile error at integration time and the same guide documents the working two-step fallback, so nobody is blocked from shipping and no already-live
> 
> *…trimmed (595 more chars — see the cited files).*

---

## K32. 🟡 /sdks/go/reference promises "Every method in the SDK" but the generated index silently omits the entire `client.Sandbox` namespace (3 public methods)

**What we publish**

apps/docs/content/sdks/go/reference.mdx:8-13: "Every method in `github.com/nombaone/nombaone-go`, grouped by the namespace you reach it through on the client (`client.Customers.Create`, `client.Plans.Prices.Create`, and so on)." The page body is exactly `<SdkMethodIndex lang="go" />` (reference.mdx:15), whose own docstring at src/components/mdx/sdk-method-index.tsx:11-13 claims it is "Built from the same OpenAPI model as the reference … so it can never miss a method the API adds — `check:sdks` proves coverage."

**What the code does**

The index is driven by `getApiResources()`, which deliberately drops sandbox: apps/docs/src/lib/api-ref/model.ts:135-136 `* scaffold paths (`health`, `openapi.json`, `examples`, `sandbox`) are covered * elsewhere (sandbox toolkit) and deliberately excluded.` I dumped all 75 emitted operations: they span exactly 13 resources (coupons, customers, events, invoices, mandates, metrics, organization, payment-methods, plans, prices, settlements, subscriptions, webhooks) — zero sandbox. But the Go SDK exposes Sandbox as a first-class namespace: client.go:60-61 `// Sandbox holds the sandbox-only simulation instruments.` / `Sandbox *SandboxService`, with sandbox.go:91 `CreatePaymentMethod`, sandbox.go:112 `AdvanceCycle`, sandbox.go:136 `SimulateWebhook`.

**Impact.** The Go guide leans on `client.Sandbox.CreatePaymentMethod` in its very first runnable sample (go.mdx:73) and devotes a section to the namespace (go.mdx:268-301), then sends the reader to a "Method reference — Every method in the SDK" page (go.mdx:339) where those three methods do not appear. A developer looking up the `AdvanceCycle` signature or the `Behavior` enum in the reference concludes it does not exist. The `check:sdks` gate passes (I ran it: "OK — 9 SDKs, each with a guide + generated reference"), so nothing flags the gap.

**Fix.** Either (a) stop excluding `sandbox` in apps/docs/src/lib/api-ref/model.ts:135-136 so the three ops flow into the index and the per-op reference pages, or (b) soften the two false claims: reference.mdx:8 → "Every API method in `github.com/nombaone/nombaone-go` … the sandbox-only instruments live in the [sandbox toolkit](/sandbox-toolkit/overview)", and delete the "can never miss a method" sentence at sdk-method-index.tsx:11-13. (a) is the honest fix.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/model.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/go/reference.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The accurate finding is a prose overclaim, not a broken or silently-lossy generator, and it is not Go-specific.
> 
> All nine `apps/docs/content/sdks/*/reference.mdx` pages (and the footer of `SdkMethodIndex` itself, sdk-method-index.tsx:102-106) promise "Every method in <package>", but the index is built from `getApiResources()`, which by explicit design (`apps/docs/src/lib/api-ref/model.ts:133-137`) excludes the 3 sandbox operations that exist in the OpenAPI spec (`/v1/sandbox/payment-methods`, `/v1/sandbox/subscriptions/{id}/advance-cycle`, `/v1/sandbox/webhooks/simulate`). Those map to the `client.Sandbox` namespace the Go guide uses at go.mdx:73 and documents at go.mdx:268-301.
> 
> The omissio
> 
> *…trimmed (1180 more chars — see the cited files).*
> The finding is real but (a) scoped too narrowly and (b) rated too high. Accurate version: "All 9 SDK reference pages promise 'Every method in the SDK' but the shared <SdkMethodIndex> omits the client.Sandbox namespace (3 methods), because getApiResources() deliberately excludes `sandbox` (model.ts:133-137). The omission is intentional and the methods ARE documented — with full signatures, param structs, and the 5 Behavior values — in each SDK guide's own 'sandbox toolkit' section (go.mdx:266-301) and in the 4-page /sandbox-toolkit/* section the guide links to. The actual defect is the unqualified 'Every method' prose (and the component docstring's 'it can never miss a method' claim), plus th
> 
> *…trimmed (214 more chars — see the cited files).*

---

## K33. 🟡 /sdks/rust/reference claims "Every method in the nombaone crate" but silently omits the entire `nombaone.sandbox()` namespace the guide itself teaches

**What we publish**

apps/docs/content/sdks/rust/reference.mdx:8-13: "Every method in the `nombaone` crate, grouped by the namespace you reach it through on the client" + `<SdkMethodIndex lang="rust" />`. The component caption repeats it (sdk-method-index.tsx:102-104). The index is built from `getApiResources()`, and apps/docs/src/lib/api-ref/model.ts:135-136 says: "scaffold paths (`health`, `openapi.json`, `examples`, `sandbox`) are covered elsewhere (sandbox toolkit) and deliberately excluded."

**What the code does**

`sandbox()` is a first-class public namespace on the crate with three methods, and the Rust guide devotes a whole section to it: nombaone-rust/src/resources/sandbox.rs:173 `pub fn sandbox(&self) -> Sandbox`, :125 `create_payment_method`, :139 `advance_cycle`, :157 `simulate_webhook` — all re-exported at lib.rs:81-84. content/sdks/rust.mdx:66-73 uses `nombaone.sandbox().create_payment_method(...)` as step 3 of the FIRST sample on the page, and rust.mdx:308-338 is an entire "The sandbox toolkit" section.

**Impact.** A developer who lands on the method reference (linked from rust.mdx:377 as "Every method in the crate") and searches it for `advance_cycle` — the test clock, the only way to force a billing cycle without waiting for cron — concludes the crate has no such method. The completeness claim is the whole point of the page; three real methods, including the one the guide's own quickstart depends on, are missing with no note saying so.

**Fix.** apps/docs/content/sdks/rust/reference.mdx:8 — either (a) soften the claim to "Every API-backed method in the crate" and add a line pointing at /sandbox-toolkit/overview for `sandbox()`, or (b) preferable: have `<SdkMethodIndex>` append a curated 'Sandbox' section (3 rows: `sandbox.create_payment_method`, `sandbox.advance_cycle`, `sandbox.simulate_webhook`) so the page keeps its promise. The same gap exists on all nine /sdks/*/reference pages.

**Files.** `apps/docs/content/sdks/rust/reference.mdx`, `apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is factually correct but mis-scoped and over-severe. Accurate version: the shared <SdkMethodIndex> component is built from getApiResources(), whose RESOURCE_ORDER (apps/docs/src/lib/api-ref/model.ts:138-152) deliberately excludes `sandbox`, so ALL NINE SDK reference pages — not just rust — assert "Every method in <package>" while omitting the public `sandbox()` namespace (create_payment_method / advance_cycle / simulate_webhook). The exclusion is intentional and documented at model.ts:133-136, but the "Every method" copy in reference.mdx:8 and sdk-method-index.tsx:102-106 was never qualified, and the "covered elsewhere (sandbox toolkit)" claim only half-holds: apps/docs/content/s
> 
> *…trimmed (531 more chars — see the cited files).*
> The finding is factually correct but over-severed and under-scoped. Accurate version: the blanket "Every method" claim is false on ALL NINE SDK method-reference pages (shared getApiResources() + shared caption in sdk-method-index.tsx), not just Rust. But the sandbox namespace is far from undiscoverable — it is taught in the Rust guide's own first quickstart sample (rust.mdx:66-73), in a dedicated guide section (rust.mdx:308-338), and in a four-page top-level "Sandbox toolkit" docs section (content/sandbox-toolkit/*, manifest.ts:255-261), which is precisely the "covered elsewhere" that model.ts:133-137 cites. The only real defect is the un-caveated completeness wording on a lookup page; conse
> 
> *…trimmed (80 more chars — see the cited files).*

---

## K34. 🟡 All 75 PHP snippets omit `require 'vendor/autoload.php';` — `use` is an alias, not a loader, so every copied sample fatals with "Class not found"

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts:250-255 emits exactly: `<?php` / `use NombaOne\Nombaone;` / `` / `$nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`. The docs bill these as runnable — content/sdks/php/reference.mdx:11 "a copy-runnable sample in PHP", and snippets.ts:7-8 "it emits an idiomatic, copy-runnable call in cURL and all nine SDK languages".

**What the code does**

`use` only aliases a namespace; it loads nothing. I saved the emitted snippet for `POST /v1/customers` verbatim into a composer project and ran it: `PHP Fatal error: Uncaught Error: Class "NombaOne\Nombaone" not found in …/snippet.php:4`. The SDK's own examples do it correctly — /Users/mac/Vault/the-60/nombaone/nombaone-php/examples/01-quickstart.php requires the autoloader. PHP is the ONLY language whose snippet lacks its bootstrap: node emits `import Nombaone from "@nombaone/node";` (snippets.ts:202), python emits `from nombaone import Nombaone` (:218) — both of which actually load the package.

**Impact.** A plain-PHP developer (no framework) copies any of the 75 reference samples into a script and gets an immediate fatal error, on a page that promised copy-runnable. It is recoverable in seconds by anyone who knows Composer, and Laravel/Symfony users are already autoloaded — hence medium, not high — but it is 75/75 and the fix is one line, so the cost/benefit is lopsided.

**Fix.** In /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts, in `php(ctx)` (line 242), change the emitted preamble at :250-251 from [`<?php`, `use NombaOne\\Nombaone;`] to [`<?php`, `require 'vendor/autoload.php';`, ``, `use NombaOne\\Nombaone;`].

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: The PHP renderer (apps/docs/src/lib/api-ref/snippets.ts:249-256) omits `require 'vendor/autoload.php';`, so the emitted PHP is the only snippet whose missing bootstrap manifests as a RUNTIME fatal ("Class NombaOne\Nombaone not found") rather than a compile error, because PHP resolves classes via Composer autoload and `use` is only an alias. Adding one line fixes it.
> 
> But it is NOT true that "PHP is the only language whose snippet lacks its bootstrap." By design (see the docstring at snippets.ts:7 -- "an idiomatic, copy-runnable CALL"), none of the ten snippets is a complete program, and several are worse: go() (272-284) emits no import at all AND references an undefined `ct
> 
> *…trimmed (589 more chars — see the cited files).*
> The finding's facts hold (the emitter really does omit the autoloader for all PHP snippets, and the pages really are billed copy-runnable), but the impact framing overstates it: the error is loud, immediate, deterministic, self-explanatory, harmless to correctness/money/auth, and a no-op under any framework or already-autoloaded context. Fix it (one line at snippets.ts:250-251), but rank it low, not medium.

---

## K35. 🟡 EXAMPLE_NOT_FOUND scaffold code is shipped inside the published PyPI package's public surface — deleting the scaffold from the monorepo will not remove it

**What we publish**

The example scaffold is understood to be deletable, monorepo-local content (DELETE-ME-EXAMPLE.md, /v1/examples, the 'Example (deletable)' section on /errors). Meanwhile apps/docs/src/lib/sdks/registry.ts:82-87 tells every developer to 'pip install nombaone' v0.1.0 from PyPI as the supported client.

**What the code does**

The scaffold has escaped the monorepo into a published artifact. nombaone-python/src/nombaone/_constants.py:143-144 — '    # Example scaffold' / '    "EXAMPLE_NOT_FOUND",' — inside PUBLIC_ERROR_CODES (declared at _constants.py:61), which is re-exported as public API at src/nombaone/__init__.py:21 ('from ._constants import BASE_URLS, PUBLIC_ERROR_CODES') and listed in __all__ at __init__.py:230. I confirmed against the live PyPI JSON API that nombaone 0.1.0 is published and is the sole release, so this tuple is in the wheel pip fetches today. Separately the same vendored tuple has drifted the other way: it omits API_KEY_HOST_MISMATCH, which packages/errors/src/codes.ts:260 does include (server: 72 public codes; SDK: 71).

**Impact.** Any Python developer who runs 'from nombaone import PUBLIC_ERROR_CODES' — the documented way to enumerate stable error codes — sees a scaffold code in the official client library. Unlike every other example-scaffold leak, this one is NOT fixable by deleting files from the monorepo: it is baked into a wheel on PyPI and needs a version bump + release to purge. The missing API_KEY_HOST_MISMATCH also means a developer switching over the constant silently drops a real auth failure mode into their fallback branch.

**Fix.** nombaone-python/src/nombaone/_constants.py — delete lines 143-144 ('# Example scaffold' / '"EXAMPLE_NOT_FOUND",') and add '"API_KEY_HOST_MISMATCH",' to the API-key auth group (~line 73, beside API_KEY_ENVIRONMENT_MISMATCH). Ship in the same 0.1.1 release as the prices[] fix and bump registry.ts:85. Ideally generate this tuple from packages/errors/src/codes.ts rather than hand-vendoring it.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/_constants.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/sdks/registry.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the published PyPI wheel nombaone 0.1.0 does contain "EXAMPLE_NOT_FOUND" in PUBLIC_ERROR_CODES (verified by downloading the wheel), and it does omit API_KEY_HOST_MISMATCH that the server publishes — so a version bump is genuinely required to purge it. However this is documentation/hygiene, not a functional bug: (1) the SDK tuple correctly mirrors the server, which itself marks EXAMPLE_NOT_FOUND public (packages/errors/src/codes.ts:330) with the example module still mounted in apps/api/src/apps/main/server/routes.ts — the root fix is server-side; (2) PUBLIC_ERROR_CODES is never consumed inside the SDK, and error classes are chosen by HTTP status (_exceptions.py:120), so a 40
> 
> *…trimmed (398 more chars — see the cited files).*
> The scaffold code is genuinely in the published wheel (PyPI 0.1.0 confirmed), but it is inert: PUBLIC_ERROR_CODES is never used for dispatch anywhere in the SDK, and exception classes are selected by HTTP status (_exceptions.py:118-130), not by code membership. So the missing API_KEY_HOST_MISMATCH does not drop an auth failure mode — a 401 still raises AuthenticationError; only a hand-rolled `code in PUBLIC_ERROR_CODES` gate would fall to its (documented, safe) unknown-code branch. Also, the leak is upstream of the SDK: packages/errors/src/codes.ts:330 already includes EXAMPLE_NOT_FOUND in the server's own PUBLIC_ERROR_CODES (entry at :851-853 with a docUrl), so the SDK is a faithful vendori
> 
> *…trimmed (81 more chars — see the cited files).*

---

## K36. 🟡 Literal `"string"` placeholder leaks into the Rust samples for required bank/coupon fields — the sample generator's own doc-comment promises it never does this

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:2-8 (doc-comment): "Given a schema (and the field name it sits under), it produces a value a developer would actually send or receive — a real email, integer kobo, an `nbo…` id, an ISO timestamp — not `"string"` placeholders."

**What the code does**

apps/docs/src/lib/api-ref/samples.ts:77-78: `case "string": return s.format === "date-time" ? "2026-07-01T09:30:00Z" : "string";` — any string field not caught by `byName()` (samples.ts:15-...) falls through to the literal `"string"`. The Rust snippet for POST /v1/mandates (the direct-debit setup call, /reference/mandates/create) therefore renders:

    nombaone.mandates().create(MandateCreateParams {
            customer_ref: "string".into(),
            customer_account_number: "string".into(),
            bank_code: "string".into(),
            customer_name: "string".into(),
            customer_account_name: "string".into(),
            customer_phone_number: "string".into(),
            customer_address: "string".into(),
            narration: "string".into(),
            max_amount_in_kobo: 250000,
            ..Default::default()
        })

Also `coupon: "string"` (apply-discount), `code: "string"` (coupons/create), `bank_code`/`account_number: "string"` (settlements/payout), `comment: "string"` (invoices/void, subscriptions/cancel).

**Impact.** Placeholder scaffold on a production surface. The mandate sample is the WORST case: 8 of its 9 fields are `"string"`, and unlike a compile error this one type-checks — a developer who fills in only the fields they recognise POSTs `bankCode: "string"` to the NIBSS mandate endpoint. Same for the payout sample (`bank_code`, `account_number`). Cross-cutting: it degrades all ten languages, not just Rust, and it directly contradicts the generator's stated contract at samples.ts:7.

**Fix.** apps/docs/src/lib/api-ref/samples.ts — extend `byName()` with the real-world fields the API actually has, so nothing reaches the line-78 fallback for a required input: `bankcode`→"058", `accountnumber`/`customeraccountnumber`→"0123456789", `customername`/`customeraccountname`→"Ada Lovelace", `customerphonenumber`→"+2348012345678", `customeraddress`→"1 Marina, Lagos", `narration`→"Monthly subscription", `code`→"LAUNCH20", `coupon`→"nbo000000000001cpn", `comment`→"Customer requested", `customerref`→"nbo000000000001cus", `callbackurl`→"https://example.com/return". Then make line 78 throw (or emit `TODO_<fieldName>`) in CI so a new un-named required string can never silently ship as `"string"` again.

**Files.** `apps/docs/src/lib/api-ref/samples.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the `"string"` fallthrough at apps/docs/src/lib/api-ref/samples.ts:78 is real and unguarded, and it does contradict the generator's own doc-comment at samples.ts:7. Verified by executing the generator: 10 of 75 operations emit a literal `"string"` — POST /v1/mandates (8 of its 9 required fields), POST /v1/settlements/payout (bank_code, account_number), POST /v1/coupons (code), POST /v1/customers/{id}/discount and POST /v1/subscriptions/{id}/discount (coupon), plus the void/cancel `comment` fields — in all 10 languages and in the JSON request examples, not just Rust. The only relevant gate (apps/docs/scripts/check-api-ref.ts:59-69) checks that snippets are non-empty, not tha
> 
> *…trimmed (539 more chars — see the cited files).*
> The underlying facts are correct and actually UNDERSTATE the breadth — it is 12 of 83 operations / 25 request fields, not the 6 listed (also POST /v1/payment-methods/setup with required customerRef+callbackUrl, POST /v1/payment-methods/virtual-account, POST /v1/customers/{id}/credit, POST /v1/subscriptions/{id}/payment-method, POST /v1/sandbox/webhooks/simulate). It is fully reachable on the production public docs surface. But the IMPACT argument is overstated: "string" is the universally-recognised Swagger placeholder, so it is a loud, self-announcing defect rather than a silent trap, and bankCode/accountNumber of "string" are rejected upstream (bank-code validation / NIBSS) — the call fail
> 
> *…trimmed (595 more chars — see the cited files).*

---

## K37. 🟡 Reference samples ship literal `"string"` as the value for real fields (bank codes, account numbers, coupon codes) — the generator's own docstring says it exists to prevent this

**What we publish**

apps/docs/src/lib/api-ref/samples.ts:7 states the generator's purpose: "`\"string\"` placeholders. One generator feeds both the request/response JSON" — i.e. avoiding them is the stated goal.

**What the code does**

apps/docs/src/lib/api-ref/samples.ts:77-78 `case "string": return s.format === "date-time" ? "2026-07-01T09:30:00Z" : "string";` — the fallback IS the placeholder. Dumped Go output for POST /v1/mandates: `nombaone.MandateCreateParams{ CustomerRef: "string", CustomerAccountNumber: "string", BankCode: "string", CustomerName: "string", CustomerAccountName: "string", CustomerPhoneNumber: "string", CustomerAddress: "string", Narration: "string", MaxAmountInKobo: 250000, }`. Also `Coupon: "string"` (apply-discount), `Comment: "string"` (invoice void), `AccountNumber: "string"` + `BankCode: "string"` (payout), `CallbackUrl: "string"` (payment-method setup).

**Impact.** Cross-cutting: this is emitted for all 10 languages including the curl tab, so it is the first thing a developer sees on those reference pages regardless of SDK. Direct-debit mandate setup — the highest-friction, highest-support-cost flow in Nigerian billing — presents nine consecutive `"string"` values, teaching nothing about what a CBN bank code or an NUBAN account number looks like, and reads as an unfinished doc. Recoverable (nobody ships `"string"` as a bank code), but it is placeholder content on the production API reference.

**Fix.** apps/docs/src/lib/api-ref/samples.ts:77-78 — extend `fieldSample` (snippets.ts:389-400, which already special-cases `name` by resource) into a real name→example map, or better, add `example:` values to the OpenAPI schema builder in apps/api/src/shared/openapi/ so the samples are sourced from the spec: bankCode → "058", accountNumber → "0123456789", customerRef → "nbo000000000001cus", coupon → "LAUNCH20", comment → "Duplicate charge", callbackUrl → "https://example.com/checkout/return", narration → "Monthly subscription".

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/samples.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct and understated in two ways. (1) Breadth: it is 11 operations, not the 5 named -- also POST /v1/customers/{id}/credit (sourceReference), POST /v1/subscriptions/{id}/cancel (comment), POST /v1/subscriptions/{id}/payment-method (paymentMethodReference, checkoutToken), POST /v1/payment-methods/virtual-account (customerRef, expiryDate), POST /v1/coupons (code), and mandates also leaks startDate + endDate (10 fields, not 9). (2) Severity beyond cosmetic: mandates startDate/endDate and virtual-account expiryDate are bare `type: "string"` with no format and no description, so the reference genuinely fails to communicate the expected date format -- that is a docs-correctness g
> 
> *…trimmed (439 more chars — see the cited files).*
> The finding is factually correct and reachable in production (reference pages are statically prerendered on the live docs site and the generator feeds all 10 language tabs), but the severity is overstated. Scope is ~10 operations / ~20 fields, not the whole spec — email, name, phone, description, url, *Id and *InKobo are already covered by byName(). More importantly, "string" is a self-evident placeholder, not misleading content: no integrator ships it, the API rejects it, and there is no wrong-but-plausible value that could cause a bad request to succeed. Impact is DX polish on a public surface, i.e. low, not medium. Fix: extend byName() in apps/docs/src/lib/api-ref/samples.ts with bankcode
> 
> *…trimmed (107 more chars — see the cited files).*

---

## K38. 🟡 SYSTEMATIC: all 75 generated Java snippets emit `import xyz.nombaone.Nombaone;` as the sole import, so even the 57 semantically-correct ones do not compile as printed

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:326-332 — the Java renderer's fixed preamble: `` return [`import xyz.nombaone.Nombaone;`, ``, `Nombaone nombaone = new Nombaone(); // reads NOMBAONE_API_KEY`, ``, `var ${resultVar(ctx)} = ${invocation};`].join("\n"); ``. apps/docs/content/sdks/java/reference.mdx:11-12 promises "a copy-runnable sample in Java", and apps/docs/src/components/mdx/sdk-method-index.tsx:104-105 promises "a ready-to-run {sdk.label} sample".

**What the code does**

24 of the 75 emitted Java snippets reference a `*Params` builder class, and none of them is imported — `CustomerCreateParams` is in `xyz.nombaone.customers`, `SubscriptionPauseParams` in `xyz.nombaone.subscriptions`, etc. Java has no implicit package import beyond `java.lang`. Confirmed by javac: the snippet-derived file only compiles once the resource packages are star-imported (I had to add 14 `import xyz.nombaone.*.*;` lines to even reach the *interesting* errors reported in the findings above). Note this is a Java-specific hazard the emitter's other languages don't have: `node()` (snippets.ts:202) needs one import, `python()` (line 218) one, `dotnet()` (line 301) one `using` — Java needs one per type. Separately, `var x = …` at file scope is not legal Java in any release, so no Java snippet is literally "runnable" without a class+`main` wrapper either.

**Impact.** The claim on the page is "copy-runnable" / "ready-to-run"; the reality is that zero of the 75 Java samples compile if pasted. This is lower-severity than the wrong identifiers (an IDE auto-fixes an import; it cannot invent `WebhookEndpointCreateParams` from `WebhookCreateParams`), but it makes the "ready-to-run" promise false for the entire Java surface, which is the credibility problem the rest of this audit is about.

**Fix.** apps/docs/src/lib/api-ref/snippets.ts:326-332 — in `java()`, emit the imports the snippet actually uses. The package for each params/enum type is derivable once you fix finding #2 (add the true class name AND its package to the per-op map), e.g. `import xyz.nombaone.customers.CustomerCreateParams;`. Cheapest correct alternative: emit `import xyz.nombaone.Nombaone;` plus a star import for the op's resource package (`import xyz.nombaone.customers.*;`). Either way, also soften apps/docs/content/sdks/java/reference.mdx:11-12 and src/components/mdx/sdk-method-index.tsx:104-105 from "ready-to-run" to "copy-paste" unless you also wrap the snippet in a class+main.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/snippets.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/java/reference.mdx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The Java emitter (snippets.ts:314-333) does omit imports for the `*Params` builder types it emits, so Java snippets are illustrative fragments, not compilable files. But this is NOT Java-specific and NOT proven against a real SDK: (a) no Java SDK source exists in the repo (no .java/pom.xml/build.gradle anywhere), so the asserted packages (`xyz.nombaone.customers`, etc.) and the "confirmed by javac" result come from stubs the auditor invented, not from the SDK; (b) go() emits zero imports, no `package main`, and an undefined `ctx`, and rust() emits `.await?` at file scope — both are equally non-compilable as printed; (c) the hand-authored java.mdx quickstart uses the identical one-import, fil
> 
> *…trimmed (312 more chars — see the cited files).*
> Scope is 24 of 75 snippets, not all 75: only snippets with a request body emit a *Params builder type, and those are the ones with no import. The other 51 reference only `Nombaone`, which IS imported, and compile as pasted into a method body. Additionally, the "`var` at file scope isn't legal Java" point is not a Java-specific defect — it is the emitter's uniform fragment convention, and go() (snippets.ts:279-283) and rust() (snippets.ts:346-352) emit equally non-compiling file-scope fragments; that part of the finding should be dropped or re-filed as a cross-language snippet-convention note. The accurate finding: the Java renderer omits the per-type import that Java (unlike Node/Python/.NET
> 
> *…trimmed (175 more chars — see the cited files).*

---

## K39. 🟡 The .NET guide's webhook receiver does not compile — `WebhookVerificationException` is not in the `NombaOne.Webhooks` namespace

**What we publish**

`apps/docs/content/sdks/dotnet.mdx:201-223`. The prose at :201-202 says "The webhook verifier is the static `NombaOne.Webhooks.WebhookVerifier`, and it needs **no API key** — a receiver usually holds only the signing secret" — explicitly encouraging a standalone receiver. The sample then shows exactly one using directive, :207 `using NombaOne.Webhooks;`, and at :223 catches `catch (WebhookVerificationException) { return Results.BadRequest(); }`.

**What the code does**

`WebhookVerificationException` is declared in namespace `NombaOne`, not `NombaOne.Webhooks`. `nombaone-dotnet/src/NombaOne/NombaoneException.cs:3` `namespace NombaOne;` and `:71` `public class WebhookVerificationException : NombaoneException`. I compiled the sample verbatim (only `using NombaOne.Webhooks;`) against the real project: `error CS0246: The type or namespace name 'WebhookVerificationException' could not be found (are you missing a using directive or an assembly reference?)`. `WebhookVerifier`, `WebhookEvent`, and `WebhookEventTypes` ARE in `NombaOne.Webhooks` (WebhookVerifier.cs:6, WebhookEvent.cs:6, WebhookEventTypes.cs:1), so three of the four types resolve and only the exception fails — which is why it survived review.

**Impact.** The webhook receiver is the one file in a subscriptions integration you cannot skip, and the guide's copy-paste version fails to build. It is recoverable (add `using NombaOne;`) but the error points at 'missing assembly reference', which sends the developer to check their NuGet install rather than their usings. Isolated to this one sample — the other seven code blocks in dotnet.mdx all compile clean.

**Fix.** In `apps/docs/content/sdks/dotnet.mdx`, change line 207 from `using NombaOne.Webhooks;` to two lines:
```csharp
using NombaOne;          // WebhookVerificationException
using NombaOne.Webhooks; // WebhookVerifier, WebhookEvent, WebhookEventTypes
```
Alternatively (better long-term) move `WebhookVerificationException` into `namespace NombaOne.Webhooks` in `nombaone-dotnet/src/NombaOne/NombaoneException.cs` so the receiver really does need only one using — but that is a breaking change and needs a version bump.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/dotnet.mdx`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the webhook sample in apps/docs/content/sdks/dotnet.mdx (fence at :206-235) omits `using NombaOne;`. `WebhookVerificationException` lives in namespace `NombaOne` (nombaone-dotnet/src/NombaOne/NombaoneException.cs:3, :71), not `NombaOne.Webhooks`, so the `catch` at :223 will not resolve with only the `using NombaOne.Webhooks;` shown at :207 — a developer who mirrors the doc's usings in a real receiver gets CS0246 on that one identifier. Fix: add `using NombaOne;` above :207. Two corrections to the finding's framing: (1) the block is an illustrative fragment (no `app`, no AlreadyProcessed/Unlock/Email/Note), so it was never build-as-pasted; (2) the page already tells the read
> 
> *…trimmed (146 more chars — see the cited files).*
> The finding is factually correct but its impact is overstated: it produces a self-revealing compile error with a one-line IDE-suggested fix (`using NombaOne;`), not a trap costing meaningful integrator time and not any incorrect runtime/webhook behavior. Severity is low, not medium.

---

## K40. 🟡 The Java guide's FIRST runnable sample does not compile: it declares one import and then uses 11 types from six other packages

**What we publish**

apps/docs/content/sdks/java.mdx:49-84 — the "Your first subscription" block opens with exactly one import, `import xyz.nombaone.Nombaone;` (line 50), then uses `Plan`, `PlanCreateParams`, `Price`, `PriceCreateParams`, `PriceInterval`, `Customer`, `CustomerCreateParams`, `PaymentMethod`, `SandboxPaymentMethodParams`, `Subscription`, `SubscriptionCreateParams`. Because the block SHOWS an import section, a reader reasonably reads it as complete (the guide's other blocks do the same — line 106 `import java.time.Duration;`, line 238 `import xyz.nombaone.webhook.Webhooks;`).

**What the code does**

javac 17 against the real nombaone-0.1.0.jar, with the block pasted verbatim into a class+main: `GuideFirstSample.java:7: error: cannot find symbol — symbol: class Plan`, `…:8: error: cannot find symbol — symbol: variable PlanCreateParams`, `…:10: error: cannot find symbol — symbol: class Price`, `…:13: error: cannot find symbol — symbol: variable PriceInterval` (and so on — 11 unresolved symbols). Every one of those types lives in a different package: `xyz.nombaone.plans`, `xyz.nombaone.prices`, `xyz.nombaone.customers`, `xyz.nombaone.paymentmethods`, `xyz.nombaone.sandbox`, `xyz.nombaone.subscriptions`. I verified the fault is ONLY the imports: adding those six `import …*;` lines and changing nothing else compiles clean (exit 0) — the method names, builder methods, arities, `250_000L`, and `PriceInterval.MONTH` are all correct.

**Impact.** The very first thing a Java developer copies out of the SDK guide throws 11 red squiggles in their IDE. It is recoverable (the IDE will offer the imports), but it is the page's credibility moment, and it is the one sample the page describes as "the whole lifecycle". The Java SDK, unlike Node/Python, has no barrel/star export from the root package, so nothing about this is auto-fixable by convention.

**Fix.** apps/docs/content/sdks/java.mdx:50 — replace the single import with the full set:
```java
import xyz.nombaone.Nombaone;
import xyz.nombaone.customers.Customer;
import xyz.nombaone.customers.CustomerCreateParams;
import xyz.nombaone.paymentmethods.PaymentMethod;
import xyz.nombaone.plans.Plan;
import xyz.nombaone.plans.PlanCreateParams;
import xyz.nombaone.prices.Price;
import xyz.nombaone.prices.PriceCreateParams;
import xyz.nombaone.prices.PriceInterval;
import xyz.nombaone.sandbox.SandboxPaymentMethodParams;
import xyz.nombaone.subscriptions.Subscription;
import xyz.nombaone.subscriptions.SubscriptionCreateParams;
```

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/java.mdx`

> **Refuter's correction — re-scopes this finding:**
> The imports in the java.mdx "Your first subscription" block (line 50) are genuinely incomplete — the sample needs xyz.nombaone.plans.*, prices.*, customers.*, paymentmethods.*, sandbox.*, subscriptions.* in addition to xyz.nombaone.Nombaone, and adding exactly those makes it compile clean against nombaone-0.1.0.jar. But the block is a bare-statement fragment (no package/class/main), so it was never copy-paste-runnable regardless; the failure mode is a handful of IDE auto-import prompts, not a broken integration or wrong money behavior. Docs polish, low severity. Fix: mirror the import list from the SDK's own examples/src/main/java/xyz/nombaone/examples/SubscriptionLifecycle.java.

---

## K41. 🟡 The `check:sdks` honesty gate never opens the Rust crate — it structurally cannot catch any of the above

**What we publish**

apps/docs/scripts/check-sdks.ts:1-16 (doc-comment): "SDK-docs honesty gate. … This proves the docs can't drift: 1. Coverage … 2. Component integrity … 3. Env-var honesty …" It is wired into the build gate (apps/docs/package.json:7, `"build": "… && pnpm run check:sdks && … next build"`). apps/docs/src/lib/sdks/registry.ts:1-10 likewise says the registry's facts are "lifted from the shipped SDK repos (the SSOT, `../nombaone-<id>/`)".

**What the code does**

check-sdks.ts:19-25 imports only `node:fs`, `node:path` and `SDKS` from the registry, and its `CONTENT`/`SDK_DIR` roots are `path.join(process.cwd(), "content")` — it reads MDX files inside apps/docs and nothing else. It never resolves `../nombaone-rust/`, never parses Cargo.toml, and never compiles or greps a single method name. The three assertions it makes are: the pages exist, they contain `<SdkHeader>` / `<SdkMethodIndex>` with a valid id, and they say `NOMBAONE_API_KEY`.

**Impact.** Explains why 128 compile errors across 75 Rust snippets shipped green, and is the reason a point-fix to snippets.ts will regress. The gate's name and doc-comment actively create false confidence — a maintainer reading 'proves the docs can't drift' will not think to re-verify method names against the crate. (Note: I verified the registry.ts rust facts by hand and they are all CORRECT today — see checkedAndClean — but nothing keeps them that way.)

**Fix.** apps/docs/scripts/check-sdks.ts — add a fourth check that reads the real repos. Cheapest high-value version, no Rust toolchain needed in CI: for `rust`, read `../../nombaone-rust/Cargo.toml` and assert `version` == `registry.version` and `rust-version` matches `languageFloor`; then read `../../nombaone-rust/src/lib.rs` and assert every `paramsType` the snippet emitter can produce, and every `snake(sdkCall(op).method)`, appears in the `pub use` re-export block / a `pub fn <name>(` in src/resources/. That single grep-level check would have caught the 5 bad method names, the 8 bad *Params names, and any future drift. Best version: add a CI job that pastes the 75 generated Rust snippets into a scratch crate and runs `cargo check` — that catches all eight findings in this report at once.

**Files.** `apps/docs/scripts/check-sdks.ts`

> **Refuter's correction — re-scopes this finding:**
> ACCURATE VERSION: `check:sdks` (apps/docs/scripts/check-sdks.ts) is purely a text gate over apps/docs/content/sdks/*.mdx — it asserts page coverage, component/id integrity, and the NOMBAONE_API_KEY env-var wording, and nothing more. It never resolves ../nombaone-<id>/, never parses Cargo.toml, and never compiles or greps a method name. Confirmed: no script in apps/docs/scripts/ (all 12) references a sibling SDK repo. This is a genuine coverage gap — nothing in CI keeps registry.ts's facts or the hand-written Rust in content/sdks/rust.mdx (11 fenced rust blocks) in sync with the shipped crate; they are correct today only by hand.
> 
> BUT the finding overstates it: (a) the script's doc-comment do
> 
> *…trimmed (935 more chars — see the cited files).*
> The gap is real and slightly wider than stated (check-api-ref.ts, the only other snippet-touching gate, asserts only non-emptiness — so NO gate in the docs build validates any SDK symbol). But two things need correcting. (1) The impact belongs mostly to the sibling finding: this item is the *absence* of a check, not a defect that reaches a user on its own — the integrator harm is the broken Rust snippets, and rating both at medium double-counts it. (2) "The gate structurally cannot open the crate" is true but the implied fix is not actionable: the nine SDKs are sibling git repos (../nombaone-rust), not workspace members, so an apps/docs build script cannot compile them without cross-repo too
> 
> *…trimmed (386 more chars — see the cited files).*

---

## K42. 🟡 The five fabricated method names also render in the `<SdkMethodIndex>` on /sdks/rust/reference — the page that claims to list "every method in nombaone"

**What we publish**

apps/docs/src/components/mdx/sdk-method-index.tsx:61-63 `signature()` renders `sdkCall()` names in snake_case for Rust, and lines 102-105 caption the page: "Every method in <code>{sdk.package}</code>, grouped by namespace. Open any method for the full request, response, and a ready-to-run {sdk.label} sample." It therefore prints, on https://docs.nombaone.xyz/sdks/rust/reference: `customers.void_credit_grant`, `payment_methods.delete`, `events.retrieve_catalog`, `metrics.retrieve_billing`, `subscriptions.schedule.cancel` (from sdk-map.ts:50, :37 CRUD_METHOD.delete, :89, :94, :67).

**What the code does**

None of those five methods exist on the crate. The real names are:
  nombaone-rust/src/resources/customers.rs:338 `pub fn void_credit(&self, id: &str, grant_id: &str) -> ApiCall<CreditGrant>`
  nombaone-rust/src/resources/payment_methods.rs:204 `pub fn remove(&self, id: &str) -> ApiCall<PaymentMethod>`
  nombaone-rust/src/resources/events.rs:66 `pub fn catalog(&self) -> ApiCall<HashMap<String, EventCatalogEntry>>`
  nombaone-rust/src/resources/metrics.rs:81 `pub fn billing(&self, params: BillingMetricsParams) -> ApiCall<BillingMetrics>`
  nombaone-rust/src/resources/subscriptions.rs:720 `pub fn release(&self, subscription_id: &str) -> ApiCall<SubscriptionSchedule>`
cargo check --offline confirms all four reachable ones (the fifth is masked by E0615):
    src/main.rs:86:37:  error[E0599]: no method named `void_credit_grant` found for struct `Customers`
    src/main.rs:385:49: error[E0599]: no method named `delete` found for struct `PaymentMethods`
    src/main.rs:662:31: error[E0599]: no method named `retrieve_catalog` found for struct `Events`
    src/main.rs:710:33: error[E0599]: no

*…trimmed (59 more chars — see the cited files).*

**Impact.** ADDS a new affected surface to the known snippet-level fabrication: the method INDEX is wrong too, so a Rust developer scanning /sdks/rust/reference for the API of the crate cannot find `void_credit`, `remove`, `catalog`, `billing`, or `release` under any name — the index is the one page that is supposed to be the authoritative list, and its own caption asserts completeness. `cargo doc` and the index disagree on five names with no cross-reference to reconcile them.

**Fix.** apps/docs/src/lib/api-ref/sdk-map.ts — correct the five entries at source (they feed BOTH the index and the snippets): line 50 `voidCreditGrant`→`voidCredit`; line 67 `{ ns: ["schedule"], method: "cancel" }`→`method: "release"`; line 89 `retrieveCatalog`→`catalog`; line 94 `retrieveBilling`→`billing`; and add an override `"DELETE /v1/payment-methods/{id}": { method: "remove" }` so it stops falling through to `CRUD_METHOD.delete` (line 37).

**Files.** `apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct but scoped too narrowly to Rust. sdk-map.ts is language-neutral, so the same five wrong names render in <SdkMethodIndex> on ALL NINE /sdks/*/reference pages, not only /sdks/rust/reference. The other SDKs use the same real method names as the Rust crate: nombaone-node/src/resources/customers.ts:259 `voidCredit`, events.ts:66 `catalog`, metrics.ts:49 `billing`, payment-methods.ts:162 `remove`, subscriptions.ts:255 `release`; nombaone-python .../customers.py:281 `void_credit`, events.py:59 `catalog`, metrics.py:44 `billing`, payment_methods.py:183 `remove`. Root cause is a single file — the OVERRIDES/CRUD_METHOD tables in apps/docs/src/lib/api-ref/sdk-map.ts (:37 delete→r
> 
> *…trimmed (468 more chars — see the cited files).*
> The finding is correct but under-scopes the blast radius. It is not just the Rust index: sdkCall() feeds BOTH sdk-method-index.tsx (all nine /sdks/<lang>/reference pages) AND snippets.ts (the code samples on every /reference/<resource>/<op> page). The five bad names come from apps/docs/src/lib/api-ref/sdk-map.ts and are wrong for every SDK, not just Rust — the Node SDK (the reference implementation the others mirror) also uses voidCredit, catalog, billing, remove, and schedule.release. Fix is five entries in OVERRIDES plus CRUD_METHOD.delete in sdk-map.ts, and the check:sdks gate needs to actually verify method names against the shipped SDK sources rather than assuming the map is "correct by
> 
> *…trimmed (15 more chars — see the cited files).*

---

## K43. 🟡 `..Default::default()` is appended to Rust params structs that do not derive Default (CouponCreateParams, PriceCreateParams)

**What we publish**

apps/docs/src/lib/api-ref/snippets.ts:343 — `\`\n        ..Default::default()\n    }\`` is appended unconditionally to EVERY Rust params struct literal. On /reference/coupons/create:

    nombaone.coupons().create(CouponCreateParams {
            code: "string".into(),
            duration: "once".into(),
            ..Default::default()
        })

**What the code does**

Two params structs in the crate deliberately omit `Default` — they have required fields with no sane zero value:
  nombaone-rust/src/resources/coupons.rs:55 `#[derive(Debug, Clone, Serialize)]` → `pub struct CouponCreateParams`  (no `Default`)
  nombaone-rust/src/resources/prices.rs:79   `#[derive(Debug, Clone, Serialize)]` → `pub struct PriceCreateParams`   (no `Default`; prices.rs:108 gives `PriceCreateParams::new(unit_amount_in_kobo, interval)` instead)
cargo check --offline:
    src/main.rs:482:11: error[E0277]: the trait bound `nombaone::CouponCreateParams: Default` is not satisfied: the trait `Default` is not implemented for `nombaone::CouponCreateParams`

**Impact.** The coupon-create sample — the entry point for the whole discounting feature — cannot compile even after every other bug on this page is fixed. `PriceCreateParams` escapes the same error today only because the price-create snippet names the WRONG struct entirely (see the *Params-name finding), so once that is corrected this error surfaces there too.

**Fix.** apps/docs/src/lib/api-ref/snippets.ts:340-344 — maintain a `NO_DEFAULT` set (`CouponCreateParams`, `PriceCreateParams`) and skip the `..Default::default()` line for those, emitting all fields explicitly instead (for `PriceCreateParams` prefer the constructor: `PriceCreateParams::new(250_000, PriceInterval::Month)`, matching content/sdks/rust.mdx:53).

**Files.** `apps/docs/src/lib/api-ref/snippets.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is substantively correct as written. Two refinements:
> 
> (a) The citation `nombaone-rust/src/main.rs:482` is bogus — the crate is a lib with no src/main.rs. The E0277 error text is genuine and reproducible via a scratch example/test against the crate, but the file:line should not be presented as a repo location.
> 
> (b) Blast radius is precisely 2 reference pages, not a systemic break: of the 43 `*Params` structs in the crate, only CouponCreateParams and PriceCreateParams omit `Default`. `/reference/coupons/create` is broken today; `/reference/plans/create-price` is currently masked because it emits `PlanCreateParams` (which does derive Default) and will surface this error only once t
> 
> *…trimmed (495 more chars — see the cited files).*
> The finding is accurate about the cause but incomplete about the fix, and severity should be low rather than medium. Removing `..Default::default()` alone leaves the snippet broken with E0063 (missing fields), because the generator emits only the sample body's fields (code + duration for coupons) while CouponCreateParams also requires amount_off_in_kobo, percent_off, duration_in_cycles, and metadata. The real fix is in the generator (emit all fields, or use PriceCreateParams::new-style constructors, or derive Default on the two structs) — not a per-snippet edit. Severity is low: the failure is a loud compile-time error on a docs snippet, affects one language tab on one-to-two of ~75 operatio
> 
> *…trimmed (80 more chars — see the cited files).*

---

## K44. 🟡 `check:sdks` is advertised as the honesty gate that proves the SDK docs "can't drift", but it never opens an SDK repo

**What we publish**

`apps/docs/scripts/check-sdks.ts:1-16` (the file's own docstring): "SDK-docs honesty gate. … whose identity facts live in one place (`src/lib/sdks/registry.ts`) and whose method index is generated from the OpenAPI model. **This proves the docs can't drift.**" It is wired into the production build at `apps/docs/package.json:7`. Reinforced by `apps/docs/src/lib/sdks/registry.ts:14-15`: "Facts are lifted from the shipped SDK repos (the SSOT, `../nombaone-<id>/`)", and by `sdk-method-index.tsx:15-17`: "The method *names* come from the shared `sdkCall` map (**correct by construction**) … so nothing is invented."

**What the code does**

The script's three checks (`check-sdks.ts:49-93`) are: (1) `content/sdks.mdx` exists and contains the string `<SdkParityMatrix`; (2) each `content/sdks/<id>.mdx` contains `<SdkHeader id="<id>"` and the literal string `NOMBAONE_API_KEY`, and each `content/sdks/<id>/reference.mdx` contains `<SdkMethodIndex lang="<id>"`; (3) no file contains `NOMBAONE_SECRET_KEY`. Its only imports are `node:fs`, `node:path`, and `../src/lib/sdks/registry` (`:19-22`). It reads nothing outside `apps/docs/content/`. It cannot see `../nombaone-dotnet/` at all. It therefore cannot detect a fabricated method name, a wrong params type, a `var event` syntax error, a missing `Async` suffix, an unpublished pinned version, or a webhook scheme mismatch — every finding in this report passes it.

**Impact.** This is why all of the above shipped. A gate whose docstring claims drift is impossible, that runs on every build and prints `[check-sdks] OK — 9 SDKs … identity facts single-sourced from registry.ts`, is worse than no gate: it is why nobody hand-checked the 75 .NET snippets. 14 of them do not compile and 75 of 75 method-index entries name methods that do not exist, and the build is green.

**Fix.** Either (a) soften the claims — rewrite `check-sdks.ts:1-16` to say it checks *page coverage and component wiring only*, and drop "correct by construction" from `sdk-method-index.tsx:15-17` — or, far better, (b) make the claim true: add a `check:sdk-compile` step that, for each SDK repo present at `../nombaone-<id>/`, emits all 75 snippets from `buildOperationSnippets()` into a scratch project referencing the real library and compiles it. For .NET that is ~20 lines (`dotnet build` against `../nombaone-dotnet/src/NombaOne/NombaOne.csproj`) and it catches every stub finding in this report deterministically. I ran exactly this by hand; it takes ~8s.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/scripts/check-sdks.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/package.json`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: `check:sdks` is a docs-internal consistency lint, not an SDK-truth gate. It verifies only that (a) every registry SDK has a guide + reference page, (b) those pages render `<SdkHeader id>` / `<SdkMethodIndex lang>` with a valid registry id, and (c) the section reads NOMBAONE_API_KEY and never NOMBAONE_SECRET_KEY. It reads nothing outside `apps/docs/content/` and can never open the sibling SDK repos, so nothing verifies that a documented method exists, that a snippet compiles, that a pinned version is published, or that the `registry.ts` facts still match `../nombaone-<id>/`. Its docstring's headline sentence ("This proves the docs can't drift") overclaims — though the colon-
> 
> *…trimmed (528 more chars — see the cited files).*
> Two overstatements. (1) "Worse than no gate" is rhetoric: the gate does perform real, useful checks (coverage, env-var honesty, SDK-id validity) — it simply guarantees far less than its docstring and OK line assert. (2) "It never opens an SDK repo" is literally true but implies a fixable omission; the repo layout makes it impossible — the SDKs are sibling standalone git repos, absent from a CI checkout. Accurate framing: check-sdks.ts proves structural/coverage properties of the MDX only, while its docstring ("This proves the docs can't drift") and sdk-method-index.tsx ("correct by construction") claim semantic correctness of method names against the shipped SDKs, which nothing in the pipeli
> 
> *…trimmed (339 more chars — see the cited files).*

---

## K45. 🟡 check:sdks claims the method index is 'correct by construction' and 'proves coverage', but it never compares a single name against a real SDK — which is why 5 phantom Python methods ship

**What we publish**

apps/docs/src/components/mdx/sdk-method-index.tsx:11-17 — 'Built from the same OpenAPI model as the reference (getApiResources() + sdkCall()), so it can never miss a method the API adds — check:sdks proves coverage. ... The method *names* come from the shared sdkCall map (correct by construction); only the *casing* is applied per language here (a deterministic transform), so nothing is invented.' And apps/docs/src/lib/api-ref/sdk-map.ts:4-8 — 'The nine SDKs are generated from the same spec and share this shape.'

**What the code does**

apps/docs/scripts/check-sdks.ts:5-16 states its entire remit, and it is file-existence + component-presence + an env-var grep: '1. Coverage — every SDK in the registry has a guide + a reference page ... 2. Component integrity — every guide renders <SdkHeader id=...> ... 3. Env-var honesty'. It never imports an SDK, never reads a manifest, never checks a method name. 'Correct by construction' is false: sdk-map.ts is hand-curated (OVERRIDES, sdk-map.ts:44-95) and the SDKs are hand-written. I resolved all 75 emitted Python accessor chains against a live Nombaone instance with inspect.signature().bind(): exactly 5 raise AttributeError — customers.void_credit_grant (real: void_credit), subscriptions.schedule.cancel (real: release), payment_methods.delete (real: remove), events.retrieve_catalog (real: catalog), metrics.retrieve_billing (real: billing).

**Impact.** Not the 5 broken names themselves (already known) — the false assurance. Two code comments assert the index is drift-proof and that a gate proves it, so nobody looks; the gate is green while /sdks/python/reference publishes 5 method names that do not exist in the package it tells you to install. Any future rename in any of the nine SDKs silently re-opens the same hole.

**Fix.** Either (a) correct the comments at sdk-method-index.tsx:11-17 and sdk-map.ts:4-8 to say the names are hand-curated and unverified, or (b) make the claim true: extend apps/docs/scripts/check-sdks.ts with a name-parity step that, per SDK, reads the sibling repo (../nombaone-<id>/) and asserts every sdkCall() namespace+method resolves to a real symbol. For Python that is ~10 lines (import nombaone, walk getattr down each chain). It would fail today on exactly the 5 above — the correct outcome.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/scripts/check-sdks.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/api-ref/sdk-map.ts`

> **Refuter's correction — re-scopes this finding:**
> Accurate version: the component's 'correct by construction' claim is narrowly true (it doesn't invent names; it applies a deterministic casing transform to sdkCall's output) — the unearned claims are 'drift-proof' and 'check:sdks proves coverage', because sdkCall's map is hand-curated (OVERRIDES) against hand-written SDKs and check:sdks validates zero method names. The consequence is broader than the finding states: sdk-map.ts is also the source for src/lib/api-ref/snippets.ts, so the 5 phantom names appear in the copy-runnable samples on every /reference/<resource>/<op> page across all nine languages, not only in /sdks/python/reference. Verified: 5 of 75 emitted Python chains (~7%) do not e
> 
> *…trimmed (30 more chars — see the cited files).*
> The finding is accurate but scoped too narrowly. It is not 5 phantom PYTHON methods on one index page: sdkCall() also drives buildOperationSnippets() (apps/docs/src/lib/api-ref/snippets.ts:402), which emits the copy-runnable code samples on every /reference/<resource>/<op> page, and the OVERRIDES map is language-neutral, so the same 5 wrong names (voidCreditGrant, schedule.cancel, paymentMethods.delete, retrieveCatalog, retrieveBilling) render across ALL NINE SDK reference pages AND the API reference snippets. Verified against the Node SDK, which ships voidCredit / catalog / billing / remove — the same real names as Python. Also worth noting the second gate, check:api-ref, only asserts snipp
> 
> *…trimmed (127 more chars — see the cited files).*

---

## K46. 🟡 python.mdx promises cursor pagination on 'every list()', but three list endpoints return an unpaginated array and silently ignore limit/cursor

**What we publish**

apps/docs/content/sdks/python.mdx:149-151 — 'Every `list()` returns a page you can read one at a time or iterate to stream every item across every page, with the cursors threaded for you.' And python.mdx:192-193 — 'Pages are forward-only with no total counts: `limit` is 1-100 (default 20), `cursor` is opaque, and filters are preserved across every page.' The SDK backs it with signatures: webhook_endpoints.list(*, limit, cursor) at webhook_endpoints.py:258; subscriptions.list_events(subscription_id, *, limit, cursor) at subscriptions.py:463; subscriptions.dunning.list_attempts(subscription_id, *, limit, cursor) at subscriptions.py:292 — all typed -> SyncPage[...].

**What the code does**

Those three routes accept no query at all and return a bare array. apps/api/src/apps/main/modules/webhooks/controllers/list-endpoints.ts:17-18 — 'const rows = await listWebhookEndpoints(db, ctx); return { data: rows.map(serializeWebhookEndpoint) };' (no limit, no cursor, no pagination block). apps/api/src/apps/main/modules/subscriptions/controllers/list-subscription-events.ts:16 — 'return { data: await listSubscriptionAuditTrail(db, ctx, req.params.id ?? '') };'. apps/api/src/apps/main/modules/dunning/controllers/list-dunning-attempts.ts:21 — 'return { data: attempts.map(serializeDunningAttempt) };'. The generated spec confirms the server declares no such params: openapi.json GET /v1/webhooks -> '"parameters": []'. The SDK papers over the missing envelope at _client.py:243 — 'raw_pagination = envelope.pagination or {**_EMPTY_PAGINATION, "limit": len(items)}' — so nothing crashes; it just returns everything with has_more=False.

**Impact.** A developer writes nombaone.webhook_endpoints.list(limit=1) and gets every endpoint in the org. subscriptions.dunning.list_attempts(sub_id, limit=10) on a long-running past_due subscription returns the full attempt history in one unbounded response. No error, no warning: the parameter is accepted by the SDK, dropped by the server, and page.pagination.limit is a fabricated echo of the array length. Silent, and only discoverable by counting rows.

**Fix.** Either (a) add limit/cursor to the three API routes and their zod query schemas so the SDK's signature becomes true, or (b) drop the false parameters — remove limit/cursor from webhook_endpoints.py:258, subscriptions.py:463 and subscriptions.py:292, return a plain list, and amend python.mdx:192 to name the three unpaginated lists. Option (a) is preferable; the SDK is already shaped for it.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/webhooks/controllers/list-endpoints.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/api/src/apps/main/modules/dunning/controllers/list-dunning-attempts.ts`, `/Users/mac/Vault/the-60/nombaone/nombaone-python/src/nombaone/resources/webhook_endpoints.py`, `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/python.mdx`

> **Refuter's correction — re-scopes this finding:**
> The core finding is correct and verified: python.mdx promises cursor pagination on every list(), the SDK sends limit/cursor, but the three routes declare no query params (openapi.json confirms) and return a bare array via `jsonHandler` instead of `paginatedHandler`, and the SDK papers over the missing envelope at _client.py:242 — so limit/cursor are silently dropped and `pagination.limit` is a fabricated `len(items)`.
> 
> Two corrections to the IMPACT as stated:
> 
> 1. The dunning claim is overstated. `getDunningStateBySubscriptionRef` calls `listDunningAttemptsForInvoice` (apps/api/src/shared/services/dunning/queries.ts:80-94), which filters by the single *current dunnable* invoice's `invoiceId` 
> 
> *…trimmed (1267 more chars — see the cited files).*
> The finding is factually right about the mismatch, but its consequence is a superset response, not wrong behavior: SDK iteration still returns every item correctly. Real cost is limited to (1) an ignored `limit` on three low-traffic, read-only endpoints and (2) an unbounded response for long subscription audit trails / dunning histories. Fix by either paginating the three controllers to match list-subscriptions.ts, or softening python.mdx's 'every list()' claim (and the same claim in the other SDK docs, which likely repeat it). Severity: low, not medium.

---

## K47. ⚪ Docs registry pins @nombaone/node at 0.1.3; the manifest and npm `latest` are both 0.1.4

**What we publish**

apps/docs/src/lib/sdks/registry.ts:70 — `version: "0.1.3",` in the node entry, under a docstring (registry.ts:42) that says "Published semver. Bump here and nowhere else."

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-node/package.json:3 — `"version": "0.1.4",`. I also queried the registry: `npm view @nombaone/node versions` → ["0.1.0","0.1.1","0.1.2","0.1.3","0.1.4"] and `npm view @nombaone/node dist-tags` → `{ latest: '0.1.4' }`.

**Impact.** Small but real: /sdks/node's <SdkHeader> advertises v0.1.3 while `npm install @nombaone/node` (the install command the same page prints, unpinned) installs 0.1.4. Nothing breaks — 0.1.3 was genuinely released, so this is not a phantom pin — but the version badge is a credibility surface and it is one patch stale. This is a direct symptom of the check:sdks gate never reading the SDK manifest.

**Fix.** apps/docs/src/lib/sdks/registry.ts:70 — change `version: "0.1.3",` to `version: "0.1.4",`. Then make it un-driftable via the check:sdks manifest assertion described in the check:sdks finding.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/lib/sdks/registry.ts`

> **Refuter's correction — re-scopes this finding:**
> The finding is accurate as stated. Minor precision on impact: nothing installs or resolves 0.1.3 (the install command on the same page is unpinned, so `npm install @nombaone/node` fetches 0.1.4), and the registryUrl link is valid, so the only defect is a stale version badge rendered in two places — sdk-header.tsx:34 (`v{sdk.version}` on /sdks/node) and sdk-parity-matrix.tsx:53 (the /sdks matrix). Fix is a one-line bump of registry.ts:70 to "0.1.4"; the durable fix is teaching apps/docs/scripts/check-sdks.ts to read each sibling SDK's manifest (../nombaone-node/package.json, etc.) and fail when registry.version diverges.

---

## K48. ⚪ The PHP method index prints dot-notation (`customers.create`), which is string concatenation in PHP, on the page whose own prose promises `$nomba->customers->create`

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/content/sdks/php/reference.mdx:8-9 promises: "Every method in `nombaone/nombaone-php`, grouped by the namespace you reach it through on the client (`$nomba->customers->create`, `$nomba->plans->prices->create`…)". The index directly below it is `<SdkMethodIndex lang="php" />` (:13).

**What the code does**

/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx:62 joins every segment with a literal dot for ALL languages: `return [...namespace.map((n) => applyCase(n, style)), applyCase(method, style)].join(".");` — PHP's LANG_CASE entry (:45) only selects camelCase, never the separator. So the 75 rows render as `customers.create`, `plans.prices.create`, `subscriptions.dunning.listAttempts` — none of which is PHP (in PHP `.` is the string-concatenation operator; the object operator is `->`).

**Impact.** Cosmetic-but-credibility: on the PHP SDK's own reference page, every one of the 75 signatures is written in a syntax PHP does not have, one paragraph after the page told the reader it would use `->`. No integrator will ship it (they'd copy from the snippet, not the index), which is why this is low — but it is the page a PHP dev scans to learn the surface.

**Fix.** In /Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx, add a per-language separator (e.g. `const LANG_SEP: Record<SdkId, string> = { php: "->", elixir: ".", … }` defaulting to `"."`, plus a `$nomba` prefix for php) and use it in `signature()` at :61-63 instead of the hard-coded `.join(".")`. Go/.NET/Rust want their own separators too, but PHP is the one that reads as a different operator.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-turbo/apps/docs/src/components/mdx/sdk-method-index.tsx`

> **Refuter's correction — re-scopes this finding:**
> The finding is correct, with two refinements. (1) The row count "75" is unverified — the OpenAPI spec has 83 operations and getApiResources() filters scaffold paths (health, openapi.json, examples, sandbox), so the actual row count is under 83; the exact number is not load-bearing. (2) The auditor understated the evidence: the same codebase already renders PHP correctly elsewhere — apps/docs/src/lib/api-ref/snippets.ts:244 builds the PHP sample as `$nombaone->${call.namespace.join("->")}->${call.method}` — so the index contradicts the project's own PHP renderer, not just the page prose. (3) A second, independent PHP inaccuracy exists on the same page: the prose at reference.mdx:8-9 writes th
> 
> *…trimmed (441 more chars — see the cited files).*

---

## K49. ⚪ The SDK's CHANGELOG marks 0.1.0 "Unreleased" although it has been live on Hex since 2026-07-07

**What we publish**

/Users/mac/Vault/the-60/nombaone/nombaone-elixir/CHANGELOG.md:6: `## [0.1.0] — Unreleased`. (Relatedly, CHANGELOG.md:20 claims a "**Full resource surface** (78 methods)".)

**What the code does**

hex.pm's package API reports `releases: ['0.1.0']`, `latest_stable_version: 0.1.0`, `inserted_at: 2026-07-07T08:12:47.329059Z` for the `nombaone` package (whose `links.GitHub` is `https://github.com/nombaone/nombaone-elixir`, confirming it is this package). The version is genuinely published — so apps/docs/src/lib/sdks/registry.ts:184 `version: "0.1.0"` is CORRECT and this is not a phantom pin. The repo also carries no `v0.1.0` git tag (`git tag -l` is empty), despite CHANGELOG.md:34 linking `[0.1.0]: https://github.com/nombaone/nombaone-elixir/releases/tag/v0.1.0` — that link 404s.

**Impact.** An Elixir developer doing normal diligence (the Hex "Changelog" tab links straight here) sees the version they just added to `mix.exs` described as unreleased, and the changelog's own release-tag link is dead. It reads as an accidental publish. No integration breaks — hence low.

**Fix.** In /Users/mac/Vault/the-60/nombaone/nombaone-elixir/CHANGELOG.md, change line 6 from `## [0.1.0] — Unreleased` to `## [0.1.0] — 2026-07-07` (the Hex publish date), and push the missing tag so the line-34 link resolves: `git tag v0.1.0 && git push origin v0.1.0`.

**Files.** `/Users/mac/Vault/the-60/nombaone/nombaone-elixir/CHANGELOG.md`

> **Refuter's correction — re-scopes this finding:**
> The finding stands, with three corrections and one strengthening:
> 
> CORRECTIONS
> - Line numbers are each off by one: the `## [0.1.0] — Unreleased` heading is at CHANGELOG.md:**7**, the "78 methods" bullet at :**21**, the release-tag link at :**35**.
> - The "(78 methods)" parenthetical is unfounded and should be removed — 78 is EXACTLY correct (78 non-bang public functions across the 14 resource modules, each with a `!` twin).
> - Severity `low` is correct; no code reads the CHANGELOG, so nothing functional breaks.
> 
> STRENGTHENING (the auditor undersold the blast radius)
> - The stale heading is not local-only: `mix.exs` ships CHANGELOG.md in both `package.files` and `docs.extras`, and the LIVE publi
> 
> *…trimmed (500 more chars — see the cited files).*
> Two adjustments. (1) Broader than stated: the missing v0.1.0 tag does not only break CHANGELOG.md:34's link — mix.exs:90 sets source_ref: "v0.1.0", so EVERY ExDoc "source" link in the published HexDocs (all ~78 functions plus module headers, e.g. doc/Nombaone.Customers.html -> blob/v0.1.0/lib/nombaone/customers.ex#L131) points at a nonexistent tag and 404s. Same one-line fix (create and push the v0.1.0 tag at the published commit), but the credibility damage is docs-wide, not a single dead link. (2) The parenthetical about CHANGELOG.md:20's "78 methods" is not a defect — SUMMARY.md:17 corroborates it (83 OpenAPI ops - 5 excluded = 78) and test/integration/full_surface_test.exs covers all 78;
> 
> *…trimmed (108 more chars — see the cited files).*

---

# Verified correct — do NOT "fix" these

Auditors were required to report what they checked and found sound, so that nobody deletes something load-bearing while cleaning up.

- "REPLAY KEEPS THE ORIGINAL EVENT ID" (apps/docs/content/webhooks/retries-and-replay.mdx:55-59, delivery-guarantee.mdx:50-52) IS TRUE — verified against packages/sara/src/webhooks/deliveries.ts:147-157, which re-arms the existing row rather than inserting a new one.
- /v1/sandbox/* test instruments FAIL CLOSED — do not touch them. apps/api/src/apps/main/server/routes.ts:53 mounts testRouter ungated, but every route in apps/api/src/apps/main/modules/test/routes.ts sits behind `requireSandboxMode` (lines 41, 53, 64), and apps/api/src/shared/middlewares/sandbox-mode.ts:13 refuses anything that is not a sandbox key: `if (req.apiKey?.mode !== 'sandbox') { next(AppError.Forbidden(...)) }`. A live key gets a 403 on the test clock, the synthetic payment methods, and the webhook simulator. The handlers re-check ctx.mode as defence in depth. This is correct, deliberate, Stripe-shaped design.
- 57 of the 75 generated Java snippets name the correct method AND the correct params class — I compiled the non-trivial ones (customers create/update/grantCredit, plans update, subscriptions update/pause/change/resubscribe/updatePaymentMethod, paymentMethods setup, mandates create, coupons update, settlements refund, webhookEndpoints update) and every builder method, arity, and field name resolved. The emitter is close; it is the ~10 params-class derivations, the 6 method names, and the enum literals that are broken. Worth saying plainly: this is not a rewrite, it is a per-op override table.
- 61 of the 75 auto-generated .NET snippets DO compile against the real SDK. I generated all 75 from `buildOperationSnippets()` into one file and built it: 14 ops fail (OP9 customers/void-credit-grant, OP15 plans/prices/create, OP31 subscriptions/schedule/delete, OP34 subscriptions/schedule/create, OP41 payment-methods/delete, OP44 payment-methods/virtual-account, OP57 settlements/payout, OP59 webhooks/create, OP62 webhooks/update, OP69 events/retrieve, OP70 events/catalog, OP72 organization/update, OP74 organization/billing/update, OP75 metrics/billing). The other 61 build clean. This is materially BETTER than the established Go (75/75 broken: undeclared `ctx`) and Rust (75/75 broken: `Nombaone::new()` needs an api_key) results — the .NET snippet emitter is 81% correct, and the failures are a short, enumerable, fixable list, not a broken convention. Worth saying plainly so the .NET emitter is not thrown out with the Go/Rust ones.
- 70 of the 75 generated PHP snippets are correct end to end. I constructed the real client and reflected every emitted accessor chain: `$nombaone->plans->prices`, `$nombaone->subscriptions->schedule`, `$nombaone->subscriptions->dunning`, `$nombaone->organization->billing`, `$nombaone->webhookEndpoints->deliveries` and `$nombaone->paymentMethods` all exist as public readonly properties, and 70/75 methods resolve. The `webhooks` → `webhookEndpoints` and `payment-methods` → `paymentMethods` namespace remaps in sdk-map.ts:23-26 are correct for PHP.
- ALL NINE SDKs AGREE WITH THE SERVER ON THE BODY SHAPE AND THE DEDUPE KEY — they are the trustworthy side of finding 1. nombaone-node/src/webhook-events.ts:8-18, nombaone-python/src/nombaone/webhook_events.py:20-27, nombaone-go/webhook/webhook.go:16+99-103, nombaone-ruby, nombaone-php/src/Webhooks/WebhookEventTarget.php, nombaone-java/src/main/java/xyz/nombaone/webhook/WebhookEvent.java, nombaone-dotnet/src/NombaOne/Webhooks/WebhookEvent.cs, nombaone-rust/src/webhook_events.rs, nombaone-elixir/lib/nombaone/webhook_event.ex:14-19 all model `{ id (nbo…whd), type, event: { id (nbo…evt), type, createdAt }, data }` and all instruct "dedupe on `event.event.id`". That is exactly deliver.ts:177-184. Several even carry a defensive fallback for a flat body (node webhooks.ts:109-117, go webhook.go:99-103).
- API-KEY PREFIX / MODE DERIVATION: `nbo_sandbox_` / `nbo_live_` (packages/sara/src/api-keys/keys.ts:36-39); `verifyApiKey` re-derives the mode from the prefix and rejects a row mismatch (keys.ts:134-141, 168-174); live keys are refused on non-production deployments (middlewares/api-key.ts:105-111). The docs page (getting-started/authentication.mdx:17-45) describes this exactly right, and all nine SDKs pick their base host from the key prefix. Clean.
- APPLY-DISCOUNT ERROR SET — apps/api/src/shared/services/discounts/apply.ts emits exactly the codes the /errors page documents, with correct statuses: COUPON_NOT_FOUND (404, coupons/queries.ts:54), COUPON_EXPIRED / COUPON_MAX_REDEMPTIONS_REACHED (422, redeem.ts), CUSTOMER_NOT_FOUND (404, apply.ts:76-80), COUPON_ALREADY_APPLIED (409 when the customer already has an active discount, apply.ts:83-89). `cyclesRemaining` is derived correctly from duration (once→1, repeating→N, forever→null, apply.ts:100-101).
- AUTH + SCOPE CORRECTNESS (server side) — all 13 routes are correctly gated. customers/routes.ts: reads use `customers:read` (GET /customers, GET /customers/:id, GET /customers/:id/credit), writes use `customers:write` (POST, PATCH, POST/DELETE discount, POST/DELETE credit). coupons/routes.ts: `coupons:read` on both GETs, `coupons:write` on POST and PATCH. Every route runs `apiKeyAuth → rateLimit → requireScope → [idempotency] → validate → handler` in that exact order — no route is missing auth, and no read route carries a write scope. (The problem is that none of this reaches the docs — reported separately.)
- AUTH COVERAGE: I extracted the middleware chain for all 83 operations across the 18 module routers. Every business endpoint carries `apiKeyAuth` as the first middleware. The only unauthenticated routes are GET /v1/health, GET /v1/openapi.json, and GET /v1/events/catalog (and the ungated /v1/examples scaffold, already established). No business endpoint is missing auth.
- Accessor chains and method names in the 75 generated snippets are otherwise correct. I diffed every emitted `client.X.Y.Z` against the real service methods: beyond the 5 already-established fabrications (VoidCreditGrant→VoidCredit, PaymentMethods.Delete→Remove, Schedule.Cancel→Release, Events.RetrieveCatalog→Catalog, Metrics.RetrieveBilling→Billing), all remaining ~70 method names and every namespace chain (including the nested Plans.Prices, Subscriptions.Schedule, Subscriptions.Dunning, WebhookEndpoints.Deliveries, Organization.Billing) match the SDK exactly.
- All 75 emitted Elixir snippets are syntactically valid Elixir. I ran every one through `Code.string_to_quoted/1`: 0 syntax errors (including the trailing commas snippets.ts:167 leaves inside `%{…}`, which Elixir accepts).
- All 75 emitted namespace chains resolve to real modules (0 failures on `Code.ensure_loaded?/1`), including the nested ones — `Nombaone.Plans.Prices`, `Nombaone.Subscriptions.Schedule`, `Nombaone.Subscriptions.Dunning`, `Nombaone.WebhookEndpoints.Deliveries`, `Nombaone.Organization.Billing` — and the two renamed top-level ones (`payment-methods` -> `Nombaone.PaymentMethods`, `webhooks` -> `Nombaone.WebhookEndpoints`, sdk-map.ts:27-30). Arity is right on 70/70 of the resolving calls: client-first, then path args, then the params map.
- All naira arithmetic in the docs and SDKs for this group checks out at ₦1 = 100 kobo. content/concepts/money-is-integer-kobo.mdx:7 "`250000` is ₦2,500.00" ✓. nombaone-node/src/resources/payment-methods.ts:92 `amountInKobo: 5_000, // ₦50 validation charge` ✓. nombaone-node/src/resources/mandates.ts:79 `maxAmountInKobo: 500_000, // ₦5,000 ceiling per debit` ✓. The boundary converter `koboToNombaAmount = (kobo) => (kobo / 100).toFixed(2)` (packages/sara/src/nomba/money.ts:15) is applied at all three Nomba call sites in this group — setupCard (attach.ts:52), createMandate (attach.ts:124), issueVirtualAccount (attach.ts:186) — with no kobo amount escaping unconverted.
- All nine SDKs parse `hint` and `docUrl` off the wire into their error type (node/src/error.ts + core-types.ts, python/_exceptions.py, go/errors.go, ruby/lib/nombaone/errors.rb, php/src/Exceptions/ApiException.php, java/internal/Envelope.java, dotnet/Internal/ErrorFactory.cs, elixir/lib/nombaone/error.ex, rust/src/envelope.rs). The 'errors are a feature' payload does reach every SDK's user.
- Also compile-verified clean in dotnet.mdx: the pagination block (`NombaonePage<Invoice>`, `page.Data`, `page.HasNextPage`, `await page.NextPageAsync()`, `await foreach … ListAutoPagingAsync`) against NombaonePage.cs:54-84; the error block (`ValidationException.Fields`, `RateLimitException.RetryAfter`, `NotFoundException.Code`, `NombaoneApiException.Code/.Hint/.RequestId`) against ApiExceptions.cs — every one of the 8 rows in the status→class table (400/401/403/404/409/422/429/5xx) matches a real sealed class; `NombaoneErrorCodes.CustomerNotFound` (NombaoneErrorCodes.cs:72); `Optional<string>.Null` for clearing (Optional.cs); `model.RawResponse.StatusCode` + `model.RequestId`; the sandbox block (`SandboxPaymentMethodParams.Behavior`, `AdvanceCycleAsync(...).Outcome`, `SimulateWebhookAsync(new SandboxSimulateWebhookParams { Type })`).
- BillingMetrics, Settlement, WebhookEndpoint, WebhookDelivery, DomainEvent, RotatedWebhookSecret response schemas — CLEAN. Each OpenAPI mirror in responses.ts (BillingMetrics:341-352, Settlement:219-231, WebhookEndpoint:233-241, WebhookDelivery:242-256, RotatedWebhookSecret:257-262, DomainEvent:263-269) matches its DTO exactly, including every status enum (SettlementStatus, WebhookDeliveryStatus, RefundStatus, PayoutStatus) and every nullable. The only exception is the missing `signingSecret` on the create path, reported separately.
- Both docs honesty gates are GREEN and prove nothing: `check:sdks` → "OK — 9 SDKs, each with a guide + generated reference; identity facts single-sourced from registry.ts"; `check:api-ref` → "OK — 13 resources, 75 operations, 750 snippets across 10 languages". Neither gate compiles or type-checks a single emitted snippet, which is why 75/75 non-compiling Go samples ship. Worth knowing: the existing CI cannot catch any finding in this report.
- CONSOLE AND CHECKOUT MONEY MATH IS CORRECT. apps/console/src/lib/money.ts (`naira`, `nairaShort`, `toKobo`) and apps/checkout/src/lib/format.ts (`formatKoboAsNGN`) all divide/multiply by exactly 100 with `Math.round`, never storing a float. I verified `nairaShort`'s own doc examples by hand (34000000 kobo → ₦340k; 482000000 → ₦4.82M — both correct). Every console form parses naira and multiplies to kobo exactly once (toKobo call sites in plans-actions.ts, credit-actions.ts:21, engine-actions.ts:334/362, coupons-actions.ts:18). Checkout reads the correct `example.amountInKobo` field.
- COUPON REDEMPTION SAFETY — `redeemCoupon` (coupons/redeem.ts:35-57) does a single conditional `UPDATE … SET times_redeemed = times_redeemed + 1 WHERE id = ? AND (max_redemptions IS NULL OR times_redeemed < max_redemptions) RETURNING`, so over-redemption is structurally impossible under concurrency — no read-modify-write race. The zero-row result correctly maps to COUPON_MAX_REDEMPTIONS_REACHED. `assertRedeemable` (redeem.ts:12-27) correctly gates on `redeemBy` and the cap before that.
- Cancel-at-period-end is genuinely honored: the flag raised by cancelSubscription({mode:'at_period_end'}) (transition.ts:120-140) is read at the boundary by runCycle (runCycle.ts:69-72 → cancelAtBoundary) and emits `subscription.canceled` (voluntary), matching the event catalog.
- Console data is REAL, not fabricated. apps/console/src/lib/settlements.ts imports settlementsTable/payoutsTable/invoicesTable/customersTable and issues genuine Drizzle selects scoped by session org+mode; the `bar: [{ grow: 0, c: 'bg-accent' }...]` values that look like fixtures are CSS flex-grow weights driven by real kobo figures, and the zero-valued ones are the honest empty-state. apps/console/src/lib/test-instruments.ts:30-50 also reads real customers/subscriptions. No placeholder rows anywhere in the console.
- Console navigation has no dead entries. All 13 hrefs in apps/console/src/lib/nav.ts (/, /subscriptions, /customers, /plans, /invoices, /payments, /dunning, /settlements, /coupons, /developers, /reconciliation, /settings) have real page.tsx files under apps/console/src/app/(app)/. Nothing links to an unbuilt screen.
- DEDUPE-KEY STABILITY — RESOLVED BY READING THE CODE. Both candidate keys are in fact stable across retries AND replays, so the SDKs' guidance is correct and the docs' is merely mislabeled (see finding 1). Proof: the delivery row's `reference` is minted exactly once, at fan-out (packages/sara/src/events/emit.ts:85 `reference: mintReference('WHD')`), and nothing ever re-mints it — deliver.ts:117-144 only ever `.set({ status, attempts, lastAttemptAt, responseStatus, nextAttemptAt })`, and `replayDelivery` (packages/sara/src/webhooks/deliveries.ts:147-157) re-arms the SAME row (`status: 'pending', attempts: 0, replayCount + 1`) without touching `reference` or `eventId`. So the body's top-level `id` (`nbo…whd`) and nested `event.id` (`nbo…evt`) are both byte-identical on every attempt of a given delivery. The correct key is `event.id`: it is the one that identifies the EVENT (shared across endpoints and stable across a re-fan-out), and it is the only one that resolves against `GET /v1/events/{id}`.
- DELIVERY + REPLAY ENDPOINT PATHS ARE CORRECT in the docs. apps/docs/content/webhooks/retries-and-replay.mdx:36,40,51 and apps/docs/content/guides/handle-webhooks.mdx:103 document `GET /v1/webhooks/{id}/deliveries`, `GET /v1/webhooks/{id}/deliveries/{deliveryId}`, and `POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay` — all three match apps/api/src/apps/main/modules/webhooks/routes.ts:38-40 exactly, including the `:deliveryId` inner param name.
- DEPLOYMENT REALITY (the answer to your per-app question): the ONLY app with deploy configuration in this repo is apps/api — apps/api/Dockerfile, apps/api/.do/app.yaml (`name: nombaone-api-production`, DigitalOcean App Platform, `github.repo: emekaorji/nombaone`, `deploy_on_push: false`), and .github/workflows/deploy-api.yml (the sole workflow). apps/console, apps/admin, apps/checkout and apps/website have NO Dockerfile, NO vercel.json, NO .vercel directory, and NO workflow. They are certainly deployed via dashboard-configured Vercel/host projects outside the repo (console.nombaone.xyz and nombaone.xyz are live), which means their deploy config is invisible to source control — I flagged findings against console and website as LIVE because the canonical hosts confirm they are up. For checkout and admin, whose hosts are NOT in the canonical set, I could not prove deployment either way; confirm those two yourself before treating them as safe.
- DOCS_ERRORS_BASE = 'https://docs.nombaone.xyz/errors' (codes.ts:343) matches the canonical host, and the errors.md frontmatter canonical agrees. No stale nombaone.com / app.nombaone.xyz host in the error contract.
- Doc claims about SDK behavior that I verified in source rather than taking on faith: 'Idempotency is automatic — a UUID key is generated for every POST and reused across retries' → `Internal/HttpTransport.cs:72` `var idempotencyKey = isPost ? (options?.IdempotencyKey ?? Guid.NewGuid().ToString("D")) : null;` computed BEFORE the retry loop (`:186` merges it into headers) — true. 'Every Sandbox method throws locally, before any network call, if the client holds a live key' → `Resources/Sandbox.cs:110,132,157` each call `AssertSandbox()` as the first statement — true. 'The environment and host are derived from the key prefix' → `Nombaone.cs:145-158 DeriveMode` on `nbo_sandbox_`/`nbo_live_` + `SandboxBaseUrl`/`LiveBaseUrl` — true.
- ERROR-CODE PUBLICATION: every code the cross-cutting middleware can throw — API_KEY_MISSING, API_KEY_INVALID, API_KEY_SCOPE_FORBIDDEN, API_KEY_ENVIRONMENT_MISMATCH, API_KEY_HOST_MISMATCH, IDEMPOTENCY_KEY_MISSING/REUSED/IN_PROGRESS, RATE_LIMIT_EXCEEDED, QUOTA_EXCEEDED, PLATFORM_MAINTENANCE, CLIENT_VALIDATION_FAILED, INVALID_CURSOR — is in PUBLIC_ERROR_CODES (codes.ts:260-330), has a real actionable hint, and a docUrl anchored to the error reference. No leaked internal code, no missing public one.
- ERROR_CODE_META is provably exhaustive: it is typed `Record<NombaoneErrorCode, ErrorCodeMeta>` (codes.ts:363), so a code added without a hint+docUrl fails type-check. I confirmed all 115 codes have an entry. No missing hints.
- EXHAUSTIVE COMPILE PROOF — 70 of the 75 auto-generated node snippets are CORRECT. I emitted all 75 via buildOperationSnippets(op).node, concatenated them into a single .ts file inside the real SDK repo, and ran the SDK's own TypeScript: `tsc --noEmit --strict --module nodenext --moduleResolution nodenext`. Exactly 5 errors, all of them the 5 already-established fabricated names. Every other accessor chain, positional path argument, and body param name type-checks against the real @nombaone/node. This makes node's snippet defect ISOLATED (5 ops), not SYSTEMATIC — a materially different (and far better) situation than Rust (75/75 broken constructor) or Go (75/75 undeclared ctx).
- Enum values in the generated snippets are NOT a compile error, despite looking like one. `Interval: "day"`, `Mode: "now"`, `Duration: "once"`, `SettlementMode: "split_at_collection"` assign untyped string constants to defined string types (PriceInterval, CancelMode, CouponDuration, SettlementMode) — legal Go. I verified this with the compiler; it is a style gap (the SDK ships named constants), not a defect, so I did not report it.
- Escrow arithmetic — CLEAN and correctly described in prose. `available = max(0, balance − locked − minBuffer)` (apps/api/src/shared/services/settlement/escrow.ts:73) matches the guide's "Available balance for payout is the settled net minus the escrow lock (and any minimum buffer)" (guides/refunds-payouts-settlement.mdx:50-51). The lock sums only `net_to_tenant_kobo` over `settled`/`reconciled` settlements inside the window (escrow.ts:36-46), correctly excluding already-refunded rows so the lock cannot be inflated. The payout guard re-derives the same three numbers inside the transaction under a `FOR UPDATE` row lock (payout.ts:52-63), so the read endpoint and the write guard cannot disagree.
- Every error code cited in the SDK doc-comments for this group is real and defined: `PAYMENT_METHOD_NOT_FOUND` (packages/errors/src/codes.ts:145), `PAYMENT_METHOD_KIND_MISMATCH` (:147), `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` (:160), `INVOICE_NOT_FOUND` (:161), `INVOICE_NOT_VOIDABLE` (:164), plus the four mandate codes (:146-150). No fabricated code names. (Four of them are never thrown — reported separately — but none are invented.)
- Every hand-written sample in content/sdks/ruby.mdx runs against the real gem. I executed them: the full first-subscription flow (plans.create → plans.prices.create(plan.id, unit_amount_in_kobo:, interval:) → customers.create → sandbox.create_payment_method(customer_id:) → subscriptions.create) resolves method-for-method; `page.data` / `page.has_more?` / `page.next_page?` / `page.next_page` / `auto_paging_each` / `first(3)` all exist (pagination.rb:26-77); `.request_id` exists; `nombaone.mode` returns "sandbox" and `nombaone.base_url` returns https://sandbox.api.nombaone.xyz; all five documented `request_options:` keys (`:idempotency_key`, `:headers`, `:timeout`, `:max_retries`, `:cancel_when`) are honored by `internal/http_client.rb:113-166`, and `max_retries: 0` really does fail fast (Ruby's `0` is truthy, so the `||` fallback doesn't clobber it); `Nombaone::ErrorCode::CUSTOMER_NOT_FOUND` resolves; the 8-row error class table matches `errors.rb:216-249` exactly.
- Every money field on the Invoice DTO is correctly named and typed. `subtotalInKobo`, `discountTotalInKobo`, `creditTotalInKobo`, `totalInKobo`, `amountDueInKobo`, `amountPaidInKobo`, `amountRemainingInKobo` (packages/core-contracts/src/types/invoice.ts:36-42) and the line-item `amountInKobo` (:21) all carry the `InKobo` suffix and are declared `int()` in the OpenAPI mirror (apps/api/src/shared/openapi/responses.ts:126, 136-142). `maxAmountInKobo` on mandate-create and `amountInKobo` on card-setup are likewise correctly suffixed. `expectedAmount` is the sole violator (reported).
- Every other registry.ts fact for node checks out against the manifest: package `@nombaone/node` (package.json:2); registry npm; languageFloor "Node.js 22+" == `"engines": {"node": ">=22"}`; install `npm install @nombaone/node`; clientClass `Nombaone` (client.ts:76, and it IS the default export, index.ts:198); errorModel "Typed exception hierarchy" (error.ts exports 12 classes); webhookHelper `webhooks.constructEvent` (webhooks.ts:87, exported at index.ts:32). Only `version` is wrong.
- Every other registry.ts:139-152 fact for java checks out against the real pom.xml/source: `package: "xyz.nombaone:nombaone"` == pom groupId `xyz.nombaone` + artifactId `nombaone`; `registry: "Maven Central"` == the central-publishing-maven-plugin release profile in pom.xml; `languageFloor: "Java 17+"` == pom.xml `<maven.compiler.release>17</maven.compiler.release>`; `install: 'implementation("xyz.nombaone:nombaone:0.1.0")'` is a valid Gradle line for that exact GAV; `clientClass: "xyz.nombaone.Nombaone"` == `public final class Nombaone` in src/main/java/xyz/nombaone/Nombaone.java; `async: "Synchronous"` (every resource method blocks and returns the DTO directly); `errorModel: "Unchecked exceptions"` == error/NombaoneException.java:22 `public class NombaoneException extends RuntimeException`; `webhookHelper: "webhooks()"` == Nombaone.java `public Webhooks webhooks()`.
- Every scope in `requireScope(...)` is a real member of `ApiKeyScope` (packages/core-contracts/src/types/api-key.ts:4-30). Invoices use `invoices:read`/`invoices:write`; payment-method reads use `payment_methods:read` and writes `payment_methods:write`. `GET /v1/mandates/:id` uses `payment_methods:read` rather than a `mandates:read` — that is CORRECT, not a bug: no `mandates:read` scope exists in the enum (only `mandates:write` at :13), and the endpoint reads a `payment_methods` row. Worth documenting, but the code is self-consistent.
- Every webhook event `data` shape in the SDK matches the server's frozen catalog field-for-field. nombaone-node/src/webhook-events.ts vs packages/core-contracts/src/types/webhook-events.ts: invoice.action_required → {reference, reason, checkoutLink}; invoice.payment_failed → {reference, reason}; invoice.payment_partially_collected → {reference, amountPaid, amountRemaining}; payment_method.attached → {reference, kind, status}; payment_method.updated → {reference, subscription}; coupon.created → {reference, code}; subscription.created → {reference, status}. The `event.data.checkoutLink` / `event.data.reason` / `event.data.reference` accesses in node.mdx:205-207 are all real and correctly typed.
- Five of nine SDKs (ruby, php, dotnet, elixir, rust) carry exactly all 72 public codes — complete and correct.
- I chased and KILLED a suspected critical: the Node SDK's mandate guidance "Don't poll; listen for the webhook" (nombaone-node/src/resources/mandates.ts:60-61) appears to contradict the API controller's comment "activation is poll-only — no webhook" (apps/api/.../get-mandate-status.ts:13). It is NOT a bug. A server-side sweep does the polling for you: apps/api/src/services/worker/modules/cron/jobs-handlers/mandate-activation-sweep.ts:44 calls `pollMandateActive` for every `consent_pending` mandate on `MANDATE_ACTIVATION_SWEEP_CRON` (default `*/10 * * * *`, apps/api/src/shared/config/env.ts:112), registered at cron/index.ts:62-63; `pollMandateActive` emits `payment_method.updated` on promotion (capture.ts:107-111). The SDK's advice is correct and the mandate WILL activate without the integrator polling.
- I did NOT find a second webhook-scheme divergence beyond the one already established. nombaone-rust/src/webhooks.rs implements exactly the Stripe-style scheme the other eight SDKs do (compute_signature = HMAC-SHA256 over `{t}.{raw_body}` with the plaintext secret; header parsed as `t=<unix>,v1=<hex>`; DEFAULT_TOLERANCE_SECONDS = 300 at webhooks.rs:38; constant-time compare via subtle). It is internally consistent and its doctest passes. The mismatch with the server's bare-hex `x-nombaone-signature` is the already-known docs+SDK-wide bug, identical in Rust — I have nothing new to add to it.
- I left the tree clean — the two throwaway enumeration scripts I wrote were run from and deleted from the scratchpad directory, and nothing was written into the repo. (Note: `apps/docs/scripts/_tmp-dump-json.ts` and `_tmp-dump-python.ts` show as untracked in git status but are NOT mine — they pre-date this session.)
- IDEMPOTENCY EMISSION IN THE SDKS: every SDK computes the Idempotency-Key once, before the retry loop, and sends it on POST only (nombaone-node/src/internal/http.ts:53-54; nombaone-python/src/nombaone/_client.py:161-165; nombaone-go/option.go:90; nombaone-elixir/lib/nombaone/util.ex:36). That matches the server's POST-only middleware exactly — the SDKs are the honest side here; the spec is not.
- IDEMPOTENCY MIDDLEWARE PLACEMENT — the strict-vs-optional split is deliberate and correct at the route level: `idempotency` (strict) only where money moves (POST /customers/:id/credit, routes.ts:112; DELETE /customers/:id/credit/:grantId, routes.ts:128), `idempotencyOptional` everywhere else. Worth flagging for the record: the DELETE gets no idempotency protection at all, because idempotency.ts:52-55 early-returns for any non-POST method — but that is harmless here, since voidCreditGrant is already idempotent by construction (void.ts:54-57).
- Idempotency WIRING (as distinct from its documentation): the strict `idempotency` middleware really is on the four money-moving ops (create, cancel, resubscribe, change) and `idempotencyOptional` on the rest — the router's own comment (routes.ts:44-52) is accurate.
- Idempotency on the two money-movement POSTs — CLEAN. `POST /v1/settlements/payout` and `POST /v1/settlements/{id}/refund` both use the STRICT `idempotency` middleware (settlements/routes.ts:25, :29), both docs curls correctly include `-H "Idempotency-Key: $(uuidgen)"` (guides/refunds-payouts-settlement.mdx:24, :61), and both spec entries mark it required. The header is threaded through as the durable `merchantTxRef` and backed by a DB `unique(merchant_tx_ref)` claim (create-payout.ts:27-34, refund-settlement.ts:26-33; payout.ts:102 / refund.ts:94 `.onConflictDoNothing({ target: …merchantTxRef })`), so the Redis layer degrading fail-open cannot cause a double payout. This is the one place the docs, the spec, and the middleware all agree.
- Keyset pagination on both list endpoints is consistent: `limit` is `z.coerce.number().int().min(1).max(100).default(20)` on both `listInvoiceQuery` (validations/invoice.ts:7) and `listPaymentMethodQuery` (validations/payment-method.ts:6), the spec renders both with `minimum:1, maximum:100, default:20`, and both `paginatedHandler` controllers thread `nextCursor`/`hasMore` into `meta.pagination` as the ResponseMeta schema (build.ts:167-179) advertises. The list filter param names also match the code: invoices take `customerId`/`subscriptionId` while payment-methods take `customerRef` — an inconsistency in taste, but the docs, spec, and SDK (nombaone-node/src/resources/payment-methods.ts:70 even calls it out: "Note the wire name is `customerRef`") all state it correctly.
- LEDGER CORRECTNESS FOR CREDIT — grant posts a balanced `adjustment` (debit platform_revenue / credit the customer_credit liability, grant.ts:57-64) and void reverses ONLY the unconsumed remainder (void.ts:61-75), which is the right call: reversing the original full posting would over-reverse a partially-consumed grant. Balance is read O(1) from the materialized ledger account, never summed from grants (credits/balance.ts:16-33). The maths is sound.
- MOCK RAILS ARE SAFE — DO NOT PANIC, AND DO NOT LEAVE THEM EITHER. packages/sara/src/rails/index.ts:15-16 unconditionally runs `registerRail(mockPullRail); registerRail(mockPushRail);` at import, in production, and packages/sara/src/rails/mock.ts:16 has mock_pull return `{ status: 'succeeded' }` without touching a network. That LOOKS like a catastrophic free-money path. It is not: I traced every caller of `getRail`, and the ONLY place that ever asks for a mock is packages/sara/src/example/create.ts:123 `await getRail('mock_pull').collect({...})`. The real billing path never can — apps/api/src/shared/services/dunning/attempt.ts:204 calls `getRail(railKeyForMethod(method.kind))`, and railKeyForMethod (apps/api/src/shared/services/billing/effects.ts:28-30) maps only over real PaymentMethodRow kinds via RAIL_KEY_BY_KIND, which contains no mock key. The rail key is never taken from user input. So the mock rails are reachable ONLY through POST /v1/examples. Conclusion: they are not an independent vulnerability, but they die with the example slice — delete registration at rails/index.ts:15-16 in the same pass, not before (packages/sara/src/example/create.ts imports them).
- MONEY / kobo naming invariant — CLEAN across the whole group. Every money field on every DTO ends in `…InKobo` and is an integer: SettlementResponseData.{grossInKobo, platformFeeInKobo, netToTenantInKobo}, RefundResponseData.amountInKobo, PayoutResponseData.amountInKobo, EscrowResponseData.{lockedInKobo, balanceInKobo, minWithdrawableInKobo, availableInKobo}, BillingMetricsData.mrrInKobo, TenantSettingsResponseData.billing.platformFee.{minInKobo, maxInKobo} (packages/core-contracts/src/types/settlement.ts, metrics.ts, settings.ts). The DB columns are `*Kobo` and the serializers rename them at the boundary exactly once (apps/api/src/shared/services/settlement/serialize.ts:20-22, :35, :45, :57-60). Request bodies match: `amountInKobo` on both createPayoutBody and refundSettlementBody (packages/core-contracts/src/validations/settlement.ts:12, :18), both `z.number().int().positive()`. No float, no naira-unit field, no bare `amount`. I found no money-naming violation in this group.
- MONEY ARITHMETIC in the plans/prices guide is exact. apps/docs/content/guides/create-plans-and-prices.mdx:27-33: 500000 kobo = ₦5,000 ✓; 5000000 kobo = ₦50,000 ✓; and "two months free on the annual price" is right (₦5,000 × 12 = ₦60,000 vs ₦50,000 annual → ₦10,000 = exactly 2 months). Line 65: `250000` = ₦2,500.00 ✓. Same figures in content/concepts/money-is-integer-kobo.mdx:22-28 and every SDK page (node/python/ruby/php/java/rust all show 250_000 = ₦2,500.00). I checked every naira figure in the group; all arithmetic is correct.
- MONEY ARITHMETIC — every naira figure in the group's prose checks out. apps/docs/content/guides/coupons-and-credits.mdx:28-32: "₦500 off, once" with `amountOffInKobo: 50000` → 50000/100 = ₦500 ✔. samples.ts:17 comment `250_000; // ₦2,500.00` → 250000/100 = ₦2,500 ✔. The credit example (`amountInKobo: 100000`, line 69) makes no naira claim, so nothing to contradict.
- MONEY NAMING — every money field in this group is integer kobo and correctly suffixed. Request: `unitAmountInKobo` (packages/core-contracts/src/validations/price.ts:13, `z.coerce.number().int().positive()` — I confirmed a float `2500.5` is rejected with 'Expected integer, received float'). Response: `unitAmountInKobo: number` (packages/core-contracts/src/types/price.ts:20) ← `serializePrice` (apps/api/src/shared/services/prices/serialize.ts:14 `unitAmountInKobo: row.unitAmount`). No money field in the plans/prices surface is missing the `…InKobo` suffix. `currency` is pinned `'NGN'` in the DTO, the serializer and the OpenAPI schema.
- MONEY NAMING — every money field on the wire in this group obeys the `…InKobo` invariant: `amountOffInKobo` (Coupon), `amountInKobo` + `remainingInKobo` (CreditGrant), `balanceInKobo` (CreditBalance). Verified in packages/core-contracts/src/types/{coupon,credit}.ts, the serializers (apps/api/src/shared/services/{coupons,credits}/serialize.ts) and the OpenAPI mirrors (responses.ts:155-201). The internal service inputs use bare `amountOff`/`amount` (coupons/types.ts:7, credits/types.ts:13) but those never reach the wire — the controllers map `body.amountOffInKobo → amountOff` (create-coupon.ts:25) and `body.amountInKobo → amount` (grant-customer-credit.ts:26). No naked `amount`/`price` field is exposed. No money field is a float anywhere.
- MONEY: every money field on this surface is integer kobo and correctly named `…InKobo` — UpcomingInvoice.subtotalInKobo / totalInKobo / amountDueInKobo and lineItems[].amountInKobo (upcoming.ts:54-65). The Subscription DTO carries no money field at all, so there is nothing to mis-unit; no naked `amount`/`price` field exists anywhere in the subscriptions group.
- Multi-tenant scoping on every read in the group — CLEAN. Every query is pinned to both `ctx.organizationId` AND `ctx.mode`: settlements (queries.ts:26-30, :65-71), events (get-event.ts:21-27, listDomainEvents), webhook endpoints (packages/sara/src/webhooks/endpoints.ts:75-81, :157-161), and webhook deliveries — which correctly enforce mode via an inner join to the endpoint table because the deliveries row carries `organization_id` but not `mode` (packages/sara/src/webhooks/deliveries.ts:50-56, :104-110). Unknown/foreign references raise NotFound rather than leaking existence (endpoints.ts:193-201). No cross-tenant leak found.
- N1 (no secrets on the wire) holds structurally. `serializePaymentMethod` (apps/api/src/shared/services/payment-methods/serialize.ts:10-27) copies only domain/id/customerId/kind/status/isDefault/brand/last4/expMonth/expYear/mode/createdAt/updatedAt — `tokenKey`, `mandateId`, and `accountRef` are never projected onto the DTO, the OpenAPI `PaymentMethod` schema (apps/api/src/shared/openapi/responses.ts:203-217) matches that field set exactly, and the e2e asserts it (apps/api/test/e2e/payment-methods.e2e.test.ts:80 `expect(JSON.stringify(pending.body.data)).not.toContain('token')`). `captureCardToken` (capture.ts:33) stores only `cardPan.replace(/\D/g,'').slice(-4)` — no PAN is persisted.
- NO DEBUG LOGGING IN ANY REQUEST PATH. A sweep for `console.(log|debug|dir|trace)` across apps/api/src and all six packages returns only benign hits, every one of which should be KEPT or is already inert: packages/utils/src/scripts.ts:11-24 is a deliberate CLI script-runner harness printing 'Running script...' / 'Done in: Ns' (it is not imported by the server), and packages/utils/src/id.ts:52 plus packages/utils/src/randomId.ts:63-65 are COMMENTED-OUT usage examples (`// console.log(generateId()); // ex. yUGfydtC`). Zero stray debug output reaches a production request. Structured logging goes through the real logger (@shared/observability/logger) throughout.
- NO PHANTOM DELETE — the task brief mentions "delete", but neither customers nor coupons has a DELETE-the-resource endpoint, and crucially the docs do not claim one: apps/docs/src/lib/api-ref/model.ts derives operation pages only from paths present in the spec, so no "Delete a customer" or "Delete a coupon" page is generated. Nothing to fix.
- NO SDK TYPES MONEY AS A FLOAT OR DECIMAL. I grepped all nine SDKs for float/double/decimal/BigDecimal/f64/f32 adjacent to money identifiers. Every money field is an integer: Go `Kobo = int64`, Rust `Kobo = i64`, Java `long`/`Long`, C# `long?`, Python/Ruby/PHP `int`, Node `Kobo = number` (integer by contract). The only `f64` hit (nombaone-rust/examples/05_sandbox_cycle.rs:74, `total_in_kobo as f64 / 100.0`) is display formatting, not a wire type — correct.
- NO UNIMPLEMENTED OR THROWING PLACEHOLDER FUNCTIONS. A case-insensitive sweep for `throw new Error(...not impl|unimplemented|todo|stub...)` across apps/api/src and packages/*/src returns ZERO hits. There is no NotImplementedError, no 501 handler, no 'coming soon' response anywhere in the API or the packages. The single 'Stub' in a money path (packages/sara/src/example/confirm.ts) is dead code with no caller and is covered as finding 7. Likewise no TODO/FIXME/XXX/HACK markers survive in shipped API or package source — the only grep hits for those terms are the self-describing example-slice comments and one legitimate doc comment at apps/api/src/shared/openapi/build.ts:76 about OpenAPI path `{param}` placeholders (a correct technical use of the word 'placeholder', not a stub).
- Naira arithmetic in the subscription docs is correct: your-first-subscription.mdx:62,71 `250000` kobo = ₦2,500.00 and the closing prose "an invoice for ₦2,500" agrees; coupons-and-credits.mdx:29-31 `amountOffInKobo: 50000` = "₦500 off" agrees.
- No 422-on-first-call from the generated snippets: the key-casing round-trip is correct. snippets.ts:167 emits Elixir body keys in snake_case (`unit_amount_in_kobo: 250_000,`), and the real SDK deep-camelizes them before they hit the wire — params.ex:22 `def encode_body(map) when is_map(map), do: deep_camelize(map)` via util.ex:23-28 `camelize/1` — producing exactly the `unitAmountInKobo` that CreatePriceBody requires (apps/api create-plan-price.ts:29 `unitAmount: body.unitAmountInKobo`). Verified `metadata`/`payload` are correctly exempted (params.ex:12).
- No Python 3.10+-only syntax anywhere in src/ (no PEP 604 'X | Y' in runtime positions, no match statements, no typing.Self), and every module carries 'from __future__ import annotations', so the advertised 3.9 floor is plausible. CAVEAT — I could NOT fully establish this: no 3.9 interpreter was available in the environment (pyenv has 3.11/3.13 only), so this is a static scan, not an executed import on 3.9.
- No SDK invents a code. I diffed all nine SDK code lists against the enum — every ALL_CAPS code-shaped token in each list is a real enum member. The only non-code tokens are the container names themselves (PUBLIC_ERROR_CODES, KNOWN_ERROR_CODES, CLASS_FOR_STATUS, DEFAULT_CODE_FOR_STATUS) and python's config constants.
- No `example.*` EVENT leak. `lib/nombaone/webhook_event.rb:13-46` ships a 32-entry `WebhookEventType::ALL` that correctly excludes the two scaffold events, and its comment says so. The gem's own `spec/conformance/openapi_coverage_spec.rb:22-28` deliberately excludes the three `/v1/examples` routes from the SDK surface, so no example endpoint is reachable from the Ruby client. (The one leak that DID get through is the error code — reported above.)
- No `example.*` scaffold in the Java SDK's webhook surface: WebhookEventType.java lists 30 real event-type constants (customer.*, plan.*, price.*, subscription.*, invoice.*, payment_method.*, settlement.*) and contains no `example.created`. The webhook/ package's 8 typed event records + GenericEvent are all real domain events. (The scaffold leak I did find is in error/ErrorCode.java, reported separately.)
- No `example.*` scaffold types in the .NET SDK's model/resource surface. I grepped every `.cs` under `src/`: there is no `Example` resource class, no `ExampleResource` property on the client, no `example.created` in `WebhookEventTypes.cs`, and no `/v1/examples` path in any `RequestSpec`. The ONLY leak is the single `NombaoneErrorCodes.ExampleNotFound` constant (reported above). The client's 14 resource namespaces (`Nombaone.Resources.cs:44-58`) are all real product surface.
- No dead public codes: every one of the 72 members of PUBLIC_ERROR_CODES is actually referenced/thrown somewhere in apps/api/src or packages/sara/src. The registry has no aspirational entries.
- No invented error codes in docs PROSE. I regex-swept all of apps/docs/content for code-shaped ALL_CAPS tokens and diffed against the 115-member NOMBAONE_ERROR_CODES enum: the only non-enum hits are the env vars NOMBAONE_API_KEY (47x), NOMBAONE_WEBHOOK_SECRET (7x), NOMBAONE_BASE_URL (1x). The single invented code (VALIDATION_FAILED) is inside a json sample, reported separately.
- No other docs surface hand-writes Ruby. `grep -rln '```ruby' content/` returns exactly one file (`content/sdks/ruby.mdx`), so there is no third body of stale hand-written Ruby hiding in the guides. `content/sdks/ruby/reference.mdx` is a 13-line shell with a single generated component — nothing hand-typed to drift.
- Not re-reported (already in your established list, and I confirmed each still holds): /v1/examples mounted ungated at routes.ts:48; GET /v1/events/catalog unauthenticated with '(reference scaffold)' text; docs /reference/examples and the 'Example (deletable)' section; DELETE-ME-EXAMPLE.md at repo root; OpenAPI 200-for-all-creates; Idempotency-Key required:true on all 44 mutating ops; the quickstart amount/amountInKobo 422; the Stripe-vs-bare-hex webhook signature divergence; the 5 fabricated SDK method names; the Rust/Go snippet compile failures.
- Only 9 real codes are quoted anywhere in apps/docs/content (API_KEY_INVALID, API_KEY_SCOPE_FORBIDDEN, CUSTOMER_NOT_FOUND, ESCROW_LOCKED, PAYOUT_EXCEEDS_AVAILABLE, SETTLEMENT_SUBACCOUNT_NOT_FOUND, SUBSCRIPTION_ILLEGAL_TRANSITION, SUBSCRIPTION_PAYMENT_METHOD_REQUIRED, SYSTEM_UPSTREAM_ERROR) and ALL NINE are members of PUBLIC_ERROR_CODES. No doc quotes a code that would collapse on the wire.
- Ops 1, 20, 42, 45 and the other 32 snippets NOT in my 'beyond Nombaone::new()' list are otherwise structurally sound — `nombaone.customers().create(CustomerCreateParams { email: "ada@example.com".into(), name: "Ada Lovelace".into(), ..Default::default() })` and `nombaone.subscriptions().create(SubscriptionCreateParams { customer_id: …, price_id: …, ..Default::default() })` name real methods, real types, real fields, in the right order. Fixing the one-line `Nombaone::new()` → `Nombaone::from_env()` bug repairs those 32 ops outright.
- PAGINATION PARSING IN THE SDKS: the SDKs read the REAL envelope — top-level `pagination` with `{limit, hasMore, nextCursor}` (nombaone-node/src/internal/envelope.ts:31-44, core-types.ts:49-54) — and degrade safely to a single page when the block is absent (pagination.ts:26-30). The limit contract (1–100, default 20) is identical in every list query schema in core-contracts and in every SDK's docstring. The `cursor` is opaque and INVALID_CURSOR is a public error code with a correct hint (packages/errors/src/codes.ts:389-390).
- PAGINATION — GET /v1/customers and GET /v1/coupons are genuinely keyset-paginated on `(created_at desc, id desc)` off the raw rows (customers/queries.ts:78-95, coupons/queries.ts:85-96), the cursor encodes the internal UUID not the public reference, and `hasMore`/`nextCursor` land in `meta.pagination` exactly as the spec's `ResponseMeta` declares. `clampLimit` backstops the zod max. No COUNT(*), no OFFSET, no drift.
- PATH/METHOD/AUTH AND THE REMAINING PARAMS ARE ALL CORRECT. All 10 operations in openapi.json exist on the mounted router (the spec is WALKED from `v1Router`, build.ts:119, so it cannot advertise an unserved endpoint), all carry `security: [{ ApiKeyAuth: [] }]` matching `apiKeyAuth` on every route, all use `:id` (not `:ref`) as the path param, and there is correctly NO DELETE route on either resource. `rateLimit` is applied uniformly to all 10 and the docs make no per-endpoint rate-limit claim to contradict. Query params `status` (enum active|archived, matches `PlanStatus`), `limit` (int 1-100, default 20 — matches `clampLimit`) and `cursor` (opaque string) are all accurately specced. `PLAN_NOT_FOUND` / `PRICE_NOT_FOUND` / `PLAN_NAME_TAKEN` / `PLAN_ALREADY_ARCHIVED` / `PRICE_ALREADY_INACTIVE` / `PRICE_TIERED_NOT_SUPPORTED` are all genuinely reachable, all public, and all correctly hinted. Tenant isolation is in the WHERE clause on every read and every mutation (org + mode), so a cross-tenant reference simply does not exist.
- PUT /v1/organization privilege boundary — CLEAN and correctly implemented. `rateLimitPerMinute` is readable but structurally absent from `updateTenantSettingsBody` (packages/core-contracts/src/validations/settings.ts:9-25), so a tenant cannot self-raise its own rate limit; `updateTenantSettings` only forwards monthlyRequestQuota/settlementMode/branding (apps/api/src/shared/services/tenant-config/config.ts:76-80). The `.refine()` at settings.ts:23-25 correctly rejects an empty body, and the nested `branding` object is `.strict()` (settings.ts:20) so a typo'd branding key is a 422 rather than a silent drop.
- Pagination contract — CLEAN across all three list endpoints in the group (GET /v1/settlements, GET /v1/events, GET /v1/webhooks/{id}/deliveries). All three use identical keyset validators (`limit` int 1..100 default 20, `cursor` string) that the spec renders faithfully with the right min/max/default, all three go through `paginatedHandler` returning `{nextCursor, hasMore}` in `meta.pagination`, and the `status` enums in the spec exactly match the DTO unions (settlement: pending|settled|reconciled|failed|refunded; delivery: pending|succeeded|failed|dead). GET /v1/webhooks is deliberately unpaginated (a tenant has few endpoints) and correctly declares no query params — the unused `listWebhookEndpointQuery` validator (packages/core-contracts/src/validations/webhook.ts:20-24) is dead code but is wired to no route, so it does not leak into the spec.
- QUICKSTART CURL: `<Snippet method="POST" path="/v1/plans" body={{name:'Pro'}} idempotent />` (all seven quickstart language pages) does emit the Idempotency-Key header (src/lib/snippets.ts:47), and `{name: 'Pro'}` is valid against createPlanBody (prices is optional — validations/plan.ts:59-64). That first call works.
- Query parameters on GET /v1/subscriptions (customerId; status enum with all seven statuses; limit 1–100 default 20; cursor) match listSubscriptionQuery exactly, and the controller forwards each one to listSubscriptions.
- RAILS NEVER TRUST A PROVIDER-REPORTED AMOUNT AS KOBO. `collectedKobo` (packages/sara/src/rails/types.ts:62) is never populated from a Nomba response body — collectForInvoice.ts:70 falls back to `invoice.amountDue` (our own kobo). This is the design that would have caused a silent 100× under-credit if the naira response amount had been read as kobo; it does not happen.
- RATE LIMITER vs SDK CONTRACT: the real limiter is a 60-second fixed window (rate-limit.ts:33) at 120 req/min per key with an operator-raisable floor (services/tenant-config/limits.ts:6, resolveRateLimit), emitting X-RateLimit-Limit / X-RateLimit-Remaining / Retry-After. The nine SDKs read exactly those header names and honour Retry-After on retry — correct for the RATE_LIMIT_EXCEEDED path. (The QUOTA_EXCEEDED path is the exception; reported.)
- REQUEST-BODY CASING ACROSS SDKS: I checked the `customerRef` (not `customerId`) wire-name trap on POST /v1/payment-methods/setup and GET /v1/payment-methods — node, python, ruby and go all send the correct camelCase `customerRef` (ruby camelizes in Internal::Util.serialize_body). No silent filter drop.
- REQUEST-BODY CONTRACT (spec vs zod) — the OpenAPI request schemas are a faithful machine-derived mirror of the zod validators, because build.ts:26 runs `zodToJsonSchema` over the actual `validate({body})` middleware. I diffed all six bodies field-by-field: createCustomerBody (email/name required; phone 1-32; metadata), updateCustomerBody (all optional, phone nullable), createCouponBody (code 1-64 + duration enum required; percentOff 1-100; the rest positive ints), updateCouponBody, grantCreditBody (amountInKobo required positive; source enum ['manual','goodwill'] default 'manual'), applyDiscountBody (coupon, minLength 1). Names, types, enums, min/max and required-lists all match. Query params likewise: limit (int 1-100, default 20), cursor (string), email (format: email) on GET /v1/customers.
- Replay semantics — CLEAN, and the docs' claim here is TRUE. `replayDelivery` re-arms the SAME row rather than creating a new one (packages/sara/src/webhooks/deliveries.ts:131-159, "re-arm the SAME row (no new WHD/EVT reference…)"), so the event id genuinely is preserved — exactly what webhooks/delivery-guarantee.mdx:50-52 and retries-and-replay.mdx:55-59 promise. Replaying a `pending`/`succeeded` row is an idempotent no-op (deliveries.ts:144-146), and the auto-replay ceiling of 3 (deliveries.ts:22) is consistent with retries-and-replay.mdx:26-27's "It does not retry forever." The SDK pages' claim that escrow and payout return a typed `SETTLEMENT_SUBACCOUNT_NOT_FOUND` (sdks/node.mdx:277, sdks/go.mdx:331, sdks/rust.mdx:371) also checks out — that code IS in PUBLIC_ERROR_CODES (packages/errors/src/codes.ts:324).
- Request bodies: every field name, type, enum, default and min/max in the spec matches the zod validator byte-for-byte — createSubscriptionBody (customerId/priceId required; collectionMethod default charge_automatically; quantity default 1, min 1; trialDays min 0), changeSubscriptionBody (prorationBehavior default create_prorations), scheduleChangeBody (priceId required; effectiveAt enum ['next_cycle'] default next_cycle), applyDiscountBody (coupon minLength 1), pauseSubscriptionBody (maxDays exclusiveMinimum 0), cancelSubscriptionBody (mode enum now|at_period_end, default now), resubscribeBody, updateSubscriptionBody, updateSubscriptionCardBody. `additionalProperties: false` is correctly advertised and genuinely enforced — there is no documented-but-unknown key that would 422.
- Response DTOs: the Subscription, UpcomingInvoice, SubscriptionSchedule, Discount, DunningState and DunningAttempt mirrors in apps/api/src/shared/openapi/responses.ts match their core-contracts interfaces field-for-field (names, nullability, enums, required lists) — I diffed each. The only wrong response mapping in this group is the payment-method op (reported).
- Resubscribe never mutates the source row (resubscribe.ts:71-78 mints a new subscription via createSubscription), matching the SDK docs and the reference title, and correctly returns 201.
- Route inventory: all 19 subscription operations (16 in modules/subscriptions/routes.ts + 3 in modules/dunning/routes.ts, which mounts onto the subscriptions resource) appear in apps/docs/src/generated/openapi.json with exactly the path and method the server mounts — the spec is walked from the live v1Router (build.ts:117-119), so there is no phantom or missing endpoint.
- Route ordering — CLEAN. The literal paths are correctly declared before their `:id` siblings, with a comment saying why: `/settlements/escrow` and `/settlements/payout` precede `/settlements/:id` (settlements/routes.ts:22-28), and `/events/catalog` precedes `/events/:id` (events/routes.ts:13-19). So `GET /v1/settlements/escrow` is never captured as a settlement reference. The nested delivery param is `:deliveryId`, not a second `:id` (webhooks/routes.ts:35-39) — Express would otherwise silently clobber the webhook id, and the code calls this out explicitly.
- SANDBOX INSTRUMENT GATING: /v1/sandbox/* is always mounted but `requireSandboxMode` runs immediately after `apiKeyAuth` on all three routes (modules/test/routes.ts:40-41, 52-53, 63-64) and refuses any live-mode key with 403; each handler re-checks ctx.mode. A live key cannot reach the test clock.
- SANDBOX SIMULATOR IS GENUINELY BYTE-IDENTICAL — the docs' boldest claim here is TRUE. apps/docs/content/getting-started/verify-in-your-devtools.mdx:10 ("a real, signed event, byte-for-byte identical to production") and apps/docs/content/webhooks/simulate.mdx:14-19 hold up: apps/api/src/shared/services/webhooks-simulate.ts:50-53 calls the real `emitEvent` (writing a real `domain_events` row and real `webhook_deliveries` fan-out) and then the real `deliverPending` — the same `buildBody` (deliver.ts:177), the same `signWebhookPayload(endpoint.signingSecretHash, rawBody)` (deliver.ts:113), the same six headers (deliver.ts:203-211). There is no separate simulation code path. (The one defect is the `deliveredCount` return value — reported separately.)
- SCOPE VOCABULARY: every `requireScope('…')` string in the codebase is a member of the `ApiKeyScope` union (packages/core-contracts/src/types/api-key.ts:4-30) and of the zod enum used to mint keys (validations/api-key.ts:3-30). No fabricated scope exists anywhere in the docs, the SDKs, or the console. (`billing:write` / `money:write` in apps/console are RBAC role permissions in a different `can()` system, not API scopes.) The console bridge's BRIDGE_SCOPES (apps/console/src/lib/api-client.ts:23-40) covers every scope required by every `callApi(...)` path it actually calls — I checked all 25 call sites.
- SDK EVENT-TYPE ENUMS MATCH THE CATALOG. I diffed the type lists in nombaone-node/src/webhook-events.ts, nombaone-rust/src/webhook_events.rs, and nombaone-elixir/lib/nombaone/webhook_event.ex against WEBHOOK_EVENT_CATALOG: no missing types, no invented types, and the per-type `data` shapes match the catalog's payload descriptors (e.g. `coupon.created` → `{reference, code}`, `invoice.action_required` → `{reference, reason, checkoutLink}`, `invoice.payment_partially_collected` → `{reference, amountPaid, amountRemaining}`). All are open unions, so a future event type still parses. Only the node SDK exposes the `example.*` scaffold types, and it marks both `@deprecated Reference-scaffold event; not part of the billing product` (webhook-events.ts:94-97).
- SDK `WebhookDeliveryStatus` ENUMS ARE COMPLETE AND CORRECT — all four values including the terminal `dead`: nombaone-node/src/resources/webhook-endpoints.ts:39, nombaone-go/webhookendpoints.go:50, nombaone-java/.../WebhookDeliveryStatus.java:11, nombaone-rust/src/resources/webhook_endpoints.rs:22, nombaone-ruby/lib/nombaone/resources/webhook_endpoints.rb:11 — all match packages/core-contracts/src/types/webhook.ts:13. The SDKs are right here; only the prose docs are wrong (finding 4).
- SUCCESS-STATUS CODES (server side) — the controllers are internally consistent: the four creates return `statusCode: 201` (create.ts:37, create-coupon.ts:33, grant-customer-credit.ts:31, apply-customer-discount.ts:28) and the reads/updates/removes return 200 by omission. The bug is that build.ts:138 hardcodes '200' for every op in the spec — already established by the previous pass, so not re-reported here.
- Schedule lifecycle behaves as documented: one active schedule per subscription; a phase added at an existing boundary replaces it; DELETE sets status 'canceled'; 'released' is set only when the sweep consumes all phases (apply.ts:73) — and the SubscriptionScheduleStatus enum in the spec is complete.
- Scopes — enforcement is CLEAN and consistent, though undocumented. Every route in the group declares exactly the scope you'd expect: settlements:read on GET escrow/list/retrieve and settlements:write on payout/refund (settlements/routes.ts:24-29); organizations:read/write on GET/PUT /v1/organization (settings/routes.ts:12-13); metrics:read on GET /v1/metrics/billing (metrics/routes.ts:12); webhooks:read/write across all nine webhook ops (webhooks/routes.ts:27-40) and on GET /v1/events + /v1/events/{id} (events/routes.ts:19-20). `requireScope` fails closed with API_KEY_MISSING if it is ever mounted before auth (apps/api/src/shared/middlewares/scope.ts:22-28). Worth noting for the cross-cutting report: apps/docs contains ZERO occurrences of any scope string (grepped `settlements:read|settlements:write|webhooks:read|webhooks:write|organizations:read|organizations:write|metrics:read` across content/ and src/ — no hits), and the generated reference renders only a generic "🔒 Secret key" badge (api-operation.tsx:32-36). So no docs page states a WRONG scope; no docs page states any scope at all.
- Snippet kwarg naming is correct across the board: the emitter's snake(wireField) transform (snippets.ts:164) produces exactly the keyword-only parameter names the SDK declares, for all 70 working ops (unitAmountInKobo -> unit_amount_in_kobo, customerId -> customer_id, paymentMethodId -> payment_method_id, ...). Zero missing-required-argument binds. Python also has no fabricated *Params type names — that failure mode is Go/.NET/Java/Rust-only, since Python passes kwargs.
- TENANCY / CROSS-TENANT ISOLATION — every read and write re-resolves the reference inside `(organizationId, mode)` taken from the VERIFIED api key, never from the client. Confirmed in customers/queries.ts:31-38, customers/update.ts:27-34, coupons/queries.ts:19-29 & 44-52, credits/void.ts:31-37, credits/queries.ts:17-25, discounts/queries.ts:22-32 & 76-82. A reference from another tenant 404s. Coupon `code` lookup for apply is likewise org+mode scoped (coupons/queries.ts:49).
- THE ARITHMETIC OF THE CONVERTERS IS CORRECT. `koboToNombaAmount = (kobo) => (kobo / 100).toFixed(2)` and `nombaAmountToKobo = (naira) => Math.round(Number(naira) * 100)` are exact inverses; the read side fails closed to 0 on non-numeric input rather than NaN-poisoning downstream math.
- THE ATOMICITY AND ORDERING CLAIMS FOR POST /v1/plans WITH EMBEDDED PRICES ARE TRUE. "Either the plan and every price land, or nothing does" (guide:36-38, changelog:26-29) — apps/api/src/shared/services/plans/create-with-prices.ts:56-92 runs every guard (`assertPlanNameFree`, then `assertPriceCreatable` per row) BEFORE opening the transaction, then does plan-insert + one multi-row price-insert inside a single `txDb.transaction`. "The response carries `data.prices` in the order you sent them" (guide:34) — create-with-prices.ts:78-89 pre-mints references and re-orders the unordered `RETURNING` rows against them, exactly as the doc-comment claims. `data.prices` is always present (`[]` when none embedded) — create-plan.ts:51. Limits are enforced as documented: max 10 (MAX_EMBEDDED_PRICES, validations/plan.ts:7 → `maxItems: 10` in the spec), min 1 (empty array 422s), and no two prices on the same `(interval, intervalCount)` cadence (the `rejectDuplicateCadence` superRefine, validations/plan.ts:26-41).
- THE CONSOLE IS CLEAN — no fake data, no scaffold, and the example slice was ALREADY removed from it. `find apps/console/src -ipath "*example*"` returns nothing; apps/console/src/app/(app)/ contains only real product routes (coupons, customers, developers, dunning, invoices, payments, plans, reconciliation, settings, settlements, subscriptions). Grepping the console/admin/website UI for "Ada Lovelace", "Acme", "@example.com", "John Doe", "lorem", "dummy" returns exactly ONE hit, and it is a comment expressing the OPPOSITE of the problem — apps/console/src/lib/customers.ts:50: "the subscriptions surface, so it renders '—' honestly until then, never faked." Whoever built the console refused to fake data. That is the standard the other surfaces should meet.
- THE CONSOLE'S TEST-INSTRUMENTS PAGE IS CORRECTLY MODE-GATED. apps/console/src/app/(app)/developers/test/page.tsx:14 computes `const isLive = mode === 'live';` and lines 40-46 render a plain "Switch to sandbox mode to use the test instruments" panel instead of the controls when live — the TestInstrumentsPanel is never mounted for a live-mode session. The event-type dropdown it feeds is NOT the raw catalog: apps/console/src/lib/test-instruments.ts:15-23 SIMULATE_EVENT_TYPES is a hand-curated list of seven real events (invoice.paid, invoice.payment_failed, invoice.finalized, subscription.created, subscription.updated, customer.updated, settlement.payout_created) containing no example.* entries. A merchant never sees a scaffold event name in the console.
- THE DB LAYER IS INTEGER KOBO THROUGHOUT. Every money column is `bigint(mode: 'number')` with a positivity CHECK — prices.unit_amount, invoices.amount_due/paid/remaining, ledger_entries.amount, credit_grants.amount/remaining, coupons.amount_off, payouts.amount_kobo, refunds.amount_kobo, subscription_items.unit_amount. No numeric/decimal/float column anywhere. `ledger_entries.amount` is positive-only with direction carrying the sign (schema/ledger-entries.ts:11-33) — no signed-float drift possible.
- THE DETERMINISTIC TEST-INSTRUMENT MONEY BRANCH FAILS CLOSED. packages/sara/src/rails/test-sim.ts:41 `if (mode !== 'sandbox') return null;` — the single mode-branch on a money path. A live-mode charge falls through to the real rail unconditionally, even if a payment method somehow carried a `test_success` sentinel in its token column. The sentinel table (test-sim.ts:25-33) can never fire in live. (The doc-comment above it is stale and misleading — filed as a separate low finding — but the CODE is right.)
- THE DOCS "COMING SOON" STUB GENERATOR IS DORMANT — do not delete it. apps/docs/src/lib/content.ts:149-161 can synthesize a `<Callout type="note" title="Coming soon">This page is planned and on the way.</Callout>` for any manifest-listed route whose .mdx is missing. That reads like a live placeholder risk. It is not firing: I walked all 87 `slug:` entries in apps/docs/content/manifest.ts against the filesystem and found ZERO missing .mdx files, so the stub path is never taken. It is a fail-safe, not a stub — it exists so a nav entry can never 404. Keep it. (The two REAL docs placeholder problems are content, not this mechanism: the empty /cookbook page and the stale "docs are on the way" paragraph on the docs homepage — both filed above.)
- THE DOCS CODE SAMPLES POINT AT THE RIGHT HOST — this is why the localhost OpenAPI bug went unnoticed, and it is worth knowing the samples themselves are fine. apps/docs/src/lib/api-ref/snippets.ts:53 `const HOST = "https://sandbox.api.nombaone.xyz";` is hardcoded, so every curl/SDK snippet rendered in the API reference uses the correct sandbox host. Nothing in the docs UI reads `openapi.servers[0].url` (it is merely TYPED at apps/docs/src/lib/api-ref/model.ts:47 and never consumed). So the localhost server URL damages MACHINE consumers (codegen, Postman, agents) only — the human-readable docs are correct. Fix the spec anyway; just do not expect the docs pages to change.
- THE DOCS EVENT CATALOG ALREADY EXCLUDES THE SCAFFOLD EVENTS. apps/docs/src/components/mdx/event-catalog.tsx:87 `const documented = entries.filter(([type]) => !type.startsWith("example."));`, with the intent spelled out at lines 15-16. docs.nombaone.xyz does not show example.created/example.settled. This is correct and deliberate — leave it alone. It is also the evidence that the API-side leak (finding 2) is an oversight rather than a decision, and it gives you the exact filter to copy into apps/api/src/apps/main/modules/events/routes.ts:17.
- THE EMBEDDED-PRICES SCOPE GUARD IS REAL AND CORRECTLY DOCUMENTED. apps/api/src/apps/main/modules/plans/controllers/create-plan.ts:40-42 asserts `requireScope({ scopes: req.apiKey.scopes }, 'prices:write')` against the VERIFIED principal, only when `prices.length > 0`, and BEFORE any DB work → 403 API_KEY_SCOPE_FORBIDDEN. The docs state this accurately in both places it appears: content/guides/create-plans-and-prices.mdx:40-45 and content/changelog.mdx:31-33. The route's own scope (`plans:write`, routes.ts:38) and the nested price route's (`prices:write`, routes.ts:77) are correct and unescalatable.
- THE EVENT CATALOG CANNOT DRIFT. apps/docs/src/components/mdx/event-catalog.tsx:86-88 imports `WEBHOOK_EVENT_CATALOG` directly from `@nombaone/core-contracts/types` and renders it at build time, so /webhooks/event-catalog is provably complete against packages/core-contracts/src/types/webhook-events.ts. Its group prefixes (customer/coupon/discount/plan/price/subscription/invoice/payment_method/settlement) cover every non-`example.*` key in the catalog — I checked all 33 entries; nothing is silently dropped. It correctly filters out the `example.*` scaffold types (event-catalog.tsx:88).
- THE HAND-WRITTEN GUIDE IS CLEAN. I compiled EVERY fenced Rust block in apps/docs/content/sdks/rust.mdx verbatim against the real crate (cargo 1.85.0, cargo check --offline): the quickstart (lines 38-89), the builder (96-105), the Field<T> block (138-145), the ApiCall/Response chain (157-177), pagination + .stream()/.pages() (190-211), the blocking block (218-223, with features=["blocking"]), error matching (251-260), the webhook handler (275-298), and the sandbox toolkit (314-330). ZERO errors, zero warnings. Every import path, constructor, accessor, method, argument shape, field name, enum variant (PriceInterval::Month, SandboxPaymentMethodBehavior::DeclineInsufficientFunds, WebhookEventType::InvoiceActionRequired, WebhookEventData::InvoiceActionRequired(d).checkout_link), error type (ErrorCode::CUSTOMER_NOT_FOUND, ApiErrorKind::RateLimit, e.retry_after, e.fields) and Response field (resp.data / .request_id / .status: u16) resolves. Answering the brief directly: YES, the first sample on /sdks/rust compiles.
- THE KOBO↔NAIRA ARITHMETIC IN THE MAIN DOCS GUIDES IS CORRECT. I checked every ₦ figure by hand against its kobo literal: 250000=₦2,500.00 (your-first-subscription.mdx:62, create-plans-and-prices.mdx:65, index.mdx:22, migrate/from-flutterwave.mdx:20, concepts/money-is-integer-kobo.mdx:7); 50000=₦500 off (coupons-and-credits.mdx:28); 15000=₦150.00 (quickstart.mdx:57); 500000=₦5,000/mo and 5000000=₦50,000/yr (create-plans-and-prices.mdx:33); 250000=₦2,500 refund (refunds-payouts-settlement.mdx:25). All exact.
- THE MOCK RAILS ARE NOT REACHABLE FROM THE BILLING ENGINE. packages/sara/src/rails/index.ts:15-16 registers `mockPullRail` and `mockPushRail` unconditionally at module import, in production. I chased this hard because a mock rail that returns `{ status: 'succeeded' }` for free (rails/mock.ts:16) would mean invoices marked paid with no money moved. It cannot happen: both real call sites resolve the adapter from the payment method's KIND, never from a client-supplied string — `getRail(railKeyForMethod(method.kind))` at collectForInvoice.ts:62 and dunning/attempt.ts:204. `railKeyForMethod` maps the internal card/mandate/transfer enum and can never produce 'mock_pull'/'mock_push'. The only caller that names a mock rail is packages/sara/src/example/create.ts:123 `getRail('mock_pull')`, inside the deletable example slice. Registry lookup is a plain Map with no user-controlled key path.
- THE NOMBA BOUNDARY IS AIRTIGHT — this is the 100× hazard surface and it is fully guarded. I enumerated every outbound Nomba `request()` call that carries an amount; all six convert kobo→naira via `koboToNombaAmount` (packages/sara/src/nomba/money.ts:15): rails/card.ts:43, rails/mandate.ts:41, rails/transfer.ts:31, payment-methods/attach.ts:52 + :124 + :186, settlement/payout.ts:165, billing/actionLink.ts:63. The one inbound read converts back via `nombaAmountToKobo` (nomba/client.ts:202). No amount crosses the boundary unconverted, in either direction.
- THE OPENAPI SPEC HAS NO FLOAT MONEY AND EXACTLY ONE NAMING LEAK. I machine-walked every schema and request body in apps/docs/src/generated/openapi.json: every money-shaped property is `"type": "integer"` (zero `number`/`format: float`), and `expectedAmount` is the sole property failing the `…InKobo` rule (reported above). The apparent hits `priceId`, `prices`, `cyclesRemaining`, `platformFee` are an id, an array, a count, and an object container — not money scalars. `TenantSettings.billing.platformFee` correctly uses `minInKobo`/`maxInKobo`.
- THE PLANS/PRICES RESPONSE SCHEMAS MATCH THE REAL DTOs FIELD-FOR-FIELD. I diffed `components.schemas.Plan` / `Price` / `PlanWithPrices` in openapi.json (built from apps/api/src/shared/openapi/responses.ts:50-95) against `PlanResponseData` (packages/core-contracts/src/types/plan.ts:10-20), `PriceResponseData` (types/price.ts:16-31) and `PlanWithPricesResponseData` (types/plan.ts:32-34). Every field is present, correctly typed, correctly enumerated (`interval` carries all five units INCLUDING `minute`; `status`, `mode`, `usageType`, `billingScheme`, `domain`, `currency` all exact) and correctly marked required. No documented field is absent from the DTO; no DTO field is undocumented. `RESPONSE_DATA_BY_ROUTE` (responses.ts:424-436) maps all 10 plans/prices routes to the right ref and the right list-ness.
- THE SANDBOX INSTRUMENTS FAIL CLOSED — DO NOT UNMOUNT THEM. `/v1/sandbox/*` (mint test method, advance-cycle test clock, simulate webhook) is mounted unconditionally in production at apps/api/src/apps/main/server/routes.ts:53, and that is CORRECT by design (one process serves both modes). The gate is real: apps/api/src/shared/middlewares/sandbox-mode.ts:12-22 `if (req.apiKey?.mode !== 'sandbox') { next(AppError.Forbidden(...)); return; }` — note the `?.` means a missing key also fails, so it fails closed on every path. It runs immediately after apiKeyAuth on all three routes (test/routes.ts:40, 53, 64). Defence in depth is genuinely present: advance-cycle.ts:34-40 re-checks `if (ctx.mode !== 'sandbox') throw AppError.Forbidden(...)` independently. A live-mode key CANNOT advance a billing cycle or mint a fake payment method. This is load-bearing infrastructure — the only change it needs is to be hidden from the PUBLIC SPEC (finding 1), not removed from the router.
- THE SANDBOX/TEST-INSTRUMENT ROUTES FAIL CLOSED — this is correct, leave it alone. apps/api/src/apps/main/server/routes.ts:52 mounts `testRouter` UNGATED (`v1Router.use(testRouter)`), which looks alarming next to the ungated exampleRouter one line above. It is fine. The gate is per-request, one layer in: apps/api/src/shared/middlewares/sandbox-mode.ts:12-24 is `if (req.apiKey?.mode !== 'sandbox') { next(AppError.Forbidden('Sandbox instruments are only available to sandbox-mode API keys', …)); return; }` — a strict inequality that 403s a live key AND 403s a request with no `req.apiKey` at all. It runs right after `apiKeyAuth` (apps/api/src/apps/main/modules/test/routes.ts:13,26). The three endpoints (/v1/sandbox/payment-methods, /v1/sandbox/subscriptions/{id}/advance-cycle, /v1/sandbox/webhooks/simulate) appear in the public OpenAPI spec, which is correct and intentional — they are a documented product feature (the sandbox toolkit), not a leak. A live-key holder cannot reach any of them.
- THE SCOPE GUARD HAS NO WILDCARD OR ADMIN BYPASS — THIS IS WHAT MAKES /v1/examples HARMLESS. packages/sara/src/api-keys/scope.ts:28-36 is a strict `if (!verified.scopes.includes(scope)) throw AppError.Forbidden(...)`. There is no '*', no 'admin', no superuser short-circuit anywhere in the chain (apps/api/src/shared/middlewares/scope.ts:29 delegates straight to it). Combined with the console granting only DEFAULT_SCOPES (apps/console/src/lib/api-keys-actions.ts:12-29) and BRIDGE_SCOPES (apps/console/src/lib/api-client.ts:24-40) — neither of which contains example:* — and the absence of any public key-minting route, this is the single control that makes the example endpoints uncallable by real merchants. CRITICAL OPERATIONAL WARNING: do not 'tidy' the scope lists by adding the missing example scopes for consistency, and do not add a wildcard scope for convenience. Either change would turn finding 1 from a credibility problem into a live ledger-integrity problem overnight.
- THE SDK CALL SHAPES FOR THIS GROUP ARE INTERNALLY CONSISTENT. `sdk-map.ts` emits `plans.create/list/retrieve/update/archive`, `plans.prices.create/list`, and `prices.list/retrieve/deactivate` (apps/docs/src/lib/api-ref/sdk-map.ts:52-56 + the CRUD derivation at :112-117). These match the hand-written SDK quickstarts one-for-one — `nombaone.plans.prices.create(plan.id, {...})` in content/sdks/node.mdx:42, python.mdx:43, ruby.mdx:42, php.mdx, java.mdx, rust.mdx. NONE of the five previously-established fabricated method names (voidCreditGrant, retrieveCatalog, retrieveBilling, schedule.cancel, paymentMethods.delete) falls in the plans/prices group.
- THE SDK DOCS' ANTI-100× WARNINGS ARE CORRECT, NOT BUGS. The figures that look wrong at a glance — python.mdx:110 "`250_000` is ₦2,500 — not ₦250,000", rust.mdx:35-36, java.mdx:134 — are deliberate, correctly-worded warnings against the exact misreading this audit was hunting. Verified all nine SDK conventions sections state ₦1.00 = 100 correctly.
- THE TEST-SIMULATION SHIM INSIDE THE LIVE MONEY PATH IS SAFE. `maybeSimulateTestCollect` is called at the two real collection sites — apps/api/src/shared/services/billing/collectForInvoice.ts:62 and apps/api/src/shared/services/dunning/attempt.ts:204 — which looks alarming, but packages/sara/src/rails/test-sim.ts:46 opens with `if (mode !== 'sandbox') return null;` before touching anything, so in live mode it unconditionally falls through to the real rail. It additionally requires a `test_*` sentinel in the method's rail-identifier column (test-sim.ts:47-49); a real live card token can never match a key in the TOKEN_RESULT table. Live collection behavior is unchanged. (One nit, not a bug: the doc comment at test-sim.ts:18-19 claims "A real deployment is env-pinned to `live`, so this can never fire there" — that reasoning is stale after the environment/mode split, since production now serves sandbox-mode accounts too. The CODE is right; only the comment's justification is out of date. Do not 'fix' the code to match the comment.)
- THE WEBSITE SITEMAP IS HONEST. apps/website/src/app/sitemap.ts:10-21 lists only real routes and correctly OMITS /kitchen-sink and the four unbuilt use-case slugs (/use-cases/saas, /gyms, /lending, /platforms) — it ships only "/use-cases" and "/use-cases/school-fees". So Google will not index the placeholders directly. This meaningfully limits the blast radius of the /kitchen-sink finding (guessable URL only). It does NOT limit the /use-cases finding, because /use-cases IS in the sitemap and its own cards link to the four placeholders — a crawler and a human both get there in one click.
- THE `@example.com` / "Ada Lovelace" HITS IN THE SDK DOC-COMMENTS ARE LEGITIMATE AND SHOULD STAY. e.g. nombaone-ruby/lib/nombaone/client.rb:12 `customer = nombaone.customers.create(email: "ada@example.com", name: "Ada Lovelace")`, nombaone-python/src/nombaone/__init__.py:13, and the ~30 `# @example` YARD tags across nombaone-ruby/lib/. These are intentional API usage examples in rendered documentation, and `example.com` is the RFC 2606 reserved domain — using it is correct practice, not a leak. Do not sweep these while cleaning up the `example.*` SCAFFOLD (a different thing entirely: the EXAMPLE_NOT_FOUND error code and the example.created/example.settled event types, filed above). Same for the SDK conformance suites that skip `post /v1/examples` (nombaone-go/conformance_test.go:267 et al) — those exclusions are correct and are evidence the team already knew the endpoint was not product.
- THE `WebhookDelivery` RESPONSE OBJECT IS CONSISTENT end-to-end: packages/sara/src/webhooks/serialize.ts:19-37 emits exactly the fields declared in packages/core-contracts/src/types/webhook.ts:15-29 (`id`, `eventType`, `endpointId`, `eventId`, `status`, `attempts`, `nextAttemptAt`, `lastAttemptAt`, `responseStatus`, `replayedAt`, `replayCount`, `createdAt`), and it correctly maps internal UUIDs to public `nbo…` references via the joins in deliveries.ts:67-79. No leak of internal ids.
- THE `at-least-once` GUARANTEE HEADER IS REAL. apps/docs/content/webhooks/delivery-guarantee.mdx:8-9 claims the guarantee is stated "on every delivery in the `X-Nombaone-Delivery-Guarantee` header" — confirmed: deliver.ts:210 sets `[WEBHOOK_DELIVERY_GUARANTEE_HEADER]: WEBHOOK_DELIVERY_GUARANTEE`, with the header name and value pinned in packages/core-contracts/src/types/webhook-events.ts:118-121 to `x-nombaone-delivery-guarantee: at-least-once`. The console surfaces the same string (apps/console/src/components/console/developers/webhooks-screen.tsx:213).
- THE `examples` TABLE IS A PRODUCTION-WRITE HAZARD, NOT A FREE DELETE — TREAT IT SEPARATELY. packages/core-db/src/schema/examples.ts defines the table; it is created in packages/core-db/migrations/0000_init.sql, carried through 0015_environment_to_mode.sql, and has an RLS policy attached in 0016_rls_mode_isolation.sql. Per the project's own standing constraint, the Neon database is SHARED BETWEEN DEV AND THE DEPLOYED APP, so any `drizzle-kit generate` + `migrate` that drops this table (and its `example_kind` enum, and its RLS policy) is a WRITE AGAINST PRODUCTION. It is not covered by the zero-risk code deletion. My recommendation: ship the code-only deletion first — that alone removes every integrator-visible trace (spec, docs, MCP, playground, error enum, event catalog) at zero database risk — and leave the table sitting harmlessly in the schema. Drop it later in a deliberate, separately-reviewed migration, never bundled with the code change. Note also that POST /v1/examples posted real double-entry ledger rows (debit cash / credit platform_revenue) into the docs org; dropping the `examples` table will NOT remove those ledger entries, which live in the ledger tables and will persist as orphaned platform-revenue postings. Scope that cleanup consciously rather than discovering it after the fact.
- THE `minute` INTERVAL IS PLUMBED END-TO-END AND ACCURATELY DOCUMENTED. `PRICE_INTERVALS` (packages/core-contracts/src/billing/interval.ts:35) is the single runtime gate imported by the zod enum (validations/price.ts:14, with the comment explaining exactly why it is imported rather than re-typed), so it reaches openapi.json, the reference enum, and both response schemas. The wall-clock vs calendar split, the `unit × count` model (quarterly = month×3, ten-minutely = minute×10, no `quarterly` enum), and the 02:00 Africa/Lagos calendar normalization are all described correctly and consistently at content/guides/create-plans-and-prices.mdx:67-87, content/merchants/create-a-plan.mdx:24-28, content/sandbox-toolkit/clock.mdx:14-21 and the CATALOG_INVALID_INTERVAL hint (packages/errors/src/codes.ts:614). The guide's claim that `minute` is "a real cadence, valid in both sandbox and live" (line 86) is true — nothing gates it on mode.
- TenantSettings response shape — CLEAN. The OpenAPI mirror at apps/api/src/shared/openapi/responses.ts:313-331 matches packages/core-contracts/src/types/settings.ts:1-14 field-for-field and nullability-for-nullability (billing.{rateLimitPerMinute, monthlyRequestQuota, settlementMode, platformFee{bps,minInKobo,maxInKobo}, grace{gracePeriodHours,dunningMaxAttempts}, branding}, webhook{url,signingSecretPrefix,configured}, nombaAccount{accountRef,status}), and the service returns exactly those keys (apps/api/src/shared/services/tenant-config/config.ts:46-62). No undocumented field, no phantom field.
- The 'Acme' / 'Ada Lovelace' / 'test@' style hits are legitimate HTML input placeholders, NOT placeholder data — leave them. apps/console/src/components/auth/accept-invite-form.tsx:31 `placeholder="Ada Lovelace"`, apps/console/src/components/auth/signup-form.tsx:39 `placeholder="Acme Ltd"`, apps/console/src/components/console/settings/org-settings-form.tsx:62 `placeholder="support@acme.io"`, apps/console/src/components/console/developers/webhooks-screen.tsx:323 `placeholder="https://api.acme.io/webhooks/nomba"`. These are correct UX hints in empty form fields and never render as data.
- The .NET SDK's OWN internal consistency is sound — the bugs are in the docs, not the library. The `Version.cs` User-Agent reads the version back from the assembly rather than duplicating the literal (so it can't drift from `<Version>`); `Directory.Build.props` sets `TreatWarningsAsErrors` + `Nullable=enable` + latest analyzers; every public method carries XML docs; the exception hierarchy is coherent (`NombaoneException` → `NombaoneApiException` → 8 status-keyed sealed subclasses; `NombaoneConnectionException` → `NombaoneTimeoutException`). The library builds clean from source with zero warnings.
- The .NET accessor chains and positional args are correct across all 75 ops. Every emitted namespace matches a real property on `Nombaone.Resources.cs` (`Customers`, `Plans`, `Plans.Prices`, `Prices`, `Subscriptions`, `Subscriptions.Schedule`, `Subscriptions.Dunning`, `Invoices`, `Coupons`, `PaymentMethods`, `Mandates`, `Settlements`, `WebhookEndpoints`, `WebhookEndpoints.Deliveries`, `Events`, `Organization`, `Organization.Billing`, `Metrics`), including the two remapped ones (`payment-methods`→`PaymentMethods`, `webhooks`→`WebhookEndpoints`, sdk-map.ts:23-26). Path-arg counts and order match every real signature — e.g. `WebhookEndpoints.Deliveries.RetrieveAsync(endpointId, deliveryId)` (WebhookEndpoints.cs:218) and `Customers.VoidCredit*(id, grantId)` (Customers.cs:360) both correctly get two positional strings. 70 of the 75 method names are right; only the 5 already-established fabrications are wrong.
- The .md mirrors that DO fall back to a one-line "Interactive: <…>" descriptor for genuinely non-textual widgets — WebhookVerifier, MoneyUnit, IdempotencyLab, ApiExplorer — are behaving correctly. Those are interactive tools with no prose equivalent. Only ErrorReference, EventCatalog and Glossary are wrongly in that list, because they are data tables (filed separately). Keep the other entries in ISLAND_NAMES.
- The Elixir constructor is correct in all 75 snippets — unlike Rust and Go. snippets.ts:266 emits `client = Nombaone.new()  # reads NOMBAONE_API_KEY`, and client.ex:70 `def new(api_key_or_options \\ [], options \\ [])` + client.ex:100-105 `resolve_key(nil)` reading `System.get_env("NOMBAONE_API_KEY")` makes that the real zero-arg env constructor. Elixir has neither the Rust `Nombaone::new()`-needs-a-key bug nor the Go undeclared-`ctx` bug.
- The FIRST sample on /sdks/go (go.mdx:39-85) COMPILES. I built it verbatim against the real SDK with go1.23.4 and a `replace` directive — exit 0, zero errors. Every symbol is real: Plans.Create/PlanCreateParams, Plans.Prices.Create/PriceCreateParams{UnitAmountInKobo, Interval}, nombaone.PriceIntervalMonth (prices.go:15), Customers.Create, Sandbox.CreatePaymentMethod/SandboxPaymentMethodParams{CustomerID}, Subscriptions.Create/SubscriptionCreateParams{CustomerID, PriceID, PaymentMethodID}, and the `nombaone.String()` pointer helper. The hand-written guide's flagship sample actually runs — this is the one surface that is genuinely good.
- The FIRST sample on /sdks/node RUNS. Every call in node.mdx:36-63 exists with exactly that shape: plans.create({name}) (plans.ts:109); plans.prices.create(planId, params) (plans.ts:68 — the nested accessor and the positional planId are both real, plans.ts:102 `readonly prices: PlanPrices`); customers.create({email,name}) (customers.ts:120); sandbox.createPaymentMethod({customerId}) (sandbox.ts:86); subscriptions.create({customerId,priceId,paymentMethodId}) (subscriptions.ts:324).
- The FIRST sample on content/sdks/php.mdx (lines 37-66) actually runs. Every method exists (plans->create, plans->prices->create(planId, params), customers->create, sandbox->createPaymentMethod, subscriptions->create — all confirmed by reflection), and every body key validates against the OpenAPI schema, which is `additionalProperties: false` everywhere: POST /v1/plans requires ['name']; POST /v1/plans/{id}/prices requires ['unitAmountInKobo','interval'] and its interval enum contains 'month'; POST /v1/customers requires ['email','name']; POST /v1/sandbox/payment-methods requires ['customerId'] and allows 'behavior'; POST /v1/subscriptions requires ['customerId','priceId'] and allows 'paymentMethodId'. Nothing in that block 422s.
- The GENERATED API reference tree (89 routes under /reference/**) is clean. src/lib/api-ref/model.ts:133-137 deliberately excludes the utility and scaffold paths — "Utility and scaffold paths (`health`, `openapi.json`, `examples`, `sandbox`) are covered elsewhere (sandbox toolkit) and deliberately excluded" — and I verified it empirically: `apiRefSlugs()` returns 89 slugs, of which 0 match /example/i. The examples leak into the docs comes ONLY from the hand-authored manifest entry at content/manifest.ts:229, not from the generator. Do not touch RESOURCE_ORDER.
- The Go SDK does NOT expose an Examples SERVICE. client.go:32-63 wires exactly 15 namespaces (Customers, Plans, Prices, Subscriptions, Invoices, Coupons, PaymentMethods, Mandates, Settlements, WebhookEndpoints, Events, Organization, Metrics, Sandbox) — no `Examples`, no scaffold methods reachable from the client. (The scaffold leak is confined to one exported error code + the vendored spec — reported separately.)
- The Java SDK's namespace accessors all exist and match sdk-map's chains where the chains are right: `plans().prices()` (Plans.java:31), `subscriptions().schedule()` (Subscriptions.java:40), `subscriptions().dunning()` + `.retrieve(id)` + `.listAttempts(id)` (SubscriptionDunning.java:22,33), `webhookEndpoints().deliveries()` + `.list/.retrieve/.replay` (WebhookEndpointDeliveries.java:20,40,57), `organization().billing()` + `.retrieve()/.update(BillingSettingsUpdateParams)` (OrganizationBilling.java:18,38). The `webhooks` → `webhookEndpoints` remap in sdk-map.ts:25 is correct for Java.
- The Java SDK's transport-level money-safety claims in the guide are real, not aspirational: internal/IdempotencyKeys.java + Transport wire a UUID `Idempotency-Key` on every POST reused across retries (guide java.mdx:135-139), internal/Backoff.java implements full-jitter honoring Retry-After, and internal/HttpIdempotencyTest.java + HttpRetryTest.java actually assert the key is reused across attempts. Integer-kobo `long` money is enforced by the type system throughout (PriceCreateParams.unitAmountInKobo is `long`, PayoutCreateParams.amountInKobo is `long`) — no floats or BigDecimal anywhere in the money path.
- The Node SDK's TypeScript interfaces for Subscription, SubscriptionItem, UpcomingInvoice, SchedulePhase, SubscriptionScheduleObject, DunningState and DunningAttempt are field-for-field identical to the server DTOs — the typed surface is right even where the JSDoc wrapped around it (reported above) is not.
- The OpenAPI ApiError schema correctly marks hint + docUrl required (build.ts:188) and correctly types `fields` as Record<string, string[]> (build.ts:194) — the spec is right; it is the docs sample that is wrong.
- The PHP SDK does NOT expose the `/v1/examples` scaffold as a resource — there is no Examples resource class, and tests/Conformance/OpenApiCoverageTest.php explicitly excludes the three example routes from the coverage requirement. The leak (reported above) is confined to the ErrorCode constant and the vendored spec file.
- The Python constructor line the emitter produces is CORRECT — snippets.ts:220 emits 'nombaone = Nombaone()  # reads NOMBAONE_API_KEY', and _client.py:279 declares 'api_key: Optional[str] = None' with _client.py:115 'resolved_key = api_key or os.environ.get(_ENV_API_KEY)' where _client.py:61 sets '_ENV_API_KEY = "NOMBAONE_API_KEY"'. Unlike Rust (Nombaone::new() requires a key) and Go (undeclared ctx), the Python preamble is NOT a 75/75 compile break. Do not report one.
- The Ruby SDK is the AUTHORITATIVE side of the naming dispute, not the docs. `nombaone-ruby/spec/conformance/openapi_coverage_spec.rb` is a bidirectional drift alarm ('every SDK method must emit a path in the committed OpenAPI snapshot, and every spec operation must be emitted by some SDK method'), and it passes. So `void_credit` / `release` / `remove` / `catalog` / `billing` are the intended, spec-conformant names — fix `sdk-map.ts`, never the gem.
- The Rust SDK does NOT leak any `example.*` scaffold into its public surface. `grep -rn example nombaone-rust/src --include=*.rs` returns only two hits, both benign doc-comments (lib.rs:8 pointing at the examples/ dir; client.rs:398 the word 'example' in prose). There is no Example resource, no `examples()` accessor, no `example.created` variant in webhook_events.rs, and no `example:read` scope. (The vendored nombaone-rust/spec/openapi.json DOES still carry `/v1/examples` and `/v1/examples/{id}` among its 62 paths, but Cargo.toml:16-24 `exclude = [… "/spec" …]` keeps it out of the published crate, and no code reads it.) Correspondingly, apps/docs/src/lib/api-ref/model.ts:135-136 deliberately excludes `examples` from the reference model, so no Rust snippet for /v1/examples is ever emitted. This axis is clean.
- The SDK does NOT leak the example scaffold into its event catalog. I diffed WEBHOOK_EVENT_TYPES (webhook_events.py:58-90, 32 types) against the server SSOT (packages/core-contracts/src/types/webhook-events.ts, 34 entries): the SDK is exactly the server catalog minus example.created and example.settled, with zero extras and zero omissions. The scaffold leak is confined to PUBLIC_ERROR_CODES (reported separately).
- The SDK repo is green on its own terms: pytest -> 226 passed, 11 skipped; mypy --strict -> clean on 28 source files. Route coverage is also complete: the SDK's vendored spec and apps/docs' generated spec declare the identical 83-operation surface; only 3 path DEFINITIONS have drifted (/v1/plans, /v1/plans/{id}/prices, /v1/organization/billing), all reported above.
- The SDK's own conformance test is honest about the scaffold ROUTES: test/conformance/openapi-coverage.test.ts:38-40 explicitly EXCLUDES 'post /v1/examples', 'get /v1/examples', 'get /v1/examples/{id}' with the comment "deletable reference scaffold", and line 231-232 even asserts the excluded entries still exist in the spec so the exclusion can't rot. The example.* WEBHOOK EVENTS were simply missed by that same quarantine — which is precisely the gap I reported.
- The SDK's own suite is green on its own terms: `mix test` -> 158 passed, 0 failures, 6 excluded (:integration). mix.exs also enforces `warnings_as_errors: true` and the package genuinely has ONE runtime dependency (`jason`), exactly as elixir.mdx:10 claims — credo/dialyxir/ex_doc are all `only: [:dev, :test], runtime: false`.
- The SDK's sandbox paths MATCH the server byte-for-byte. sandbox.ts:93 posts '/sandbox/payment-methods', :115 '/sandbox/subscriptions/${id}/advance-cycle', :142 '/sandbox/webhooks/simulate'; apps/api/src/apps/main/modules/test/routes.ts:39/51/62 mount exactly those three under /v1. The env→mode (test→sandbox) rename landed correctly on both sides — no 404.
- The SDK's sandbox paths match the server exactly. sandbox.rs:132 `/sandbox/payment-methods`, :145 `/sandbox/subscriptions/{id}/advance-cycle`, :164 `/sandbox/webhooks/simulate` line up 1:1 with apps/api/src/apps/main/modules/test/routes.ts (`testRouter.post('/sandbox/payment-methods' …)`, `'/sandbox/subscriptions/:id/advance-cycle'`, `'/sandbox/webhooks/simulate'`), mounted at routes.ts:52. The SDK's local live-key guard (sandbox.rs:97-107, returns Error::Config before any network call) mirrors the server's `requireSandboxMode`, so rust.mdx:310-312's claim that sandbox calls 'fail locally with Error::Config on a live key' is accurate.
- The `nombaone.sandbox.*` toolkit is real and correctly pathed. `lib/nombaone/resources/sandbox.rb` posts to `/sandbox/payment-methods`, `/sandbox/subscriptions/{id}/advance-cycle`, `/sandbox/webhooks/simulate` — these match `apps/api/src/apps/main/modules/test/routes.ts:39,51,62` byte for byte, and the body fields it sends (`customerId`, `behavior`, `kind`, `type`, `payload`) match `packages/core-contracts/src/validations/test.ts:21-32` exactly. `assert_sandbox!` (sandbox.rb:71) really does raise locally on a live key, as ruby.mdx:226 claims.
- The apps/api sandbox instruments are correctly gated and are NOT a live-mode risk. apps/api/src/apps/main/modules/test/routes.ts mounts /v1/sandbox/payment-methods, /v1/sandbox/subscriptions/:id/advance-cycle and /v1/sandbox/webhooks/simulate with `requireSandboxMode` immediately after `apiKeyAuth` on every route, plus a per-handler `ctx.mode` re-check as defence in depth. A live-mode key is refused. The router being always-mounted is intentional (one process serves both modes) and safe.
- The auto-generated Python snippets are ISOLATED-broken, not SYSTEMATICALLY broken — the key contrast with Go and Rust. I dumped all 75 emitted snippets, then resolved every accessor chain on a live Nombaone instance and ran inspect.signature().bind() with the exact positional args and kwargs the emitter produces. Result: 70/75 bind cleanly; exactly 5 fail, all AttributeError, all traceable to the 5 already-known sdk-map.ts fabrications. No snippet fails on argument shape.
- The auto-generated Ruby snippets are RIGHT about everything except the 5 fabricated method names. I executed all 75 emitted snippets against the real gem with a stubbed transport: 70/75 ran to completion, and for every one of those 70 the HTTP method + URL path the SDK actually put on the wire matched the OpenAPI operation's method + path EXACTLY (0 mismatches after normalizing sample ids). The accessor chains (`nombaone.plans.prices`, `nombaone.subscriptions.dunning`, `nombaone.webhook_endpoints.deliveries`, `nombaone.organization.billing`), the camelCase→snake_case namespace transform, and the positional-vs-keyword argument split are all correct for Ruby.
- The bad `http://localhost:8000` server URL in the OpenAPI document never reaches a rendered docs page. `grep -rl "localhost:8000" .next/server/app public` returns 0 files, because code samples take their host from a separate hardcoded constant — src/lib/api-ref/snippets.ts:53, `const HOST = "https://sandbox.api.nombaone.xyz";`. Every curl and SDK snippet on the docs site points at the correct host. The localhost bug is confined to the spec served by apps/api (filed as critical) — the docs' rendered surface is clean.
- The client-options table (go.mdx:100-107) is complete and correct: WithAPIKey, WithBaseURL, WithTimeout, WithMaxRetries, WithHTTPClient, WithDefaultHeader all exist (option.go:32-68), as do the per-request options the prose cites — WithRawResponse (option.go:127, correctly `**http.Response` so `&resp` is right), WithRequestMaxRetries (option.go:116), WithIdempotencyKey (option.go:95). Defaults match (client.go:13-16: 30s timeout, 2 retries) and key-prefix host derivation is real (client.go:167-180).
- The console and the website contain ZERO example-slice leakage. Grepping apps/console/src and apps/website/src for `sara/example`, `examplesTable`, `exampleQueue` and `/examples` returns nothing. The deletable example slice is confined to apps/api (/v1/examples), apps/checkout (entirely), and apps/admin (the Examples page). Your customer-facing dashboard is clean of it.
- The console's test-mode surface is correctly mode-gated. apps/console/src/app/(app)/developers/test/page.tsx:14 computes `const isLive = mode === 'live'` and at :40-46 renders 'Switch to sandbox mode to use the test instruments' instead of the panel when live. apps/console/src/components/console/customers/engine-buttons.tsx:48 likewise disables the attach-test-method button with `title={!isSandbox ? 'Switch to sandbox to attach a test method' : ...}`. Do not delete these — they are the sandbox developer experience.
- The docs EventCatalog's exclusion of `example.*` (src/components/mdx/event-catalog.tsx:87) is deliberate and correct on its own terms — I filed the mismatch against the live API, but the FIX belongs in apps/api, not here. Do not "restore" the example events to the docs.
- The docs MCP server's tool surface is accurate and read-only. src/app/api/mcp/route.ts exposes only search_docs, get_page, list_operations, lookup_error, list_test_methods — no write/action tools. I verified its one hardcoded factual claim, `endpoint: "POST /v1/sandbox/payment-methods"` (route.ts:131), against the real router: it exists and is correct. (Its list_operations does surface /v1/examples, but that is the examples-scaffold finding, not an MCP defect — it resolves itself when the router is unmounted and the spec regenerated.)
- The error table (elixir.mdx:180-193) matches `Nombaone.Error.build/3` (error.ex:198-217) status-for-status: 400/401/403/404/409/422/429/5xx -> BadRequest/Authentication/PermissionDenied/NotFound/Conflict/Validation/RateLimit/ServerError, plus the transport-only ConnectionError/TimeoutError. `RateLimitError`'s extra `:retry_after`, `:limit`, `:remaining` are real (error.ex:283 `use Nombaone.Error, extra: [:retry_after, :limit, :remaining]`), and every struct is a genuine Elixir exception whose `message/1` appends the hint (error.ex:169-171 + :143-144).
- The go.mdx "honest hard parts" section (go.mdx:316-334) is accurate, including its two counterintuitive claims: `Subscriptions.UpdatePaymentMethod` really does return `*PaymentMethod` not `*Subscription` (subscriptions.go:551), and `Mandates.Retrieve` really does return `*PaymentMethod` (mandates.go:99). `Subscriptions.Dunning.Retrieve` → `.GraceAccessUntil` is real (subscriptions.go:192).
- The go.mdx errors section (go.mdx:174-202) COMPILES and every claim holds. All 8 documented error types exist and are reachable with errors.As: *BadRequestError, *AuthenticationError, *PermissionDeniedError, *NotFoundError, *ConflictError, *ValidationError (with `.Fields`), *RateLimitError (with `.RetryAfter`, `.Limit`, `.Remaining` — all three real), *ServerError, plus *ConnectionError and *TimeoutError. *APIError carries the documented `.Code` and `.RequestID`.
- The go.mdx sandbox section (go.mdx:268-301) compiles and is accurate. `nombaone.ErrSandboxRequiresSandboxKey` is a real sentinel (sandbox.go:12) reachable with errors.Is; the guard genuinely fires locally before any network call (sandbox.go:75-80 `assertSandbox` checks `s.client.mode == ModeLive`). All five documented behaviors match the real enum (sandbox.go:20-25): success, decline_insufficient_funds, decline_expired_card, decline_do_not_honor, requires_otp. `AdvanceCycle(...).Outcome` and `SimulateWebhook(...)` are real.
- The go.mdx webhook HANDLER sample (go.mdx:215-257) compiles against the SDK's own package — webhook.ConstructEvent, event.Event.ID, event.Type, event.DataInto, webhook.RefData, webhook.InvoiceActionRequiredData (.CheckoutLink), webhook.InvoicePaymentFailedData (.Reason) are all real symbols. (The API surface is right; only the SCHEME it implements is wrong against the server — reported separately.)
- The guide's 'honest hard parts' MSRV callout (rust.mdx:344-349) is TRUE and I hit it live. My first `cargo check` on rustc 1.85.0 failed with exactly the documented resolve: `error: rustc 1.85.0 is not supported by the following packages: icu_collections@2.2.0 requires rustc 1.86 …` pulled in via reqwest → url → idna. Adding the documented `idna_adapter = "=1.1.0"` pin fixed it immediately. The docs told the truth about a real 2am problem.
- The guide's FIRST sample (elixir.mdx:39-67) actually runs — I checked it call-by-call against both the SDK and the wire. `Nombaone.Plans.create(client, %{name: "Pro"})`: name is the only required field (create-plan.ts:44-51 returns at 201 with `prices: []` when none are embedded). `Nombaone.Plans.Prices.create/4` with `unit_amount_in_kobo` + `interval: "month"` matches CreatePriceBody. `Nombaone.Sandbox.create_payment_method(client, %{customer_id: …})` POSTs `/v1/sandbox/payment-methods` (sandbox.ex:50) which IS mounted and reachable (apps/api modules/test/routes.ts:39, always-mounted per routes.ts:53, gated by `requireSandboxMode`), and its body schema takes exactly `customerId`/`behavior`/`kind` (core-contracts/src/validations/test.ts:21-25). `Nombaone.Subscriptions.create/3` with customer_id/price_id/payment_method_id matches createSubscriptionBody (validations/subscription.ts:15-17). Every function exists at the emitted arity. The sample is sound.
- The guide's `voidInvoice` callout (java.mdx:311-315) is CORRECT and compiles — `nombaone.invoices().voidInvoice(id)` is the real method (Invoices.java:66). The bug is that the auto-generated reference on the same site says `invoices().void(...)`.
- The guide's two option tables are exact. Client options (elixir.mdx:91-99) match client.ex:26-44 field-for-field (`:timeout` 30_000, `:max_retries` 2, `:transport` defaulting to `Nombaone.Transport.HTTPC`, `:base_url`, `:transport_options`, `:default_headers`). Per-call options (elixir.mdx:121-129) all exist: `:idempotency_key` (http.ex:153, computed once BEFORE the retry loop as claimed), `:headers` including the subtle "a `nil` value removes an SDK default" claim (util.ex:112-114 `if is_nil(value), do: Map.delete(acc, key)`), `:timeout`/`:max_retries` (http.ex:41-42), and `:with_response` returning `%Nombaone.Response{}` with exactly `:data, :status, :request_id, :headers` (api.ex:37 + response.ex:13).
- The guide's whole sandbox section (elixir.mdx:239-264) is accurate: all five behaviors (`success`, `decline_insufficient_funds`, `decline_expired_card`, `decline_do_not_honor`, `requires_otp`) match `testMethodBehaviors`; `advance_cycle` -> `/v1/sandbox/subscriptions/:id/advance-cycle` (routes.ts:51); `simulate_webhook` -> `/v1/sandbox/webhooks/simulate` with `payload` genuinely optional (test.ts:31); and the claim that it "raises an ArgumentError locally, before any network call" on a live key is real (sandbox.ex:123-128 `assert_sandbox!(%Nombaone.Client{mode: :live})`).
- The hand-written guide `content/sdks/dotnet.mdx` COMPILES. I extracted all seven non-webhook C# blocks verbatim, put them in a project referencing the real `NombaOne.csproj`, and `dotnet build` returned `Build succeeded.` with 0 errors. That includes the FIRST sample on the page ('Your first subscription', lines 35-68) — it runs: `Plans.CreateAsync(new PlanCreateParams { Name })`, `Plans.Prices.CreateAsync(planId, new PriceCreateParams { UnitAmountInKobo, Interval })`, `Customers.CreateAsync`, `Sandbox.CreatePaymentMethodAsync(new SandboxPaymentMethodParams { CustomerId })`, `Subscriptions.CreateAsync(new SubscriptionCreateParams { CustomerId, PriceId, PaymentMethodId })`, `subscription.Status`. Note the irony: the hand-written page gets `PriceCreateParams` right where the auto-generator gets it wrong.
- The hand-written guide's API SHAPES are accurate — I compiled them. Every code block in apps/docs/content/sdks/java.mdx other than the import line of the first sample compiles clean against the real 0.1.0 jar (javac exit 0): the 4 constructor overloads (java.mdx:94-99) match Nombaone.java exactly; the ClientOptions builder chain (java.mdx:108-114: baseUrl/timeout/maxRetries/httpTransport/defaultHeader) all exist; the pagination block (java.mdx:164-183: `Page<Invoice>`, `page.data()`, `page.pagination()`, `page.hasNextPage()`, `page.nextPage()`, `.autoPager()`, `.stream()`, `InvoiceListParams.builder().status(InvoiceStatus.OPEN).limit(50)`) all exist; the error block (java.mdx:216-224: `ValidationException.fields()`, `RateLimitException.retryAfter().ifPresent`, `NotFoundException.code()`, `.requestId().orElse(...)`) all exist with those exact Optional-returning signatures; the sandbox block (java.mdx:284-298: `SandboxPaymentMethodBehavior.DECLINE_INSUFFICIENT_FUNDS`, `advanceCycle(id).outcome()`, `SandboxSimulateWebhookParams.builder().type(...)`) all exist. The whole 400→429 exception table (java.mdx:204-213) maps 1:1 to src/main/java/xyz/nombaone/error/. This guide was clearly written against the real SDK; the generated surfaces were not.
- The homepage's '< 2% of Nigerians carry a card' (apps/website/src/app/page.tsx:222) and the ₦12,500 double-entry ledger illustration (page.tsx:66-67, trust/page.tsx:20-21) are editorial/illustrative marketing content, not stubs. They are consistent with the product's actual double-entry model. Not flagging them.
- The internal-code collapse itself works as designed — no internal code can leak to the wire (error-handler.ts:40 + toPublicErrorCode). The bug reported above is that three genuinely-public webhook codes were left OUT of the public set, not that the leak guard is broken.
- The money convention is consistent end to end. go.mdx:114-116 and :37 claim integer kobo with `InKobo` suffixes; prices.go:57-60 confirms `UnitAmountInKobo Kobo` with the doc-comment `250_000 is ₦2,500.00 — not ₦250,000`. The generated snippets emit `UnitAmountInKobo: 250000` / `AmountInKobo: 250000` — the right unit and the right magnitude. No naira/kobo 100× hazard in the Go surface.
- The node constructor emitted by snippets.ts:204 — `const nombaone = new Nombaone(); // reads NOMBAONE_API_KEY` — is VALID. client.ts:119 does `const resolvedKey = opts.apiKey ?? process.env.NOMBAONE_API_KEY;`, so the zero-arg form is the env form. Node does NOT have the Rust bug (where `Nombaone::new()` requires an api_key and `from_env()` is the env one).
- The pagination section (elixir.mdx:138-168) is fully true: `Nombaone.Page` is `Enumerable` (page.ex:133 `defimpl Enumerable, for: Nombaone.Page`), exposes `has_next_page?/1` (:57), `next_page/1` (:67), `stream/1` (:86); `page.data` / `page.pagination.has_more` / `page.pagination.next_cursor` all exist; `next_page/1` really does raise `ArgumentError` when there is no next page (page.ex:67-69); and the fine-print claim that a mid-stream page fetch RAISES rather than returning a tuple is real (page.ex:98 `{:error, error} -> raise error`).
- The per-call options table (node.mdx:103-111) matches `RequestOptions` (core-types.ts:80-100) exactly — idempotencyKey, headers, signal, timeout, maxRetries, all five, no invented ones. Pagination is as documented: `page.hasNextPage()` (pagination.ts:34), `page.nextPage()` (pagination.ts:39), async iteration (pagination.ts:53), and `.withResponse()` returning {data, requestId, response} (api-promise.ts:40-43). The error table (node.mdx:151-160) matches the real class hierarchy, and `err.fields` (error.ts:184), `err.retryAfter` (error.ts:293), `err.code`/`err.requestId` (error.ts:178/186) all exist.
- The php.mdx guide's non-snippet API claims all check out against the source: `$page->pagination->hasMore` / `->nextCursor` / `hasNextPage()` / `nextPage()` / `autoPagingIterator()` all exist on src/Page.php; `$customer->requestId()` and `getLastResponse()` exist on src/Models/Model.php:37,43; `$e->fields`, `$e->retryAfter`, `$e->limit`, `$e->remaining`, `$e->statusCode`, `$e->docUrl`, `$e->requestId` all exist on ApiException/RateLimitException; the full 400/401/403/404/409/422/429/5xx exception table matches src/Exceptions/*; `ErrorCode::CUSTOMER_NOT_FOUND` exists (ErrorCode.php:61); `MandateSetup->consentInstruction` exists (:22); `AdvanceCycleResult->outcome` exists (:17); the five sandbox `behavior` values match Sandbox.php:26's documented set; and `settlements->createPayout($params, ['idempotencyKey' => …])` matches the real two-array signature.
- The playground's live-key guard is load-bearing and FAILS CLOSED — do not touch it. apps/docs/src/app/api/playground/route.ts:60-66 rejects any `nbo_live_` key with a 422 before anything else happens, and 67-73 rejects any key that is not `nbo_sandbox_`. Live money can never flow through the docs proxy.
- The rest of python.mdx verified line-by-line against source and found CORRECT: the constructor option table (:93-100) matches Nombaone.__init__ (_client.py:279-289) including timeout-in-seconds; RequestOptions fields (:126-132) match _models.py:166-174; the pagination surface (page.data, page.pagination.has_more/.next_cursor, has_next_page(), next_page(), sync __iter__, async __aiter__ on an awaited page) matches _pagination.py:25-162 exactly, including the awkward-but-real 'async for x in await client.invoices.list(...)'; the full exception table (:206-218) matches _exceptions.py incl. RateLimitError.retry_after/limit/remaining and ValidationError.fields; cancel(mode='at_period_end') (subscriptions.py:512-517); settlements.create_payout(amount_in_kobo, bank_code, account_number) (settlements.py:154); the deliberately-inconsistent filter names customer_ref (payment_methods.py:157) and plan_ref (prices.py:63); the invoice status filter excluding partially_paid (invoices.py:78-80); DunningState.grace_access_until (subscriptions.py:163); Subscription.cancellation_reason (subscriptions.py:68); and the update_payment_method -> PaymentMethod callout (subscriptions.py:598-612, cast_to=PaymentMethod).
- The snippet constructor `$nombaone = new Nombaone(); // reads NOMBAONE_API_KEY` is genuinely valid for PHP — unlike the Rust `Nombaone::new()` bug. Nombaone::__construct has `string|array|null $apiKey = null` and resolveApiKey falls back to `getenv('NOMBAONE_API_KEY')`; I constructed it zero-arg with only the env var set and it succeeded.
- The snippet preamble `nombaone = Nombaone::Client.new  # reads NOMBAONE_API_KEY` (snippets.ts:236) genuinely works — `Client#initialize(api_key = nil, ...)` falls back to `ENV.fetch("NOMBAONE_API_KEY", nil)` (client.rb:56). Unlike the Rust SDK (whose `new()` requires an api_key), the zero-arg Ruby constructor is real, so the FIRST sample on every reference page compiles and runs.
- The webhook HANDLER shape in the guide is right even though the verification scheme is not: `Nombaone.WebhookEvent` really does carry `:type`, a nested `{:event, Nombaone.WebhookEvent.Ref}` (so `event.event.id` for dedupe is valid), and a raw `:data` map (webhook_event.ex:34), so `event.data["reference"]` / `["checkoutLink"]` / `["reason"]` are correct once a delivery gets past the (broken) signature check.
- The webhook delivery BODY shape the SDK parses is right: packages/sara/src/webhooks/deliver.ts:177-185 `buildBody` emits `{ id, type, event: { id, type, createdAt }, data }`, which is exactly what WebhookEvent::fromArray reads — so the guide's `$event->event->id` (php.mdx:214), `$event->type` as a plain string in `match` (php.mdx:219), and `$event->data['reference']` are all correct. Only the SIGNATURE scheme is broken, not the parse.
- The word "placeholder" in the BUILT HTML is a false positive: every hit is an HTML `placeholder=` attribute on the WebhookVerifier's inputs (`placeholder="1750758072"`, `placeholder="whsec_…"`) on /webhooks/signing-and-verification and /getting-started/verify-in-your-devtools. Legitimate form UX. Leave alone.
- The word "scaffold" in the BUILT HTML is a false positive — it appears only in .next/server/app/sdks.html and sdks/cli.html as the CLI feature prose "Tail webhooks, scaffold a project, and drive the sandbox from your terminal." That is a normal English use of the verb, not a stub marker. (The CLI page has its own, separate problem — that it documents an unbuilt tool — but the word itself is fine.)
- The word "temporary" in the BUILT HTML is a false positive: it is billing prose on /merchants/set-up-dunning-messages — "A failed payment is usually temporary. Nomba One keeps the subscription active while it retries." Correct and load-bearing copy.
- The ~8 fabricated `*Params` type names do NOT touch node. snippets.ts builds `paramsType` only inside the go (:276), dotnet (:295), java (:317), and rust (:338) renderers; the node renderer (snippets.ts:194-208) emits a plain object literal via bodyArg(). Node is immune to that whole class of defect.
- Trial semantics match the docs: `trialDays` on create overrides the price's `trialPeriodDays` (create.ts:107 `input.trialDays ?? price.trialPeriodDays ?? 0`), a trialing sub is created with no charge, and the anchor is clamped at-or-after trial end — so the `trialing` bullet in start-a-subscription.mdx and the SDK's `trialDays` docstring are both true.
- Worth knowing for the fix: the `check:sdks` build gate CANNOT catch any of the method-name bugs above. Its docblock (apps/docs/scripts/check-sdks.ts:1-17) scopes it to three things — page coverage, component integrity (`<SdkHeader>`/`<SdkMethodIndex>` present, ids are real registry ids), and the NOMBAONE_API_KEY env-var check. It never resolves a single method name against a real SDK, which is precisely why the 5 fabricated names have survived. The 75-op `function_exported?/3` resolve I ran here is cheap and would make a real gate.
- ZERO keyword-argument drift across all 75 operations. Not a single `ArgumentError` (unknown keyword / missing keyword / wrong arity) was raised — meaning every keyword name and every positional path-arg order the snippet generator emits matches the real Ruby method signature. I also diffed the JSON body the SDK actually serialized against each operation's declared OpenAPI `bodyFields`: zero unknown-to-spec keys. The snake_case→camelCase round-trip in `lib/nombaone/internal/util.rb:40 camelize` is lossless for every field in the spec.
- ZERO occurrences of TODO, FIXME, XXX, HACK, "not implemented", "lorem", "dummy", "changeme", "do not ship", "delete me", "remove this" or "coming soon" anywhere in the built output (.next/server/app) or in public/. The rendered site is clean of the classic markers; the real problems are the semantically-legitimate-looking ones I filed.
- Zero docUrl 404s from the API. Every docUrl the handler emits is `errorMetaFor(publicCode)` (error-handler.ts:49), i.e. always a PUBLIC code; ErrorReference emits `id={code}` for exactly the members of PUBLIC_ERROR_CODES (error-reference.tsx:62 + :92). So all 72 emittable `…/errors#CODE` anchors resolve. (The 43 non-public codes' docUrls in ERROR_CODE_META have no anchor, but they can never reach the wire.)
- `POST /v1/invoices/{id}/void` is correct end to end: `voidInvoiceBody` (packages/core-contracts/src/validations/invoice.ts:12-14) is `{ comment?: string ≤500 }`, matching the spec body exactly; the controller returns HTTP 200 with a re-read Invoice (void-invoice.ts:27-29); `voidInvoice` (services/invoices/void.ts:26-33) is idempotent on an already-void invoice and throws `INVOICE_NOT_VOIDABLE` only from a non-draft/open state — exactly what the SDK doc-comments claim (nombaone-java/.../Invoices.java:59 "Paid invoices cannot be voided — refund the settlement instead").
- `nombaone.webhook_endpoints().list()` (op 60) — the one zero-arg list snippet — is CORRECT, because webhook_endpoints.rs:207 really is `pub fn list(&self) -> Paginator<WebhookEndpoint>` with no params struct. Worth stating explicitly: the list bug is not 'all lists', it is 'all lists except this one', which is what makes it read as random rather than structural.
- apps/checkout/src/lib/db.ts's `isLocalPostgresUrl` driver switch (pg pool for localhost, Neon HTTP otherwise) is correct infrastructure, not a hack. Same pattern as the console. If you keep any of checkout, keep this.
- apps/docs/.env is NOT in git — it is matched by .gitignore:20 (`.env*`) and `git ls-files` confirms it is untracked. The GROQ_API_KEY, AI_GATEWAY_API_KEY and DOCS_DATABASE_URL values I saw in it have not leaked into the repository.
- apps/website/src/app/changelog/page.tsx ships a hardcoded `const ENTRIES` array, which pattern-matches as fixture data but is NOT — the entries are truthful and correspond to real shipped work (v0.15 Jul 12 2026 'A plan and its prices, in one step' matches the working tree; v0.14 'Card OTP → checkout-link dunning fallback' matches apps/api/src/shared/services/billing/actionLink.ts). Leave it.
- apps/website/src/app/robots.ts correctly disallows /kitchen-sink and apps/website/src/app/sitemap.ts correctly omits the four broken /use-cases/* slugs and /kitchen-sink. The SEO plumbing is sound — the problem is that the broken use-case pages are reachable by LINK from /use-cases (which IS in the sitemap), so robots/sitemap hygiene does not save you there.
- buildStubPage() renders for ZERO pages today — do not panic-delete content chasing a phantom. I enumerated all 87 slugs in content/manifest.ts and checked each against content/<slug>.mdx: every one is authored. `grep -rl "Coming soon" .next/server/app` returns 0 files. The mechanism is armed but has never fired (I still recommend removing it — see the finding — but nothing is broken right now).
- node.mdx's "honest hard parts" callout (lines 258-262) is TRUE, not marketing. `subscriptions.updatePaymentMethod` really does return APIPromise<PaymentMethod> (subscriptions.ts:491-495) and `mandates.retrieve` really does return APIPromise<PaymentMethod> (mandates.ts:97). The docs correctly warn about a genuine wire quirk.
- python.mdx's first sample (lines 35-63) actually runs. Every call and attribute exists: plans.create(name=...) (plans.py:192), plans.prices.create(plan.id, unit_amount_in_kobo=..., interval=...) with plan_id positional (plans.py:61-66), customers.create(email=..., name=...) (customers.py:89), sandbox.create_payment_method(customer_id=...) (sandbox.py:62), subscriptions.create(customer_id=..., price_id=..., payment_method_id=...) (subscriptions.py:368); and plan.id / price.id / customer.id / method.id / subscription.status are all real model fields (plans.py:26, prices.py:24, customers.py, payment_methods.py:32, subscriptions.py:54).
- registry.ts PHP entry is fully accurate — every field verified against the real manifest: `package: "nombaone/nombaone-php"` = composer.json `"name"`; `registry: "Packagist"` + registryUrl consistent; `languageFloor: "PHP 8.2+"` = composer.json `"php": ">=8.2"`; `install: "composer require nombaone/nombaone-php"` = README; `clientClass: "NombaOne\\Nombaone"` = the real FQCN (namespace NombaOne, final class Nombaone); `errorModel: "Typed exceptions (code = $errorCode)"` = ApiException.php:34 `public readonly string $errorCode`.
- registry.ts `dotnet` entry is ACCURATE on every field — this is the one surface with no bugs. `version: "0.1.0"` matches `NombaOne.csproj:16 <Version>0.1.0</Version>`, AND 0.1.0 is genuinely published: I fetched https://api.nuget.org/v3-flatcontainer/nombaone/index.json → HTTP 200, `{"versions":["0.1.0"]}`. This is NOT a phantom pin. Also verified: `package: "NombaOne"` = `<PackageId>NombaOne</PackageId>`; `registry: "NuGet"`; `install: "dotnet add package NombaOne"` (correct CLI); `languageFloor: ".NET 8 · netstandard2.0"` = `<TargetFrameworks>netstandard2.0;net8.0</TargetFrameworks>`; `clientClass: "Nombaone"` = `Nombaone.cs:26 public sealed partial class Nombaone`; `async: "Async (Task)"`; `errorModel: "Exceptions (NombaoneException)"` = `NombaoneException.cs:24`; `webhookHelper: "WebhookVerifier"` = `WebhookVerifier.cs:19 public static class WebhookVerifier`. Zero registry findings.
- registry.ts is CLEAN for Elixir — all 8 identity facts verified against the real manifest, including the version. apps/docs/src/lib/sdks/registry.ts:177-190: package `nombaone` = mix.exs:81 `name: "nombaone"`; registry Hex; languageFloor "Elixir 1.15+" = mix.exs:11 `elixir: "~> 1.15"`; install `{:nombaone, "~> 0.1.0"}` = the real Hex dep line; clientClass `Nombaone.Client` = client.ex:1 `defmodule Nombaone.Client`; errorModel `{:ok, _} / {:error, _} + ! raisers` = the actual @spec on every function; webhookHelper `Nombaone.Webhooks` = webhooks.ex:1. Critically, `version: "0.1.0"` is NOT a phantom pin — I hit the hex.pm API and 0.1.0 is genuinely published (latest_stable, inserted 2026-07-07) and matches mix.exs:4 `@version "0.1.0"`. Nothing to fix here.
- registry.ts version 0.1.0 is REAL, not a phantom pin. I hit Maven Central directly: https://repo1.maven.org/maven2/xyz/nombaone/nombaone/maven-metadata.xml returns 200 with <release>0.1.0</release>, <lastUpdated>20260707074202</lastUpdated>, and the 0.1.0 .pom fetches with matching groupId/artifactId/version. registry.ts:145 `version: "0.1.0"` == pom.xml:10 `<version>0.1.0</version>`. This is the one SDK-registry fact I most expected to be fabricated, and it holds.
- registry.ts's Python block (apps/docs/src/lib/sdks/registry.ts:78-92) is 100% accurate — I checked every field against pyproject.toml AND the live PyPI JSON API. package 'nombaone' OK; registry 'PyPI' OK; version '0.1.0' OK (published, and 0.1.0 is the ONLY release — no phantom version); languageFloor 'Python 3.9+' OK (pyproject requires-python '>=3.9', PyPI metadata agrees); install 'pip install nombaone' OK; clientClass 'Nombaone · AsyncNombaone' OK (both exported, __init__.py:20); async 'Sync + async' OK; errorModel 'Exceptions' OK; webhookHelper 'webhooks.construct_event' OK (webhooks.py:63). Zero drift — do not chase a version bug here.
- registry.ts:115 `version: "0.1.2"` is a REAL, released version — not a phantom pin. It matches src/Version.php:26 `public const FALLBACK = '0.1.2';`, the CHANGELOG `## [0.1.2] - 2026-07-07` entry, and an actual `v0.1.2` git tag (Packagist ingests the tag). Three-way agreement; nothing to fix.
- registry.ts:121 `webhookHelper: "Webhooks::constructEvent"` uses PHP's static-call syntax for what is actually an instance method (`$nomba->webhooks->constructEvent(...)`). I did NOT report it as a finding because I grepped the whole docs app: the `webhookHelper` field is declared (registry.ts:55) and populated for all nine SDKs but never rendered by any component or MDX page — it is dead data, not a user-facing claim.
- registry.ts:124-137 — EVERY Ruby identity fact is correct. I checked each against the gemspec and the live RubyGems API. `package: "nombaone"` == gemspec `spec.name = "nombaone"`. `version: "0.1.0"` == `lib/nombaone/version.rb:6 VERSION = "0.1.0"` == the ONLY version published to RubyGems (`GET rubygems.org/api/v1/versions/nombaone.json` → `0.1.0`, built 2026-07-07, 1,206 downloads). This is NOT a phantom pin — the gem is really released. `languageFloor: "Ruby 3.1+"` == gemspec `required_ruby_version = ">= 3.1"`. `install: "gem install nombaone"` works. `registryUrl` returns HTTP 200. `clientClass: "Nombaone::Client"` exists (`lib/nombaone/client.rb:16`). `errorModel: "Raised, typed (Nombaone::Error)"` == `errors.rb:103 class Error < StandardError`. `webhookHelper: "Nombaone.webhooks"` == `lib/nombaone.rb:56 def self.webhooks`. `async: "Synchronous"` correct.
- registry.ts:169-182 (the whole rust entry) is CORRECT on every field. package `nombaone` == Cargo.toml:2 `name = "nombaone"`. version `0.1.1` == Cargo.toml:3 `version = "0.1.1"` — AND it is genuinely published: `curl https://crates.io/api/v1/crates/nombaone` returns `"default_version":"0.1.1","num_versions":1,"yanked":false`, published 2026-07-07. This is NOT a phantom pin. languageFloor `Rust 1.85+` == Cargo.toml:5 `rust-version = "1.85"`. install `cargo add nombaone` works. clientClass `Nombaone` == client.rs:52. errorModel `Result<T, nombaone::Error>` == error.rs / lib.rs:42. webhookHelper `nombaone::webhooks` == lib.rs:38 `pub mod webhooks`. async `Async (tokio) + blocking` == Cargo.toml:30-35 (`blocking` feature exists and `send_blocking`/`iter` are real: client.rs:475, pagination.rs).
- registry.ts:96-108 (the whole `go` block) is 100% accurate against the real manifest — I checked every field. `package: "github.com/nombaone/nombaone-go"` = go.mod:1 `module github.com/nombaone/nombaone-go`. `version: "0.1.0"` = version.go:5 `const Version = "0.1.0"` AND an actual `v0.1.0` git tag exists in the SDK repo AND CHANGELOG.md records `## [0.1.0] - 2026-07-05` — this is NOT a phantom pinned version. `languageFloor: "Go 1.23+"` = go.mod:3 `go 1.23`. `install`, `registry`, `registryUrl` (pkg.go.dev), `clientClass: "nombaone.Client"` (client.go:21), `errorModel: "Typed error returns (errors.As)"`, `webhookHelper: "webhook.ConstructEvent"` (webhook/webhook.go:88) all correct.
- rehype-error-autolink.ts is correctly grounded: `const CODES = new Set(PUBLIC_ERROR_CODES)` (line 29) and it only wraps an inline <code> whose text is an exact member (line 50). It cannot manufacture a link to a non-existent anchor. The only literal `/errors#…` link in the docs is `/errors#API_KEY_INVALID`, which resolves.

---

# Refuted — raised, investigated, dismissed

50 findings were killed by the refuters. Recorded so the same ground is not re-litigated.

- **The only documented way to grant credit is a curl with no Idempotency-Key — POST /v1/customers/{id}/credit hard-requires it and returns 400**  
  ↳ (no reason captured)
- **API-key scopes are enforced on every customers/coupons route and documented nowhere**  
  ↳ The enforcement half of the finding checks out (customers/coupons routes are all requireScope-gated; sara scope.ts fails closed with 403; the auth page and generated reference never mention scopes; EndpointHeader's `scope` prop is used only on examples.mdx; OpenAPI security carries an empty scope ar
- **The O1 archive guard is a Phase-01 stub (`async () => 0`) — `PLAN_HAS_ACTIVE_SUBSCRIBERS` can never fire, but /errors publishes it as a real safety rail**  
  ↳ (no reason captured)
- **The generated /reference/plans examples show a plan named "Ada Lovelace" and a just-created price with `active: false`**  
  ↳ (no reason captured)
- **No docs surface states the API-key scope any subscription endpoint requires, though keys are minted with an explicit scope list and a missing scope hard-fails**  
  ↳ The descriptive half of the finding is accurate (spec emits empty scope arrays at apps/api/src/shared/openapi/build.ts:135, the reference UI shows only a padlock at apps/docs/src/components/reference/api-operation.tsx:32-36, and no docs page names a subscription scope), and enforcement is real (pack
- **`expectedAmount` is integer kobo but is the one money field that breaks the docs' own "every money field ends in InKobo" promise — and it carries no unit anywhere in the spec**  
  ↳ (no reason captured)
- **Four mandate/payment-method error codes are published on /errors as catchable API errors but are never thrown by any endpoint**  
  ↳ (no reason captured)
- **The documented webhook delivery body is wrong: `reference` and `createdAt` do not exist at top level, the `event` object is missing, and top-level `id` is the DELIVERY reference, not the event id**  
  ↳ (no reason captured)
- **`signingSecret` — the once-only webhook secret — is absent from the POST /v1/webhooks response schema, so the generated reference page for "Create a webhook endpoint" never shows it**  
  ↳ (no reason captured)
- **"Rotate without downtime — issues a new secret while briefly honoring the old one" is false: rotate-secret overwrites the signing key immediately, with no dual-secret window**  
  ↳ (no reason captured)
- **The generated node method index silently drops all three /v1/sandbox/* operations — including the one the page's own quickstart depends on**  
  ↳ REFUTED as framed. The auditor's mechanical claim is accurate (RESOURCE_ORDER at model.ts:138-152 has no "sandbox" entry, getApiResources() maps only over it, so the three /v1/sandbox/* ops are absent from SdkMethodIndex) — but they quoted the array starting at line 138 and omitted the design commen
- **The node SDK's webhook test suite signs its own fixtures with the SDK's own scheme, so it is green while being wrong against the real server signer**  
  ↳ (no reason captured)
- **python.mdx's 'honest hard parts' tells you to call subscriptions.dunning.retrieve() with no arguments — it requires the subscription id**  
  ↳ Quotes verified: python.mdx:329 does say "Read `subscriptions.dunning.retrieve()` and honor `grace_access_until`", and nombaone-python/src/nombaone/resources/subscriptions.py:277-279 does define `def retrieve(self, subscription_id: str, *, options=None) -> DunningState` with subscription_id required
- **plans.prices.create docstring omits the 'minute' interval that the guide teaches and the API accepts**  
  ↳ (no reason captured)
- **Webhook scheme (EXTENDS the established finding): the Go SDK's test suite is a closed loop that can never detect the mismatch, and the wrong scheme is also baked into its README and a shipped runnable example**  
  ↳ (no reason captured)
- **Params-type fabrication, enumerated for Go — 8 wrong type names, and 2 of them resolve to a REAL but WRONG type, so the compiler reports a silent type mismatch instead of an undefined symbol**  
  ↳ (no reason captured)
- **The PHP quickstart — the first PHP code in the docs — reads `NOMBAONE_SECRET_KEY`, an env var nothing in the product uses; it sends `Authorization: Bearer ` and 401s**  
  ↳ (no reason captured)
- **The published gem leaks the deletable `example.*` scaffold: `Nombaone::ErrorCode::EXAMPLE_NOT_FOUND` is a public constant in nombaone 0.1.0**  
  ↳ The auditor's quotes are all real, and `Nombaone::ErrorCode::EXAMPLE_NOT_FOUND` genuinely exists in the shipped gem (errors.rb:85 + const_set at :90). But the framing — an SDK "leak" of scaffold content that contradicts the SDK's own stated exclusion policy — is wrong. errors.rb:4-8 says the list is
- **ruby.mdx contradicts itself: its sandbox section tells you to rehearse your webhook handler with a delivery its own callout says the handler cannot verify**  
  ↳ Quotes are real and correctly located (ruby.mdx:192-215, 240-241, 246, 253-259), and the backend half of the "truth" is confirmed: packages/sara/src/webhooks/sign.ts:18 signs a bare lowercase-hex HMAC over rawBody only (no timestamp), deliver.ts:113 uses it, and apps/api/src/shared/services/webhooks
- **SYSTEMATIC: 10 of the 75 generated Java snippets name a `*Params` class that does not exist in the SDK — the emitter derives the type name from the URL resource, which is structurally wrong whenever the SDK's params class isn't named after the URL segment**  
  ↳ (no reason captured)
- **The `check:sdks` build gate is named an "honesty gate" but never opens a single SDK file — it cannot catch any of the above, and it is why 18/75 broken Java snippets ship green**  
  ↳ (no reason captured)
- **Five fabricated `*Params` type names in .NET snippets — and PUT /v1/organization vs PUT /v1/organization/billing collide on ONE fabricated name while the SDK needs two different types**  
  ↳ (no reason captured)
- **Rust *Params type names in the snippets are derived from the URL path, not the crate — 7 ops name a struct that doesn't exist, and one names a struct that exists but posts the wrong body**  
  ↳ (no reason captured)
- **Elixir webhook verifier rejects 100% of real deliveries — and blames the header, so the integrator never suspects the scheme**  
  ↳ (no reason captured)
- **The Elixir method reference renders all 75 methods in a form that is not Elixir — and contradicts its own opening paragraph**  
  ↳ (no reason captured)
- **GET /v1/events/catalog is unauthenticated and returns the two `example.*` scaffold events verbatim — while the docs deliberately filter them out**  
  ↳ Both pillars of the finding fail against the files. (1) The missing auth is deliberate and documented on the very lines the auditor quotes: apps/api/src/apps/main/modules/events/routes.ts:13 says `// Public, machine-readable webhook event catalog (L — "webhook reference is public").` The handler ser
- **The docs playground's "test instruments must never hit a live base" guard is dead code after the /test → /sandbox rename**  
  ↳ (no reason captured)
- **`example:read` / `example:write` remain in the public ApiKeyScope type and zod enum**  
  ↳ (no reason captured)
- **The /reference/examples page's own curl sends "amount" but the endpoint requires "amountInKobo" with additionalProperties:false — the documented happy path always 422s**  
  ↳ (no reason captured)
- **Dead `/test/*` safety guard in the playground proxy — the API's instruments were renamed to `/sandbox/*`, so the guard now matches nothing**  
  ↳ Facts check out, but on impact/reachability this is nil, so it refutes under the stated rubric ("refute ONLY if unreachable or impact essentially nil") — both conditions hold.

REACHABILITY: The guard at route.ts:87 is doubly unreachable. (a) The instruments are mounted at /sandbox/* (apps/api/src/a
- **Orphan empty directory apps/docs/public/test-toolkit/ left behind by the test→sandbox rename**  
  ↳ The observable facts are real but the conclusion is mislocated. Confirmed: apps/docs/public/test-toolkit/ exists on local disk, is empty (total 0, only . and ..), sits beside apps/docs/public/sandbox-toolkit/ which holds the four mirrors (clock.md, overview.md, payment-methods.md, simulate-webhooks.
- **Four of the five "Use cases" cards land on a scaffold page reading "we're working on it." — two clicks from the header nav**  
  ↳ (no reason captured)
- **apps/checkout fabricates settlements: pressing "Pay now" posts a REAL double-entry ledger transaction and fires a REAL signed webhook with zero money moved**  
  ↳ The auditor's code reading is literally accurate (all four quotes verified at the cited lines; confirmExampleFromWebhook does post a balanced settlement txn and emit example.settled with no idempotency or status guard; scope is row-derived so any reference-holder can drive it). But the IMPACT — "mon
- **Homepage hardcodes "99.9% · All systems operational" with a green status dot — not wired to any monitor**  
  ↳ (no reason captured)
- **/kitchen-sink is a developer scratch route served in production**  
  ↳ Every fact in the finding checks out — /kitchen-sink is a real App Router page, it is prerendered into the production build (confirmed in .next/prerender-manifest.json, routes-manifest.json, app-path-routes-manifest.json), it is not in sitemap.ts, it is not linked from any nav, and robots.ts:5 disal
- **Footer "Careers" and "Contact" are dead `#` anchors on every page of the live site**  
  ↳ (no reason captured)
- **apps/admin ships a permanent "Examples" sidebar item and page for the deletable example money-path slice**  
  ↳ (no reason captured)
- **The docs homepage tells integrators the docs don't exist yet, and promises an "interactive subscription simulator" that was never built**  
  ↳ (no reason captured)
- **All 83 operations in the public OpenAPI spec have no operationId, no description, and a summary that is just the method and path**  
  ↳ (no reason captured)
- **A /kitchen-sink page is live on the marketing site saying "we're working on it."**  
  ↳ Impact is essentially nil, and the finding's key supporting claim is factually wrong.

REACHABILITY: /kitchen-sink is servable, but no real user reaches it. It is (a) not linked from header, footer, or any page; (b) absent from apps/website/src/app/sitemap.ts:10-21; and critically (c) EXPLICITLY rob
- **Changelog/version drift in four SDKs — including a .NET wire-shape bug fix that can never publish because <Version> was not bumped**  
  ↳ The quotes are all real and at the cited lines — version/changelog drift genuinely exists in node, rust, java, elixir, and .NET. But the finding's headline and its entire justification for "medium" severity — "a .NET wire-shape bug fix that can never publish", "NuGet keeps serving the version that d
- **apps/checkout is documented as a live host (checkout.nombaone.xyz) but its only mutation is a stub that settles a payment without money moving**  
  ↳ The quotes are real and correctly located, but the finding is wrong on its central impact claim, rests on a premise the auditor admits they could not establish, and reports a disclosed design stub as a defect.

(1) IMPACT IS FALSE. "A payer clicking 'Pay' marks an invoice settled having paid nothing
- **The operator admin panel still ships an /examples page for the deletable scaffold resource**  
  ↳ (no reason captured)
- **The money-path mode-branch doc-comment still describes the pre-rename `test` mode and a "live-pinned deployment" model that no longer exists**  
  ↳ The factual core is correct: the doc-comment at packages/sara/src/rails/test-sim.ts:8-20 is stale. It describes a pre-rename `test` mode (code gates on `'sandbox'` at line 46) and appeals to a "real deployment is env-pinned to `live`" model that the environment migration replaced with per-request, A
- **`expectedAmount` is the only request-body money field in the entire API without `InKobo` — and it is documented with a literally EMPTY description**  
  ↳ The naming observation is real but the finding is materially overstated on all three of its load-bearing claims.

(1) NAMING — HOLDS. I re-ran the machine audit on apps/docs/src/generated/openapi.json: of 21 money-shaped integer properties, `expectedAmount` is indeed the only one lacking an `InKobo`
- **`<FeeBreakdown>` hardcodes a fee schedule that contradicts the real engine by up to 13.3× and invents a second "provider fee" that does not exist**  
  ↳ The finding's FACTS are correct — I verified every one. The engine truly is 150 bps / ₦10 min / ₦2,000 max (packages/sara/src/config/fees.ts:44-48), the component truly hardcodes 1% / ₦10 / ₦150 plus an invented provider fee (fee-breakdown.tsx:40-41), and the fee truly is deducted from gross rather
- **`deliveredCount` on the sandbox webhook simulator counts every due delivery on the platform, not the deliveries for the event you just simulated**  
  ↳ (no reason captured)
- **The OpenAPI spec puts cursor pagination under `meta.pagination`; the server returns it at the TOP LEVEL — no list op declares the field that actually exists**  
  ↳ (no reason captured)
- **The OpenAPI `servers` description says one base URL selects the mode — the server actively 401s a sandbox key sent to the live host**  
  ↳ Quotes are real but the finding is materially overstated on both propagation and impact. (1) The shipped spec's server URL is `http://localhost:8000/v1` — `buildOpenApiDocument(v1Router, baseUrl = 'http://localhost:8000')` (build.ts:117) and neither caller (gen-openapi.ts:20, routes.ts:60) passes a
- **There is no `mandates:read` scope — reading back a mandate you just created needs `payment_methods:read`, and nothing documents it**  
  ↳ Every mechanical quote in the finding is real and correctly located: types/api-key.ts:13 and validations/api-key.ts:12 do expose only 'mandates:write' with no read pair; routes.ts:20 gates POST /mandates on 'mandates:write' and routes.ts:29 gates GET /mandates/:id on 'payment_methods:read'; and pack
