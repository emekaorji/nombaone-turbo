"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { type CodeTab, segColor } from "./code-tokens";

/** Tabbed, syntax-coloured code panel (.pen KAOgf). */
export function CodeBlock({ tabs, className }: { tabs: CodeTab[]; className?: string }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active]!;

  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-border bg-surface-1", className)}>
      <div className="flex gap-0.5 border-b border-border px-2 pt-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-2 font-mono text-[12.5px] transition-colors",
              i === active
                ? "border-b-2 border-accent text-foreground"
                : "text-subtle-foreground hover:text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 overflow-x-auto px-5 py-[18px] font-mono text-[13px] leading-[1.35]">
        {tab.lines.map((line, i) =>
          line === null ? (
            <div key={i} className="h-2" aria-hidden />
          ) : (
            <div key={i} className="whitespace-pre">
              {line.map((seg, j) => (
                <span key={j} className={segColor(seg.c)}>
                  {seg.t}
                </span>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
