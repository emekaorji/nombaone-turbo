'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Light/dark toggle. The rendered icon depends on the resolved theme, which the
 * server cannot know, so the icon span carries `suppressHydrationWarning` to
 * tolerate the one-frame swap on hydration — cheaper and simpler than a
 * mount-gate state machine (which the cascading-render lint rejects), and the
 * mismatch is a single decorative glyph.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid size-9 place-items-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span suppressHydrationWarning>{isDark ? <Moon size={16} /> : <Sun size={16} />}</span>
    </button>
  );
}
