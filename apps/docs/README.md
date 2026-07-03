# `@nombaone/docs` — docs.nombaone.xyz

The developer documentation for the **nombaone public API** (`api.nombaone.xyz/v1`). A bespoke, brand-native MDX site (Next.js 16 App Router) — **not** a generic docs template.

## What it is
- **Custom MDX engine** (no Fumadocs/Nextra) — we own the shell, nav, search, code-blocks, and the component kit, for 1:1 nombaone brand fidelity (`@nombaone/ui` tokens, light/dark).
- **Content** is `.mdx` under [`content/`](./content), rendered by **`@mdx-js/mdx`'s `evaluate`** through a catch-all App-Router route, with a hand-authored nav manifest (`content/manifest.ts`).
- **Signature, interactive experiences**: `<ApiExplorer>` (live "try it" against the sandbox), plus the reference kit (`<EndpointHeader>`, `<ParamField>`/`<ResponseField>`, `<RequestExample>`/`<ResponseExample>`, `<Callout>`) — all a11y + reduced-motion + dark/light.
- **Accuracy:** every endpoint/param/status/error is sourced from the real `@nombaone/core-contracts` (the SSOT).

> ⚠️ **Engine choice:** rendering uses `@mdx-js/mdx` `evaluate`, **not `next-mdx-remote`**. `next-mdx-remote@6` silently drops JSX *expression* attributes (`defaultBody={…}`), passing only string attributes — which broke every component with object/array props. `evaluate` is the canonical renderer and supports the full prop surface.

## Local development
```bash
pnpm -F @nombaone/docs dev      # http://localhost:8030  (search index builds on `build`, not `dev`)
```
No DB, no secrets. The `<ApiExplorer>` proxies to the sandbox via `/api/playground`; the user pastes their own `nbo_test_…` key (held client-side only, never persisted; live keys are hard-blocked).

## Authoring a page
1. Add `content/<section>/<slug>.mdx` with frontmatter (`title`, `description`, `section`, optional `order`, optional `badge`).
2. Register it in `content/manifest.ts` (the sidebar tree is explicit, not magic — a page only appears if it is listed).
3. Use the MDX kit: `Callout`, `Tabs`/`CodeGroup`, `Steps`, `ParamField`/`ResponseField`, `EndpointHeader`, `RequestExample`/`ResponseExample`, `Card`/`CardGroup`. **Object/array props work** (`evaluate`).
- The build-time search indexer (`scripts/build-search-index.ts`) regenerates `public/search-index.json`; the ⌘K palette searches it.

## Environment variables
| Var | Notes |
|---|---|
| `NEXT_PUBLIC_INFRA_API_BASE` | Sandbox base for the explorer/snippets (default `https://sandbox.api.nombaone.xyz/v1`). |
| `NEXT_PUBLIC_NOMBAONE_ENV` | Deployment ring (`local` \| `preview` \| `production`) — drives the topbar env pill. |
| `INFRA_DEMO_SANDBOX_KEY` | Optional shared read-only `nbo_test_` key so GET examples work before a user pastes their own. |
| `DOCS_DATABASE_URL` | Connection string for the **dedicated** docs analytics Neon DB (`@nombaone/docs-db`, separate from the financial DB). Powers the "Was this page helpful?" feedback. Read only at runtime, not at build. Run `pnpm -F @nombaone/docs-db db:generate && pnpm -F @nombaone/docs-db db:migrate` after setting it. |

## Build & deploy
```bash
pnpm -F @nombaone/docs type-check   # tsc --noEmit
pnpm -F @nombaone/docs lint
pnpm -F @nombaone/docs build        # search:index + next build (the /api/playground proxy is dynamic; everything else is SSG)
```
Deploy to **Vercel** (root dir `apps/docs`, port 8030). All pages are SSG except the playground proxy.

## Structure
```
content/                 the MDX (getting-started · reference) + manifest.ts
src/app/[[...slug]]/      catch-all route (evaluate) + /api/playground proxy + /api/feedback
src/components/chrome/    topbar · sidebar · TOC · search palette · theme · pager · breadcrumbs
src/components/mdx/       the MDX kit + the signature components
src/lib/                  content layer · mdx pipeline (remark/rehype) · shiki theme
scripts/build-search-index.ts
```
