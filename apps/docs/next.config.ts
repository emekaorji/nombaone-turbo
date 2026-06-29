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
};

export default nextConfig;
