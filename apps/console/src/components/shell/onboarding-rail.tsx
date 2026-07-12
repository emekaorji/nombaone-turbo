'use client';

import { ArrowRight, Check, Rocket, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { dismissOnboardingAction, refreshOnboardingAction } from '@/lib/onboarding-actions';
import type { OnboardingState, OnboardingStep } from '@/lib/onboarding';

function RailStep({ item }: { item: OnboardingStep }) {
  const done = item.state === 'done';
  const current = item.state === 'current';
  return (
    <div className="flex gap-2.5 py-2">
      {done ? (
        <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent">
          <Check className="size-3 text-accent-foreground" strokeWidth={3} />
        </span>
      ) : (
        <span
          className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
            current ? 'bg-accent-muted text-accent ring-1 ring-inset ring-accent' : 'bg-surface-3 text-subtle-foreground'
          }`}
        >
          {item.n}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-[12.5px] leading-tight ${done ? 'text-muted-foreground line-through' : current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {item.title}
        </span>
        {current && item.cta ? (
          <Link
            href={item.cta.href ?? '/'}
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded bg-accent px-2.5 py-1 text-[11.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            {item.cta.label}
            <ArrowRight className="size-3" strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The onboarding companion rail — the getting-started checklist that follows the
 * merchant into the app once they commit (started, not dismissed). It re-polls its
 * state on navigation, focus, and a slow interval so steps tick off live; when all
 * are done it plays a check animation, then dismisses.
 */
export function OnboardingRail({ initial }: { initial: OnboardingState }) {
  const [state, setState] = useState<OnboardingState>(initial);
  const [adopted, setAdopted] = useState<OnboardingState>(initial);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // A fresh server render of the shell (e.g. a step modal calling router.refresh) passes
  // new state — adopt it so completed steps tick off without a navigation. Done DURING
  // render (React's "adjust state when a prop changes" pattern), not in an effect: an
  // effect that setStates on every new prop cascades an extra render pass.
  if (initial !== adopted) {
    setAdopted(initial);
    setState(initial);
  }

  useEffect(() => {
    let alive = true;
    const refetch = () => {
      void refreshOnboardingAction().then((s) => {
        if (alive && s) setState(s);
      });
    };
    refetch();
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    const id = setInterval(refetch, 20_000);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      clearInterval(id);
    };
  }, [pathname]);

  if (hidden || state.dismissed || !state.showRail) return null;

  const dismiss = () => {
    setHidden(true);
    startTransition(() => {
      void dismissOnboardingAction();
    });
  };

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-surface-1 xl:flex print:!hidden">
      {state.complete ? (
        // ── Completion celebration ──
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <svg viewBox="0 0 52 52" className="size-[72px]" fill="none" aria-hidden="true">
            <circle cx="26" cy="26" r="24" stroke="var(--accent)" strokeWidth="2.5" className="onboarding-check-ring" />
            <path d="M15 27l7.5 7.5L38 19" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="onboarding-check-mark" />
          </svg>
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-semibold text-foreground">You&apos;re all set</span>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Your first subscription is billing in sandbox. Flip to live when you&apos;re ready to charge real money.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-1 rounded bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      ) : (
        // ── Active checklist ──
        <>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Rocket className="size-[15px] text-accent" strokeWidth={1.75} />
              <span className="text-[13px] font-semibold text-foreground">Get started</span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss onboarding"
              title="Dismiss — you can finish setup any time from the sidebar"
              className="text-subtle-foreground transition-colors hover:text-foreground"
            >
              <X className="size-[15px]" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground">
                {state.doneCount} of {state.total} done
              </span>
              <span className="font-mono text-[11px] text-accent">{state.pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${state.pct}%` }} />
            </div>
          </div>

          <div className="flex flex-col px-4 pb-4">
            {state.steps.map((item) => (
              <RailStep key={item.n} item={item} />
            ))}
          </div>

          <div className="mt-auto border-t border-border px-4 py-3">
            <span className="text-[11px] leading-relaxed text-subtle-foreground">
              Billing in sandbox — no real money moves. This panel disappears once you&apos;re set up.
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
