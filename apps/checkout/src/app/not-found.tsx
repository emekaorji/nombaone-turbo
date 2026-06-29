import { SearchX } from 'lucide-react';

import { Card, CardContent } from '@nombaone/ui/components/ui/card';

/**
 * Global not-found — shown when a payment reference resolves to nothing
 * (`notFound()` from the checkout route) or for any unknown path. A clean,
 * branded terminal state; the checkout is keyed by reference, so there's no
 * "browse" affordance to offer.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <SearchX className="size-6 text-muted-foreground" />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-foreground">Payment not found</h1>
              <p className="text-sm text-muted-foreground">
                This payment link is invalid or has been removed. Check the link from the merchant
                and try again.
              </p>
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Secured by Nombaone</p>
      </div>
    </main>
  );
}
