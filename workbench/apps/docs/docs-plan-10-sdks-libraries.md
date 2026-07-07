# Docs — Plan 10 · SDKs, CLI & Libraries (the `/sdks/*` build)
> Turn the "CLI, SDKs, & Libraries" stub into first-class documentation for the nine shipped `nombaone` SDKs + the CLI, on a reworked `/sdks/*` tree, grounded in the SDK source-of-truth briefs. Prerequisites: 01–09 (all landed; hard: 02 manifest/voice + frontmatter contract, 08 the generated `/reference` + `sdk-map.ts`/`snippets.ts`, 04 `/errors`). Serves tenets: **3 (buffet), 6 (docs are the demo), 9 (errors are a feature), 10 (one platform, one language).**

## Goal

Nine official SDKs now ship at `0.1.x` on their registries — Node/TS (`@nombaone/node` 0.1.3), Python (0.1.0),
Ruby (0.1.0), PHP (0.1.2), Go (0.1.0), Rust (0.1.1), Java (`xyz.nombaone:nombaone` 0.1.0), .NET (`NombaOne`
0.1.0), Elixir (0.1.0) — each with a publication-quality brief at `../workbench/sdks/<lang>.md` (outside the
turbo repo) extracted from the real SDK repos (`../nombaone-<lang>/`). But the docs site has **no SDK
documentation**: the `libraries` section in `content/manifest.ts` is populated only with the raw-HTTP
quickstarts, which deliberately say "No SDK needed." The buffet promise is real in code and absent in the docs.

Build a standalone `/sdks/*` section: an authored guide per SDK covering the SDK-specific surface (install,
client, config, conventions, errors, pagination, webhooks helper, sandbox, honest hard parts) plus a
**generated, drift-gated method index** (`<SdkMethodIndex>`) that hands off to the existing 10-language
`/reference/*` operation pages — full coverage, no 78×9 hand-authoring, no second reference that can rot. Ground
`MANIFESTO.md` tenet 3 to the shipped reality. A developer in any of the nine languages goes from `install` to a
verified first subscription without leaving the docs, and every SDK reads as one platform in one voice.

This phase adds **no backend to `apps/api`** and reads `packages/*` / `src/generated/openapi.json` only. Every
runnable sample uses an `nbo_sandbox_` key.

## Prerequisites (what must exist first)

- **Phase 02** — `content/manifest.ts` as nav SSOT (already has the `standalone` mechanism + nested `children`
  support); the frontmatter contract (`title` + `description` ≤320 chars, `section` ∈ manifest keys).
- **Phase 08** — the generated reference: `src/lib/api-ref/model.ts` (`getApiResources()`), `sdk-map.ts`
  (`sdkCall(op)`), `snippets.ts` (`SNIPPET_LANGS` = the 10 langs). `<SdkMethodIndex>` reuses these as-is.
- **Phase 04** — `/errors` (per-SDK error pages deep-link error codes; every `docUrl` must resolve).
- Source-of-truth ranking for SDK facts (SDK-WORKFLOW §2): (1) the SDK repo `../nombaone-<lang>/src/`, (2) the
  brief `workbench/sdks/<lang>.md` (each has a "do not invent" clause), (3) the OpenAPI model, (4) the Node SDK.
  Naming is **`nombaone`** (the `nomba` table in SDK-WORKFLOW §0 is stale). Env var is **`NOMBAONE_API_KEY`**.

## Locked decisions (user, this session)

- **Route layout → a new standalone `/sdks/*` tree**, promoted in the top-nav. The raw-HTTP quickstarts **stay**
  in place (they are the "no dependencies" path); the misleading "CLI, SDKs, & Libraries" section title is
  retired to "Quickstart." No redirects (nothing is being removed).
- **Depth → authored guides + a generated method index** that deep-links into `/reference/*` — not a second
  per-operation reference. Comprehensive and drift-proof.
- **MANIFESTO → accurate-but-timeless voice edit** to tenet 3: all nine languages + the CLI, reconcile
  "Mobile SDKs" to roadmap, no version/registry strings.

## Route shape

```
/sdks                     Overview + <SdkParityMatrix/> (all 9 + CLI: package, registry, version, floor, install)
/sdks/<lang>              The SDK guide: identity/install · SDK quickstart · client + every option · conventions
                          (money/ids/idempotency) · return & pagination idiom · errors · webhooks helper ·
                          sandbox usage · framework coverage (Node) · the honest hard parts  (long page, TOC-nav)
/sdks/<lang>/reference    <SdkMethodIndex lang="<lang>" /> — generated, grouped namespace→method index,
                          each row deep-links /reference/<resource>/<op>
/sdks/cli                 The nombaone CLI  (OPEN DEPENDENCY — see below)
```

