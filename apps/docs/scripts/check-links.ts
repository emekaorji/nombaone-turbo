/**
 * Internal link checker (launch gate). Parses every `.mdx` for internal links —
 * Markdown `](/path#anchor)` and JSX `href="/path#anchor"` — and verifies each:
 *
 *   1. the PATH resolves to a routable slug (content page or manifest slug), and
 *   2. the ANCHOR, if present, exists on the target page — a heading id or a
 *      component-generated id (error codes on /errors, event types on the event
 *      catalog, operation anchors on the ApiReference reference pages).
 *
 * Dead paths FAIL (exit non-zero). Unresolved anchors are reported as warnings
 * (some pages carry component anchors this checker can't fully model). Run with
 * `pnpm -F @nombaone/docs check:links`; wired into the docs quality gate.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { WEBHOOK_EVENT_CATALOG } from "@nombaone/core-contracts/types";
import { PUBLIC_ERROR_CODES } from "@nombaone/errors";

import { ALL_SLUGS } from "../content/manifest";
import { apiRefSlugs } from "../src/lib/api-ref/routing";
import { extractHeadings, slugify } from "../src/lib/content";

import openapi from "../src/generated/openapi.json";

const CONTENT_DIR = path.join(process.cwd(), "content");

const spec = openapi as unknown as { paths: Record<string, Record<string, unknown>> };

/** Replicates api-reference.tsx `anchor(method, path)`. */
function opAnchor(method: string, p: string): string {
  return `${method}-${p.replace(/^\/v1\//, "").replace(/[^a-z0-9]+/gi, "-")}`.toLowerCase();
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

function fileToSlug(file: string): string {
  const rel = path.relative(CONTENT_DIR, file).replace(/\.mdx$/, "");
  return rel === "index" ? "" : `/${rel}`;
}

/** Build the set of valid anchors for a page slug given its body. */
function anchorsFor(slug: string, body: string): Set<string> {
  const anchors = new Set<string>();
  for (const h of extractHeadings(body)) anchors.add(h.id);

  // Component-generated ids.
  if (slug === "/errors") {
    for (const code of PUBLIC_ERROR_CODES) anchors.add(code);
  }
  if (slug === "/webhooks/event-catalog") {
    for (const type of Object.keys(WEBHOOK_EVENT_CATALOG)) anchors.add(type);
  }
  const apiMatch = body.match(/<ApiReference\s+resource="([^"]+)"/);
  if (apiMatch) {
    const resource = apiMatch[1];
    for (const [p, methods] of Object.entries(spec.paths)) {
      if (p.replace(/^\/v1\//, "").split("/")[0] !== resource) continue;
      for (const method of Object.keys(methods)) anchors.add(opAnchor(method, p));
    }
  }
  return anchors;
}

const LINK_RE = /(?:\]\(|href=")(\/[^)"\s#]*(?:#[^)"\s]*)?)/g;

async function main() {
  const files = await listMdx(CONTENT_DIR);

  const routable = new Set<string>(ALL_SLUGS);
  routable.add("");
  // The disintegrated API reference is generated from the OpenAPI model, not
  // authored MDX — register every /reference index/resource/operation slug.
  for (const s of apiRefSlugs()) routable.add(s);
  const anchorsBySlug = new Map<string, Set<string>>();
  const linksByFile = new Map<string, { raw: string; targetSlug: string; anchor: string | null }[]>();

  for (const file of files) {
    const { content } = matter(await fs.readFile(file, "utf8"));
    const slug = fileToSlug(file);
    routable.add(slug);
    anchorsBySlug.set(slug, anchorsFor(slug, content));

    const links: { raw: string; targetSlug: string; anchor: string | null }[] = [];
    for (const m of content.matchAll(LINK_RE)) {
      const href = m[1];
      const [p, anchor] = href.split("#");
      // Ignore public asset links (llms.txt, .md mirrors, .well-known, api routes).
      if (/\.(txt|md|json|xml|png|svg|jpg)$/.test(p) || p.startsWith("/api/") || p.startsWith("/.well-known")) {
        continue;
      }
      links.push({ raw: href, targetSlug: p.replace(/\/$/, "") || "", anchor: anchor ?? null });
    }
    linksByFile.set(slug, links);
  }

  const deadPaths: string[] = [];
  const deadAnchors: string[] = [];

  for (const [slug, links] of linksByFile) {
    for (const link of links) {
      if (!routable.has(link.targetSlug)) {
        deadPaths.push(`${slug || "/"} → ${link.raw}  (path not routable)`);
        continue;
      }
      if (link.anchor) {
        const anchors = anchorsBySlug.get(link.targetSlug);
        // Only check anchors for pages we have content for (skip pure manifest stubs).
        if (anchors && !anchors.has(link.anchor)) {
          deadAnchors.push(`${slug || "/"} → ${link.raw}  (#${link.anchor} not found)`);
        }
      }
    }
  }

  if (deadAnchors.length > 0) {
    console.warn(`\n[check-links] ${deadAnchors.length} unresolved anchor(s):`);
    for (const d of deadAnchors) console.warn("  ⚠ " + d);
  }

  if (deadPaths.length > 0) {
    console.error(`\n[check-links] ${deadPaths.length} DEAD internal link(s):`);
    for (const d of deadPaths) console.error("  ✗ " + d);
    console.error("");
    process.exit(1);
  }

  console.log(
    `[check-links] OK — ${linksByFile.size} pages, all internal paths resolve` +
      (deadAnchors.length ? ` (${deadAnchors.length} anchor warnings)` : ""),
  );
}

main().catch((err) => {
  console.error("[check-links] failed:", err);
  process.exit(1);
});
