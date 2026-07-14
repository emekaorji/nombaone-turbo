import { TimerOff } from 'lucide-react';

import { Card, CardContent } from '@nombaone/ui/components/ui/card';

/**
 * Terminal state for an invalid, expired, or tampered action token
 * (`/i/<token>`, `/pm/<token>`). Deliberately generic: the page must not
 * reveal WHY verification failed, nor whether the underlying resource exists —
 * an unverified visitor learns nothing beyond "this link no longer works".
 */
export function LinkExpired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <TimerOff className="size-6 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-foreground">This link has expired</h1>
              <p className="text-sm text-muted-foreground">
                Secure links only work for a limited time. Ask the business that billed you for a
                fresh link, or check your email for a newer one.
              </p>
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Secured by Nombaone</p>
      </div>
    </main>
  );
}
