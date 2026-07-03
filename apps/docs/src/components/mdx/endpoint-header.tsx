import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * `<EndpointHeader>`: the per-operation banner in the API reference: the HTTP
 * method, the path (with `:params` highlighted), the required scope, and an
 * idempotency badge (the ⟳ marker for money POSTs). Deep-linkable anchor target.
 */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const METHOD_STYLES: Record<Method, string> = {
  GET: "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
  POST: "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent",
  PUT: "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
  PATCH: "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
  DELETE: "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
};

/** Highlight `:param` segments in the path. */
function renderPath(path: string) {
  return path.split("/").map((segment, index, all) => {
    const isParam = segment.startsWith(":");
    return (
      <span key={index}>
        {index > 0 && <span className="text-muted-foreground/50">/</span>}
        <span className={isParam ? "text-accent dark:text-accent" : "text-foreground"}>
          {segment}
        </span>
        {index === all.length - 1 ? "" : ""}
      </span>
    );
  });
}

export function EndpointHeader({
  method,
  path,
  scope,
  idempotent = false,
}: {
  method: Method;
  path: string;
  scope?: string;
  idempotent?: boolean;
}) {
  return (
    <div className="not-prose my-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <span
        className={cn(
          "rounded-md px-2 py-1 font-mono text-xs font-bold tracking-wide",
          METHOD_STYLES[method],
        )}
      >
        {method}
      </span>
      <code className="font-mono text-sm font-medium">{renderPath(path)}</code>
      <div className="ml-auto flex items-center gap-2">
        {idempotent && (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent dark:border-accent-border dark:bg-accent-muted dark:text-accent">
            <RefreshCw size={11} aria-hidden />
            Idempotent
          </span>
        )}
        {scope && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {scope}
          </span>
        )}
      </div>
    </div>
  );
}
