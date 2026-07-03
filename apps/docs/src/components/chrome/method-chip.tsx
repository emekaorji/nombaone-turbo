import { cn } from "@/lib/cn";

import type { HttpMethod } from "@content/manifest";

/**
 * `<MethodChip>` is a tiny fixed-width HTTP-method chip for the sidebar's API
 * operation rows. The colors mirror the per-method ramps in
 * `mdx/endpoint-header.tsx` (GET success-green, POST emerald, PUT/PATCH amber,
 * DELETE error-red) so the rail and the page banners read the same. Fixed `w-9`
 * + mono `text-[10px]` keeps every row's label aligned regardless of method.
 */

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
  POST: "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent",
  PUT: "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
  PATCH: "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
  DELETE: "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
};

/** Short label that fits the chip (`DELETE` shortens to `DEL`). */
const METHOD_LABELS: Record<HttpMethod, string> = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DEL",
};

export function MethodChip({ method }: { method: HttpMethod }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex w-9 shrink-0 justify-center rounded-[4px] px-1 py-0.5 font-mono text-[10px] font-bold leading-none tracking-tight",
        METHOD_STYLES[method],
      )}
    >
      {METHOD_LABELS[method]}
    </span>
  );
}
