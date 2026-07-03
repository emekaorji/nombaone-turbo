# Nomba One: Website Plan · 01 · Pages & Content

> Depends on doc 00. This doc defines the sitemap and every page's structure, content, and reasoning. ASCII wireframes are the "pencil" starting point. Translate them to low-fi frames in Phase A. Animation is referenced by name here and specified in doc 03. Copy drafts follow the voice rules in doc 00 §7; where copy is marked *(draft)* it's production-ready-ish; refine, don't replace with marketing-speak.

---

## 1. Sitemap

```
nombaone.xyz
├─ /                     Home (the layered pitch + signature simulator)
├─ /product              The lifecycle, in depth
├─ /integrations         "Anywhere, anything, anyhow": rails × languages × frameworks
├─ /use-cases           Index of who it's for
│   └─ /use-cases/[slug] SaaS · school fees · gyms · lending repayment · platforms
├─ /pricing             Transparent, self-serve-first
├─ /trust               Money safety, isolation, reconciliation, status
├─ /guides              The Hard Parts library index   (content model → doc 04)
│   └─ /guides/[slug]    Individual hard-parts article
├─ /changelog           Shipping cadence (credibility signal)
├─ /hall                The Hall: curated, public question gallery (footer + /pricing, not primary nav)
└─ ↗ docs.nombaone.xyz  Developer docs (separate app; linked, not rebuilt)
```

Primary nav surfaces: Product, Integrations, Use cases, Docs↗, Pricing. Guides, Changelog, Status, and the Hall live in the footer and contextually inline.

## 2. Global page grammar

- **Container:** content max **1080px**; desktop artboard **1440** with ~180px side gutters; mobile **390** (20px gutters). Generous vertical rhythm on the 4px grid, with **section vertical padding ≥ 128px**.
- **Section rhythm:** each major section = **H2 title + one-line deck**, then content. **No eyebrows.** Sections are separated by generous whitespace and a **signature visual**, not by hairline rules. (Updated v2: the mono-uppercase eyebrow requirement and the hairline `--border` between sections are both removed; a divider reads as a document, and this is a product.)
- **Type scale (bigger, confident):** hero display **96px / 600 / ls ≈ -4.4 / lh 1.03**; section title H2 **56px / 600 / ls ≈ -2.4 / lh 1.05**; section deck **24px / 400**, muted; hero lede 27px; section body and paragraphs 20–24px; card titles 24–26px; card body 17–18px; list, trust, and feature items 18px; large stat numerals ≈ 76px; small and caption 15–16px; mono code 14, mono caption 12–13. Big type plus generous space reads as the calm confidence of a team sure of what it built. It is a deliberate signal, not decoration.
- **Numbered markers (01/02/03):** only where content is genuinely a sequence. The **lifecycle** section is a real sequence → number it. Do **not** number the feature grid, integrations, or use-cases. That would be decoration, not information.
- **The accent budget:** emerald appears per section at most once or twice (a CTA, a link, a live dot, a highlighted code token). If a section has emerald in three places, remove one.
- **Active nav:** each page highlights its own primary-nav item: Product on /product, Integrations on /integrations, Use cases on /use-cases (and its slug pages), Pricing on /pricing. Pages outside the primary nav (/trust, /guides, /changelog, /hall) highlight none, and the home highlights none.
- **Inner-page header:** every inner page (not the home) opens with a calm **page header**: a big H1 (~72px, ls ≈ -3, lh 1.03), a one-line deck (24px muted), left-aligned, with ~120px top padding. It has **no** rotating-audience word and **no** hero glow (those are home-hero-only); inner pages are calmer and more confident. It may carry two CTAs (Start building + Read the docs) as larger buttons, EXCEPT /product, whose header has no CTAs (its call to action lives in the closing CTABand; two CTAs there were redundant). Detail and slug pages (a use-case, a guide article) lead with a small accent kicker or tag before the H1, and a guide article adds a meta line (reading time, updated).

---

## 3. Home: section by section

The spine: land the ten-second thesis for whoever is reading, hand the developer real proof they can integrate today, acknowledge the licensed infrastructure it runs on, then go deep on the rails, the simulator, and the lifecycle before answering the DIY objection and letting founders and merchants self-identify. Twelve sections, top to bottom.

### 3.0 Header
Global chrome (doc 00 §8). Sticky, blurred.

