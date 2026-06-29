"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-client-value";

/**
 * Theme toggle: cycles system → light → dark, mirroring the admin/console
 * pattern. Icon-only with an `aria-label`; renders a neutral placeholder until
 * mounted to avoid a hydration mismatch on the icon.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const order = ["system", "light", "dark"] as const;
  const next = () => {
    const current = (theme ?? "system") as (typeof order)[number];
    const index = order.indexOf(current);
    setTheme(order[(index + 1) % order.length]);
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={next}
      aria-label={mounted ? `Theme: ${theme ?? "system"}. Click to change.` : "Change theme"}
      className={cn(
        "grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {mounted ? <Icon size={16} /> : <Monitor size={16} className="opacity-0" />}
    </button>
  );
}
