# Nomba One: Console Plan · 00 · Overview & Foundations

> **What this is.** The north-star document for building `console.nombaone.xyz`, the tenant-facing dashboard where a single organization runs its subscription business. It sets the scope boundary, the personas, the signature moves, the inherited design language, the voice, the quality floor, and the working method. Every other console doc depends on this one. Read it first.
>
> **Depends on:** nothing upstream. This is the root console doc. It grounds docs 01 through 09. Its own sources are the shipped product: `apps/api` `/v1` routes and the generated `workbench/api-reference.md`, `packages/sara` (the billing engine), `packages/core-db` (schema), `packages/core-contracts` (DTOs, the frozen event catalog, status enums), `packages/errors` (error codes), `MANIFESTO.md`, and the design language v2 in `workbench/NOMBAONE.pen`.
>
> **The doc set**
> - **00 · Overview & Foundations** *(this doc)*: what the console is and is not, the four personas and ranked jobs, the scope boundary against admin and checkout, the console-auth dependency, inherited design language and voice and motion, the quality floor, the money rule, the two-phase method, and the canvas placement rule.
> - **01 · IA & Navigation**: the app shell, the left-nav areas, the mandatory test/live switch, the cursor-pagination model, RBAC-gated visibility, and the endpoint, entity, and event that justifies every screen.
> - **02 · Core Screens**: per-screen anatomy, wireframes, copy, and reasoning for Subscriptions, Customers, Plans and Prices, and Invoices, each mapped to its DTO, status enum, and actions.
> - **03 · Money Screens**: Payments and Rails, Settlements, Payouts, Escrow, Coupons, Discounts, and Credits, including the escrow-lock withdrawal flow and the refund rules.
> - **04 · Developer Experience**: the Developers area. API keys with once-shown secrets, webhook endpoints, the deliveries inspector and replay, the events feed and payload viewer, request logs, the test-mode instruments, embedded curl and SDK snippets, and the OpenAPI reference.
> - **05 · Hard-Parts Cockpits**: the dunning and recovery cockpit, the reconciliation and matching surface, the escrow explainer, and the real-data bill/fail/recover subscription timeline.
> - **06 · Components**: the net-new component library, the inherited primitives, the app type and density scale, the status-badge system per FSM enum, and the overlay layers, all authored to be back-ported into the shared design system.
> - **07 · Motion**: the interaction and animation spec. The four durations, the three easings, table and drawer and timeline transitions, the reserved recovery-peak spring, live-tail motion, and reduced-motion fallbacks.
> - **08 · Empty & Error States**: the errors-are-a-feature catalog. Every screen's empty, loading, and error state, the public error-code to hint/docUrl/fields rendering contract, and honest live-gated and unbuilt states.
> - **09 · Auth, Team & Onboarding**: the console-auth surface (login, `org_users` roles, TOTP, invites, key context), the test/live environment model, the Nomba-account connection, and the zero-to-first-subscription onboarding.
>
> **How to use it: two phases.**
> - **Phase A: design in pencil.** Before writing production code, produce low-fidelity frames for every screen in docs 02 through 05, plus the shell and interaction storyboards. Use the design language v2 tokens and type scale, but keep fidelity rough. The goal is structure, hierarchy, and flow, reviewed before build. The ASCII wireframes in these docs are the starting point. Translate them into real low-fi frames inside `workbench/NOMBAONE.pen`.
> - **Phase B: build to spec.** Only after the pencil pass is right, build the real console, deriving every color, type, spacing, and motion value from the design language v2 variables. The `.pen` frames are then the hard 1:1 gate for the build.

---

## 1. The product, in one paragraph

