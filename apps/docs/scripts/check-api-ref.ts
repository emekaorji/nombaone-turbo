/**
 * API-reference drift gate. The reference is generated from the OpenAPI model,
 * so this proves it can't silently rot as the spec changes:
 *
 *   1. Coverage — every spec operation on a public resource has a model page.
 *   2. Uniqueness — slugs are unique within a resource (no two ops share a URL).
 *   3. Snippets — every operation renders a non-empty sample in all 10 languages.
 *
 * A new endpoint added to the API therefore either appears in the docs or trips
 * this gate. Run via `pnpm -F @nombaone/docs check:api-ref`; wired into the gate.
 */

import { getApiResources } from "../src/lib/api-ref/model";
import { buildOperationSnippets, SNIPPET_LANGS } from "../src/lib/api-ref/snippets";

import openapi from "../src/generated/openapi.json";

const HTTP = new Set(["get", "post", "put", "patch", "delete"]);
const spec = openapi as unknown as { paths: Record<string, Record<string, unknown>> };

function specResource(p: string): string {
  return p.replace(/^\/v1\//, "").split("/")[0] ?? "";
}

function main() {
  const resources = getApiResources();
  const included = new Set(resources.map((r) => r.slug));
  const problems: string[] = [];

  // Model's operation ids (`METHOD /v1/...`).
  const modelIds = new Set(resources.flatMap((r) => r.operations.map((o) => o.id)));

  // 1. Coverage: every spec operation on an included resource is in the model.
  let specCount = 0;
  for (const [p, methods] of Object.entries(spec.paths)) {
    if (!included.has(specResource(p))) continue;
    for (const method of Object.keys(methods)) {
      if (!HTTP.has(method)) continue;
      specCount++;
      const id = `${method.toUpperCase()} ${p}`;
      if (!modelIds.has(id)) problems.push(`coverage: spec op ${id} has no model page`);
    }
  }

  // 2. Uniqueness: slugs unique within each resource.
  let opCount = 0;
  for (const r of resources) {
    const seen = new Set<string>();
    for (const o of r.operations) {
      opCount++;
      if (seen.has(o.slug)) problems.push(`duplicate slug: ${r.slug}/${o.slug} (${o.id})`);
      seen.add(o.slug);
    }
  }
  if (opCount !== specCount) {
    problems.push(`count mismatch: model has ${opCount} ops, spec has ${specCount} for included resources`);
  }

  // 3. Snippets: every op renders a non-empty sample in all 10 languages.
  for (const r of resources) {
    for (const o of r.operations) {
      const snips = buildOperationSnippets(o);
      for (const lang of SNIPPET_LANGS) {
        if (!snips[lang] || !snips[lang].trim()) {
          problems.push(`empty snippet: ${o.id} [${lang}]`);
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error(`\n[check-api-ref] ${problems.length} problem(s):`);
    for (const p of problems) console.error("  ✗ " + p);
    console.error("");
    process.exit(1);
  }

  console.log(
    `[check-api-ref] OK — ${resources.length} resources, ${opCount} operations, ` +
      `${opCount * SNIPPET_LANGS.length} snippets across ${SNIPPET_LANGS.length} languages`,
  );
}

main();
