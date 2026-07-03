import { cn } from "@/lib/utils";

export interface Stat {
  value: string;
  label: string;
}

/** A band of headline guarantees/stats (.pen Pfs9A). Reused on product + trust. */
export function StatBand({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 rounded-[var(--r-lg)] border border-border bg-surface-1 p-6 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1.5">
          <p className="text-2xl font-semibold tracking-tight text-accent">{s.value}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
