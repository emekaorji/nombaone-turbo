import { Card, CardContent } from '@nombaone/ui/components/ui/card';

/**
 * Root index. The checkout has no browsable surface — it's keyed entirely by a
 * payment reference (`/[reference]`), reached via a merchant-issued link. So the
 * root is just a branded placeholder for anyone who lands here without one.
 */
export default function CheckoutHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <h1 className="text-lg font-semibold text-foreground">Nombaone Checkout</h1>
            <p className="text-sm text-muted-foreground">
              Open the payment link from the merchant to continue.
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Secured by Nombaone</p>
      </div>
    </main>
  );
}
