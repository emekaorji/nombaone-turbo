import { cn } from "@/lib/cn";

import type { HttpMethod } from "@content/manifest";

/**
 * `<MethodChip>` is a tiny fixed-width HTTP-method chip for the sidebar's API
 * operation rows. Each method carries its own vivid, conventional color (GET
 * blue, POST green, PUT/PATCH amber, DELETE red) matching the operation-page
 * banners so the rail and the pages read the same. Fixed `w-9` + mono
 * `text-[10px]` keeps every row's label aligned regardless of method.
 */

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400",
  POST: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  PATCH: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  DELETE: "bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400",
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
