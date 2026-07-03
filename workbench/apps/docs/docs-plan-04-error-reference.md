# Docs — Plan 04 · Error Reference / the "failure museum"

> One-line goal: ship `/errors` — generated from `packages/errors` so every code the live API answers with resolves to a reproduce-and-fix page, closing the `docUrl` 404 the API emits on every failure. Prerequisites: 03 (runnable spine — proxy `/v1/test/*` + SSE, the honesty gate harness, the error-code rehype transformer). Serves tenets: 9 (errors are a feature), 6 (if it isn't in the docs it doesn't exist), 8 (honest about the hard parts), 2 (the developer is our first user), 1 (the money is never wrong).

---

## Goal

Turn the error registry into the most useful page in the docs. Today every failure the API returns carries `error.docUrl = https://docs.nombaone.com/errors#<CODE>` (`packages/errors/src/codes.ts` → `ERROR_CODE_META`, `DOCS_ERRORS_BASE`), and **that page returns 404** — a promise the API makes on every error, unkept. Phase 04 ships it as a *failure museum*:

- A **build script generates `/errors` from `ERROR_CODE_META`** so the page's anchors match the API's `docUrl` **exactly** (`#<CODE>`), one entry per **public** code, with status, plain-English hint, the exact trigger conditions, the literal JSON error envelope, and a copy-run "branch on this" recipe.
- **`<ErrorExplorer>`** — paste a code *or* a full JSON error response → resolve, decode, and jump to its entry.
- A **live "Reproduce this"** button per code that fires a *deterministic* request through the Phase-03 proxy (`/v1/test/*` decline/OTP instruments) so the reader sees the **real** error object — only where reproducible; everything else is honestly labeled.
- **Auto-linking**: every error code that appears in the reference, guides, or changelog links to its `/errors` entry, reusing the Phase-03 rehype transformer.
- A **CI honesty-gate extension**: every `docUrl` the API can emit resolves to a real `/errors` anchor, or the build is red.

Related failures are **paired** (`LEDGER_INSUFFICIENT_FUNDS` vs a card decline vs `DUNNING_CARD_UPDATE_REQUIRED` / `MANDATE_NOT_ACTIVE`) so the reader learns the manifesto truth: **"not yet" ≠ "no."**

**~Zero backend.** The registry, the envelope, the error handler, and the test instruments already exist. This is a generation + rendering + CI-gate phase on top of Phase 03's spine.

---

## Prerequisites (what must exist first)

- **Phase 03 — the runnable spine.** Specifically:
  - The playground proxy (`apps/docs/src/app/api/playground/route.ts`) extended with the **`/v1/test/*` allowlist** (schema-driven, **test-base-only** guard) and the **SSE variant** for multi-step reproduces. Phase 04's "Reproduce this" consumes these; today the allowlist is only `/wallets /payments /payouts /health` and there is no test path.
  - The **error-code rehype transformer** (auto-links any `PUBLIC_ERROR_CODES` token in fenced blocks / inline code to `/errors#<CODE>`). Phase 04 reuses it for reference/guides/changelog and adds coverage; it does not re-author it.
  - The **honesty-gate harness** (`apps/docs/scripts/openapi-lint.ts`, wired as a turbo peer of `type-check`). Phase 04 adds an error-`docUrl` assertion to it.
- **In-repo, no network**: import `ERROR_CODE_META`, `PUBLIC_ERROR_CODES`, `NOMBAONE_ERROR_CODES`, `DOCS_ERRORS_BASE`, `errorMetaFor` directly from `@nombaone/errors` (`packages/errors/src/codes.ts`). Never fetch the registry at runtime.
- **Design tokens** finalized in Phase 01 (emerald accent `--accent` `#0bdfa3` dark / `#00a473` light; near-black `#040404`; `--code-bg` ≈ `#16181c`; Geist / Geist Mono; 8px scale; radii base 8). Do **not** copy the stale `purple-*`/`magenta-*` Tailwind classes still living in `reference-decoder.tsx` — those are pre-Phase-01 and are being removed.
- The envelope contract (`packages/core-contracts/src/types/envelope.ts` → `ApiError`): `{ success:false, statusCode, error:{ code, message, hint, docUrl, fields? }, meta:{ requestId } }`. The generated sample envelopes must match this shape byte-for-byte.

