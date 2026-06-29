'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { TooltipProvider } from '@nombaone/ui/components/ui/tooltip';

/**
 * Wraps `next-themes` for the console. `attribute="class"` so Tailwind's dark
 * variant (defined in `@nombaone/ui/globals.css`) flips on `<html class="dark">`.
 *
 * `TooltipProvider` is mounted at the root because radix's tooltip state machine
 * relies on a single shared provider; per-instance providers cause hydration
 * mismatches when many tooltips coexist (the sidebar renders one per nav row when
 * collapsed).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </NextThemesProvider>
  );
}
