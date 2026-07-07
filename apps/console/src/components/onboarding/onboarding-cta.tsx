'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { dismissOnboardingAction, startOnboardingAction } from '@/lib/onboarding-actions';

/**
 * Clicking a step CTA is the merchant committing to onboarding — pin the start
 * (so the companion rail follows them) BEFORE navigating into the step's page.
 */
export function StartStepCTA({ href, label, className }: { href: string; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await startOnboardingAction();
          router.push(href);
        })
      }
      className={className}
    >
      {label}
    </button>
  );
}

/** Skip — mark onboarding dismissed so the rail never shows, then enter the app. */
export function SkipOnboarding({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await dismissOnboardingAction();
          router.push('/');
        })
      }
      className={className}
    >
      {children}
    </button>
  );
}
