# Nomba Integration Reference — Nomba One

> **Purpose.** This is the authoritative, project-scoped reference for how Nomba One talks to Nomba. It is a deliberately narrow slice of Nomba's full API — only the surface this project uses — plus the conventions and failure modes that matter. The general Nomba docs remain the source of truth for anything not covered here; when this file and the general docs describe the same thing, follow the **conventions** in this file and confirm exact **field names** against a live sandbox response.
>
> Items marked **⚠ VERIFY** are not yet confirmed against live behaviour — do not hard-code an assumption there; check the actual sandbox response first.

> **Reading the annotations (added 2026-06-29).** This document was provided by the Nomba team and is treated as authoritative; it may describe a **newer or different** surface than Nomba's public developer docs (which can be stale). It was cross-checked against the public live docs (`https://developer.nomba.com`). Two kinds of notes were added without altering the team's original text:
>
> - **✅ Verified** — an open `⚠ VERIFY` question that the live docs resolved. Written in as the working answer; any residual unknown is noted for sandbox.
> - **⚠ Worth checking — simulate to confirm** — a place where the public live docs **diverge** from this team-provided doc (endpoint, field name, unit, event name, signature scheme, etc.). The team's value is **kept as-is**; the divergence is recorded as a *probability to confirm in sandbox*, not a correction to apply blindly. Until a sandbox call decides, treat the value as unsettled.
>
> The single highest-stakes divergence is the **money unit** (see §2.1): the public docs show **major-unit naira**, this doc says **kobo**. A wrong guess here is a 100× error — confirm it first, before any real charge.

---

## 1. What this project uses Nomba for

Nomba One is a managed recurring-billing layer. **Nomba is only the money-movement layer.** All subscription logic — plans, scheduling, invoices, proration, dunning, state transitions — lives in our service, not in Nomba.

**One subscription object, three payment rails:**

| Rail | Mechanism | Direction | Role |
|---|---|---|---|
| Card | Tokenized cards (`/tokenized-card/charge`) | Pull | Default renewal attempt for card-holders |
| Direct debit | Bank-account mandates (`/mandates/{id}/debit`) | Pull | Account-based recurring for customers who consent to a standing debit but keep no card on file |
| Transfer | Dedicated virtual accounts (`/accounts/virtual`) | Push | Fallback, and the path where there is neither a card nor mandate consent |

A subscription does not care which rail it settles on. Rail selection, consent capture, and fallback are our concern; the charge/credit/debit primitives below are Nomba's.

> **⚠ Worth checking — simulate to confirm.** The public live docs name these rail endpoints differently: card recurring charge as `POST /v1/checkout/tokenized-card-payment` (not `/tokenized-card/charge`; see §4.3), mandate debit as `POST /v1/direct-debits/debit-mandate` (not `/mandates/{id}/debit`; see §5), and the virtual-account family under `/v1/accounts/virtual` (see §4.4). Treat the per-rail sections below as the place each path is reconciled.

**Settlement (multi-tenant):** each downstream team maps to a Nomba **sub-account** (own balance, own virtual accounts). Payouts to a team's external bank go through **Transfers**. This is plumbing, not a headline feature — keep it correct, keep it quiet.

> **⚠ Worth checking — simulate to confirm.** In the public live docs there is no `/accounts/sub-accounts` resource (the tenant-attribution primitive there is "virtual accounts", `/v1/accounts/virtual`), and there is **no per-sub-account balance endpoint** — balance is parent-account-only (`GET /v1/accounts/balance`), with per-tenant balance derived from transaction attribution. The public docs also support an **inline split at checkout** (`splitRequest`, see §4.6), which would let funds settle into a tenant sub-account at collection time rather than collect-then-payout. Confirm which model the sandbox supports.

---

## 2. Non-negotiable conventions

These apply to **every** Nomba call in the codebase. Treat them as invariants, not suggestions.

1. **Money is in kobo (integer).** ₦1.00 = 100 kobo. Multiply naira by 100 before sending. Never send a decimal. Store money as integer kobo end-to-end — no floats anywhere in the money path.

   > **✅ Resolved — KOBO confirmed (Nomba team, 2026-06-30).** The Nomba team confirmed directly that amounts are **integer kobo end-to-end**, matching this convention — so there is **no conversion at the Nomba boundary**; kobo flows straight through, in and out. The public docs' naira/decimal examples (`"10000.00"`, `transactionAmount: 120`, `amount_charged: "21.0"`) were stale/misleading on this point; the team confirmation is authoritative. The §J/§C internal-kobo invariant needs no special-casing.

