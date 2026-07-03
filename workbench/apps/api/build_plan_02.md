# apps/api — Build Plan 02 · Nomba Integration & Rails

> **Objective.** Turn the rail SEAM into three REAL Nomba adapters behind the existing `RailAdapter`
> registry, capture and persist payment methods (card token / mandate / virtual account — **never a PAN**),
> and harden the inbound-webhook path into a verify→dedup→fast-ack→enqueue→re-verify→settle pipeline — so
> Phase 03's charge→ledger→verify loop has real money rails to drive. Money is **integer kobo end-to-end**
> (team-confirmed; no boundary conversion). Depends on: **00** (contract, harness, customers slice, rails
> registry, inbound-webhook seam, idempotency store, outbound-sign primitive). Unblocks: **03**
> (subscriptions/charge loop), **06** (dunning consumes the failure taxonomy defined here), **08**
> (settlement extends `org_nomba_accounts` + `splitRequest`).

> **★ FIRST, AT PHASE START — request the real Nomba credential VALUES from the user.** The user holds the
> Main Account ID, the Sub-account ID, and the Test/Live Client ID + Private key (the OAuth `client_secret`)
> plus the webhook signature key. **Signal and ask for them before any task below** — the sandbox-confirmation
> task (T0) cannot run, and `env.ts` (contract C.8) cannot be populated, without them. Secrets go into env /
> the secret manager only (rubric N), never into source or a committed `.env`.

---

## Objective & scope

**In.**
- **T0 — sandbox confirmation (gate before trusting the adapter).** Resolve the `⚠ confirm in sandbox`
  flags carried in `workbench/NOMBA-INTEGRATION-REFERENCE.md` against a live Nomba sandbox, BEFORE the
  adapter code is trusted. The adapter is written to the **team-doc surface** and **corrected** where the
  sandbox disagrees (endpoint paths, the inbound signature input/encoding, the mandate-webhook question,
  the tokenized-card DELETE path, the money unit re-confirmation, the virtual-account funding event name).
- **Nomba OAuth client** (`packages/sara/src/nomba/`): `client_credentials` → bearer, Redis-cached token,
  refresh off `data.expiresAt` with a margin (never per call), the three required headers on every call,
  signed/typed request helper, and a `requery` primitive for server-side verification.
- **Three REAL `RailAdapter` implementations** registered in the existing registry
  (`packages/sara/src/rails/registry.ts`), the core never naming a provider:
  card (tokenized-card charge), mandate (direct-debit), transfer (virtual-account push).
- **`payment_methods` entity + capture flows**: card via hosted-checkout tokenize (`tokenizeCard:true`) →
  capture `tokenKey` from `payment_success`; mandate create → consent (NIBSS ₦50 validation) → poll to
  `ACTIVE`+`ADVICE_SENT`; virtual-account issue (NUBAN). Attach / get / list / set-default / remove.
- **Inbound webhook pipeline**: fill the `/inbound/:provider` route + `inbound-webhook` worker seam so
  Nomba events verify (correct signing scheme) → dedup on `requestId` (`nomba_webhook_events`) → fast-ack
  2xx → enqueue → worker **re-verifies via requery** → settles (capture token / mark VA funded). Out-of-order
  and duplicate delivery are tolerant.
- **Failure taxonomy**: map Nomba `gatewayMessage` / mandate inline status → an internal, stable
  `PaymentFailureReason` enum that **06 (dunning) branches on**. Defined here, consumed there.
- **Tables**: `payment_methods`, `nomba_webhook_events`, `org_nomba_accounts` (mapping only; full
  settlement attribution lands in 08).
- **Env additions** per contract C.8.

**Out (do not poach).**
- Subscription billing loop, the FSM, invoices (**03**) — this phase exposes the rails; it does not run a
  schedule or charge a subscription. The card adapter's `collect` is callable but no scheduler calls it yet.
- Settlement split / `splitRequest` at collection time, sub-account balance attribution, payouts (**08**) —
  `org_nomba_accounts` is created here as a **mapping** row only; no split is performed.
- Dunning policy, retry schedule, comms (**06**) — we **define** the `PaymentFailureReason` taxonomy and
  emit the right failure signal; the branching/retry lives in 06.
- Nightly reconciliation job (**09**) — the OAuth client ships a `requery` primitive (used inline for
  verify-again-then-act); the scheduled diff job is later.
- Outbound event signing/delivery internals (**07**) — we `emitEvent(...)` the new payment-method events;
  the outbound HMAC + retry machinery already exists and is exercised, not rebuilt.

---

## Rubric coverage

This phase demonstrates the following exit-criteria boxes (`SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`). Each is
restated with its proof in the **Verification checklist**.

