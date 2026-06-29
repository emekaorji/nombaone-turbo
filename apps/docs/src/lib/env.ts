/**
 * Deployment-ring helpers (mirrors the console's `EnvPill` semantics). Drives
 * the topbar env pill: a small label on local/preview, hidden in production.
 */

type Env = "local" | "preview" | "production";

function currentEnv(): Env {
  const raw = process.env.NEXT_PUBLIC_NOMBAONE_ENV;
  if (raw === "preview" || raw === "production") return raw;
  return "local";
}

/** Label for the env pill, or `null` to hide it (production). */
export function envBadgeLabel(): string | null {
  switch (currentEnv()) {
    case "preview":
      return "Preview";
    case "local":
      return "Local";
    default:
      return null;
  }
}
