/**
 * Canonical reference form: lowercase, `[a-z0-9]` only, no separators.
 *
 * This is the generic normalizer used at any wire boundary (e.g. a value echoed
 * back by an upstream provider, or pasted by a user). The actual minting of a
 * reference — `<prefix><N digits><domain>` — lives in the domain package
 * (`@nombaone/sara/reference`) where the prefix/domains are defined.
 */
export function toCanonicalReference(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}
