import Link from 'next/link';
import { ArrowLeft } from 'iconsax-react';

import { cn } from '@/lib/cn';

/**
 * The standard resource-detail scaffold: a back link, a title row (title +
 * optional status/badge slot + actions), and a body. Detail pages compose this
 * with `KeyValueList` cards inside `children` so every detail screen reads the
 * same way.
 */
export function DetailLayout({
  backHref,
  backLabel = 'Back',
  title,
  badge,
  actions,
  children,
  className,
}: {
  backHref: string;
  backLabel?: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} color="currentColor" variant="Outline" />
        {backLabel}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-xl font-semibold tracking-[-0.2px] text-foreground">{title}</h1>
          {badge}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </div>
  );
}
