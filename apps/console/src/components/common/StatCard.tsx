import type { Icon } from 'iconsax-react';

import { Card } from '@nombaone/ui/components/ui/card';
import { cn } from '@/lib/cn';

/**
 * A single overview metric tile: a label, a large value, an optional sub-line,
 * and an optional glyph. The overview grids these for at-a-glance counts/totals.
 * Values are pre-formatted by the caller (money through `MoneyAmount`, etc.).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Glyph,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: Icon;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-3 p-5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Glyph ? (
          <span className="grid size-8 place-items-center rounded-md bg-purple-50 text-purple-700">
            <Glyph size={16} color="currentColor" variant="Bold" />
          </span>
        ) : null}
      </div>
      <div className="text-2xl font-semibold tracking-[-0.4px] text-foreground tabular-nums">
        {value}
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Card>
  );
}
