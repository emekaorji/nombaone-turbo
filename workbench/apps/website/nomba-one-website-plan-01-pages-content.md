# Nomba One — Website Plan · 01 · Pages & Content

> Depends on doc 00. This doc defines the sitemap and every page's structure, content, and reasoning. ASCII wireframes are the "pencil" starting point — translate them to low-fi frames in Phase A. Animation is referenced by name here and specified in doc 03. Copy drafts follow the voice rules in doc 00 §7; where copy is marked *(draft)* it's production-ready-ish; refine, don't replace with marketing-speak.

---

## 1. Sitemap

```
nombaone.xyz
├─ /                     Home (the layered pitch + signature simulator)
├─ /product              The lifecycle, in depth
├─ /integrations         "Anywhere, anything, anyhow" — rails × languages × frameworks
├─ /use-cases           Index of who it's for
│   └─ /use-cases/[slug] SaaS · school fees · gyms · lending repayment · platforms
├─ /pricing             Transparent, self-serve-first
├─ /trust               Money safety, isolation, reconciliation, status
├─ /guides              The Hard Parts library index   (content model → doc 04)
│   └─ /guides/[slug]    Individual hard-parts article
├─ /changelog           Shipping cadence (credibility signal)
└─ ↗ docs.nombaone.xyz  Developer docs (separate app; linked, not rebuilt)
```

Primary nav surfaces: Product, Integrations, Use cases, Docs↗, Pricing. Guides + Changelog + Status live in the footer and contextually inline.

## 2. Global page grammar

- **Container:** ~1080px max content width, 32px gutters (20px on mobile), generous vertical rhythm on the 4px grid.
- **Section rhythm:** each major section = eyebrow (mono, uppercase, letter-spaced) + H2 + one-line deck, then content. Hairline `--border` between sections.
- **Numbered markers (01/02/03):** only where content is genuinely a sequence. The **lifecycle** section is a real sequence → number it. Do **not** number the feature grid, integrations, or use-cases — that would be decoration, not information.
- **The accent budget:** emerald appears per section at most once or twice — a CTA, a link, a live dot, a highlighted code token. If a section has emerald in three places, remove one.

---

## 3. Home — section by section

The spine: land the pitch for the decision-maker, prove it to the developer, then let founders and merchants self-identify. Twelve sections, top to bottom.

### 3.0 Header
Global chrome (doc 00 §8). Sticky, blurred.

### 3.1 Hero — the ten-second thesis + immediate dev-cred
```
┌───────────────────────────────────────────────────────────────┐
│ [eyebrow] BILLING INFRASTRUCTURE                               │
│                                                               │
│ Subscriptions that never                     ┌──────────────┐ │
│ assume a card.                               │ create-sub.ts │ │
│                                              │  1 import …   │ │
│ Card, transfer, mandate, or crypto — one     │  3 await nom… │ │
│ billing engine, every rail. Dunning that     │  5   plan: …  │ │
│ recovers, reconciliation that just works.    │  6   rail:'a… │ │
│                                              │ [copy]        │ │
│ [ Start building ]  [ Read the docs ]        └──────────────┘ │
│                                                               │
│  ● webhook delivered · 200 OK · 42ms   (live ticker)          │
└───────────────────────────────────────────────────────────────┘
```
- **Left:** eyebrow, display headline (the thesis, sentence case, tight tracking), one-sentence subcopy, two CTAs — `Start building` (accent) + `Read the docs` (secondary). *Draft headline:* "Subscriptions that never assume a card." *Alt:* "Recurring billing, built for how Nigeria pays."
- **Right:** a **real, minimal code block** (create a subscription) with a copy button and syntax highlighting where a token is emerald. Not a screenshot — real, copyable.
- **Below:** a compact **live webhook ticker** — a single line that updates (`● webhook delivered · 200 OK · 42ms`) to plant "this is alive and real" before the visitor scrolls.
- **Ambient motion:** a soft, slow emerald glow/vignette behind the headline (the Vercel-glow analog, restrained), the ticker's pulsing dot, entrance fade-up on load. (doc 03)
- **Reasoning:** decision-maker gets the thesis in one read; developer gets real code above the fold. No hero video, no stock imagery. CTA is an action ("Start building"), not "Book a demo."