Nomba One is a managed, multi-tenant subscription-billing layer built on Nomba's payment rails. Nomba moves money once and answers "did money move?"; Nomba One decides when to move it, how much, over which rail, what to do when it fails, and who gets paid out of it. It runs the whole recurring-billing lifecycle (plans, prices, cycles, proration, invoices, the ledger, dunning, reconciliation, and settlement) so downstream product teams (a gym SaaS, a school-fees platform, an ISP, a streaming app) do not rebuild it. Its distinctive stance is that it is built for how money actually moves in Nigeria rather than ported from a card-on-file world: one subscription object over three rails (tokenized card, NIBSS direct-debit mandate, and bank transfer into a virtual account), dunning tuned for thin balances where a failed charge usually means "not yet" rather than "no," and reconciliation that matches inbound push transfers back to the right subscription to the kobo. Full detail lives in `workbench/PRODUCT-OVERVIEW.md`; the console is the surface a tenant uses to operate that product.

## 2. What the console is, and what it is not

**The console is** the tenant dashboard: a single-organization, single-environment, merchant-facing self-serve surface where one downstream team manages its own plans, prices, customers, subscriptions, invoices, coupons, credits, payment methods, dunning policy, settlements and balance, withdrawals, webhooks, and API keys. It is the human control panel that sits beside the API and the SDK. It is the one surface held to two bars at once: best-in-class developer experience for the engineer, and real usability for the merchant who has no engineer.

**The console is not** the API, the operator back-office, or the payment page. It configures billing; it never collects a card. It shows one organization's data; it never reaches across tenants. It never hosts infrastructure controls. Three sibling surfaces exist and are explicitly separated. The scope boundary is a hard contract, not a guideline.

| Concern | **CONSOLE** (`apps/console`, one tenant) | **ADMIN** (`apps/admin`, operators) | **CHECKOUT** (`apps/checkout`, end-payer) |
|---|---|---|---|
| Who signs in | A tenant team member, on a console session (`org_users`, `org_sessions`), scoped to one organization and one environment | A platform operator, on operator auth (`operators`, `token_version` revocation). There is deliberately no god tenant key | Nobody. A hosted pay page with no login |
| Data scope | Exactly one `organization_id`, one `environment` (test or live) at a time | Cross-tenant, every organization at once | One invoice or one setup at a time |
| Owns | Plans, prices, customers, subscriptions, invoices, coupons, credits, its own settlements and balance, withdrawal and payout, webhooks, API keys, and billing policy | The readiness probe `/ready`, the Prometheus `/metrics` scrape, cross-tenant reconciliation and drift, the deferred `/v1/admin/*` inspection, feature flags, the kill-switch, quota overrides, and `admin_audit_log` | Card entry and tokenization, 3DS/OTP completion, mandate consent (the ₦50 NIBSS validation), and the dunning `checkoutLink` landing |
| Must NOT host | Another tenant's data; the readiness probe; the Prometheus scrape; the kill-switch; cross-tenant drift or discrepancy views; per-tenant quota overrides | The tenant's own billing configuration | Any merchant configuration; any raw card storage beyond the tokenization boundary |

Three boundary rules the whole plan enforces:

1. **Isolation is a schema invariant, not a UI check.** Every domain row carries `organization_id NOT NULL` plus `environment`, so the console cannot render another tenant's data even by mistake. The UI relies on that invariant; it does not police it.
2. **The console configures, checkout collects.** No PAN ever crosses the console. `PaymentMethodResponseData` exposes only `brand`, `last4`, `expMonth`, and `expYear`. Card entry, OTP, and mandate consent live entirely on the checkout surface. The console starts a card setup by minting a hosted-checkout link and awaiting `payment_method.attached`; it never becomes a card-entry form.
3. **Anything cross-tenant or infrastructural is admin.** Readiness, the metrics scrape, discrepancy classification (`local_paid_missing_at_nomba`, `amount_mismatch`, `settled_at_nomba_missing_locally`), feature flags, and quota overrides belong to admin. The console shows a tenant only its own settlement `status` and its own ledger-derived balances.

## 3. Who the console serves

Four people are in the room, always. They are the MANIFESTO's four audiences. The tie-breaker is the developer: when the four pull in different directions, build for the developer first, because the fastest way to win the leader is for their own team to say "use Nomba One." But the console is where two other tenets are proven directly. It is the proof of Tenet 7 (a merchant runs a subscription without an engineer) and of Tenet 9 (something breaks and the error tells them exactly what to do). Each persona's jobs are ranked, and each job names the real API capability that backs it.

