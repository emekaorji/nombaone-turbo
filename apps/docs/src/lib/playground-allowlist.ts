import openapi from "@/generated/openapi.json";

/**
 * The schema-driven playground allowlist. Every forwardable operation is derived
 * from the committed OpenAPI snapshot (`src/generated/openapi.json`, produced by
 * `pnpm --filter @nombaone/api gen:openapi`) — so the proxy can only ever forward
 * an operation the API actually documents, and adding an endpoint + re-snapshotting
 * auto-allows it with no edit here. A path absent from the snapshot is refused.
 */

interface OperationMatcher {
  method: string;
  /** Matches an incoming path (sans the `/v1` base) against the path template. */
  regex: RegExp;
}

const FORWARDABLE = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function buildMatchers(): OperationMatcher[] {
  const paths = (openapi as { paths?: Record<string, Record<string, unknown>> }).paths ?? {};
  const matchers: OperationMatcher[] = [];
  for (const [template, operations] of Object.entries(paths)) {
    // "/v1/customers/{id}" → "/customers/{id}" → ^/customers/[^/]+$
    const rel = template.replace(/^\/v1/, "");
    const pattern = `^${rel.replace(/\{[^}]+\}/g, "[^/]+")}$`;
    const regex = new RegExp(pattern);
    for (const method of Object.keys(operations)) {
      const upper = method.toUpperCase();
      if (FORWARDABLE.has(upper)) matchers.push({ method: upper, regex });
    }
  }
  return matchers;
}

const MATCHERS = buildMatchers();

/** True when `method` + `path` (sans `/v1`) is a documented, forwardable operation. */
export function isAllowedOperation(method: string, path: string): boolean {
  return MATCHERS.some((m) => m.method === method && m.regex.test(path));
}

/** The count of documented operations (for a sanity assertion / diagnostics). */
export const DOCUMENTED_OPERATION_COUNT = MATCHERS.length;
