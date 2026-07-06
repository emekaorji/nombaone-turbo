import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CopyButton } from "./copy-button";

/**
 * The ONE canonical code-block surface. Every code display in the docs — fenced
 * ```blocks (`<Pre>`), the `<Snippet>` language switcher, and the interactive
 * labs/explorers — renders through this so they are visually identical:
 *
 *   • rounded-lg surface on `--code-bg`, hairline border, subtle shadow, 14px;
 *   • an optional title bar on `--code-titlebar-bg` holding left content (a title,
 *     language, or tabs) with the copy button pinned to its RIGHT;
 *   • a bar-less block falls back to a hover copy-icon overlay so copy is never lost.
 *
 * Pass `bar` for the left-of-bar content; omit it for a bare block. `children` is
 * the `<code>` element (build-time-highlighted, runtime-highlighted, or a plain
 * fallback). `preProps` forwards `data-*` from `rehype-pretty-code`.
 */
export function CodeShell({
  bar,
  barClassName,
  copyValue,
  className,
  preClassName,
  preProps,
  hideCopy = false,
  children,
}: {
  /** Left content of the title bar (title text, language, or tabs). Omit for a bar-less block. */
  bar?: ReactNode;
  /** Override the default bar padding (e.g. tabs supply their own vertical padding). */
  barClassName?: string;
  /** Raw text the copy button writes to the clipboard. */
  copyValue: string;
  /** Extra classes on the outer figure — e.g. `my-6` for a standalone MDX block, or nothing when embedded. */
  className?: string;
  preClassName?: string;
  preProps?: Record<string, unknown>;
  /** Suppress this block's own copy affordance — used inside a `<CodeGroup>`, whose tab strip hosts copy. */
  hideCopy?: boolean;
  /** The `<code>` element to render inside the shared `<pre>`. */
  children: ReactNode;
}) {
  const hasBar = bar !== undefined && bar !== null && bar !== false;

  return (
    <figure
      className={cn(
        "group not-prose overflow-hidden rounded-lg border border-border bg-code-bg text-[14px] shadow-sm",
        className,
      )}
    >
      {hasBar && (
        <figcaption
          className={cn(
            "flex items-center gap-2 border-b border-border/70 bg-code-titlebar-bg px-4 py-2",
            barClassName,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5">{bar}</div>
          {!hideCopy && <CopyButton value={copyValue} className="shrink-0" />}
        </figcaption>
      )}
      <div className="relative">
        {!hasBar && !hideCopy && (
          <CopyButton
            value={copyValue}
            className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          />
        )}
        <pre
          {...preProps}
          className={cn(
            "overflow-x-auto px-4 py-4 font-mono leading-relaxed [&>code]:grid [&>code]:bg-transparent",
            preClassName,
          )}
        >
          {children}
        </pre>
      </div>
    </figure>
  );
}
