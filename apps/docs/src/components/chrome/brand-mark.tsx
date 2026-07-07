import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The Nombaone mark + wordmark + `DOCS` chip. The logo now ships with its own
 * rounded square, so there's no wrapper here — we just swap the mode-matched
 * asset (`logo-light` = black square on light, `logo-dark` = white square on
 * dark), keyed off the `[data-theme]` the theme toggle sets. Links home.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-light.svg" alt="Nombaone" width={24} height={24} className="size-6 shrink-0 dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-dark.svg" alt="" aria-hidden width={24} height={24} className="hidden size-6 shrink-0 dark:block" />
      <span className="text-base font-bold tracking-[-0.2px] text-foreground">Nombaone</span>
      <span className="mt-0.5 rounded-xs bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.5px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        DOCS
      </span>
    </Link>
  );
}
