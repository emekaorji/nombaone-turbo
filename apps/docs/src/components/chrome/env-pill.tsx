import { envBadgeLabel } from "@/lib/env";

/**
 * Mode indicator (mirrors the console/admin `EnvPill`): a small pill on
 * local/preview, hidden in production. warning-50 fill, warning-200 stroke.
 */
export function EnvPill() {
  const label = envBadgeLabel();
  if (!label) return null;

  return (
    <span className="hidden h-6 items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 sm:inline-flex dark:border-warning-900 dark:bg-warning-900/30">
      <span aria-hidden className="size-1.5 rounded-full bg-warning-500" />
      <span className="text-xs font-medium text-warning-700 dark:text-warning-400">{label}</span>
    </span>
  );
}
