/**
 * Side-effecting env loader for the admin local seed. Imported FIRST (before any
 * `@nombaone/*` import) so `process.env.INFRA_DATABASE_URL` / `INFRA_PII_ENCRYPTION_KEY`
 * / `DATABASE_URL` are populated before `@nombaone/core-db/pool` evaluates its
 * top-level pool singleton (which reads those eagerly).
 *
 * Loads `apps/admin/.env` then `apps/admin/.env.local`, with `.env.local`
 * OVERRIDING `.env` — mirroring Next.js' own precedence so the seed sees the
 * same LOCAL throwaway-Postgres URLs the running app does. Static imports run in
 * source order, and this module is imported before `@nombaone/core-db/*` in the
 * seed, so the singletons see the right URLs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function applyEnvFile(path: string, override: boolean): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // file is optional
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || !(key in process.env)) process.env[key] = value;
  }
}

const adminDir = join(__dirname, '..');
applyEnvFile(join(adminDir, '.env'), false);
applyEnvFile(join(adminDir, '.env.local'), true);
