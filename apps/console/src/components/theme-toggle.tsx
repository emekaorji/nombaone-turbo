'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Dark/light toggle. Renders both icons and switches via the `dark:` variant
 * (keyed off [data-theme]) so there is no setState-in-effect and no hydration
 * flash — next-themes stamps the attribute before paint.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="block size-4 dark:hidden" />
    </button>
  );
}
