# Console Plan 10: Engineering and Build Order

> What this is: the build-order contract for turning the Pencil console design into shipped software. It names every backend dependency the design leans on (some already built in `apps/api`, some greenfield), sequences them, and records the design nuances discovered during the Pencil pass that cannot be read off a static frame. It depends on all of docs 00 through 09: it does not restate their screens, it says in what order to build them and what each one needs from the API before it can render truthfully.
>
> Read this after the design is done and before the first console commit. It is the bridge from `workbench/NOMBAONE.pen` to `apps/console`.

## 0a. Paradigm (authoritative, supersedes any "already built" language anywhere below)

`apps/console` is a **boilerplate template ported from another project**, and we are moving in a product direction that template does not reflect. **Nothing in `apps/console` is authoritative or "built for Nomba One."** Treat the console as **greenfield**: build every surface from scratch against the Pencil design and these plan docs, and **strip out the ported boilerplate** as you go. Do not read any existing console file as our product, our auth, or our data layer. The ported files (including `src/lib/auth/*`, `src/lib/*-actions.ts`, existing screens) are at most reference scaffold, never "done."

What genuinely exists to build ON (the substrate, per `workbench/console-refactor-notes.md`):

- **`@nombaone/sara` = reusable infrastructure + primitives + cross-app services only** (no product money engine). Console imports: `sara/context` (`DomainContext {organizationId, mode}`, `Mode`, `InfraDb`, `InfraTxDb`), `/api-keys`, `/webhooks`, `/example`, `/org`, `/reference`, `/crypto`, `/money`, `/pagination`, `/idempotency`, `/ledger`, `/events`, `/rails`.
- **The subscription-billing money engine is api-owned** in `apps/api/src/shared/services/` (billing, subscriptions, subscription-schedules, invoices, dunning, settlement, plans, prices, coupons, discounts, credits, payment-methods, proration, tenant-config, customers, reconciliation, scheduling, metrics). The console **must never import these** (a package may never import from an app; enforced by `pnpm check:boundaries`). The console gets money-engine data by **reading the DB directly via `@nombaone/core-db/pool`** (server-side) or by **calling `apps/api`**.
- **The console owns its own merchant/org auth** in `apps/console/src/lib/auth/`, **built on sara auth primitives** (`hashPassword`, `verifyPassword`, `generateTotpSecret`, `verifyTotp`, `buildTotpUri`, `can`, `Capability`, `OrgUserRole`). Auth workflows (signup, login, session, users, password-reset) are ours to build here; they may not live in sara.
- **`core-db`** holds the schema (org_users, org_sessions, password_reset_tokens, api_keys, and all money-engine tables). Money is integer kobo throughout.

Consequence for everything below: sections that discuss "the current `apps/api` surface" are describing the **substrate the console consumes**, and remain valid as a data-availability map. Any section that treats a console-side artifact as pre-existing is void under this paradigm. The `apps/api` money engine is the source of truth for billing data; the console is 100% to-build.

## 0. The one rule this document exists to enforce

Every field the console renders maps to either (a) a real DTO field that `apps/api` already returns, or (b) a named, tracked build dependency below. Nothing in the design is decoration that fakes data we cannot compute. When a surface shows a number, this doc says where that number comes from. If it comes from an endpoint that does not exist yet, that endpoint is listed here with its shape, so the design leads and engineering follows a written target instead of guessing.

## 1. Dependency graph (what blocks what)

```
console-auth API  ───────────────►  every authenticated surface
  (login/session/OAuth/TOTP/RBAC/key-mint)

enriched subscriptions LIST  ─────►  Subscriptions command center (list + mobile cards)
  (per-row MRR / health / rail / recovery)      └► Overview recovery cockpit rows
                                                 └► Customers detail subs table

MRR-movement decomposition  ──────►  Overview revenue command bar
  (new/expansion/contraction/churn)              └► Subscriptions command bar movement strip

per-sub invoice outcomes  ────────►  Health strip (list + detail timeline)
  (recent cycles → paid/failed/recovered)        └► Triage drawer timeline preview

live-gated provider legs  ────────►  Settlements/payouts, refunds, mandate activation,
  (payout/refund/NIBSS/transfer)                  transfer-pending states rendered honestly
```

The four boxes on the left are the build-order spine. Everything else in docs 02 through 09 renders on data `apps/api` already returns, or on one of these four.

## 2. Build-from-scratch #1: console-owned merchant auth (gates the whole console)

Per the refactor, **the console owns its merchant/org auth** in `apps/console/src/lib/auth/`, built on sara auth primitives. This is not an `apps/api` REST surface and not the operator `apps/admin` login; it is console-local workflows over `org_users` / `org_sessions` / `password_reset_tokens`, using sara primitives (`hashPassword`, `verifyPassword`, `generateTotpSecret`, `verifyTotp`, `buildTotpUri`, `can`) for the pure crypto/RBAC helpers. We BUILD these workflows for our product; any ported versions are reference only, not "done." `apps/api` itself authenticates its callers by per-organization API key (`nbo_sandbox_` / `nbo_live_`) and never issues console sessions.