### 3.1 Hero: the rotating-audience thesis
```
┌───────────────────────────────────────────────────────────────┐
│           (emerald radial-gradient fills the hero frame)        │
│                                                                 │
│                                                                 │
│             Subscriptions for every developer.                  │
│                                   ▲ rotates in emerald:         │
│               founder · merchant · decision-maker · PM          │
│                                                                 │
│       One billing engine for card, direct debit, bank           │
│       transfer, and crypto. Built for how Nigeria pays.         │
│                                                                 │
│         [   Start building   ]      [   Read the docs   ]       │
│                                                                 │
│       For developers, founders, merchants, and the people       │
│       who sign off on them.                                     │
└───────────────────────────────────────────────────────────────┘
```
- **The frame:** an immersive, headline-dominant hero that owns the viewport. The emerald glow is a **background radial-gradient fill** on the hero frame (dark-emerald center fading to near-black edges), not a floating ellipse. Build note: an absolute or overlay element paints *above* content in both Pencil and CSS stacking, so the glow must live in the background layer, never as an absolutely-positioned shape.
- **Headline:** "Subscriptions for every {audience}." The `{audience}` word renders in the emerald gradient (`#7deabd` → `#0bdfa3` → `#00c38b`) and animates through developer, founder, merchant, engineering and business decision-maker, and program manager. Display size 96px / 600, tight tracking (ls ≈ -4.4), line-height 1.03, sentence case.
- **Caption:** one line beneath the CTAs naming the audiences: "For developers, founders, merchants, and the people who sign off on them." It frames the rotation as inclusive, not a gimmick.
- **Lede:** one sentence, 27px, muted: "One billing engine for card, direct debit, bank transfer, and crypto. Built for how Nigeria pays."
- **CTAs:** two LARGE buttons, `Start building` (accent) and `Read the docs` (secondary). **No hero code snippet.** The real, copyable code proof lives one scroll down in §3.2, so a snippet here would only compete with the headline.
- **Signature visual:** the headline itself, the huge emerald-gradient rotating word set against the radial-gradient frame. The hero needs no other object.
- **Ambient motion:** the audience word cross-fades on a timed loop, the frame glow breathes slowly, and content fades up on load. (doc 03)
- **Reasoning:** the rotating headline says "whoever you are, this is for you" in a single read, and every named audience is a real buyer. The old code-in-hero and live-ticker both move out: the code to §3.2, the "alive and real" proof to the simulator's streaming webhook console (§3.5). The CTA is an action ("Start building"), not "Book a demo."
- **Motion & nuance:** the rotating-audience word cross-fades in emerald over a slow-breathing background glow. (doc 03)

### 3.2 Integrate any stack: the developer's proof (the big fish, promoted to 2nd)
```
┌───────────────────────────────────────────────────────────────┐
│ Integrate any stack. Any language. Any way.                    │
│  [Node][Python][Go][PHP][Ruby][.NET][Java][CLI][REST]          │
│  ┌── tabbed code: Next.js | Laravel | Django | Express ──────┐ │
│  │  the same "create subscription" in the selected stack     │ │
│  └───────────────────────────────────────────────────────────┘ │
│  + drop-in checkout embed · CLI to tail webhooks locally       │
└───────────────────────────────────────────────────────────────┘
```
- **Signature visual:** the full-width **LangTabs** code stage. A Resend-style language and framework switcher over a real, copyable "create a subscription" sample, with one emerald-highlighted token and a copy button. This is the hero's code proof, given room to breathe.
- Tabs cover Node, Python, Go, PHP, Ruby, .NET, Java, plus the CLI and raw REST / OpenAPI. Framework guides: Next.js, Laravel, Django, Express. Callouts for the embeddable checkout and the CLI that tails webhooks locally. Links to `/integrations` for the full matrix.
- **Reasoning:** promoted to second because DX is the big fish. The developer who can integrate in five minutes is the person who brings the buyer, so "is my stack here?" gets answered right after the thesis, above almost everything else. (Full page: §5.)
- **Motion & nuance:** the LangTabs underline slides between languages and the highlighted token pulses on switch. (doc 03)