### 3.1 The developer (center of gravity)

Comes to verify, integrate, and debug. The console is the control panel behind the SDK.

1. **Mint, scope, and rotate API keys**, reading the key prefix and `last_used_at`. Backed by `api_keys` (environment baked into the `nbo_test_`/`nbo_live_` prefix, SHA-256 hash only, `scopes` array). Gated on the console-auth API (see section 5).
2. **Register and debug webhook endpoints.** `POST /v1/webhooks` (signing secret shown once), `PATCH /v1/webhooks/{id}`, `POST /v1/webhooks/{id}/rotate-secret`, and the nested deliveries inspector `GET /v1/webhooks/{id}/deliveries?status=&eventType=` with `POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay`. Dedupe guidance is explicit: dedupe on the stable nested event id `event.event.id`, never on the delivery id. Replaying a delivery re-arms the same delivery row in place, so its delivery id does not change, and one event fans out to one delivery row per subscribed endpoint.
3. **Tail the event stream and inspect payloads.** `GET /v1/events?type=`, `GET /v1/events/{id}`, and the catalog at `GET /v1/events/catalog` (the frozen 34-type catalog).
4. **Run the core loop without real money**, on a test deployment only. `POST /v1/test/payment-methods` (behavior one of `success`, `decline_insufficient_funds`, `decline_expired_card`, `decline_do_not_honor`, `requires_otp`), `POST /v1/test/subscriptions/{id}/advance-cycle` (the test clock), and `POST /v1/test/webhooks/simulate`.
5. **Branch on real errors.** Every error envelope carries `code`, `message`, `hint`, `docUrl`, optional `fields`, and `meta.requestId`. The developer wants these verbatim.
6. **Read the machine spec.** `GET /v1/openapi.json`, generated from the live router so the spec cannot drift from what the server enforces.

### 3.2 The founder (ships fast, needs it robust)

Comes to stand up billing end to end and watch it run.

1. **Zero to first subscription in test.** Create a customer (`POST /v1/customers`), a plan and price (`POST /v1/plans`, `POST /v1/plans/{id}/prices`), attach a method, then `POST /v1/subscriptions`. This is the onboarding flow the console owns (doc 09).
2. **See MRR, active count, and churn at a glance.** `GET /v1/metrics/billing` returns `BillingMetricsData`: `mrrInKobo`, `activeCount`, the voluntary and involuntary churn split, `failedChargeRate`, `dunningRecoveryRate`, and `dunningFunnel`.
3. **Watch a subscription bill, fail, and recover.** The per-subscription timeline from `GET /v1/subscriptions/{id}/events` plus its invoices and `GET /v1/subscriptions/{id}/dunning`.
4. **Configure dunning and proration policy once.** `PUT /v1/organization/billing`.
5. **Get paid out.** `GET /v1/settlements`, `GET /v1/settlements/escrow`, and `POST /v1/settlements/payout` (the provider leg is live-gated; see section 5).

### 3.3 The merchant without an engineer (Tenet 7, a hard requirement)

Comes to run subscriptions through the UI, with no code.

1. **Create a plan and price via a form**, entering an amount in naira while the console stores integer kobo. No `unitAmountInKobo` appears in their face. Backed by `plans` and `prices`.
2. **Add a customer and start their subscription**, picking a plan and a rail while the console does the `paymentMethodId` and `collectionMethod` plumbing.
3. **Send a customer a pay or recover link.** Surface the `invoice.action_required` `checkoutLink` for card OTP/3DS, and the virtual-account instructions from `POST /v1/payment-methods/virtual-account`.
4. **See who is paying, who is failing, and who churned.** The subscription list filtered by `status`, and the invoice list by derived status.
5. **Withdraw money to their bank.** The escrow-locked withdrawal flow, backed by `GET /v1/settlements/escrow` and `POST /v1/settlements/payout`.
6. **Refund a customer.** `POST /v1/settlements/{id}/refund`, tenant-net only, the platform fee non-refundable.

### 3.4 The leader / CTO (decides whether to move revenue on)

