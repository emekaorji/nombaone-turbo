# Workbench

This is where Nomba One's design, build plans, and decisions live as plain markdown. The code is what the
project *does*; the workbench is what it *should* do, and why. Every fresh session — human or AI agent —
starts here. The two source-of-intent documents at the repo root, [`../PRODUCT-OVERVIEW.md`](../PRODUCT-OVERVIEW.md)
(what the product is) and [`../REPLICABLE_PARADIGMS.md`](../REPLICABLE_PARADIGMS.md) (the patterns the
boilerplate ships), are the canonical inputs; the plans here are *derived from* them.

The workbench works because each file has one job. Don't merge them.

## Layout

Planning docs are organised per app under `apps/<app>/`, mirroring the repo's own `apps/` tree:

- **`apps/api/`** — the tenant-facing REST API (the product surface). `SPEC.md` (design: what + why),
  `INTEGRATION.md` (build: how + order), `API.md` (the public `/v1` reference seed).
- **`apps/console/`** — the tenant dashboard (`console.nombaone.xyz`). `CONSOLE-SCOPE.md` (area map + gap
  register), `INTEGRATION.md` (the locked phase plan), the phased build plans (`00-OVERVIEW` → `04-PHASES`),
  and `PROGRESS.md`.
- **`apps/admin/`** — the internal operator panel. `build_plan.md`, `design_system.md`, `ideate.md`.
- **`apps/docs/`** — the developer docs site. `DOCS-SCOPE.md`.
- **`apps/checkout/`** — the end-subscriber surface. `CHECKOUT-SCOPE.md`.

Cross-cutting, non-app assets live at the top level (`assets/` — brand logos, favicons, webmanifest) and the
**design source** (a Pencil `.pen` file) is dropped here when it exists.

## The rules

These aren't preferences — they're how the workbench stays trustworthy.

1. **Every change passes through every layer** — `core-db` schema → migration → `core-contracts`
   (types/validations) → `sara` (domain) → app (API/console/etc.). No layer ships ahead of another.
2. **The design source is canonical.** If a screen isn't in the `.pen` design source, don't build it; if a
   primitive isn't in `@nombaone/ui`, don't invent one. Re-open the design — don't build from memory. (No
   `.pen` yet → build a clean interim UI from `@nombaone/ui`, kept swappable so a later design re-skins it.)
3. **No fake data.** Empty states are honest states. Ship the slot, return empty, document the dependency.
4. **Production-ready by default.** No debug shims, no `// TODO: fix later`.
5. **Plans have order.** Phased plans (`00` → `04`) build in sequence; a phase that `Depends on` an earlier
   one doesn't start until that one is checked off.
6. **Fix root causes, not symptoms.**
7. **Type-check after each layer change.** A clean type-check is the floor; a green suite is the ceiling.
8. **Provider-agnostic.** Nomba is the rail provider, integrated behind the `@nombaone/sara/rails`
   `RailAdapter` abstraction — the core never hardcodes a provider name.

## Lifecycle

- Update the workbench *before* code, not after.
- When a phase ships, its `[ ]`s become `[x]`s, with a one-line note on any trade-off next to the item.
- Workbench files are checked into source control and evolve with the project.

## What this is NOT

- Not a brain dump (working notes belong in PR descriptions).
- Not architecture docs (architecture is the code; the workbench is intent).
- Not a roadmap (phased plans are sequenced delivery).
