# Nomba One — Product Overview

> **What this is.** A conceptual description of the product: what Nomba One is, who it serves, and the intricacies that make it what it is. It is **not** a PRD, not a roadmap, not a build plan, and not a spec to implement line-by-line.
>
> **How to use it.** Read it to understand the product deeply enough to (a) propose your own phased build plans and (b) structure the repository sensibly. When you later write plans, they should be *derived from* this understanding. Pair it with `nomba-integration-reference.md`, which describes the underlying Nomba API; this document describes the product built on top of it.

---

## 1. What Nomba One is

Nomba ships payment **primitives** — ways to move money: take a card payment, charge a saved card, debit a bank account on a mandate, receive a transfer into a virtual account, pay out to a bank. What Nomba does *not* ship is a managed **subscriptions layer**: the machinery that turns "move money once" into "run a recurring billing relationship." So every product team that wants subscriptions on Nomba rebuilds the same hard parts from scratch — plans, billing cycles, proration, invoices, retries, dunning, reconciliation.

**Nomba One is that missing layer, delivered as a managed, multi-tenant service.** Downstream product teams integrate it the way they'd integrate Stripe Billing, and it runs the entire recurring-billing lifecycle for them on top of Nomba's rails.

The cleanest way to hold the boundary in your head: **Nomba is the money-movement layer; Nomba One is the intelligence layer.** Nomba answers "did money move?" Nomba One decides *when* to move it, *how much*, *over which rail*, *what to do when it fails*, and *who gets paid out of it*. All subscription logic and state lives in Nomba One. Nomba is a dependency it orchestrates, not the product.

## 2. Who it serves

Nomba One is two-sided, plus an operator view:

- **Tenants** — the downstream product teams (a gym SaaS, a school-fees platform, an ISP, a streaming app). They are the customers of Nomba One. They integrate via the API and manage everything through a console. Each tenant is fully isolated from every other.
- **End subscribers** — the tenants' own customers, who actually hold subscriptions and pay. They never deal with Nomba One as a brand; they subscribe and self-serve through tenant-facing surfaces.
- **Platform operators** — us. We observe system health, manage tenants, and watch reconciliation.

Nomba One never owns a tenant's product or their relationship with their subscribers. It runs the billing underneath that relationship.

## 3. The problem it takes a stance on

The generic way to build this assumes a **card-on-file** world: every customer has a card, you store it, you pull from it on a schedule. That assumption is imported from Western payments and it does not hold in Nigeria. Card ownership (especially credit) is thin, bank transfer is a primary way people pay, and balances are variable — which means the dominant payment failure is **insufficient funds at that moment**, not a fraud decline.

Nomba One is built around that reality, and three deliberate stances fall out of it:

1. **Rail-agnostic billing.** A subscription must not assume a card exists.
2. **Dunning built for thin balances.** Failure usually means *the money isn't there yet*, not *the customer refused* — so recovery is about timing and persistence, not just retry-then-cancel.
3. **Reconciliation as a first-class capability.** Because so much money arrives by push transfer, matching inbound money to the right subscription is a core job, not an afterthought.

These three stances are the spine of the product. Most non-obvious design choices below trace back to one of them.

## 4. The central idea: one subscription, three rails

The architectural heart of Nomba One is a **rail abstraction**. A subscription does not know how it gets paid. Underneath sit three interchangeable rails, and the engine chooses, falls back, and manages consent across them:

- **Card (tokenized card)** — a *pull* rail. After a customer pays once through Nomba's hosted checkout, a reusable card token is captured; renewals charge that token. Default for customers who have a card.
- **Direct debit (mandate)** — a *pull* rail against a bank account. The customer grants a standing, consent-gated authorisation; the engine then debits on the billing cycle without the customer acting each time. The strongest recurring option for customers with no card who will authorise an account debit.
- **Transfer (virtual account)** — a *push* rail. Each subscriber/invoice gets a dedicated bank account number; the customer transfers money in and the engine reconciles it. The fallback when there is neither a card nor mandate consent.

The crucial intricacy is the **push/pull asymmetry**. On card and mandate rails, "billing" is an action Nomba One initiates — it pulls. On the transfer rail, Nomba One *cannot* initiate anything; the customer must push. So on that rail, "billing" becomes: issue the invoice, expose the virtual account, nudge the customer, and reconcile whatever arrives against what was owed. This asymmetry ripples through scheduling and dunning — the same lifecycle, different mechanics per rail.

## 5. What the system does, end to end

The lifecycle Nomba One manages, conceptually:

A tenant defines **plans** (price, interval, currency). An end subscriber starts a **subscription** to a plan, and a **payment method** is established on the appropriate rail (card token captured via hosted checkout, mandate consented, or a virtual account issued). A **scheduler** continuously finds subscriptions due to bill and, for each, issues an **invoice** and either pulls payment (card/mandate) or awaits and reconciles a transfer. A successful payment advances the subscription to its next period. A failed or unpaid one moves it into **dunning** — a recovery process that, depending on the rail and failure reason, retries the pull, prompts a card update, or nudges and waits — until it either recovers (back to active) or exhausts and the subscription churns. Plan changes mid-cycle produce **proration**. Throughout, every meaningful change emits an **outbound webhook** so the tenant's own systems stay in sync, and money owed to the tenant is **settled** to their account.

That whole loop, working across rails, is the product. Everything else is depth around it.

## 6. The moving parts (as concepts)

These are the conceptual components of the system — not a module list to scaffold, but the pieces whose existence and relationships you should understand.

- **Billing core & two state machines.** The subscription lifecycle (incomplete → trialing → active → past_due → paused → canceled) and a distinct dunning process that runs while a subscription is past_due. State is *derived from and consistent with* the ledger — never an independent field that can drift.
- **Ledger & invoices.** The financial source of truth. Invoices are immutable once issued; proration and credits are expressed as line items. All money is integer minor units (kobo).
- **The scheduler.** The clock. It wakes, finds what's due, and drives billing. It is idempotent and replay-safe: a crash-and-restart never double-charges.
- **Rail adapters.** Card, mandate, and transfer behind one interface, so the billing core speaks "collect for this invoice" without knowing the rail.
- **Reconciliation.** Matches Nomba's record of money against Nomba One's ledger — both the per-transfer matching on the transfer rail (including over/under-payment) and a periodic full diff that catches silent drift.
- **Inbound webhook processing.** How Nomba tells Nomba One that something happened (payment succeeded, a virtual account was funded, a transfer settled). Signature-verified, deduplicated, then acted on.
- **Outbound webhook emission.** How Nomba One tells *tenants* that something happened, signed per tenant and retried on failure.
- **Multi-tenancy & settlement.** Strict per-tenant isolation, with each tenant mapped to its own Nomba sub-account so collected funds stay attributable, and payouts made via transfers.
- **Tenant and subscriber surfaces.** The console (tenants), the checkout/self-service experience (subscribers), the admin view (operators), and the docs.

## 7. The intricacies that define correctness

These are the truths about the domain that must hold *everywhere*. They are what separates a billing system that works from one that quietly loses money.

- **Money is always integer kobo.** No floating-point anywhere in the money path. ₦1.00 = 100 kobo.
- **Everything is idempotent.** Each external money movement carries a unique reference Nomba One generates; a retry reuses it so it can never become a second charge. The scheduler, the dunning runs, and webhook handling are all replay-safe.
- **Payment is confirmed by webhook, then verified — not assumed.** A customer landing back on a success page is a UI hint, not proof. The authoritative signal is the signature-verified webhook; before marking an invoice paid, the engine *also* re-verifies server-side against Nomba. A customer who vanishes after paying is still credited; a customer who returns without a confirmed payment sees "pending," never "paid."
- **Reconcile by your own reference, never Nomba's internal IDs.** Nomba's IDs can rotate on retry; the reference Nomba One owns is stable and present on both sides.
- **Rails are push/pull-asymmetric.** Scheduling and dunning behave differently on a rail that pulls versus one that can only receive.
- **Voluntary and involuntary churn are different outcomes.** A customer cancelling and dunning giving up are distinct transitions with distinct downstream events; conflating them is a bug.
- **Mandates are consent-bound.** A mandate carries a per-debit ceiling and an explicit consent lifecycle; exceeding the ceiling means re-consent, never splitting a debit to sneak under it.
- **Transfers accept any amount.** The expected amount on a virtual account is a hint, not an enforcement; over- and under-payment must be handled where the money lands.
- **Tenant isolation is absolute.** No tenant can ever observe or affect another's data; this is a property of the data model, not a check bolted on.
- **Currency is NGN.** The product is scoped to naira; don't design for multi-currency it can't honour.
- **Partial collection is a tenant choice.** Collecting a partial amount when the full sum isn't available is an opt-in behaviour a tenant enables for its subscribers — off by default.

## 8. Where Nomba ends and Nomba One begins