Comes to audit correctness and trust the money.

1. **Prove the money is never wrong.** Ledger-derived balances, the settlement `gross = platformFee + net` split, and reconciliation status. This is Tenet 1.
2. **Audit any subscription's full history.** The event-sourced `GET /v1/subscriptions/{id}/events`, reading an append-only `domain_events` spine.
3. **See dunning sophistication.** The recovery rate, the payday-biased retries, and voluntary versus involuntary churn as distinct outcomes: `subscription.canceled` is a customer choosing to leave, `subscription.churned` is dunning exhausting. Conflating the two is a bug.
4. **Govern access.** Team roles (`org_users.role` is one of `owner`, `admin`, `developer`, `viewer`), TOTP, per-key scopes, and environment isolation.
5. **See operational health.** Settlement and escrow status, and quota and rate-limit headroom (the `monthlyRequestQuota`).

## 4. The three things the console must land

1. **Developer experience so good the skeptic verifies it in their own devtools.** Keys, webhooks, deliveries with replay, the live event tail, request logs, and the test-mode instruments live inside the product, not in a bolted-on settings drawer. Every failure renders `error.hint` verbatim with a `docUrl` deep-link and the `requestId`. This lands Tenet 2 and Tenet 9.
2. **A merchant runs a real subscription without an engineer.** Guided create flows, naira inputs over kobo storage, one-button pay-link forwarding, and plain-language money screens. Immutability, idempotency keys, and price versioning stay under the hood. This lands Tenet 7.
3. **The hard parts made legible, honestly.** Dunning, reconciliation, and the escrow lock are shown as first-class surfaces, not hidden. The console states plainly that silent card recharge is bank-gated and routes to a checkout link instead of a blind retry, that payouts and refunds and mandates are built but live-gated, and that webhooks are at-least-once and replayable rather than exactly-once. This lands Tenet 8.

**The signature thesis, at a summary level: the most novel dashboard in fintech.** Three move-sets make it so, and later docs own the detail. Developer surfaces embedded in the product (doc 04): a reproduce-this-object curl and SDK panel on every detail view, a persistent live webhook tail, an event inspector with `requestId` correlation, and an in-console test clock. Hard-parts cockpits (doc 05): a dunning and recovery cockpit where blind retry is structurally absent for card-update and OTP cases, a reconciliation surface that matches by our own reference and shows the double-entry receipt, an escrow-lock explainer, and a real-data bill/fail/recover subscription timeline. No-code merchant paths (docs 02 and 03): a guided create-a-subscription wizard, a send-a-pay-link button, plan and price forms that hide the "new price plus deactivate old" mechanic, and a withdraw-to-bank flow that explains the escrow lock in plain language rather than as an error.

## 5. Dependency number one: the console-auth API does not exist yet

**Call this out before anything else is planned. `apps/api` has no tenant user, session, or OAuth auth. It authenticates only per-organization API keys (`nbo_test_` and `nbo_live_`).** Every `/v1` route sits behind `apiKeyAuth`. There is no login, no session cookie, no team model, and no key-minting endpoint exposed over HTTP.

The database already carries the tables a console session layer needs: `org_users` (with `role` of `owner`, `admin`, `developer`, or `viewer`, and TOTP fields), `org_sessions`, `password_reset_tokens`, and `api_keys`. But **no HTTP surface exposes any of them.** So console login, team and RBAC management, TOTP enrollment, invites, password reset, and API-key minting are all gated on an unbuilt **console-auth API**. That surface is distinct from the public `/v1` tenant API (which is machine-to-machine and key-authenticated) and distinct from the operator admin surface (which authenticates `operators`). Doc 09 owns the console-auth surface and its screens.

What this means for every other doc: any screen that needs a signed-in human (which is nearly all of them) assumes the console-auth surface exists and is authenticated. Any screen that mints or reveals a secret (API keys, webhook signing secrets) is explicitly marked as gated on console-auth. The plan designs these screens fully so they are ready the moment the surface lands, and it never papers over the fact that the surface is not built yet.

