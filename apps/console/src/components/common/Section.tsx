import { Card } from '@nombaone/ui/components/ui/card';
import { cn } from '@/lib/cn';

/**
 * A titled content card — the panel wrapper used by detail screens and forms.
 * Optional `title`/`description` header with a trailing `action` slot, then the
 * body. Keeps card padding + heading rhythm uniform across screens.
 */
export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-0.5">
            {title ? (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </Card>
  );
}
