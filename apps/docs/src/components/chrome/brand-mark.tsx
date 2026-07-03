import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo-icon";
import { cn } from "@/lib/cn";

/**
 * The Nombaone mark + wordmark + `DOCS` chip, mirroring admin's brand row and its
 * `ADMIN` chip pattern, retuned for docs. Links home.
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
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-sm bg-primary">
        <LogoIcon className="size-3.5 text-accent" />
      </span>
      <span className="text-base font-bold tracking-[-0.2px] text-foreground">Nombaone</span>
      <span className="mt-0.5 rounded-xs bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.5px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        DOCS
      </span>
    </Link>
  );
}
