"use client";

import { ChevronDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nombaone/ui/components/ui/dropdown-menu";

import { cn } from "@/lib/cn";

/**
 * Primary docs nav — plain links (Anthropic-style), replacing the old Docs/API
 * segmented switcher: Docs, the API Reference, the AI/agent guide, and a
 * Resources dropdown. Each primary link powers its own sidebar (see
 * `SidebarNav`). Two render modes: a horizontal `bar` centered in the desktop
 * topbar, and a single `dropdown` for the mobile drawer. `onNavigate` lets the
 * drawer close on selection.
 */

const RESOURCES: { label: string; href: string; external?: boolean }[] = [
  { label: "Best practices", href: "/concepts/hard-parts" },
  { label: "Cookbook", href: "/cookbook" },
  { label: "Pricing", href: "https://nombaone.xyz/pricing", external: true },
  { label: "Quickstart", href: "/getting-started/quickstart" },
  { label: "Release notes", href: "/changelog" },
];

/** Internal Resources destinations, used to light up the Resources trigger. */
const RESOURCE_HREFS = RESOURCES.filter((r) => !r.external).map((r) => r.href);

/** True when the current path is one of the Resources sub-links (or under it). */
function isResourcesActive(p: string): boolean {
  return RESOURCE_HREFS.some((href) => p === href || p.startsWith(`${href}/`));
}

const PRIMARY: { label: string; href: string; isActive: (p: string) => boolean }[] = [
  {
    label: "Docs",
    href: "/",
    // Docs is the catch-all, minus the sections that own a top-nav entry (API,
    // SDKs, AI) or live under the Resources menu — so only one pill is ever active.
    isActive: (p) =>
      !p.startsWith("/reference") &&
      !p.startsWith("/sdks") &&
      !p.startsWith("/agents") &&
      !isResourcesActive(p),
  },
  { label: "API Reference", href: "/reference", isActive: (p) => p.startsWith("/reference") },
  { label: "SDKs", href: "/sdks", isActive: (p) => p.startsWith("/sdks") },
  { label: "AI", href: "/agents", isActive: (p) => p.startsWith("/agents") },
];

function pillClass(active: boolean) {
  return cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

/** A Resources entry as a dropdown row (internal Link or external anchor). */
function ResourceItem({
  item,
  onNavigate,
}: {
  item: (typeof RESOURCES)[number];
  onNavigate?: () => void;
}) {
  return (
    <DropdownMenuItem asChild>
      {item.external ? (
        <a href={item.href} target="_blank" rel="noreferrer" onClick={onNavigate} className="flex items-center gap-1">
          {item.label}
          <ArrowUpRight size={13} aria-hidden className="opacity-45" />
        </a>
      ) : (
        <Link href={item.href} onClick={onNavigate}>
          {item.label}
        </Link>
      )}
    </DropdownMenuItem>
  );
}

export function TopNav({
  onNavigate,
  variant = "bar",
}: {
  onNavigate?: () => void;
  variant?: "bar" | "dropdown";
}) {
  return variant === "dropdown" ? (
    <NavDropdown onNavigate={onNavigate} />
  ) : (
    <NavBar onNavigate={onNavigate} />
  );
}

/** Desktop: horizontal pills + a Resources dropdown. */
function NavBar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-1">
      {PRIMARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={item.isActive(pathname) ? "page" : undefined}
          className={pillClass(item.isActive(pathname))}
        >
          {item.label}
        </Link>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-current={isResourcesActive(pathname) ? "page" : undefined}
          className={cn("group", pillClass(isResourcesActive(pathname)), "inline-flex items-center gap-1 data-[state=open]:text-foreground")}
        >
          Resources
          <ChevronDown size={14} aria-hidden className="opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={8} className="w-56">
          {RESOURCES.map((item) => (
            <ResourceItem key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

/** Mobile: every link collapsed into one dropdown, labelled by the active section. */
function NavDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const current = isResourcesActive(pathname)
    ? "Resources"
    : (PRIMARY.find((item) => item.isActive(pathname))?.label ?? "Docs");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {current}
        <ChevronDown size={15} aria-hidden className="opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-(--radix-dropdown-menu-trigger-width)">
        {PRIMARY.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(item.isActive(pathname) && "font-semibold text-foreground")}
            >
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Resources
        </DropdownMenuLabel>
        {RESOURCES.map((item) => (
          <ResourceItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
