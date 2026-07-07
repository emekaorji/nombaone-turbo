/**
 * Markdown-mirror transform (Phase 09, docs-as-data). Turns a page's raw MDX
 * body into clean, LLM-friendly CommonMark: a typed YAML frontmatter block
 * followed by the prose, with every interactive island reduced to a one-line
 * descriptor and all fenced code preserved verbatim. No raw JSX survives.
 *
 * Pure and dependency-free so both the build script (writing `public/<slug>.md`)
 * and any route handler can call it. The output is deterministic.
 */

export interface MirrorInput {
  title: string;
  /** Diátaxis mode: tutorial | how-to | reference | explanation. */
  type: string;
  summary: string;
  /** Absolute canonical URL of the HTML page (no `.md`). */
  canonical: string;
  /** Raw MDX body, frontmatter already stripped. */
  body: string;
}

/** Interactive islands that have no prose equivalent — described in one line. */
const ISLAND_NAMES = new Set([
  "ApiExplorer",
  "ApiReference",
  "EventCatalog",
  "ErrorReference",
  "Glossary",
  "WebhookVerifier",
  "LifecycleStateMachine",
  "LifecycleSimulator",
  "MoneyFlow",
  "FeeBreakdown",
  "ReferenceDecoder",
  "Quickstart",
  "IdempotencyLab",
  "MoneyUnit",
]);

function stripLeftoverTags(line: string): string {
  // Remove any remaining component tags (start with an uppercase letter),
  // leaving lowercase HTML and `<https://…>` autolinks intact.
  return line.replace(/<\/?[A-Z][A-Za-z0-9]*(\s[^>]*)?\/?>/g, "").trimEnd();
}

function attr(line: string, name: string): string | undefined {
  const m = line.match(new RegExp(`${name}="([^"]*)"`));
  return m?.[1];
}

/** Strip up to `n` leading whitespace chars (never touches non-space text). */
function stripIndent(line: string, n: number): string {
  return line.replace(new RegExp(`^[ \\t]{0,${n}}`), "");
}

/** Transform a raw MDX body into CommonMark prose. */
function bodyToMarkdown(body: string, canonical: string): string {
  const out: string[] = [];
  let inCode = false;
  let inCallout = false;
  // Base indentation of the current fenced block, so nested code (JSON, etc.)
  // keeps its own relative indentation but the block itself starts at col 0.
  let fenceIndent = 0;

  for (const raw of body.split("\n")) {
    const line = raw;
    const trimmed = line.trim();

    // Fenced code — dedent to the fence's own indent, pass through verbatim.
    if (trimmed.startsWith("```")) {
      if (!inCode) {
        fenceIndent = line.length - line.trimStart().length;
        inCode = true;
      } else {
        inCode = false;
      }
      const dedented = stripIndent(line, fenceIndent);
      out.push(inCallout ? `> ${dedented}` : dedented);
      continue;
    }
    if (inCode) {
      const dedented = stripIndent(line, fenceIndent);
      out.push(inCallout ? `> ${dedented}` : dedented);
      continue;
    }

    // Drop imports/exports.
    if (/^\s*(import|export)\s/.test(line)) continue;

    // Self-closing interactive islands → one-line descriptor.
    const island = trimmed.match(/^<([A-Z][A-Za-z0-9]*)\b[^>]*\/>$/);
    if (island && ISLAND_NAMES.has(island[1])) {
      out.push("");
      out.push(`> **Interactive: \`<${island[1]}>\`.** View and run it live at ${canonical}`);
      out.push("");
      continue;
    }

    // Callout open/close → blockquote.
    if (/^<Callout\b/.test(trimmed)) {
      const title = attr(trimmed, "title");
      inCallout = true;
      out.push("");
      if (title) out.push(`> **${title}**`);
      out.push(">");
      continue;
    }
    if (/^<\/Callout>/.test(trimmed)) {
      inCallout = false;
      out.push("");
      continue;
    }

    // Steps → headings.
    if (/^<Step\b/.test(trimmed)) {
      const title = attr(trimmed, "title");
      if (title) out.push(`\n### ${title}\n`);
      continue;
    }
    // Tab label → bold label.
    if (/^<Tab\b/.test(trimmed)) {
      const label = attr(trimmed, "label");
      if (label) out.push(`\n**${label}**\n`);
      continue;
    }
    // Card → list item with link.
    if (/^<Card\b/.test(trimmed)) {
      const title = attr(trimmed, "title");
      const href = attr(trimmed, "href");
      if (title && href) out.push(`- **[${title}](${href})**: `);
      else if (title) out.push(`- **${title}**: `);
      continue;
    }

    // Structural wrappers with no prose value → drop the tag line.
    if (/^<\/?(CodeGroup|Tabs|Steps|CardGroup|Tab|Step|Card|div|section)\b/.test(trimmed)) {
      continue;
    }

    // Anything else: dedent structural indentation, strip any stray component
    // tags, keep the prose. (Component children are indented for JSX
    // readability; left un-dedented, ≥4 spaces reads as a code block.)
    const prose = line.replace(/^[ \t]+/, "");
    const cleaned = stripLeftoverTags(prose);
    out.push(inCallout ? (cleaned ? `> ${cleaned}` : ">") : cleaned);
  }

  // Collapse 3+ blank lines to a single blank line.
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pageToMarkdown(input: MirrorInput): string {
  const fm = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    `type: ${input.type}`,
    `summary: ${JSON.stringify(input.summary)}`,
    `canonical: ${input.canonical}`,
    "---",
  ].join("\n");

  return `${fm}\n\n# ${input.title}\n\n${bodyToMarkdown(input.body, input.canonical)}\n`;
}

/** Map a manifest section key to its Diátaxis type. */
export function sectionType(sectionKey: string | undefined): string {
  switch (sectionKey) {
    case "get-started":
      return "tutorial";
    case "guides":
      return "how-to";
    case "concepts":
      return "explanation";
    default:
      return "reference";
  }
}