---

## Deliverables checklist

> The heart. Each `- [ ]` names the exact file(s) and an acceptance bar. Repo-root-relative paths (the real docs app is `apps/docs/**`, not `workbench/apps/docs/**`).

### A. Generate the `/errors` surface from the registry (the anti-drift core)

- [ ] **Author the code→status map** at `apps/docs/scripts/error-status.ts`: an exhaustive `Record<NombaoneErrorCode, HttpErrorStatusCode>` (import both types from `@nombaone/errors`). The `Record<NombaoneErrorCode, …>` key type makes it compiler-exhaustive — a new code without a status fails `type-check`. Seed each status from the `AppError` factory that throws it (grep `apps/api/src/**` for `AppError.` throw sites; e.g. `*_NOT_FOUND` → 404, `*_VALIDATION_FAILED` → 422, `API_KEY_*` → 401, `*_CONFLICT`/`*_ALREADY_*`/`*_TAKEN` → 409, `RATE_LIMIT_EXCEEDED` → 429, `SYSTEM_*` → 500/502). **Acceptance:** every code in `NOMBAONE_ERROR_CODES` has a status; a unit assertion cross-checks a sample of ≥10 codes against their real `AppError` throw site.
- [ ] **Author the trigger + envelope registry** at `apps/docs/scripts/error-fixtures.ts`: an exhaustive `Record<NombaoneErrorCode, { triggers: string; sampleMessage: string; sampleFields?: ApiFieldErrors; reproduce?: ReproduceRecipe }>`. `triggers` is one plain-English sentence naming the *exact* conditions that fire the code (do not restate the `hint` — the hint is "what to do next", triggers is "what caused it"). `reproduce` is optional and defined in group C. **Acceptance:** exhaustive over `NOMBAONE_ERROR_CODES`; prose passes the Vale pack (Phase 02) — sentence case, present tense, no marketing adjectives.
- [ ] **Write the generator** `apps/docs/scripts/build-error-reference.ts`: imports `ERROR_CODE_META`, `PUBLIC_ERROR_CODES`, `NOMBAONE_ERROR_CODES`, `DOCS_ERRORS_BASE` from `@nombaone/errors` plus the two maps above, and emits a typed data module `apps/docs/src/generated/error-reference.ts`. Each entry: `{ code, anchor, status, hint, docUrl, group, isPublic, triggers, envelope, reproduce? }`. `anchor` is the literal `#`-fragment parsed from `ERROR_CODE_META[code].docUrl` (never re-derived from the code string — parse the real `docUrl` so it can *never* diverge from the wire). `envelope` is a fully-built `ApiError` object (from `error-fixtures`, `error-status`, `errorMetaFor`) ready to `JSON.stringify(…, null, 2)`. `group` comes from the section comments in `codes.ts` (Generic client, API auth, Idempotency, Webhooks, Ledger, Customers, Catalog, Payment methods & mandates, Subscriptions & invoices, Dunning, Settlement, System). **Acceptance:** `pnpm --filter docs build-error-reference` writes the module; it lists exactly the `PUBLIC_ERROR_CODES` set as primary entries and carries the internal codes in a separate `internalCodes` export flagged `isPublic:false`.
- [ ] **Wire the generator into the docs build** in `apps/docs/package.json` (`build` and `type-check` scripts) and `turbo.json` so `error-reference.ts` regenerates before Next builds and is checked in CI. Add `apps/docs/src/generated/` to `.gitignore` OR commit it as a build artifact — match whatever Phase 03 chose for its generated snippet module (cross-reference, do not diverge). **Acceptance:** a clean `pnpm --filter docs build` regenerates the module deterministically (byte-identical on re-run).

