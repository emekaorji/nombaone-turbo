import { CreditCard, Landmark, ArrowLeftRight, type LucideIcon } from 'lucide-react';

export type Rail = 'card' | 'ddebit' | 'transfer';

const MAP: Record<Rail, { icon: LucideIcon; label: string }> = {
  card: { icon: CreditCard, label: 'Card' },
  ddebit: { icon: Landmark, label: 'Direct debit' },
  transfer: { icon: ArrowLeftRight, label: 'Transfer' },
};

/** The rail a subscription bills over. No competitor models multi-rail. */
export function RailBadge({ rail }: { rail: Rail }) {
  const { icon: Icon, label } = MAP[rail];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-[9px] py-[3px]">
      <Icon className="size-[13px] text-muted-foreground" strokeWidth={1.75} />
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </span>
  );
}
