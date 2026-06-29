'use client';

import { Moon, Sun1 } from 'iconsax-react';
import { useTheme } from 'next-themes';

/**
 * Light/dark toggle. Both glyphs are always rendered; Tailwind's `dark:` variant
 * shows exactly one based on `<html class="dark">`, so there's no mount-gating
 * effect and no hydration mismatch (the server and client agree on the markup;
 * only CSS visibility differs once the theme class resolves). The click flips
 * `next-themes` to the opposite of the resolved theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Moon size={16} color="currentColor" variant="Outline" className="dark:hidden" />
      <Sun1 size={16} color="currentColor" variant="Outline" className="hidden dark:block" />
    </button>
  );
}
