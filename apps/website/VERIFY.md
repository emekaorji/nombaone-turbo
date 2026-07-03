# Verifying the site against the .pen (pixel-perfect loop)

The design source of truth is `workbench/NOMBAONE.pen`. This site is converted from it 1:1. Because the Pencil
and browser renderers rasterize differently (fonts, sub-pixel), we do **not** gate on a strict pixel diff.
The gate is: **agent visual comparison** of the built page against the matching .pen frame, plus **structural /
interaction / a11y** checks in Playwright.

## The loop (per page)

1. **Reference** — open the .pen frame with the Pencil MCP `get_screenshot(nodeId)` (map below). Re-shoot once
   if the first render is stale (a known Pencil quirk).
2. **Build** — compose the page from the shell + primitives against that reference.
3. **Actual** — `pnpm --filter @nombaone/website test:e2e` boots the dev server (port 8050) and captures
   `.design-refs/actual/{desktop,mobile}/<page>.png`. Read those PNGs to inspect the render.
4. **Compare + iterate** — line up spacing, type scale, colours, and states against the reference. Repeat
   until it matches. Confirm no page errors and that `header`/`footer` are present (the spec asserts this).
5. **Regression** — `pnpm --filter @nombaone/website build` must stay green (28 routes, MDX prerendered).

Manual/interactive inspection: `pnpm --filter @nombaone/website dev` then drive the running app with the
agent-browser tool for hovers, the mobile nav sheet, and the rainbow-nav animation.

## Route -> .pen node id (reference frames)

| Route | Desktop | Mobile |
|---|---|---|
| `/` | `vrJWr` | `jFZCc` |
| `/product` | `pJKvh` | `kcVJ2` |
| `/integrations` | `O3LC0` | `a81wq9` |
| `/use-cases` | `evUZA` | `yXi8F` |
| `/use-cases/school-fees` | `j3YmQ` | `P7s32x` |
| `/pricing` | `ZWTCp` | `y6MsNb` |
| `/trust` | `wiUVb` | `jcXEP` |
| `/guides` | `s3TZO` | `A56Ki` |
| `/guides/[slug]` (article) | `hqlRa` | `ffgGL` |
| `/changelog` | `cUWxV` | `qXqgW` |
| `/hall` | `bhynr` | `WkIGX` |

Chrome + system references: Header `HBqRX`, Footer `oAlcJ`, Shell desktop `oPm0C`, Shell mobile `gNvS1`,
design-system board `IsFyq`, Ask modal (desktop `E6Oaai`/`f9X1zy`, mobile `qAezA`), Simulator board `vpYGM`,
Motion board `Qa13H`.

## Design tokens

All colours/radii/motion come from `src/app/globals.css`, ported 1:1 from the .pen variables (dark-first;
`[data-theme="light"]` present). Never hard-code a hex; use the token utilities (`bg-accent`, `text-muted-
foreground`, `bg-surface-2`, `rounded-[var(--r-lg)]`, etc.). Note `accent` is the emerald brand colour.

## Simulator note

`SimulatorStage`/`LifecycleRail` ship as the static doc-02 skins. The live, sandbox-backed simulator and its
`/v1/sandbox/simulations` SSE endpoint are a separate Phase-B sub-project.
