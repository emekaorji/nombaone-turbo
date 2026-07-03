# Docs — Plan 00 · Overview & Contract

> The single source of truth for building the Nomba One developer docs, 0 → 100.
> Every other `docs-plan-0N-*.md` is a phase that obeys this file. Read this first,
> then pick up any phase. Grounded in [`MANIFESTO.md`](../../../MANIFESTO.md) — the
> "Nomba One Way" — which is the lens for every decision below.
>
> **Decision locked: no Pencil design for the docs.** The docs are a themed MDX app
> that inherits the design language (the `.pen` tokens) via `@nombaone/ui`. We use
> the Pencil MCP only to *read* the design system, never to design doc pages. See
> §6 (Design system).

---

## 1. How to use these plans (pick-up-anywhere)

- Each phase file (`docs-plan-01` … `docs-plan-09`) is **self-contained**: a Goal, its
  Prerequisites (which earlier phase output it needs), an explicit **checklist** of
  tasks with the exact files to create/edit, the acceptance criteria, and the
  manifesto tenets it serves.
- **Checkboxes are the state.** `- [ ]` not started, `- [x]` done. Keep them in sync
  as work lands — the plans are the source of truth (a standing project convention).
- You can jump into any phase whose Prerequisites are met. The dependency graph is in
  §9. When in doubt, the order in §9 is the recommended 0→100 sequence.
- A task is "done" only when it is **truly demonstrated** (renders, runs against the
  real sandbox, passes the honesty gate + a11y + lint), never blanket-ticked.
- Definition of done for the whole docs is §8 (The test). Nothing ships that fails it.

---

## 2. The thesis (why our docs win)

The research is unanimous. In 2026 the table-stakes (quickstart grid, OpenAPI-generated
multi-language tabs, a three-column reference, instant search, an LLM/`.md` affordance)
are **settled — you only lose by lacking them**. Real differentiation is three moves:
**(1) runnable, watch-it-happen docs; (2) docs-as-data / agent-native; (3) voice +
honesty.** Our unfair advantage is that we already own every lever the best docs spend
their whole design budget building, and one nobody in our market has:

1. **A live OpenAPI spec** — `GET /v1/openapi.json`, generated from the actually-mounted
   Express router + zod schemas (`apps/api/src/shared/openapi/build.ts`). The reference,
   the try-it panels, and the honesty gate all derive from it.
2. **An error registry where every code carries a plain-English `hint` + a `docUrl`**
   (`packages/errors/src/codes.ts`, ~130 codes, compiler-exhaustive). The live API
   already deep-links every failure to `docs.nombaone.com/errors#CODE` — **a page that
   returns 404 today.** Shipping it closes a promise the API makes on every error.
3. **Test-mode instruments** (built this session) — deterministic test payment methods
   (`success`/`decline_*`/`requires_otp`), an **advance-cycle test clock**, and
   **webhook simulate** (`/v1/test/*`, test-deployment-only). These make docs where a
   developer *watches a subscription bill, fail on a thin balance, and recover through
   dunning — before writing a line of code* — genuinely possible, driven by real signed
   webhooks the reader can inspect in their own devtools.

Plus we start from a **high-craft engine with almost no fuel**: `apps/docs` already ships
a strong chrome (sidebar, topbar, ⌘K search, TOC, breadcrumbs, feedback) and seven
signature interactive MDX islands (`api-explorer` with a live, live-key-rejecting
`/api/playground` proxy, `money-flow` animated double-entry ledger, `lifecycle-state-machine`,
`webhook-verifier` on Web Crypto, `reference-decoder`, `fee-breakdown`, a runnable
`quickstart`) — but **only 4 content pages exist**, ~79 of ~80 endpoints, 40+ webhook
events, and ~130 error codes are undocumented, and **17 already-written "hard parts"
essays sit in `apps/website/content/hard-parts/` unwired**. The gap is content wiring and
a handful of new watch-it-happen components on the proxy + instruments we already own.

