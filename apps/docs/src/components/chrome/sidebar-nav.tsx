"use client";

import { useState } from "react";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { MethodChip } from "./method-chip";
import { SidebarViewToggle, type SidebarView } from "./sidebar-view-toggle";

import {
  API_SECTION,
  DOCS_SECTIONS,
  type Badge,
  type ManifestItem,
  type ManifestSection,
} from "@content/manifest";

/**
 * The left sidebar tree, rendered from the manifest as a two-view switch (like
 * dynamic.xyz): a "Docs" view with the prose sections, and an "API Reference"
 * view with the API section flattened so each resource (Payments, Wallets, …)
 * is a first-class top-level group and its endpoints sit one level beneath it.
 *
 * The active view auto-selects from the path (`/api*` -> API view, else Docs)
 * and the toggle lets the user override it; switching to the API view navigates
 * to `/api` when they're not already on an API page. A left active-rail
 * indicator (the `before:` bar) marks the current page. Shared by the desktop
 * rail and the mobile drawer (`onNavigate` closes the drawer on selection).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  // Path drives the default; an explicit toggle press overrides it until the
  // user navigates somewhere new (we key the override off the resolved view so
  // it never sticks once the path agrees).
  const pathView: SidebarView = pathname?.startsWith("/api") ? "api" : "docs";
  const [override, setOverride] = useState<SidebarView | null>(null);
  const view = override ?? pathView;

  const onToggle = (next: SidebarView) => {
    setOverride(next === pathView ? null : next);
    // Mirror dynamic.xyz: jumping to the API view lands you on the overview if
    // you're not already somewhere under `/api`.
    if (next === "api" && !pathname?.startsWith("/api")) {
      router.push("/api");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-6">
        <SidebarViewToggle view={view} onChange={onToggle} />
      </div>
      {view === "api" ? (
        <ApiNav onNavigate={onNavigate} />
      ) : (
        <DocsNav onNavigate={onNavigate} />
      )}
    </div>
  );
}

/** The "Docs" view: the non-API sections, each a collapsible group. */
function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6 px-3 py-6">
      {DOCS_SECTIONS.map((section) => (
        <DocsSection key={section.key} section={section} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function DocsSection({
  section,
  onNavigate,
}: {
  section: ManifestSection;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{section.title}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {section.items.map((item) => (
            <li key={item.slug}>
              <NavLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The "API Reference" view: the API section flattened. The `Overview` (/api) is
 * a top row; each resource with children becomes a top-level GROUP HEADER (the
 * resource name IS the group label) with its endpoints as rows one level under
 * it; single-page resources (Transfers, Withdrawals, …) render as their own
 * plain rows. No disclosure, no chevron, no extra indentation.
 */
function ApiNav({ onNavigate }: { onNavigate?: () => void }) {
  if (!API_SECTION) return null;

  return (
    <nav aria-label="API reference" className="flex flex-col gap-5 px-3 py-6">
      {API_SECTION.items.map((item) =>
        item.children ? (
          <ApiGroup key={item.slug} resource={item} onNavigate={onNavigate} />
        ) : (
          <ul key={item.slug} className="space-y-px">
            <li>
              <NavLink item={item} dense onNavigate={onNavigate} />
            </li>
          </ul>
        ),
      )}
    </nav>
  );
}

/**
 * A flattened API resource: a group header (the resource title, linking to its
 * overview) with the endpoint rows directly beneath. Styled with the emerald
 * `kind:"api"` treatment so resources read as distinct top-level groups.
 */
function ApiGroup({
  resource,
  onNavigate,
}: {
  resource: ManifestItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, resource.slug);

  return (
    <div>
      <Link
        href={resource.slug}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.6px] transition-colors hover:text-foreground",
          active
            ? "text-accent dark:text-accent"
            : "text-accent dark:text-accent",
        )}
      >
        <span
          aria-hidden
          className="size-1 rounded-full bg-accent dark:bg-accent"
        />
        <span className="truncate">{resource.title}</span>
        {resource.badge && <BadgePill badge={resource.badge} />}
      </Link>
      <ul className="mt-1 space-y-px">
        {resource.children?.map((child) => (
          <li key={child.slug}>
            <NavLink item={child} dense onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A leaf nav row. `dense` tightens vertical rhythm for API rows. */
function NavLink({
  item,
  dense,
  onNavigate,
}: {
  item: ManifestItem;
  dense?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.slug);

  return (
    <Link
      href={item.slug === "" ? "/" : item.slug}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2 rounded-sm pl-3 pr-3 text-sm transition-colors",
        "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:transition-colors",
        dense ? "py-1" : "py-1.5",
        active
          ? "font-semibold text-accent before:bg-accent dark:text-accent"
          : "text-muted-foreground before:bg-transparent hover:text-foreground",
      )}
    >
      {item.method && <MethodChip method={item.method} />}
      <span className="flex-1 truncate">{item.title}</span>
      {item.badge && <BadgePill badge={item.badge} />}
    </Link>
  );
}

function BadgePill({ badge }: { badge: Badge }) {
  const styles: Record<Badge, string> = {
    new: "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent",
    beta: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    updated: "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[badge],
      )}
    >
      {badge}
    </span>
  );
}

/** Shared section-collapse chevron. */
function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={13}
      aria-hidden
      className={cn("transition-transform", open && "rotate-90")}
    />
  );
}

/** Active when the slug matches the current path exactly (home is `/`). */
function isActive(pathname: string | null, slug: string): boolean {
  if (!pathname) return false;
  const target = slug === "" ? "/" : slug;
  return pathname === target;
}
