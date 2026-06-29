'use client';

import { useEffect } from 'react';

import { Button } from '@nombaone/ui/components/ui/button';

import { Section } from '@/components/common/Section';

/**
 * (app) error boundary — keeps the chrome (sidebar/topbar) intact and renders a
 * recoverable panel in the content column when a screen's RSC throws.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[console:(app)] render error', error);
  }, [error]);

  return (
    <Section title="Something went wrong">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this page. This may be a temporary issue — try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </Section>
  );
}
