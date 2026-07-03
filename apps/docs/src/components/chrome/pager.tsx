import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

import { siblings } from "@content/manifest";

import { Feedback } from "./feedback";

/**
 * Prev/next pager + "Was this helpful?" footer affordance. Derives neighbours
 * from the flattened nav order in the manifest. The feedback row is the only
 * interactive bit, so it's a client island (`<Feedback>`); this stays a server
 * component.
 */
export function Pager({ slug }: { slug: string }) {
  const { prev, next } = siblings(slug);

  return (
    <footer className="mt-16 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3">
        <Feedback slug={slug} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={prev.slug === "" ? "/" : prev.slug}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent-border hover:shadow-md dark:hover:border-accent-border"
          >
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft size={13} aria-hidden /> Previous
            </span>
            <span className="mt-1 font-medium text-foreground transition-colors group-hover:text-primary">
              {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={next.slug === "" ? "/" : next.slug}
            className="group flex flex-col items-end rounded-lg border border-border bg-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-accent-border hover:shadow-md dark:hover:border-accent-border"
          >
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              Next <ArrowRight size={13} aria-hidden />
            </span>
            <span className="mt-1 font-medium text-foreground transition-colors group-hover:text-primary">
              {next.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </footer>
  );
}
