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

import { BrandMark } from "./brand-mark";
import { SidebarNav } from "./sidebar-nav";

/**
 * Mobile sidebar drawer: the hamburger trigger (shown < lg) opens an
 * off-canvas `Sheet` holding the same manifest nav, which closes itself on
 * navigation.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className="grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu size={18} />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto p-0">
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="sr-only">Documentation navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Browse the Nombaone documentation.
          </SheetDescription>
          <BrandMark />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
