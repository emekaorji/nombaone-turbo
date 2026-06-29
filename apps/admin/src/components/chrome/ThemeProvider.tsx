'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { TooltipProvider } from '@nombaone/ui/components/ui/tooltip';

/**
 * Theme + tooltip root for the panel. `next-themes` with `attribute="class"`
 * flips Tailwind's `dark` variant on `<html class="dark">`. A single shared
 * `TooltipProvider` is mounted here because radix's tooltip state machine relies
 * on one provider — per-instance providers cause hydration mismatches when many
 * tooltips coexist on one route.
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
