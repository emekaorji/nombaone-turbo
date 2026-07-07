'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';

/**
 * The list sort selector (the .pen "Sorted by … ⌄" affordance on Customers/Invoices).
 * A chevron trigger showing the current sort; the menu offers each option as a `?sort=`
 * link so the choice is shareable and survives refresh. `defaultKey` omits the param.
 */
export function ListSortMenu({
  triggerText,
  current,
  options,
  basePath,
  defaultKey,
}: {
  triggerText: string;
  current: string;
  options: { key: string; label: string }[];
  basePath: string;
  defaultKey: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const hrefFor = (key: string) => (key === defaultKey ? basePath : `${basePath}?sort=${key}`);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded px-1.5 py-1 text-[12px] transition-colors ${
          open ? 'text-foreground' : 'text-subtle-foreground hover:text-foreground'
        }`}
      >
        {triggerText}
        <ChevronDown className="size-[14px]" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute right-0 top-8 z-50 flex w-[180px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl">
          <span className="px-3 py-1.5 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">SORT BY</span>
          {options.map((o) => (
            <Link
              key={o.key}
              href={hrefFor(o.key)}
              scroll={false}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2"
            >
              {o.label}
              {o.key === current ? <Check className="size-[14px] text-accent" strokeWidth={2.25} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
