'use client';

import { useEffect } from 'react';

import { Button } from '@nombaone/ui/components/ui/button';

/**
 * Root error boundary. Catches any uncaught render/server error in the tree and
 * offers a retry (`reset`). Server errors are already logged server-side; here we
 * log the digest so a client-side failure is traceable too.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[console] render error', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. You can try again; if it keeps happening, please contact
        support.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
