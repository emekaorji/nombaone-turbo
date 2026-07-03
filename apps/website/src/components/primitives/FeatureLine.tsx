import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** A checked feature/perk line (.pen hKkPI / TrustItem zJ59V). */
export function FeatureLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <span className="text-[15px] font-medium text-foreground">{children}</span>
    </div>
  );
}
