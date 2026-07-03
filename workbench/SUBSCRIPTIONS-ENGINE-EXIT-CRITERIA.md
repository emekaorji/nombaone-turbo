# Subscriptions Engine — Exit Criteria & Rubric

**The judge before the judges.** Run this against the finished product. Every box is a pass/fail you can verify by inspection, by calling the API, or by simulating an event. If a critical item fails, the product is not done.

---

## How to use this

- Walk top to bottom. Tick a box only when you have *demonstrated* it, not when you *believe* it.
- A check is "demonstrated" when you can show the API call, the log line, the ledger row, or the test that proves it.
- Treat unmarked items as **must-pass**. The product is not shippable until every unmarked box is ticked.

### Legend

- ` ` (no marker) — **Table stakes.** Must pass. A failure here is a correctness or completeness bug.
- `★` — **Distinction.** Where you beat other teams. Not strictly required, but this is what wins on "sophistication."
- `⚠` — **Common failure point.** Teams routinely ship these broken. Check them twice.

### Maps to the four judged axes

| Judged axis | Primary sections |
|---|---|
| State-machine completeness | A, B, C, I, J |
| Dunning sophistication | D, E |
| Multi-tenant cleanliness | H, K, N |
| API ergonomics | F, G, L, M |

---

## A. Subscription state machine

- [ ] All lifecycle states exist and are reachable: `incomplete`, `trialing`, `active`, `past_due`, `paused`, `canceled`.
- [ ] ⚠ Terminal states (`canceled`) are truly terminal — no transition leads out of them except an explicit, separate **resubscribe** action that creates a new subscription record (not a revival of the old one).
- [ ] Every state transition is explicit, named, and triggered by a defined event — never by a direct field write.
- [ ] ⚠ Illegal transitions are rejected with a clear error (e.g. `canceled → active`, `incomplete → past_due`). There is a test proving each illegal transition is blocked.
- [ ] `incomplete` exists for subscriptions whose **first-ever** payment never succeeded, and these never appear as `active`.
- [ ] An `incomplete` subscription that is never paid expires automatically after a defined window (does not linger forever).
- [ ] `trialing → active` occurs on the first successful charge at trial end.
- [ ] `trialing → canceled` works if the customer cancels during the trial (no charge is ever attempted).
- [ ] ⚠ **Cancel-at-period-end** and **cancel-now** are distinct transitions with distinct behavior (one keeps access until period end, one revokes immediately).
- [ ] `active → paused → active` works; resume recomputes the next billing date correctly (no skipped or double-billed period).
- [ ] Pause has defined semantics: either a max duration or an explicit indefinite-hold policy, documented and enforced.
- [ ] ★ The subscription's state is **derived from / consistent with** the ledger (Section J), not stored as an independent field that can drift out of sync.
- [ ] ★ Every transition writes an immutable audit event (`event-sourced`): you can replay a subscription's full history from the event log.
- [ ] Replaying the same triggering event twice does not double-apply the transition (idempotent transitions).

## B. Billing cycles & scheduling

- [ ] Monthly, annual, and custom-interval cycles are all supported and tested.
- [ ] A subscription bills on its **anchor date**, not on an arbitrary "30 days later."
- [ ] ⚠ End-of-month is correct: a Jan 31 monthly anchor bills Feb 28 (or 29), then **snaps back to 31** in March — verified across a full year.
- [ ] ⚠ Leap year (Feb 29) is handled for both anchors and proration.
- [ ] All billing is computed in a single, fixed timezone at a deterministic hour; "due today" boundaries are unambiguous.
- [ ] ⚠ The scheduler is **idempotent and replayable**: killing it mid-run and restarting produces zero duplicate charges and zero duplicate invoices.
- [ ] The scheduler selects exactly the subscriptions due (no misses, no duplicates) — proven with a fixture of subscriptions straddling the due boundary.
- [ ] ⚠ Concurrent scheduler workers cannot both bill the same subscription (row lock, advisory lock, or `(subscription_id, period_index)` unique constraint).
- [ ] After downtime, the scheduler **catches up** on missed cycles without skipping or stacking duplicate charges.
- [ ] A plan/price change scheduled to take effect "next cycle" actually applies at the next cycle boundary, not immediately.
- [ ] ★ Scheduler throughput is demonstrated at realistic scale (e.g. 10,000 subscriptions due in one window) without timeouts or partial runs.

