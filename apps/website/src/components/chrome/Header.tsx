"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./Logo";

const DOCS_URL = "https://docs.nombaone.xyz";
const APP_URL = "https://app.nombaone.xyz";

type NavItem = {
  label: string;
  href: string;
  rainbow?: boolean;
  external?: boolean;
};

// Order + labels are 1:1 with the .pen Header (HBqRX Nav).
const NAV: NavItem[] = [
  { label: "Product", href: "/product" },
  { label: "Integrations", href: "/integrations", rainbow: true },
  { label: "Use cases", href: "/use-cases" },
  { label: "Docs", href: DOCS_URL, external: true },
  { label: "Pricing", href: "/pricing" },
];

// Mobile sheet also surfaces the secondary destinations.
const MOBILE_EXTRA: NavItem[] = [
  { label: "Trust", href: "/trust" },
  { label: "Guides", href: "/guides" },
  { label: "Changelog", href: "/changelog" },
  { label: "The Hall", href: "/hall" },
];

/**
 * Rainbow gradient clipped to text (Integrations). Full spectrum spread across
 * the word, matching the static .pen fill (ff6b6b/ffd93d/0bdfa3/4dabf7/b197fc).
 */
function RainbowText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[linear-gradient(90deg,#ff6b6b_0%,#ffd93d_28%,#0bdfa3_55%,#4dabf7_80%,#b197fc_100%)] bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center rounded-full border border-border bg-surface-1 px-[9px] py-2 text-muted-foreground transition-colors hover:text-foreground"
    >
      {isDark ? <Moon className="size-[15px]" /> : <Sun className="size-[15px]" />}
    </button>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const label = item.external ? `${item.label} ↗` : item.label;
  const className = cn(
    "rounded-md px-2.5 py-1.5 text-sm transition-colors hover:text-foreground",
    item.rainbow ? "font-semibold" : "font-normal",
    active ? "text-foreground" : "text-muted-foreground"
  );
  const content = item.rainbow ? <RainbowText>{label}</RainbowText> : label;

  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: NavItem) =>
    !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-3 md:px-[60px] md:py-[14px]">
        {/* Left: logo + nav (gap 28) */}
        <div className="flex items-center gap-7">
          <Link href="/" aria-label="Nomba One home" className="shrink-0">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.label} item={item} active={isActive(item)} />
            ))}
          </nav>
        </div>

        {/* Right: theme toggle + log in + start building (gap 10) */}
        <div className="hidden items-center gap-2.5 md:flex">
          <ThemeToggle />
          <a
            href={APP_URL}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Log in
          </a>
          <a
            href={APP_URL}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Start building
          </a>
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-md text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88%] max-w-sm border-border bg-background">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="mt-8 flex flex-col gap-1">
              {[...NAV, ...MOBILE_EXTRA].map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-base text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label} {"↗"}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-base transition-colors",
                      isActive(item)
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
              <a
                href={APP_URL}
                className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground"
              >
                Start building
              </a>
              <a
                href={APP_URL}
                className="rounded-lg border border-border px-4 py-3 text-center text-sm font-medium text-foreground"
              >
                Log in
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
