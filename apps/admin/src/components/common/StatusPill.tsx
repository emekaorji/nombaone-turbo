import { Badge } from '@nombaone/ui/components/ui/badge';

import { cn } from '@/lib/cn';

/**
 * PARADIGM — A CENTRALIZED STATUS-PILL REGISTRY.
 *
 * Every enum the panel renders as a coloured pill maps THROUGH this one registry
 * to a `(variant, label)` pair, rather than each screen hand-rolling its own
 * `switch (status)`. A status the registry doesn't know about falls back to a
 * NEUTRAL pill showing the raw value — so an unrecognised enum value degrades
 * gracefully (visible, not crashing, never silently styled as success). To add a
 * new status you edit this map in one place.
 */

/** Visual tone, mapped onto the shared Badge variants + a few tone classes. */
type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type PillSpec = { tone: PillTone; label: string };

const TONE_CLASS: Record<PillTone, string> = {
  success: 'border-transparent bg-emerald-100 text-emerald-700',
  warning: 'border-transparent bg-amber-100 text-amber-700',
  danger: 'border-transparent bg-red-100 text-red-700',
  info: 'border-transparent bg-blue-100 text-blue-700',
  neutral: 'border-transparent bg-neutral-100 text-neutral-600',
};

/**
 * The registry. Keyed by a logical group (so the same string in two domains can
 * map differently) then by the enum value. Unknown groups/values get the
 * neutral fallback.
 */
const REGISTRY: Record<string, Record<string, PillSpec>> = {
  // Derived example status (from the ledger).
  exampleStatus: {
    settled: { tone: 'success', label: 'Settled' },
    pending: { tone: 'warning', label: 'Pending' },
  },
  // Reconciliation health.
  reconciliation: {
    balanced: { tone: 'success', label: 'Balanced' },
    drift: { tone: 'danger', label: 'Drift detected' },
  },
  // Mode ring.
  mode: {
    live: { tone: 'success', label: 'Live' },
    sandbox: { tone: 'warning', label: 'Sandbox' },
  },
  // Queue availability.
  queue: {
    available: { tone: 'success', label: 'Available' },
    unavailable: { tone: 'danger', label: 'Unavailable' },
  },
};

/** Title-case a raw enum value for the neutral fallback label. */
function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function resolve(group: string, value: string): PillSpec {
  return REGISTRY[group]?.[value] ?? { tone: 'neutral', label: humanize(value) };
}

export function StatusPill({
  group,
  value,
  className,
}: {
  group: string;
  value: string;
  className?: string;
}) {
  const spec = resolve(group, value);
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', TONE_CLASS[spec.tone], className)}
    >
      {spec.label}
    </Badge>
  );
}