**Our positioning, in one line:** *the only payments docs where you watch the hard part
happen — a Nigerian thin-balance subscription fail and recover — and every error, every
rail, every language is runnable and honest.* We beat Stripe by being multi-rail-honest
and simulate-first from the landing page; we beat Paystack/Flutterwave by simply telling
the truths they hide (unreliable webhooks → reconciliation; tokenized-recharge OTP wall;
the kobo/naira 100× trap).

---

## 3. Manifesto → docs (each tenet becomes a concrete commitment)

| Tenet | The docs commitment |
|---|---|
| 1 · The money is never wrong | A persistent **kobo money-unit rail** on every amount (naira hover-convert; the 100× trap defused at point of use). A **double-charge/idempotency lab** the reader can trigger and prevent. CI executes samples with a kobo assertion. |
| 2 · The developer is our first user | Every page answers "what do I feel at 2am?" with relief. Zero-signup ephemeral sandbox key; examples pre-filled; the fastest path to a real `201`. |
| 3 · A buffet, not a menu | **Multi-language snippets generated from one source** (curl/Node/Python/Go/PHP/Ruby/Java). A **rail-switcher** (card/direct-debit/transfer/crypto) on lifecycle guides. A rail × capability × language **parity matrix**. Agent-callable docs. |
| 4 · Curiosity → first success in minutes | The **flagship simulator** (watch it bill/fail/recover) runs with no login. "Verify us in your own devtools" webhook step. A `<10-minute` first-success target on every quickstart. |
| 5 · The API is the product | Reference derived from and CI-checked against `/v1/openapi.json` (the **honesty gate**). One glossary. Idempotency documented as a money-safety contract. |
| 6 · Docs are the demo | Every endpoint a copy-run example. `.md` mirror + `llms.txt`. **If it isn't in the docs it doesn't exist** — so we document all ~80 endpoints, 40+ events, ~130 errors. |
| 7 · Merchants deserve the same care | A parallel **no-code merchant track**, named by what people control, under one design system + voice. |
| 8 · Honest about the hard parts | The **Hard Parts** Explanation track: the 17 essays, the OTP/3DS recharge wall (our live finding), thin-balance dunning, the reconciliation cookbook, the double-charge trap — each paired with a runnable proof. Honesty is the moat. |
| 9 · Errors are a feature | The **Error Reference / "failure museum"**: one page per code from the registry, a live "Reproduce this" button, the hint + the branch-to-write. Every error string in every example auto-links to its page. |
| 10 · One platform, one language | A **Vale rule-pack** enforcing the locked vocabulary across api/docs/console/checkout. One shared design system + voice. cmd+K shares the console's verbs. |

---

## 4. Non-negotiables (the definition-of-done rubric)

Every phase is judged against these. A phase that violates one is not done.

- **Runnable is real.** Anything labeled a simulation/try-it hits the **real sandbox**
  through the server-side proxy. No mocks, no `setTimeout` theatre — a payments audience
  opens devtools.
- **Sandbox/test keys only, ever.** No docs surface touches a live key or live money.
  The proxy rejects live keys; the `/v1/test/*` allowlist is test-base-only.
- **The reference cannot drift.** The **OpenAPI honesty gate** fails the build on any
  mismatch between the docs and `/v1/openapi.json`. If the docs disagree with the
  server, CI is red.
- **Every error resolves.** No `docUrl` points at a 404. Ship `/errors` before we claim
  "errors are a feature."
- **Unhappy paths get disproportionate care.** No happy-path-only page. Declines, OTP
  step-up, `past_due`/`action_required`/`churned`, the double-charge trap are documented
  as loudly as `200`.
- **a11y is a hard gate** (dark-default): WCAG 2.2 AA — 4.5:1 body / 3:1 large / 3:1
  focus (≥2px), syntax highlighting ~7:1, full keyboard, descriptive links + alt text.
- **One voice, one vocabulary.** Google/Microsoft style; the Vale pack passes; a term
  never means two things.
- **Agent-readable.** Every page has a clean `.md` mirror + typed frontmatter; `llms.txt`
  stays in sync in CI.

---

## 5. Information architecture (Diátaxis)

