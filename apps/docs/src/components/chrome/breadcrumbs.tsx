import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { findSection } from "@content/manifest";

/**
 * Page breadcrumbs: Docs › Section › Page. Server component, derived from the
 * slug + manifest, no client state.
 */
export function Breadcrumbs({ slug, title }: { slug: string; title: string }) {
  const section = findSection(slug);

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link href="/" className="transition-colors hover:text-foreground">
            Docs
          </Link>
        </li>
        {section && (
          <>
            <Separator />
            <li className="text-muted-foreground">{section.title}</li>
          </>
        )}
        {slug !== "" && (
          <>
            <Separator />
            <li className="font-medium text-foreground">{title}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

function Separator() {
  return (
    <li aria-hidden className="text-muted-foreground/40">
      <ChevronRight size={12} />
    </li>
  );
}
