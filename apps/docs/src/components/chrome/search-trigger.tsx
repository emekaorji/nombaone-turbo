"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { useL10n } from "@/lib/l10n/context";
import { useIsMac } from "@/lib/use-client-value";

import { useSearch } from "./search-provider";

/**
 * The search affordance at the top of the sidebar: a full-width faux search box
 * that opens the palette. Shows the platform-correct shortcut hint (⌘K on
 * macOS, Ctrl K elsewhere) once mounted, pinned to the right of the field.
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { t } = useL10n();
  const { open } = useSearch();
  const isMac = useIsMac();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("search.ariaTrigger")}
      className={cn(
        "group flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:border-accent-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-accent-border",
        className,
      )}
    >
      <Search size={15} className="shrink-0" aria-hidden />
      <span>{t("search.trigger")}</span>
      <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
        {isMac ? "⌘" : "Ctrl"}K
      </kbd>
    </button>
  );
}
