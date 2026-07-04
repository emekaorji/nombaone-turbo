/**
 * Ask-AI grounding index (Phase 09). Emits `public/ask-index.json` — the corpus
 * the in-docs assistant retrieves over, so every answer is grounded in real
 * documentation and never invented. Three sources, all in-repo:
 *
 *   - page chunks (heading-scoped) from the built search index,
 *   - every API operation from the committed OpenAPI snapshot,
 *   - every public error code + hint from the registry.
 *
 * Each chunk is `{ type, url, title, text }`. Runs after `search:index` so the
 * page chunks already exist. Run with `pnpm -F @nombaone/docs ask:index`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { ERROR_CODE_META, PUBLIC_ERROR_CODES } from "@nombaone/errors";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const OPENAPI = path.join(process.cwd(), "src", "generated", "openapi.json");
const BASE = "https://docs.nombaone.xyz";

interface Chunk {
  type: "page" | "operation" | "error";
  url: string;
  title: string;
  text: string;
}

interface SearchRecord {
  title: string;
  heading?: string;
  text: string;
  url: string;
}

async function pageChunks(): Promise<Chunk[]> {
  try {
    const raw = await fs.readFile(path.join(PUBLIC_DIR, "search-index.json"), "utf8");
    const records = JSON.parse(raw) as SearchRecord[];
    return records
      .filter((r) => (r.text ?? "").trim().length > 0)
      .map((r) => ({
        type: "page" as const,
        url: `${BASE}${r.url}`,
        title: r.heading ? `${r.title} — ${r.heading}` : r.title,
        text: r.text,
      }));
  } catch {
    return [];
  }
}

async function operationChunks(): Promise<Chunk[]> {
  try {
    const spec = JSON.parse(await fs.readFile(OPENAPI, "utf8")) as {
      paths: Record<string, Record<string, { summary?: string; parameters?: { name: string; required?: boolean }[] }>>;
    };
    const out: Chunk[] = [];
    for (const [p, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const params = (op.parameters ?? []).map((x) => (x.required ? `${x.name} (required)` : x.name)).join(", ");
        out.push({
          type: "operation",
          url: `${BASE}/reference`,
          title: `${method.toUpperCase()} ${p}`,
          text: `${method.toUpperCase()} ${p}${op.summary ? ` — ${op.summary}` : ""}. ${
            params ? `Parameters: ${params}. ` : ""
          }All money fields are integer kobo.`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function errorChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (const code of PUBLIC_ERROR_CODES) {
    const meta = (ERROR_CODE_META as Record<string, { hint?: string }>)[code];
    if (!meta) continue;
    out.push({
      type: "error",
      url: `${BASE}/errors#${code}`,
      title: `Error: ${code}`,
      text: `${code}: ${meta.hint ?? ""}`,
    });
  }
  return out;
}

async function main() {
  const chunks: Chunk[] = [
    ...(await pageChunks()),
    ...(await operationChunks()),
    ...errorChunks(),
  ];
  await fs.writeFile(path.join(PUBLIC_DIR, "ask-index.json"), JSON.stringify(chunks), "utf8");
  console.log(
    `[ask-index] wrote ${chunks.length} chunks (pages + operations + errors) → public/ask-index.json`,
  );
}

main().catch((err) => {
  console.error("[ask-index] failed:", err);
  process.exit(1);
});
