import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { rehypeErrorAutolink } from "./rehype-error-autolink";
import { nombaoneDark, nombaoneLight } from "./shiki-theme";

import type { Options as PrettyCodeOptions } from "rehype-pretty-code";
import type { CompileOptions } from "@mdx-js/mdx";

/**
 * The single remark/rehype plugin set, shared by the catch-all route and the
 * search indexer's plain-text pass. Centralised so every MDX surface compiles
 * identically.
 *
 * Order matters:
 *   remark: gfm (tables/strikethrough)  [smartypants removed: it corrupts the JS
 *           inside MDX JSX expression attributes, e.g. `legs={[{a:"x"}]}`]
 *   rehype: slug (heading ids) → pretty-code (Shiki, BEFORE autolink so the
 *           anchor wraps the slugged heading) → autolink-headings (anchor link)
 */

const prettyCodeOptions: PrettyCodeOptions = {
  // Dual themes: `rehype-pretty-code` emits both and gates each with a
  // `data-theme` attribute; our CSS shows the one matching [data-theme="dark"].
  theme: { light: nombaoneLight, dark: nombaoneDark },
  // Keep the literal background off; our CSS owns the code surface so it
  // tracks the Nombaone `--code-bg` token in both themes.
  keepBackground: false,
  defaultLang: { block: "plaintext", inline: "plaintext" },
  // Style a single line/word highlight via data attributes (CSS in globals).
  onVisitLine(node) {
    // Prevent empty lines from collapsing (so line numbers stay aligned).
    if (node.children.length === 0) {
      node.children = [{ type: "text", value: " " }];
    }
  },
  onVisitHighlightedLine(node) {
    node.properties.className = [...(node.properties.className ?? []), "line--highlighted"];
  },
  onVisitHighlightedChars(node) {
    node.properties.className = ["word--highlighted"];
  },
};

export const mdxOptions: Pick<CompileOptions, "format" | "remarkPlugins" | "rehypePlugins"> = {
  // Force full MDX parsing. Without this, next-mdx-remote can treat the source
  // as `md`/`detect`, which enables indented-code parsing and mangles multi-line
  // JSX *expression* attributes (e.g. `legs={[ {…}, {…} ]}` over several lines),
  // dropping them so the component receives `undefined`. `mdx` disables indented
  // code and parses the attribute as proper JS.
  format: "mdx",
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeSlug,
    rehypeErrorAutolink,
    [rehypePrettyCode, prettyCodeOptions],
    [
      rehypeAutolinkHeadings,
      {
        behavior: "wrap",
        properties: { className: ["heading-anchor"], ariaHidden: true, tabIndex: -1 },
      },
    ],
  ],
};
