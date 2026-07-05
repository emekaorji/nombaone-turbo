#!/usr/bin/env node
/**
 * Package-boundary gate: a package under `packages/**` must NEVER import from an
 * app. Packages are the shared foundation (sara = reusable infra, core-db, errors,
 * utils, …); apps depend on packages, never the reverse. This forbids the exact
 * regression this refactor removed — domain/app code leaking back into a package.
 *
 * Fails (exit 1) if any `packages/<pkg>/src/**` file imports:
 *   • a workspace APP package (`@nombaone/api|console|admin|checkout|website|docs`)
 *   • an app path alias (`@/`, `@shared/`, `@modules/`)
 *   • a relative path that climbs into `apps/`
 *
 * Run: `node toolings/check-package-boundaries.mjs` (wired as `pnpm check:boundaries`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PACKAGES = join(ROOT, 'packages');
const APP_PKGS = ['api', 'console', 'admin', 'checkout', 'website', 'docs'];

const FORBIDDEN = [
  { re: new RegExp(`from ['"]@nombaone/(${APP_PKGS.join('|')})(/|['"])`), why: 'imports an app package' },
  { re: /from ['"]@(\/|shared\/|modules\/)/, why: 'uses an app-only path alias (@/, @shared/, @modules/)' },
  { re: /from ['"](\.\.\/)+apps\//, why: 'climbs into apps/ via a relative path' },
];

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
};

const violations = [];
for (const pkg of readdirSync(PACKAGES)) {
  const src = join(PACKAGES, pkg, 'src');
  try {
    statSync(src);
  } catch {
    continue;
  }
  for (const file of walk(src)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { re, why } of FORBIDDEN) {
        if (re.test(line)) {
          violations.push(`${file.replace(ROOT + '/', '')}:${i + 1} — ${why}\n    ${line.trim()}`);
        }
      }
    });
  }
}

if (violations.length) {
  console.error(`✗ package-boundary violations (${violations.length}): a package must not import from an app.\n`);
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('✓ package boundaries clean — no package imports from an app.');
