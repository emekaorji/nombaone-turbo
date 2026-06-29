# Brand assets

Cross-cutting Nomba One brand assets, served by the apps (favicons, app icons, logos). Layout:

- `logo/black/` and `logo/white/` — the two brand variants, each with `logo.svg`, `favicon.ico`,
  `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`,
  `android-chrome-512x512.png`, `maskable.png`.

Each app copies the variant it needs into its own `public/` (Next serves `/favicon.ico` etc. from there);
add a per-app `site.webmanifest` there if/when a PWA manifest is needed.

The **design source** (Pencil `.pen`) — the canonical source of truth for every screen (workbench rule #2) —
lives at the workbench root (e.g. `NOMBAONE.pen`) once it exists. Until then the apps build a clean interim
UI from `@nombaone/ui`, kept swappable so a later design re-skins without touching behaviour.
