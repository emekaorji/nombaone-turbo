/**
 * A stable, browser-local anonymous id for docs feedback. Persisted in
 * `localStorage` (mirroring the key-storage pattern in `api-explorer.tsx`) so a
 * single visitor's "helpful/not-helpful" clicks can be grouped without any
 * account or tracking cookie.
 *
 * SSR-safe: returns `""` on the server (no `window`), and never throws when
 * storage is unavailable (private mode): the feedback write just sends `null`.
 */

const LS_KEY = "nombaone-docs:anonymous-id";

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(LS_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(LS_KEY, next);
    return next;
  } catch {
    return "";
  }
}
