"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { useL10n } from "@/lib/l10n/context";

import type { TocHeading } from "@/lib/content";

/**
 * Right-rail "On this page" table of contents with scroll-spy. Receives the
 * heading tree from the content layer; an IntersectionObserver tracks which
 * heading is in view and highlights it. Clicking scrolls to the anchor.
 * Honours `prefers-reduced-motion` via CSS (globals collapses smooth scroll).
 */
export function Toc({ headings }: { headings: TocHeading[] }) {
  const { t } = useL10n();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      // Bias the active band toward the top quarter of the viewport.
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label={t("toc.onThisPage")} className="text-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
        {t("toc.onThisPage")}
      </p>
      <ul className="space-y-1 border-l border-border">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-1 leading-snug transition-colors",
                  heading.depth === 3 ? "pl-6" : "pl-3",
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
