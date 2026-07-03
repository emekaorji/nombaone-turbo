# Docs — Plan Index & Coordination Ledger

> Start here. The docs roadmap is 11 files: this index, the **contract**
> ([`docs-plan-00-overview.md`](./docs-plan-00-overview.md) — read it first), and nine
> phase plans. Below: the recommended build order, the cross-phase seams the plan authors
> surfaced (so integration risks live in one place), and the open decisions that need a
> human call. **All implementation paths are the real docs app at repo-root `apps/docs/**`**
> — `workbench/apps/docs/**` holds only these plan files.

## The set

| File | Phase | Tasks | One-line |
|---|---|---|---|
| `docs-plan-00-overview.md` | 00 | — | **The contract**: thesis, IA, design system, non-negotiables, tech backbone, antipattern rubric, phase map. |
| `docs-plan-01-foundation-design-system.md` | 01 | ~30 | Shell + island-kit polish; **the emerald migration**; a11y baseline; home shell; component inventory. |
| `docs-plan-02-ia-navigation-voice.md` | 02 | ~40 | Extend `manifest.ts` to the full Diátaxis IA; nav/breadcrumbs/TOC/pager; URL stability; glossary; house style + Vale pack. |
| `docs-plan-03-runnable-spine.md` | 03 | ~30 | **The keystone**: proxy→`/v1/test/*` + SSE; buffet snippet engine; OpenAPI honesty gate; Pagefind; error-code autolink; ephemeral key. |
| `docs-plan-04-error-reference.md` | 04 | ~29 | **Highest leverage**: `/errors` from the registry; `<ErrorExplorer>`; live reproduce; closes the live 404. |
| `docs-plan-05-flagship-simulator-test-toolkit.md` | 05 | ~27 | **The signature asset**: `<LifecycleSimulator>` (bill→fail→dun→recover, real webhooks, "Place Your Bets"); test toolkit; test-method registry. |
| `docs-plan-06-get-started-quickstart.md` | 06 | ~27 | Tutorials: buffet quickstart grid; <10-min first subscription; verify-in-devtools. |
| `docs-plan-07-concepts-hard-parts.md` | 07 | ~? | Explanation + the 17 Hard-Parts essays; kobo linter; idempotency lab; OTP wall; reconciliation cookbook + scrollytelling. |
| `docs-plan-08-api-reference-webhooks.md` | 08 | ~? | Hand-authored per-endpoint reference (18 modules/~80 ops); webhook catalog + verifier; the rail-switcher. |
| `docs-plan-09-agent-native-launch.md` | 09 | ~? | `.md`/`llms.txt`/MCP/Ask-AI; cmd+K executes; changelog + RSS; merchant track; launch gates. |

## Recommended build order (dependency-correct)

`01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09`, but the real graph is:

- **01** (shell + emerald) and **02** (IA + voice) can run in parallel; 01 owns chrome
  *visuals*, 02 owns chrome *data-wiring* — coordinate, don't double-own.
- **03 is the keystone** — 04, 05, 06, 08 all consume its plumbing. Build **03 (A→D→B)**
  before 05 starts.
- **04** before **05** (the simulator links errors) and before **08** (reference links codes).
- **07** depends on **04 + 05** (embeds the simulator + error links). **08** depends on **03 + 04**.
- **09** is last (needs the whole tree) — except its Vale/a11y gates should run continuously.

Leverage order if optimizing for felt developer relief fastest (research): **04 (errors) →
05 (runnable lifecycle) → 07 (hard parts)** convert the manifesto into relief soonest — but
they need 01–03 under them.

## Cross-phase seams (the shared contracts — keep these in sync)

