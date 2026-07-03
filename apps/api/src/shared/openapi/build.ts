import { zodToJsonSchema } from 'zod-to-json-schema';

import { PUBLIC_ERROR_CODES } from '@nombaone/errors';

import { OPENAPI_SCHEMAS, type ValidationSchemas } from '@shared/http';

import { RESPONSE_DATA_BY_ROUTE, RESPONSE_SCHEMAS } from './responses';

import type { ZodTypeAny } from 'zod';
import type { Router } from 'express';

const PUBLIC_ERROR_CODES_LIST = [...PUBLIC_ERROR_CODES];

type JsonSchema = Record<string, unknown>;

interface CollectedRoute {
  method: string;
  path: string;
  schemas?: ValidationSchemas;
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

/** Convert a zod schema to an inlined OpenAPI-3 schema object (no `$ref`/`$schema`). */
function toJsonSchema(schema: ZodTypeAny): JsonSchema {
  const js = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as JsonSchema;
  delete js.$schema;
  return js;
}

/**
 * Recursively collect (method, path, schemas) from a mounted Express router stack.
 * The `schemas` are read off the `validate` middleware in the route's own stack
 * (tagged with `OPENAPI_SCHEMAS`), so the advertised request shape is the EXACT
 * one the server enforces — it cannot drift.
 */
function collectRoutes(router: Router, prefix: string, out: CollectedRoute[]): void {
  const stack = (router as unknown as { stack?: unknown[] }).stack ?? [];
  for (const raw of stack) {
    const layer = raw as {
      route?: { path: string; methods: Record<string, boolean>; stack?: unknown[] };
      handle?: Router;
      name?: string;
    };
    if (layer.route) {
      // Find the validate middleware tagged with the enforced schemas.
      let schemas: ValidationSchemas | undefined;
      for (const s of layer.route.stack ?? []) {
        const tagged = (s as { handle?: Record<symbol, unknown> }).handle;
        const found = tagged?.[OPENAPI_SCHEMAS] as ValidationSchemas | undefined;
        if (found) schemas = found;
      }
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.push({ method, path: prefix + layer.route.path, schemas });
      }
    } else if (layer.name === 'router' && layer.handle) {
      collectRoutes(layer.handle, prefix, out);
    }
  }
}

/** Query zod schema → OpenAPI `parameters[]` (one per top-level property). */
function queryParameters(schema: ZodTypeAny): JsonSchema[] {
  const js = toJsonSchema(schema);
  const properties = (js.properties as Record<string, JsonSchema>) ?? {};
  const required = new Set((js.required as string[]) ?? []);
  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: propSchema,
  }));
}

/** Path `{param}` placeholders → OpenAPI path `parameters[]` (always required strings). */
function pathParameters(specPath: string): JsonSchema[] {
  const names = [...specPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
  return names.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } }));
}

/** The success body for a route: `{ success, statusCode, data: <Ref|[Ref]>, meta }`. */
function successResponse(routeKey: string): JsonSchema {
  const mapped = RESPONSE_DATA_BY_ROUTE[routeKey];
  const data: JsonSchema = mapped
    ? mapped.list
      ? { type: 'array', items: { $ref: `#/components/schemas/${mapped.ref}` } }
      : { $ref: `#/components/schemas/${mapped.ref}` }
    : { type: 'object', description: 'Resource payload' };
  return {
    description: 'Success',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            statusCode: { type: 'integer' },
            data: data,
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
        },
      },
    },
  };
}

/**
 * Build the OpenAPI 3.1 document (L ⚠). Paths are WALKED from the actually-mounted
 * `v1Router`, so the spec cannot advertise an endpoint the server does not serve.
 * Each operation carries: the `ApiKeyAuth` bearer scheme; the `Idempotency-Key`
 * header on mutating ops; the EXACT request body + query/path parameters the route
 * enforces (from the `validate` schemas — item 1); a typed success envelope; and the
 * shared `ApiError` envelope (with the `PUBLIC_ERROR_CODES` enum) as the default.
 */
export function buildOpenApiDocument(v1Router: Router, baseUrl = 'http://localhost:8000'): Record<string, unknown> {
  const routes: CollectedRoute[] = [];
  collectRoutes(v1Router, '/v1', routes);

  const paths: Record<string, Record<string, JsonSchema>> = {};
  for (const { method, path, schemas } of routes) {
    // Express `:param` → OpenAPI `{param}`.
    const specPath = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const routeKey = `${method} ${specPath}`;

    const parameters: JsonSchema[] = [...pathParameters(specPath)];
    if (MUTATING.has(method)) {
      parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } });
    }
    if (schemas?.query) parameters.push(...queryParameters(schemas.query));

    const op: JsonSchema = {
      summary: `${method.toUpperCase()} ${specPath}`,
      security: [{ ApiKeyAuth: [] }],
      parameters,
      responses: {
        '200': successResponse(routeKey),
        default: {
          description: 'Error (ApiError envelope)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
      },
    };

    if (schemas?.body) {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(schemas.body) } },
      };
    }

    (paths[specPath] ??= {})[method] = op;
  }

  return {
    // 3.0.3: the schemas use 3.0-style `nullable` (both the zod-to-json-schema `openApi3`
    // target and the response mirrors), so the version label matches the schema dialect.
    openapi: '3.0.3',
    info: { title: 'nombaone API', version: 'v1', description: 'Subscription billing on Nomba rails.' },
    servers: [{ url: `${baseUrl}/v1`, description: 'test mode (test-environment API keys)' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'http', scheme: 'bearer', description: 'A tenant API key: `Authorization: Bearer <secret>`.' },
      },
      schemas: {
        ResponseMeta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            pagination: {
              type: 'object',
              properties: {
                nextCursor: { type: 'string', nullable: true },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
        ApiError: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            statusCode: { type: 'integer' },
            error: {
              type: 'object',
              required: ['code', 'message', 'hint', 'docUrl'],
              properties: {
                code: { type: 'string', enum: PUBLIC_ERROR_CODES_LIST },
                message: { type: 'string' },
                hint: { type: 'string', description: 'Actionable, plain-English guidance on exactly what to do next.' },
                docUrl: { type: 'string', description: "Deep link to this code's entry in the public error reference." },
                fields: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
              },
            },
            meta: { $ref: '#/components/schemas/ResponseMeta' },
          },
        },
        ...RESPONSE_SCHEMAS,
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths,
  };
}