### 3.2 The DIY question — answered in one breath
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
- Three short columns: *the rails Nomba gives you* → *the managed layer you'd rebuild* → *why the Nigerian reality makes the naive build churn*. 
- *Draft deck:* "Nomba moves money. Everything that turns one charge into a running subscription — scheduling, proration, dunning, a ledger, reconciliation — you build yourself. And the card-on-file playbook assumes a country where most people have a card. Nigeria isn't that country."
- **Reasoning:** this is the leader's core objection; answer it early, factually, without dunking on Nomba (you sit on Nomba). Sets up everything below.
- **Motion:** columns reveal in sequence on scroll (staggered fade-up). (doc 03)

### 3.3 The live simulator — the signature
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
- Full spec in **doc 02.** On the homepage it gets its own full-width stage. The failure→recovery path is the point; the recovery lands in emerald.
- **Reasoning:** collapses "can I use this?" into "I just did," and shows the one thing no competitor shows — dunning working.

### 3.4 The lifecycle — the product as a sequence (numbered here, legitimately)
```
01 Subscribe    02 Bill        03 Recover     04 Reconcile   05 Settle
plan + rail →   scheduler →    dunning →      match money →  pay tenants
[hard part:     [hard part:    [hard part:    [hard part:    [hard part:
 rail choice]    idempotency]   thin balances] push transfers] splits]
```
- Five stages, each a subsection: what it does, the token/code touch, and its woven-in **"hard part"** (a one-line problem + link to the full guide in /guides). 
- *Stage decks (draft):*
  - **01 Subscribe** — "One subscription object. Card, transfer, mandate, or crypto — chosen and fallen-back-to automatically."
  - **02 Bill** — "A scheduler that finds what's due and charges it — idempotently, so a crash never double-charges."
  - **03 Recover** — "Dunning built for thin balances: payday-timed retries, card-update flows, and recovery — not retry-then-cancel."
  - **04 Reconcile** — "Every inbound transfer matched to the right invoice, automatically, to the kobo."
  - **05 Settle** — "Collected funds split and paid out to each tenant's account — no spreadsheets."
- **Reasoning:** evaluators (devs + leaders) get product depth as a story, not a feature-dump; each stage doubles as a doorway to the trust-building content library.
- **Motion:** a subtle progress line that draws as you scroll through the five stages; each stage reveals on enter. (doc 03)

### 3.5 Rails & DX breadth — "anywhere, anything, anyhow"
```
┌───────────────────────────────────────────────────────────────┐
│ Integrate any stack. Any language. Any way.                    │
│  [Node][Python][Go][PHP][Ruby][.NET][Java][CLI][REST]          │
│  ┌── tabbed code: Next.js | Laravel | Django | Express ──────┐ │
│  │  the same "create subscription" in the selected stack     │ │
│  └───────────────────────────────────────────────────────────┘ │
│  Rails: card · transfer · direct debit · crypto                │
│  + drop-in checkout embed · CLI to tail webhooks locally       │
└───────────────────────────────────────────────────────────────┘
```
- Resend-style **language/framework tab switcher** over a real code sample; a rail row; callouts for the embeddable checkout and the CLI. Links to `/integrations` for the full matrix.
- **Reasoning:** the developer's "is my stack here?" answered in two seconds; the crypto rail is a visible flex. (Full page: §5.)

### 3.6 The Hard Parts — trust through honesty
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

### 3.7 For platforms — the multi-tenant / settlement segment
- A compact band for the platform buyer (a school portal, a cooperative app, a SaaS reseller): per-tenant isolation, sub-account settlement, automatic splits and payouts. One diagram, brief copy, link to `/use-cases/platforms`.
- **Reasoning:** settlement is plumbing, not the headline — so it gets a focused band, not a hero, but it closes a real segment. Keep it short.

