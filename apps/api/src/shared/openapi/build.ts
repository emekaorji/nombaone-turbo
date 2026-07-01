import { PUBLIC_ERROR_CODES } from '@nombaone/errors';

import type { Router } from 'express';

const PUBLIC_ERROR_CODES_LIST = [...PUBLIC_ERROR_CODES];

interface OpenApiOperation {
  summary: string;
  security: { ApiKeyAuth: [] }[];
  parameters?: { name: string; in: string; required: boolean; schema: { type: string } }[];
  responses: Record<string, { description: string }>;
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

/** Recursively collect (method, path) pairs from a mounted Express router stack. */
function collectRoutes(router: Router, prefix: string, out: { method: string; path: string }[]): void {
  // Express keeps mounted routes/sub-routers in the (untyped) `stack`.
  const stack = (router as unknown as { stack?: unknown[] }).stack ?? [];
  for (const raw of stack) {
    const layer = raw as {
      route?: { path: string; methods: Record<string, boolean> };
      handle?: Router;
      name?: string;
    };
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.push({ method, path: prefix + layer.route.path });
      }
    } else if (layer.name === 'router' && layer.handle) {
      collectRoutes(layer.handle, prefix, out);
    }
  }
}

/**
 * Build the OpenAPI 3.1 document (L ⚠). Paths are WALKED from the actually-mounted
 * `v1Router`, so the spec cannot advertise an endpoint the server does not serve.
 * The `ApiKeyAuth` bearer scheme, the single `ApiError` envelope, the
 * `PUBLIC_ERROR_CODES` enum, and the `Idempotency-Key` header on every mutating
 * operation are declared as the documented contract.
 */
export function buildOpenApiDocument(v1Router: Router, baseUrl = 'http://localhost:8000'): Record<string, unknown> {
  const routes: { method: string; path: string }[] = [];
  collectRoutes(v1Router, '/v1', routes);

  const paths: Record<string, Record<string, OpenApiOperation>> = {};
  for (const { method, path } of routes) {
    // Express `:param` → OpenAPI `{param}`.
    const specPath = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const op: OpenApiOperation = {
      summary: `${method.toUpperCase()} ${specPath}`,
      security: [{ ApiKeyAuth: [] }],
      responses: { '200': { description: 'Success' }, default: { description: 'Error (ApiError envelope)' } },
    };
    if (MUTATING.has(method)) {
      op.parameters = [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }];
    }
    (paths[specPath] ??= {})[method] = op;
  }

  return {
    openapi: '3.1.0',
    info: { title: 'nombaone API', version: 'v1', description: 'Subscription billing on Nomba rails.' },
    servers: [{ url: `${baseUrl}/v1`, description: 'test mode (test-environment API keys)' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'http', scheme: 'bearer', description: 'A tenant API key: `Authorization: Bearer <secret>`.' },
      },
      schemas: {
        ApiError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: PUBLIC_ERROR_CODES_LIST },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths,
  };
}
