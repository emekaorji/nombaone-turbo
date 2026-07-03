import { cn } from "@/lib/utils";

export interface LifecycleStage {
  n: string;
  title: string;
  deck: string;
}

// 1:1 with the .pen LifecycleRail (fPe8H). The "hard part:" chips are
// enabled:false in the .pen instance, so they are intentionally omitted.
export const HOME_LIFECYCLE: LifecycleStage[] = [
  {
    n: "01",
    title: "Subscribe",
    deck: "One subscription object. Card, transfer, mandate, or crypto, chosen and fallen back to automatically.",
  },
  {
    n: "02",
    title: "Bill",
    deck: "A scheduler that finds what's due and charges it idempotently, so a crash never double-charges.",
  },
  {
    n: "03",
    title: "Recover",
    deck: "Dunning for thin balances: payday-timed retries, card-update flows, and recovery, not retry-then-cancel.",
  },
  {
    n: "04",
    title: "Reconcile",
    deck: "Every inbound transfer matched to the right invoice, automatically, to the kobo.",
  },
  {
    n: "05",
    title: "Settle",
    deck: "Collected funds split and paid out to each tenant's account, no spreadsheets.",
  },
];

/** Five-stage lifecycle rail with an emerald progress line (.pen fPe8H). */
export function LifecycleRail({
  stages = HOME_LIFECYCLE,
  className,
}: {
  stages?: LifecycleStage[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="h-0.5 w-full rounded-full bg-accent" aria-hidden="true" />
      <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {stages.map((s) => (
          <li key={s.n} className="flex flex-col gap-2">
            <span className="font-mono text-[24px] font-semibold tracking-[-0.5px] text-accent">
              {s.n}
            </span>
            <p className="text-[24px] font-semibold tracking-[-0.3px] text-foreground">{s.title}</p>
            <p className="text-[17px] leading-[1.55] text-muted-foreground">{s.deck}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
