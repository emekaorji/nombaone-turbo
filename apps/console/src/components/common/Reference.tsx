import { cn } from '@/lib/cn';
import { CopyButton } from './CopyButton';

/**
 * The merchant-facing public `reference` rendered mono + copyable. This is the
 * only id a tenant ever sees (the internal UUID never leaves the backend), so
 * every resource id in the console renders through this.
 */
export function Reference({
  value,
  className,
  copyable = true,
}: {
  value: string;
  className?: string;
  copyable?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        {value}
      </code>
      {copyable ? <CopyButton value={value} label={`Copy ${value}`} /> : null}
    </span>
  );
}
