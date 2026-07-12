import { neverTranslatedRedirects } from "./src/lib/l10n/config";

import type { NextConfig } from "next";

/**
 * Docs site config. Content is `.mdx` under `content/`, compiled by
 * `@mdx-js/mdx`'s `evaluate` inside the catch-all route — NOT by Next's
 * file-based MDX loader — so we deliberately do NOT register `@next/mdx` or
 * extend `pageExtensions`. The only thing Next needs to know about is that
 * `@nombaone/ui` (a workspace source package, not pre-built) is transpiled.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@nombaone/ui", "@nombaone/utils"],

  experimental: {
    // Required once the app has more than one root layout: `(en)`, `(yo)` and
    // `(ha)` each render their own <html>, so the 404 needs a document of its
    // own that belongs to none of them. Without the flag Next silently ignores
    // `app/global-not-found.tsx` and falls back to its built-in 404.
    globalNotFound: true,
  },

  /**
   * The frozen-in-English trees, 308'd at the edge — no function invocation, no
   * render. `/yo/reference/customers/create` → `/reference/customers/create`.
   *
   * Generated from `NEVER_TRANSLATED_*` in `src/lib/l10n/config.ts` so the two
   * cannot drift. Every `source` begins with `/yo` or `/ha`, so no English URL
   * can match one of these rules.
   */
  async redirects() {
    return neverTranslatedRedirects().map((rule) => ({ ...rule, permanent: true }));
  },
};

export default nextConfig;
