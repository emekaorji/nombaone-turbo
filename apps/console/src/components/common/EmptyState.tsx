import type { Icon } from 'iconsax-react';

import { cn } from '@/lib/cn';

/**
 * The "nothing here yet" placeholder: a glyph, a title, a one-line explanation,
 * and an optional call-to-action (e.g. the create button). Every list renders
 * this in its zero state instead of a bare empty table.
 */
export function EmptyState({
  icon: Glyph,
  title,
  description,
  action,
  className,
}: {
  icon?: Icon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center',
        className
      )}
    >
      {Glyph ? (
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Glyph size={22} color="currentColor" variant="Outline" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
