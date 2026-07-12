import { DEFAULT_LOCALE, type Locale } from "./config";
import { en, type Dict, type DictKey } from "./dict/en";
import { ha } from "./dict/ha";
import { yo } from "./dict/yo";

export type { Dict, DictKey };

export const DICTS: Record<Locale, Dict> = { en, yo, ha };

/**
 * `{name}` substitution. This is the ENTIRE formatting surface, and that is a
 * deliberate call, not an oversight: the only ICU-plural in the codebase is
 * `operation{n === 1 ? "" : "s"}` in `reference-article.tsx`, and the reference
 * is English-only. Nothing here needs plural rules, gender, or dates — so we do
 * not ship an i18n runtime to provide them.
 */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Translate a key. No hook, no context — so the same function serves server
 * components (which pass `locale` down) and the client `useL10n()` alike.
 *
 * A key absent from a locale falls back to English rather than rendering blank.
 * In practice that never fires: `Dict` is derived from the English dictionary,
 * so a missing key fails `tsc` long before it can reach a page.
 */
export function t(
  key: DictKey,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[locale] ?? en;
  return format(dict[key] ?? en[key], vars);
}
