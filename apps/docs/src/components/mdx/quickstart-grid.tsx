import Link from "next/link";

/**
 * `<QuickstartGrid>` (Phase 06) — the choice-first onboarding buffet. A grid of
 * stack cards, each a self-contained path to a real `201` in the reader's own
 * language. No monolithic "getting started" in a stack they don't use. Server
 * component: the cards are links, no client state. Each card carries an
 * accessible name (the label) and an emerald focus ring.
 */

const STACKS: { slug: string; label: string; blurb: string; mark: string }[] = [
  { slug: "node", label: "Node.js", blurb: "fetch, zero deps", mark: "⬢" },
  { slug: "nextjs", label: "Next.js", blurb: "a route handler", mark: "▲" },
  { slug: "python", label: "Python", blurb: "requests", mark: "🐍" },
  { slug: "go", label: "Go", blurb: "net/http", mark: "🐹" },
  { slug: "php", label: "PHP", blurb: "curl ext", mark: "🐘" },
  { slug: "ruby", label: "Ruby", blurb: "net/http", mark: "💎" },
  { slug: "curl", label: "cURL", blurb: "in your shell", mark: "❯_" },
];

export function QuickstartGrid() {
  return (
    <div className="not-prose my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {STACKS.map((stack) => (
        <Link
          key={stack.slug}
          href={`/getting-started/quickstart/${stack.slug}`}
          className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[--accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true" className="text-xl text-muted-foreground transition-colors group-hover:text-[--accent]">
            {stack.mark}
          </span>
          <span className="mt-1 text-sm font-semibold text-foreground">{stack.label}</span>
          <span className="text-xs text-muted-foreground">{stack.blurb}</span>
        </Link>
      ))}
    </div>
  );
}
