"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { SearchPalette } from "./search-palette";

/**
 * App-wide search coordination: holds the palette open/close state, binds the
 * global ⌘K / Ctrl-K (and `/`) shortcut, and renders the single palette
 * instance. The topbar trigger button calls `useSearch().open()`.
 */

interface SearchContextValue {
  open: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      // `/` opens search unless typing in a field.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const value = useMemo<SearchContextValue>(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchPalette open={isOpen} onOpenChange={setIsOpen} />
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