### 3.3 Built on the Nomba infrastructure: the partnership band
```
┌───────────────────────────────────────────────────────────────┐
│ ( Powered by Nomba )                                           │
│                                                                │
│ Built on the Nomba infrastructure.                             │
│ Nomba One runs on Nomba, the licensed payment infrastructure   │
│ hundreds of thousands of Nigerian businesses already trust.    │
│                                                                │
│  ✓ Licensed & regulated       ✓ One provider, every rail       │
│  ✓ Nationwide bank coverage   ✓ Proven at scale                │
└───────────────────────────────────────────────────────────────┘
```
- **New section (v2):** a soft acknowledgment that Nomba funds this partnership under the hood. It borrows real, earned trust without overclaiming.
- **Pill:** a "Powered by Nomba" accent pill (Pill component, emerald, used with restraint).
- **Headline:** "Built on the Nomba infrastructure."
- **Copy:** "Nomba One runs on Nomba, the licensed payment infrastructure hundreds of thousands of Nigerian businesses already trust to move money. We run the subscriptions; Nomba moves the naira."
- **Four credibility perks** (FeatureLine): **Licensed and regulated**, **One provider, every rail**, **Nationwide bank coverage**, **Proven at scale**.
- **Signature visual:** the pill above the headline plus the four-perk row is the section's anchor. No diagram; restraint is the point.
- **Reasoning:** acknowledge softly and never overclaim. We run the subscriptions; Nomba holds the licenses and moves the money. The band reassures the buyer who needs to know the naira sits on regulated infrastructure, without implying Nomba One is itself the licensed entity.
- **Motion & nuance:** the "Powered by Nomba" pill and the four perks fade up in a gentle stagger. (doc 03)

### 3.4 One subscription, every rail: the rails showcase
```
┌───────────────────────────────────────────────────────────────┐
│ One subscription, every rail.                                  │
│                                                                │
│                     ┌───────────────┐                          │
│                     │ subscription  │                          │
│                     └──┬────┬────┬──┘                          │
│              ┌─────────┘    │    └─────────┐                   │
│        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐             │
│        │ Card      │  │ Direct    │  │ Bank      │             │
│        │ [ pull ]  │  │ debit     │  │ transfer  │             │
│        │           │  │ [ pull ]  │  │ [ push ]  │             │
│        └───────────┘  └───────────┘  └───────────┘             │
│  + Crypto: a first-class rail, architecturally distinct.       │
└───────────────────────────────────────────────────────────────┘
```
- **Signature visual:** one **subscription** node branching to **three rail cards** (Card, Direct debit, Bank transfer), each with an icon, a one-line description, and a **pull/push chip**.
  - **Card [pull]:** best-effort recurring charge. When the bank forces an OTP or 3DS step-up, we fall back to a signed checkout link, not a silent failure. Never presented as headless auto-renewal.
  - **Direct debit [pull]:** the reliable silent rail. A NIBSS mandate authorizes us to debit the customer's bank account on schedule, with no card required. (Built and live-gated.)
  - **Bank transfer [push]:** a dedicated virtual account per subscription. The customer pushes funds and we reconcile the inbound transfer to the right invoice automatically, to the kobo.
- **Crypto:** a first-class rail, but architecturally distinct. It has its own settlement and on/off-ramp and its own compliance, and it does not settle identically to the Nomba rails. The copy says so plainly.
- **Reasoning:** the rails are the product's reason to exist in a country where under 2% carry a card. Showing card as best-effort and direct debit as the silent workhorse is the honest, differentiating story that no card-on-file competitor can tell.
- **Motion & nuance:** the connectors from the subscription node to each rail card pulse to trace the routing. (doc 03)

### 3.5 The live simulator: the signature
```
┌───────────────────────────────────────────────────────────────┐
│ See a subscription survive.                                    │
│ Pick a rail. Run it. Break it. Watch it recover.               │
│                                                                │
│  [ Card ][ Transfer ][ Direct debit ][ Crypto ]                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Subscribed → Cycle 1 ✓ → Cycle 2 ✗→↻→✓ → Cycle 3 ✓      │  │
│  └─────────────────────────────────────────────────────────┘  │
│  [ Run simulation ]  [ Simulate insufficient funds ]           │
│  ┌── outbound webhooks → your endpoint ──────────────────────┐ │
│  │ {"event":"invoice.payment_failed","reason":"insufficie…}  │ │
│  │ {"event":"dunning.retry_scheduled"}                       │ │
│  │ {"event":"invoice.payment_recovered"}                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```
- **Signature visual:** the full-width **SimulatorStage**. Rail tabs, a timeline of cycle pills, run and break controls, and a raw-JSON webhook console that streams signed outbound events as you drive it.
- Full spec in **doc 02.** On the homepage it gets its own full-width stage. The failure→recovery path is the point; the recovery lands in emerald.
- This section carries the "alive and real" signal (the streaming webhook console), which is why the hero stays clean. Outbound webhooks are signed, at-least-once, deduplicated, retried, and replayable. Never "exactly-once."
- **Reasoning:** collapses "can I use this?" into "I just did," and shows the one thing no competitor shows (dunning working).
- **Motion & nuance:** the recovery cycle lands with an emerald spring-pop as signed webhooks stream into the console. (doc 03)

