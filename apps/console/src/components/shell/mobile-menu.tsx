'use client';

import { Ellipsis, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Sidebar, type ShellOrg, type ShellUser } from './sidebar';

/** Mobile nav drawer — reuses the designed Sidebar as a slide-over. Triggered from the topbar (icon) and bottom nav (tab).
 *  Closes on overlay tap, the X button, or any tap inside (a nav-link tap navigates and dismisses). */
export function MobileMenu({ variant, user, org }: { variant: 'icon' | 'tab'; user: ShellUser; org: ShellOrg }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-1 flex size-8 items-center justify-center text-foreground"
        >
          <Menu className="size-[22px]" strokeWidth={1.75} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-[3px] py-1.5 text-muted-foreground"
        >
          <Ellipsis className="size-5" strokeWidth={1.75} />
          <span className="text-[10px]">More</span>
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute left-0 top-0 h-full w-[264px] shadow-[8px_0_32px_rgba(0,0,0,0.5)]">
            {/* Any tap inside (nav link, etc.) also dismisses the drawer. */}
            <div className="h-full" onClick={() => setOpen(false)}>
              <Sidebar user={user} org={org} />
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
