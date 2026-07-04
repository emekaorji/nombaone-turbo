import { PUBLIC_ERROR_CODES } from "@nombaone/errors";

/** Minimal hast shapes (avoids a dependency on `@types/hast`). */
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}
type Element = HastNode;
type Root = HastNode;
type RootContent = HastNode;
type Text = HastNode;

/**
 * Rehype plugin (Phase 04): auto-link error codes. Any inline `<code>` whose
 * text is exactly a public error code (e.g. `API_KEY_INVALID`) is wrapped in a
 * link to its entry on `/errors`, so every mention of a code in prose is one
 * click from its fix. Grounded in the registry (`PUBLIC_ERROR_CODES`) — only
 * real codes link, and the set can never drift from what the API emits.
 *
 * Must run BEFORE `rehype-pretty-code` so inline code still has a single text
 * child (pretty-code tokenises inline code into spans). Code blocks (`<pre>`)
 * and codes already inside a link are skipped. Hand-rolled tree walk — no
 * `unist-util-visit` dependency.
 */

const CODES: ReadonlySet<string> = new Set(PUBLIC_ERROR_CODES);

function isElement(node: RootContent): node is Element {
  return node.type === "element";
}

/** Walk children, replacing any inline error-code `<code>` with a linked one. */
function walk(node: Root | Element, insideLinkOrPre: boolean): void {
  if (!("children" in node) || !node.children) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!isElement(child)) continue;

    const blocked = insideLinkOrPre || child.tagName === "pre" || child.tagName === "a";

    if (
      !blocked &&
      child.tagName === "code" &&
      child.children?.length === 1 &&
      child.children[0].type === "text" &&
      CODES.has((child.children[0] as Text).value ?? "")
    ) {
      const code = (child.children[0] as Text).value ?? "";
      node.children[i] = {
        type: "element",
        tagName: "a",
        properties: { href: `/errors#${code}`, className: ["error-code-link"] },
        children: [child],
      };
      continue; // don't descend into the freshly-wrapped node
    }

    walk(child, blocked || child.tagName === "a" || child.tagName === "pre");
  }
}

export function rehypeErrorAutolink() {
  return (tree: Root) => {
    walk(tree, false);
  };
}
