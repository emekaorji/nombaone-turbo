# Docs — Component Inventory

> The hand-off artifact from **Phase 01** (§G). Every chrome + MDX + brand component
> in `apps/docs/src/components`, its category, its current data source, its token-migration
> status after the emerald pass, and **which later phase owns / de-examples it**.
>
> **Token-migration status:** all 76 purple refs across 23 files were migrated to emerald
> semantic tokens in Phase 01·A (`grep -rniE "purple" apps/docs/src apps/docs/content` → 0).
> The "Migration" column notes whether a component carried purple (✓ migrated) or was
> already token-clean (—).
>
> ⚠ **`example`-frozen risk (§10):** components marked **`example`-bound** currently render
> the throwaway `example` resource (deleted with that scaffold). They MUST be given real
> subscription / invoice / dunning / settlement data by their owning phase or the signature
> visual teaches nothing. Flagged per row.

## Chrome (`src/components/chrome/`)

| Component | File | Category | Data source | Migration | Owning phase(s) |
|---|---|---|---|---|---|
| ThemeProvider | `theme-provider.tsx` | chrome | next-themes (`data-theme`, dark default) | ✓ (strategy) | 01 (done) |
| Topbar | `topbar.tsx` | chrome | static | — | 01 / 02 (nav) |
| SidebarNav | `sidebar-nav.tsx` | chrome | `manifest.ts` | ✓ | **02** (IA wiring) |
| Breadcrumbs | `breadcrumbs.tsx` | chrome | `breadcrumbTrailFor` (02) | — | **02** |
| Toc | `toc.tsx` | chrome | page headings (scroll-spy) | — | 01 (mounted) / 02 |
| Pager | `pager.tsx` | chrome | `FLAT_NAV` (02) | ✓ | **02** |
| MethodChip | `method-chip.tsx` | chrome | prop (HTTP method) | ✓ | 02 / 08 |
| SearchProvider | `search-provider.tsx` | chrome | context | — | 03 (Pagefind) |
| SearchTrigger | `search-trigger.tsx` | chrome | context | ✓ | 03 |
| SearchPalette | `search-palette.tsx` | chrome | `search-index.json` | ✓ | **03** (Pagefind + exec-actions 09) |
| Feedback | `feedback.tsx` | chrome | `/api/feedback` | — | 03 (docs-gap loop) / 09 |
| BrandMark | `brand-mark.tsx` | chrome | static (emerald) | ✓ | 01 (done) |
| MobileNav | `mobile-nav.tsx` | chrome | `manifest.ts` | — | 01 (verify) / 02 |
| SidebarViewToggle | `sidebar-view-toggle.tsx` | chrome | dev/merchant toggle | — | 01 / 09 (merchant track) |
| ThemeToggle | `theme-toggle.tsx` | chrome | next-themes | — | 01 (done) |
| EnvPill | `env-pill.tsx` | chrome | static (sandbox/live) | — | 03 / 06 |

## Brand (`src/components/brand/`)

| Component | File | Category | Data source | Migration | Owning phase(s) |
|---|---|---|---|---|---|
| LogoIcon | `logo-icon.tsx` | brand | `--accent` / `--logo-invert` | — | 01 (done) |

## MDX islands & primitives (`src/components/mdx/`)

| Component | File | Category | Data source | Migration | Owning phase(s) |
|---|---|---|---|---|---|
| MDX map | `index.tsx` | primitives | prose element styles + type scale | ✓ | 01 (scale) |
| Callout | `callout.tsx` | primitive | prop | ✓ | — |
| Card | `card.tsx` | primitive | prop | ✓ | 06 (home/grid) |
| CodeBlock / Pre | `code-block.tsx` | primitive | Shiki | ✓ | 03 (twoslash + autolink) |
| CopyButton | `copy-button.tsx` | primitive | prop | — | — |
| Tabs / CodeGroup | `tabs.tsx` | primitive | children | — `example`-bound(demo) | 03 (snippet tabs) |
| InsideTabsContext | `inside-tabs-context.tsx` | primitive | context | — `example`-bound(demo) | 03 |
| Steps | `steps.tsx` | primitive | children | ✓ | 06 |
| Fields (Param/Response) | `fields.tsx` | primitive | prop | ✓ | 08 (reference) |
| EndpointHeader | `endpoint-header.tsx` | signature | prop (method+path) | ✓ | **08** (reference) |
| ApiExplorer | `api-explorer.tsx` | signature | `/api/playground` proxy · **`example`-bound** | ✓ | **03** (proxy + multi-lang + method-widen) / **08** |
| ApiExamples | `api-examples.tsx` | signature | **`example`-bound** | — | **03** (snippet engine) / 08 |
| ReferenceDecoder | `reference-decoder.tsx` | signature | **`example`-bound** | ✓ | **08** (real reference formats) |
| WebhookVerifier | `webhook-verifier.tsx` | signature | Web Crypto (browser) | ✓ | **08** (per-event catalog) |
| MoneyFlow | `money-flow.tsx` | signature | **`example`-bound** double-entry preset | ✓ | **07/08** (real invoice/dunning/settlement) |
| LifecycleStateMachine | `lifecycle-state-machine.tsx` | signature | **`example`-bound** webhook-edge preset | ✓ | **07/08** (real sub + mandate lifecycle) |
| FeeBreakdown | `fee-breakdown.tsx` | signature | **`example`-bound** kobo preset | ✓ | **08** (real fee engine) |
| Quickstart | `quickstart.tsx` | signature | **`example`-bound** runnable hero | ✓ | **06** (real first-subscription) |

## New islands introduced by later phases (not present yet)

| Component | Introduced by | Purpose |
|---|---|---|
| `<ErrorExplorer>` | **04** | Paste an error code/response → jump to its `/errors` entry; live "Reproduce this". |
| `<LifecycleSimulator>` | **05** | The flagship "watch it bill, fail, dun, recover" runner (real test instruments + SSE). |
| `<MoneyUnit>` | **07** | Inline kobo/naira linter widget (defuse the 100× trap). |
| `<IdempotencyLab>` | **07** | Double-charge "cause it, then prevent it" explorable. |
| `<RailSwitcher>` | **08** | Per-rail (card/direct-debit/transfer/crypto) re-render of a lifecycle example. |
| `<GlossaryTerm>` | **02** | Hover/press glossary popover + first-occurrence auto-link. |

## Notes for the orchestrator

- **`example`-bound islands (7 signature + 2 demo-only):** MoneyFlow, LifecycleStateMachine,
  FeeBreakdown, ApiExplorer, ApiExamples, ReferenceDecoder, Quickstart carry the throwaway
  `example` preset. Their owning phase (06/07/08) must swap in real product data before ship,
  or delete the preset with the `example` scaffold — do not ship a signature visual teaching
  the deleted resource.
- **Metadata copy** in `src/app/layout.tsx` still says "wallets, a double-entry ledger, and
  Nigerian rails" (template-generic) and `metadataBase: docs.nombaone.xyz` — the product is
  subscription billing, and the API's `docUrl` origin is `docs.nombaone.xyz`. Reconcile the
  brand copy + origin in **Phase 09** (launch) alongside the `docUrl`-host decision (index ledger).
- **Template residue:** audited — `apps/docs` is a purpose-built app, no create-turbo starter
  cruft (no default README, `public/` is just the search index). Nothing to remove beyond the
  purple layer (done). The metadata copy above is the only template-generic artifact, deferred
  to 09.
