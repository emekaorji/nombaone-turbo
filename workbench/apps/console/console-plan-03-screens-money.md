# Nomba One: Console Plan · 03 · Money screens

> **What this is.** The full specification for the money-movement screens: payment methods across the three rails, settlements, escrow and withdrawal, refunds, and coupons. Every screen below gives its purpose, the exact DTO fields it shows (real names from `packages/core-contracts`), the real actions (endpoint method and path, with `Idempotency-Key` called out where money moves), gating on rail and status, and the loading, empty, and error states. ASCII wireframes are the Phase A pencil starting point for every screen. Cited names are real and confirmed against the code; anything not directly confirmed is marked "(verify)".
>
> **Depends on:** doc 00 (overview: north star, personas, scope boundary, inherited design language, voice), doc 01 (IA and navigation: the app shell, the test and live switch, the cursor-pagination model), and doc 02 (core screens: the three response envelopes, the money-is-kobo helper, the idempotency model, FSM-aware gating, and the loading, empty, and error contract, all reused here without repeating the mechanics). Doc 06 owns the data table, filter bar, detail drawer, and copy-once secret field these screens compose from. Doc 08 owns the complete error-code catalog.

---

## 1. How to read this, and the rules this doc adds

Every rule in doc 02, section 1, holds here without exception: the three envelopes (success, paginated, error), the naira-by-dividing-kobo-by-100 helper, the idempotency model, the FSM-gating pattern, and the two-phase pencil-then-build method. This section adds only what is specific to money-movement screens.

### 1.1 Rail vocabulary and the pull and push distinction

A payment method's `kind` is `card`, `mandate`, or `virtual_account`. Card and mandate are **pull** rails: the engine initiates a charge against a token or a mandate. Virtual account is a **push** rail: the engine can only wait for the customer to send money and reconcile it against the right invoice by reference. This distinction shapes every screen in section 2 through 6.

- **Card, pull, best-effort.** A recurring card charge is bank-gated: the issuing bank can force an OTP or 3DS step-up that cannot complete headlessly. The console never claims silent auto-renewal for a card; the honest fallback is a fresh checkout link, owned by the dunning cockpit in doc 05. This doc owns only card setup (section 3).
- **Mandate, pull, the reliable silent rail.** A NIBSS direct-debit mandate authorizes a silent debit up to a hard per-debit ceiling, with no customer action needed once active. It is the rail this product recommends for genuine recurring billing, and it is live-gated: `/v1/direct-debits/*` returns 404 in sandbox. Section 5 presents it as designed and built, not yet provable outside a live account.
- **Virtual account, push, reconciled by reference.** A dedicated account number the customer transfers into. There is no capture step and no OTP: the engine issues the account, waits, and matches the inbound transfer to the right invoice by reference, to the kobo. Section 4 owns issuing it.

### 1.2 `PaymentMethodStatus`, and which kinds pass through which states

`PaymentMethodStatus` is one shared enum (`setup_pending`, `consent_pending`, `active`, `removed`, `expired`) across all three kinds, but not every kind visits every value. Confirmed from `packages/sara/src/payment-methods/attach.ts`:

- **Card** starts at `setup_pending` (the row exists before the customer ever completes checkout) and is promoted to `active` only when the `payment_success` webhook's captured token lands (`captureCardToken`, `packages/sara/src/payment-methods/capture.ts`). A card can later read `expired`.
- **Mandate** starts at `consent_pending` and is promoted to `active` only by a poll that finds the NIBSS status `ACTIVE` with advice `ADVICE_SENT` (`pollMandateActive`, same file). There is no consent webhook; activation is poll-only, backed also by the background mandate-activation sweep.
- **Virtual account** is inserted `active` immediately (`issueVirtualAccount`). It never passes through `setup_pending` or `consent_pending`, because issuing an account number needs no customer action to become usable.

`removed` is terminal for every kind (`removePaymentMethod`, `packages/sara/src/payment-methods/remove.ts`, is idempotent: removing an already-removed method is a no-op that returns the same row).

### 1.3 The N1 invariant: never a PAN, never a raw token, on this screen or any other

`PaymentMethodResponseData` (`packages/core-contracts/src/types/payment-method.ts`) carries no `tokenKey`, no `mandateId` as a persistent field, and no `accountRef`. Card display is limited to `brand`, `last4`, `expMonth`, and `expYear`; `captureCardToken` strips a masked PAN down to its last four digits before anything is stored. The console never renders a card number, CVV, or expiry input anywhere. Every card capture happens on Nomba's own hosted checkout page, off the console entirely (section 3).

### 1.4 Idempotency on the money screens, named per action

| Action | Endpoint | Idempotency-Key |
|---|---|---|
| Add card (setup) | `POST /v1/payment-methods/setup` | **Required** |
| Issue virtual account | `POST /v1/payment-methods/virtual-account` | Optional, sent by the console |
| Create mandate | `POST /v1/mandates` | **Required** |
| Set default | `POST /v1/payment-methods/:id/default` | Optional, sent by the console |
| Remove method | `DELETE /v1/payment-methods/:id` | Optional, sent by the console |
| Create payout (withdraw) | `POST /v1/settlements/payout` | **Required** |
| Refund | `POST /v1/settlements/:id/refund` | **Required** |
| Create coupon | `POST /v1/coupons` | Optional, sent by the console |
| Edit coupon | `PATCH /v1/coupons/:id` | Optional, sent by the console |

The console generates the key itself and never asks a merchant to type one, exactly as doc 02 section 1.3 specifies.

### 1.5 The settlement split invariant, enforced server-side

`gross = platformFee + netToTenant`, all non-negative integers, is asserted by `assertSplitBalances` (`packages/sara/src/settlement/split.ts`) before any settlement is ever recorded; a violation raises `SETTLEMENT_SPLIT_UNBALANCED` and nothing is written. The console never validates this split. It only renders it, visually, on every settlement row and detail (section 7).

### 1.6 The escrow and withdrawal rule, reflected exactly from `escrow-withdrawal-lock.md`

Collections split at the moment of collection into the tenant's share and the platform fee. A tenant may not withdraw funds collected inside a rolling window, so the platform can claw the tenant's share back for a refund before it leaves. The rule, unchanged from the design note:

```
withdrawable = subAccountBalance − lockedLast3h − minWithdrawalBuffer
```

A withdrawal that would violate this is rejected or clamped, never silently allowed. As shipped (`packages/sara/src/settlement/escrow.ts`, `payout.ts`), this reads precisely as:

