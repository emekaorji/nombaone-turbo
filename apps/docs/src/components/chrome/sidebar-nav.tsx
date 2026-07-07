"use client";

import { useState } from "react";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getApiResources } from "@/lib/api-ref/model";
import { cn } from "@/lib/cn";

import { MethodChip } from "./method-chip";
import { SearchTrigger } from "./search-trigger";

import {
  DOCS_SECTIONS,
  findSection,
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
  // Each top-nav destination powers its own sidebar, resolved from the section
  // the current page belongs to: the flattened API reference for the API
  // section, a single-section tree for every `standalone` section (AI, Best
  // practices, CLI/SDKs, Release notes), and the shared prose tree otherwise.
  const pathname = usePathname() ?? "";
  // The whole `/reference/*` tree (index, resources, operations) is the API
  // reference, generated from the OpenAPI model; every other path resolves to
  // its manifest section.
  const isApi = pathname.startsWith("/reference");
  const section = findSection(pathname);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-background px-3 pb-2 pt-4">
        <SearchTrigger />
      </div>
      {isApi ? (
        <ApiNav onNavigate={onNavigate} />
      ) : section?.standalone ? (
        <SectionsNav label={section.title} sections={[section]} onNavigate={onNavigate} />
      ) : (
        <SectionsNav label="Documentation" sections={DOCS_SECTIONS} onNavigate={onNavigate} />
      )}
    </div>
  );
}

/** A grouped sidebar view (Docs, AI): each section a collapsible group. */
function SectionsNav({
  label,
  sections,
  onNavigate,
}: {
  label: string;
  sections: ManifestSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-6 px-3 py-6">
      {sections.map((section) => (
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
              {item.children && item.children.length > 0 && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                  {item.children.map((child) => (
                    <li key={child.slug}>
                      <NavLink item={child} dense onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The "API Reference" view, generated from the OpenAPI model: an Overview row
 * and the Glossary, then every resource as a top-level GROUP HEADER (its name is
 * the label) with a page per operation one level beneath it. Each resource has
 * its own overview and each request its own page — nothing packed together.
 */
function ApiNav({ onNavigate }: { onNavigate?: () => void }) {
  const resources = getApiResources();
  return (
    <nav aria-label="API reference" className="flex flex-col gap-5 px-3 py-6">
      <ul className="space-y-px">
        <li>
          <NavLink item={{ slug: "/reference", title: "Overview" }} dense onNavigate={onNavigate} />
        </li>
        <li>
          <NavLink item={{ slug: "/reference/glossary", title: "Glossary" }} dense onNavigate={onNavigate} />
        </li>
      </ul>
      {resources.map((r) => (
        <ApiGroup
          key={r.slug}
          resource={{
            slug: `/reference/${r.slug}`,
            title: r.title,
            children: r.operations.map((op) => ({
              slug: `/reference/${r.slug}/${op.slug}`,
              title: op.title,
              method: op.method.toUpperCase() as ManifestItem["method"],
            })),
          }}
          onNavigate={onNavigate}
        />
      ))}
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
        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground transition-colors hover:text-foreground"
      >
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
