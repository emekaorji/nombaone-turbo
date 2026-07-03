import Link from "next/link";

import type { MDXComponents } from "mdx/types";

/** Prose mapping for article MDX. rehype-pretty-code owns block-code colours. */
export const mdxComponents: MDXComponents = {
  // Rendered as the .pen "beat" eyebrow (01 · THE SCENARIO) — numbering comes
  // from the CSS counter on the `.article-beats` wrapper (globals.css).
  h2: (props) => (
    <h2
      className="mb-3 mt-10 scroll-mt-24 font-mono text-[12.5px] font-normal uppercase tracking-[0.06em] text-subtle-foreground first:mt-0"
      {...props}
    />
  ),
  h3: (props) => <h3 className="mt-8 text-xl font-semibold text-foreground" {...props} />,
  p: (props) => <p className="mt-5 text-[17px] leading-[1.72] text-muted-foreground" {...props} />,
  ul: (props) => (
    <ul
      className="mt-5 list-disc space-y-2 pl-6 text-[17px] leading-[1.72] text-muted-foreground"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mt-5 list-decimal space-y-2 pl-6 text-[17px] leading-[1.72] text-muted-foreground"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  a: ({ href = "", ...props }) => (
    <Link href={href} className="text-accent underline-offset-4 hover:underline" {...props} />
  ),
  blockquote: (props) => (
    <blockquote
      className="mt-6 rounded-r-[var(--r)] border-l-2 border-accent-border bg-accent-muted px-5 py-3 text-muted-foreground"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="mt-6 overflow-x-auto rounded-[var(--r-lg)] border border-border bg-surface-1 p-4 font-mono text-[13px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0"
      {...props}
    />
  ),
};
