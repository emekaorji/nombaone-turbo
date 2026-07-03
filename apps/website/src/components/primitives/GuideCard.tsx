import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Featured guide card (.pen oH2IV): category label + title + one-line problem
 * + "Read →". radius 14, surface-1, padding 22, gap 10.
 */
export function GuideCard({
  href,
  group,
  title,
  problem,
  className,
}: {
  href: string;
  /** Category label. Omit to hide it (e.g. when cards are already grouped under a heading). */
  group?: string;
  title: string;
  problem: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface-1 p-[22px] transition-colors hover:border-border-strong",
        className
      )}
    >
      {group ? (
        <span className="font-mono text-[10.5px] tracking-[0.6px] text-subtle-foreground">
          {group}
        </span>
      ) : null}
      <p className="text-[24px] font-semibold tracking-[-0.2px] text-foreground">{title}</p>
      <p className="text-[17px] leading-[1.55] text-muted-foreground">{problem}</p>
      <span className="flex items-center gap-[5px] pt-1.5 text-[13px] font-medium text-accent">
        Read →
      </span>
    </Link>
  );
}
