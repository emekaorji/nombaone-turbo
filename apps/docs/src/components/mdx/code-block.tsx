"use client";

import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CopyButton } from "./copy-button";
import { useInsideTabs } from "./inside-tabs-context";

/**
 * The `<pre>` override for MDX. `rehype-pretty-code` emits
 * `<pre><code>…lines…</code></pre>` (optionally wrapped in a titled
 * `<figure>`). We wrap that `<pre>` in a branded surface, surface the optional
 * title bar, and overlay a copy button whose value is the block's raw text.
 *
 * The raw text is recovered from the rendered children tree (Shiki splits code
 * into nested spans), so the copy button works without re-running the
 * highlighter on the client.
 */

interface PreProps {
  children?: ReactNode;
  // `rehype-pretty-code` annotates the <pre> with these data props.
  "data-language"?: string;
  "data-theme"?: string;
  title?: string;
  raw?: string;
  className?: string;
}

/** Recursively flatten a React children tree into its text content. */
function extractText(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

export function Pre({ children, title, raw, className, ...rest }: PreProps) {
  const language = rest["data-language"];
  const code = raw ?? extractText(children);
  // Inside a tab group the tab label already names the language, so the
  // caption is redundant; drop it. Standalone fenced blocks keep theirs.
  const insideTabs = useInsideTabs();
  const showCaption = !insideTabs && Boolean(title || language);

  return (
    <figure className="group not-prose my-6 overflow-hidden rounded-lg border border-border bg-[var(--code-bg)] text-[13px] shadow-sm">
      {showCaption && (
        <figcaption className="flex items-center justify-between border-b border-border/70 bg-[var(--code-titlebar-bg)] px-4 py-2">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {title ?? language}
          </span>
          {language && title && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {language}
            </span>
          )}
        </figcaption>
      )}
      <div className="relative">
        <CopyButton
          value={code}
          className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
        <pre
          {...rest}
          className={cn(
            "overflow-x-auto px-4 py-4 font-mono leading-relaxed [&>code]:grid [&>code]:bg-transparent",
            className,
          )}
        >
          {children}
        </pre>
      </div>
    </figure>
  );
}

/**
 * Inline `<code>` override: only styles the chip variant; fenced blocks pass
 * through (their `<code>` lives inside our `<Pre>` and is already highlighted).
 */
export function InlineCode({
  children,
  className,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
}) {
  // Shiki/rehype-pretty-code adds `data-language` only to block code; inline
  // code from the markdown source has none, so we style only that case.
  const isBlock = "data-language" in rest;
  if (isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  return (
    <code
      className={cn(
        "rounded-[5px] border border-purple-200/70 bg-purple-50 px-[0.4em] py-[0.15em] font-mono text-[0.85em] font-medium text-purple-700 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300",
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  );
}

/** Count rendered child elements (used by CodeGroup tab detection). */
export function childArray(children: ReactNode) {
  return Children.toArray(children);
}