2. **`merchantTxRef` is your idempotency key.** Every external write (token charge, transfer) carries a unique `merchantTxRef` you generate. A retry **reuses the same ref** so Nomba dedupes it instead of double-charging. (Checkout uses `orderReference` for the same purpose.)

   > **⚠ Worth checking — simulate to confirm.** In the public live docs, transfers/payouts do carry `merchantTxRef`, but the **tokenized-card charge** keys on `order.orderReference` (not `merchantTxRef`) — i.e. the card rail may use the `orderReference` style end-to-end. Confirm which field the charge endpoint actually dedupes on.

3. **Verify webhook signatures before trusting anything.** Every inbound webhook is HMAC-SHA256 signed (`nomba-signature` header). Compute and compare over the **raw** request body before parsing. Reject mismatches with 401.

   > **⚠ Worth checking — simulate to confirm.** The `nomba-signature` header and HMAC-SHA256 scheme are confirmed in the public docs — but the public docs compute the HMAC **not over the raw body**. Their samples sign a **colon-joined field string** `event_type:requestId:userId:walletId:transactionId:transactionType:transactionTime:transactionResponseCode:timestamp`, **Base64-encoded**, keyed by the merchant Signature Key (companion headers `nomba-signature-algorithm: HmacSHA256`, `nomba-signature-version`, `nomba-timestamp`). If that is the real scheme, raw-body verification will never match. Confirm the exact signing input + encoding in sandbox before building the inbound verifier. (Returning 401 on mismatch is our implementation choice, not a Nomba requirement.)

4. **Webhooks are at-least-once.** The same event can arrive twice. Store `event.requestId` behind a unique index and reject duplicates. Never apply a balance change twice.

   > **⚠ Worth checking — simulate to confirm.** Confirmed in spirit (public docs recommend idempotency handling and retry with exponential backoff, ~5 attempts). Caveat: `requestId` is confirmed as the payload's top-level id, but the public docs don't *formally* designate it the dedup key (their debug surface references `hookRequestId`/`hooksRequestId` for re-push). Verify a replayed event reuses the same `requestId` before keying the unique index on it.

5. **Reconcile by `merchantTxRef`, never by Nomba's internal IDs.** Internal IDs may rotate on retry; your ref is stable and present on both sides.
6. **Your refs are your primary keys.** Persist `accountRef` / `orderReference` / `merchantTxRef`. Keep Nomba's IDs only as foreign references, never as your PKs.
7. **Secrets live in env / a secret manager.** `clientSecret`, `webhookSecret` — never in source, never in the repo, never in a client bundle.
8. **Cache the access token.** It lasts 60 minutes. Cache it (memory/Redis) and refresh near the 55-minute mark. Do not mint a token per call.

   > **⚠ Worth checking — simulate to confirm.** The public live docs state access tokens expire after **30 minutes** (recommend refreshing ≥5 min early), and the token response carries an absolute `data.expiresAt` (ISO-8601) rather than a fixed minutes value. Prefer refreshing off `expiresAt` with a margin; confirm the real TTL in sandbox rather than hard-coding 55 min.

9. **Resolve names before transfers.** Always `/transfers/bank/lookup` and confirm the returned `accountName` before `/transfers/bank`. Wrong-NUBAN transfers are often unrecoverable.
10. **Handle over- and under-payment on virtual accounts.** Bank rails accept any amount regardless of what you "expected." Your webhook handler is the only place this is caught.

    > **⚠ Worth checking — simulate to confirm.** Per the public live docs this holds **only when no expected amount is set**. If the virtual account is created with an expected amount, it becomes *restrictive*: off-amount payments are rejected/reversed by the bank and **never delivered to your webhook** (so there is nothing to reconcile there). Also note the funding payload exposes the received amount but **no expected-amount field** to compare against. Confirm the restrictive-vs-open behaviour in sandbox (see §4.4).

---

## 3. Environment & authentication

**Base URLs**

