import { cn } from '@nombaone/ui/lib/utils';

export type SubStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'churned';

const MAP: Record<SubStatus, { label: string; text: string; bg: string; dot: string }> = {
  active: { label: 'Active', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  trialing: { label: 'Trialing', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  past_due: { label: 'Past due', text: 'text-warning', bg: 'bg-warning-bg', dot: 'bg-warning' },
  paused: { label: 'Paused', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
  canceled: { label: 'Canceled', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
  churned: { label: 'Churned', text: 'text-danger', bg: 'bg-danger-bg', dot: 'bg-danger' },
  incomplete: { label: 'Incomplete', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
};

/** Subscription FSM status badge. Voluntary `canceled` and involuntary `churned` stay distinct. */
export function StatusBadge({ status }: { status: SubStatus }) {
  const s = MAP[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px]', s.bg)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      <span className={cn('text-[12px] font-medium', s.text)}>{s.label}</span>
    </span>
  );
}
