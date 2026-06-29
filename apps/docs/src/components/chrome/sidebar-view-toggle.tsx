"use client";

import { cn } from "@/lib/cn";

/** The two sidebar views: the docs tree vs the flattened API reference. */
export type SidebarView = "docs" | "api";

const VIEWS: { id: SidebarView; label: string }[] = [
  { id: "docs", label: "Docs" },
  { id: "api", label: "API Reference" },
];

/**
 * Segmented pill switch at the top of the sidebar that flips between the "Docs"
 * tree and the "API Reference" tree (mirrors dynamic.xyz). Controlled by
 * `SidebarNav`, which owns the active view and the navigation side effect when
 * the user switches.
 */
export function SidebarViewToggle({
  view,
  onChange,
}: {
  view: SidebarView;
  onChange: (view: SidebarView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sidebar view"
      className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1"
    >
      {VIEWS.map((entry) => {
        const active = entry.id === view;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-sm dark:bg-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