Top-level IA is **Diátaxis** — four modes, never mixed on one page. `content/manifest.ts`
is the single ordered source of truth for nav. Sections:

1. **Get started** *(Tutorials — learning-oriented)*: welcome/overview, the quickstart
   grid (per language/framework), authentication, environments & keys, your first
   subscription, verify-in-your-devtools.
2. **Guides** *(How-to — task-oriented)*: create plans & prices, start a subscription per
   rail, handle webhooks, dunning & recovery, refunds/payouts/settlement, proration &
   plan changes, coupons/credits, going live.
3. **Concepts** *(Explanation — understanding-oriented)*, **including Hard Parts**: how
   billing works, money is integer kobo, the double-charge trap, thin-balance dunning
   ("not yet" ≠ "no"), the card-recharge OTP/3DS wall, reconciliation, multi-rail &
   push/pull, settlement & sub-accounts, the ledger.
4. **API reference** *(Reference — information-oriented, hand-authored per endpoint)*:
   all 18 modules / ~80 operations, each with header, params, response-variant tabs
   (incl. errors), a runnable explorer, multi-language snippets.
5. **Webhooks**: the event catalog (from `webhook-events.ts`), signing/verify, retries &
   replay, delivery guarantee, simulate.
6. **Errors**: `/errors` — the failure museum, one entry per code.
7. **Test toolkit**: the deterministic instruments, behavior tokens, the test clock,
   webhook simulate, the Nigerian test-method registry.
8. **Changelog**: generated by diffing OpenAPI snapshots; RSS.
9. **Migrate**: "Coming from Paystack/Flutterwave" and generic.
10. **For merchants** *(no-code track)*: named by what people control.

URLs are stable and never 404; the glossary links every domain noun to its schema.

---

## 6. Design system (grounded — no Pencil)

**✅ Design-language directive (DECIDED — user, this session):** the docs are **emerald**.
The **purple is template cruft** — `@nombaone/ui/globals.css` ships `--purple-*` (`#695ab0`,
admin's `admin-dashboard.pen`) and the docs currently render purple (~76 `purple` refs across
~23 files + a purple Shiki theme), but that all came from the create-turbo starter, **not**
from a product decision. The **canonical product design language is emerald** — `NOMBAONE.pen`
(what `get_variables` returns below), the tokens the **website** is built in
(`apps/website/src/app/globals.css`) and the **console** inherits 1:1. **Phase 01 purges all
purple and every other unneeded template leftover** and establishes the emerald token layer,
so the docs are one visual system with the website + console (tenet 10). The clean long-term
home for these tokens is a shared emerald layer in `@nombaone/ui` (admin's purple is template
residue too, to be reconciled by whoever owns admin); for the docs build, Phase 01 establishes
emerald in the docs regardless. The docs then add only docs-specific tokens (`--code-bg`,
`--doc-shell-max`, …) on top.

**Authoritative product tokens (from `get_variables` on `NOMBAONE.pen` — emerald):**

- **Accent (emerald):** `--accent` `#0bdfa3` (dark) / `#00a473` (light); hover `#4ee6af` /
  `#007e57`; `--ring` emerald. This is the target; the docs currently render purple (see the
  migration note above — Phase 01 owns it).
- **Background:** `#040404` (near-black) / `#fcfcfc`. Surfaces `--surface-1/2/3`
  `#0d0d0d`/`#171717`/`#232323` (dark).
- **Foreground:** `#fafafa` / `#0d0d0d`; muted `#9e9e9e`; subtle `#696969`.
- **Semantics** (each with a `-bg`): danger `#f14949`, warning `#f6b84d`, success
  `#58cd78`, info `#1899ec`.
- **Type:** `--font-sans` Geist, `--font-mono` Geist Mono.
- **Radii:** sm 6 · base 8 · md 10 · lg 14 · xl 20 · full 999.
- **Spacing:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 (`--space-1..16`).
- **Motion:** fast 120 · base 200 · slow 320 · slower 520.