## 6. Design language, voice, and motion: inherit, do not reinvent

The console inherits the design language v2 defined in `workbench/NOMBAONE.pen` and shared through `@nombaone/ui`, 1:1. It introduces no new token values. Docs 06 and 07 carry the full component and motion specs; this is the summary and the one hard rule.

- **Dark-first, two-tier OKLCH tokens.** A pure-neutral gray ramp (chroma 0, so grays read expensive), an emerald brand ramp, and semantic status hues. Components consume only the Tier-2 semantic tokens (`--background`, `--surface-1/2/3`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--accent`, `--ring`, `--success`, `--warning`, `--danger`, `--info`), never the primitives. Light mode is a pure token remap.
- **The one hard rule is restraint.** Exactly one accent, electric emerald, appears in exactly four places: the primary action, links, focus rings, and the moment a payment recovers (`invoice.payment_recovered`, rendered on the `--success` token with a live dot). Emerald never tints tables, chrome, or decoration. Everything else is neutral and semantic.
- **Type.** Geist Sans and Geist Mono. Marketing uses a large display scale; the console needs a tighter working scale for data density, derived from the same tokens. Doc 06 defines the app type and density scale.
- **Motion is tokenized.** Four durations (120, 200, 320, and 520ms) and three easings: an out curve for entrances, an in-out curve for ambient loops, and a spring reserved for the one earned peak, the payment recovery. Animate transform and opacity only. Honor `prefers-reduced-motion` everywhere. Doc 07 carries the full spec.
- **Voice.** Technical, precise, plain. Confident and declarative, present tense, active voice, verb-first, sentence case, serial commas. No em dashes and no en dashes used as dashes. The banned filler list from the platform voice spec is enforced verbatim, and none of those marketing adjectives appear in shipped console copy. Name things from the person's side of the screen: a person manages subscriptions and payouts, never "webhook config." Errors and empty states give direction, not mood.
- **One vocabulary.** The console uses the exact status enums and resource nouns from the API, verbatim, with no synonyms. A status badge reads the FSM enum. The same action keeps the same name from button to confirmation. Section 12 locks the vocabulary.

## 7. Money is integer kobo, and the console must never get the unit wrong

Money is integer kobo on the wire. Every money field name ends in `InKobo` (`unitAmountInKobo`, `amountInKobo`, `totalInKobo`, `mrrInKobo`, `netToTenantInKobo`, and so on). Currency is always `NGN`. There is no floating-point anywhere in the money path, and sign is carried by ledger debit and credit direction, so every amount is a positive integer.

Two rules bind every console surface that shows or takes an amount:

1. **Render naira by dividing by 100, never with floats.** The console takes an integer kobo value, divides by 100 for display, and formats with integer-safe arithmetic and a `NGN` badge. It never introduces a floating-point naira value that could round.
2. **Never send an amount to a charge path without pinning the unit.** There is a known 100x risk: Nomba's hosted-checkout order endpoint takes naira decimal strings, while the tokenized-card charge endpoint's unit is not yet live-confirmed. If a charge path expects naira while the engine sends kobo, every renewal is 100 times too large. The console's own amount inputs (a price's `unitAmountInKobo`, a credit grant's `amountInKobo`, a refund's `amountInKobo`, a payout's `amountInKobo`) accept naira from a person and convert to integer kobo at the input boundary, deliberately and once. Any doc that displays or enters an amount restates this rule.

## 8. The quality floor (non-negotiable, and not announced in the UI)

- **Performance.** An infra console that stutters is self-refuting. Lists are cursor-paginated and virtualized where long. Heavy panels (the live webhook tail, the OpenAPI reference, code panels) lazy-load. First paint carries the shell and the primary content, not the whole app.
- **Accessibility to AA.** Semantic HTML, visible keyboard focus, `prefers-reduced-motion` honored, and AA contrast, which the token system is built for. Full keyboard paths through the nav, tables, drawers, and forms. The live event tail is an `aria-live` region.
- **Responsive down to 390px.** Every screen works at 390px wide, not only at the desktop working width. Tables collapse to stacked cards or horizontally scroll inside their own container; the page body never scrolls horizontally. Doc 06 defines the app container width and the breakpoints, since the marketing container is too narrow for tables.
- **Correctness in money display.** Integer kobo in, naira out by dividing by 100, never a float, `NGN` always shown, and the 100x unit rule from section 7 enforced on every amount input.

## 9. The two-phase method, and what "done" means for each

The console follows the same two-phase method as the website plan set.

**Phase A: design in pencil (low-fi).** Produce low-fidelity frames for every screen in docs 02 through 05, plus the app shell and the interaction storyboards for the hard-parts cockpits. Use the design language v2 tokens and the app type scale, but keep fidelity rough. The ASCII wireframes in these docs are the starting point; translate them into real low-fi frames in `workbench/NOMBAONE.pen`.

- **Phase A is done when:** every screen in docs 02 through 05 has a reviewed low-fi frame; the app shell, nav, and test/live switch are laid out; the dunning cockpit, reconciliation surface, escrow explainer, and subscription timeline each have an interaction storyboard with states and transitions; every empty, loading, and error state from doc 08 is placed; and the copy for the shell, the primary actions, and the key empty and error states is drafted. Nothing is in high fidelity yet.

**Phase B: build to spec.** Only after the pencil pass is approved, build the real console. Every color, type, spacing, and motion value derives from the design language v2 variables. The `.pen` frames are the hard 1:1 gate.

- **Phase B is done when:** the console is live to the quality floor in section 8; every value derives from the design system; the developer surfaces call the real `/v1` and `/v1/test/*` endpoints and are inspectable in devtools; the merchant no-code paths complete a real zero-to-first-subscription flow in test; the hard-parts cockpits render real event, dunning, and settlement data; every screen renders its empty, loading, and error states from doc 08; and it passes the AA and responsive targets.

## 10. Canvas placement (a build-time rule from the user)

The console is designed in the **same** Pencil file, `workbench/NOMBAONE.pen`, but in a **fresh region placed far below the existing website frames** so nothing overlaps or clashes. At build time, anchor with `FindEmptySpace` below the lowest website frame. The website occupies roughly `x` 0 to 34000 and `y` 0 to 14700; the Simulator ends near `y` 14636. Place the console components at the top of the new region, then the screens below them, growing right and down. The console inherits the `.pen` design language v2 variables 1:1 and introduces no new token values. Do not reuse or move any website frame; the console region is additive and self-contained.

## 11. The app shell (the one frame this doc owns)

Docs 01 through 05 own the individual screens. This doc owns the global shell they all sit inside. The shell is a sticky header carrying the invertible logo and wordmark, a **mandatory test/live environment switch** (backed by `org_sessions.environment`; one user maps to one organization, so there is no org switcher), and the account menu. The left nav mirrors doc 01, the canonical owner of the shell: a standalone Overview; a BILLING group (Subscriptions, Customers, Plans and prices, Invoices); a MONEY group (Payments and rails, Dunning and recovery, Settlements and payouts, Coupons and credits); a BUILD group with Developers nested (API keys, Webhooks, Events, Test mode, API reference); a standalone Reconciliation; and a pinned Settings footer (Organization, Billing settings, Team, Nomba connection). The main region holds the active screen. Every list is cursor-paginated (`pagination.nextCursor` and `hasMore`, no totals and no page numbers). Test-mode nav entries appear only when the deployment environment is test. RBAC gates visibility: a `viewer` cannot mint keys.

Phase A pencil starting point:

```
+------------------------------------------------------------------------------------+
|  [logo] Nomba One            [ Test | Live ]        [ ? ]  [ account v ]           |  sticky header, hairline base
+----------------------------+-------------------------------------------------------+
|  Overview                  |                                                       |
|                            |   Screen title                       [ primary btn ]  |
|  BILLING                   |   one-line deck                                       |
|  Subscriptions             |                                                       |
|  Customers                 |   +-----------------------------------------------+   |
|  Plans and prices          |   | filter bar  [status v] [date v] [search...]   |   |
|  Invoices                  |   +-----------------------------------------------+   |
|                            |   | data table (cursor-paginated)                 |   |
|  MONEY                     |   |  ref            status     amount     when    |   |
|  Payments and rails        |   |  nbo...sub      [Active]   NGN 5,000   2d ago |   |
|  Dunning and recovery      |   |  nbo...sub      [Past due] NGN 2,500   5h ago |   |
|  Settlements and payouts   |   |  ...                                          |   |
|  Coupons and credits       |   |                        [ Load more ]          |   |
|                            |   +-----------------------------------------------+   |
|  BUILD                     |                                                       |
|  Developers                |   (detail opens in a right slide-over drawer,         |
|    · API keys              |    with a "reproduce this" curl / SDK panel)          |
|    · Webhooks              |                                                       |
|    · Events                |                                                       |
|    · Test mode *           |                                                       |
|    · API reference         |                                                       |
|                            |                                                       |
|  Reconciliation            |                                                       |
|  ------------------------  |                                                       |
|  SETTINGS                  |                                                       |
|    · Organization          |                                                       |
|    · Billing settings      |                                                       |
|    · Team                  |                                                       |
|    · Nomba connection      |                                                       |
+----------------------------+-------------------------------------------------------+
   * Test mode entries render only when the deployment environment is test.
```

## 12. One platform, one language (vocabulary lock)

The console uses the exact nouns and status enums from the API. No synonyms, ever. These are load-bearing across docs.

- **Resource nouns:** organization, customer, plan, price, subscription, invoice, coupon, discount, credit, payment method, mandate, virtual account, settlement, refund, payout, webhook endpoint, delivery, event. A subscription's payer is a customer. The tenant is an organization, never a "tenant" in UI copy.
- **Subscription status (7-state FSM):** `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `paused`, `canceled`. `canceled` is terminal; restarting mints a new subscription via `resubscribe`.
- **Invoice status (derived from timestamps, never stored):** `draft`, `open`, `partially_paid`, `paid`, `void`, `uncollectible`. The console renders the same precedence the API derives and expects no stored status column.
- **Dunning attempt status:** `scheduled`, `attempting`, `succeeded`, `rescheduled`, `card_update_required`, `exhausted`. The console never offers a blind retry for `card_update_required`; it routes to a card update or the `checkoutLink`.
- **Payment method status:** `setup_pending`, `consent_pending`, `active`, `removed`, `expired`.
- **Settlement status:** `pending`, `settled`, `reconciled`, `failed`, `refunded`.
- **Two distinct churn outcomes, never conflated:** `subscription.canceled` is voluntary; `subscription.churned` is involuntary, dunning-exhausted. They render differently and mean different things.
- **Honesty guardrails threaded through every doc:** card recurring is best-effort charge plus an OTP-to-checkout-link fallback, never silent; the NIBSS mandate is the reliable silent rail, and it is live-gated; outbound webhooks are signed, at-least-once, deduplicated on `event.id`, retried, and replayable, never "exactly-once"; direct debit, payouts, refunds, and escrow are built but live-gated, and the console shows their honest interim states (`consent_pending`, `pending`, `ledger_posted`, `ledger_only`) rather than claiming confirmation; the crypto rail is not built.

## 13. Cross-cutting constraints to thread through every doc

- Money is integer kobo (`*InKobo`), rendered as naira by dividing by 100, never with floats, `NGN` always shown, and the 100x unit rule enforced on every amount input.
- Status enums are verbatim from the API; no synonyms.
- Secrets (API key `secret`, webhook `signingSecret`) are shown once, with a "cannot be retrieved again" warning.
- Test-mode instruments render only when the deployment environment is test.
- Isolation is per `(organization_id, environment)`; the console never shows another tenant's data.
- Every money-moving action carries an `Idempotency-Key`; the console generates one and lets a person supply a stable key where cross-restart safety matters.
- Errors are a feature: every failure renders `error.hint` verbatim, the `docUrl` deep-link, the `requestId`, and inline `error.fields` next to inputs on a 422.
- Live-gated and unbuilt states are shown honestly, never faked.

Proceed to doc 01.