| Nomba provides (the rails) | Nomba One provides (the layer) |
|---|---|
| Auth, hosted checkout & card tokenization | Plans, billing cycles, trials |
| Token charge, mandate debit, transfers | The scheduler that decides when to charge |
| Virtual accounts (inbound transfers) | Invoices, the ledger, proration |
| Webhooks (money events) | Subscription & dunning state machines |
| Transactions (for verification) | Dunning / failed-payment recovery |
| Sub-accounts (fund attribution) | Multi-tenancy, isolation, settlement orchestration |
| | Outbound webhooks to tenants |
| | Reconciliation against the ledger |
| | Tenant console, subscriber self-service, docs |

Nomba is, in principle, a swappable dependency behind the rail adapters. The product is the orchestration layer, not the rails.

## 9. Surfaces

Nomba One presents as a set of distinct surfaces, expected to live under `nombaone.xyz`. Their separation is meaningful — different audiences, different trust levels — and naturally suggests separate applications sharing a common domain core. (Exact repository layout is your call; this just explains what each surface is *for*.)

- **`api.nombaone.xyz`** — the tenant-facing REST API. The primary product surface; everything a tenant's backend does is here. Server-to-server, authenticated with a per-tenant secret API key.
- **`console.nombaone.xyz`** — the tenant dashboard. Where a downstream team manages plans, views subscriptions and invoices, configures dunning policy, sets webhook endpoints, manages API keys, and sees settlement.
- **`checkout.nombaone.xyz`** — the end-subscriber surface. Where a subscriber starts a subscription and pays (wrapping Nomba's hosted checkout, by redirect or embedded iframe, so card entry stays on Nomba), and the self-service portal where they update their payment method, upgrade/downgrade, pause, cancel, and view their invoices.
- **`admin.nombaone.xyz`** — the platform-operator console (internal). Tenant management, system health, reconciliation and operational alerts, support tooling. Distinct from the tenant console: this is *our* view across all tenants.
- **`docs.nombaone.xyz`** — developer documentation for tenants integrating the API.

## 10. Auth & trust model

Nomba One is server-to-server at its core. A tenant authenticates to the API with a **single secret API key**; that key identifies exactly one tenant and scopes everything. For events Nomba One sends *to* a tenant, each tenant has a **shared HMAC webhook secret** they use to verify authenticity. There are **no asymmetric keys and no public/publishable key**, because nothing sensitive happens in an untrusted client — card entry stays on Nomba's hosted page, so Nomba One never handles raw card data and never needs a client key. The subscriber self-service surface is session-authenticated within the context of a tenant.

## 11. The product's character

If the codebase had a temperament, it would be this:

- **Correctness over cleverness in the money path.** Boring, verifiable, auditable beats elegant.
- **Idempotent and replay-safe by default**, everywhere money or state moves.
- **Event-driven.** The system reacts to webhooks and scheduled time; it does not assume synchronous success.
- **Rail-agnostic.** New rails are adapters; the core never learns their names.
- **Multi-tenant by construction**, not by convention.
- **Auditable.** A subscription's history can be reconstructed from its events.
- **Fail safe.** When in doubt, never double-charge and never silently lose money — surface it and reconcile.

## 12. Vocabulary

Canonical terms, so naming stays consistent across the system:

- **Tenant** — a downstream product team using Nomba One. The unit of isolation and settlement.
- **Customer / subscriber** — a tenant's end user who holds a subscription and pays.
- **Plan** — a priced, recurring offering (amount, interval, currency); versioned.
- **Subscription** — a customer's ongoing relationship to a plan; carries lifecycle state.
- **Invoice** — what is owed for one billing period; immutable once issued; composed of line items.
- **Payment method** — how a given subscription pays: a card token, a mandate, or a virtual account.
- **Rail** — a payment mechanism behind the abstraction: card, direct debit (mandate), or transfer.
- **Mandate** — a customer's standing, consent-gated authorisation to debit their bank account.
- **Token / card token** — a reusable reference to a saved card, charged without re-entry.
- **Virtual account** — a dedicated NUBAN issued to receive a customer's transfers.
- **Sub-account** — a Nomba account representing a tenant, keeping collected funds attributable.
- **Dunning** — the failed-payment recovery process that runs while a subscription is past due.
- **Proration** — the mid-cycle adjustment when a plan changes, expressed as invoice line items.
- **Reference** — the stable identifier Nomba One generates for each money movement (`orderReference` on checkout, `merchantTxRef` on charges/debits/transfers); the join key for idempotency and reconciliation.
- **Inbound / outbound webhook** — money events Nomba sends to Nomba One; subscription events Nomba One sends to tenants.
- **Settlement** — routing collected funds to the owed tenant and paying them out.
- **Reconciliation** — matching Nomba's record of money against Nomba One's ledger.
