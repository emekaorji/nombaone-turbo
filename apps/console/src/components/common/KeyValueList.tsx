import { cn } from '@/lib/cn';

/** One row of a `KeyValueList`. `value` may be any node (a Reference, a pill…). */
export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
}

/**
 * A definition list rendering label→value pairs in a responsive two-column grid.
 * The detail-screen workhorse: resource attributes (reference, amount, status,
 * created-at) are described once as data and laid out uniformly.
 */
export function KeyValueList({
  items,
  className,
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4"
        >
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