Build the full auth surface from scratch as console server actions plus pages. Minimum shape the design assumes:

- `POST /console/auth/login` (email + password) then a TOTP step: returns a session cookie, not a bearer token. The mobile and desktop Login frames (`svmeK`, `ExLVO`) both show the "protected by two-factor (TOTP) after sign-in" line, so TOTP is not optional in the design.
- `POST /console/auth/google` (OAuth) for the "Continue with Google" button.
- `GET /console/session` to hydrate the shell (org, user, role, test/live).
- Team and RBAC endpoints backing the Settings Organization screen (`uEaaY`): list members, invite, change role, remove. RBAC rule locked in the seed: money-out actions are owner plus admin; destructive org actions are owner only. The console must gate the Actions menus on the session role, not hide the gate client-side only.
- Key minting for the Developers keys screen (`XtJzd`): create key returns the secret exactly once (the reveal-once pattern the frame shows), list returns metadata only.

Until this ships, the console has no authenticated state at all. It is dependency zero in practice.

## 3. Dependency #2: the enriched subscriptions LIST payload (gates the hero page)

The Subscriptions command center is where the novelty concentrates, and it is the one page whose design the current API cannot feed cheaply. `GET /v1/subscriptions` returns lean rows: `latestInvoiceId` is null in list responses, and the subscription item DTO carries no resolved amount. The rich row the design draws needs four things per subscription that the lean row does not carry:

1. MRR: resolve `priceId` to `price.unitAmountInKobo` times `item.quantity`, normalized to a monthly figure. A price join the list does not do today.
2. Health: the last six cycle outcomes (paid / failed / recovered / upcoming) for the inline health strip. Sourced from that subscription's invoice history.
3. Rail: `defaultPaymentMethodId` resolved to `payment_method.kind` / `status` / `brand` / `last4` for the rail badge.
4. Recovery: current dunning state (attempt x of n, branch, `nextAttemptAt`, grace) for `past_due` rows.

Fetching these per row from the client is an N+1 anti-pattern across the whole book. The design therefore assumes one of two backend builds, and engineering picks one:

- Option A: an enriched list endpoint (`GET /v1/subscriptions?expand=mrr,health,rail,recovery`) that does the joins server-side and paginates.
- Option B: a companion batch endpoint (`GET /v1/subscriptions/health?ids=...`) the list calls once per page to hydrate the strips and recovery cells, keeping the base list lean.

Either is acceptable. Both are named here so the row design is not quietly N+1. This is dependency #1 for this page and the single most important backend item for the console's differentiated surface.

### 3.1 Phase-1 honest subset (what renders before the enriched payload lands)

