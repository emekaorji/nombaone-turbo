# Nomba One · Website Plan · 04 · The Hard Parts Library

> Depends on docs 00–03. This is the content engine at `/guides`. It does four jobs at once: developer catnip, the SEO growth engine, proof you know the domain cold, and the standing argument against building billing yourself. It is *not* a blog you can't sustain. It's a finite, evergreen library on the genuinely hard problems of recurring billing, each piece following one template.

---

## 1. What makes it different from a blog

- **Evergreen, not news.** Each article is a durable explanation of a hard problem, not a dated announcement.
- **One template, every time** (§3). Consistency is what makes it read as a *library*.
- **Every article exits into something real:** the simulator (deep-linked to the relevant failure) or the docs. "Don't take my word for it."
- **Authored as MDX, reviewed like code** (§5), so articles can reference real SDK snippets and stay correct as the API evolves, instead of drifting stale.

## 2. Content model

- Source: `content/hard-parts/*.mdx`, typed frontmatter, rendered by the App Router MDX pipeline (Contentlayer2 or equivalent).
- Frontmatter schema:
  ```
  title:        string      # sentence case
  slug:         string
  problem:      string      # one-line pain, shown on cards and in listings
  group:        enum        # see §4 groups
  difficulty:   enum        # foundational | intermediate | deep
  readingTime:  number      # computed
  simulator:    string?     # optional failureMode to deep-link the "see it live" exit
  updated:      date
  ```
- The `/guides` index lists articles grouped by `group`, each card = `title` + `problem`. Cards carry no eyebrow: the title renders at the canonical card scale (24-26px) over the `problem` line (17-18px), title and problem only. Featured articles surface on the home page (doc 01 §3.6).
- Migration guides (from Stripe Billing, from Paystack) live here too. They double as competitive SEO and link from `/integrations`.

## 3. The article template (apply to every piece)

1. **The scenario.** A concrete, specific situation, not an abstraction. Name the moment.
2. **The naive approach.** What most teams build first, stated fairly (not a strawman).
3. **Why it breaks.** The exact failure mode, ideally with a number attached (a duplicated charge, a lost recovery, a % of churn).
4. **How Nomba One handles it.** The real mechanism, in enough technical detail that a skeptical engineer nods.
5. **See it.** A link into the simulator (with the relevant failure pre-set) or the exact docs page.

Each section is short. The whole piece is a focused read, not an essay. Voice per doc 00 §7. Typography follows the canonical bigger scale (article H2 title 56px, body 20-24px); no eyebrows anywhere, a beat is its bold label plus one line, title and deck only.

## 4. Starting roster (grouped)

**Reliability & correctness**
- The double-charge bug, and why idempotency keys aren't optional *(worked example, §6)*
- Building a scheduler that survives a crash mid-run
- "Retry the webhook" is not "retry the charge"
- Voluntary vs involuntary churn, and why conflating them corrupts your metrics

**The Nigerian payment reality**
- Why bank transfer isn't "just another payment method" (push vs pull)
- When a transfer doesn't match the invoice amount
- Card tokens expire, and why blind retries waste your dunning window
- Mandates and consent: the compliance shape of direct debit

**Billing mechanics, done right**
- Proration is a ledger problem, not a math problem
- The end-of-month billing trap (the Jan 31 problem)
- Dunning for thin balances: why payday-timed retries beat fixed schedules

**Multi-tenant & infrastructure**
- Isolation as a property of the data model, not a middleware check
- Settlement without spreadsheets: splitting one charge across many payees

**Migration guides**
- Moving off Stripe Billing to a rail-agnostic model
- Moving off Paystack subscriptions
- What to check before you trust any subscriptions layer with your revenue *(can be drawn from the exit-criteria doc)*

Ship 4–5 at launch (at least one from each of the first three groups, plus one migration guide); grow the rest over time. The four featured on the home page should be the most visceral: the double-charge bug, dunning for thin balances, push vs pull, and the "what to check before you trust any layer" checklist.

## 5. Authoring & review

- Written in MDX, PR-reviewed like code. Technical claims get the same scrutiny as the charge path. A wrong claim in a trust-building article is worse than none.
- Where an article shows code, import it from the real SDK examples so it can't drift.
- Each article's `simulator` frontmatter wires its "see it live" exit; keep those deep-links working as the simulator evolves.

## 6. Worked example (the template, filled in)

> Use this as the pattern for the rest. Trim/expand to the template's five beats; keep the voice plain and specific.

**Title:** The double-charge bug, and why idempotency keys aren't optional
**Problem (card line):** A retry or a crash turns one payment into two, and your customer notices before you do.

**1 · The scenario.** It's the 1st. Your billing job wakes up and starts charging the subscriptions that are due. Two-thirds of the way through, the process is killed by a deploy, an out-of-memory, or a dropped connection. It restarts and picks the run back up. Some of those subscriptions were already charged. A customer gets debited twice for the same month.

**2 · The naive approach.** Loop over due subscriptions, call the charge API for each, mark it paid in your database. It works perfectly in every test, because tests don't get killed halfway through.

**3 · Why it breaks.** The charge and the "mark as paid" write aren't one atomic thing, and the process isn't guaranteed to finish. On restart you can't tell "already charged" from "never charged," so you re-charge. In a market where balances are thin, a surprise double-debit isn't just a refund. It's a support ticket, a chargeback, and a customer who now distrusts every future charge. One bad run can do this to thousands of subscriptions at once.

**4 · How Nomba One handles it.** Every charge attempt carries a stable idempotency reference derived from the subscription and the billing period, so the same period always produces the same reference. The scheduler is built to be replayed: a unique constraint on (subscription, period) makes a duplicate invoice structurally impossible, and the reference tells the rail "this is the same attempt, not a new one." Kill the job anywhere and restart it, and it resolves to exactly one charge and one ledger entry, every time. The database makes the double-charge impossible; it isn't guarded by hopeful code.

**5 · See it.** Run the simulator with a mid-run interruption and watch it resolve to a single charge → *[open the simulator]*. Or read how the scheduler and ledger enforce this → *[docs: scheduling & idempotency]*.

---

## 7. SEO & growth

- These articles are the organic-growth engine: they target the exact phrases developers search when billing hurts ("stripe double charge idempotency", "recurring payment bank transfer Nigeria", "dunning retry strategy"). Write titles as the question a developer types.
- Per-article metadata + dynamic OG images (the title on the brand canvas). Internal-link between related guides and into `/product` and `/integrations`.
- The migration guides are high-intent competitive targets: someone searching "Stripe Billing alternative Nigeria" is close to switching.

---

## Plan set · recap

- **00 · Overview & Foundations**: north star, design language, voice, tech, how-to-use.
- **01 · Pages & Content**: sitemap + every page's anatomy, wireframes, copy, reasoning.
- **02 · The Live Simulator**: the signature interactive, full spec.
- **03 · Motion & "Alive"**: the interaction/animation spec.
- **04 · The Hard Parts Library**: the content engine + a worked example *(this doc)*.

All five inherit `nomba-one-design-system.html` as the visual source of truth. Phase A: design in pencil against docs 01–03. Phase B: build to spec, deriving every value from the design system.