**Rules:** dark is default; light is a real theme, not an afterthought. Reuse
`@nombaone/ui` primitives; only introduce a new surface when the docs genuinely need one.
Every new component is verified against these tokens (not a `.pen` frame). Meet the a11y
gate in §4 — note `#040404` is near-black (not pure `#000`), which avoids the halation the
research warns about; keep code surfaces slightly lifted (`--code-bg` ≈ `#16181c`).

---

## 7. The runnable-docs tech backbone

The engineering that makes everything above real (owned mostly by Phase 03; every other
phase consumes it):

- **Playground proxy** (`apps/docs/src/app/api/playground/route.ts`) — keep it
  server-side (test-keys-only, host/method/path allowlist, no logging). **Never call the
  sandbox directly from the browser.** Extend the allowlist to `/v1/test/*`
  (schema-driven from the in-repo OpenAPI, test-base-only guard) and add an **SSE
  variant** so multi-step simulations stream.
- **Buffet snippet engine** — replace the hand-built curl/TS strings in `api-explorer.tsx`
  with **build-time codegen** from `openapi.json` + a per-operation example-values
  registry → idiomatic snippets for curl/Node/Python/Go/PHP/Ruby/Java, in `CodeGroup`
  tabs with `localStorage` language memory. An `operationId`-keyed slot holds curated SDK
  snippets, lint-checked to exist for every mutating op.
- **OpenAPI honesty gate** — `scripts/openapi-lint.ts` imports `buildOpenApiDocument`
  from `@nombaone/api` (in-repo, **no network**) and fails the docs build if any
  `EndpointHeader`/`ApiExplorer` method+path, `ParamField`/`ResponseField` name/type, or
  referenced error code / `docUrl` disagrees with the spec. Wire as a turbo peer of
  `type-check`. Phase 2: generate field tables from the spec so they *cannot* drift.
- **Search** — **Pagefind over the built HTML** (sees rendered islands + error hints;
  `MiniSearch`/`toPlainText` currently strips JSX and hints). Keep the branded ⌘K UI.
- **Syntax** — stay on Shiki/`rehype-pretty-code`; add `@shikijs/transformers`
  (diff/highlight/focus) + **twoslash** TS hovers; a rehype transformer auto-links every
  `PUBLIC_ERROR_CODES` token in fenced blocks to its `/errors` page.
- **MDX** — keep `@mdx-js/mdx` `evaluate` (do **not** swap to `@next/mdx`/`next-mdx-remote`;
  they silently drop the multi-line JSX expression-attribute props every island needs).
- **Static + islands** — pages stay static (`generateStaticParams`); interactive pieces
  are leaf `'use client'` islands under RSC pages.
- **Feedback loop** — extend the feedback route to log zero-result searches + playground
  error codes → a private "docs-gap" dashboard (self-correcting docs).
- **Changelog** — diff per-release `openapi.json` snapshots → MDX `/changelog` + RSS.
  **Defer any version-switcher until a real v2 exists.**
- **Ephemeral sandbox key** — a route that mints a scoped, short-lived, rate-limited test
  key + throwaway org, auto-populating the explorer so a first-timer hits a real `201`
  with zero signup.

---

## 8. The test (whole-docs definition of done)

Mirrors the manifesto's own test. We are done when:

- A developer integrates us **without ever talking to us** — landing → working
  integration, no support ticket.
- A skeptic opens devtools and sees our sandbox is **real** — the flagship simulation and
  every try-it fire genuine signed calls they can inspect.
- Something breaks and the error **tells them exactly what to do** — the `docUrl` resolves
  to a live "reproduce + fix" page.
- The **money is never wrong** — kobo everywhere, the unit rail is unmissable, samples are
  CI-executed with a kobo assertion, the double-charge lab proves idempotency.
- A **merchant** can run a subscription without an engineer via the no-code track.
- An **agent** can integrate us from `llms.txt` + the docs MCP without a human reading a
  page.
- **Nothing 404s**, nothing drifts (honesty gate green), a11y AA holds, one voice throughout.

---

## 9. The phase map (0 → 100)

Recommended sequence + dependencies. Each links to its plan file. "Lead with the
error reference, the runnable lifecycle, and the hard-parts import — those convert the
manifesto into felt developer relief fastest" (research), but they need the foundation +
runnable spine first.

