import Link from "next/link";

/**
 * 404: branded, on-voice ("you found the edge of the map"). Sits inside the
 * docs shell (topbar + sidebar from the root layout).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm font-medium text-accent">404</p>
      <h1 className="mt-3 text-2xl font-bold text-foreground">You found the edge of the map.</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        This page does not exist (yet). It may have moved, or you may have followed a stale link.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to the docs
        </Link>
        <Link
          href="/getting-started/quickstart"
          className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Start with the quickstart
        </Link>
      </div>
      <p className="mt-4 text-xs text-subtle-foreground">
        or press{" "}
        <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          ⌘K
        </kbd>{" "}
        to search these docs
      </p>
    </div>
  );
}
