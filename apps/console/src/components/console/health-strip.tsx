import { cn } from '@nombaone/ui/lib/utils';

export type Cycle = 'paid' | 'failed' | 'recovered' | 'upcoming' | 'trial';

const BAR: Record<Cycle, { c: string; h: number }> = {
  paid: { c: 'bg-success', h: 20 },
  failed: { c: 'bg-danger', h: 13 },
  recovered: { c: 'bg-accent', h: 26 },
  upcoming: { c: 'bg-surface-3', h: 10 },
  trial: { c: 'bg-info', h: 16 },
};

/**
 * Per-subscription health strip: last N cycle outcomes as bottom-aligned bars.
 * The competitive gap no billing product ships inline.
 */
export function HealthStrip({ cycles }: { cycles: Cycle[] }) {
  return (
    <div className="flex h-[30px] items-end gap-[3px]">
      {cycles.map((o, i) => (
        <div key={i} className={cn('w-[7px] rounded-[2px]', BAR[o].c)} style={{ height: BAR[o].h }} />
      ))}
    </div>
  );
}
