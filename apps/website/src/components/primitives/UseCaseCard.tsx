import Link from "next/link";

import { cn } from "@/lib/utils";

/** Use-case card (.pen xyrzF): accent icon + label + pain. radius 14, surface-1, padding 20, gap 12. */
export function UseCaseCard({
  href,
  icon,
  label,
  pain,
  className,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  pain: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-5 transition-colors hover:border-border-strong",
        className
      )}
    >
      <span className="text-accent" aria-hidden="true">
        {icon}
      </span>
      <p className="text-[24px] font-semibold text-foreground">{label}</p>
      <p className="text-[17px] leading-[1.5] text-muted-foreground">{pain}</p>
    </Link>
  );
}