### 3.6 The lifecycle: the product as a sequence (numbered here, legitimately)
```
01 Subscribe    02 Bill        03 Recover     04 Reconcile   05 Settle
plan + rail →   scheduler →    dunning →      match money →  pay tenants
[hard part:     [hard part:    [hard part:    [hard part:    [hard part:
 rail choice]    idempotency]   thin balances] push transfers] splits]
```
- **Signature visual:** a horizontal **LifecycleRail** pipeline. Five numbered node badges (01 through 05) joined by a progress line that fills as you scroll.
- Five stages, each a subsection: what it does, the token/code touch, and its woven-in **"hard part"** (a one-line problem + link to the full guide in /guides). 
- *Stage decks (draft):*
  - **01 Subscribe:** "One subscription object. Card, transfer, mandate, or crypto, chosen and fallen-back-to automatically."
  - **02 Bill:** "A scheduler that finds what's due and charges it, idempotently, so a crash never double-charges."
  - **03 Recover:** "Dunning built for thin balances: payday-timed retries, card-update flows, and recovery, not retry-then-cancel."
  - **04 Reconcile:** "Every inbound transfer matched to the right invoice, automatically, to the kobo."
  - **05 Settle:** "Collected funds split and paid out to each tenant's account, no spreadsheets."
- **Reasoning:** evaluators (devs + leaders) get product depth as a story, not a feature-dump; each stage doubles as a doorway to the trust-building content library.
- **Motion:** a subtle progress line that draws as you scroll through the five stages; each stage reveals on enter. (doc 03)
- **Motion & nuance:** each numbered node badge fills emerald as the progress line reaches it. (doc 03)

### 3.7 The DIY question: answered in one breath
```
┌───────────────────────────────────────────────────────────────┐
│ Why not just build this on Nomba yourself?                     │
│                                                                │
│  Nomba gives you        You'd still build         Nigeria makes │
│  the rails.             the hard 80%.             it harder.    │
│  charge · transfer      plans · proration ·       <2% have a    │
│  · mandate · VA         dunning · ledger ·        card. Money   │
│                         reconciliation ·          arrives by    │
│                         state machines            transfer.     │
└───────────────────────────────────────────────────────────────┘
```
- **Signature visual:** a "what you'd rebuild" stack. A tall column of build blocks (state machines, reconciliation, ledger, dunning, proration, plans) resting on one thin Nomba base block, set beside a big stat, **"< 2% of Nigerians carry a card."**
- Three short columns: *the rails Nomba gives you* → *the managed layer you'd rebuild* → *why the Nigerian reality makes the naive build churn*. 
- *Draft deck:* "Nomba moves money. Everything that turns one charge into a running subscription (scheduling, proration, dunning, a ledger, reconciliation) you build yourself. And the card-on-file playbook assumes a country where most people have a card. Nigeria isn't that country."
- **Reasoning:** this is the leader's core objection. By this point the visitor has seen the rails, the simulator, and the lifecycle, so answering "why not build it myself?" plainly and factually, without dunking on Nomba (you sit on Nomba), lands with weight.
- **Motion:** columns reveal in sequence on scroll (staggered fade-up). (doc 03)
- **Motion & nuance:** the rebuild stack cascades block-by-block while the "< 2%" stat counts up. (doc 03)

