import { API_INFO, getApiResources, getOperation, getResource, type ApiOperation, type ApiResource } from "./model";

/**
 * URL ↔ operation-model resolution for the disintegrated reference. The docs
 * catch-all asks `resolveApiRef(slug)` for every path; a match renders the
 * generated API article, a miss (e.g. `/reference/glossary`) falls through to
 * MDX. `apiRefSlugs()` feeds `generateStaticParams` so every page prerenders.
 */

export type ApiRefMatch =
  | { kind: "index" }
  | { kind: "resource"; resource: ApiResource }
  | { kind: "operation"; resource: ApiResource; operation: ApiOperation };

/** Resolve a docs slug (`/reference`, `/reference/customers`, `…/create`). */
export function resolveApiRef(slug: string): ApiRefMatch | null {
  const parts = slug.replace(/^\//, "").split("/").filter(Boolean);
  if (parts[0] !== "reference") return null;
  if (parts.length === 1) return { kind: "index" };

  const resource = getResource(parts[1]!);
  if (!resource) return null;
  if (parts.length === 2) return { kind: "resource", resource };

  const operation = getOperation(parts[1]!, parts[2]!);
  if (parts.length === 3 && operation) return { kind: "operation", resource, operation };
  return null;
}

/** Every reference slug (index + resources + operations), for static params. */
export function apiRefSlugs(): string[] {
  const slugs = ["/reference"];
  for (const r of getApiResources()) {
    slugs.push(`/reference/${r.slug}`);
    for (const o of r.operations) slugs.push(`/reference/${r.slug}/${o.slug}`);
  }
  return slugs;
}

/** Title + description for `generateMetadata` on a reference path. */
export function apiRefMeta(match: ApiRefMatch): { title: string; description: string } {
  switch (match.kind) {
    case "index":
      return {
        title: "API reference",
        description: `The ${API_INFO.title} (${API_INFO.version}). Every resource and operation, with copy-runnable samples in cURL and all nine SDKs.`,
      };
    case "resource":
      return {
        title: match.resource.title,
        description: `${match.resource.title} — every operation on the resource, with request and response shapes and samples in every SDK.`,
      };
    case "operation":
      return {
        title: `${match.operation.title} · ${match.resource.title}`,
        description: `${match.operation.method.toUpperCase()} ${match.operation.path} — ${match.operation.title}, with request and response shapes and samples in cURL and all nine SDKs.`,
      };
  }
}