| Environment | Base URL |
|---|---|
| Sandbox (development) | `https://sandbox.api.nomba.com/v1` |
| Production (after KYC) | `https://api.nomba.com/v1` |

All development targets sandbox. Sandbox mirrors production behaviour — including webhook signatures and settlement timing — but uses test instruments and isolated funds. Never mix credentials across environments.

> **⚠ Worth checking — simulate to confirm.** The public live docs give the **sandbox host as `https://sandbox.nomba.com`** (not `sandbox.api.nomba.com`), and the sandbox path prefix is **not uniformly `/v1`** (e.g. sandbox checkout under a `/sandbox/checkout/` prefix). Production (`https://api.nomba.com/v1`) matches, but the public docs add that **production access requires IP whitelisting** (up to 3 static IPv4 addresses). Confirm the exact sandbox host + per-endpoint prefixes against a live sandbox call.

**Auth model:** OAuth 2.0 `client_credentials` (server-to-server, no end user present). Exchange `clientId` + `clientSecret` for a short-lived (60-minute) bearer token.

```js
// POST {BASE}/auth/token/issue
const res = await fetch(`${BASE}/auth/token/issue`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "accountId": process.env.NOMBA_ACCOUNT_ID,
  },
  body: JSON.stringify({
    grant_type: "client_credentials",
    client_id: process.env.NOMBA_CLIENT_ID,
    client_secret: process.env.NOMBA_CLIENT_SECRET,
  }),
});
const { data } = await res.json();   // data.access_token
```

`POST /auth/token/refresh` refreshes before expiry.

