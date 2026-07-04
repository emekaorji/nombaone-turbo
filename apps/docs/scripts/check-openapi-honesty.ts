/**
 * OpenAPI honesty gate (launch gate). Scans every fenced code block in the docs
 * for Nomba One API calls — `curl -X POST https://…/v1/plans`, bare
 * `POST /v1/subscriptions`, `GET /v1/customers/{id}` — and verifies each
 * METHOD + PATH exists in the committed OpenAPI snapshot. An invented endpoint
 * or a typo in a path fails the build, so no code sample can promise a call the
 * API doesn't serve.
 *
 * Path templating is normalised: a concrete `/v1/plans/nbo123/prices` or a
 * placeholder `/v1/plans/{planId}/prices` both match the spec's
 * `/v1/plans/{id}/prices`. Run with `pnpm -F @nombaone/docs check:openapi`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import openapi from "../src/generated/openapi.json";

const CONTENT_DIR = path.join(process.cwd(), "content");
const spec = openapi as unknown as { paths: Record<string, Record<string, unknown>> };

/** Normalise a path to a template key: every `/segment` that isn't a known
 * literal becomes `/{}`. We compare on the shape, not the id values. */
function normalise(p: string): string {
  return p
    .replace(/\/v1/, "")
    .split("/")
    .map((seg) => {
      if (seg === "") return "";
      // A templated or concrete id segment → placeholder.
      if (/^\{.*\}$/.test(seg)) return "{}";
      // Heuristic: a resource id (nbo…, uuid, digits, {planId}) → placeholder.
      if (/^(nbo[a-z0-9]+|\d+|[0-9a-f-]{8,})$/i.test(seg)) return "{}";
      return seg;
    })
    .join("/");
}

/** All valid METHOD+normalisedPath pairs from the spec. */
function specIndex(): Set<string> {
  const set = new Set<string>();
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const method of Object.keys(methods)) {
      set.add(`${method.toUpperCase()} ${normalise(p)}`);
    }
  }
  return set;
}

async function listMdx(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMdx(full)));
    else if (entry.name.endsWith(".mdx")) out.push(full);
  }
  return out;
}

/** Extract fenced code blocks from an MDX body. */
function codeBlocks(body: string): string[] {
  const blocks: string[] = [];
  const re = /```[a-z]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) blocks.push(m[1]);
  return blocks;
}

// A call is either `curl … https://host/v1/PATH` (method from -X or default GET)
// or a bare `METHOD /v1/PATH` line.
const CURL_URL_RE = /https?:\/\/[^/\s]+(\/v1\/[^\s"'`\\]*)/g;
const BARE_RE = /\b(GET|POST|PATCH|PUT|DELETE)\s+(\/v1\/[^\s"'`)]*)/g;

function methodForCurl(block: string): string {
  const m = block.match(/-X\s+(GET|POST|PATCH|PUT|DELETE)/i);
  return (m?.[1] ?? "GET").toUpperCase();
}

async function main() {
  const valid = specIndex();
  const files = await listMdx(CONTENT_DIR);
  const bad: string[] = [];
  let checked = 0;

  for (const file of files) {
    const slug = `/${path.relative(CONTENT_DIR, file).replace(/\.mdx$/, "")}`;
    const { content } = matter(await fs.readFile(file, "utf8"));

    for (const block of codeBlocks(content)) {
      const calls: { method: string; rawPath: string }[] = [];

      if (/\bcurl\b/.test(block)) {
        const method = methodForCurl(block);
        for (const m of block.matchAll(CURL_URL_RE)) {
          calls.push({ method, rawPath: m[1] });
        }
      }
      for (const m of block.matchAll(BARE_RE)) {
        calls.push({ method: m[1].toUpperCase(), rawPath: m[2] });
      }

      for (const call of calls) {
        // Strip trailing punctuation and query strings.
        const clean = call.rawPath.replace(/[).,]+$/, "").split("?")[0];
        const key = `${call.method} ${normalise(clean)}`;
        checked++;
        if (!valid.has(key)) {
          bad.push(`${slug}  →  ${call.method} ${clean}  (not in OpenAPI schema)`);
        }
      }
    }
  }

  if (bad.length > 0) {
    console.error(`\n[check-openapi] ${bad.length} code sample(s) reference an unknown endpoint:`);
    for (const b of [...new Set(bad)]) console.error("  ✗ " + b);
    console.error("");
    process.exit(1);
  }

  console.log(`[check-openapi] OK — ${checked} API calls in code samples all exist in the schema`);
}

main().catch((err) => {
  console.error("[check-openapi] failed:", err);
  process.exit(1);
});
