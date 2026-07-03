import { cn } from "@/lib/utils";

/**
 * Code showcase container (.pen KAOgf): surface-1 card with an optional header
 * row (filename / lang) over a mono body. Article code is syntax-highlighted by
 * the MDX pipeline (Shiki); this standalone block styles inline showcase code.
 */
export function CodeBlock({
  filename,
  lang,
  className,
  children,
}: {
  filename?: string;
  lang?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--r-lg)] border border-border bg-surface-1",
        className
      )}
    >
      {filename || lang ? (
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">{filename}</span>
          {lang ? <span className="font-mono text-[11px] text-subtle-foreground">{lang}</span> : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground">
        {children}
      </pre>
    </div>
  );
}