### 3.8 The Hard Parts: trust through honesty
```
┌───────────────────────────────────────────────────────────────┐
│ The hard parts of recurring billing, written down.             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                     │
│  │ The double│ │ Dunning   │ │ Push vs   │   → all guides      │
│  │ -charge   │ │ for thin  │ │ pull:     │                     │
│  │ bug       │ │ balances  │ │ transfers │                     │
│  └───────────┘ └───────────┘ └───────────┘                     │
└───────────────────────────────────────────────────────────────┘
```
- 3–4 featured guides from the library (doc 04), each a card: title + one-line problem. Link to `/guides`.
- **Reasoning:** developer catnip + proof you know the domain cold + the standing argument against DIY. This is the SEO engine surfaced on the home page.
- **Motion & nuance:** the guide cards hover-lift on pointer to invite the click. (doc 03)

### 3.9 For platforms: the multi-tenant / settlement segment
- **Signature visual:** a settlement split diagram. One incoming charge fans out through a split into each tenant's own sub-account.
- A compact band for the platform buyer (a school portal, a cooperative app, a SaaS reseller): per-tenant isolation, sub-account settlement, automatic splits and payouts. One diagram, brief copy, link to `/use-cases/platforms`.
- **Build note:** splits, payouts, and escrow are built and live-gated. Present them as designed and built, not yet proven-live at scale.
- **Reasoning:** settlement is plumbing, not the headline. So it gets a focused band, not a hero, but it closes a real segment. Keep it short.
- **Motion & nuance:** the split diagram animates one charge fanning out into each tenant sub-account. (doc 03)

### 3.10 Trust & money-safety band
```
● Never double-charge   ● Tenant isolation by design
● Reconciled to the kobo   ● All amounts in integer kobo
● Signature-verified webhooks   ● 99.9%, All systems operational →
```
- **Signature visual:** a double-entry ledger receipt. An invoice header, debit and credit rows that sum, the line "balanced, and reconciled to Nomba to the kobo," and a green **PAID** pill.
- A tight grid of money-safety guarantees + a live status pill. Links to `/trust`.
- **Reasoning:** this is what converts the leader. For billing infra, "we won't lose your money" is the close.
- **Motion & nuance:** the ledger receipt balances and seals with a lock as the PAID pill turns emerald. (doc 03)

### 3.11 Use cases: self-identification
```
[ SaaS ]  [ School fees ]  [ Gyms & memberships ]  [ Lending repayment ]  [ Platforms ]
```
- Cards; each → a `/use-cases/[slug]` page. Founders and merchants find themselves here.
- **Motion & nuance:** each use-case card hover-lifts as you scan the row. (doc 03)

### 3.12 Final CTA: a developer's next action
```
Start with a request, not a sales call.
[ Get an API key ]   [ Read the quickstart ]   $ npm i nomba-one
```
- The close is an *action a developer can take now* (get a key, run the quickstart, copy the install line). Not "Book a demo." A quiet "Talk to us" link exists for leaders who want it.
- **Motion & nuance:** the install line reveals a copy affordance on hover and confirms with an emerald tick. (doc 03)

### 3.13 Footer
Global chrome (doc 00 §8).
- **Motion & nuance:** standard footer link hover-underlines, no bespoke motion (global chrome). (doc 03)

---

## 4. /product: the lifecycle, in depth

Expands home §3.6 into a full page. Each of the five stages gets a section: the problem, how Nomba One does it, a real code sample or small diagram, and the linked hard-part. End with the trust band and a CTA. This is where a developer who's "interested" goes deep. Reuse the lifecycle progress-line motion.

**As built:** page header "Every renewal, from signup to settlement." (no CTAs) then a LifecycleRail overview (numbered pipeline, the hard-part chips removed) then FIVE stage sections, each a 2-col that alternates side, carrying the stage number + title + the problem (muted) + how Nomba One does it (foreground) + a linked guide, with a signature visual per stage: Subscribe renders a create-subscription CodeBlock; Bill renders an idempotency panel (POST charge + an Idempotency-Key + the unique (subscription, period) note); Recover renders a dunning timeline (payment_failed to retry_scheduled at payday+1 to action_required with a checkout link to payment_recovered); Reconcile renders a transfer-to-invoice match panel (matched by reference, verified against Nomba); Settle renders the settlement split diagram. Close with a StatBand (guarantees) and a CTABand.

## 5. /integrations: the DX matrix

