import { ArrowUpRight } from "lucide-react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/l10n/config";
import { t, type DictKey } from "@/lib/l10n/t";

import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { TopNav } from "./top-nav";

/**
 * Docs topbar: slim, sticky, blurred. Left: mobile nav trigger + Nombaone mark +
 * DOCS chip. Center: the primary nav links + Resources dropdown (desktop).
 * Right: quick links (Console, API status) and the theme toggle. Search lives at
 * the top of the sidebar. Mirrors admin's chrome density without copying its nav.
 */

// `Console` is the product's name, not an English word — it stays English in
// every locale (see the do-not-translate policy in `dict/en.ts`).
const QUICK_LINKS: { labelKey: DictKey; href: string }[] = [
  { labelKey: "nav.console", href: "https://console.nombaone.xyz" },
  { labelKey: "nav.apiStatus", href: "https://status.nombaone.xyz" },
];

export function Topbar({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="relative flex h-14 items-center gap-3 px-4 lg:px-6">
        <MobileNav />
        <BrandMark />

        {/* True-centered primary nav, independent of the side groups' widths (desktop only). */}
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex">
          <div className="pointer-events-auto">
            <TopNav />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <nav aria-label={t("nav.external", locale)} className="hidden items-center gap-1 md:flex">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(link.labelKey, locale)}
                <ArrowUpRight size={13} aria-hidden className="opacity-60" />
              </a>
            ))}
          </nav>
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
