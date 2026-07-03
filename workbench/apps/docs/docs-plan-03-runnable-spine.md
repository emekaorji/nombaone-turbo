# Docs — Plan 03 · The runnable spine (engineering)

> Build the tech backbone (overview §7) that makes every later runnable/honest feature real: the
> test-instrument-capable proxy, the buffet snippet engine, the OpenAPI honesty gate, real search,
> Shiki+twoslash+error-autolink, and the zero-signup key. **Prerequisites:** Phase 01 (chrome/tokens/a11y
> baseline; emerald accent fixed). **Serves tenets:** 1 (money never wrong), 2 (developer first),
> 3 (a buffet), 4 (curiosity→success), 5 (the API is the product), 6 (docs are the demo), 9 (errors are a feature).

## Goal

Own the plumbing that phases 04–09 consume. After this phase: (1) the `/api/playground` proxy forwards
the real `/v1/test/*` instruments under a **test-base-only** guard, its allowlist **derived from the
in-repo OpenAPI doc** (no hand-maintained path list), plus an **SSE variant** for multi-step streaming;
(2) every `<ApiExplorer>` and every reference page renders **build-time-generated** snippets for
curl/Node/Python/Go/PHP/Ruby/Java in `<CodeGroup>` tabs with `localStorage` language memory, replacing
`buildCurl`/`buildTs`; (3) `pnpm build` and `type-check` go **red on any drift** between the docs and
`buildOpenApiDocument(...)` — no network; (4) `⌘K` search runs on **Pagefind over the built HTML** (sees
rendered islands + error hints) with MiniSearch kept as a fallback; (5) TS blocks get **twoslash** hovers,
fenced blocks get `diff/highlight/focus`, and **every `PUBLIC_ERROR_CODES` token auto-links** to its
`/errors` anchor; (6) a first-timer clicks once, gets a **scoped, short-lived, rate-limited** sandbox key,
and hits a real `201`; (7) zero-result searches + playground error codes feed a private **docs-gap** log;
(8) pages stay static (`generateStaticParams`) with interactivity confined to leaf `'use client'` islands.

This phase writes **no content pages** — it hands 04–09 a spine they can lean on without re-solving it.

## Prerequisites (what must exist first)

