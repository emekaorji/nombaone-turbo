"use client";

import { Check, Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nombaone/ui/components/ui/dropdown-menu";

import { cn } from "@/lib/cn";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  isNeverTranslated,
  stripLocale,
  withLocale,
} from "@/lib/l10n/config";
import { useL10n } from "@/lib/l10n/context";

/**
 * The language switcher.
 *
 * It hides itself on pages that are frozen in English (the API reference, the
 * SDKs, the error registry). Offering "read this in Yorùbá" on a page that can
 * only ever 308 you back to English is a promise the site cannot keep, and the
 * reader pays for it with a pointless round trip.
 *
 * It also greys out — rather than hides — a locale that simply has not
 * translated THIS page yet, and links it to English. That is honest: the
 * language exists, this page just isn't in it.
 */
export function LocaleSwitcher() {
  const pathname = usePathname();
  const { t, locale: current } = useL10n();
  const { slug } = stripLocale(pathname ?? "/");

  if (isNeverTranslated(slug)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("locale.switch")}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages size={15} aria-hidden />
        <span className="hidden sm:inline">{LOCALE_NAMES[current]}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((locale) => {
          const isCurrent = locale === current;
          const target = locale === DEFAULT_LOCALE ? (slug === "" ? "/" : slug) : withLocale(slug, locale);
          return (
            <DropdownMenuItem key={locale} asChild>
              <Link
                href={target}
                hrefLang={LOCALE_TAGS[locale]}
                lang={LOCALE_TAGS[locale]}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3",
                  isCurrent && "font-medium text-foreground",
                )}
              >
                {LOCALE_NAMES[locale]}
                {isCurrent && <Check size={14} aria-hidden />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