1. **Phase 03 is load-bearing for everything runnable.** Its deliverables that others hard-
   depend on: the schema-driven proxy allowlist incl. `/v1/test/*` (test-base-only guard),
   the **SSE proxy variant**, the ephemeral throwaway-org key **with its webhook endpoint
   pointed at a docs sink**, the error-code rehype transformer, and the `openapi-lint`
   honesty-gate harness. If 03 ships only a single-shot proxy + a bare key, **Phase 05's
   simulator can't show real delivered webhook JSON** and **Phase 06's tutorials 403**.
   Confirm 03's scope covers the ephemeral-org webhook wiring + SSE before 05/06 start.
2. **`apps/api` needs a `./openapi` subpath export.** `@nombaone/api` currently only exports
   `dist/server.mjs`; `buildOpenApiDocument`/`v1Router` are not on the public path. Phase 03
   adds the export + a `buildFullOpenApiDocument()` that **forces `/v1/test/*` into the
   snapshot** (they mount only when `INFRA_ENVIRONMENT==='test'`, so a naive build omits
   them). This is the one sanctioned edit outside `apps/docs` — **confirm it's allowed**
   (fallback: a relative build-time import within the monorepo).
3. **The `/errors#CODE` slug is a frozen, load-bearing contract** across four phases: 02
   freezes the `errors` section slug; 04 generates the per-code anchors; 03's rehype
   transformer links to them; the live API emits `docUrl = docs.nombaone.com/errors#CODE`.
   These must match exactly — the whole "errors are a feature" promise hangs on it.
4. **`<ApiExplorer>` only supports GET/POST today** (`api-explorer.tsx`); ~30 ops are
   PATCH/PUT/DELETE. **Phase 03 must widen it** (Phase 08 consumes it).
5. **The error registry has no code→HTTP-status field.** Phase 04 adds a docs-owned
   `error-status.ts` map seeded from `AppError` throw sites — **verify it against `apps/api`**,
   don't trust the seed blindly.
6. **The flagship simulator's recovery trigger** (method-swap vs `/v1/test/webhooks/simulate`)
   must be pinned against real billing behavior (`runCycle`/dunning) so step 6 reflects what
   actually recovers an invoice — Phase 05 verify against the engine.
7. **`<RailSwitcher>` (08) mounts into Phase-07 guide prose.** 08 ships it as an includable
   partial + a stub so the two phases aren't hard-ordered.
8. **Presets must be de-example'd.** `<MoneyFlow>`/`<LifecycleStateMachine>`/`<FeeBreakdown>`
   ship bound to the throwaway `example` resource; Phases 05/07/08 must feed them real
   subscription/invoice/dunning/settlement data or the signature visuals teach nothing.

## Open decisions (need a human call)

- **🎨 Emerald vs purple — ✅ DECIDED (user, this session): emerald.** The purple in
  `@nombaone/ui` / the docs is **create-turbo template cruft**, not a product decision. Phase
  01 **purges all purple and any other unneeded template leftovers** and establishes the
  emerald `NOMBAONE.pen` token layer (matching website + console). The cross-surface cleanup
  of `@nombaone/ui`'s purple (which also colors admin) is out of the docs' scope but noted for
  whoever owns admin. No open question remains for the docs.
- **🌐 `docUrl` host vs docs deploy origin.** The API stamps `docs.nombaone.com/errors#CODE`;
  the docs env references `nombaone.xyz`. Reconcile the deploy origin and the `docUrl` origin
  before launch (the honesty gate asserts the `#CODE` *fragment*, which is what matters, but
  the host must resolve in production).
- **🔑 Ephemeral sandbox key + throwaway org lifecycle** (rate limits, TTL, cleanup) — a real
  backend concern surfaced by Phases 03/05/06; scope it when 03 is picked up.

## How to pick up

Read `docs-plan-00-overview.md`, pick a phase whose prerequisites are met (this ledger),
work its `- [ ]` checklist top-to-bottom, tick as you truly demonstrate each (renders + runs
against the real sandbox + passes the honesty gate + a11y + lint), and keep the checkboxes in
sync — the plans are the source of truth.
