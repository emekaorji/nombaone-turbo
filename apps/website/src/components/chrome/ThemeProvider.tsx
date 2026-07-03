"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Dark-first theming. The design system keys off `[data-theme="dark"|"light"]`,
 * so next-themes writes the `data-theme` attribute. A light toggle is optional
 * (doc 03); the light token set already exists in globals.css.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
