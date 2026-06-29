import { ArrowUpRight } from "lucide-react";

import { BrandMark } from "./brand-mark";
import { EnvPill } from "./env-pill";
import { MobileNav } from "./mobile-nav";
import { SearchTrigger } from "./search-trigger";
import { ThemeToggle } from "./theme-toggle";

/**
 * Docs topbar: slim, sticky, blurred. Left: mobile nav trigger + Nombaone mark +
 * DOCS chip. Center/right: ⌘K search, env pill, theme toggle, and quick links
 * (Console, API status). Mirrors admin's chrome density without copying its nav.
 */

const QUICK_LINKS = [
  { label: "Console", href: "https://console.nombaone.xyz" },
  { label: "API status", href: "https://status.nombaone.xyz" },
];

export function Topbar() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <MobileNav />
        <BrandMark />

        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <nav aria-label="External" className="hidden items-center gap-1 md:flex">
            {QUICK_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
                <ArrowUpRight size={13} aria-hidden className="opacity-60" />
              </a>
            ))}
          </nav>
          <SearchTrigger />
          <EnvPill />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