**Required headers on every authenticated call:**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <access_token>` |
| `accountId` | your Nomba account ID |
| `Content-Type` | `application/json` |

> **✅ Verified (live docs, 2026-06-29).** The auth shape above is corroborated by the public docs: `POST /v1/auth/token/issue` with body `{grant_type:'client_credentials', client_id, client_secret}` and the `accountId` header (the parent account UUID); the token is returned at `data.access_token` (a JWT) alongside `data.refresh_token` and `data.expiresAt`. Refresh is `POST /v1/auth/token/refresh` (`grant_type=refresh_token`); a revoke endpoint also exists (`/v1/auth/token/revoke`). The three required headers are confirmed. (Only the **token TTL** diverges — see convention §2.8.)

---

## 4. Endpoint reference

### 4.1 Sub-accounts — `/accounts/sub-accounts`
Logical accounts under one merchant. Each has its own balance and its own virtual accounts. This is how a tenant's funds stay attributable.

| Method | Path | Use |
|---|---|---|
| POST | `/accounts/sub-accounts` | Create — body `{ accountName, accountRef }` |
| GET | `/accounts/sub-accounts` | List sub-accounts |
| GET | `/accounts/sub-accounts/{id}/balance` | Available balance |

Pass your own stable `accountRef` so you can resolve the sub-account from your DB without storing Nomba IDs as keys.

> **⚠ Worth checking — simulate to confirm.** The public live docs have no `/accounts/sub-accounts` family. The closest primitive is **virtual accounts** (`POST /v1/accounts/virtual`, body `{accountRef (16–64 chars), accountName (8–64 chars), expiryDate?, expectedAmount?}`, `accountId` header), with single-fetch `GET /v1/accounts/virtual/{accountRef}`. There is **no "list all sub-accounts"** and **no per-account balance** endpoint in the public docs (balance is parent-only via `GET /v1/accounts/balance`). The `{accountName, accountRef}` body itself **is** confirmed. Confirm whether the team surface really exposes distinct sub-accounts with their own balances, or whether tenant attribution must be modelled on virtual accounts + transaction attribution.

### 4.2 Checkout (card capture) — `/checkout/order`
Hosted payment page. You POST the order, get a `checkoutUrl`, redirect the customer; Nomba handles card entry, 3-D Secure, OTP, PCI scope. You get a `payment_success` webhook on completion.

| Method | Path | Use |
|---|---|---|
| POST | `/checkout/order` | Create session → returns `data.checkoutUrl` |
| GET | `/checkout/order/{orderReference}` | Look up session status |

```js
const order = await nomba.post("/checkout/order", {
  order: {
    orderReference: "ord_" + crypto.randomUUID(),
    amount: 250000,            // kobo (₦2,500.00)
    currency: "NGN",
    callbackUrl: "https://yourapp.com/payment/return",
    customerId: "cus_8821",
    customerEmail: "ada@example.com",
  },
});
// redirect → order.data.checkoutUrl
```

**Flow:** POST order → redirect to `checkoutUrl` → customer pays on Nomba's page → `payment_success` webhook → verify signature → mark paid → fulfil.

> **✅ Verified (live docs, 2026-06-29).** The order shape is corroborated: `POST /v1/checkout/order`, body wrapped in an `order` object with `orderReference`, `customerId`, `callbackUrl` (req), `customerEmail` (req), `amount` (req), `currency` (req, ISO-4217 NGN/CDF/USD), plus optional `accountId`, `allowedPaymentMethods`, `splitRequest`, `orderMetaData`; status lookup `GET /v1/checkout/order/{orderReference}`; success fires `payment_success`. To enable card saving, set the **top-level** `tokenizeCard: true` (sibling of the `order` object).
>
> **⚠ Worth checking — simulate to confirm.** Two divergences: (a) the public docs name the redirect URL **`data.checkoutLink`**, not `data.checkoutUrl`; (b) `amount` is **major-unit naira** there (e.g. `"10000.00"`), not kobo (see §2.1). Also: the order-lookup response carries only order metadata + `hasSavedCards` + `base64EncodedRsaPublicKey` — **no payment-status and no token field** — so completion status/token come from the webhook, not the lookup.

**⚠ VERIFY → ✅ Verified (live docs, 2026-06-29):** the saved **card token** is delivered in the `payment_success` webhook as **`tokenKey`**, at path `data.tokenizedCardData.tokenKey` (the `tokenizedCardData` object also carries `cardType`, `tokenExpiryYear`, `tokenExpiryMonth`, `cardPan` masked). It requires the order to have been created with `tokenizeCard: true`, and it does **not** appear in the `GET /checkout/order/{orderReference}` lookup. In this doc's §4.3 that value is used as `cardId` — note the public docs call it `tokenKey` (see the §4.3 callout). Sandbox-confirm the exact path once, since this is the seed of the whole card rail.

### 4.3 Tokenized cards (recurring charge) — `/tokenized-card`
Charge a saved card token later, no customer present. Tokens are scoped to your merchant.

| Method | Path | Use |
|---|---|---|
| POST | `/tokenized-card/charge` | Charge a saved token |
| GET | `/tokenized-card/list` | List a customer's tokens |
| DELETE | `/tokenized-card/{tokenId}` | Revoke a token |

```js
await nomba.post("/tokenized-card/charge", {
  amount: 500000,                       // kobo
  currency: "NGN",
  cardId: "tok_5fa12b...",              // the saved token
  customerId: "cus_8821",
  merchantTxRef: "sub_2026_03_" + customerId,  // unique per attempt
});
```

**Nomba does not run the schedule — we do.** The billing scheduler decides when to call this. Unique `merchantTxRef` per attempt makes retries idempotent.

> **✅ Verified (live docs, 2026-06-29).** The capability is corroborated: a card is tokenized on first checkout and re-charged later with no customer present, and **Nomba does not run the schedule** (the docs explicitly say to save the token and call the charge yourself for each cycle). `currency` and a customer identifier are part of the charge.
>
> **⚠ Worth checking — simulate to confirm.** The public docs describe this rail quite differently — confirm the whole shape in sandbox before building it:
> - **Endpoints:** charge = `POST /v1/checkout/tokenized-card-payment`; list = `GET /v1/checkout/tokenized-card-data`; revoke = a DELETE on the `tokenized-card-data` resource (exact path not retrievable from public docs — *still needs sandbox*; likely `/v1/checkout/tokenized-card-data`, **not** `/tokenized-card/{tokenId}`). No `/tokenized-card/*` family appears publicly.
> - **Token field:** `tokenKey` (not `cardId`).
> - **Request shape:** nested — `{ tokenKey, order: { amount, currency, customerId, customerEmail (req), callbackUrl (req), orderReference } }` — not the flat body above; the merchant ref is `order.orderReference` (not `merchantTxRef`); `amount` is naira (see §2.1). The flat body above also omits `customerEmail`/`callbackUrl`, which the public charge marks required.
> - **List response:** `tokenizedCardDataList[]` keyed by `tokenKey`/`customerEmail` (+ `nextPage`), filtered by `accountId` header and optional `customerEmail`/`startDate`/`endDate`/`page` — not by `customerId`.

**⚠ VERIFY (critical for dunning) → ✅ Verified (live docs, 2026-06-29):** a **`payment_failed`** webhook event **does exist** (this doc's event table omitted it). The failure reason is carried in **`gatewayMessage`** (e.g. `"Insufficient funds"`) alongside `status: "PAYMENT_FAILED"` in the event/transaction data. Critically, the **synchronous charge response only signals acceptance** (`code`/`description`/`data{status,message}`) — the definitive success/failure outcome arrives via the webhook, so **dunning must branch on `payment_failed` + `gatewayMessage`, not on the sync reply**. *Still needs sandbox:* the full enumerated set of `gatewayMessage` reason codes beyond "Insufficient funds", for retry/dunning classification.

### 4.4 Virtual accounts (transfer rail) — `/accounts/virtual`
Dedicated NUBAN per customer/invoice. When the customer transfers in from any Nigerian bank, you get a `virtual_account.funded` webhook with amount, sender, and your reference. This is how push transfers become reconcilable subscriptions.

| Method | Path | Use |
|---|---|---|
| POST | `/accounts/virtual` | Create permanent or one-time NUBAN |
| GET | `/accounts/virtual/{accountId}` | Details and balance |

```js
const va = await nomba.post("/accounts/virtual", {
  accountRef: "inv_9921",
  accountName: "Acme Ltd — INV 9921",
  expiryDate: "2026-12-31",
  amount: 1000000,   // kobo — optional; locks the *expected* amount only
});
```

Even with an expected `amount`, the rails accept any value. In the webhook, compare `amountReceived` vs `amountExpected`: refund overpayments, surface short-payments, and only advance the subscription when the invoice is actually satisfied.

> **✅ Verified (live docs, 2026-06-29).** Corroborated: `POST /v1/accounts/virtual` creates a dedicated NUBAN; `accountRef` + `accountName` are required and `expiryDate` is optional; the create response returns the NUBAN (`bankName`, `bankAccountNumber`, `bankAccountName`, `accountHolderId`, `accountRef`, `expired`). Permanence is governed by `expiryDate` (omit ⇒ permanent/static; future date ⇒ time-bound) — *still needs sandbox:* a doc-internal conflict on the omitted-`expiryDate` default (permanent vs a 5-minute default) means confirm the real default before relying on permanent NUBANs.
>
> **⚠ Worth checking — simulate to confirm.** Divergences in the public docs: the create amount field is **`expectedAmount`** (not `amount`), in naira; the GET path param is `{accountRef}`/`{identifier}` (+ `accountId` header) and the **GET returns no balance**; and the **funding webhook is not `virtual_account.funded`** — funding arrives as `payment_success` with `transaction.type = "vact_transfer"` and `aliasAccountType = "VIRTUAL"`, where the received amount is `transaction.transactionAmount`, the sender is `customer.{senderName,bankCode,bankName,accountNumber}`, and **your reference is `transaction.aliasAccountReference`**. There is no `amountExpected` echoed in the payload to compare against (see the restrictive-mode caveat in §2.10). Confirm the event name + payload shape in sandbox — the reconciliation logic depends on it.

### 4.5 Webhooks — `POST /webhooks/nomba` (your endpoint)
HMAC-SHA256 signed with your `webhookSecret`. Verify over the **raw body** before parsing.

```js
app.post("/webhooks/nomba",
  express.raw({ type: "application/json" }),   // raw bytes; mount BEFORE any global json()
  (req, res) => {
    const signature = req.header("nomba-signature");
    const expected = crypto
      .createHmac("sha256", process.env.NOMBA_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    // prefer a constant-time compare in production:
    // crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (signature !== expected) return res.status(401).send("bad signature");

    const event = JSON.parse(req.body.toString());
    // Idempotency: reject if event.requestId already processed (unique index)
    // Do the minimum synchronously; queue heavy work; then ack.
    res.sendStatus(200);
  }
);
```

**Order of operations:** verify signature → dedupe on `requestId` → record/queue → `200`. Ack promptly so Nomba stops retrying; never let slow processing trigger redelivery.

**Event types:**

| Event | Fires when |
|---|---|
| `payment_success` | a checkout **or** token charge completes |
| `virtual_account.funded` | a NUBAN you issued receives a transfer |
| `transfer.success` | an outbound transfer settles |
| `transfer.failed` | an outbound transfer is reversed |
| `mandate.debit_success` | a direct-debit (mandate) attempt clears (see §5) |

> **⚠ Worth checking — simulate to confirm (signature input).** The public docs sign **not the raw body** but a colon-joined field string, Base64-encoded (see §2.3 for the exact field order and companion headers). The hex-over-raw-body sample above will not match if that is the real scheme — confirm the signing input and encoding in sandbox before relying on this handler.
>
> **⚠ Worth checking — simulate to confirm (event names).** The public docs use a **flat, undotted** event set: `payment_success`, `payment_failed`, `payout_success`, `payout_failed`, `payment_reversal`, `payout_refund`, `order_success`. Mapping vs this table: `virtual_account.funded` → arrives as `payment_success` (`type: "vact_transfer"`, see §4.4); `transfer.success`/`transfer.failed` → `payout_success`/`payout_failed`; **`mandate.debit_success` has no public equivalent** — mandate debits appear to be synchronous-only with no webhook (see §5). The public list also adds `payment_failed`/`payout_failed`/`payment_reversal`/`payout_refund`, which this doc omits and which dunning/refund flows need. Confirm the authoritative event catalog (including any mandate events) against the dashboard/sandbox.

### 4.6 Transfers (payout) — `/transfers`
Move money out of a Nomba balance to a Nigerian bank account. Used for tenant payouts and refunds beyond the original card window.

| Method | Path | Use |
|---|---|---|
| POST | `/transfers/bank/lookup` | Resolve account number → name **(do this first)** |
| POST | `/transfers/bank` | Initiate transfer |
| GET | `/transfers/{merchantTxRef}` | Check status |

```js
const lookup = await nomba.post("/transfers/bank/lookup", {
  bankCode: "044", accountNumber: "0123456789",
});
await nomba.post("/transfers/bank", {
  amount: 1500000,                 // kobo
  bankCode: "044",
  accountNumber: "0123456789",
  accountName: lookup.data.accountName,   // confirm before sending
  senderName: "Acme Ltd",
  narration: "Payout — March 2026",
  merchantTxRef: "payout_" + crypto.randomUUID(),
});
```

> **✅ Verified (live docs, 2026-06-29).** Corroborated: lookup is `POST /v1/transfers/bank/lookup` with `{accountNumber, bankCode}` returning `data.accountName` (the docs explicitly say to display it before confirming) — the resolve-name-first flow is right. The transfer body fields match (`amount`, `accountNumber`, `accountName`, `bankCode`, `merchantTxRef`, optional `senderName`/`narration`), and `merchantTxRef` is the caller-supplied reconciliation ref.
>
> **⚠ Worth checking — simulate to confirm.** Divergences: the transfer endpoint is **`POST /v2/transfers/bank`** (v2; lookup stays `/v1`), with a per-sub variant `POST /v2/transfers/bank/{subAccountId}`; `amount` is naira (see §2.1); and there is **no `GET /transfers/{merchantTxRef}`** status endpoint in the public docs — status comes via webhook (`payout_success`/`payout_failed`) or a requery (`GET /v1/transactions/accounts/single?transactionRef=…`). Confirm the version + status path in sandbox.

**⚠ VERIFY (settlement model) → ✅ Verified (live docs, 2026-06-29):** an **inline split IS supported** — `POST /v1/checkout/order` accepts an optional `splitRequest` object: `{ splitType: "PERCENTAGE" | "AMOUNT", splitList: [{ accountId, value }] }`, where `accountId` is a Nomba sub-account/outlet. So **both** settlement models are available: split at collection time (recommended for tenant settlement), and Transfers for true outbound payouts/refunds. Confirm the `accountId` semantics for our sub-account model in sandbox.

### 4.7 Transactions & reconciliation — `/transactions`
The daily discipline of matching your ledger against Nomba's record. Skipping it is the classic silent-money-loss bug.

| Method | Path | Use |
|---|---|---|
| GET | `/transactions` | Filter by `dateFrom`, `dateTo`, `status`, `type` |
| GET | `/transactions/{merchantTxRef}` | Single transaction by your ref |

Nightly: pull Nomba's transactions, diff against the local ledger **joined on `merchantTxRef`**, alert on orphans (on Nomba, not local) and amount drift.

> **⚠ Worth checking — simulate to confirm.** The reconcile-by-`merchantTxRef` discipline and the `dateFrom`/`dateTo`/`status`/`type` filters are confirmed, but on different shapes in the public docs: the list/filter is **`POST /v1/transactions/accounts/{subAccountId}`** (a POST — `dateFrom`/`dateTo`/`limit`/`cursor` as query params; `status`/`type`/`merchantTxRef`/`transactionRef`/`orderReference`/… as body filters), and the single-transaction lookup is **`GET /v1/transactions/accounts/single?orderReference=…` or `?transactionRef=…`** (query, not a `{merchantTxRef}` path segment). Confirm the method + scoping in sandbox.

---

## 5. Direct debit (mandates) — `/mandates`

A **mandate** is the customer's standing authorisation to debit their **bank account** on a recurring basis — an account-based **pull** rail. Unlike the transfer rail (push), a mandate lets you initiate each charge on the billing cycle without the customer acting every time, which makes it the strongest recurring option for customers who keep no card on file but will consent to a standing debit. Mandates require **explicit consent** (OTP or in-app) captured through a Nomba-hosted `consentUrl`.

| Method | Path | Use |
|---|---|---|
| POST | `/mandates/create` | Create a mandate request → returns `data.consentUrl` |
| POST | `/mandates/{mandateId}/debit` | Debit an approved mandate |
| DELETE | `/mandates/{mandateId}` | Cancel an active mandate |

```js
const mandate = await nomba.post("/mandates/create", {
  customerId: "cus_8821",
  maxAmount: 5000000,        // kobo — ceiling PER debit (₦50,000)
  frequency: "monthly",
  startDate: "2026-04-01",
  endDate:   "2027-04-01",
});
// redirect the customer to mandate.data.consentUrl to approve (OTP / in-app)
```

**Debiting.** Once approved, charge on the billing cycle via `/mandates/{mandateId}/debit`. As with every external write, send a unique `merchantTxRef` per attempt (idempotency) and the amount in kobo. A successful debit surfaces as the `mandate.debit_success` webhook.

**Respect the ceiling.** `maxAmount` is a hard cap **per debit**. If a period's bill exceeds it, create a **new mandate and re-collect consent** — never split a charge into smaller debits to slip under the cap; that violates the customer's authorisation.

**Lifecycle in our engine.** Treat the mandate as a first-class `payment_method` on the subscription: `consent_pending` after create, `active` after approval, `canceled` after DELETE or once `endDate` passes. The mandate rail plugs into the same subscription/charge abstraction as card and transfer — rail selection and fallback stay our concern, not Nomba's.

> **⚠ Worth checking — simulate to confirm.** The public docs describe the mandate rail substantially differently — confirm the whole flow in sandbox before building it:
> - **Endpoints:** create = `POST /v1/direct-debits` (returns `data.mandateId`); debit = `POST /v1/direct-debits/debit-mandate` with `{mandateId, amount}` (mandateId in the **body**, not the path); cancel = `PUT /v1/direct-debits/update-status` with `{mandateId, status: "SUSPEND"}` (a status update, **not** an HTTP DELETE; statuses ACTIVE/SUSPENDED/DELETED). No `/mandates/*` namespace appears publicly.
> - **Consent:** **no `consentUrl`** in the public docs — approval is a **NIBSS e-mandate**: the customer transfers a **₦50.00 validation token from the very account being mandated** to a returned account number; the create response carries `{mandateId, merchantReference, phoneNumber, description}` (the ₦50 instruction), not a consent link.
> - **Create body:** the customer is targeted by **bank details** (`customerAccountNumber`, `bankCode`, `customerName`, `customerAccountName`, `customerAddress`, `customerPhoneNumber`, `customerEmail`, plus `narration`, `merchantReference`, `startImmediately`), not a `customerId`; the amount field is **`amount`** (naira), not `maxAmount` (kobo); `frequency` is an enum (WEEKLY … EVERY_TWELVE_MONTHS, VARIABLE). The per-debit-ceiling concept itself may be a team-surface feature — confirm whether a hard cap exists.

**⚠ VERIFY (mandate activation) → ✅ Verified (live docs, 2026-06-29):** approval is learned by **status polling, not a webhook**. Poll `GET /v1/direct-debits/status?mandateId={id}`; the mandate is debitable only once its status is `ACTIVE` **and** its advice status is `ADVICE_SENT` (statuses: ACTIVE/SUSPENDED/DELETED; advice: ADVICE_NOT_SENT/ADVICE_SENT). Activation happens after the customer completes the ₦50 NIBSS validation transfer. *Still needs sandbox:* whether the team surface fires **any** mandate webhook — if not, polling is the only activation signal.

**⚠ VERIFY (debit schema + failure) → ✅ Verified (live docs, 2026-06-29):** the debit body is `{mandateId, amount}` (amount a decimal naira string, e.g. `"110.00"`) to `POST /v1/direct-debits/debit-mandate`, and the result is **synchronous** — the response carries root `status` (boolean), `code` (`"00"` on success), `description`, and `data { mandateId, status, amount, message }`. A **failed** debit is conveyed **inline** via those same fields (there is **no** mandate failure/success webhook in the public docs). Mandate failures feed the same dunning branch as failed card charges. *Still needs sandbox:* the exact failed-debit `code`/`status`/`message` vocabulary (e.g. insufficient funds, suspended mandate) before relying on direct-debit retries.

---

## 6. Sandbox test instruments

| Instrument | Value |
|---|---|
| Test card — success | `5060 6666 6666 6666 666` (any future expiry, any CVV) |
| Test card — insufficient funds | `5060 6666 6666 6666 674` (use this to exercise dunning) |
| Test bank account | Wema Bank, `0000000000` — accepts any inbound transfer |

---

## 7. Integration definition-of-done

Treat unchecked items as release blockers.

**Security**
- [ ] `clientSecret` and `webhookSecret` loaded from env / secret manager — not in source.
- [ ] Every webhook handler verifies the `nomba-signature` HMAC over the raw body. *(⚠ confirm signing input first — public docs sign a colon-joined field string, Base64; see §2.3 / §4.5.)*
- [ ] Every external write keyed on a unique `merchantTxRef`. *(⚠ card charge may key on `order.orderReference`; see §2.2.)*

**Correctness**
- [ ] All amounts sent as integer kobo; no floats in the money path. *(✅ kobo confirmed by the Nomba team, 2026-06-30 — no boundary conversion; see §2.1.)*
- [ ] Recipient name resolved via `/transfers/bank/lookup` and confirmed before any transfer.
- [ ] Webhook handler idempotent against duplicate `requestId`. *(⚠ confirm `requestId` is the stable dedup key; see §2.4.)*
- [ ] Over- and under-payment branches handled for virtual accounts. *(⚠ only applies in open/unrestricted mode; see §2.10 / §4.4.)*
- [ ] Access token cached and refreshed near the 55-minute mark (not per call). *(⚠ public docs say 30-min TTL — refresh off `data.expiresAt`; see §2.8.)*
- [ ] Failed-token-charge path implemented against verified failure semantics (see §4.3). *(✅ channel = `payment_failed` webhook + `gatewayMessage`; full reason-code set still needs sandbox.)*
- [ ] Mandate consent flow implemented (redirect to `consentUrl`); mandate-active state confirmed before the first debit (see §5). *(⚠ public docs use a NIBSS ₦50 validation transfer, not a `consentUrl`; activation is poll-only. ✅ activation = poll `GET /v1/direct-debits/status` to ACTIVE+ADVICE_SENT.)*
- [ ] Mandate debits carry a unique `merchantTxRef` and respect `maxAmount`; over-ceiling bills trigger new-mandate + re-consent, never split debits.
- [ ] Failed-mandate-debit path implemented against verified failure semantics (see §5). *(✅ failure is synchronous/inline, no webhook; exact status vocabulary still needs sandbox.)*

**Operations**
- [ ] Nightly reconciliation job: `/transactions` vs local ledger, joined on `merchantTxRef`, alerting on drift. *(⚠ filter is `POST /v1/transactions/accounts/{subAccountId}`; single lookup is query-based; see §4.7.)*
- [ ] Structured logging on every Nomba call, tagged with `merchantTxRef`.
- [ ] Health-check endpoint exposing green/red status.
