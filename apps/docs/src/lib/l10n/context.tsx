"use client";

import { createContext, useContext, useMemo } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { href as buildHref } from "./href";
import { DICTS, format, type Dict, type DictKey } from "./t";

/**
 * Locale for the client islands (search palette, Ask-AI, copy-page, feedback,
 * theme toggle, nav) — the parts of the chrome that cannot read a server prop.
 *
 * The default value is the ENGLISH dictionary, not an empty one. That is the
 * decision that makes this extraction risk-free: an island that renders outside
 * the provider (in a test, in a story, in a stray `_not-found`) shows exactly
 * what it shows today rather than blank labels.
 */

interface L10nValue {
  locale: Locale;
  dict: Dict;
  /** Slugs actually translated in this locale, read off disk by the shell. */
  coverage: readonly string[];
}

const L10nContext = createContext<L10nValue>({
  locale: DEFAULT_LOCALE,
  dict: DICTS[DEFAULT_LOCALE],
  coverage: [],
});

export function L10nProvider({
  locale,
  coverage,
  children,
}: {
  locale: Locale;
  coverage: readonly string[];
  children: React.ReactNode;
}) {
  const value = useMemo<L10nValue>(
    () => ({ locale, dict: DICTS[locale], coverage }),
    [locale, coverage],
  );
  return <L10nContext.Provider value={value}>{children}</L10nContext.Provider>;
}

export function useL10n() {
  const { locale, dict, coverage } = useContext(L10nContext);
  return {
    locale,
    t: (key: DictKey, vars?: Record<string, string | number>) =>
      format(dict[key] ?? DICTS.en[key], vars),
    /** Locale-correct href for an internal slug. English is the identity case. */
    href: (slug: string) => buildHref(slug, locale, coverage),
  };
}