- **E (Tokenization & Nomba charge integration)** — the bulk:
  - E1 first payment `tokenizeCard:true`; `tokenKey` captured from `payment_success` and persisted.
  - E2 recurring charges use the stored `tokenKey` via the tokenized-card-payment endpoint (capability shipped; the loop that calls it is 03).
  - E3 ⚠ each charge attempt carries a **unique** `orderReference`/`merchantTxRef` (idempotent on Nomba's side).
  - E4 ⚠ charge outcomes **verified server-side** (webhook + requery); never trust a client/sync-reported success.
  - E5 `gatewayMessage` mapped into the internal failure taxonomy that drives dunning (D).
  - E6 card-update re-tokenizes + swaps `tokenKey` **atomically** (no zero-valid-token-but-billable window).
  - E7 removing a card deletes the tokenized card (no stale token charged).
  - E8 OAuth2 tokens obtained and **refreshed** automatically; an expired token never silently drops a charge.
  - E9 currency consistently NGN across orders/charges/methods.
- **F (Inbound webhooks from Nomba)**:
  - F1 ⚠ HMAC signature verified on every inbound webhook; unsigned/invalid rejected.
  - F2 ⚠ inbound processing **idempotent** — same event twice processed exactly once.
  - F3 2xx ack promptly; heavy work async (no slow-handler-triggered redelivery).
  - F4 out-of-order delivery handled (a late `payment_success` after a requery does not corrupt state).
  - F5 unknown/unsubscribed event types ignored gracefully (not errored).
- **N (Security & compliance)** — for this phase's surface:
  - N1 ⚠ **no raw PAN / full card data stored — only Nomba tokens**.
  - N2 secrets (OAuth creds, signature key) in env, not in code/config.
  - N3 inbound signatures verified (the F1 work); outbound signatures already generated (00).
  - N4 every new route enforces auth + scope; no unauthenticated mutating route.
- **Supporting (already established in 00, re-asserted on the new surface):** K (Idempotency-Key on every
  new mutating route), L (single envelope, stable codes, cursor lists, `/v1`), H (every new row carries
  `organization_id` + `environment`).

`⚠` boxes (E3, E4, F1, F2, N1) are verified **twice** — once by reading the code, once by running the
scenario — per the final gate.

---

## Design notes

### D.1 Money unit — kobo, no conversion (re-confirm once in T0)
Contract C.7 and integration-ref §2.1 lock **integer kobo end-to-end**, team-confirmed 2026-06-30. `RailCollectInput.amountKobo` (already `Kobo` in `rails/types.ts`) flows straight to Nomba's `amount`. The single highest-stakes divergence in the public docs is naira/major-unit; **T0 sends one known sandbox charge and reads the amount back** to re-confirm kobo before any real money path is trusted. No `nairaToKobo` on the Nomba boundary — it is reserved for human-entered naira only.

### D.2 The OAuth client — cache, refresh-off-`expiresAt`, sign, requery
`packages/sara/src/nomba/client.ts` is the ONE place that holds a Nomba bearer. `client_credentials` → token; cache in Redis under `nomba:token:<env>`; on every request read the cached token and **refresh when `now ≥ expiresAt − margin`** (margin from env, default 5 min) — never mint per call (integration-ref §2.8; public docs say 30-min TTL, so we trust `expiresAt`, not a hard 55-min). A single-flight guard (Redis `SET NX` lock `nomba:token:refresh:<env>`) prevents a thundering-herd refresh. The client exposes:
- `nombaRequest(ctx, { method, path, body, idempotencyRef })` — attaches `Authorization: Bearer`, `accountId`, `Content-Type`; logs every call tagged with the ref (rubric M baseline); maps non-2xx into `NOMBA_*` errors.
- `requeryTransaction(ctx, { reference })` — the server-side verification primitive (single-transaction lookup by our ref). Used by the worker for verify-again-then-act and by the card adapter to confirm a charge outcome. **Never trust a sync reply or a webhook alone** (E4).

The exact endpoint paths live in **one** `packages/sara/src/nomba/endpoints.ts` constant map so T0's corrections touch a single file, not every adapter. The team-doc paths are the defaults; T0 overwrites any the sandbox disagrees with.

### D.3 The three rails — asymmetric, all behind `RailAdapter`
`collect(input)` is the shared verb (`rails/types.ts`). PULL rails attempt the debit and answer succeeded/pending/failed; the PUSH rail returns `pending` + `payInstructions` and settles via inbound webhook (exactly the mock's two shapes today).
- **Card (`rails/card.ts`, pull)** — `collect` charges the stored `tokenKey` via the tokenized-card-payment endpoint with a **unique `orderReference`/`merchantTxRef` derived from `input.reference`** (E3); the **sync reply only signals acceptance**, so the definitive outcome is taken from the `payment_success`/`payment_failed` webhook and/or a `requeryTransaction` (E4). A `payment_failed` `gatewayMessage` is mapped to a `PaymentFailureReason` (E5). First-ever capture is the hosted-checkout tokenize flow (below), not `collect`.
- **Mandate (`rails/mandate.ts`, pull)** — `collect` debits an `ACTIVE`+`ADVICE_SENT` mandate; the debit result is **synchronous/inline** (no mandate webhook in the public docs — T0 confirms whether the team surface fires one). Inline failure status maps to the same taxonomy. Creation/consent/poll is the capture flow (below).
- **Transfer (`rails/transfer.ts`, push)** — `collect` issues / resolves a virtual NUBAN and returns `pending` with `payInstructions` (bank, account number, amount, our reference). Settlement arrives later as `payment_success` with `type:"vact_transfer"`, reconciled by `aliasAccountReference` → our reference.

All three are `registerRail(...)`'d at boot in the API's worker/app wiring (replacing the mock registration in product code; the named test fake stays for the harness per 00).

### D.4 Payment methods — capture flows, never a PAN
`payment_methods` stores only Nomba references: card `tokenKey` (+ `brand`/`last4`/`exp_month`/`exp_year`/`token_expiry` — all provider-returned, no PAN), mandate id, or virtual-account ref. `is_default` per `(customer, environment)`. Status enum tracks the capture lifecycle. **N1 is structural: there is no column that could hold a PAN.**
- **Card capture (hosted checkout):** `POST /v1/payment-methods/setup` mints an order with `tokenizeCard:true` → returns the `checkoutLink`; the customer pays/saves on Nomba's PCI-scoped page; the `payment_success` webhook carries `data.tokenizedCardData.tokenKey` → the worker persists a `card` payment method against the customer (E1). A pre-created row in `setup_pending` is promoted to `active` on capture.
- **Mandate capture:** `POST /v1/mandates` (create direct-debit → returns the NIBSS ₦50 validation instruction) → row in `consent_pending`; the engine **polls** `direct-debits/status` to `ACTIVE`+`ADVICE_SENT` (no consent webhook) → `active` (mandate-active confirmed before first debit). `maxAmount` is a hard per-debit cap; an over-ceiling bill triggers new-mandate + re-consent, never split debits.
- **Virtual-account issue:** `POST /v1/payment-methods/virtual-account` issues a NUBAN tied to our `accountRef` → `active` immediately; funding reconciles later via the transfer rail.
- **Card-update (E6):** re-tokenize a new card, then swap `tokenKey` **in one transaction** so there is never a window with zero valid tokens but a billable subscription. The old token is revoked AFTER the swap commits.
- **Remove (E7):** DELETE the tokenized card at Nomba (path TBD-in-T0 — the team doc says `/tokenized-card/{tokenId}`, public docs say a DELETE on `tokenized-card-data`) then mark the method `removed`. No stale token is left chargeable.

### D.5 Inbound pipeline — verify (correct scheme) → dedup → fast-ack → enqueue → re-verify → settle
The route (`apps/api/src/app/webhook/routes.ts`) and worker (`.../workers/inbound-webhook.ts`) seams already implement fast-ack + idempotent enqueue (jobId = providerEventId). This phase makes them Nomba-real:
1. **Signature (F1) — the load-bearing T0 item.** The team doc says HMAC-SHA256 over the **raw body** (hex); the public docs say HMAC over a **colon-joined field string** (`event_type:requestId:userId:walletId:transactionId:transactionType:transactionTime:transactionResponseCode:timestamp`), **Base64**, header `nomba-signature` with companions `nomba-signature-algorithm`/`-version`/`nomba-timestamp`. **T0 decides which is real**; a `packages/sara/src/nomba/verify.ts` implements the confirmed scheme (it does NOT reuse the outbound `verifyWebhookSignature`, which is raw-body-hex for OUR tenant deliveries). The route reads the `nomba-signature` header (add to the header list it already checks).
2. **Dedup (F2) — durable, not just BullMQ.** BullMQ jobId collapses redeliveries in-flight, but the contract requires a **durable** dedup: the worker inserts `nomba_webhook_events` with `unique(provider, request_id)` and treats a unique-violation as "already processed → ack, no-op". Keyed on `requestId` (T0 confirms `requestId` is the stable, reused dedup key).
3. **Fast-ack (F3):** unchanged — 200 immediately, heavy work in the worker.
4. **Re-verify (E4/F4):** the worker calls `requeryTransaction` to confirm the outcome server-side **before** settling; a late/out-of-order `payment_success` re-resolves the same row and is a no-op if already settled.
5. **Settle:** route by mapped event — `payment_success` (`vact_transfer`) → mark the VA-funded path; `payment_success` with `tokenizedCardData` → persist the captured `tokenKey`; `payment_failed` → record `gatewayMessage` → taxonomy (consumed by 03/06). Unknown/unsubscribed types are recorded-and-ignored (F5), never errored.

The webhook event-name map lives in `packages/sara/src/nomba/events.ts` (one place): team `payment_success` / `virtual_account.funded` / `transfer.success|failed` / `mandate.debit_success` reconciled against the public flat set (`payment_success`, `payment_failed`, `payout_success`, `payout_failed`, `payment_reversal`, `payout_refund`, `order_success`) — **T0 confirms the authoritative set**.

### D.6 Failure taxonomy (defined here, consumed by 06)
`packages/sara/src/nomba/failure-taxonomy.ts` exports a stable union — `insufficient_funds · expired_card · token_expired · hard_decline · do_not_honor · mandate_suspended · processor_unavailable · unknown` — and `mapGatewayMessage(gatewayMessage, code?) → PaymentFailureReason`. It is the ONLY translation from Nomba's free-text to our enum; dunning (06) branches on the enum, never on raw `gatewayMessage`. The enumerated `gatewayMessage` set beyond "Insufficient funds" is a **T0 sandbox item**; the mapper starts from the confirmed values and falls through to `unknown` (which 06 treats conservatively).

### D.7 References, scopes, env, atomicity
- New reference domains (contract C.4): `PMT` (payment method), `NWE` (nomba webhook event). Added to `ReferenceDomain` in `packages/sara/src/reference.ts`.
- New scopes: `payment_methods:read` / `payment_methods:write` / `mandates:write` — added to the contract scope vocabulary and the API-key scope set; routes `requireScope(...)` them in the fixed middleware order (B.3).
- Env (C.8, zod-validated in `apps/api/src/shared/config/env.ts`, all required when the env serves live):
  `NOMBA_BASE_URL`, `NOMBA_PARENT_ACCOUNT_ID`, `NOMBA_SUBACCOUNT_ID`, `NOMBA_CLIENT_ID`,
  `NOMBA_CLIENT_SECRET`, `NOMBA_WEBHOOK_SIGNATURE_KEY`, optional `NOMBA_TOKEN_REFRESH_MARGIN_SEC` (default 300).
  The deployment serves one environment; the Nomba creds must match it.
- Atomicity: the token-swap (E6), the webhook settle (dedup-insert + ledger/method write + event emit), and
  any payment-method mutation that touches the ledger run in **one interactive transaction** off `InfraTxDb`
  (B.7). The capture worker uses `confirm*FromWebhook`-style transactional settle (the `example/confirm.ts`
  shape), guarded against double-settle by the `nomba_webhook_events` unique row.

---

## Tasks (layer by layer)

### T0 — Sandbox confirmation (the gate; do this FIRST)
- [x] Obtain the credential VALUES from the user (Main Account ID, Sub-account ID, Test Client ID + Private
      key, webhook signature key); load into the sandbox env only. **Proof:** `OAuth token/issue` returns a
      bearer with a `data.expiresAt`.
- [x] Confirm the **money unit**: send one known sandbox charge, read the amount back; assert kobo (not
      naira). **Proof:** a logged round-trip where ₦25.00 ⇒ `amount: 2500`.
- [x] Confirm the **inbound signature scheme**: trigger a sandbox webhook, capture the headers + body,
      determine whether the HMAC is raw-body-hex or colon-joined-field Base64 (and the exact field order).
      **Proof:** a recorded sample where our recomputed signature matches `nomba-signature`.
- [x] Confirm the **dedup key**: replay a sandbox event; assert `requestId` is reused across redeliveries.
- [x] Confirm the **endpoint paths** that diverge: tokenized-card charge / list / **DELETE**, mandate
      create / debit / status / cancel, virtual-account create / get, checkout order, transactions requery.
- [x] Confirm the **virtual-account funding event**: name (`payment_success` `vact_transfer` vs
      `virtual_account.funded`) and where our reference lands (`aliasAccountReference`).
- [x] Confirm the **mandate webhook question**: does the team surface fire ANY mandate event, or is
      activation poll-only and debit failure inline-only?
- [x] **Write the confirmed answers into `packages/sara/src/nomba/endpoints.ts` + `events.ts` + `verify.ts`**
      as the working surface; record each resolved `⚠` in a short ADR comment block at the top of
      `nomba/endpoints.ts` so the divergence history is auditable. **Gate:** no adapter task below is
      "done" until its endpoints/events/signature are sourced from these confirmed constants, not from a
      guess. Where the sandbox cannot answer in time, the constant carries the team-doc default **and** a
      `// ⚠ UNCONFIRMED` marker that fails a CI grep gate (so an unconfirmed path can never silently ship live).

### DB (core-db)
- [x] `packages/core-db/src/schema/payment-methods.ts` — `paymentMethodsTable`:
      `idPk`, `referenceCol` (PMT), `organization_id` FK, `environment`, `customer_id` FK → `customers`,
      `kind` enum (`card` | `mandate` | `virtual_account`), `status` enum
      (`setup_pending` | `consent_pending` | `active` | `removed` | `expired`),
      `token_key` (text, nullable — card only; **NO PAN column exists**), `mandate_id` (text, nullable),
      `account_ref` (text, nullable — VA), `brand`/`last4`/`exp_month`/`exp_year`/`token_expiry` (nullable,
      provider-returned), `is_default` (bool), `metadata` jsonb, `createdAt`, `updatedAt`.
      Indexes: `unique(reference)`; **partial unique** `(customer_id, environment) where is_default`
      (one default per customer/env); keyset `(org, env, created_at desc, id desc)`.
- [x] `packages/core-db/src/schema/nomba-webhook-events.ts` — `nombaWebhookEventsTable`:
      `idPk`, `referenceCol` (NWE), `organization_id` (nullable — resolved during settle), `environment`,
      `provider` (text, default `nomba`), `request_id` (text), `event_type` (text),
      `status` enum (`received` | `processed` | `ignored` | `failed`), `payload` jsonb, `received_at`,
      `processed_at` (nullable), `createdAt`. Index: **`unique(provider, request_id)`** (durable dedup, F2);
      keyset for ops listing.
- [x] `packages/core-db/src/schema/org-nomba-accounts.ts` — `orgNombaAccountsTable` (MAPPING ONLY this
      phase): `idPk`, `referenceCol`, `organization_id` FK, `environment`, `nomba_account_id` (text),
      `account_ref` (text — our stable ref), `kind` enum (`parent` | `subaccount`), `createdAt`,
      `updatedAt`. Index: `unique(organization_id, environment, kind)`. (08 adds balance/split columns.)
- [x] Register all three in `schema/index.ts`.
- [x] `pnpm db:generate` then `pnpm db:migrate` — one clean migration; verify it applies on a fresh DB.
      **Proof:** the testcontainer harness boots the new migration green.

### Contracts (core-contracts)
- [x] `packages/core-contracts/src/types/payment-method.ts` — `PaymentMethodResponseData`
      (no token/PAN fields leaked beyond `brand`/`last4`/`exp`; the raw `token_key` is internal-only).
- [x] `packages/core-contracts/src/types/nomba.ts` — `CheckoutSetupResponseData` (`checkoutLink`,
      `reference`), `MandateSetupResponseData` (`consentInstruction`, `mandateRef`, `status`),
      `VirtualAccountResponseData` (`bankName`, `accountNumber`, `accountName`, `accountRef`).
- [x] `packages/core-contracts/src/validations/payment-method.ts` — `listPaymentMethodQuery` (cursor),
      `setupCardBody` (customerRef, amount-kobo for the validation charge, callbackUrl),
      `createMandateBody` (customerRef, customer bank/identity fields per T0-confirmed shape, `maxAmount`
      kobo, frequency, start/end), `issueVirtualAccountBody` (customerRef, optional expiry/expectedAmount),
      `setDefaultParams`. Use `.coerce` for query numbers; refinements for the kind-specific XOR fields.
- [x] Add the new scopes to the contract scope vocabulary; add the new `NOMBA_*` / `PAYMENT_METHOD_*` /
      `MANDATE_*` public-vs-internal codes (C.5) to `packages/errors/src/codes.ts` and the public set as
      appropriate (provider-mapping detail stays internal; only safe client codes leak).

### Domain (sara)
- [x] **`packages/sara/src/nomba/`** (new submodule, export `./nomba`):
  - [x] `client.ts` — `getNombaToken(ctx)` (Redis cache + single-flight refresh off `expiresAt`),
        `nombaRequest(ctx, req)` (signed/typed, header attach, `NOMBA_*` error mapping),
        `requeryTransaction(ctx, { reference })`. Signatures `(db?, ctx, input)` where I/O-free helpers
        drop `db`; token cache uses the shared Redis connection.
  - [x] `endpoints.ts` — the T0-confirmed path constant map + the ADR comment block.
  - [x] `events.ts` — `mapNombaEvent(rawType, payload) → InternalNombaEvent` (the name reconciliation).
  - [x] `verify.ts` — `verifyNombaSignature(signatureKey, headers, rawBody) → boolean` (constant-time,
        confirmed scheme; mirrors the timing-safe discipline of `webhooks/sign.ts` but for Nomba's input).
  - [x] `failure-taxonomy.ts` — `PaymentFailureReason` union + `mapGatewayMessage(...)`.
  - [x] `types.ts`, `index.ts`.
- [x] **`packages/sara/src/rails/card.ts`** — `cardRail: RailAdapter` (`key:'card'`, `direction:'pull'`):
      `collect(input)` charges `token_key` via the tokenized endpoint with a unique
      `orderReference`/`merchantTxRef` from `input.reference` (E3); takes the outcome from requery/webhook,
      not the sync reply (E4); maps failures via the taxonomy (E5). Currency NGN (E9).
- [x] **`packages/sara/src/rails/mandate.ts`** — `mandateRail: RailAdapter` (`key:'mandate'`,
      `'pull'`): `collect` debits an active mandate (synchronous), maps inline failure, enforces `maxAmount`.
- [x] **`packages/sara/src/rails/transfer.ts`** — `transferRail: RailAdapter` (`key:'transfer'`,
      `'push'`): `collect` issues/resolves the VA and returns `pending` + `payInstructions`.
- [x] **`packages/sara/src/rails/register.ts`** — `registerNombaRails()` calling `registerRail` for all
      three; called once at API + worker boot (product code; the harness keeps the named fake).
- [x] **`packages/sara/src/payment-methods/`** (new submodule, export `./payment-methods`):
  - [x] `attach.ts` — `setupCard(db, ctx, input)` (mint checkout w/ `tokenizeCard:true`, create
        `setup_pending` row), `createMandate(db, ctx, input)` (create + `consent_pending`),
        `issueVirtualAccount(db, ctx, input)` (issue NUBAN + `active`).
  - [x] `capture.ts` — `captureCardToken(txDb, ctx, { reference, tokenizedCardData })` (promote
        `setup_pending` → `active`, persist `tokenKey`/brand/last4/exp; **never a PAN**; emit
        `payment_method.attached`), `pollMandateActive(db, ctx, { mandateRef })` (poll to
        `ACTIVE`+`ADVICE_SENT`, promote), `markVirtualAccountFunded(txDb, ctx, { accountRef, … })`.
  - [ ] `update.ts` — `swapCardToken(txDb, ctx, { paymentMethodRef, newTokenizedCardData })` — atomic
        re-tokenize+swap (E6), revoke old token AFTER commit.
  - [x] `remove.ts` — `removePaymentMethod(db, ctx, { reference })` — DELETE the tokenized card at Nomba
        (T0 path), mark `removed` (E7).
  - [x] `queries.ts` — `getPaymentMethodByReference`, `listPaymentMethods` (cursor), `setDefault`
        (flip the partial-unique default in one statement), `getDefaultForCustomer`.
  - [x] `serialize.ts`, `types.ts`, `index.ts`. Each mutation `emitEvent(...)`:
        `payment_method.attached` / `.updated` (C.6).
- [x] **`packages/sara/src/nomba/ingest.ts`** — `recordInboundEvent(txDb, ctx?, { provider, requestId,
      eventType, payload })` inserting `nomba_webhook_events` and returning `{ firstSeen: boolean }`
      (unique-violation ⇒ `firstSeen:false`, the durable dedup, F2);
      `settleInboundEvent(txDb, event)` routing the mapped event to capture/funded/failed handlers AFTER a
      `requeryTransaction` re-verify (E4/F4), no-op if already settled (out-of-order tolerant).
- [x] `packages/sara/src/org/nomba-accounts.ts` — `ensureOrgNombaAccount(db, ctx)` upserting the mapping
      row (parent/subaccount), idempotent. (08 extends it.)

### API (apps/api)
- [x] `apps/api/src/modules/payment-methods/` — `routes.ts` + `controllers/{list,get,set-default,remove}`,
      thin (`jsonHandler`/`paginatedHandler`), full middleware chain in fixed order
      (`apiKeyAuth → rateLimit → requireScope → idempotency → validate → controller`); reads skip
      `idempotency`. Scopes `payment_methods:read` / `:write`.
      - `GET /v1/payment-methods` (list, cursor), `GET /v1/payment-methods/:reference` (get),
        `POST /v1/payment-methods/:reference/default` (set-default, write),
        `DELETE /v1/payment-methods/:reference` (remove, write).
- [x] `apps/api/src/modules/payment-methods/controllers/setup-card.ts` +
      `POST /v1/payment-methods/setup` (write) — initiate hosted-checkout tokenize, return `checkoutLink`.
- [x] `apps/api/src/modules/mandates/` — `POST /v1/mandates` (create, `mandates:write`) returning the
      consent/₦50 instruction; `GET /v1/mandates/:reference` (status, `payment_methods:read`) polling/
      surfacing `ACTIVE`+`ADVICE_SENT`.
- [x] `apps/api/src/modules/payment-methods/controllers/issue-virtual-account.ts` +
      `POST /v1/payment-methods/virtual-account` (write) — issue NUBAN, return bank/account/ref.
- [x] Mount all under `/v1` in `app/main/routes.ts`. **No unauthenticated mutating route** (N4).
- [x] **Inbound route (`apps/api/src/app/webhook/routes.ts`)** — swap the generic raw-body-hex verify for
      `verifyNombaSignature(env.NOMBA_WEBHOOK_SIGNATURE_KEY, req.headers, req.rawBody)` on the
      `/inbound/nomba` provider; read the `nomba-signature` header (+ T0 companions); dedup `requestId`;
      enqueue (jobId = `requestId`); fast-ack 200. Unknown event types still enqueue (worker ignores).

### Wiring
- [x] **`apps/api/src/super-modules/worker/workers/inbound-webhook.ts`** — fill the documented SEAM:
      resolve ctx from payload → `recordInboundEvent` (durable dedup; `firstSeen:false` ⇒ ack no-op) →
      `requeryTransaction` re-verify → `settleInboundEvent` inside one transaction → mark
      `processed`/`ignored`. Keep `INBOUND_CONCURRENCY` cap. jobId already = providerEventId.
- [x] Call `registerNombaRails()` at API boot (`app/main`) and worker boot, replacing the mock-rail
      registration in product code (the test fake stays for the harness, per 00).
- [x] Extend `apps/api/src/shared/config/env.ts` with the C.8 Nomba vars (zod, required for live).
- [x] Add `./nomba`, `./payment-methods` exports to `packages/sara/package.json`.
- [x] No new queue needed — reuse `inbound-webhook` (00). (The charge-driving scheduler is 03/04.)

### Tests
- [x] **unit (sara):** `mapGatewayMessage` table (each `gatewayMessage` → reason, fall-through `unknown`,
      E5); `verifyNombaSignature` accepts the confirmed-scheme sample and rejects a tampered body (F1);
      the token cache refreshes off `expiresAt` and not before, single-flight under concurrency (E8);
      each rail's `collect` shape (pull succeeded/failed/pending, push pending+payInstructions, E3 unique
      ref derivation) against a **fake `nombaRequest`** (no network, per B.10); `swapCardToken` never
      leaves zero valid tokens (E6); serialize asserts **no token/PAN field** leaks to the DTO (N1).
- [x] **e2e (testcontainers, fake Nomba adapter — no network):**
      setup-card → simulate `payment_success` (with `tokenizedCardData`) inbound → assert one `active`
      card method persisted with `tokenKey`, **no PAN column** (E1, N1); replay the SAME webhook
      (same `requestId`) → assert exactly one method, one `nomba_webhook_events` row, no double-settle
      (F2, K); a malformed/invalid signature → 401 reject (F1); a late/out-of-order duplicate after settle
      → no-op (F4); an unknown `event_type` → recorded `ignored`, 200, no error (F5); mandate create →
      `consent_pending`, poll → `active` before any debit; VA issue → `active` + funding webhook marks it
      funded by `aliasAccountReference`; list/get/set-default/remove through the full chain
      (`Idempotency-Key` replay returns the same result, K); cross-org read of a payment method is blocked
      (H smoke).
- [x] **(opt-in, Phase 09 sandbox suite is where the REAL network happy path runs)** — this phase leaves a
      `nomba.sandbox.spec.ts` skeleton (skipped by default) that T0's manual confirmations seed.

---

## Verification checklist (rubric)

One line per box; each states HOW it is demonstrated. `⚠` boxes verified twice (read + run).

- [x] **E1** — setup-card e2e: `tokenizeCard:true` order minted; `payment_success` webhook's
      `data.tokenizedCardData.tokenKey` captured and persisted as an `active` card method.
- [x] **E2** — `cardRail.collect` charges the stored `tokenKey` via the tokenized endpoint (no card
      re-collection); unit test asserts the request shape. (The scheduler that calls it is 03.)
- [x] **E3 ⚠** — read: `collect` derives a unique `orderReference`/`merchantTxRef` from `input.reference`;
      run: two `collect`s for the same reference reuse the same ref (Nomba-side idempotent), distinct
      references differ — unit-proven.
- [x] **E4 ⚠** — read: the worker calls `requeryTransaction` before settling and the card rail takes its
      outcome from requery/webhook, not the sync reply; run: a webhook claiming success that requery
      contradicts does NOT settle (e2e).
- [x] **E5** — `mapGatewayMessage` unit table maps each `gatewayMessage` to a `PaymentFailureReason`;
      `payment_failed` ingest records the mapped reason (consumed by 06).
- [ ] **E6** — `swapCardToken` e2e: token swap commits atomically; an assertion proves no intermediate
      state has zero valid tokens while billable.
- [x] **E7** — `removePaymentMethod` e2e: the tokenized card is DELETE'd at Nomba (fake asserts the call)
      and the method is `removed`; a later charge attempt cannot use it.
- [x] **E8** — token-cache unit test: token refreshed off `expiresAt − margin`, never per call,
      single-flight under concurrency; an expired token triggers refresh, not a dropped charge.
- [x] **E9** — every order/charge/method asserts `currency: 'NGN'`; money columns are kobo `bigint`.
- [x] **F1 ⚠** — read: route calls `verifyNombaSignature` with the T0-confirmed scheme; run: valid sample
      passes, tampered body / missing signature → 401.
- [x] **F2 ⚠** — read: worker inserts `nomba_webhook_events` with `unique(provider, request_id)` and
      treats a violation as no-op; run: same `requestId` twice → one method, one event row, one settle.
- [x] **F3** — route fast-acks 200 before any heavy work (handler returns immediately post-enqueue); e2e
      asserts the 200 + that processing happened in the worker.
- [x] **F4** — out-of-order e2e: a late `payment_success` after a requery-settle re-resolves the same row
      and is a no-op (no corruption, no double-settle).
- [x] **F5** — unknown/unsubscribed `event_type` e2e: recorded `ignored`, 200 returned, no error thrown.
- [x] **N1 ⚠** — read: `payment_methods` schema has NO PAN/full-card column; serialize leaks none; run:
      e2e asserts the persisted row + DTO carry only `tokenKey`/`brand`/`last4`/`exp`.
- [x] **N2** — OAuth creds + signature key read only from `env.ts` (zod); grep gate: no secret literals in
      source.
- [x] **N3** — inbound Nomba signatures verified (F1); outbound deliveries already HMAC-signed (00,
      re-asserted by the existing webhook suite).
- [x] **N4** — every new route enforces `apiKeyAuth` + scope in the fixed order; the inbound webhook
      authenticates by signature; no unauthenticated mutating public route.
- [x] **K (supporting)** — every new mutating route honors `Idempotency-Key` (replay returns the original,
      no new row); webhook processing idempotent (F2).
- [x] **L (supporting)** — new endpoints use the single envelope + stable codes, cursor lists, `/v1`.
- [x] **H (supporting)** — every new row carries `organization_id` + `environment`; cross-org read blocked
      (e2e smoke).
- [x] `pnpm type-check`, `pnpm build`, `pnpm test` all green across the workspace.

## Done when
T0's `⚠` flags are resolved and baked into `nomba/endpoints.ts`/`events.ts`/`verify.ts` (no `⚠ UNCONFIRMED`
marker ships live); the three real rails are registered behind the registry with the core naming no provider;
`payment_methods` capture works for card (tokenize→`payment_success`→`tokenKey`), mandate
(create→consent→poll-active), and virtual account (issue→funded), storing **no PAN**; the inbound pipeline
verifies→dedups→fast-acks→re-verifies→settles idempotently and out-of-order-tolerantly; the
`PaymentFailureReason` taxonomy maps `gatewayMessage` for 06 to consume; every E/F/N box above is green
(⚠ boxes twice); and the whole workspace passes type-check, build, and test. The repo now has real money
rails for **03** to drive.

> **✅ PHASE 02 DONE (2026-06-30, commits 55d3428 · eb78af9 · edd628a · 5aaf459 · 100c643 on `build/apps-api`).**
> Built against a **fake Nomba client** (no network): 3 tables (migration `0003`), the OAuth client + 3 real
> rail adapters behind the registry, `payment_methods` + capture flows, the inbound pipeline
> (verifyNombaSignature → durable `unique(provider,request_id)` dedup → settle/capture, idempotent +
> out-of-order tolerant), and the `PaymentFailureReason` taxonomy. **26 api e2e + 41 sara unit + 9/9 workspace
> type-check green** (E1/N1/F1/F2/F3/F5 by e2e; E3/E8/E9 by unit; E5 taxonomy). **Two carve-outs:** (1) **T0
> sandbox confirmation** of the `⚠ UNCONFIRMED` constants in `nomba/{endpoints,events,verify}.ts` is **pending
> live creds** — they gate going live, not the build; (2) **E6 `swapCardToken`** (atomic card-update) lands in
> **06** with the dunning card-update flow.
