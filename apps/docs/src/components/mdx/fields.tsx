import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * `<ParamField>` and `<ResponseField>`: the API-reference primitives that
 * render request parameters and response fields with a name, type, required /
 * optional marker, and description. Used per-operation in the reference pages.
 */

interface FieldProps {
  /** Field name, e.g. `amount`, `walletId`. Rendered as a mono chip. */
  name: string;
  /** Type label, e.g. `bigint (kobo)`, `string`, `WalletStatus`. */
  type?: string;
  /** Where the param rides: informational pill (path/query/body). */
  in?: "path" | "query" | "body" | "header";
  required?: boolean;
  /** Default value, surfaced as a subtle pill. */
  default?: string;
  children?: ReactNode;
}

function FieldShell({
  name,
  type,
  in: location,
  required,
  default: defaultValue,
  accent,
  children,
}: FieldProps & { accent: "param" | "response" }) {
  return (
    <div className="not-prose border-b border-border py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <code
          className={cn(
            "rounded-[5px] px-1.5 py-0.5 font-mono text-[13px] font-semibold",
            accent === "param"
              ? "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent"
              : "bg-magenta-100 text-magenta-700 dark:bg-magenta-900 dark:text-magenta-100",
          )}
        >
          {name}
        </code>
        {type && (
          <span className="font-mono text-xs text-muted-foreground">{type}</span>
        )}
        {location && (
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {location}
          </span>
        )}
        {required ? (
          <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-error-700 dark:bg-error-900/30 dark:text-error-400">
            required
          </span>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            optional
          </span>
        )}
        {defaultValue && (
          <span className="font-mono text-[11px] text-muted-foreground">
            default: {defaultValue}
          </span>
        )}
      </div>
      {children && (
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
          {children}
        </div>
      )}
    </div>
  );
}

export function ParamField(props: FieldProps) {
  return <FieldShell {...props} accent="param" />;
}

export function ResponseField(props: FieldProps) {
  return <FieldShell {...props} accent="response" />;
}
