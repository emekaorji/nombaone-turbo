import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * `<Card>` and `<CardGroup>`: link/feature cards for landing + index pages.
 * A `<Card href="…">` becomes a hover-lifting link; without `href` it is a
 * static info card. `<CardGroup cols={2|3}>` lays them out in a grid.
 */

export function CardGroup({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div
      className={cn(
        "not-prose my-6 grid gap-4",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        {href && (
          <ArrowUpRight
            size={16}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
          />
        )}
      </div>
      {children && (
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground [&>p]:m-0 [&>p]:text-sm [&>p]:text-muted-foreground">{children}</div>
      )}
    </>
  );

  const base =
    "not-prose block rounded-lg border border-border bg-card p-4 text-left transition-all";

  if (href) {
    const external = href.startsWith("http");
    return (
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className={cn(
          base,
          "group hover:-translate-y-0.5 hover:border-accent-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-accent-border",
        )}
      >
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
