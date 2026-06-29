"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps `next-themes` for the docs site: `attribute="class"` so the Nombaone UI
 * `@custom-variant dark (&:where(.dark, .dark *))` (from
 * `packages/ui/src/globals.css`) flips on `<html class="dark">`. Shiki's dual
 * theme blocks key off the same `.dark` class via CSS.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