### 3.8 Trust & money-safety band
```
● Never double-charge   ● Tenant isolation by design
● Reconciled to the kobo   ● All amounts in integer kobo
● Signature-verified webhooks   ● 99.9% — All systems operational →
```
- A tight grid of money-safety guarantees + a live status pill. Links to `/trust`.
- **Reasoning:** this is what converts the leader. For billing infra, "we won't lose your money" is the close.

### 3.9 Use cases — self-identification
```
[ SaaS ]  [ School fees ]  [ Gyms & memberships ]  [ Lending repayment ]  [ Platforms ]
```
- Cards; each → a `/use-cases/[slug]` page. Founders and merchants find themselves here.

### 3.10 Final CTA — a developer's next action
```
Start with a request, not a sales call.
[ Get an API key ]   [ Read the quickstart ]   $ npm i nomba-one
```
- The close is an *action a developer can take now* — get a key, run the quickstart, copy the install line. Not "Book a demo." A quiet "Talk to us" link exists for leaders who want it.

### 3.11 Footer
Global chrome (doc 00 §8).

---

## 4. /product — the lifecycle, in depth

Expands home §3.4 into a full page. Each of the five stages gets a section: the problem, how Nomba One does it, a real code sample or small diagram, and the linked hard-part. End with the trust band and a CTA. This is where a developer who's "interested" goes deep. Reuse the lifecycle progress-line motion.

## 5. /integrations — the DX matrix

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

## 6. /use-cases + /use-cases/[slug]

- Index: the five cards from home §3.9, each with a one-line pain statement.
- Template per vertical: the vertical's specific pain (e.g. school fees paid in installments, chased manually) → how Nomba One solves it (rails + installments + dunning + reconciliation) → a tailored code/flow snippet → a CTA. These pages are where founders and merchants convert, and they're strong SEO targets.

## 7. /pricing — transparent, self-serve-first

- Clear tiers with real numbers; a free/sandbox tier front and center. No "Contact us" wall on the self-serve tier — a developer must be able to understand cost without talking to anyone. An enterprise/volume tier can have "Talk to us."
- State the pricing model plainly (see doc 00 — pricing model itself is a business decision to confirm; the page just presents it honestly). Include a short FAQ on fees, currency (NGN), and how settlement/payout costs work.

## 8. /trust — the page that closes leaders

- How money is handled: integer kobo, immutable ledger, idempotency (never double-charge), webhook signature verification, two-step verify (webhook + server-side confirm).
- Tenant isolation as a property of the data model.
- Reconciliation: how internal records match Nomba, and how drift is surfaced.
- Uptime / status page link, incident posture, data protection (NDPR) and PCI posture (card entry stays on Nomba's hosted page).
- **Reasoning:** for billing infra, this page does real sales work. Write it plainly and specifically — vagueness reads as risk.

## 9. /guides — the Hard Parts library

Index + article pages. The content model, article template, starting roster, and one worked example are in **doc 04.** The index groups by theme (Reliability & correctness · The Nigerian payment reality · Billing mechanics · Multi-tenant & infra · Migration guides) and each article ends with a "see it live" exit into the simulator or docs.

## 10. /changelog

- A reverse-chronological, plainly-written list of shipped changes. Quiet but powerful credibility: it proves the thing is alive and shipping. Author from the same MDX pipeline as guides. Link it in the footer and from the header's Resources.

---

## 11. Page → doc cross-reference

- Every section's motion → **doc 03** (by section name).
- The simulator (home §3.3, referenced on /product) → **doc 02.**
- All /guides content, the featured cards (home §3.6), and migration guides (/integrations) → **doc 04.**
- All visual values (color, type, spacing, components) → `nomba-one-design-system.html`.

Proceed to doc 02 for the signature simulator.
