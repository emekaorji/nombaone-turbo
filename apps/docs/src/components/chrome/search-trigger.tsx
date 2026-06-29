"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import { useIsMac } from "@/lib/use-client-value";

import { useSearch } from "./search-provider";

/**
 * The ⌘K search affordance in the topbar: a faux search box that opens the
 * palette. Shows the platform-correct shortcut hint (⌘K on macOS, Ctrl K
 * elsewhere) once mounted.
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { open } = useSearch();
  const isMac = useIsMac();

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search the docs"
      className={cn(
        "group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card pl-2.5 pr-1.5 text-sm text-muted-foreground transition-colors hover:border-purple-300 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-purple-700",
        className,
      )}
    >
      <Search size={15} className="shrink-0" aria-hidden />
      <span className="hidden md:inline">Search…</span>
      <kbd className="ml-2 hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
        {isMac ? "⌘" : "Ctrl"}K
      </kbd>
    </button>
  );
}
