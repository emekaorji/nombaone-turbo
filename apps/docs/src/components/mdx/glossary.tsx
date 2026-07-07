import Link from "next/link";

import { GLOSSARY } from "@content/glossary.seed";

/**
 * The glossary, rendered from the checked-in `glossary.seed.ts` (Phase 02) — one
 * noun per concept, alphabetized. Each term links to its concept page where one
 * exists, and shows the words we deliberately do not use ("also seen as …").
 * Phase 03's OpenAPI generator will enrich each entry with a live schema link.
 * A plain server component (no client JS): the seed is read at build time.
 */
export function Glossary() {
  const entries = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <dl className="not-prose mt-6 divide-y divide-border border-t border-border">
      {entries.map((entry) => (
        <div key={entry.term} id={entry.term.replace(/\s+/g, "-")} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <dt className="font-mono text-sm font-semibold text-accent">{entry.term}</dt>
          <dd className="text-[16px] leading-7 text-foreground/85">
            {entry.definition}
            {entry.conceptSlug && (
              <>
                {" "}
                <Link href={entry.conceptSlug} className="text-accent underline-offset-2 hover:underline">
                  Learn more →
                </Link>
              </>
            )}
            {entry.aliases && entry.aliases.length > 0 && (
              <span className="mt-1 block text-xs text-subtle-foreground">
                also seen as {entry.aliases.map((a) => `"${a}"`).join(", ")}; we use{" "}
                <span className="font-mono text-muted-foreground">{entry.term}</span>.
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
