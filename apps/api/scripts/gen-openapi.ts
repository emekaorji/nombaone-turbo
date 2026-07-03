/**
 * Generate the OpenAPI snapshot artifact the docs consume at BUILD time.
 *
 * The docs must NOT import the Express router directly (it transitively pulls in
 * DB/redis config). Instead this script — run in the apps/api workspace where
 * those are available — walks the mounted `v1Router` PLUS the test router (which
 * only mounts at runtime when INFRA_ENVIRONMENT=test) and writes the spec to
 * `apps/docs/src/generated/openapi.json`. The docs' schema-driven allowlist,
 * multi-language snippet engine, OpenAPI honesty gate, and glossary generator all
 * read that JSON — no router import, no side effects on the docs build.
 *
 * Run: `pnpm --filter @nombaone/api gen:openapi`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Router } from 'express';

import { buildOpenApiDocument } from '../src/shared/openapi/build';
import { testRouter } from '../src/apps/main/modules/test';
import { v1Router } from '../src/apps/main/server/routes';

// Force the /v1/test/* instruments into the snapshot regardless of the ambient
// INFRA_ENVIRONMENT (they mount conditionally at runtime). Mounting testRouter on
// a fresh router that also carries v1Router keys the paths once — harmless if
// v1Router already included it under a test env.
const full: Router = Router();
full.use(v1Router);
full.use(testRouter);

const doc = buildOpenApiDocument(full);
const paths = (doc as { paths?: Record<string, unknown> }).paths ?? {};

const out = join(__dirname, '../../docs/src/generated/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`[gen:openapi] wrote ${out} — ${Object.keys(paths).length} paths`);
process.exit(0);
