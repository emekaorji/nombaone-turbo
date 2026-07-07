'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, SlidersHorizontal } from 'lucide-react';

import type { SubSortKey } from '@/lib/subscriptions';

/**
 * The list's sort control (the .pen sliders-horizontal affordance). Shows the current
 * sort and opens a menu to change it; each option is a `?sort=` link so the choice is
 * shareable and survives refresh. Default is revenue-at-risk (leaking money first).
 */
export function SubSortControl({
  current,
  sorts,
  segment,
}: {
  current: SubSortKey;
  sorts: { key: SubSortKey; label: string }[];
  segment?: string;
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

  const currentLabel = sorts.find((s) => s.key === current)?.label ?? 'Revenue at risk';
  // Read naturally in "Sorted by …": lowercase phrases, but keep acronyms (MRR) intact.
  const currentPhrase = /^[A-Z]+$/.test(currentLabel) ? currentLabel : currentLabel.toLowerCase();
  const hrefFor = (key: SubSortKey) => {
    const params = new URLSearchParams();
    if (segment && segment !== 'all') params.set('segment', segment);
    if (key !== 'at_risk') params.set('sort', key);
    const qs = params.toString();
    return `/subscriptions${qs ? `?${qs}` : ''}`;
  };

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <span className="text-[12px] text-subtle-foreground">Sorted by {currentPhrase}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change sort"
        className={`flex size-[30px] items-center justify-center rounded border border-border transition-colors ${
          open ? 'bg-surface-2 text-foreground' : 'text-subtle-foreground hover:border-border-strong hover:text-foreground'
        }`}
      >
        <SlidersHorizontal className="size-[15px]" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 flex w-[180px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl">
          <span className="px-3 py-1.5 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">SORT BY</span>
          {sorts.map((s) => (
            <Link
              key={s.key}
              href={hrefFor(s.key)}
              scroll={false}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2"
            >
              {s.label}
              {s.key === current ? <Check className="size-[14px] text-accent" strokeWidth={2.25} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
