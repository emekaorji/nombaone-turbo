"use client";

import { useState } from "react";

import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@nombaone/ui/components/ui/sheet";

import { useL10n } from "@/lib/l10n/context";

import { BrandMark } from "./brand-mark";
import { SidebarNav } from "./sidebar-nav";
import { TopNav } from "./top-nav";

/**
 * Mobile sidebar drawer: the hamburger trigger (shown < lg) opens an
 * off-canvas `Sheet` holding the same manifest nav, which closes itself on
 * navigation.
 */
export function MobileNav() {
  const { t } = useL10n();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("nav.openNavigation")}
        className="grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu size={18} />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="sr-only">{t("nav.documentationNav")}</SheetTitle>
          <SheetDescription className="sr-only">{t("nav.browseDocs")}</SheetDescription>
          <BrandMark />
        </div>
        <div className="border-b border-border px-3 py-3">
          <TopNav variant="dropdown" onNavigate={() => setOpen(false)} />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
