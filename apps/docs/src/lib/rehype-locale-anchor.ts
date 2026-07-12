import { visit } from "unist-util-visit";

import type { Element, Root } from "hast";

/**
 * Give a translated page's headings the ENGLISH heading ids.
 *
 * `rehype-slug` mints an id from the heading text, so a Yorùbá `## Ìdí tí èyí fi
 * ṣe pàtàkì` becomes `#ìdí-tí-èyí-fi-ṣe-pàtàkì`. That quietly breaks every deep
 * link into the page, because links are authored against the CANONICAL English
 * slug — `[…](/concepts/the-ledger#idempotency-lives-here-too)` — and the
 * renderer only prefixes the path, never the fragment. Follow one on `/yo` and
 * you land at the top of the page instead of the section, silently.
 *
 * Fixing it by translating the anchors instead would mean every cross-locale
 * link needs to know which locale it will be read in, which is unworkable. So
 * the fragment stays language-neutral: one `#idempotency-lives-here-too` that
 * resolves on the English page, the Yorùbá page, and the Hausa page alike.
 *
 * The mapping is POSITIONAL, which is only safe because `scripts/check-l10n.ts`
 * hard-enforces that a translation has the same number of headings as its
 * source. If that gate is ever relaxed, this must be revisited.
 */
export function rehypeLocaleAnchor(englishIds: string[]) {
  return function transformer(tree: Root) {
    let index = 0;
    visit(tree, "element", (node: Element) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      // h1 is the page title, rendered outside MDX — only h2/h3 carry ids here,
      // matching what `extractHeadings` collects.
      if (!/^h[23]$/.test(node.tagName)) return;

      const id = englishIds[index];
      index += 1;
      if (!id) return; // more headings than English: leave rehype-slug's id rather than guess.

      node.properties = { ...node.properties, id };
    });
  };
}
