'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';

import { allNavItems } from '@/lib/nav';
import { searchConsole, type SearchHit } from '@/lib/topbar-actions';

const NAV = allNavItems();
const KIND_LABEL: Record<SearchHit['kind'], string> = { customer: 'Customer', plan: 'Plan', subscription: 'Subscription' };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHits([]);
  }, []);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced entity search — all setState runs async inside the timeout.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setHits([]);
        return;
      }
      start(async () => {
        const r = await searchConsole(q);
        setHits(r);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const navMatches = query.trim()
    ? NAV.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase()))
    : NAV;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-[7px] transition-colors hover:border-border-strong"
      >
        <Search className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
        <span className="text-[13px] text-muted-foreground">Search</span>
        <kbd className="rounded-sm bg-surface-3 px-[5px] py-px font-mono text-[11px] text-subtle-foreground">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search className="size-[16px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers, plans, subscriptions… or jump to a page"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle-foreground"
              />
              {pending ? <span className="text-[11px] text-subtle-foreground">…</span> : null}
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-1.5">
              {hits.length > 0 ? (
                <div className="flex flex-col">
                  <span className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">RESULTS</span>
                  {hits.map((h) => (
                    <button
                      key={h.href}
                      type="button"
                      onClick={() => go(h.href)}
                      className="flex items-center justify-between gap-3 rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] text-foreground">{h.label}</span>
                        <span className="truncate font-mono text-[11px] text-subtle-foreground">{h.sublabel}</span>
                      </div>
                      <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                        {KIND_LABEL[h.kind]}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col">
                <span className="px-2.5 py-1.5 font-mono text-[10px] tracking-[0.4px] text-subtle-foreground">JUMP TO</span>
                {navMatches.length === 0 ? (
                  <span className="px-2.5 py-2 text-[12.5px] text-muted-foreground">No pages match.</span>
                ) : (
                  navMatches.map((n) => {
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.href}
                        type="button"
                        onClick={() => go(n.href)}
                        className="flex items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <Icon className="size-[15px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <span className="flex-1 text-[13px] text-foreground">{n.label}</span>
                        <CornerDownLeft className="size-3.5 text-subtle-foreground opacity-0 group-hover:opacity-100" strokeWidth={1.75} />
                      </button>
                    );
                  })
                )}
              </div>

              {query.trim().length >= 2 && hits.length === 0 && !pending ? (
                <span className="block px-2.5 py-2 text-[12px] text-subtle-foreground">
                  No customers, plans, or subscriptions match “{query.trim()}”.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
