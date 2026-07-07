import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Centered empty-state card (icon + title + description + action). Web-App law 6: no silent failure. */
export function EmptyState({
  icon: Icon,
  iconTone = 'muted',
  title,
  titleSize = 16,
  description,
  action,
}: {
  icon: LucideIcon;
  iconTone?: 'accent' | 'muted';
  title: string;
  titleSize?: number;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-3.5 rounded-lg border border-border bg-surface-1 px-6 py-12 text-center">
      <div className="flex size-[52px] items-center justify-center rounded-lg border border-border bg-surface-2">
        <Icon
          className={`size-[22px] ${iconTone === 'accent' ? 'text-accent' : 'text-muted-foreground'}`}
          strokeWidth={1.75}
        />
      </div>
      <span className="font-semibold text-foreground" style={{ fontSize: titleSize }}>
        {title}
      </span>
      <p className="whitespace-pre-line text-[12.5px] leading-[1.5] text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