## C. Proration

- [ ] Mid-cycle **upgrade** charges the prorated difference immediately.
- [ ] Mid-cycle **downgrade** applies a credit toward the next cycle (or whatever policy you chose) — and the policy is documented, not implicit.
- [ ] ⚠ Proration math is exact in **integer minor units** (kobo). There is no float arithmetic and no rounding leak — the sum of prorated parts equals the cycle total to the kobo.
- [ ] Switching billing interval (monthly → annual) prorates correctly.
- [ ] Quantity/seat changes prorate correctly.
- [ ] No proration is applied during a free trial.
- [ ] Every proration produces explicit **ledger line items** (e.g. "−₦X unused, +₦Y new plan"), not a single opaque adjusted amount.
- [ ] ★ A credit balance is tracked per customer and deterministically applied to future invoices (oldest-first or stated order).

## D. Dunning & failed-payment recovery

- [ ] A failed renewal charge moves the subscription to `past_due`.
- [ ] The retry schedule is configurable (count and intervals).
- [ ] ⚠ The retry policy **branches on the failure reason** — `insufficient funds`, `expired card`, and `hard decline` do not all get the same treatment.
- [ ] ★ `expired card` / token-expired failures do **not** trigger blind charge retries (they will always fail); they trigger the **card-update flow** instead.
- [ ] Token expiry (`tokenExpirationDate`) is treated as a first-class dunning branch, with a customer prompt to re-add a card.
- [ ] A maximum dunning window / retry count is enforced; exhaustion moves the subscription to `canceled` (or downgrades to a free plan) and emits the corresponding event.
- [ ] A configurable **grace period** keeps service access during `past_due` (access is not cut on the first failure).
- [ ] A retry success returns the subscription to `active` and reconciles the open invoice to `paid`.
- [ ] ⚠ Customer communications fire at the right dunning steps and are **idempotent** — a replayed dunning run does not re-send the same email.
- [ ] If the customer updates their card mid-dunning, the engine re-attempts the charge promptly rather than waiting for the next scheduled retry.
- [ ] Every retry attempt is logged with its failure reason and outcome.
- [ ] ★ Retry timing is intelligent for the market — e.g. biased toward likely payday windows (end-of-month / salary cycles) rather than naive fixed gaps.
- [ ] ★ Voluntary churn (`active → canceled`, user-initiated) and involuntary churn (`past_due → canceled`, dunning exhausted) are recorded as **distinct** outcomes and emit distinct events.

## E. Tokenization & Nomba charge integration

- [ ] First payment is created with `tokenizeCard: true`; the `tokenKey` is captured from the `payment_success` webhook and persisted against the customer.
- [ ] Recurring charges use the stored `tokenKey` via the tokenized-card-payment endpoint (no card data is re-collected for renewals).
- [ ] ⚠ Each charge attempt carries a **unique** `orderReference` / `merchantTxRef` so retries and replays are idempotent on Nomba's side.
- [ ] ⚠ Charge outcomes are **verified server-side** (via webhook and/or transaction requery) — the engine never trusts a client-reported success.
- [ ] Nomba's `gatewayMessage` (e.g. "Insufficient funds") is mapped into your internal failure taxonomy that drives dunning branching (Section D).
- [ ] The card-update flow re-tokenizes a new card and swaps the stored `tokenKey` atomically (no window where the customer has zero valid tokens but is still billable).
- [ ] Removing a card cleans up the token (delete tokenized card) so stale tokens are not charged.
- [ ] OAuth2 access tokens are obtained and **refreshed** automatically; an expired access token never causes a silently dropped charge.
- [ ] Currency is consistently NGN across orders, charges, invoices, and ledger.

## F. Inbound webhooks (from Nomba)

- [ ] ⚠ The HMAC signature on every inbound webhook is verified using your signature key; unsigned or invalid-signature payloads are rejected.
- [ ] ⚠ Inbound webhook processing is **idempotent** — the same event delivered twice (Nomba retries on non-2XX) is processed exactly once.
- [ ] The endpoint acknowledges with 2XX promptly and does heavy processing asynchronously, so Nomba's backoff retries are not triggered by slow handlers.
- [ ] Out-of-order delivery is handled (e.g. a `payment_success` arriving after you already requeried does not corrupt state).
- [ ] Unknown or unsubscribed event types are ignored gracefully, not errored.