Before Option A or B ships, the list still renders truthfully with a reduced row: subscriber, plan, status badge (from the lean row's `status`), and next-bill countdown (from `currentPeriodEnd`). The health strip, rail badge, MRR column, and inline recovery are gated behind a skeleton state (the LOADING panel on the States board `f0hn5A`) or hidden entirely, never faked. No invented health, no placeholder rail.

## 4. Dependency #3: MRR-movement decomposition

The Overview revenue command bar and the Subscriptions movement strip draw a stacked bar segmenting the book into billing-cleanly / in-recovery / past-due / churned, and the Overview shows new / expansion / contraction / churn / net movement. Today's `BillingMetricsData` carries `mrrInKobo`, `voluntaryChurn`, `involuntaryChurn`, `failedChargeRate`, `dunningRecoveryRate`, and `dunningFunnel`. That is enough for the four-segment composition bar (billing-cleanly / in-recovery / past-due / churned), which is what the mobile Overview and the Subscriptions command bar render.

The full new/expansion/contraction/churn/reactivation waterfall shown on the desktop Overview is richer than the current metrics object. That decomposition is a metrics build item: a periodic job that diffs MRR by movement type per period. Phase 1 renders the honest subset from what `BillingMetricsData` already exposes; the full waterfall is labeled as a build item and its extra segments are omitted, not stubbed.

## 5. Dependency #4: health-strip source

The health strip is per-subscription invoice history mapped to per-cycle outcomes: paid (emerald), failed (red), recovered (accent peak), upcoming (neutral), trial (info). Source is the invoice list filtered by subscription, reduced to the last six cycles. This belongs inside the enriched payload of section 3 so the list gets strips without a second round trip; the detail page timeline (`krL61`, mobile `XKxmy`) can afford the fuller per-attempt query.

## 6. Live-gated states the console renders honestly (no lies about the rails)

These are not blockers, they are states the design already draws truthfully because the underlying rail is asynchronous or not fully live. The console must show the real state, never a fake success:

- Payout and refund provider legs: our ledger posts immediately (`ledger_posted` / `ledger_only`), the provider leg settles later. Settlements/payouts screen (`eWrhJ`) shows the split, gated on `NOMBA_PAYOUT_ENABLED`.
- NIBSS direct-debit mandate: `consent_pending` until the customer authorizes. The rail badge and recovery cells show mandate state, never assume an active mandate.
- Bank transfer: `pending` until the push payment is reconciled. Reconciliation screen (`UHvch`) is where that provenance lives.
- The 100x naira-versus-kobo charge-unit risk (see section 7): the console renders kobo, but the charge path unit must be pinned before any live charge, or renewals overcharge 100 times.
- Webhooks are at-least-once and replayable, not exactly-once. The Developers webhooks screen (`wRumt`) shows replay re-arming the same delivery row in place; the delivery id does not change. Dedupe is on `event.event.id`.

## 7. Money-unit contract (integer kobo, render naira by /100)

Every money field in the console is an integer number of kobo. The UI divides by 100 for display and never stores a float. This is non-negotiable and is the reason the design never shows a raw decimal from the API. The open live risk (tracked in memory: the Nomba checkout amount reads as naira, not kobo, on the live checkout) means the charge-path unit must be pinned in `apps/api` before the console triggers any live charge. The console does not paper over this; the money-out actions carry an `Idempotency-Key` and the settlements/ledger receipts render the exact kobo figure the ledger holds.

## 8. Error contract (public codes only, no internal leakage)

The console renders `error.hint` verbatim plus `docUrl` plus `meta.requestId` plus a retry, exactly as the ERROR panel on the States board (`f0hn5A`) shows. Only public, tenant-facing error codes surface. The non-public codes (`NOMBA_REQUEST_FAILED`, `SETTLEMENT_PAYOUT_FAILED`, `DUNNING_SETTINGS_INVALID` mapped to `CLIENT_VALIDATION_FAILED`, `WEBHOOK_*_NOT_FOUND`, `RECONCILIATION_DRIFT_DETECTED`, `PRICE_IMMUTABLE`) collapse to `SYSTEM_INTERNAL_ERROR` and must never be shown as a tenant-facing hint. The console trusts the API to have already collapsed them; it renders whatever `hint` and `docUrl` it is given without inventing copy.

## 9. Responsive language (locked during the Pencil pass)

The mobile pass (390 wide: Overview `VD6Qh`, Subscriptions `Z8CIJ`, Sub detail `XKxmy`, Login `ExLVO`) fixed the responsive rules the build follows:

- Sidebar becomes a bottom nav of five tabs (Home / Subs / Recovery / Build / More) plus a hamburger in the topbar for the full nav sheet.
- Table rows become lifecycle cards: the health strip runs full width as segments, the rail badge and status badge sit on the card, and inline recovery actions (Send pay link, Update card, Update mandate) appear on at-risk cards.
- The split brand-plus-form auth layout stacks into a brand band over the form.
- KPI columns become a two-by-two tile grid.
- The horizontal detail timeline becomes a vertical gutter of dot-plus-connector nodes.

Build note, not a runtime concern: the Pencil editor adds a benign phantom 50px top band to frames authored mid-session, which is a design-tool artifact only. It does not correspond to any real layout offset and must not be translated into CSS. The real responsive contract is the five rules above.

## 10. Build order (the sequence)

1. console-auth API (section 2). Nothing authenticated ships before this.
2. App shell in `apps/console` wired to `GET /console/session` (sidebar, topbar, test/live switch, RBAC-gated nav).
3. Subscriptions list on the Phase-1 honest subset (section 3.1), then upgrade to the enriched payload (section 3) when it lands.
4. Subscription detail (timeline, recovery cockpit, upcoming-invoice preview, reproduce panel) on existing per-subscription endpoints plus the health source (section 5).
5. Overview command bar on the honest metrics subset (section 4), upgraded to the full waterfall when the decomposition job ships.
6. Customers, Plans and prices, Invoices on existing DTOs.
7. Money surfaces (Payments and rails, Settlements/payouts/escrow, Coupons/credits) with the live-gated states rendered honestly (section 6).
8. Developers (keys, webhooks, events, logs, test mode) on existing developer endpoints; test-mode instruments are mounted only when the environment is test.
9. Reconciliation and Settings last, since they lean on operator-adjacent data and org config.

## 11. Proceed

This closes the console plan set (00 through 10). The design lives in `workbench/NOMBAONE.pen`; the screens map to the ids recorded in the design tracker and referenced throughout docs 02 through 09. Engineering starts at section 10, step 1.
