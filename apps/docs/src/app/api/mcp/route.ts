import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ERROR_CODE_META,
  PUBLIC_ERROR_CODES,
  errorMetaFor,
  type NombaoneErrorCode,
} from "@nombaone/errors";

import openapi from "@/generated/openapi.json";
import { getPage } from "@/lib/content";
import { pageToMarkdown, sectionType } from "@/lib/md-mirror";
import { findSection } from "@content/manifest";

/**
 * Read-only docs MCP server (Phase 09, agent-native). A minimal, spec-compliant
 * JSON-RPC 2.0 Streamable-HTTP handler exposing read tools grounded strictly in
 * the in-repo corpus — the content tree, the committed OpenAPI snapshot, and the
 * error registry. There are deliberately NO write/action tools: execution stays
 * behind the test-keyed playground proxy. An agent connected here answers with
 * real endpoints, real field names, integer kobo, and real error codes — never a
 * hallucinated path.
 *
 * Tools: search_docs, get_page, list_operations, lookup_error, list_test_methods.
 */

const BASE = "https://docs.nombaone.xyz";
const PROTOCOL_VERSION = "2025-06-18";

const spec = openapi as unknown as {
  paths: Record<string, Record<string, { summary?: string; parameters?: { name: string; required?: boolean }[] }>>;
};

interface IndexRecord {
  id: string;
  title: string;
  section?: string;
  heading?: string;
  text: string;
  url: string;
}

let indexCache: IndexRecord[] | null = null;
async function loadIndex(): Promise<IndexRecord[]> {
  if (indexCache) return indexCache;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "search-index.json"), "utf8");
    indexCache = JSON.parse(raw) as IndexRecord[];
  } catch {
    indexCache = [];
  }
  return indexCache;
}

async function searchDocs(query: string, limit = 6) {
  const index = await loadIndex();
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = index
    .map((r) => {
      const title = (r.title ?? "").toLowerCase();
      const heading = (r.heading ?? "").toLowerCase();
      const hay = `${title} ${heading} ${(r.text ?? "").toLowerCase()}`;
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        if (heading.includes(t)) score += 2;
        score += hay.split(t).length - 1;
      }
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => ({
    title: x.r.title,
    heading: x.r.heading ?? null,
    url: `${BASE}${x.r.url}`,
    snippet: (x.r.text ?? "").slice(0, 320),
  }));
}

async function getPageMarkdown(slug: string): Promise<string> {
  const norm = slug === "" || slug === "/" ? "" : `/${slug.replace(/^\/|\.md$/g, "")}`;
  const page = await getPage(norm);
  if (!page) return `# Not found\n\nNo docs page at \`${slug}\`. Try search_docs.`;
  const section = findSection(norm);
  return pageToMarkdown({
    title: page.frontmatter.title,
    type: sectionType(section?.key),
    summary: page.frontmatter.description ?? "",
    canonical: `${BASE}${norm || "/"}`,
    body: page.body,
  });
}

function listOperations() {
  const ops: { method: string; path: string; summary?: string; params: string[] }[] = [];
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      ops.push({
        method: method.toUpperCase(),
        path: p,
        summary: op.summary,
        params: (op.parameters ?? []).map((x) => (x.required ? `${x.name}*` : x.name)),
      });
    }
  }
  return ops;
}

function lookupError(code: string) {
  if (!(code in ERROR_CODE_META)) {
    return { code, found: false, hint: "Unknown error code. See the error reference." };
  }
  const meta = errorMetaFor(code as NombaoneErrorCode);
  return {
    code,
    found: true,
    public: PUBLIC_ERROR_CODES.has(code as NombaoneErrorCode),
    hint: (meta as { hint?: string }).hint ?? "",
    docUrl: (meta as { docUrl?: string }).docUrl ?? `${BASE}/errors#${code}`,
  };
}

const TEST_METHODS = {
  behaviors: ["success", "requires_otp", "decline_insufficient_funds", "decline_expired_card", "decline_do_not_honor"],
  kinds: ["card", "mandate"],
  endpoint: "POST /v1/sandbox/payment-methods",
  note: "Sandbox only. The behavior deterministically decides the charge outcome.",
};

const TOOLS = [
  {
    name: "search_docs",
    description: "Full-text search the Nomba One documentation. Returns the most relevant page chunks with their URLs.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to search for." } },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description: "Fetch a documentation page as clean Markdown by its slug (e.g. 'getting-started/quickstart').",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Page slug, no leading slash." } },
      required: ["slug"],
    },
  },
  {
    name: "list_operations",
    description: "List every Nomba One API operation (method, path, params) from the live OpenAPI schema. Money is integer kobo.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "lookup_error",
    description: "Look up a Nomba One error code and get its fix hint and docs URL.",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "The error code, e.g. UNAUTHORIZED." } },
      required: ["code"],
    },
  },
  {
    name: "list_test_methods",
    description: "List the deterministic sandbox test payment-method behaviors for rehearsing success/decline/OTP.",
    inputSchema: { type: "object", properties: {} },
  },
];

function textResult(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "search_docs":
      return textResult(await searchDocs(String(args.query ?? "")));
    case "get_page":
      return textResult(await getPageMarkdown(String(args.slug ?? "")));
    case "list_operations":
      return textResult(listOperations());
    case "lookup_error":
      return textResult(lookupError(String(args.code ?? "")));
    case "list_test_methods":
      return textResult(TEST_METHODS);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

async function handleRpc(msg: RpcRequest) {
  const { id, method, params } = msg;

  // Notifications (no id) get no response.
  if (id === undefined || id === null) {
    return null;
  }

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0" as const,
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "nombaone-docs", version: "1.0.0" },
            instructions:
              "Read-only Nomba One documentation server. Answer only from these tools; " +
              "amounts are always integer kobo.",
          },
        };
      case "ping":
        return { jsonrpc: "2.0" as const, id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0" as const, id, result: { tools: TOOLS } };
      case "tools/call": {
        const name = String(params?.name ?? "");
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        return { jsonrpc: "2.0" as const, id, result: await callTool(name, args) };
      }
      default:
        return {
          jsonrpc: "2.0" as const,
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0" as const,
      id,
      error: { code: -32603, message: err instanceof Error ? err.message : "Internal error" },
    };
  }
}

export async function POST(req: Request) {
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(handleRpc))).filter(Boolean);
    return Response.json(responses);
  }

  const response = await handleRpc(body);
  if (response === null) return new Response(null, { status: 202 });
  return Response.json(response);
}

export function GET() {
  // We do not support server-initiated SSE streams; this endpoint is POST-only.
  return new Response("Nomba One docs MCP server. POST JSON-RPC 2.0 to this endpoint.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