## G. Outbound webhooks (to downstream tenants)

- [ ] The engine emits a documented event set, including at minimum: `subscription.created`, `subscription.updated`, `subscription.canceled`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_recovered`.
- [ ] ⚠ Outbound events are **signed** (HMAC) with a per-tenant secret the tenant can verify.
- [ ] Failed deliveries are retried with exponential backoff on non-2XX (mirroring Nomba's own model).
- [ ] Each event carries a stable, unique event id so consumers can dedupe.
- [ ] Delivery guarantees are explicitly stated (at-least-once is acceptable; consumers told to dedupe).
- [ ] ★ A dead-letter store and a manual/automatic **replay** mechanism exist for events that exhausted retries.
- [ ] The full outbound event catalog (names, payload shapes, when each fires) is documented for downstream developers.

## H. Multi-tenancy

- [ ] Every domain entity (plan, subscription, invoice, customer, token reference) carries a `tenant_id`.
- [ ] ⚠ Tenant isolation is **proven**: an automated test shows Tenant A's credentials cannot read or mutate Tenant B's data on any endpoint.
- [ ] API keys / credentials map to exactly one tenant; there is no ambient "god" key usable in normal request paths.
- [ ] Per-tenant configuration is supported: plans, dunning/retry policy, webhook URL + secret, branding, grace period.
- [ ] ★ Settlement uses Nomba **sub-accounts + split payments**: when charging an end-customer for a tenant, the tenant's share lands in their sub-account and the platform fee is separated automatically.
- [ ] Per-tenant rate limits / quotas exist so one tenant cannot exhaust shared capacity.
- [ ] ★ The billing scheduler is fair across tenants — one very large tenant cannot starve others of a billing run.
- [ ] Metrics and logs are filterable by tenant.

## I. Customer self-service portal

- [ ] Customer can view current plan, next billing date, and next amount.
- [ ] Customer can update their payment method (drives re-tokenization, Section E).
- [ ] Customer can upgrade / downgrade (drives proration, Section C).
- [ ] Customer can pause / resume (where the tenant enables it).
- [ ] Customer can cancel, with the **cancel-now vs cancel-at-period-end** choice surfaced.
- [ ] Customer can reactivate / resubscribe.
- [ ] Customer can view invoice and payment history.
- [ ] ⚠ Authorization is enforced: a customer can only ever see and act on **their own** subscription — proven by test.
- [ ] Every portal action maps to exactly one state-machine transition (no portal action mutates state out-of-band).

## J. Ledger & money integrity

- [ ] ⚠ All monetary amounts are stored and computed as **integer minor units** (kobo). No floats anywhere in the money path.
- [ ] Invoices are **immutable** once issued; corrections happen via new credit/adjustment entries, never by editing a past invoice.
- [ ] Invoice lifecycle states exist and are enforced: `draft → open → paid` plus `void` / `uncollectible`.
- [ ] ⚠ For every invoice, the sum of its line items equals its total — enforced by a constraint or invariant check.
- [ ] Every money-affecting state change (charge, refund, credit, proration) produces a corresponding ledger entry.
- [ ] ⚠ **No double-charge is possible**: replaying any charge path (scheduler, webhook, retry, portal) results in exactly one debit — proven by an idempotency test.
- [ ] ★ Reconciliation exists: your internal records can be matched against Nomba transactions (via requery), and discrepancies are surfaced.
- [ ] A zero-amount invoice (e.g. 100%-off coupon) is marked `paid` without attempting a ₦0 charge.
- [ ] Refund / void paths are defined and produce correct ledger entries.

## K. Idempotency & concurrency (cross-cutting)

- [ ] ⚠ Every mutating API endpoint accepts and honors an `Idempotency-Key`; replaying a request returns the original result with no new side effects.
- [ ] Database constraints (unique keys) make duplicate invoices and duplicate period charges structurally impossible, not just guarded in code.
- [ ] ⚠ A portal action and a scheduler charge hitting the same subscription concurrently do not corrupt state (row locking or optimistic versioning), proven by a race test.
- [ ] Scheduler runs, dunning runs, and webhook processing are each independently idempotent.

## L. API ergonomics (developer experience)

- [ ] Resource naming and verbs are consistent and RESTful across all endpoints.
- [ ] ⚠ Errors use a single, predictable shape with stable machine-readable codes (not free-text-only messages).
- [ ] List endpoints are paginated (cursor-based) and consistent.
- [ ] Timestamps are ISO-8601 UTC everywhere; money is represented consistently (same unit, same field convention) everywhere.
- [ ] Creating a subscription requires the **minimum** sensible fields, with safe defaults for the rest.
- [ ] The API is versioned (e.g. `/v1`), so future changes don't break tenants.
- [ ] ⚠ A published machine-readable spec (OpenAPI) exists and matches the actual behavior.
- [ ] Authentication is clearly documented with a working example.
- [ ] `Idempotency-Key` usage is documented.
- [ ] A **sandbox / test mode** exists so downstream developers can integrate without moving real money.
- [ ] ★ A quickstart gets a new developer from zero to a first live subscription quickly, end to end.
- [ ] The webhook event reference (Section G) is part of the public docs.

## M. Observability & operations

- [ ] Structured logs carry correlation ids and tenant ids on every billing-related action.
- [ ] ★ Business metrics are exposed: MRR, active count, churn (voluntary vs involuntary), failed-charge rate, **dunning recovery rate**, dunning funnel.
- [ ] A per-subscription audit/event trail is queryable (ties to Section A).
- [ ] Alerting exists for charge-failure spikes and scheduler lag / missed runs.
- [ ] Health checks exist for the service and its dependencies (DB, Nomba).
- [ ] An admin/ops view can inspect a subscription's state, invoices, and dunning history.

## N. Security & compliance

- [ ] ⚠ No raw PAN / full card data is ever stored — only Nomba tokens.
- [ ] Secrets (API keys, signing keys, OAuth credentials) are in a secrets manager, not in code or config files.
- [ ] Webhook signatures are verified inbound and generated outbound (Sections F, G).
- [ ] Every endpoint enforces authentication and authorization — no unauthenticated mutating route.
- [ ] PII is handled deliberately (access-controlled, not logged in plaintext).
- [ ] Rate limiting protects the API from abuse.

## O. Edge cases & resilience

- [ ] ⚠ Nomba downtime: in-flight charges are queued/retried, nothing is lost, and no duplicate charge occurs when Nomba recovers.
- [ ] A subscription created with an **already-expired** card is caught and routed to the card-update flow, not silently set `active`.
- [ ] Attempting to delete a plan that has active subscribers is blocked or handled via plan versioning (subscribers are not orphaned).
- [ ] A cancel issued **during** an in-flight charge attempt resolves to a single, consistent outcome (no charge-then-cancel money leak).
- [ ] A duplicate inbound webhook arriving simultaneously with a scheduler retry resolves to one charge and one ledger entry.
- [ ] Month-boundary and leap-day cases (from Section B) are covered by explicit tests, not assumed.
- [ ] Partial failures (charge succeeded at Nomba but your write failed) are reconcilable and self-heal on requery — no lost or phantom payments.

## P. Testing & verification (the proof)

- [ ] Unit tests cover proration math across upgrade, downgrade, interval-switch, and end-of-month cases.
- [ ] State-machine tests cover every legal transition **and** assert every illegal transition is rejected.
- [ ] ★ Dunning is tested via simulation: scripted failure reasons drive the expected retry/branch/comms/recovery path.
- [ ] Idempotency tests replay the scheduler, the charge path, and inbound webhooks and assert zero duplicates.
- [ ] A concurrency/race test covers portal-action-vs-scheduler on the same subscription.
- [ ] ★ An integration test runs the full happy path against the Nomba sandbox (create → tokenize → renew → fail → recover).
- [ ] A load test exercises the scheduler at target subscription volume.

---

## Final gate

The product **exits** only when:

1. Every unmarked (table-stakes) box is ticked.
2. Every `⚠` box has been verified twice — once by reading the code, once by running the scenario.
3. At least the `★` items under **Dunning (D/E)** and **Multi-tenancy (H)** are ticked — those are the two axes where "sophistication" and "cleanliness" are won, and a competent-but-plain build will tick everything else and still lose there.

If any of the above is false, you are not done — you are *almost* done, which the judges will notice.
