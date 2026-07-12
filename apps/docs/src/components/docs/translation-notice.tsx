import Link from "next/link";

import { DEFAULT_LOCALE, type Locale } from "@/lib/l10n/config";
import { t } from "@/lib/l10n/t";

/**
 * The "English is authoritative" notice, shown on every translated page.
 *
 * This is not boilerplate — it is the thing that makes the claim honest. These
 * pages are machine-drafted. The orthography can be checked mechanically and the
 * structure can be checked mechanically, but a WRONG Yorùbá tone mark cannot:
 * `ọkọ̀` (vehicle), `ọkọ` (husband) and `ọ̀kọ̀` (spear) differ only in tone, so a
 * wrong tone yields a different valid word that every automated check passes.
 *
 * We cannot promise the translation is perfect. We CAN promise the English page
 * is right and put it one click away. So we do that, on every page, in the
 * reader's language.
 */
export function TranslationNotice({ locale, slug }: { locale: Locale; slug: string }) {
  if (locale === DEFAULT_LOCALE) return null;

  const englishHref = slug === "" ? "/" : slug;

  return (
    <aside className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface-1 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
      <span>{t("locale.notice", locale)}</span>
      <Link
        href={englishHref}
        hrefLang="en"
        className="font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("locale.readInEnglish", locale)}
      </Link>
    </aside>
  );
}
