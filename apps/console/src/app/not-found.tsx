import Link from 'next/link';

import { Button } from '@nombaone/ui/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.6px] text-purple-700">
        404
      </p>
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to overview</Link>
      </Button>
    </main>
  );
}
