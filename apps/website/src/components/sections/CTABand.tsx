import Link from "next/link";
import { Copy } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Closing call-to-action band (.pen ScL2c): centered 54px title, two buttons,
 * an npm-install pill, and a quiet "talk to us" line. radius 20, surface-1,
 * padding [64,40], gap 22. Reused across pages.
 */
export function CTABand({
  title,
  deck,
  primary,
  secondary,
  npm,
  talk,
  className,
}: {
  title: string;
  deck?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  npm?: string;
  talk?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-[22px] rounded-[20px] border border-border bg-surface-1 px-6 py-16 text-center md:px-10",
        className
      )}
    >
      <h2 className="max-w-[620px] text-[34px] font-semibold leading-[1.1] tracking-[-1.4px] text-foreground md:text-[54px] md:tracking-[-2.2px]">
        {title}
      </h2>
      {deck ? <p className="max-w-[620px] text-base text-muted-foreground md:text-lg">{deck}</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={primary.href}
          className="rounded-[8px] bg-accent px-4 py-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          {primary.label}
        </Link>
        {secondary ? (
          <Link
            href={secondary.href}
            className="rounded-[8px] border border-border bg-surface-2 px-4 py-[9px] text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>

      {npm ? (
        <div className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-surface-2 px-4 py-2.5 font-mono text-[13px]">
          <span className="text-subtle-foreground">$</span>
          <span className="text-foreground">{npm}</span>
          <Copy className="size-3.5 text-subtle-foreground" />
        </div>
      ) : null}

      {talk ? (
        <Link href={talk.href} className="text-[13px] text-muted-foreground hover:text-foreground">
          {talk.label}
        </Link>
      ) : null}
    </div>
  );
}
