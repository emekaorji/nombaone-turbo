"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CornerDownLeft, FileText, Hash, Search } from "lucide-react";
import MiniSearch from "minisearch";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nombaone/ui/components/ui/dialog";

import { cn } from "@/lib/cn";

import type { SearchDoc } from "@/lib/search-types";

/**
 * The branded ⌘K command palette. Loads the pre-built `search-index.json`
 * (lazily, on first open), indexes it with MiniSearch for fuzzy/prefix
 * matching, and renders results grouped by section, keyboard-first
 * (↑/↓ to move, ⏎ to open, Esc to close). Opens on ⌘K / Ctrl-K globally.
 *
 * Built on the `@nombaone/ui` Dialog (shared brand primitive) rather than cmdk's
 * own filter, so MiniSearch owns the ranking and grouping.
 */
export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [engine, setEngine] = useState<MiniSearch<SearchDoc> | null>(null);
  const [docs, setDocs] = useState<Map<string, SearchDoc>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load + index on first open.
  useEffect(() => {
    if (!open || engine) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/search-index.json");
        const data = (await res.json()) as SearchDoc[];
        if (cancelled) return;
        const ms = new MiniSearch<SearchDoc>({
          fields: ["title", "heading", "text", "section"],
          storeFields: ["title", "heading", "section", "url"],
          searchOptions: {
            boost: { title: 3, heading: 2, section: 1 },
            prefix: true,
            fuzzy: 0.2,
            combineWith: "AND",
          },
        });
        ms.addAll(data);
        setEngine(ms);
        setDocs(new Map(data.map((d) => [d.id, d])));
      } catch {
        // Index missing/unreachable; palette still opens with empty state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, engine]);

  const results = useMemo(() => {
    if (!engine || query.trim().length === 0) return [];
    return engine
      .search(query)
      .slice(0, 24)
      .map((r) => docs.get(String(r.id)))
      .filter((d): d is SearchDoc => Boolean(d));
  }, [engine, query, docs]);

  // Group results by section, preserving rank order.
  const groups = useMemo(() => {
    const map = new Map<string, SearchDoc[]>();
    for (const doc of results) {
      const list = map.get(doc.section) ?? [];
      list.push(doc);
      map.set(doc.section, list);
    }
    return [...map.entries()];
  }, [results]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  // Keep the highlighted index in range as the result set shrinks/grows; the
  // query's own onChange resets it to the top on each keystroke.
  const activeIndex = active < flat.length ? active : 0;

  const go = useCallback(
    (doc: SearchDoc | undefined) => {
      if (!doc) return;
      onOpenChange(false);
      setQuery("");
      router.push(doc.url);
    },
    [onOpenChange, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, Math.max(flat.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(flat[activeIndex]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">

        <DialogTitle className="sr-only">Search the docs</DialogTitle>
        <DialogDescription className="sr-only">
          Search Nombaone documentation by page or section.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search the docs…"
            autoFocus
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <EmptyHint />
          ) : flat.length === 0 ? (
            <NoResults query={query} />
          ) : (
            groups.map(([section, items]) => (
              <div key={section} className="mb-2">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section}
                </p>
                {items.map((doc) => {
                  const index = flat.indexOf(doc);
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(doc)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        isActive
                          ? "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {doc.heading ? (
                        <Hash size={15} className="shrink-0 opacity-60" aria-hidden />
                      ) : (
                        <FileText size={15} className="shrink-0 opacity-60" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {doc.heading ? (
                          <>
                            <span className="text-muted-foreground">{doc.title}</span>
                            <span className="mx-1.5 text-muted-foreground/50">›</span>
                            {doc.heading}
                          </>
                        ) : (
                          doc.title
                        )}
                      </span>
                      {isActive && (
                        <CornerDownLeft size={14} className="shrink-0 opacity-60" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground/70 sm:flex">
          <span>Esc to close</span>
          <span className="text-muted-foreground/40">·</span>
          <span>↑↓ navigate</span>
          <span className="text-muted-foreground/40">·</span>
          <span>⏎ open</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EmptyHint() {
  return (
    <div className="px-3 py-10 text-center">
      <Search size={22} className="mx-auto text-muted-foreground/60" aria-hidden />
      <p className="mt-3 text-sm text-muted-foreground">
        Search guides, concepts, and the API reference.
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Try <span className="font-mono text-accent dark:text-accent">idempotency</span>,{" "}
        <span className="font-mono text-accent dark:text-accent">withdrawals</span>, or{" "}
        <span className="font-mono text-accent dark:text-accent">fees</span>.
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="px-3 py-10 text-center">
      <p className="text-sm text-foreground">
        No matches for{" "}
        <span className="font-medium text-accent dark:text-accent">
          &ldquo;{query}&rdquo;
        </span>
        .
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Check the spelling, or browse the sidebar.
      </p>
    </div>
  );
}
