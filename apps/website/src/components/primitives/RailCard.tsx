import { cn } from "@/lib/utils";

type Chip = "pull" | "push" | "distinct" | "mandate";

const chipTone: Record<Chip, string> = {
  pull: "text-info",
  push: "text-warning",
  mandate: "text-accent",
  distinct: "text-muted-foreground",
};

/** A payment-rail card with a pull/push chip (.pen rails showcase). */
export function RailCard({
  icon,
  name,
  chip,
  description,
  className,
}: {
  icon?: React.ReactNode;
  name: string;
  chip: Chip;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--r-lg)] border border-border bg-surface-1 p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon ? <span className="text-accent">{icon}</span> : null}
          <span className="text-base font-semibold text-foreground">{name}</span>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px]">
          <span className={chipTone[chip]}>{chip}</span>
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
