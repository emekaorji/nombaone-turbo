# apps/api build-plan — clarifying questions

> Answer inline after each `A:`. Each question carries the **default** I'll assume if you leave it
> blank, so you can simply confirm the ones you agree with and only write where you differ.
> I won't generate the `build_plan_{n}.md` files until these are settled.

---

## Scope & target

**Q1 — Vertical scope of these plans.** "Build apps/api" almost certainly means the *whole engine through
every layer* (`core-db` schema → migration → `core-contracts` types/validations → `sara` domain → `apps/api`
HTTP), since the API is just the surface that exposes the engine and the workbench rule is "every change
passes through every layer." So each plan file would own the db/domain/contracts work needed to power its
endpoints — not only the Express layer. Confirm?
*(Default: yes — full vertical slices; the domain (`sara`) is built inside these plans, not separately.)*
A: yes, touch every layer connected. (i hope you know what apps/api is. the is the public api our infra customers will call. just clarifying incase you did not know)

**Q2 — Target bar.** Do we build to *fully clear the exit-criteria final gate* (every table-stakes box +
every `⚠` + at least the `★` items in D/E and H), or MVP-first (thin end-to-end vertical, then deepen)?
And is `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md` the authoritative scope contract for what "done" means here?
*(Default: build to fully clear the gate; the rubric is authoritative. Sections that are really other apps'
UI — console/checkout/admin/docs — are out of these plans, but the API + domain they depend on is in.)*
A: yes, build to fully clear the gate on criteria that has to do with apps/api, you can leave console/checkout/admin/docs until when we are building them. and there's nothing like mvp-first. we are here to build and will not stop until we are finished - everything must be fully ready.

