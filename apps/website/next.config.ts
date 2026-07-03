import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Self-contained marketing site: no workspace UI package to transpile. */
  // Hide the dev-only Next.js indicator so it doesn't overlap footer/hero in
  // pixel-comparison screenshots. No effect on production output.
  devIndicators: false,
};

export default nextConfig;