| # | Phase | Goal | Depends on |
|---|---|---|---|
| **00** | Overview & contract *(this file)* | The thesis, IA, design system, standards, rubric. | — |
| **01** | Foundation & design-system polish | Finish the chrome/shell + component kit to the tokens; fix accent; a11y baseline; the docs home shell. | 00 |
| **02** | Information architecture & navigation | The Diátaxis `manifest.ts`, nav/breadcrumbs/TOC/pager, URL stability, glossary, voice + Vale vocabulary pack. | 00 |
| **03** | The runnable spine *(engineering)* | Proxy → `/v1/test/*` + SSE; the buffet snippet engine; the OpenAPI honesty gate; Shiki transformers + twoslash + error-code auto-link; Pagefind; the ephemeral sandbox key. | 01 |
| **04** | Error Reference / "failure museum" | `/errors` generated from the registry; `<ErrorExplorer>`; live "Reproduce this"; auto-link from everywhere. *(Highest leverage — closes the live 404, ~zero backend.)* | 03 |
| **05** | Flagship simulator + test toolkit | `<LifecycleSimulator>` (bill→fail→dun→recover, real webhooks, "Place Your Bets"); the test-toolkit page; the Nigerian test-method registry. | 03, 04 |
| **06** | Get started *(Tutorials)* + the buffet quickstart grid | Framework/language grid; `<10-min` first-success tutorial; auth/environments/keys; verify-in-devtools; ephemeral-key first run. | 03 |
| **07** | Concepts + the honest Hard Parts | Import the 17 essays + honor `simulator:` frontmatter; kobo money-unit page + linter; double-charge/idempotency lab; OTP/3DS wall; reconciliation cookbook + adversarial replay; reconciliation scrollytelling; lifecycle explorable; rail-parity matrix. | 04, 05 |
| **08** | API Reference *(hand-authored per endpoint)* + Webhooks + rail-switcher | Per-operation pages for all 18 modules/~80 ops; the webhook event catalog + verifier + signing/retry/replay; the rail-switcher on lifecycle guides. Kept honest by the gate. | 03, 04 |
| **09** | Agent-native, changelog, merchant track, polish & launch | `.md` mirror + `llms.txt` + copy-for-LLM + typed frontmatter; docs MCP + grounded "Ask AI"; cmd+K execute-actions; changelog + RSS; no-code merchant track; Vale + a11y + CI sample-execution; docs-gap dashboard; launch checklist. | all |

---

## 10. Hard rules / antipatterns (never do)

Distilled from every research lane. Any of these is an automatic fail:

- ❌ **Faked simulations / try-its that hit a mock.** Must call the real sandbox via the
  proxy + test instruments. Devtools expose the lie; trust collapses.
- ❌ **Live keys or live money anywhere in docs.** Sandbox/test-only, hard-guarded. One
  live charge from a docs page is unrecoverable.
- ❌ **Calling the sandbox directly from the browser.** Keep the server proxy (live-key
  rejection + allowlist); a client-direct "optimization" is a money-path security regression.
- ❌ **Breaking the `/v1/test/*` test-env guard** in the proxy/SSE — never forward test
  instruments to a live base.
- ❌ **Hand-maintained multi-language snippets.** Generate from spec + example registry, or
  they drift and lie.
- ❌ **A hand-authored reference that isn't CI-checked against `/v1/openapi.json`.** For a
  money API, "docs are wrong" ⇒ "the money is wrong."
- ❌ **Error hints pointing at a 404** (ship `/errors`); **presets frozen on the throwaway
  `example` resource** (use real subscription/invoice/dunning/settlement data).
- ❌ **Happy-path-only docs**; **feature grids that show only green**; hiding declines/OTP/
  `past_due`/reconciliation.
- ❌ **Indexing stripped markdown** (index built HTML); **Algolia-only** hosted crawl as the
  source of truth for a static site.
- ❌ **Swapping the MDX `evaluate` pipeline** (breaks island props); **runtime-fetching
  `openapi.json`** to render (consume at build).