### B. The `/errors` page + rendering components

- [ ] **Create the page content** `apps/docs/content/errors.mdx` (Diátaxis: Reference — no tutorial/explanation prose mixed in). It is a thin shell: a one-paragraph intro ("Every failure the API returns names a code and links here. Find your code below, or paste the whole response into the explorer."), then `<ErrorExplorer />`, then `<ErrorReference />`. **Acceptance:** resolves at `/errors` via the existing `[[...slug]]` route + content layer (`src/lib/content.ts` resolves `content/errors.mdx`); renders statically (`generateStaticParams`).
- [ ] **Build `<ErrorReference>`** at `apps/docs/src/components/mdx/error-reference.tsx` (server component; static): reads `apps/docs/src/generated/error-reference.ts`, renders one `<ErrorEntry>` per public code, grouped by `group` with an `<h2 id="group-…">` per group, ordered as `codes.ts` orders them. Sticky group index rail on wide viewports. **Acceptance:** every public code renders exactly once; no runtime fetch; groups match the registry sections.
- [ ] **Build `<ErrorEntry>`** at `apps/docs/src/components/mdx/error-entry.tsx`: the museum exhibit for one code. Anchor target `id={code}` (matching the `#<CODE>` fragment) with `scroll-mt` for the sticky topbar. Renders: the code as a monospace `<h3>`, a status chip (reuse/extend `chrome/method-chip.tsx` styling for HTTP status), the plain-English `hint`, a "When this fires" line (`triggers`), the **literal JSON envelope** in a Shiki block (via `code-block.tsx` `<Pre>`), a **"Branch on this" copy-run recipe** (a `CodeGroup` showing `if (error.code === "<CODE>") { … }` in TS + the curl that surfaces it), and — if `reproduce` present — a `<ReproduceButton>` (group C). **Acceptance:** JSON envelope is valid `ApiError` shape; the branch recipe references `error.code`/`error.hint`/`meta.requestId` from the real envelope; deep-linking `/errors#CUSTOMER_NOT_FOUND` scrolls to and highlights that entry.
- [ ] **Build `<ErrorExplorer>`** at `apps/docs/src/components/mdx/error-explorer.tsx` (`'use client'` leaf island; model the a11y + structure on `reference-decoder.tsx` but with **emerald** tokens, not `purple-*`): a single labelled input/textarea. Accepts (a) a bare code (`CUSTOMER_NOT_FOUND`), (b) a full JSON error response — parse `error.code` out of it, (c) a raw `docUrl` — parse the `#`-fragment. On match: a `role="status"` live region announces the resolved code + its hint, and a "Jump to entry" link navigates to `/errors#<CODE>`. On no-match: name why (unknown code / unparseable JSON / no `error.code` field) — never a dead end. Include 3–4 sample chips (a code, a pasted 404 envelope, a 422-with-fields envelope). **Acceptance:** pasting a real captured `ApiError` JSON resolves to the right entry; unknown input gives an actionable message; full keyboard operation; announced via the live region (mirrors the decoder's `sr-only` pattern).
- [ ] **Register the new components** in `apps/docs/src/components/mdx/index.tsx` `mdxComponents` map (`ErrorReference`, `ErrorExplorer`; `ErrorEntry`/`ReproduceButton` are internal, not MDX-exposed unless an author needs a single inline exhibit — expose `ErrorEntry` too so a guide can embed one code). **Acceptance:** `<ErrorExplorer />` and `<ErrorReference />` render from `.mdx` with no import.

### C. Live "Reproduce this" — real sandbox, honestly labeled

- [ ] **Define the `ReproduceRecipe` type + recipes** in `apps/docs/scripts/error-fixtures.ts`: `{ label, method, path, body?, behavior?, steps? }`. Populate recipes only for **deterministically reproducible** codes through the Phase-03-extended proxy:
  - Request-shaped codes via ordinary documented endpoints: `CLIENT_VALIDATION_FAILED` (POST a deliberately-invalid body → real 422 + `fields`), `API_KEY_MISSING` / `API_KEY_INVALID` / `API_KEY_ENVIRONMENT_MISMATCH` (omit / mangle / wrong-prefix key), `CLIENT_RESOURCE_NOT_FOUND` / `CUSTOMER_NOT_FOUND` / `PLAN_NOT_FOUND` / `SUBSCRIPTION_NOT_FOUND` (bogus id), `IDEMPOTENCY_KEY_REUSED` (same `Idempotency-Key`, two different bodies), `CLIENT_CONFLICT` / `CUSTOMER_EMAIL_TAKEN` / `PLAN_NAME_TAKEN` (create twice).
  - Money-path codes via the **test instruments**: mint a deterministic method with `POST /v1/test/payment-methods` (`behavior: decline_insufficient_funds` → `LEDGER_INSUFFICIENT_FUNDS`; `behavior: requires_otp` → `DUNNING_CARD_UPDATE_REQUIRED`), then drive `POST /v1/test/subscriptions/:id/advance-cycle` and read the resulting error/state (multi-step → SSE recipe).
  - **Leave `reproduce` undefined** for codes that cannot be deterministically caused from a test key (internal invariants: `LEDGER_*_UNBALANCED`, `RECONCILIATION_DRIFT_DETECTED`, `SYSTEM_*`, `RATE_LIMIT_EXCEEDED`, `PLATFORM_MAINTENANCE`, `NOMBA_UNAUTHORIZED`). **Acceptance:** every recipe's `method`+`path` is on the Phase-03 proxy allowlist; every `behavior` token exists in the test-sim registry (`packages/sara/.../test-sim.ts`).
- [ ] **Build `<ReproduceButton>`** at `apps/docs/src/components/mdx/reproduce-button.tsx` (`'use client'` leaf): fires the recipe through `/api/playground` (single-shot) or the SSE variant (multi-step), using the reader's `nbo_test_` key from the shared `localStorage` slot (`nombaone-docs:test-api-key`, same slot `<ApiExplorer>` uses). Renders the **real** returned `ApiError` JSON, echoes `X-Request-Id`, and asserts the returned `error.code` equals the entry's code (a mismatch is a loud visible warning — the museum must not lie). **Acceptance:** clicking Reproduce on `CUSTOMER_NOT_FOUND` shows a real 404 envelope with that code from the sandbox; live keys are refused client-side and server-side; no key present → an inline "paste a test key" prompt, not a silent failure.
- [ ] **Label the non-reproducible codes** in `<ErrorEntry>`: when `reproduce` is absent, render a muted, honest note ("Not reproducible from a test key — this is an internal invariant / rate limit / upstream state") with a cross-link to the relevant Phase-07 hard-part or Phase-05 simulator where the *flow* that surfaces it can be watched. **Acceptance:** no code shows a dead or fake "Reproduce" button; the label states *why* and links somewhere real (never a 404).
- [ ] **Pair related failures.** In `error-fixtures.ts` add an optional `pairedWith: NombaoneErrorCode[]` and render a "Compare" strip in `<ErrorEntry>` for the money-decline family: `LEDGER_INSUFFICIENT_FUNDS` ("not yet — the balance was thin, retry/dun"), a card decline / `DUNNING_CARD_UPDATE_REQUIRED` ("customer action needed — OTP/3DS wall, send the checkout link"), and `MANDATE_NOT_ACTIVE` / `PAYMENT_METHOD_NOT_ACTIVE` ("no usable method — re-authorize"). The strip teaches **"not yet" ≠ "no."** **Acceptance:** the three entries cross-link each other; copy distinguishes retryable-later from needs-customer-action from terminal.

### D. Auto-link every error code to its entry

- [ ] **Apply the Phase-03 error-code rehype transformer** to the reference, guides, and changelog MDX pipelines in `apps/docs/src/lib/mdx-pipeline.ts` (do not fork it — import and register it). Confirm its link target is `/errors#<CODE>` using the *same* set the API emits (`PUBLIC_ERROR_CODES`). **Acceptance:** an error code in any fenced JSON/HTTP block or inline `code` across `content/**` renders as a link to its `/errors` entry.
- [ ] **Add transformer coverage** at `apps/docs/scripts/__tests__/error-autolink.test.ts` (or the repo's test convention): a fixture MDX containing `CUSTOMER_NOT_FOUND` in a fenced block and inline produces an anchor to `/errors#CUSTOMER_NOT_FOUND`; a non-code token (`SOME_RANDOM_STRING`) is left untouched; a code inside the `/errors` page itself is **not** self-linked into a loop. **Acceptance:** tests pass in CI.

### E. CI honesty gate — every emitted `docUrl` resolves

- [ ] **Extend the honesty gate** in `apps/docs/scripts/openapi-lint.ts` (the Phase-03 harness) with an error-`docUrl` assertion: for every code in `PUBLIC_ERROR_CODES`, parse `ERROR_CODE_META[code].docUrl`, extract the `#`-fragment, and assert a matching `id="<CODE>"` exists in the **built** `/errors` HTML (or, pre-build, in the generated `error-reference.ts` entries). Fail the build listing any code whose `docUrl` anchor has no entry. Also assert the reverse: no orphan `/errors` anchor lacks a registry code. **Acceptance:** deleting one entry from the generator turns CI red with the offending code named; a green run proves every wire `docUrl` resolves.
- [ ] **Assert host + shape invariants** in the same gate: every `docUrl` is `${DOCS_ERRORS_BASE}#<CODE>` (no code hand-writes a divergent URL), and `DOCS_ERRORS_BASE` matches the deployed `/errors` origin used by the sitemap. **Acceptance:** a fabricated bad `docUrl` in a fixture fails the gate.

### F. Navigation, IA, a11y & voice

- [ ] **Add the Errors section to nav** in `apps/docs/content/manifest.ts`: a top-level `ManifestSection` (`key: "errors"`) with an item `{ slug: "/errors", title: "Error reference" }`. Keep it a Reference-mode section, distinct from Guides/Concepts. **Acceptance:** `/errors` appears in the sidebar and in `FLAT_NAV` (pager + slug validation pick it up); the URL is stable and never 404s.
- [ ] **a11y pass (hard gate, dark-default)** on `<ErrorReference>`, `<ErrorEntry>`, `<ErrorExplorer>`, `<ReproduceButton>`: WCAG 2.2 AA — 4.5:1 body / 3:1 status chips on `#040404`, focus rings ≥2px emerald `--ring`, the JSON Shiki blocks held to ~7:1, full keyboard for the explorer + reproduce, `role="status"` live regions, descriptive link text ("Jump to CUSTOMER_NOT_FOUND", not "here"). Respect `prefers-reduced-motion` (no scroll-jank on anchor jump). **Acceptance:** axe clean on `/errors`; manual keyboard walk reproduces + explores with no mouse.
- [ ] **Voice/vocabulary pass** with the Phase-02 Vale pack over `error-fixtures.ts` prose and the page shell: sentence case, present tense, second person, verb-first, no marketing adjectives, the locked vocabulary (`organizations` not tenants, `:id` not `:ref`, integer **kobo** in any money example). **Acceptance:** Vale passes in CI; a term never means two things across an entry.
- [ ] **Agent-readable mirror**: ensure the `/errors` page emits its clean `.md` mirror + typed frontmatter and is included in `llms.txt` (Phase 09 owns the mechanism; Phase 04's job is to make the generated content mirror cleanly — the error table must survive `.md` serialization as a real table, not stripped JSX). **Acceptance:** the `.md` mirror of `/errors` lists every public code with hint + status (cross-checked in the Phase-09 llms sync, referenced here so the generator emits mirror-friendly output).

---

## New/changed components & files

| Path | Purpose |
|---|---|
| `apps/docs/scripts/error-status.ts` | **New.** Exhaustive `Record<NombaoneErrorCode, HttpErrorStatusCode>`; compiler-guaranteed complete; seeded from `AppError` throw sites. |
| `apps/docs/scripts/error-fixtures.ts` | **New.** Exhaustive per-code `{ triggers, sampleMessage, sampleFields?, reproduce?, pairedWith? }`. |
| `apps/docs/scripts/build-error-reference.ts` | **New.** Generator: registry + maps → `src/generated/error-reference.ts`; parses anchors from real `docUrl`. |
| `apps/docs/src/generated/error-reference.ts` | **New (generated).** Typed data the page consumes; build artifact, never hand-edited. |
| `apps/docs/content/errors.mdx` | **New.** The `/errors` page shell (Reference mode): intro + `<ErrorExplorer>` + `<ErrorReference>`. |
| `apps/docs/src/components/mdx/error-reference.tsx` | **New.** Static list of all public codes, grouped, with a group index. |
| `apps/docs/src/components/mdx/error-entry.tsx` | **New.** One code exhibit: status, hint, triggers, JSON envelope, branch recipe, reproduce/label, compare strip. |
| `apps/docs/src/components/mdx/error-explorer.tsx` | **New.** `'use client'` — paste code / JSON / docUrl → resolve + jump. Emerald-tokened; a11y modeled on `reference-decoder.tsx`. |
| `apps/docs/src/components/mdx/reproduce-button.tsx` | **New.** `'use client'` — fires a deterministic recipe via the proxy (single/SSE); shows the real error object. |
| `apps/docs/src/components/mdx/index.tsx` | **Edit.** Register `ErrorReference`, `ErrorEntry`, `ErrorExplorer` in `mdxComponents`. |
| `apps/docs/content/manifest.ts` | **Edit.** Add the `errors` section + `/errors` item. |
| `apps/docs/src/lib/mdx-pipeline.ts` | **Edit.** Register the Phase-03 error-code rehype transformer for reference/guides/changelog. |
| `apps/docs/scripts/openapi-lint.ts` | **Edit (Phase-03 file).** Add the error-`docUrl`-resolves + no-orphan-anchor + host/shape assertions. |
| `apps/docs/package.json` / `turbo.json` | **Edit.** Run `build-error-reference` in `build`/`type-check`; gate stays a `type-check` peer. |
| `apps/docs/scripts/__tests__/error-autolink.test.ts` | **New.** Coverage for the auto-link transformer. |

**Reads only (never modified):** `packages/errors/src/codes.ts`, `packages/core-contracts/src/types/envelope.ts`, `apps/api/src/shared/http/error-handler.ts`, `apps/api/src/apps/main/modules/test/**` (to confirm recipes), `packages/sara/**/test-sim.ts` (behavior tokens).

---

## Acceptance criteria (testable)

1. **No emitted `docUrl` 404s.** For every code in `PUBLIC_ERROR_CODES`, `https://docs.nombaone.com/errors#<CODE>` resolves to a rendered entry. The CI gate fails the build if any does not, and fails on any orphan anchor. *(Non-negotiable §4: "Every error resolves.")*
2. **Anchors match the wire exactly.** Every `/errors` entry `id` is the `#`-fragment parsed from the real `ERROR_CODE_META[code].docUrl` — not re-derived — so the page and the API can never diverge.
3. **The explorer decodes a real response.** Pasting a captured `ApiError` JSON (e.g. a 422 with `fields`) resolves to the correct entry and offers a working "Jump to entry" link; unknown input names the reason.
4. **Reproduce is real or honestly labeled.** Every "Reproduce this" button fires the real sandbox through the proxy and returns an `ApiError` whose `error.code` equals the entry's code (verified in-component); codes with no deterministic recipe show a labeled reason + a real cross-link, never a fake button. Live keys are refused. *(§4: runnable is real; test keys only.)*
5. **Auto-link everywhere.** Any public error code in `content/**` reference/guides/changelog renders as a link to its entry (transformer test green); the `/errors` page does not self-loop.
6. **Pairing teaches "not yet" ≠ "no."** The insufficient-funds / OTP-wall / dead-mandate trio cross-links and distinguishes retryable-later vs needs-customer-action vs terminal.
7. **Exhaustiveness is compiler-enforced.** Adding a code to `NOMBAONE_ERROR_CODES` without a status + fixture entry fails `type-check` before it can ship.
8. **a11y AA on dark + one voice.** axe clean on `/errors`; keyboard-only reproduce + explore; JSON contrast ~7:1; Vale pack green over all new prose.
9. **Static + build-time.** `/errors` is statically generated; the registry is consumed at build (no runtime fetch of the registry or `openapi.json`).

---

## Antipattern watch (the §10 rules most relevant here)

- ❌ **Error hints pointing at a 404.** This phase exists to kill exactly this. The gate (E) makes an unresolved `docUrl` a red build.
- ❌ **Faked / mock reproduces.** Every "Reproduce this" hits the real sandbox via the Phase-03 proxy + test instruments; a payments audience opens devtools. Non-reproducible codes are *labeled*, never faked. The component asserts the returned code matches.
- ❌ **Live keys / live money.** Reproduce uses the shared `nbo_test_` slot only; the proxy rejects live keys and the `/v1/test/*` paths are test-base-only (Phase-03 guard). Never forward a test instrument to a live base.
- ❌ **Happy-path-only.** The entire surface is the unhappy path; the money-decline pairing gives declines/OTP/dunning disproportionate care.
- ❌ **Runtime-fetching the registry or spec to render.** Import `@nombaone/errors` at build; the page is static.
- ❌ **Reference proliferation of near-synonym IDs.** One code, one name, one anchor, one entry — the code string is the single canonical key across the wire, the page anchor, the auto-link, and the explorer.
- ❌ **Indexing stripped markdown / un-mirrorable JSX.** The generated table must survive the `.md` mirror as a real table (F) so Pagefind + `llms.txt` see every code and hint.
- ❌ **Dark mode without contrast math.** Status chips, JSON blocks, and focus rings meet the AA/7:1 targets on `#040404`; no `purple-*` carryover from the old decoder.
- ❌ **Blending Diátaxis modes.** `/errors` is pure Reference — no tutorial narrative; deeper "why" links out to Phase-07 hard parts.

---

## Manifesto ties

- **Tenet 9 — Errors are a feature.** The failure museum: every code gets its hint, the exact trigger, the literal envelope, a branch-to-write recipe, and (where honest) a one-click reproduction. The API's promise on every failure is finally kept.
- **Tenet 6 — Docs are the demo / if it isn't in the docs it doesn't exist.** ~130 codes go from "documented nowhere" to "one resolvable, reproducible entry each," generated so coverage is compiler-complete.
- **Tenet 8 — Honest about the hard parts.** The insufficient-funds / OTP-wall / dead-mandate pairing teaches "not yet" ≠ "no"; non-reproducible codes say so plainly instead of pretending.
- **Tenet 2 — The developer is our first user.** At 2am the `docUrl` in their console now lands on a page that tells them exactly what happened and what to do next — and lets them reproduce it in their own sandbox.
- **Tenet 1 — The money is never wrong.** Money-safety codes (`IDEMPOTENCY_*`, `LEDGER_INSUFFICIENT_FUNDS`, `REFUND_*`, `PAYOUT_EXCEEDS_AVAILABLE`, `ESCROW_LOCKED`) are first-class exhibits with real reproductions where safe.
- **Tenet 10 — One platform, one language.** The code string is the one canonical identifier across API, wire `docUrl`, auto-link, explorer, and page anchor; Vale keeps the prose in the locked vocabulary.
