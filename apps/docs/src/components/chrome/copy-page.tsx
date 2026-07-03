"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copy-page / open-in-AI affordance (Phase 09, docs-as-data). A split button in
 * the article header that hands the current page to an agent: copy the clean
 * Markdown mirror (`<slug>.md`), copy the URL, view the Markdown, or open the
 * page in Claude / ChatGPT pre-loaded with the mirror URL. Client leaf: it
 * reads the current path and writes to the clipboard.
 *
 * The Markdown it copies is the exact `.md` mirror the build emits, so an agent
 * gets the same bytes a human reads — no drift.
 */

const BASE = "https://docs.nombaone.xyz";

interface CopyPageProps {
  /** Page slug, leading slash, no extension (`''` for home). */
  slug: string;
}

function mdUrl(slug: string): string {
  const rel = slug === "" ? "/index" : slug;
  return `${rel}.md`;
}

export function CopyPage({ slug }: CopyPageProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function flash(label: string) {
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1800);
  }

  async function copyMarkdown() {
    try {
      const res = await fetch(mdUrl(slug));
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      await flash("Copied Markdown");
    } catch {
      await flash("Copy failed");
    }
    setOpen(false);
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(`${BASE}${slug || "/"}`);
    await flash("Copied URL");
    setOpen(false);
  }

  const absoluteMd = `${BASE}${mdUrl(slug)}`;
  const aiPrompt = encodeURIComponent(
    `Read the Nomba One documentation page at ${absoluteMd} and help me use it.`,
  );

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <div ref={ref} className="relative not-prose">
      <button
        type="button"
        onClick={copyMarkdown}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[--accent]/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 9V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3M6 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {copied ?? "Copy page"}
        <span
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More copy options"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen((o) => !o);
            }
          }}
          className="-mr-1 ml-0.5 rounded p-0.5 hover:text-[--accent]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={itemClass} onClick={copyMarkdown}>
            Copy as Markdown
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={copyUrl}>
            Copy page URL
          </button>
          <a role="menuitem" className={itemClass} href={mdUrl(slug)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            View as Markdown
          </a>
          <div className="my-1 border-t border-border" />
          <a
            role="menuitem"
            className={itemClass}
            href={`https://claude.ai/new?q=${aiPrompt}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            Open in Claude
          </a>
          <a
            role="menuitem"
            className={itemClass}
            href={`https://chatgpt.com/?q=${aiPrompt}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            Open in ChatGPT
          </a>
        </div>
      )}
    </div>
  );
}