- `lockedLast3h` sums `netToTenantKobo` over the tenant's own `settled` and `reconciled` settlements newer than the cutoff (`computeTenantEscrow`), a rolling window that frees money as settlements age past three hours.
- `minWithdrawalBuffer` is `org_billing_settings.minWithdrawableKobo`, defaulting to 0 when unset. No `PUT` endpoint currently exposes this field to a tenant (`BillingSettingsResponseData` does not carry it); the console renders it as read-only until a write surface ships. (verify: no route sets `minWithdrawableKobo` today.)
- **A design correction worth stating plainly.** The original note assumed the console would fetch `subAccountBalance` live from Nomba on each read. The shipped implementation instead treats `balanceInKobo` as apps/api's own ledger-derived `tenant_settlement` liability (`getTenantSettlementBalance`), the authoritative figure returned by `GET /v1/settlements/escrow`, with the real Nomba sub-account balance reconciled out-of-band by the nightly reconcile cron rather than fetched per request. The console renders this ledger balance as the number of record; it does not call Nomba directly for it.

The withdraw action itself is `POST /v1/settlements/payout` (section 8), which re-derives `available` inside the same transaction as the write (`payoutToTenant`), under a `FOR UPDATE` lock on the tenant's settlement account, so two concurrent withdrawals cannot both succeed against the same headroom.

### 1.7 The refund rule, tenant-net only, fee never refunded

A refund returns only the tenant's net share; the platform fee is earned at collection and is non-refundable (F3 in `escrow-withdrawal-lock.md`). Mechanically, `refundSettlement` (`packages/sara/src/settlement/refund.ts`) reverses only the `tenant_settlement` leg, crediting `platform_revenue`, and never touches `platform_fees`. Repeated partial refunds are allowed up to the settlement's `netToTenantInKobo`; the settlement's own `status` flips to `refunded` only once cumulative refunds reach that ceiling. A refund's own `status` starts and typically stays `ledger_only`: the ledger has moved, but the real bank-side money return to the end customer is a separate, provider-guarded step this build does not yet perform. The console never renders `ledger_only` as "refunded to the customer."

### 1.8 The coupon definition invariant

A coupon carries exactly one of `amountOffInKobo` or `percentOff`, enforced by a `zod` refine on `createCouponBody` (`packages/core-contracts/src/validations/coupon.ts`) before the request ever reaches the domain layer: supplying both, or neither, is a `CLIENT_VALIDATION_FAILED` before it can become a server-side `COUPON_INVALID_DEFINITION`. A `repeating` duration requires `durationInCycles`; `once` and `forever` must not carry it. Section 10's create form mirrors both refines structurally, so an invalid combination cannot be submitted from the console in the first place. There is no delete route for a coupon, ever; it retires only by exhausting `maxRedemptions` or passing `redeemBy`.

### 1.9 Live-gated and honestly-incomplete postures specific to this doc

- **Mandate rail:** `/v1/direct-debits/*` 404s in sandbox. `consent_pending` and `active` are real, reachable states in this build; a live create-to-debit round trip needs live keys and a real bank account.
- **Payout provider leg:** gated by `NOMBA_PAYOUT_ENABLED`. Off, a payout posts its ledger debit and stops at `ledger_posted`. On, it attempts the (unconfirmed-live) `bankTransfer` and reconciles to `succeeded` or a compensated `failed`. The console never shows `ledger_posted` as bank-confirmed.
- **Refund provider leg:** not built. Every refund in this build stays `ledger_only`; there is no path to `succeeded` yet.
- **Settlement `reconciled` and `failed` statuses:** `reconcileSettlements` (`packages/sara/src/settlement/reconcile.ts`) is a pure diff function that a nightly cron feeds; the exact write path that flips a settlement row's `status` from `settled` to `reconciled` or to `failed` was not directly confirmed in this reading. (verify.) The console renders whatever `status` the API returns and does not compute or infer it.

---

## 2. Payments and rails: methods list

**Purpose.** A customer-scoped roll call of every payment method across all three rails, and the entry point to adding a card, issuing a virtual account, or creating a mandate.

**Endpoint.** `GET /v1/payment-methods` (paginated), scope `payment_methods:read`. Query from `listPaymentMethodQuery`: `customerRef` (optional), `limit` (1 to 100, default 20), `cursor`.

**Data per row (from `PaymentMethodResponseData`).** `domain` (`payment_method`), `id` (`nbo…pmt`), `customerId`, `kind` (`card`, `mandate`, `virtual_account`), `status` (`setup_pending`, `consent_pending`, `active`, `removed`, `expired`), `isDefault`, and card display only (`brand`, `last4`, `expMonth`, `expYear`, all null for mandate and virtual account), `environment`, `createdAt`, `updatedAt`.

**Status to badge mapping.** `setup_pending` and `consent_pending` both read as in-progress, waiting-on-the-customer states, so they take the info hue, the same one `trialing` uses for subscriptions: a wait, not a failure. `active` reads accent. `expired` reads warning, a needs-attention state akin to `past_due`. `removed` reads neutral, an intentional, non-error end state, the same posture a `void` invoice takes: it is not a failure, it is a retired one.

**Filter.** `customerRef` scopes the list to one customer, set automatically when the screen opens from a customer detail (doc 02, section 7).

**Actions.** Three primary actions open the flows in sections 3, 4, and 5: **Add card**, **Issue virtual account**, **Create mandate**. Row actions **Set default** and **Remove** are covered in section 6.

**Wireframe (Phase A).**

