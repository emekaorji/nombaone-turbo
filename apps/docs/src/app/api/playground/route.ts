import { NextResponse } from "next/server";

import { isAllowedOperation } from "@/lib/playground-allowlist";

/**
 * Playground proxy: forwards a single `<ApiExplorer>` request to the Nombaone
 * Infra public API with the developer's **test** key. This is a real security
 * surface; the hard rules (locked in `01-ARCHITECTURE.md` §7) are enforced here:
 *
 *   - TEST KEYS ONLY: any `nbo_live_` key is rejected outright (422). Live
 *     money must never flow through the docs.
 *   - NO PERSISTENCE / NO LOGGING of the key or the request body, ever.
 *   - HOST ALLOWLIST: only the configured infra API base is reachable; the
 *     method + path must be on the documented allowlist.
 *   - Hop-by-hop request headers are stripped; only Authorization,
 *     Content-Type, Idempotency-Key, and the request id pass through.
 *   - Short timeout; the upstream status + JSON envelope are returned verbatim.
 *
 * P0 ships the proxy with the rules; the schema-driven allowlist + per-IP rate
 * limit are tightened as the reference pages land (P3+). Returning early on the
 * live-key check is the load-bearing safety property proven by the spike.
 */

const INFRA_API_BASE =
  process.env.NEXT_PUBLIC_INFRA_API_BASE ?? "https://sandbox.api.nombaone.xyz/v1";

/**
 * The base must be a TEST/sandbox base for the `/test/*` instruments to be
 * forwardable — they mount only on a test deployment and must never touch a live
 * host. If the base isn't recognizably test/sandbox/local, `/test/*` is refused.
 */
const IS_TEST_BASE = /sandbox|test|localhost|127\.0\.0\.1/i.test(INFRA_API_BASE);

/** Methods we forward: reads (GET) + every mutating verb the reference documents. */
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

const REQUEST_TIMEOUT_MS = 12_000;

interface PlaygroundRequest {
  method?: string;
  path?: string;
  apiKey?: string;
  body?: unknown;
  idempotencyKey?: string;
}

export async function POST(request: Request): Promise<Response> {
  let payload: PlaygroundRequest;
  try {
    payload = (await request.json()) as PlaygroundRequest;
  } catch {
    return error(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  const method = (payload.method ?? "GET").toUpperCase();
  const path = payload.path ?? "";
  const apiKey = payload.apiKey?.trim() ?? "";

  // --- Hard rule: test keys only ------------------------------------------
  if (apiKey.startsWith("nbo_live_")) {
    return error(
      422,
      "LIVE_KEY_REJECTED",
      "The playground only accepts test keys (nbo_test_…). Never paste a live key here.",
    );
  }
  if (apiKey && !apiKey.startsWith("nbo_test_")) {
    return error(
      422,
      "INVALID_KEY_FORMAT",
      "API key must be an Nombaone test key (nbo_test_…).",
    );
  }

  // --- Method + path allowlist --------------------------------------------
  if (!ALLOWED_METHODS.has(method)) {
    return error(405, "METHOD_NOT_ALLOWED", `Method ${method} is not forwardable.`);
  }
  if (!path.startsWith("/") || !isAllowedOperation(method, path)) {
    return error(
      403,
      "PATH_NOT_ALLOWED",
      "That operation is not on the playground allowlist — it isn't in the API's OpenAPI snapshot.",
    );
  }
  // Test instruments (`/test/*`) must never be forwarded to a live base.
  if (path.startsWith("/test") && !IS_TEST_BASE) {
    return error(
      403,
      "TEST_ROUTE_ON_NON_TEST_BASE",
      "The test instruments are only available against a test/sandbox base.",
    );
  }

  // Use a demo sandbox key if the caller did not bring one (GET reads only).
  const effectiveKey = apiKey || (method === "GET" ? process.env.INFRA_DEMO_SANDBOX_KEY : "");
  if (!effectiveKey) {
    return error(401, "MISSING_KEY", "Paste a test key (nbo_test_…) to send this request.");
  }

  const upstreamUrl = `${INFRA_API_BASE}${path}`;

  // Only forward a curated, hop-by-hop-free header set. Never echo cookies.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${effectiveKey}`,
    Accept: "application/json",
  };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    // Idempotency-Key is required on money POSTs; pass the client's through.
    if (payload.idempotencyKey) headers["Idempotency-Key"] = payload.idempotencyKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(payload.body ?? {}) : undefined,
      signal: controller.signal,
      // Never cache a playground call.
      cache: "no-store",
    });

    const text = await upstream.text();
    // Pass the upstream envelope + status straight back; echo the request id.
    const out = new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
    const requestId = upstream.headers.get("x-request-id");
    if (requestId) out.headers.set("X-Request-Id", requestId);
    return out;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return error(504, "UPSTREAM_TIMEOUT", "The Nombaone API did not respond in time.");
    }
    return error(502, "UPSTREAM_UNREACHABLE", "Could not reach the Nombaone API.");
  } finally {
    clearTimeout(timeout);
  }
}

/** Uniform proxy error envelope (mirrors the infra `{ success, error }` shape). */
function error(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, message, data: null, error: { status, code } },
    { status },
  );
}