`<lang>` ∈ `node, python, ruby, php, go, rust, java, dotnet, elixir`. Errors + webhooks are sections **within**
the main guide page (strong TOC), not separate files — one comprehensive page per SDK keeps the sidebar clean
and the reader oriented; the generated method reference is the one sub-page. Each SDK is a `ManifestItem` in the
new section with `children: [{ …/reference }]` so the sidebar discloses it.

## Deliverables checklist

### (a) Spine — P0
- [x] `src/lib/sdks/registry.ts` — the **single source** of SDK identity facts: `SDKS: SdkMeta[]` with
      `{ id, label, language, package, registry, registryUrl, version, languageFloor, install, clientClass,
      envVar, async, errorModel, webhookHelper }` for all nine, hand-filled from the repos/briefs (Node
      `@nombaone/node`/npm/0.1.3/Node≥22 … Elixir `nombaone`/Hex/0.1.0/Elixir~>1.15). Consumed everywhere so no
      package/version fact is ever retyped in prose.
- [x] `content/manifest.ts` — retitle the `libraries` section to **"Quickstart"** (keep its quickstart items);
      add a new standalone section `{ title: "SDKs & CLI", key: "sdks", standalone: true, mode: "reference" }`
      with items: Overview (`/sdks`), the 9 SDKs (each with a `/sdks/<lang>/reference` child), and `/sdks/cli`.
- [x] `src/components/chrome/top-nav.tsx` — promote **SDKs → `/sdks`** in `PRIMARY` (active on `/sdks*`); narrow
      `Docs` `isActive` to exclude `/sdks`; repoint/remove the Resources "CLI, SDKs, and libraries" entry.
- [x] `src/components/chrome/sidebar-nav.tsx` — teach `DocsSection` to disclose an item's `children` as an
      indented sub-list (backward-compatible: items without children are unchanged). Drives the SDK→reference tree.
- [x] `src/components/mdx/sdk-parity-matrix.tsx` (`<SdkParityMatrix/>`) + register in `mdx/index.tsx` — server
      component rendering the 9-SDK table (+ CLI row) from `registry.ts`.
- [x] `content/sdks/index.mdx` — `/sdks` overview: what an SDK gives you over raw HTTP, the parity matrix, "pick
      your language" cards, cross-link to the raw-HTTP quickstarts.

### (b) Flagship — P1 (Node) — the template every other SDK matches
- [x] `src/components/mdx/sdk-header.tsx` (`<SdkHeader id="node"/>`) + register — install/version/floor/registry
      block from `registry.ts`, with copy-able install command.
- [x] `src/components/mdx/sdk-method-index.tsx` (`<SdkMethodIndex lang="node"/>`) + register — mirror of
      `<ApiReference>`: reads `getApiResources()` + `sdkCall(op)`, renders a grouped namespace→method index; each
      row shows the idiomatic call and links `/reference/<resource>/<op>`. Pure server component.
- [x] `content/sdks/node.mdx` — the full Node guide from `workbench/sdks/nombaone-node.md` (its 15-section spine)
      + `../nombaone-node/examples/`. Every money literal carries a naira comment; webhook sample shows the typed
      `switch (event.type)`; errors via `instanceof`/`err.code`.
- [x] `content/sdks/node/reference.mdx` — `<SdkMethodIndex lang="node" />` + a one-paragraph lede.

### (c) The eight — P2
- [x] `content/sdks/{python,go,php,ruby,java,rust,dotnet,elixir}.mdx` + `…/reference.mdx` — each from its brief +
      repo, matching the Node template, in that language's idiom (Py sync+async, Go `context.Context`-first, Rust
      async+`blocking`, .NET `Task`+`CancellationToken`, Elixir `{:ok,_}`/`!`; casing per language). Each page's
      "honest hard parts" states the language-specific quirks (PHP `$errorCode`; Java `voidInvoice()`; **Ruby
      verifier won't match real deliveries yet — legacy bare-hex signature**; Rust MSRV/`idna` pin; .NET+Elixir
      "dunning may read `none` momentarily").

### (d) Close-out — P3
- [x] `content/sdks/cli.mdx` — the CLI page **once sourced** (open dependency); else a flagged stub.
- [x] `scripts/check-sdks.ts` + `check:sdks` in the `build` chain — the new honesty gate (below).
- [x] `MANIFESTO.md` — tenet-3 edit (below).
- [x] Env-var cleanup — align SDK pages to `NOMBAONE_API_KEY`; fix the raw-HTTP quickstarts' `NOMBAONE_SECRET_KEY`
      so the platform speaks one env var.

## New/changed components & files (path — purpose)