**Q3 — Timeline / hard constraints.** Is there a deadline or a fixed scope cut I should phase around (e.g.
a demo date, a judged submission window)? This changes how aggressively I parallelize and where I'd put a
"shippable here" line.
*(Default: no hard deadline given; I'll mark a "minimum demoable gate" early and sequence the rest after it.)*
A: assume the deadline was yesterday, and build everything apps/api end-to-end.

---

## Nomba integration

**Q4 — Sandbox credentials & real-vs-mock.** Do we have Nomba **sandbox credentials** now? And should these
plans build the **real Nomba rail adapter**, or build entirely on the `RailAdapter` abstraction + `MockRail`
and add the real adapter in a dedicated later phase, once creds exist and the doc divergences (kobo/naira,
endpoints, signature scheme) are confirmed in sandbox?
*(Default: build the whole engine on the rails abstraction + MockRail first; the real Nomba adapter is its
own later phase, gated on creds + a sandbox-confirmation pass. This keeps the core loop unblocked.)*
A: i have all the credentials, we are not stoping, we are not slowing down, we are not building small now and building more later, we are building everything now. i have both sandbox and live credentials. i have had a long partnership back and forth call to obtain all their credentials, so nothing is blocking you. the nomba team gave me "Main (parent) Account ID", "Sub-account ID", "Live Client ID", "Live Private key", "Test Client ID", and "Test Private key". if you need me to add them later when you are building as you need them, just play a sound and tell me, and i will provide them asap.

**Q5 — Money unit at the Nomba wire boundary.** Proceed on: *internal integer kobo everywhere* (unchanged),
with the **rail adapter converting kobo↔naira at the Nomba boundary**, behind a single "confirm unit in
sandbox" task that gates go-live? Or hold the money path until the unit is confirmed?
*(Default: proceed with internal-kobo + adapter-boundary conversion seam; one sandbox task confirms before
any real charge. The internal kobo invariant the rubric (J/C) demands is unaffected either way.)*
A: yes, money is always in kobo, this has been confirmed directly from the nomba team.

**Q6 — Rail scope & priority for v1.** All three rails (card / mandate / transfer), or card-first? In what
order?
*(Default: card (tokenized) first — it's what rubric Section E centers on — then mandate (direct debit),
then transfer (virtual account); all three behind the one abstraction so adding each is an adapter, not a
core change.)*
A: all three. like i said, we are locking in tonight.

---

## Billing feature scope

**Q7 — Which billing features are in scope, and when.** Tick what belongs in v1-core vs a later phase:
trials · flat-priced plans · plan versioning · seat/quantity-based plans · coupons/discounts (incl. 100%-off
→ zero-amount invoice) · per-customer credit balances · partial collection (tenant opt-in).
*(Default: v1-core = trials + flat-priced plans + plan versioning. Later phases (still inside these plans) =
seat/quantity, coupons/discounts, credit balances, partial collection. All are reachable in the rubric, so
none are dropped — only sequenced.)*
A: all of them. i know this is big, but that's why i have you phase it. i need it all.

**Q8 — Billing intervals.** Monthly + annual + custom-interval all required in v1 (rubric B asks for all
three, plus end-of-month and leap-day correctness)?
*(Default: yes — all three intervals, with anchor-date + EOM-snap-back + leap-day handling built and tested
from the scheduling phase onward.)*
A: yes, all three.

---

## Surfaces & auth

**Q9 — Subscriber self-service endpoints.** Does `apps/api` expose the **end-subscriber self-service**
endpoints (session-authenticated, powering the checkout portal in rubric Section I), or is `apps/api`
strictly the **tenant server-to-server** surface (per-org secret API key) with subscriber self-service owned
by `apps/checkout` against its own session?
*(Default: `apps/api` is the tenant S2S API-key surface; subscriber self-service is a separate session-auth
concern owned by checkout. I'll design the domain so checkout calls the same `sara` operations, but the
public REST endpoints in these plans are the tenant API.)*
A: yes, your defaults are correct.

**Q10 — Tenant onboarding & key management.** Do these plans include endpoints for **org/tenant onboarding +
API-key issuance/rotation**, or assume orgs + keys already exist (provisioned via console/admin) and start
from "an authenticated tenant"?
*(Default: orgs + API keys already exist (the boilerplate ships the primitives; console/admin own the UI). A
small early phase exposes key-management + tenant-config endpoints; full onboarding UX is not in apps/api.)*
A: assume the boilerplate is a naive junior dev and you are an engineering manager. a junior dev already has some experience, but what the engineering manager says is final, as the manager can see farther than the junior can. so go with your defaults, but if you need to change somethings to have it correctly fit our needs, then do so.

---

## Settlement

**Q11 — Settlement scope/timing.** Is settlement (mapping each tenant to a Nomba **sub-account** + **split
payments** so the tenant's share and the platform fee separate automatically — the H `★` winner) in scope
for these plans now, or deferred to a dedicated phase after the core billing loop is green?
*(Default: build the core billing loop first; settlement is a dedicated later phase, since it depends on the
split-vs-collect model being confirmed in sandbox. It IS in these plans, just sequenced after the loop.)*
A: build it. it is needed in this plan.

---

## Process & format

**Q12 — Phase slicing & file format.** I'll decide `n` and the phase cut unless you have a preference. My
proposed slicing (one `build_plan_{n}.md` per milestone):

1. `build_plan_00` — Foundations: delete the `example` slice, lock conventions, money/reference/idempotency/
   error/envelope wiring, the API skeleton + auth/scope/rate-limit/idempotency middleware proven on a real
   resource, CI/test harness (testcontainers) green.
2. `build_plan_01` — Catalog & customers: plans (+ versioning), prices, customers, the contracts + schema +
   CRUD endpoints.
3. `build_plan_02` — Subscriptions & the state machine: lifecycle FSM (incomplete→…→canceled), event-sourced
   transitions, invoices + ledger integrity, immutability + line-item invariants.
4. `build_plan_03` — Billing cycles & scheduler: anchor dates, intervals, EOM/leap, idempotent/replayable
   scheduler, concurrency safety, catch-up.
5. `build_plan_04` — Proration: upgrade/downgrade/interval-switch, exact-kobo math, ledger line items.
6. `build_plan_05` — Dunning & recovery: `past_due`, reason-branched retries, card-update flow, grace,
   voluntary-vs-involuntary churn, comms idempotency. *(D/E `★` axis — first-class time.)*
7. `build_plan_06` — Rails & Nomba integration: rails registry, MockRail-proven flows, then the real Nomba
   card adapter (tokenize→charge→verify), inbound webhook settle, requery reconciliation.
8. `build_plan_07` — Outbound webhooks & events: tenant event catalog, per-tenant HMAC, retry/dead-letter/replay.
9. `build_plan_08` — Multi-tenancy hardening & settlement: isolation tests, per-tenant config/limits, fair
   scheduling, sub-account + split settlement. *(H `★` axis.)*
10. `build_plan_09` — API ergonomics, OpenAPI, observability/metrics, edge cases (Section O), and the
    full test/load/sandbox-integration proof (Section P).

Each file embeds its own **verification checklist mapped to the exit-criteria boxes** it satisfies, so
"done" literally means "the rubric box is demonstrated." Good cut, or would you reslice / reorder / merge?
*(Default: this 10-file cut, mandate/transfer rails folded into a sub-phase of 06/later as Q6 dictates.)*
A: looks good to me. but you are the one building, so order them based on your discretion.

---

## Anything else you want baked in

**Q13 — Open floor.** Any constraints, preferences, or context I haven't asked about that should shape the
plans (naming, specific tenants/verticals to optimize for, perf targets, a particular demo scenario the
judges will run, etc.)?
A: the only thing you did not mention here is my code writing conventions, pls adhere to them. write code like i do. i built this boilerplate to show you how i write code. i also have projects locally that can show you how i write code. e.g., /Users/mac/Vault/work/softerpay/acute-turbo/apps/api, etc. i really hate it when you write code anyhow without thinking of good conventions like i do.
