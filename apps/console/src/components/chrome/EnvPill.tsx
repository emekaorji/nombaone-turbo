import { envBadgeLabel } from '@/lib/env';

/**
 * Deployment-ring indicator (NOT the test/live env — that's `EnvSwitcher`).
 * Reflects `NEXT_PUBLIC_NOMBAONE_ENV`: hidden in production, "Preview" on Vercel
 * previews, "Local" in dev — a guardrail so it's obvious which deployment you're
 * looking at.
 */
export function EnvPill() {
  const label = envBadgeLabel();
  if (!label) return null;

  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5">
      <span aria-hidden className="size-1.5 rounded-full bg-warning-500" />
      <span className="text-xs font-medium text-warning-700">{label}</span>
    </span>
  );
}
