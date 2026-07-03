"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps `next-themes` for the docs site. Dark is the default and the theme is
 * expressed as `<html data-theme="dark|light">` — matching the website + console,
 * whose emerald NOMBAONE.pen tokens (vendored into `globals.css`) key off
 * `@custom-variant dark (&:where([data-theme="dark"], …))`. Shiki's dual-theme
 * code blocks follow the same `[data-theme]` gating via CSS.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