The home of "anywhere, anything, anyhow."
```
┌─ Rails ──────────────────────────────────────────────┐
│ card · bank transfer · direct debit (mandate) · crypto │
├─ Reach me anywhere ──────────────────────────────────┤
│ REST + OpenAPI · SDKs (Node, Python, Go, PHP, Ruby,   │
│ .NET, Java) · Framework guides (Next, Laravel, Django)│
│ · CLI (scaffold + tail webhooks) · Mobile (RN, Flutter)│
│ · No-code (Zapier, Make, n8n)                          │
├─ Drop-in ────────────────────────────────────────────┤
│ Checkout embed (script/iframe) · accounting exports   │
├─ Migrate ────────────────────────────────────────────┤
│ From Stripe Billing · From Paystack subscriptions     │
└──────────────────────────────────────────────────────┘
```
- A scannable **matrix** (rail × language × framework) so a dev answers "is my stack here?" instantly.
- Each SDK/framework tile → its quickstart. Migration guides double as competitive SEO (and live in the content library, doc 04).
- **Crypto note for the build:** present crypto as a first-class rail but know it's architecturally distinct (own settlement/on-off-ramp, own compliance). Don't imply it settles identically to the Nomba rails.

**As built:** page header "Integrate anywhere." then a "Reach us from anywhere in your stack" section rendering the matrix as a MatrixTile grid grouped by SDKs (Node, Python, Go, PHP, Ruby, .NET, Java), Frameworks (Next.js, Laravel, Django), Mobile (React Native, Flutter), No-code (Zapier, Make, n8n), and API and CLI (REST + OpenAPI, CLI) then a LangTabs code showcase ("The same call, in your framework") then a rails Tag row plus a crypto-is-distinct Callout then drop-in Cards (Checkout embed, Accounting exports) then migration GuideCards (Stripe Billing, Paystack) then a CTABand.

## 6. /use-cases + /use-cases/[slug]

- Index: the five cards from home §3.11, each with a one-line pain statement.
- Template per vertical: the vertical's specific pain (e.g. school fees paid in installments, chased manually) → how Nomba One solves it (rails + installments + dunning + reconciliation) → a tailored code/flow snippet → a CTA. These pages are where founders and merchants convert, and they're strong SEO targets.

**As built:** the index is the page header "Built for how your business bills." plus a grid of five UseCaseCards and a CTABand. The [slug] template (built as School fees) is: a page header with an accent kicker (the vertical) + H1 + deck then a "The manual way" 2-col (the pain narrative beside an installment-schedule visual: Term 1 paid, Term 2 due and nudged, Term 3 scheduled) then a "One subscription per student" section with four solution mini-cards (Any rail, Installments, Payday dunning, Auto-reconciled) then an "In code" tailored CodeBlock (create the subscription with installments) then a CTABand.

## 7. /pricing: transparent, self-serve-first

- Clear tiers with real numbers; a free/sandbox tier front and center. No "Contact us" wall on the self-serve tier. A developer must be able to understand cost without talking to anyone. An enterprise/volume tier can have "Talk to us."
- State the pricing model plainly (see doc 00, where the pricing model itself is a business decision to confirm; the page just presents it honestly).
- **FAQ block, "Questions, answered.":** a short FAQ on fees, currency (NGN), and how settlement and payout costs work. The heading carries a bare **emerald-gradient up-right arrow, underlined like a link** (no circle or button chrome), that links to `/hall`, the public question gallery; on hover it lifts and rotates slightly (doc 03).
- **"Add your question":** below the FAQ, the line "Not here? Ask us. We answer in the open, in the Hall." with an **Add your question** button that opens the shared Ask modal (§12). It turns a dead-end FAQ into a way in: ask, get helped as you type, and maybe become an exhibit in the Hall.

**As built:** a centered page header then three PricingTiers: Sandbox (Free, everything to build), Self-serve (usage-based, marked "illustrative, final pricing TBD", the featured tier with an accent border), and Enterprise (Custom, "Talk to us") then the centered FAQItem list (the "Questions, answered." block already documented) then the "Add your question" entry then a CTABand.

## 8. /trust: the page that closes leaders

