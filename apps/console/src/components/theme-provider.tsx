'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Dark-first theme provider. next-themes writes the active theme to the
 * `data-theme` attribute on <html>; the design tokens key off that attribute
 * (dark is the :root default, light overrides under [data-theme="light"]).
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