```
┌ Ada Obi · Payment methods ──────────────  [Add card][Virtual account][Mandate] ┐
│ ┌──────────┬──────────────────┬──────────────────┬─────────┬────────────────┐ │
│ │ Method    │ Kind              │ Status            │ Default │ Card display   │ │
│ ├──────────┼──────────────────┼──────────────────┼─────────┼────────────────┤ │
│ │ nbo…pmt  │ card              │ ●Active           │ yes     │ Visa •••• 4242 │ │
│ │ nbo…pmt  │ mandate           │ ●Consent pending  │ no      │ none           │ │
│ │ nbo…pmt  │ virtual_account   │ ●Active           │ no      │ none           │ │
│ │ nbo…pmt  │ card              │ Removed           │ no      │ Visa •••• 1010 │ │
│ └──────────┴──────────────────┴──────────────────┴─────────┴────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** four skeleton rows.
- **Empty:** "No payment methods yet. Add a card, issue a virtual account, or create a mandate to start collecting from this customer." with the three primary actions.
- **Error:** read-failure retry panel with `meta.requestId`. `PAYMENT_METHOD_NOT_FOUND` on a stale `customerRef` reloads without the filter.

---

## 3. Payments and rails: add a card (hosted setup)

**Purpose.** Start a card on the pull rail. The console never collects a card number; it redirects to Nomba's hosted checkout page for tokenization and waits for confirmation.

**Endpoint.** `POST /v1/payment-methods/setup`, scope `payment_methods:write`, **Idempotency-Key required**. Body `setupCardBody`: `customerRef`, `amountInKobo` (positive integer kobo, the validation charge Nomba runs to tokenize the card), `callbackUrl` (a valid URL, where Nomba redirects after the customer completes or abandons checkout).

**Response.** `CheckoutSetupResponseData`, status 201: `domain` (`checkout_setup`), `reference`, `checkoutLink`.

**The exact mechanic, confirmed from `packages/sara/src/payment-methods/attach.ts`.** `setupCard` mints the `reference` up front (`mintReference('PMT')`) and inserts the payment-method row immediately with `kind: 'card'`, `status: 'setup_pending'`, before the customer ever sees the checkout page. That same `reference` is the method's own `nbo…pmt` id: it already exists and is already visible in the methods list (section 2) at `setup_pending`, though it is not chargeable yet. A `payment_method.attached` event fires at this moment, carrying `status: 'setup_pending'`. The console redirects the customer to `checkoutLink` (a full redirect off the console, not an iframe, since this is Nomba's own hosted page), then either polls `GET /v1/payment-methods/:reference` or listens for the `payment_method.attached` and `payment_method.updated` events until `status` flips to `active` with `brand`, `last4`, `expMonth`, and `expYear` populated. This refines the more blunt framing that "the id is not returned": a reference is returned immediately and is usable right away, it is only the **capture** that is asynchronous, confirmed by the webhook-driven `captureCardToken` (`packages/sara/src/payment-methods/capture.ts`), never assumed from the synchronous reply.

**Money.** `amountInKobo` is a charge boundary: Nomba's checkout-order endpoint takes a naira decimal string (`koboToNombaAmount`), so the merchant-entered naira amount is pinned to kobo before it ever leaves the console, per the 100x risk noted in doc 02 section 1.2.

**Test mode.** On a test deployment, `/v1/test/payment-methods` can mint an already-`active` method instantly with no hosted checkout at all, covered fully in doc 04. This screen, the hosted-checkout flow, is the only path on live.

**States.**

- **Loading:** the Add card button shows a spinner while `POST /v1/payment-methods/setup` is in flight; on success the browser leaves the console for `checkoutLink`.
- **Pending:** back in the console, the new row renders at `setup_pending` with a "Waiting for the customer to complete checkout" note and a manual "Check status" refresh alongside passive listening for the webhook.
- **Empty:** not applicable; this is a create action, not a list.
- **Error:** validation errors render inline on `customerRef`, `amountInKobo`, or `callbackUrl` from `error.fields`. A Nomba-side failure is not surfaced as `NOMBA_REQUEST_FAILED`: that code is not in `PUBLIC_ERROR_CODES`, so the wire collapses it and its hint to `SYSTEM_INTERNAL_ERROR`, and the console renders that generic internal error with `meta.requestId` to report, plus a retry. A method that never leaves `setup_pending` (the customer abandoned checkout) can be removed (section 6); `removePaymentMethod` is idempotent regardless of status, so clearing an abandoned setup is always safe.

**Wireframe (Phase A).**

```
┌ Add a card ────────────────────────────────────────────────────────────┐
│ Customer: Ada Obi (ada@shop.io)                                         │
│ Validation charge (₦) [ 50 ]   Redirects to: [ https://acme.co/return ] │
│                                            [ Cancel ]  [ Continue → ]   │
│ On confirm, we send you to Nomba's hosted page. We never see the card. │
└──────────────────────────────────────────────────────────────────────────┘

┌ nbo…pmt · card ─────────────────────────────────────  ●Setup pending  ┐
│ Waiting for the customer to complete checkout.                         │
│                                          [ Check status ]  [ Remove ]  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Payments and rails: issue a virtual account

**Purpose.** Start the transfer rail: a dedicated account number the customer pushes funds into. There is no async capture step, no token, and no OTP.

**Endpoint.** `POST /v1/payment-methods/virtual-account`, scope `payment_methods:write`, Idempotency-Key optional and sent by the console. Body `issueVirtualAccountBody`: `customerRef`, `expectedAmount` (optional, positive integer kobo, a hint to Nomba rather than an enforced ceiling), `expiryDate` (optional).

**Response.** `VirtualAccountResponseData`, status 201: `domain` (`virtual_account`), `reference`, `bankName`, `accountNumber`, `accountName`, `accountRef`.

**The mechanic.** `issueVirtualAccount` (`packages/sara/src/payment-methods/attach.ts`) mints the `reference` up front and inserts the row **immediately at `active`**, `kind: 'virtual_account'`, unlike card or mandate. There is nothing to poll and nothing to wait for: `accountRef` equals `reference`, and a `payment_method.attached` event fires at `status: 'active'` in the same call. The console renders the four fields returned as pay-in instructions the moment the call succeeds.

**Rendering as pay-in instructions.** A "Send money to this account" card: bank name, account number (copyable), account name, and a plain note: "Your customer sends money here. We match the inbound transfer to the right invoice automatically, to the kobo." This is the honest description of the push rail's reconciliation story, not a promise of instant confirmation: the funding itself arrives later as an inbound `payment_success` event of `type: 'vact_transfer'`, matched by `aliasAccountReference` back to this reference.

**Money.** `expectedAmount`, when supplied, is entered by the merchant in naira and multiplied to kobo before it is sent, the same charge-boundary pin as section 3, since it too crosses into `koboToNombaAmount` at the Nomba boundary.

**States.**

- **Loading:** the Issue account button shows a spinner; the result renders in place on success, no redirect, since this rail has no hosted page.
- **Empty:** not applicable; this is a create action.
- **Error:** validation errors render inline. A Nomba-side failure is not surfaced as `NOMBA_REQUEST_FAILED`: that code is not in `PUBLIC_ERROR_CODES`, so the wire collapses it to `SYSTEM_INTERNAL_ERROR`, and the console renders that generic internal error with `meta.requestId` to report, plus a retry.

**Wireframe (Phase A).**

```
┌ Issue a virtual account ────────────────────────────────────────────────┐
│ Customer: Ada Obi (ada@shop.io)                                          │
│ Expected amount (₦, optional) [ 12000 ]   Expires (optional) [ ]         │
│                                              [ Cancel ]  [ Issue → ]     │
└──────────────────────────────────────────────────────────────────────────┘

┌ nbo…pmt · virtual_account ───────────────────────────────  ●Active    ┐
│ Bank        Providus Bank                                              │
│ Account no. 9876543210                                    [ Copy ]     │
│ Account name  Acme Ltd / Ada Obi                                        │
│ Your customer sends money here. We match the transfer to the right     │
│ invoice automatically, to the kobo.                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Payments and rails: create a mandate (direct debit)

**Purpose.** Start the reliable silent recurring rail. A NIBSS direct-debit mandate authorizes the platform to debit the customer's bank account up to a hard ceiling, once the customer has consented and the mandate has gone active.

**Endpoint.** `POST /v1/mandates`, scope `mandates:write`, **Idempotency-Key required**. Body `createMandateBody`: `customerRef`, `customerAccountNumber`, `bankCode` (the CBN three-digit bank code, for example `058` GTBank, `044` Access, `033` UBA), `customerName`, `customerAccountName`, `customerPhoneNumber`, `customerAddress`, `narration`, `maxAmountInKobo` (positive integer kobo, the hard per-debit ceiling), `frequency` (`variable`, `weekly`, `every_two_weeks`, `monthly`, `every_two_months`, `every_three_months`, `every_four_months`, `every_six_months`, `every_twelve_months`, default `monthly`), `startDate` and `endDate` (optional; sara defaults them to tomorrow and one year out when omitted, since Nomba requires a present-or-future local date-time).

**A form-honesty detail.** A code comment on `createMandateBody` (`packages/core-contracts/src/validations/payment-method.ts`) states plainly: "the docs mark these optional but the mandate create REJECTS without them," for `customerAccountName`, `customerPhoneNumber`, and `customerAddress`. The console form treats all four identity fields, including `customerAccountNumber`, as required, regardless of what any external documentation might imply, because the real endpoint rejects their absence.

**Response.** `MandateSetupResponseData`, status 201: `domain` (`mandate_setup`), `reference`, `mandateRef` (Nomba's own mandate id, not a secret, needed by the console to poll status), `status` (`consent_pending`), `consentInstruction` (the NIBSS ₦50 validation description, for example "Transfer the NIBSS ₦50 validation token from the mandated account to complete authorisation.").

**Poll to active, honestly poll-only.** `GET /v1/mandates/:id`, scope `payment_methods:read`, calls `pollMandateActive` (`packages/sara/src/payment-methods/capture.ts`), which re-queries Nomba's mandate-status endpoint fresh on every call and promotes the row to `active` only when the provider reports `status === 'ACTIVE'` **and** `adviceStatus` includes `ADVICE_SENT`. There is no consent webhook for this rail; the code comment says it plainly: "activation is poll-only." The console polls on an interval while a mandate sits at `consent_pending`, or offers a manual "Check status" button, and never claims `active` from the creation response alone. A background mandate-activation sweep also polls independently, so a merchant who never returns to this screen still sees the method promoted the next time they look.

**Live-gated honesty.** `/v1/direct-debits/*` returns 404 in sandbox (a T0 sandbox finding). The console presents mandate creation as the reliable silent rail and renders `consent_pending` as a real, honest interim state, never as a stand-in for `active`. A full create-to-debit round trip needs live keys and a real bank account to prove.

**Money.** `maxAmountInKobo` is entered by the merchant in naira and multiplied to kobo, the hard ceiling a later charge cannot exceed; exceeding it returns `MANDATE_MAX_AMOUNT_EXCEEDED`.

**Errors and gating.** `MANDATE_CONSENT_PENDING` (a charge attempted before consent completes), `MANDATE_NOT_ACTIVE` (a charge attempted after consent but before the poll or sweep confirms `active`), `MANDATE_MAX_AMOUNT_EXCEEDED`, and `PAYMENT_METHOD_KIND_MISMATCH` (this route rejects a reference whose `kind` is not `mandate`, confirmed in `pollMandateActive`).

**Wireframe (Phase A).**

```
┌ Create a mandate ────────────────────────────────────────────────────────┐
│ Customer: Ada Obi (ada@shop.io)                                           │
│ Account number [ 0123456789 ]   Bank [ 058 GTBank ▾ ]                     │
│ Account name   [ Ada Obi     ]   Phone [ +234 80… ]                       │
│ Address        [ 12 Marina Rd, Lagos                       ]              │
│ Max per debit (₦) [ 15000 ]   Frequency [ Monthly ▾ ]                     │
│                                                [ Cancel ]  [ Create → ]    │
└────────────────────────────────────────────────────────────────────────────┘

┌ nbo…pmt · mandate ──────────────────────────────────────  ●Consent pending ┐
│ Transfer the NIBSS ₦50 validation token from the mandated account to      │
│ complete authorisation.                                                    │
│                                            [ Check status ]                │
│ Direct debit is live-gated: full activation needs a live account.          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Payments and rails: set default and remove

**Purpose.** Manage a method after it exists: promote one to the customer's default, or retire one.

**Set default.** `POST /v1/payment-methods/:id/default`, scope `payment_methods:write`, Idempotency-Key optional and sent by the console, empty body. `setDefaultPaymentMethod` (`packages/sara/src/payment-methods/queries.ts`) runs in one transaction: it clears the customer's existing default for the current environment, then sets this one, so the partial-unique constraint on `(customer, environment)` where `isDefault` is true is never violated. A `payment_method.updated` event fires with `isDefault: true`.

- **Console-side gating, not a server rule.** (verify: `setDefaultPaymentMethod` does not itself check `status` or `kind` before defaulting a method.) The console restricts the action to `active` methods in its own UI, because defaulting a `setup_pending`, `consent_pending`, `removed`, or `expired` method would silently break the next charge attempt with no server-side guard against it. The console also warns, rather than blocks, before a merchant sets a `virtual_account` as default on a subscription using `charge_automatically`, since a push rail cannot itself be pulled.

**Remove.** `DELETE /v1/payment-methods/:id`, scope `payment_methods:write`, Idempotency-Key optional and sent by the console. `removePaymentMethod` (`packages/sara/src/payment-methods/remove.ts`) is idempotent: calling it on an already-`removed` method returns the same row with no further effect. For a card with a captured token, the tokenized card is deleted at Nomba first, best-effort and non-fatal (a provider-side 404 on an already-gone token still completes the local removal), and only then is the row marked `removed` and un-defaulted locally.

- **Removing the current default.** (verify: no error code blocks removing a customer's current default method.) The console shows a confirmation naming the consequence plainly: "This is the default method. Set a new default before this customer's next bill is due, or automatic collection may fail." rather than silently allowing a subscription to lose its collection path.

**Errors and gating, shared by both actions.** `PAYMENT_METHOD_NOT_FOUND`, `PAYMENT_METHOD_NOT_ACTIVE`, `PAYMENT_METHOD_KIND_MISMATCH`, `MANDATE_NOT_ACTIVE`.

**Wireframe (Phase A, row actions).**

```
┌ nbo…pmt · card · Visa •••• 4242 ─────────────────────────  ●Active   [ ▾ ] ┐
│                                            ┌──────────────────────────┐    │
│                                            │ Set as default            │    │
│                                            │ Remove                    │    │
│                                            └──────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

┌ Remove this payment method? ──────────────────────────────────────────┐
│ This is the default method. Set a new default before this customer's   │
│ next bill is due, or automatic collection may fail.                    │
│                                              [ Cancel ]  [ Remove ]     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Settlements: list and detail

**Purpose.** See every collection split into the tenant's share and the platform fee. There is no create action; a settlement is recorded automatically the moment a collection is verified paid (`recordSettlement`, `packages/sara/src/settlement/record.ts`), the same engine-issued posture invoices hold on doc 02.

**Endpoint (list).** `GET /v1/settlements` (paginated), scope `settlements:read`. Query from `listSettlementsQuery`: `limit`, `cursor`, `status` (optional, one of `pending`, `settled`, `reconciled`, `failed`, `refunded`). There is no `customerId` or `invoiceId` filter on this list; it is status-only plus cursor.

**Endpoint (detail).** `GET /v1/settlements/:id`, scope `settlements:read`.

**Data (from `SettlementResponseData`).** `domain` (`settlement`), `id` (`nbo…stl`), `invoiceReference` (nullable), `subAccountRef`, `splitReference` (nullable), `merchantTxRef`, `grossInKobo`, `platformFeeInKobo`, `netToTenantInKobo`, `status`, `createdAt`.

**What each status means, honestly.** `recordSettlement` always inserts a new row directly at `settled`; no code path observed in this reading creates a settlement at `pending` (the enum reserves the value; the console does not rely on ever seeing it from this build). `refunded` is set only once cumulative refunds on the settlement reach `netToTenantInKobo` (section 9). `reconciled` and `failed` are produced by the nightly reconcile cron feeding the pure diff function `reconcileSettlements`; the console renders whichever `status` the API returns without inferring or recomputing it (section 1.9).

**Money, rendered visually.** Every row and the detail header show the `gross = platformFee + net` split as three figures side by side (or a small stacked bar), all through the naira-by-100 helper. This is a render of an invariant the server has already enforced (`assertSplitBalances`, section 1.5); the console never checks that the three numbers add up, it only presents them so the split is legible at a glance.

**Wireframe (Phase A, list).**

```
┌ Settlements ───────────────────────────────────────────────────────────┐
│ Status: [All] [Settled] [Reconciled] [Refunded] [Failed] [Pending]      │
│ ┌──────────┬──────────┬──────────┬──────────┬───────────┬────────────┐ │
│ │ Settlement│ Invoice   │ Gross     │ Fee       │ Net        │ Status     │ │
│ ├──────────┼──────────┼──────────┼──────────┼───────────┼────────────┤ │
│ │ nbo…stl  │ nbo…inv  │ ₦2,500.00│ ₦75.00   │ ₦2,425.00 │ ●Reconciled│ │
│ │ nbo…stl  │ nbo…inv  │ ₦2,000.00│ ₦60.00   │ ₦1,940.00 │ ●Settled   │ │
│ │ nbo…stl  │ nbo…inv  │ ₦900.00  │ ₦27.00   │ ₦873.00   │ ●Refunded  │ │
│ └──────────┴──────────┴──────────┴──────────┴───────────┴────────────┘ │
│                                                          [ Load more ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No settlements yet. A settlement appears here the moment your first invoice is collected." No create action.
- **Error:** `SETTLEMENT_NOT_FOUND` renders the environment-mismatch hint on a stale detail link. Reads use the retry panel.

---

## 8. Escrow and withdrawal

**Purpose.** Show a tenant its own withdrawable balance under the rolling escrow lock (section 1.6), and let it withdraw to its bank. This is the one console rule that already existed in writing (`escrow-withdrawal-lock.md`) before this doc, and it governs everything on this screen.

**Endpoint (read).** `GET /v1/settlements/escrow`, scope `settlements:read`, no query params. Returns `EscrowResponseData`: `domain` (`escrow`), `lockedInKobo`, `since`, `balanceInKobo`, `minWithdrawableInKobo`, `availableInKobo`.

**The rule, restated once more for this screen exactly.**

```
availableInKobo = max(0, balanceInKobo − lockedInKobo − minWithdrawableInKobo)
```

`balanceInKobo` is apps/api's own ledger-derived `tenant_settlement` balance, not a live per-request Nomba fetch (section 1.6). `lockedInKobo` is the rolling sum of `netToTenantInKobo` across this tenant's `settled` and `reconciled` settlements from the last three hours, and it shrinks on its own as those settlements age past the window; the screen shows `since` as the window's start so a merchant can see exactly which money is still held and when it frees. `minWithdrawableInKobo` is a floor below which the tenant may not be swept to; it is currently read-only on this screen, with no self-serve field to change it (section 1.6).

**Endpoint (withdraw).** `POST /v1/settlements/payout`, scope `settlements:write`, **Idempotency-Key required**. Body `createPayoutBody`: `amountInKobo` (positive integer kobo), `bankCode`, `accountNumber`. There is no `bankName` or account-holder-name field to send; `payoutToTenant` (`packages/sara/src/settlement/payout.ts`) resolves the beneficiary name itself via a live bank lookup and returns it as `resolvedAccountName`, so the console shows the resolved name back to the merchant for a last-look confirmation before the funds move, rather than trusting free-text account-name entry.

**Response.** `PayoutResponseData`, status 201: `domain` implicit via `PayoutResponseData` shape, `id` (`nbo…pay`), `subAccountRef`, `amountInKobo`, `bankCode`, `accountNumber`, `resolvedAccountName`, `status` (`pending`, `ledger_posted`, `succeeded`, `failed`), `providerReference`, `failureReason`, `createdAt`.

**`PayoutStatus`, rendered honestly.** The withdrawal re-derives `available` inside the same database transaction as the write, under a `FOR UPDATE` lock on the tenant's settlement account, so two concurrent withdrawals cannot both succeed against the same headroom. The ledger debit posts first, unconditionally: the moment a payout is accepted, `status` is at least `ledger_posted`, meaning funds have left the tenant's ledger balance on our books. Whether they have reached a real bank account depends entirely on `NOMBA_PAYOUT_ENABLED`:

- **Flag off:** the payout stays `ledger_posted` forever. This is the honest floor of what this build can currently prove: money left the tenant's balance, on a schedule the tenant controls, and the console says so plainly, never rendering `ledger_posted` as "sent."
- **Flag on:** the (unconfirmed-live) `bankTransfer` call fires. On success, `status` becomes `succeeded` with a `providerReference`. On failure, a compensating reversal credits the tenant's balance back in the same ledger, and `status` becomes `failed` with a concrete `failureReason` (for example `bank_lookup_failed` or `bank_transfer_failed`); the tenant's funds are never stranded mid-transfer.

The console never presents `ledger_posted` and `succeeded` with the same visual weight: `succeeded` alone earns the accent/success treatment; `ledger_posted` reads as a distinct, quieter "processing" state with a one-line explanation of what has and has not happened yet.

**`ESCROW_LOCKED` versus `PAYOUT_EXCEEDS_AVAILABLE`, two different reasons, two different messages.** Both are raised inside the same transaction in `payoutToTenant`, and the console renders them as genuinely different situations, not interchangeable "amount too high" errors:

- **`ESCROW_LOCKED`** fires specifically when the requested amount would dip the balance below `lockedInKobo`, meaning the shortfall is the rolling refund-buffer window itself. The console's message: "Part of this balance is still in the 3-hour escrow window and is not withdrawable yet. It clears as settlements age past the window." with the countdown to `since + 3h`.
- **`PAYOUT_EXCEEDS_AVAILABLE`** fires for every other case where the amount is larger than what remains after the lock and the minimum buffer. The console's message: "This is more than the available balance. Reduce the amount, or wait for more settlements to land." with `availableInKobo` shown alongside the attempted amount.

**Clamping versus rejecting on the console side.** The withdrawal form pre-fills the amount field with `availableInKobo` and disables submission above it client-side, so the common case never reaches the server error at all; the server-side guard exists for the case the client-side number is stale (a settlement landed between page load and submit).

**Wireframe (Phase A).**

```
┌ Escrow and withdrawal ───────────────────────────────────────────────────┐
│ Balance ₦82,000.00        Locked (3h) ₦12,000.00                        │
│ Min withdrawable ₦1,000.00     Available ₦69,000.00                     │
│ Locked since 2026-07-03 14:10 (refund buffer, clears as settlements age) │
│                                                    [ Withdraw to bank ]   │
└────────────────────────────────────────────────────────────────────────────┘

┌ Withdraw to bank ────────────────────────────────────────────────────────┐
│ Amount (₦)  [ 69000 ]  (max available: ₦69,000.00)                       │
│ Bank        [ 058 GTBank ▾ ]   Account [ 0123456789 ]                    │
│ Resolves to: Acme Ltd                                                     │
│                                                [ Cancel ]  [ Withdraw ]   │
└────────────────────────────────────────────────────────────────────────────┘

┌ nbo…pay · payout ───────────────────────────────────  ●Ledger posted   ┐
│ ₦69,000.00 has left your available balance. The bank transfer step is   │
│ not yet enabled for this account; funds are recorded, not yet sent.     │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** the escrow tiles show skeletons; the layout does not reflow on load.
- **Empty:** a tenant with no settlements yet shows all four figures as ₦0.00, not a dash, with a note that settlements appear after the first collection.
- **Error:** `ESCROW_LOCKED` and `PAYOUT_EXCEEDS_AVAILABLE` render per above. `SETTLEMENT_SUBACCOUNT_NOT_FOUND` (the tenant was never onboarded to a Nomba sub-account) renders the "connect your Nomba account to settle" banner from doc 01, with a link to Settings, Nomba connection. A payout that fails on the bank lookup before any transfer is attempted does not reach the console as `SETTLEMENT_PAYOUT_FAILED`: that code is not in `PUBLIC_ERROR_CODES`, so it collapses to `SYSTEM_INTERNAL_ERROR`, and the console renders the generic internal-error state with `meta.requestId` to report, plus a retry.

---

## 9. Refunds

**Purpose.** Return the tenant's share of a settlement to the end customer, in whole or in repeated partials, up to the tenant's net. The platform fee is never part of a refund (section 1.7).

**Endpoint.** `POST /v1/settlements/:id/refund`, scope `settlements:write`, **Idempotency-Key required**. Body `refundSettlementBody`: `amountInKobo` (optional, positive integer kobo; omitted, it defaults to the full remaining refundable amount).

**Response.** `RefundResponseData`, status 201: `domain` (`refund`), `id` (`nbo…ref`), `settlementReference`, `subAccountRef`, `amountInKobo`, `status` (`pending`, `ledger_only`, `succeeded`, `failed`), `providerReference`, `createdAt`.

**The mechanic, confirmed from `packages/sara/src/settlement/refund.ts`.** The settlement row is locked `FOR UPDATE` for the duration of the transaction, so two concurrent refund requests on the same settlement serialize and cannot together over-refund it. `remaining = netToTenantInKobo − sum(previous ledger_only/succeeded/pending refunds)`; the requested `amountKobo` (or the full `remaining` when omitted) is checked against that figure before anything is written. The reversal debits only the `tenant_settlement` leg and credits `platform_revenue`; `platform_fees` is never touched, so the fee stays with the platform exactly as designed.

**Repeated partials.** A settlement can be refunded more than once, in pieces, as long as the running total never exceeds `netToTenantInKobo`. The settlement's own `status` flips to `refunded` only once the cumulative refunded amount reaches that ceiling; until then it keeps its prior `status` (typically `settled` or `reconciled`) alongside a growing list of refunds. The refund screen on a settlement's detail (section 7) shows this running total against `netToTenantInKobo` so a merchant always sees how much of the tenant's share remains refundable.

**`RefundStatus`, rendered honestly.** Every refund created by this build starts, and today stays, at `ledger_only`: the books have moved, `tenant_settlement` is debited and `platform_revenue` is credited, but the real bank-side money return to the end customer is a separate, provider-guarded step this build does not yet perform (`providerReference` stays null). The console never renders `ledger_only` with the same visual weight as a real "money returned" state; it reads as a distinct, muted status with a one-line note: "Recorded on our books. The money has not been sent back to the customer yet."

**Errors and gating.** `REFUND_ALREADY_REFUNDED` fires when `remaining <= 0`, meaning nothing is left to refund; the console disables the refund action entirely once a settlement's refunds sum to its net, rather than letting a merchant discover this only after submitting. `REFUND_AMOUNT_EXCEEDS_NET` fires when the requested amount is positive but larger than what remains; the form pre-fills and caps the amount field at `remaining` so this, like the payout screen, is a server-side backstop for a stale client figure rather than the common path. `SETTLEMENT_NOT_FOUND` on a stale reference reloads the settlement detail.

**Wireframe (Phase A).**

```
┌ nbo…stl · Refund ────────────────────────────────────────────────────────┐
│ Net to tenant ₦2,425.00   Already refunded ₦900.00   Remaining ₦1,525.00 │
│ ┌ Refunds ─────────────────────────────────────────────────────────────┐ │
│ │ nbo…ref  ₦500.00   ledger_only   2 Jun                                 │ │
│ │ nbo…ref  ₦400.00   ledger_only   6 Jun                                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                        [ Issue refund ]   │
└────────────────────────────────────────────────────────────────────────────┘

┌ Issue a refund ──────────────────────────────────────────────────────────┐
│ Amount (₦) [ 1525 ]  (max remaining: ₦1,525.00)                          │
│ Recorded on our books. The money has not been sent back to the customer │
│ yet.                                          [ Cancel ]  [ Refund ]     │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton refund rows.
- **Empty:** "No refunds on this settlement." with Issue refund enabled while `remaining` is positive.
- **Error:** `REFUND_ALREADY_REFUNDED` disables the action entirely, rendered as "Fully refunded" in place of the button. `REFUND_AMOUNT_EXCEEDS_NET` renders inline on the amount field.

---

## 10. Coupons: list, detail, create, and edit

**Purpose.** Author reusable discount definitions. A coupon is a template; it discounts nothing on its own until it is applied to a customer or a subscription as a discount (section 11). Coupons are the only top-level CRUD on this doc; discounts and credits are applications and balances surfaced elsewhere.

**Endpoints.**

- `GET /v1/coupons` (paginated), scope `coupons:read`. Query from `listCouponQuery`: `limit`, `cursor` only; there is no other server-side filter on this list.
- `GET /v1/coupons/:id`, scope `coupons:read`.
- `POST /v1/coupons`, scope `coupons:write`, Idempotency-Key optional and sent by the console. Body `createCouponBody`: `code` (1 to 64 chars), `amountOffInKobo` (positive integer kobo) exclusive-or `percentOff` (1 to 100), `duration` (`once`, `repeating`, `forever`), `durationInCycles` (required when `duration` is `repeating`, forbidden otherwise by the form's own structure), `redeemBy` (optional date), `maxRedemptions` (optional positive integer), `metadata` (optional).
- `PATCH /v1/coupons/:id`, scope `coupons:write`, Idempotency-Key optional and sent by the console. Body `updateCouponBody`: `redeemBy`, `maxRedemptions`, `metadata`, at least one. **`code`, `amountOffInKobo`, `percentOff`, `duration`, and `durationInCycles` are absent from this body and cannot be edited after create.** The console's edit form offers only `redeemBy`, `maxRedemptions`, and `metadata`; a merchant who wants a different discount value or duration creates a new coupon.
- There is intentionally **no delete route**. A coupon retires by exhausting `maxRedemptions` or passing `redeemBy`, never by removal.

**Data (from `CouponResponseData`).** `domain` (`coupon`), `id` (`nbo…cpn`), `code`, `duration`, `amountOffInKobo` (nullable), `percentOff` (nullable), `durationInCycles` (nullable), `redeemBy` (nullable), `maxRedemptions` (nullable), `timesRedeemed`, `environment`, `createdAt`.

**The create form mirrors the wire's own validation exactly.** `createCouponBody` enforces, by `zod` refine, that exactly one of `amountOffInKobo` or `percentOff` is set, and that `durationInCycles` is present precisely when `duration` is `repeating` (section 1.8). The create form offers a segmented "Amount off" versus "Percent off" choice, where picking one clears the other value entirely rather than leaving it as a hidden stale field, and reveals a required "for how many cycles" input only when `duration` is set to `repeating`. Because the form is structured this way, an invalid combination cannot be assembled in the console in the first place; `COUPON_INVALID_DEFINITION` remains the server-side backstop should a request bypass the form.

**Money.** An amount-off coupon renders and accepts its value through the naira-by-100 helper, exactly like every other money field. A percent-off coupon shows a plain integer percentage; the two are never shown together, and a coupon detail with `percentOff` set never has a `₦` sign attached anywhere near it.

**`timesRedeemed` is read-only.** It is computed server-side and never appears in either request body. Both the list and the detail show it directly beside `maxRedemptions`, so a merchant watches a coupon approach its ceiling without needing to compute anything.

**Wireframe (Phase A, list).**

```
┌ Coupons ───────────────────────────────────────────────────  [ + New coupon ] ┐
│ ┌──────────┬──────────┬───────────┬───────────┬────────────┬──────────────┐ │
│ │ Coupon    │ Code      │ Off        │ Duration   │ Redeemed    │ Max           │ │
│ ├──────────┼──────────┼───────────┼───────────┼────────────┼──────────────┤ │
│ │ nbo…cpn  │ WELCOME10│ 10%        │ repeating  │ 42          │ 100           │ │
│ │ nbo…cpn  │ LAUNCH500│ ₦500.00    │ once       │ 12          │ none          │ │
│ └──────────┴──────────┴───────────┴───────────┴────────────┴──────────────┘ │
│                                                              [ Load more ]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Wireframe (Phase A, create).**

```
┌ New coupon ──────────────────────────────────────────────────────────────┐
│ Code   [ WELCOME10                    ]                                   │
│ Off:   (•) Amount off (₦) [ 500 ]     ( ) Percent off [    ]               │
│ Duration: ( ) Once   (•) Repeating   ( ) Forever                          │
│           For how many cycles [ 3 ]     (shown only when Repeating)       │
│ Redeem by (optional) [ ]     Max redemptions (optional) [ 100 ]           │
│                                            [ Cancel ]  [ Create coupon ]   │
└────────────────────────────────────────────────────────────────────────────┘
```

**States.**

- **Loading:** skeleton rows.
- **Empty:** "No coupons yet. Create a coupon to offer a discount your customers and subscriptions can redeem." with New coupon.
- **Error:** `COUPON_INVALID_DEFINITION` renders inline on the amount or cycles field, though the form's own structure keeps it rare. Reads use the retry panel. `COUPON_NOT_FOUND` on a stale detail link renders the environment-mismatch hint.

---

## 11. Discounts: the application, not a top-level list

**Purpose.** State the relationship plainly, since it is easy to design wrong: a discount is not authored on this doc. It is the record of one coupon applied to one specific target, a customer or a subscription, and it is created and removed only from that target's own detail screen, already fully specified in doc 02.

**Where the actions actually live.** Apply and remove a discount on a customer at `POST` and `DELETE /v1/customers/:id/discount` (doc 02, section 9). Apply and remove a discount on a subscription at `POST` and `DELETE /v1/subscriptions/:id/discount` (doc 02, section 4.6). Both accept a `coupon` field that is either the coupon's `nbo…cpn` reference or its tenant-facing `code` (`applyDiscountBody`, `packages/core-contracts/src/validations/discount.ts`); neither endpoint lives under `/v1/coupons`, and this doc's coupons screen (section 10) never shows an "Apply" action of its own.

**One active discount per target, enforced in the schema, not only in the application layer.** `packages/core-db/src/schema/discounts.ts` carries a `CHECK` constraint that exactly one of `customerId` or `subscriptionId` is set on any discount row, never both and never neither, plus two partial unique indexes, one on `subscriptionId` and one on `customerId`, each scoped to `status = 'active'`. A second `active` discount on the same target is a database-level impossibility, not merely an application check; `COUPON_ALREADY_APPLIED` is the friendly surface of that constraint.

**Data (from `DiscountResponseData`, for reference).** `domain` (`discount`), `id` (`nbo…dsc`), `couponId`, `customerId` (nullable), `subscriptionId` (nullable, mutually exclusive with `customerId`), `status` (`active`, `ended`), `cyclesRemaining` (nullable), `startAt`, `endAt` (nullable), `environment`, `createdAt`.

**A coupon's future eligibility does not reach back into an already-active discount.** `redeemBy` and `maxRedemptions` gate new applications only. Once a discount exists on a target, its own `cyclesRemaining` and `endAt` govern its lifetime independently; a coupon that later expires or exhausts its redemption ceiling has no effect on discounts it already produced. The console never implies that an expiring coupon threatens a customer's already-running discount.

**Where this appears in the console.** Solely as the Discount panel on customer detail (doc 02, section 7) and the discount line in the subscription detail header and actions menu (doc 02, section 3 and section 4.6). There is no `/discounts` area in the left nav (doc 01, section 1.2).

---

## 12. Credits: on customer detail, not a top-level list

**Purpose.** State the relationship plainly, for the same reason as section 11: account credit is not authored here. It lives entirely on customer detail (doc 02, section 8), which already gives the full endpoint, DTO, and action treatment. This section exists only to place credits correctly against the money screens in this doc.

**Credits are not coupons.** A `CreditGrantResponseData` (`packages/core-contracts/src/types/credit.ts`) carries its own `source`: `downgrade_proration`, `manual`, `goodwill`, or `coupon`. Three of those four sources are produced without any coupon in sight: a `manual` or `goodwill` grant is created directly by a merchant on customer detail (`POST /v1/customers/:id/credit`, Idempotency-Key required), and a `downgrade_proration` grant is minted automatically by the proration engine whenever a subscription moves to a cheaper price mid-cycle, banked as credit rather than refunded to the rail. Only the fourth source, `coupon`, connects back to this doc, and even then indirectly: a coupon does not itself grant credit, it produces a discount (section 11); a `coupon`-sourced credit grant is a distinct mechanism this build's coupon and discount code does not itself emit, so this source value exists in the type without a producing call site confirmed in this reading. (verify.)

**The balance is a ledger read, oldest grants applied first.** `GET /v1/customers/:id/credit` returns `CreditBalanceResponseData`: `balanceInKobo`, an O(1) read from the `customer_credit:{ref}` ledger account, and `grants[]`, each carrying `amountInKobo` against `remainingInKobo` so a merchant can see how much of each individual grant is left. Grants apply to invoices oldest-first, and a grant's unconsumed remainder can be voided (`DELETE /v1/customers/:id/credit/:grantId`, Idempotency-Key required); an already-consumed grant cannot be voided retroactively.

**Where this appears in the console.** Solely as the Credit panel on customer detail (doc 02, section 8). There is no `/credits` area in the left nav, and no credit screen exists anywhere under Money in the nav map (doc 01, section 1.2), since credit is a property of a customer, not an independent ledger a merchant browses across the whole tenant.

---

## 13. Phase A and Phase B done criteria, per screen group

Each screen group ships through the two-phase method (doc 02, section 1.6). The done criteria below are the gate.

**Payments and rails (sections 2 to 6).**

- Phase A done: the methods list, add-card, issue-virtual-account, create-mandate, and the set-default and remove flows all exist in `.pen`, showing the five-status badge set mapped per section 2, the honest `setup_pending` and `consent_pending` in-progress treatments, the card and mandate identity forms with every required field marked required (including the four the docs elsewhere imply are optional), and the loading, empty, and error states.
- Phase B done: the list filters bind to `customerRef`; add-card redirects to a real `checkoutLink` and either polls `GET /v1/payment-methods/:id` or listens for `payment_method.attached` and `payment_method.updated`, never assuming capture from the synchronous reply; issue-virtual-account renders real pay-in instructions with no polling; create-mandate polls `GET /v1/mandates/:id` and never claims `active` before the poll or sweep confirms it; set-default and remove hit their real endpoints with the correct idempotency posture; `MANDATE_NOT_ACTIVE`, `MANDATE_CONSENT_PENDING`, `MANDATE_MAX_AMOUNT_EXCEEDED`, and `PAYMENT_METHOD_KIND_MISMATCH` all render their real hints.

**Settlements, escrow, and payouts (sections 7 and 8).**

- Phase A done: the settlements list and detail, and the escrow and withdrawal screen, exist in `.pen`, showing the gross-equals-fee-plus-net split visually, the four escrow figures with the `since` countdown, the withdrawal form pre-filled and capped at `availableInKobo`, and the distinct `ESCROW_LOCKED` versus `PAYOUT_EXCEEDS_AVAILABLE` messages.
- Phase B done: settlements list filters bind to `status` only; `GET /v1/settlements/escrow` renders the ledger-derived balance, not a live Nomba fetch; `POST /v1/settlements/payout` carries a required `Idempotency-Key`; `PayoutStatus` renders `ledger_posted` and `succeeded` with visually distinct weight, never conflated; `resolvedAccountName` is shown for confirmation before the withdrawal completes.

**Refunds (section 9).**

- Phase A done: the refund panel on settlement detail exists in `.pen`, showing the running refunded-versus-remaining total, the amount field capped at the remaining refundable balance, and `ledger_only` rendered as a distinct, muted status from a real "money returned" state.
- Phase B done: `POST /v1/settlements/:id/refund` carries a required `Idempotency-Key`; omitting `amountInKobo` refunds the full remaining balance; `REFUND_ALREADY_REFUNDED` disables the action entirely rather than surfacing only on submit; `REFUND_AMOUNT_EXCEEDS_NET` renders inline.

**Coupons, discounts, and credits (sections 10 to 12).**

- Phase A done: the coupons list, detail, and create form exist in `.pen`, showing the segmented amount-off-versus-percent-off choice, the conditional cycles field, `timesRedeemed` beside `maxRedemptions`, and no delete action anywhere. The discount and credit cross-references confirm no separate top-level screens were built for either.
- Phase B done: `createCouponBody`'s exclusive-or and repeating-duration refines are mirrored exactly by the form's own structure; `PATCH /v1/coupons/:id` only ever sends `redeemBy`, `maxRedemptions`, or `metadata`; `COUPON_INVALID_DEFINITION`, `COUPON_EXPIRED`, and `COUPON_MAX_REDEMPTIONS_REACHED` render their real hints wherever a coupon is applied (doc 02, sections 4.6 and 9), not on this doc's own coupon-creation form, where they should rarely fire at all.

Proceed to doc 04.

