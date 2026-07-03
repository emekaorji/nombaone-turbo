import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { nombaoneDark, nombaoneLight } from "./shiki-theme";

import type { Options as PrettyCodeOptions } from "rehype-pretty-code";
import type { CompileOptions } from "@mdx-js/mdx";

/** Shared remark/rehype set for the /guides MDX (mirrors apps/docs). */
const prettyCodeOptions: PrettyCodeOptions = {
  theme: { light: nombaoneLight, dark: nombaoneDark },
  keepBackground: false,
  defaultLang: { block: "plaintext", inline: "plaintext" },
  onVisitLine(node) {
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
  format: "mdx",
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeSlug,
    [rehypePrettyCode, prettyCodeOptions],
    [
      rehypeAutolinkHeadings,
      { behavior: "wrap", properties: { className: ["heading-anchor"], ariaHidden: true, tabIndex: -1 } },
    ],
  ],
};