- ❌ **A version-switcher before v2 exists**; **AI/cmd-K as decoration** with nothing behind it.
- ❌ **Blending Diátaxis modes on a page**; **marketing fluff in reference**; **Title Case /
  passive / future tense**; **dark mode without contrast math**.
- ❌ **Reference proliferation of near-synonym IDs** (the Paystack/Flutterwave `tx_ref`/
  `flw_ref`/`trxref` tangle) — one concept, one name everywhere.

---

## 11. Signature novel features (ranked catalog → phase)

The differentiators, most-leverage first (each ties to a phase + tenets):

1. **"Watch it bill, fail, recover" flagship simulator** — real instruments + real signed
   webhooks → inline inspector, "Place Your Bets" predict-then-reveal, no login. *(05 · t4/6/8)*
2. **Error "failure museum"** — `/errors`, per-code, live "Reproduce this". *(04 · t9/6)*
3. **Thin-balance dunning simulator** — the scored axis as a manipulable explorable. *(07 · t8/1/9)*
4. **Double-charge / idempotency lab** — cause it, then prevent it, watch the ledger. *(07 · t1/8)*
5. **Kobo money-unit linter widget** — the 100× trap defused at point of use. *(07 · t1/9)*
6. **Rail-switcher** on lifecycle guides (card/direct-debit/transfer/crypto), honest about
   OTP wall + settlement lag. *(08 · t3/10)*
7. **Nigerian deterministic test-method registry** — token → outcome → error → branch. *(05 · t9/4/2)*
8. **Reconciliation cookbook + adversarial replay simulator** (fire twice / out-of-order /
   dropped → one balance). *(07 · t1/8/5)*
9. **OTP/3DS recharge-wall page** — our live finding + the fallback we built. *(07 · t8/9/6)*
10. **"Coming from Paystack/Flutterwave" migration guide.** *(09/Migrate · t2/8/10)*
11. **Docs-as-MCP + grounded "Ask AI"** over OpenAPI + error registry. *(09 · t3/6/5)*
12. **cmd+K that executes** (run endpoint / advance clock / fire webhook / trigger error),
    sharing the console's verbs. *(09 · t2/10)*
13. **Reconciliation scrollytelling** (money across rails → ledger → sub-account, each step
    → a runnable endpoint). *(07 · t8/10/6)*
14. **Ephemeral zero-signup sandbox key.** *(03 · t4/2)*
15. **WebContainer quickstart terminal** (zero-install; honest that it can't receive
    webhooks — pair with simulate). *(06, later/optional · t3/4)*

---

## 12. Conventions for the phase files

Every `docs-plan-0N-*.md` MUST follow this shape so the set is uniform and pick-up-anywhere:

```
# Docs — Plan 0N · <Phase name>
> One-line goal. Prerequisites: <phases>. Serves tenets: <n…>.

## Goal
## Prerequisites (what must exist first)
## Deliverables checklist        ← the heart; `- [ ]` tasks, each naming exact files
   (group by sub-area; every task states the file(s) to create/edit + the acceptance bar)
## New/changed components & files (table: path — purpose)
## Acceptance criteria (how we know the phase is done — testable)
## Antipattern watch (the §10 rules most relevant here)
## Manifesto ties
```

File/dir conventions all phases obey:
- Content lives in `apps/docs/content/**` as `.mdx`; nav in `apps/docs/content/manifest.ts`.
- Interactive islands in `apps/docs/src/components/mdx/*` (`'use client'` leaves), chrome in
  `apps/docs/src/components/chrome/*`, brand in `.../brand/*`.
- Component names are PascalCase MDX tags (`<LifecycleSimulator>`, `<ErrorExplorer>`,
  `<RailSwitcher>`, `<MoneyUnit>`, `<IdempotencyLab>`). Reuse the existing kit before adding.
- Build tooling in `apps/docs/scripts/*`; the honesty gate + snippet gen run in the docs
  `build`/`type-check` turbo tasks.
- Never touch `apps/api`/`packages/*` from the docs except to **read** the in-repo OpenAPI
  builder and the error registry at build time.