- **Phase 01** complete: `@nombaone/ui` tokens wired, emerald accent replacing the stale purple ramp in
  `apps/docs/src/app/globals.css` (and in `<ApiExplorer>`'s purple classes at `api-explorer.tsx:214-220`),
  a11y AA baseline, the docs shell renders.
- **In-repo, already present** (read-only, do not modify their behavior):
  - `buildOpenApiDocument(v1Router, baseUrl)` — `apps/api/src/shared/openapi/build.ts:117`; walks the mounted
    router, inlines the enforced zod schemas, stamps the `PUBLIC_ERROR_CODES` enum onto the `ApiError` default.
  - `v1Router` — `apps/api/src/apps/main/server/routes.ts:31`; `testRouter` is appended **only when
    `env.INFRA_ENVIRONMENT === 'test'`** (`routes.ts:53-56`). ⚠ The snapshot/gate MUST include `/v1/test/*`.
  - `packages/errors/src/codes.ts`: `PUBLIC_ERROR_CODES` (Set, `:259`), `ERROR_CODE_META` (Record with
    `hint` + `docUrl`, `:361`), `DOCS_ERRORS_BASE = 'https://docs.nombaone.com/errors'` (`:341`), the
    `NombaoneErrorCode` type.
  - `apps/api/src/apps/main/modules/test/routes.ts`: `POST /test/payment-methods`, `POST
    /test/subscriptions/:id/advance-cycle`, `POST /test/webhooks/simulate` (scopes `payment_methods:write`,
    `subscriptions:write`, `webhooks:write`).
  - `packages/sara/src/rails/test-sim.ts`: `testBehaviorToken()` + the behavior map (`test_success`,
    `test_decline_insufficient_funds`, `test_decline_expired_card`, `test_decline_do_not_honor`,
    `test_requires_otp`) — the deterministic outcomes the snippet example-registry and the SSE simulation seed.
  - MDX pipeline: `apps/docs/src/lib/mdx-pipeline.ts` (**keep `@mdx-js/mdx` `evaluate`**, do not swap),
    `apps/docs/src/app/[[...slug]]/page.tsx` (static `generateStaticParams`), the component registry
    `apps/docs/src/components/mdx/index.tsx` (has `ApiExplorer`, `CodeGroup`/`Tabs`/`Tab`, `ParamField`,
    `ResponseField`, `EndpointHeader`).
  - Chrome: `search-provider.tsx` / `search-palette.tsx` / `search-trigger.tsx` (the branded ⌘K UI — keep),
    `feedback.tsx` + `src/app/api/feedback/route.ts` + `src/lib/feedback.ts` (`recordFeedback` → `@nombaone/docs-db`).

> Note: Phase 04 (`/errors`) depends on the **error-code autolink rehype transformer + `DOCS_ERRORS_BASE`
> slug mapping** shipped here. Phase 05 (`<LifecycleSimulator>`) depends on the **SSE proxy variant + the
> `/v1/test/*` allowlist**. Phase 08 (reference) depends on the **snippet engine + honesty gate**. Build those
> three sub-areas first if sequencing within the phase.

## Deliverables checklist

> Group order below is the recommended build order. Each `- [ ]` names the exact file(s) and an acceptance bar.

### A · Build-time OpenAPI snapshot (the single source both the gate and the snippet engine consume)

- [ ] **Expose the OpenAPI builder + router to the docs build without a network hop.** Add a package export
  so the docs can import `buildOpenApiDocument` and `v1Router`: edit `apps/api/package.json` to add an
  `"./openapi"` subpath export resolving to a tiny `apps/api/src/shared/openapi/public.ts` that re-exports
  `buildOpenApiDocument` (from `./build`) and a **`buildFullOpenApiDocument()`** helper that constructs a
  router **with `testRouter` always appended** (independent of `INFRA_ENVIRONMENT`) so `/v1/test/*` operations
  are always in the snapshot. *Accept:* `import { buildFullOpenApiDocument } from "@nombaone/api/openapi"`
  type-checks from `apps/docs`; the returned `paths` include `/v1/test/payment-methods`,
  `/v1/test/subscriptions/{id}/advance-cycle`, `/v1/test/webhooks/simulate`.
- [ ] **Write `apps/docs/scripts/build-openapi-snapshot.ts`** — imports `buildFullOpenApiDocument()`
  (no `fetch`, no live server), writes the doc to `apps/docs/src/generated/openapi.json` and a typed
  `apps/docs/src/generated/openapi.d.ts` (operationId → method/path/params/requestBody/responses). Add
  `"openapi:snapshot": "tsx scripts/build-openapi-snapshot.ts"` to `apps/docs/package.json` scripts and make
  `build`/`type-check`/`search:index` depend on it (run it **first**). *Accept:* running the script offline
  produces a committed `openapi.json` whose operation count matches the router; re-running is deterministic
  (stable key order) so CI diffs are clean.
- [ ] **Add `apps/docs/src/generated/.gitignore`-or-commit decision + a `turbo.json` output.** Register
  `src/generated/**` and `public/pagefind/**` as build outputs in `apps/docs/turbo.json` (or the root
  `turbo.json` docs entry) so remote cache keys are correct. *Accept:* `turbo run build --filter=@nombaone/docs`
  restores `src/generated/openapi.json` from cache on a warm run.

### B · Proxy → `/v1/test/*`, schema-driven allowlist, test-base-only guard, SSE variant

- [ ] **Replace the hand-maintained `ALLOWED_PATH_PREFIXES`** in `apps/docs/src/app/api/playground/route.ts`
  (currently the stale `/wallets`,`/payments`,`/payouts`,`/health` at `:33-38`) with a **schema-driven
  allowlist**: `apps/docs/src/lib/playground-allowlist.ts` reads `src/generated/openapi.json` at module load
  and produces a `Set<"METHOD /path-template">` of every operation, **including** the three `/v1/test/*` ops.
  Match incoming `method`+`path` against the templates (convert `{param}`→matcher). *Accept:* a request to a
  path absent from the snapshot returns the existing `403 PATH_NOT_ALLOWED`; a documented op passes; adding an
  endpoint to the API and re-snapshotting auto-allows it with no edit to `route.ts`.
- [ ] **Add the test-base-only guard.** In `route.ts`, before forwarding any `/v1/test/*` (or, defensively,
  any) path, assert `INFRA_API_BASE` resolves to a **sandbox/test host** (env `NEXT_PUBLIC_INFRA_API_BASE`
  must match an allowlisted test-host pattern, e.g. `sandbox.` prefix or an explicit
  `INFRA_TEST_BASE_ONLY=true`); refuse with `403 TEST_BASE_ONLY` if a `/test/*` path is ever paired with a
  non-test base. *Accept:* with a fabricated live base env, a `/v1/test/webhooks/simulate` request is rejected
  server-side and never fetched; a unit test in `apps/docs/src/app/api/playground/route.test.ts` proves it.
  Preserve the existing `nbo_live_` rejection (`:63-69`) unchanged.
- [ ] **Keep the no-logging / curated-header posture.** Do not add request/body logging when extending the
  proxy. The only new passthrough header for `/test/*` is the same curated set (Authorization, Content-Type,
  Idempotency-Key). *Accept:* code review confirms no `console.log`/telemetry of key or body; the header
  allowlist in `route.ts:95-103` is unchanged in shape.
- [ ] **Add the SSE variant `apps/docs/src/app/api/playground/stream/route.ts`** — accepts a JSON array of
  ordered steps (each a `{method,path,body,idempotencyKey}` validated against the same allowlist + test-base
  guard), executes them sequentially, and streams `text/event-stream` frames: one `event: step` per call with
  its status + JSON envelope + `X-Request-Id`, a terminal `event: done`. Reuse the allowlist + guard from the
  single-shot route (extract shared logic into `apps/docs/src/lib/playground-forward.ts`). *Accept:* a 3-step
  script (mint declining PM → create sub → advance-cycle) streams three `step` frames then `done`; a step whose
  path is off-allowlist aborts the stream with an `event: error` and never forwards. Phase 05's
  `<LifecycleSimulator>` consumes this via `EventSource`/`fetch`-stream.
- [ ] **Document the proxy contract inline** in both route files (the security invariants: test-keys-only,
  test-base-only, allowlist-from-snapshot, no logging, short timeout) so the guard rationale survives edits.
  *Accept:* the header comment enumerates all four invariants and points at this plan.

### C · The buffet snippet engine (replace `buildCurl`/`buildTs`)

- [ ] **Author the per-operation example-values registry** `apps/docs/src/generated/examples.ts` (hand-seed
  file, `operationId → { pathParams, query, body, headers }`) covering at minimum every **mutating** op and
  the `/v1/test/*` ops, using **real domain values in integer kobo** and the `test-sim` behavior tokens (e.g.
  the declining-PM example uses `behavior: "decline_insufficient_funds"`). A `tsx scripts/lint-examples.ts`
  fails if an example references an operationId not in the snapshot, or a body field not in the op's schema.
  *Accept:* lint passes; no example uses a naira (₦) float where the schema wants kobo integers.
- [ ] **Write `apps/docs/scripts/generate-snippets.ts`** — for every operation in `src/generated/openapi.json`
  crossed with the example registry, emit idiomatic raw-HTTP snippets for **curl, Node (fetch), Python
  (requests), Go (net/http), PHP (curl), Ruby (net/http), Java (java.net.http)** into
  `apps/docs/src/generated/snippets/<operationId>.json` (`{ lang: string }`). Use an httpsnippet-style
  generator (bundle `httpsnippet` or a vendored minimal generator; **no runtime network**). Wire the script
  into `build`/`type-check` after the snapshot step. *Accept:* every documented op has all 7 languages; the
  curl output for a money POST includes `-H "Idempotency-Key: …"` and an integer-kobo `-d` body.
- [ ] **Build `<CodeGroup>`-backed snippet island** `apps/docs/src/components/mdx/request-snippets.tsx`
  (`'use client'` leaf) that takes an `operationId`, reads the generated snippets, renders them in the existing
  `<CodeGroup>` tabs (`components/mdx/tabs.tsx`), and remembers the chosen language in `localStorage`
  (`nombaone-docs:lang`) shared across the site. *Accept:* switching to Go on one page shows Go first on the
  next; SSR/first-client render agree (gate the read on a `useMounted()` like `api-explorer.tsx:108`).
- [ ] **Rip out `buildCurl`/`buildTs` from `api-explorer.tsx`** (`:525-580`) and render `<RequestSnippets
  operationId={…}>` inside the existing `<details>` "Equivalent request" block (`:368-381`) instead of the two
  hand-built `<Snippet>`s. Give `<ApiExplorer>` a new `operationId` prop (thread it from the reference pages in
  Phase 08). *Accept:* the explorer's snippet tabs are now generated and multi-language; no `buildCurl`/`buildTs`
  strings remain in the file; the live request path (the `send()` → `/api/playground` flow) is unchanged.
- [ ] **Add the curated-SDK slot, lint-checked to exist.** `apps/docs/src/generated/sdk-snippets/<operationId>.ts`
  holds optional hand-written idiomatic SDK examples; `scripts/lint-examples.ts` asserts a curated SDK snippet
  exists **for every mutating operationId** (fail build if missing, so the buffet promise cannot quietly
  regress). *Accept:* the lint lists any mutating op lacking an SDK snippet by operationId and exits non-zero.

### D · The OpenAPI honesty gate

- [ ] **Write `apps/docs/scripts/openapi-lint.ts`** — imports `buildFullOpenApiDocument()` from
  `@nombaone/api/openapi` (**no network**), scans every `.mdx` under `apps/docs/content/**` (parse with
  `gray-matter` + a light JSX-attribute extractor, or re-use the compiled MDX AST), and **fails the process**
  on any of: (1) an `<EndpointHeader>`/`<ApiExplorer>` `method`+`endpoint` that is not an operation in the
  spec; (2) a `<ParamField>`/`<ResponseField>` `name`/`type`/`required` that disagrees with the op's schema;
  (3) an error-code token referenced in MDX or a fenced block that is not in `PUBLIC_ERROR_CODES`; (4) a
  `docUrl`/error anchor pointing at a code with no `/errors#CODE` slug. *Accept:* introducing a deliberately
  wrong param type in a fixture MDX turns the script red with a precise `file:line — expected X got Y` message;
  a correct fixture passes.
- [ ] **Wire the gate as a turbo peer of `type-check`.** Add `"openapi:lint": "tsx scripts/openapi-lint.ts"`
  to `apps/docs/package.json`; make `type-check` (and `build`) depend on `openapi:snapshot` then run
  `openapi:lint`. Register it in `turbo.json` so CI runs it on the docs task graph. *Accept:* `turbo run
  type-check --filter=@nombaone/docs` fails when the docs drift from the spec; green when aligned.
- [ ] **Emit a machine-readable drift report** `apps/docs/src/generated/openapi-lint-report.json` (even on
  success) listing every op and its docs-coverage status, so Phase 08 can see which of the ~80 ops are still
  undocumented. *Accept:* report enumerates all spec operations with a `documented: boolean`.

### E · Search → Pagefind over built HTML (MiniSearch fallback)

- [ ] **Add Pagefind indexing to the docs build.** After `next build`, run `pagefind --site .next/server/app`
  (or the exported HTML dir) writing `apps/docs/public/pagefind/**`; add `"search:pagefind"` to
  `package.json` and chain it **after** `next build` in the `build` script. Add `data-pagefind-body` to the
  content `<article>` in `page.tsx:77` and `data-pagefind-ignore` to chrome (sidebar/topbar/TOC) so only page
  content + rendered islands + error hints are indexed. *Accept:* a term that lives only inside a rendered
  island or an error `hint` (invisible to `toPlainText`) is found by Pagefind.
- [ ] **Back the branded ⌘K UI with Pagefind, keep MiniSearch as fallback.** In
  `search-palette.tsx`/`search-provider.tsx`, query Pagefind's fragment API at runtime; if the Pagefind bundle
  is absent (dev, or index not built) fall back to the existing MiniSearch `public/search-index.json`. Do
  **not** change the palette's markup/keyboard model (⌘K / `/`, `search-provider.tsx:22-45`). *Accept:* ⌘K
  returns Pagefind results in prod build; `pnpm dev` still searches via MiniSearch with no error.
- [ ] **Keep `build-search-index.ts` as the fallback source** but stop treating it as the primary. Leave
  `toPlainText` intact for the fallback only; add a header comment that Pagefind (built HTML) is the source of
  truth and this strips JSX by design. *Accept:* both indexes build; no dead code.

### F · Shiki transformers + twoslash + error-code autolink

- [ ] **Add `@shikijs/transformers` to `mdx-pipeline.ts`.** Extend `prettyCodeOptions` (or add
  `transformers`) with `transformerNotationDiff`, `transformerNotationHighlight`, `transformerNotationFocus`;
  add the matching CSS (diff +/- gutters, focus dimming) to `globals.css` meeting the AA contrast + ~7:1
  syntax bar from overview §4/§6. Do **not** reorder the existing rehype chain (slug → pretty-code → autolink,
  `mdx-pipeline.ts:54-64`). *Accept:* a fenced block using `// [!code ++]` / `[!code focus]` renders diff and
  focus styling in both themes; reduced-motion unaffected.
- [ ] **Add twoslash TS hovers.** Integrate `@shikijs/twoslash` (via `rehype-pretty-code`'s transformer slot)
  for ` ```ts twoslash ` blocks so hovers show real inferred types and compile errors at build. Ensure the
  twoslash type context can resolve the SDK types (add a minimal tsconfig/types shim under
  `apps/docs/src/generated/twoslash-env` if needed). *Accept:* a `ts twoslash` sample with a type error fails
  the build (compile-checked), and a correct one renders hover popovers that pass keyboard/focus a11y.
- [ ] **Write the error-code autolink rehype transformer** `apps/docs/src/lib/rehype-error-autolink.ts` —
  walks fenced JSON/HTTP/text nodes, and for any token exactly matching a member of `PUBLIC_ERROR_CODES`
  (imported from `@nombaone/errors`), wraps it in an anchor to `/errors#CODE` (the same anchor
  `DOCS_ERRORS_BASE` emits). Add it to the rehype chain **after** pretty-code so it operates on tokenized
  output. *Accept:* `"code": "IDEMPOTENCY_KEY_REUSED"` inside a JSON error block renders as a link to
  `/errors#IDEMPOTENCY_KEY_REUSED`; a non-code string is untouched; links are keyboard-focusable with visible
  focus ring. (Phase 04 owns the `/errors` target page; this transformer must not 404 once 04 lands — coordinate
  the slug format now.)

### G · The ephemeral zero-signup sandbox key

- [ ] **Add `apps/docs/src/app/api/sandbox-key/route.ts`** — a POST that mints a **scoped, short-lived,
  rate-limited** sandbox test key (+ throwaway org) by calling the infra sandbox provisioning endpoint
  server-side with a docs-owned service credential (env `INFRA_SANDBOX_PROVISION_TOKEN`), never exposing that
  credential to the browser. Rate-limit per IP (reuse the feedback DB or an in-memory/edge limiter); the minted
  key is `nbo_test_…`, scoped to the read+write scopes the quickstart needs, TTL ≤ 24h. *Accept:* two rapid
  calls from one IP → second returns `429`; the response contains only a test key + expiry, never a live key;
  the provision token never appears in any client bundle.
- [ ] **Auto-populate the explorer.** Add a `<GetSandboxKey>` island `apps/docs/src/components/mdx/get-sandbox-key.tsx`
  (`'use client'`) that calls the route and writes the returned key into the same `localStorage` slot
  `<ApiExplorer>` reads (`LS_KEY = "nombaone-docs:test-api-key"`, `api-explorer.tsx:37`), then surfaces a
  "key ready — try any request" affordance. *Accept:* clicking it, then scrolling to any `<ApiExplorer>`, the
  key field is pre-filled and a real `201` is one click away with zero signup.
- [ ] **Honesty guardrails.** The minted key is visibly labelled sandbox/test in the UI; the route refuses to
  ever return a `nbo_live_` key; if provisioning is unavailable the island degrades to a "paste your own test
  key" prompt (never a fake key). *Accept:* provisioning-down path shows the manual fallback, not a stub key.

### H · Feedback → docs-gap loop

- [ ] **Extend the feedback sink to record docs-gap signals.** Add `recordZeroResultSearch(query)` and
  `recordPlaygroundError(code, path)` to `apps/docs/src/lib/feedback.ts`, backed by new tables in
  `@nombaone/docs-db` (docs analytics DB, **never** the financial DB — mirror the existing `recordFeedback`
  boundary). Add a route `apps/docs/src/app/api/docs-gap/route.ts` (or extend `feedback/route.ts`) that
  accepts these events, validating shape and silently swallowing failures (same posture as
  `feedback/route.ts:9-13`). *Accept:* a schema migration is generated via `drizzle-kit generate` (not push);
  rows land in the docs DB; nothing touches financial tables.
- [ ] **Emit the signals from the client.** In `search-provider.tsx`/`search-palette.tsx`, fire
  `recordZeroResultSearch` (debounced) when a query returns zero hits; in `api-explorer.tsx`'s `send()` result
  handling (`:188-194`) and the SSE stream client, fire `recordPlaygroundError` when the envelope `error.code`
  is present. Both fire-and-forget, no PII, no key. *Accept:* a deliberately empty search and a deliberately
  failing playground call each create exactly one gap row; the reader never sees a blocking error.
- [ ] **(Defer the dashboard UI to Phase 09)** — this phase only guarantees the **data is captured**. Leave a
  `-- TODO(09): docs-gap dashboard` marker. *Accept:* Phase 09 can query the tables without schema changes.

### I · Static + islands discipline (cross-cutting)

- [ ] **Verify every new interactive piece is a leaf `'use client'` island** under otherwise-RSC pages:
  `request-snippets.tsx`, `get-sandbox-key.tsx`, and the Phase-05-facing SSE client are `'use client'`; the
  snapshot/snippet/lint scripts are build-time only; `page.tsx` keeps `generateStaticParams`
  (`page.tsx:36-41`). *Accept:* `next build` reports the doc routes as static; no new route opts into dynamic
  rendering; client JS added is bounded to the islands.
- [ ] **Register the new MDX islands** in `apps/docs/src/components/mdx/index.tsx` (`RequestSnippets`,
  `GetSandboxKey`) so authors can drop them in `.mdx`. *Accept:* both resolve as MDX tags and render.

## New/changed components & files

| Path | Purpose |
|---|---|
| `apps/api/src/shared/openapi/public.ts` *(new)* | Public re-export: `buildOpenApiDocument` + `buildFullOpenApiDocument()` (testRouter always mounted). |
| `apps/api/package.json` *(edit)* | Add `"./openapi"` subpath export for the docs build to import without network. |
| `apps/docs/scripts/build-openapi-snapshot.ts` *(new)* | Build-time: write `src/generated/openapi.json` + `.d.ts` (no fetch). |
| `apps/docs/src/generated/openapi.json` · `openapi.d.ts` *(new, generated)* | The in-repo spec snapshot every downstream step consumes. |
| `apps/docs/src/lib/playground-allowlist.ts` *(new)* | Schema-driven `METHOD /path` allowlist from the snapshot (incl. `/v1/test/*`). |
| `apps/docs/src/lib/playground-forward.ts` *(new)* | Shared forward+guard logic (test-keys-only, test-base-only, curated headers). |
| `apps/docs/src/app/api/playground/route.ts` *(edit)* | Replace stale prefix list with the allowlist; add test-base guard; keep no-logging. |
| `apps/docs/src/app/api/playground/stream/route.ts` *(new)* | SSE multi-step runner for the lifecycle simulator (Phase 05). |
| `apps/docs/src/generated/examples.ts` *(new)* | Per-operationId example values (integer kobo; `test-sim` behavior tokens). |
| `apps/docs/scripts/generate-snippets.ts` *(new)* | Build-time codegen → curl/Node/Python/Go/PHP/Ruby/Java per op. |
| `apps/docs/src/generated/snippets/*.json` · `sdk-snippets/*.ts` *(new)* | Generated raw-HTTP snippets + curated SDK slot. |
| `apps/docs/scripts/lint-examples.ts` *(new)* | Fail build on unknown operationId/field, or missing SDK snippet for a mutating op. |
| `apps/docs/src/components/mdx/request-snippets.tsx` *(new)* | `<CodeGroup>` snippet tabs w/ `localStorage` language memory. |
| `apps/docs/src/components/mdx/api-explorer.tsx` *(edit)* | Drop `buildCurl`/`buildTs`; render `<RequestSnippets>`; add `operationId` prop; fix purple→emerald. |
| `apps/docs/scripts/openapi-lint.ts` *(new)* | The honesty gate (imports `buildFullOpenApiDocument`, no network). |
| `apps/docs/src/generated/openapi-lint-report.json` *(new, generated)* | Per-op docs-coverage report for Phase 08. |
| `apps/docs/scripts/*` + `apps/docs/public/pagefind/**` *(new/generated)* | Pagefind index over built HTML. |
| `apps/docs/src/components/chrome/search-palette.tsx` · `search-provider.tsx` *(edit)* | Pagefind-backed ⌘K, MiniSearch fallback, zero-result logging. |
| `apps/docs/src/app/[[...slug]]/page.tsx` *(edit)* | `data-pagefind-body` on `<article>`; chrome gets `data-pagefind-ignore`. |
| `apps/docs/src/lib/mdx-pipeline.ts` *(edit)* | Add `@shikijs/transformers`, twoslash, and the error-autolink rehype plugin (chain order preserved). |
| `apps/docs/src/lib/rehype-error-autolink.ts` *(new)* | Auto-link `PUBLIC_ERROR_CODES` tokens → `/errors#CODE`. |
| `apps/docs/src/app/api/sandbox-key/route.ts` *(new)* | Mint scoped, short-lived, rate-limited sandbox key + throwaway org. |
| `apps/docs/src/components/mdx/get-sandbox-key.tsx` *(new)* | One-click key → auto-populates `<ApiExplorer>` localStorage. |
| `apps/docs/src/lib/feedback.ts` *(edit)* + `apps/docs/src/app/api/docs-gap/route.ts` *(new)* | Log zero-result searches + playground error codes to the docs DB. |
| `@nombaone/docs-db` migration *(new)* | `docs_gap` tables via `drizzle-kit generate`/`migrate` (never `push`). |
| `apps/docs/src/components/mdx/index.tsx` *(edit)* | Register `RequestSnippets`, `GetSandboxKey`. |
| `apps/docs/package.json` · `turbo.json` *(edit)* | New scripts (`openapi:snapshot`, `openapi:lint`, `generate-snippets`, `search:pagefind`) wired into `build`/`type-check`; generated dirs as outputs. |

## Acceptance criteria (testable)

- **Snapshot is offline + complete:** `pnpm -F @nombaone/docs openapi:snapshot` runs with no network and
  writes an `openapi.json` whose `paths` include all `/v1/test/*` ops; re-running is byte-stable.
- **Proxy forwards test instruments, safely:** a `POST /api/playground` for `/v1/test/payment-methods` with a
  test key succeeds against the sandbox; the same path against a fabricated live base is rejected `403
  TEST_BASE_ONLY` and never fetched; `nbo_live_` keys still rejected `422`; no key/body logging.
- **SSE streams multi-step:** the stream route yields one `event: step` per allowlisted call with status +
  envelope + `X-Request-Id`, then `event: done`; an off-allowlist step aborts with `event: error`.
- **Buffet is generated, not hand-typed:** every documented op renders 7 languages in `<CodeGroup>` with
  `localStorage` language memory; `buildCurl`/`buildTs` are gone; every mutating op has a curated SDK snippet or
  the build fails.
- **Honesty gate is red on drift:** flipping a `<ParamField>` type or citing a non-`PUBLIC_ERROR_CODES` code
  fails `turbo run type-check --filter=@nombaone/docs`; aligned docs pass. No runtime `fetch` of the spec anywhere.
- **Search sees islands + hints:** ⌘K (prod build) finds a term that exists only inside a rendered island or an
  error `hint`; dev falls back to MiniSearch with no error.
- **Highlighting + autolink:** diff/highlight/focus notations render AA-contrast in both themes; a `ts twoslash`
  block with a type error fails the build; every `PUBLIC_ERROR_CODES` token in a fenced block links to
  `/errors#CODE`.
- **Zero-signup 201:** clicking `<GetSandboxKey>` pre-fills the explorer key and a subsequent request returns a
  real `201`; a second rapid mint is `429`; provisioning-down degrades to manual paste (never a stub key).
- **Docs-gap captured:** an empty search and a failing playground call each write exactly one row to the docs
  analytics DB (migration generated, not pushed); financial DB untouched; reader never blocked.
- **Still static:** `next build` reports doc routes static; all new interactivity is leaf `'use client'`;
  `evaluate` pipeline and `generateStaticParams` unchanged.

## Antipattern watch (overview §10, most relevant here)

- ❌ **Calling the sandbox directly from the browser** — keep every call behind `/api/playground` (+ the SSE
  route); the live-key rejection and allowlist live server-side. No client-direct "optimization."
- ❌ **Breaking the `/v1/test/*` test-env guard** — the allowlist is snapshot-driven **and** the base is
  test-only-guarded; never forward a `/test/*` path to a live base.
- ❌ **Hand-maintained multi-language snippets** — generate from `openapi.json` + the example registry;
  `buildCurl`/`buildTs` must be deleted, not extended.
- ❌ **A reference not CI-checked against the spec** — the gate imports `buildFullOpenApiDocument` and fails the
  build on drift; for a money API "docs wrong ⇒ money wrong."
- ❌ **Runtime-fetching `openapi.json`** — consume the committed build-time snapshot only; no network in the
  snippet engine, gate, or reference render.
- ❌ **Swapping the MDX `evaluate` pipeline** — extend the rehype chain (transformers/twoslash/autolink) but do
  **not** replace `@mdx-js/mdx` `evaluate` (it alone preserves multi-line JSX expression-attribute props).
- ❌ **Indexing stripped markdown** — Pagefind indexes built HTML; MiniSearch/`toPlainText` is fallback only.
- ❌ **Error tokens/`docUrl` pointing at a 404** — coordinate the `/errors#CODE` slug with Phase 04 now so the
  autolink target resolves the moment 04 lands.
- ❌ **AI/interactive affordances as decoration** — the ephemeral key must yield a real `201`; the SSE route must
  stream real signed calls; no `setTimeout` theatre.
- ❌ **Live keys/money anywhere** — the mint route can only ever return `nbo_test_…`; the proxy refuses live keys.

## Manifesto ties

- **Tenet 1 (the money is never wrong):** the example registry is integer-kobo only and lint-checked; the gate
  ties every documented field to the enforced schema so the reference can't advertise a wrong shape/unit.
- **Tenet 2 (the developer is our first user):** the zero-signup ephemeral key collapses curiosity→first-`201`
  to one click; snippets pre-fill the reader's stack.
- **Tenet 3 (a buffet, not a menu):** 7 languages generated from one source, with a lint-enforced curated SDK
  slot — "can I use this with __?" is always yes.
- **Tenet 4 (curiosity → first success in minutes):** the SSE proxy + test-instrument allowlist make the
  watch-it-happen simulator (Phase 05) real; the ephemeral key removes the signup gate.
- **Tenet 5 (the API is the product):** the honesty gate makes the served spec the source of truth the docs
  cannot outrun.
- **Tenet 6 (docs are the demo):** every try-it and stream hits the real sandbox; Pagefind indexes what the
  reader actually sees.
- **Tenet 9 (errors are a feature):** every `PUBLIC_ERROR_CODES` token auto-links to its `/errors` entry, and
  playground error codes feed the self-correcting docs-gap loop.
