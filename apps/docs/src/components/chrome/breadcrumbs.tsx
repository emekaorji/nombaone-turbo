import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { DEFAULT_LOCALE, withLocale, type Locale } from "@/lib/l10n/config";
import { sectionTitle } from "@/lib/l10n/nav";
import { t } from "@/lib/l10n/t";
import { findSection } from "@content/manifest";

/**
 * Page breadcrumbs: Docs › Section › Page. Server component, derived from the
 * slug + manifest, no client state.
 *
 * All three crumbs move together with the locale. A trail reading
 * "Docs › Guides › Dunning da farfaɗowar biyan kuɗi" — two English crumbs above a
 * Hausa title — is the kind of half-translated seam that makes a localization
 * feel bolted on. The home crumb also links back into the locale, not out of it.
 */
export function Breadcrumbs({
  slug,
  title,
  locale = DEFAULT_LOCALE,
}: {
  slug: string;
  title: string;
  locale?: Locale;
}) {
  const section = findSection(slug);
  const home = withLocale("", locale);

  return (
    <nav aria-label={t("nav.breadcrumb", locale)} className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link href={home} className="transition-colors hover:text-foreground">
            {t("nav.docs", locale)}
          </Link>
        </li>
        {section && (
          <>
            <Separator />
            <li className="text-muted-foreground">
              {sectionTitle(section.key, locale) ?? section.title}
            </li>
          </>
        )}
        {slug !== "" && (
          <>
            <Separator />
            <li className="font-medium text-foreground">{title}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

function Separator() {
  return (
    <li aria-hidden className="text-muted-foreground/40">
      <ChevronRight size={12} />
    </li>
  );
}
