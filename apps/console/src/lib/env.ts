import { z } from 'zod';

/**
 * Server-side environment, validated once at module load. Importing this from a
 * server module (`server-only` callers — db, session, actions) guarantees the
 * required secrets are present and well-formed before any request is served;
 * a missing/blank var fails fast at boot instead of mid-request.
 *
 * NEVER import this from a client component — it reads server-only secrets.
 * Client-safe runtime indicators live in the `NEXT_PUBLIC_NOMBAONE_ENV` helpers
 * below (those read a build-inlined public var and are safe everywhere).
 */
const serverEnvSchema = z.object({
  /** Postgres (Neon) connection string. Shared with apps/api. */
  INFRA_DATABASE_URL: z.string().min(1, 'INFRA_DATABASE_URL is required'),
  /** AES key for PII at rest. MUST equal apps/api's key. */
  INFRA_PII_ENCRYPTION_KEY: z.string().min(1, 'INFRA_PII_ENCRYPTION_KEY is required'),
  /** Secret for signing the console's CSRF / cookie state. */
  CONSOLE_SESSION_COOKIE_SECRET: z
    .string()
    .min(16, 'CONSOLE_SESSION_COOKIE_SECRET must be at least 16 characters'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Parse + cache the server env. Lazily evaluated so a build that never touches
 * a server module (e.g. pure client bundle analysis) doesn't trip the guard.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    INFRA_DATABASE_URL: process.env.INFRA_DATABASE_URL,
    INFRA_PII_ENCRYPTION_KEY: process.env.INFRA_PII_ENCRYPTION_KEY,
    CONSOLE_SESSION_COOKIE_SECRET: process.env.CONSOLE_SESSION_COOKIE_SECRET,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid server mode:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    );
  }
  cached = parsed.data;
  return cached;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Runtime ring indicator for the topbar pill (client-safe).
 * Set NEXT_PUBLIC_NOMBAONE_ENV to one of: `local | preview | production`.
 * Anything other than `production` lights up the warning pill.
 * ──────────────────────────────────────────────────────────────────────────── */

export type NombaoneEnv = 'local' | 'preview' | 'production';

const FALLBACK: NombaoneEnv = 'local';

function read(): NombaoneEnv {
  const raw = process.env.NEXT_PUBLIC_NOMBAONE_ENV;
  if (raw === 'production' || raw === 'preview' || raw === 'local') return raw;
  return FALLBACK;
}

export function getEnv(): NombaoneEnv {
  return read();
}

export function isProduction(): boolean {
  return read() === 'production';
}

/** Label shown on the topbar deployment-ring pill — null in production. */
export function envBadgeLabel(): 'Preview' | 'Local' | null {
  const env = read();
  if (env === 'production') return null;
  if (env === 'preview') return 'Preview';
  return 'Local';
}
