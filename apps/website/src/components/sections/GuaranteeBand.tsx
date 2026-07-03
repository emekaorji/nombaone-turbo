import { Check, Layers, Shield, ShieldCheck, Webhook } from "lucide-react";

import { cn } from "@/lib/utils";

// The six money-safety guarantees (.pen StatBand, Pfs9A).
const GUARANTEES = [
  { icon: Check, label: "Never double-charge" },
  { icon: Shield, label: "Tenant isolation by design" },
  { icon: Check, label: "Reconciled to the kobo" },
  { icon: Layers, label: "Integer-kobo ledger" },
  { icon: Webhook, label: "Signed, replayable webhooks" },
  { icon: ShieldCheck, label: "Two-step verified" },
];

/** Guarantee band: 6 icon+label rows in a bordered panel (.pen Pfs9A). */
export function GuaranteeBand({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-[18px] rounded-[14px] border border-border bg-surface-1 p-8 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {GUARANTEES.map((g) => (
        <div key={g.label} className="flex items-center gap-2.5">
          <g.icon className="size-4 shrink-0 text-accent" strokeWidth={2} />
          <span className="text-[18px] font-medium text-foreground">{g.label}</span>
        </div>
      ))}
    </div>
  );
}