| Path | Purpose |
|---|---|
| `src/lib/sdks/registry.ts` | single source of the nine SDKs' identity facts |
| `src/components/mdx/sdk-parity-matrix.tsx` | `/sdks` comparison table from `registry.ts` |
| `src/components/mdx/sdk-header.tsx` | per-SDK install/version block |
| `src/components/mdx/sdk-method-index.tsx` | generated, drift-gated method index (reuses `api-ref/*`) |
| `src/components/mdx/index.tsx` | register the three new components |
| `content/sdks/index.mdx` · `content/sdks/<lang>.mdx` · `content/sdks/<lang>/reference.mdx` · `content/sdks/cli.mdx` | the section content (1 + 9 + 9 + 1) |
| `content/manifest.ts` | retitle `libraries`→"Quickstart"; add the `sdks` section |
| `src/components/chrome/top-nav.tsx` | promote SDKs in the top-nav |
| `src/components/chrome/sidebar-nav.tsx` | children disclosure for standalone sections |
| `scripts/check-sdks.ts` + `package.json` | the SDK honesty gate |
| `MANIFESTO.md` | tenet-3 grounding |

## The honesty gate — `scripts/check-sdks.ts`

Added to `build` before `next build`. Fails the build unless:
1. **Coverage** — every SDK in `registry.ts` has `content/sdks/<id>.mdx` + `content/sdks/<id>/reference.mdx`;
   every public operation in the api-ref model is representable in `<SdkMethodIndex>` (proves a new API operation
   can't silently vanish from the SDK docs — same spirit as `check-api-ref.ts`).
2. **Single-source integrity** — no SDK page hardcodes a package name or version that disagrees with
   `registry.ts` (grep the authored `content/sdks/*.mdx` for `x.y.z` / package strings and diff).
3. **Env-var honesty** — SDK pages contain `NOMBAONE_API_KEY`, never `NOMBAONE_SECRET_KEY`.

## MANIFESTO grounding (tenet 3 — accurate-but-timeless)

Replace the concrete sentence at `MANIFESTO.md:46` with (voice-preserving; nine languages; CLI real; mobile as
roadmap; no versions/registries):

> "Anywhere, anything, anyhow." Every rail. Every language — an official, idiomatic SDK for Node, Python, Go,
> Ruby, PHP, Java, Rust, .NET, and Elixir, not a lonely wrapper. Every framework, with real guides. A CLI to
> tail webhooks and scaffold locally. Drop-in checkout for any stack. No-code bridges for the merchant with no
> engineer. Mobile, when the demand is there. Raw primitives for the ones who want to build their own thing on top…

## Acceptance criteria (how we know it's done — testable)

- `pnpm --filter @nombaone/docs build` passes with `check:sdks` in the chain (all honesty gates green).
- `/sdks` lists all 9 SDKs + CLI with package/registry/version/floor matching `registry.ts`.
- Each `/sdks/<lang>` renders install, an SDK quickstart, every client option, the error model, the webhooks
  helper, and the honest hard parts; TOC + breadcrumbs + pager work; the sidebar SDK row discloses its reference.
- `<SdkMethodIndex>` covers every public operation for every SDK; each row deep-links a `/reference` op.
- Old `/getting-started/quickstart/*` still resolve (raw-HTTP path preserved); the `.md` mirror, search index,
  and `llms.txt` pick up every new page.
- `MANIFESTO.md` tenet 3 names all nine languages; no "Mobile SDKs" shipped-claim remains.
- One SDK quickstart per language spot-runs green against the live sandbox (key from `workbench/keys.md`, never printed).

## Antipattern watch

- No hand-typed method reference that can drift — the per-method surface is generated from the OpenAPI model.
- No invented CLI commands, SDK methods, params, or fields (each brief's "do not invent" clause is binding).
- No `nomba` naming; no `NOMBAONE_SECRET_KEY` on SDK pages; no floats for money; no version strings in prose
  (only `registry.ts` holds versions).
- Don't duplicate `/reference` — the SDK pages document the SDK-specific surface and hand off for per-op detail.
- Don't hide the ugly (tenet 8): Ruby's unmatched webhook signature, the sandbox mandate 504, the
  `updatePaymentMethod`/`mandates.retrieve`→`PaymentMethod` returns all get stated plainly.

## Manifesto ties

Tenet **3** (the buffet — this whole phase is its proof, and it grounds the tenet's own prose); tenet **6** (docs
are the demo — every SDK sample is runnable against sandbox); tenet **9** (errors are a feature — a dedicated
error-model section per SDK); tenet **10** (one platform, one language — the same vocabulary and page shape
across all nine).

## Open dependency

The **CLI** (`/sdks/cli`) has **no ground-truth brief** in `workbench/sdks/` (only nine SDK maps; SDK-WORKFLOW
mentions "9 SDKs + 1 CLI"). Source real command syntax from the CLI repo (`../nombaone-cli` if present) before
authoring — **do not invent commands**. If unavailable, ship `/sdks/cli` as a flagged stub. Does not block P0–P2.
