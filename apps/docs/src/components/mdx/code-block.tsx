"use client";

import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CodeShell } from "./code-shell";
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
export function extractText(node: ReactNode): string {
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
  // caption is redundant; drop it. Standalone fenced blocks keep theirs. A
  // `<CodeGroup>` also owns the copy button (in its tab strip), so suppress
  // this block's own copy there; a generic `<Tabs>` keeps the hover copy.
  const insideTabs = useInsideTabs();
  const showCaption = !insideTabs && Boolean(title || language);
  const hideCopy = insideTabs === "code-group";

  // Inside a tab group the tab label already names the language, so no bar here.
  const bar = showCaption ? (
    <>
      <span className="font-mono text-xs font-medium text-muted-foreground">{title ?? language}</span>
      {language && title && (
        <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {language}
        </span>
      )}
    </>
  ) : undefined;

  return (
    <CodeShell bar={bar} copyValue={code} className="my-6" hideCopy={hideCopy} preProps={rest} preClassName={className}>
      {children}
    </CodeShell>
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
        "rounded-[5px] border border-accent-border bg-accent-muted px-[0.4em] py-[0.15em] font-mono text-[0.85em] font-medium text-accent dark:border-accent-border dark:bg-accent-muted dark:text-accent",
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
