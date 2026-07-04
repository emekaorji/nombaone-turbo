/**
 * Agent-native build (Phase 09, docs-as-data). Runs before `next build` and
 * emits three artifacts into `public/`:
 *
 *   - `public/<slug>.md`  — a clean Markdown mirror of every page, so any URL
 *     can be fetched as raw Markdown by appending `.md`.
 *   - `public/llms.txt`   — the curated index (llms.txt convention): one row per
 *     manifest slug, linking the `.md` mirror, with its summary.
 *   - `public/llms-full.txt` — the inlined corpus: every page's Markdown, plus a
 *     compact rendering of every API operation and every public error code, so
 *     an agent fed only this file can name the right endpoint, field, unit
 *     (integer kobo), and error code.
 *
 * All sources are in-repo (content tree, the committed OpenAPI snapshot, the
 * error registry) — no network. Deterministic: same inputs → identical output.
 *
 * Run standalone with `pnpm -F @nombaone/docs agent:native`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { ERROR_CODE_META, PUBLIC_ERROR_CODES } from "@nombaone/errors";

import { MANIFEST, findSection } from "../content/manifest";
import { pageToMarkdown, sectionType } from "../src/lib/md-mirror";

const CONTENT_DIR = path.join(process.cwd(), "content");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const OPENAPI = path.join(process.cwd(), "src", "generated", "openapi.json");
const BASE = "https://docs.nombaone.xyz";

const SITE_SUMMARY =
  "Nomba One is a subscription-billing engine on Nomba (Nigerian payments): plans, cycles, " +
  "proration, dunning, and settlement over card, direct debit, bank transfer, and crypto. " +
  "Money is integer kobo, recorded in a double-entry ledger; multi-tenant, with per-organization " +
  "sub-account settlement. These docs are honest about the hard parts (thin balances, card OTP, " +
  "push vs pull rails) and every runnable example hits the real sandbox.";

async function listMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMdxFiles(full)));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

/** file path → URL slug (leading slash, no extension; index → ''). */
function fileToSlug(file: string): string {
  const rel = path.relative(CONTENT_DIR, file).replace(/\.mdx$/, "");
  if (rel === "index") return "";
  return `/${rel}`;
}

interface BuiltPage {
  slug: string;
  title: string;
  summary: string;
  type: string;
  markdown: string;
}

async function buildPages(): Promise<BuiltPage[]> {
  const files = await listMdxFiles(CONTENT_DIR);
  const pages: BuiltPage[] = [];

  for (const file of files) {
    const rawFile = await fs.readFile(file, "utf8");
    const { data, content } = matter(rawFile);
    const slug = fileToSlug(file);
    const canonical = `${BASE}${slug || "/"}`;
    const section = findSection(slug);
    const type = sectionType(section?.key);
    const title = (data.title as string) ?? slug;
    const summary = (data.description as string) ?? "";

    const markdown = pageToMarkdown({ title, type, summary, canonical, body: content });

    // Write the mirror to public/<slug>.md (index → public/index.md + root).
    const outRel = slug === "" ? "index.md" : `${slug.replace(/^\//, "")}.md`;
    const outPath = path.join(PUBLIC_DIR, outRel);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, markdown, "utf8");

    pages.push({ slug, title, summary, type, markdown });
  }

  return pages;
}

function buildLlmsIndex(): string {
  const lines: string[] = [];
  lines.push("# Nomba One");
  lines.push("");
  lines.push(`> ${SITE_SUMMARY}`);
  lines.push("");
  lines.push(
    "This is the agent index. Every link points at a clean Markdown mirror " +
      "(append `.md` to any docs URL). For the full inlined corpus, see " +
      `${BASE}/llms-full.txt`,
  );
  lines.push("");

  for (const section of MANIFEST) {
    lines.push(`## ${section.title}`);
    lines.push("");
    const rows: { slug: string; title: string; summary?: string }[] = [];
    for (const item of section.items) {
      rows.push(item);
      for (const child of item.children ?? []) rows.push(child);
    }
    for (const row of rows) {
      const url = `${BASE}${row.slug || "/"}.md`.replace("//.md", "/index.md");
      const suffix = row.summary ? `: ${row.summary}` : "";
      lines.push(`- [${row.title}](${url})${suffix}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildOperationsSection(spec: {
  paths: Record<string, Record<string, { summary?: string; parameters?: { name: string; required?: boolean }[] }>>;
}): string {
  const lines: string[] = ["## API operations", ""];
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const params = (op.parameters ?? [])
        .map((x) => (x.required ? `${x.name}*` : x.name))
        .join(", ");
      lines.push(`- \`${method.toUpperCase()} ${p}\`${op.summary ? ` — ${op.summary}` : ""}${params ? ` (params: ${params})` : ""}`);
    }
  }
  lines.push("");
  lines.push("All money fields are integer kobo (e.g. `250000` = ₦2,500.00).");
  lines.push("");
  return lines.join("\n");
}

function buildErrorsSection(): string {
  const lines: string[] = ["## Error codes", ""];
  for (const code of PUBLIC_ERROR_CODES) {
    const meta = ERROR_CODE_META[code];
    if (!meta) continue;
    const status = (meta as { httpStatus?: number; status?: number }).httpStatus ??
      (meta as { status?: number }).status ?? "";
    const hint = (meta as { hint?: string; message?: string }).hint ??
      (meta as { message?: string }).message ?? "";
    lines.push(`- \`${code}\`${status ? ` (${status})` : ""}${hint ? ` — ${hint}` : ""}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function buildLlmsFull(pages: BuiltPage[]): Promise<string> {
  const parts: string[] = [];
  parts.push("# Nomba One — full documentation corpus");
  parts.push("");
  parts.push(`> ${SITE_SUMMARY}`);
  parts.push("");
  parts.push("---");
  parts.push("");

  for (const page of pages) {
    parts.push(page.markdown.trim());
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  try {
    const spec = JSON.parse(await fs.readFile(OPENAPI, "utf8"));
    parts.push(buildOperationsSection(spec));
    parts.push("---");
    parts.push("");
  } catch {
    // snapshot absent — skip the operations section rather than fail the build
  }

  parts.push(buildErrorsSection());

  return `${parts.join("\n").trim()}\n`;
}

async function main() {
  const pages = await buildPages();
  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  await fs.writeFile(path.join(PUBLIC_DIR, "llms.txt"), buildLlmsIndex(), "utf8");
  await fs.writeFile(path.join(PUBLIC_DIR, "llms-full.txt"), await buildLlmsFull(pages), "utf8");

  console.log(
    `[agent-native] wrote ${pages.length} .md mirrors + llms.txt + llms-full.txt → public/`,
  );
}

main().catch((err) => {
  console.error("[agent-native] failed:", err);
  process.exit(1);
});
