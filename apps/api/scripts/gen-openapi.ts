/**
 * Generate the OpenAPI snapshot artifact the docs consume at BUILD time.
 *
 * The docs must NOT import the Express router directly (it transitively pulls in
 * DB/redis config). Instead this script — run in the apps/api workspace where
 * those are available — walks the mounted `v1Router` (which now ALWAYS carries the
 * `/v1/sandbox/*` instruments, since one process serves both modes) and writes the
 * spec to `apps/docs/src/generated/openapi.json`. The docs' schema-driven
 * allowlist, multi-language snippet engine, OpenAPI honesty gate, and glossary
 * generator all read that JSON — no router import, no side effects on the docs build.
 *
 * Run: `pnpm --filter @nombaone/api gen:openapi`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildOpenApiDocument } from '../src/shared/openapi/build';
import { v1Router } from '../src/apps/main/server/routes';

const doc = buildOpenApiDocument(v1Router);
const paths = (doc as { paths?: Record<string, unknown> }).paths ?? {};

const out = join(__dirname, '../../docs/src/generated/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`[gen:openapi] wrote ${out} — ${Object.keys(paths).length} paths`);
process.exit(0);