- How money is handled: integer kobo, immutable ledger, idempotency (never double-charge), webhook signature verification, two-step verify (webhook + server-side confirm).
- Tenant isolation as a property of the data model.
- Reconciliation: how internal records match Nomba, and how drift is surfaced.
- Uptime / status page link, incident posture, data protection (NDPR) and PCI posture (card entry stays on Nomba's hosted page).
- **Reasoning:** for billing infra, this page does real sales work. Write it plainly and specifically. Vagueness reads as risk.

**As built:** page header "Built so it can't quietly lose your money." then "Every kobo, accounted for twice" (a 2-col: the double-entry ledger-receipt visual beside a TrustItem list of integer kobo, immutable invoices, idempotency, signature-verified webhooks, and two-step verify) then "Isolation is a property of the schema" (three tenant vault cards over a scoped-query mono line, WHERE organization_id = $tenant) then "Money that arrives is verified, not trusted" (a horizontal flow: webhook in, verify signature, requery Nomba, match by reference, post ledger) then a StatBand then a "Compliance, plainly" FAQItem list (no raw card data, NDPR, uptime posture, and direct-debit, payouts, and escrow stated as built but live-gated) then a CTABand.

## 9. /guides: the Hard Parts library

Index + article pages. The content model, article template, starting roster, and one worked example are in **doc 04.** The index groups by theme (Reliability & correctness · The Nigerian payment reality · Billing mechanics · Multi-tenant & infra · Migration guides) and each article ends with a "see it live" exit into the simulator or docs.

**As built:** the index is the page header "The hard parts of recurring billing, written down." plus FIVE grouped GuideCard clusters (each a group heading over a 3-up card grid), roster from doc 04. The article template (built as "The double-charge bug") is a centered ~760px reading column: a group Pill tag + H1 + problem line + a meta line (reading time, updated) then five ArticleBeats (scenario, naive approach, why it breaks, how Nomba One handles it with a CodeBlock for the unique index plus idempotency key, and see it live) then an "Open the simulator" button then a "Related" list then a CTABand.

## 10. /changelog

- A reverse-chronological, plainly-written list of shipped changes. Quiet but powerful credibility: it proves the thing is alive and shipping. Author from the same MDX pipeline as guides. Link it in the footer and from the header's Resources.

**As built:** page header "Shipping, in the open." then a reverse-chron ChangelogEntry list (date + a version Pill + title + description), seeded from the real build history: card OTP to checkout-link dunning fallback; settlement, refunds, and payouts; mandate activation sweep; byte-confirmed Nomba webhooks; and kobo and naira at the boundary.

## 11. /hall: The Hall (answer in public)

Radical transparency for support. Instead of a dead FAQ or a hidden ticket queue, the Hall is a **curated, public gallery** of the hardest real questions builders have asked on Nomba One and the team's answers. It is "build in public" applied to support: a trust asset, an SEO asset, and a marketing asset at once. Reachable from the footer and from /pricing, never a primary-nav item.

```
┌───────────────────────────────────────────────────────────────┐
│ The Hall.                                                      │
│ Every hard question builders have hit on Nomba One, answered   │
│ in the open. Real questions, real code, real answers.          │
│ Curated, never careless.                                       │
│ ● 1,204 answered, in public          [ Add your question ]     │
│                                                                │
│ [All][Rails][Dunning][Reconciliation][Multi-tenant][Migration] │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ @midnight_…  │ │ ships_at_3am │ │ kudi_gremlin │            │
│  │ #Dunning     │ │ #Reconcile   │ │ #Multi-tenant│            │
│  │ question…    │ │ question…    │ │ question…    │            │
│  │ ` code `     │ │              │ │ ` code `     │            │
│  │ ───────────  │ │ ───────────  │ │ ───────────  │            │
│  │ ✓ Nomba One  │ │ ✓ Nomba One  │ │ ✓ Nomba One  │            │
│  │   team: …    │ │   team: …    │ │   team: …    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└───────────────────────────────────────────────────────────────┘
```

- **Hero (editorial):** a massive "The Hall." title, a deck "Every hard question builders have hit on Nomba One, answered in the open. Real questions, real code, real answers. Curated, never careless.", a live count "1,204 answered, in public", and an **Add your question** button that opens the Ask modal (§12).
- **Filter chips:** All, Rails, Dunning, Reconciliation, Multi-tenant, Migration. Selecting one re-lays the wall.
- **The exhibit wall:** a **masonry** of exhibits of varying height. Each exhibit: the asker (a funky handle + monogram avatar) and a theme tag, the question (with an optional real code snippet or screenshot), a hairline, then the team's answer led by a green **"Nomba One team" check-seal**.
- **Truthfulness holds in the answers:** card is best-effort with OTP-to-link fallback, direct debit is the silent rail, webhooks are at-least-once, and live-gated rails are described as capabilities. The Hall never overclaims to look good.
- **Curated, not a forum:** no login, no voting, no unanswered noise. Only admin-approved AND opted-in questions ever appear (the toggle in §12). Every exhibit is solved and approved.
- **Reasoning (why it is disruptive):** no fintech or infrastructure company runs public, curated support. Publishing the real hard questions and answering them in the open proves the product is used, the problems are real, and the team stands behind its answers. It deflects the same question for the next reader (SEO plus support load), and it is safe because nothing is public without review.
- **Motion & nuance:** exhibits reveal on scroll with a masonry stagger, the filter chips animate the grid on filter, the live count ticks up, and the "answered" check-seal lands with a small emphasis. Respect prefers-reduced-motion. (doc 03)

## 12. The Ask modal (shared)

A shared component opened by any "Add your question" affordance (the /pricing FAQ, the Hall hero, and anywhere else we invite a question). It opens with a scale-and-fade over a backdrop blur.

```
┌──────────── Ask the Hall ────────────────┐
│ @midnight_debugger         (tap to rename)│
│ ┌──────────────────────────────────────┐ │
│ │ What are you stuck on?               │ │
│ └──────────────────────────────────────┘ │
│ ┌─ snippet.ts      TypeScript ▾     ✕ ─┐ │
│ │ 1  const res = await nomba.charge(…) │ │
│ │ 2  // returns action_required + link │ │
│ └──────────────────────────────────────┘ │
│ [ + Add image ]                           │
│ ┌── Might help, before you even ask ────┐ │
│ │ ▸ Dunning for thin balances    GUIDE │ │
│ │ ▸ invoice.payment_failed       DOCS  │ │
│ │ ▸ Break a card cycle           LIVE  │ │
│ └───────────────────────────────────────┘ │
│ (●) Feature my question in the Hall ↗     │
│ Nothing goes live without review.         │
│                               [   Ask   ] │
└───────────────────────────────────────────┘
```

- **Name field, prefilled:** a funky, gen-z handle generated client-side on open (e.g. @midnight_debugger, ships_at_3am, kudi_gremlin), editable ("tap to rename"). Personality lowers the bar to ask.
- **Problem:** a textarea, "What are you stuck on?".
- **Code editor (under the textarea):** a real inline code editor sits directly beneath the problem textarea, with a filename tab, a language selector (e.g. TypeScript), line numbers, and syntax highlighting, so a snippet can be pasted and read cleanly. It replaces the old "Add code" chip. **Add image** (a screenshot) is the one remaining attachment chip. Both animate in.
- **Feature-in-the-Hall toggle (a switch):** ON reads "Feature my question in the Hall ↗" at full opacity, with **Hall ↗** rendered as an underlined inline link to /hall (no button chrome, just an underlined accent link with the up-right arrow). OFF reads "Do not feature my question in the Hall", label slightly greyed and switch off. It controls whether the approved question may ever appear publicly. The switch animates and the label cross-fades between the ON and OFF copy.
- **Footer note (follows the toggle) plus submit:** ON = "Nothing goes live without review."; OFF = "Private. Only our team will see this." Plus an accent **Ask** button.
- **"Might help, before you even ask" panel:** as the user types, a debounced search over guides plus docs plus the event catalog surfaces matched suggestions that fade and slide in. Each is an icon + title + a small type tag (**GUIDE / DOCS / LIVE**, LIVE being a simulator deep-link). This deflects and helps in one move.
- **Approval pipeline:** submissions go to the admin surface; only questions that are **approved AND opted-in** reach the Hall. Never careless.
- **Motion & nuance:** scale-and-fade open over backdrop blur, the handle generates on open, the "Might help" suggestions debounce-search and fade/slide in, the toggle animates and cross-fades its label, and attachments animate in. Respect prefers-reduced-motion. (doc 03)

---

## 13. Page → doc cross-reference

- Every section's motion → **doc 03** (by section name).
- The simulator (home §3.5, referenced on /product) → **doc 02.**
- All /guides content, the featured cards (home §3.8), and migration guides (/integrations) → **doc 04.**
- All visual values (color, type, spacing, components) → `nomba-one-design-system.html`.

Proceed to doc 02 for the signature simulator.
