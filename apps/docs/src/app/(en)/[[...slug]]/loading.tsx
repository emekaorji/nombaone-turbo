import { t } from "@/lib/l10n/t";

/**
 * Route-level loading skeleton for the catch-all docs route. A token-grade
 * skeleton (surface-2 blocks on the reading measure), NOT a spinner — it mirrors
 * the article layout so there is no layout shift when content arrives. Honors
 * `prefers-reduced-motion` via the global media-query gate (animate-pulse is a
 * CSS animation, collapsed by the reduced-motion rule in globals.css).
 *
 * A server component with no props: Next gives a `loading.tsx` nothing to read a
 * locale from. It doesn't need one — this file is the `(en)` route group's
 * skeleton, so its locale is English by construction.
 */
export default function Loading() {
  return (
    <div className="flex w-full">
      <div className="min-w-0 flex-1 px-5 py-8 lg:px-10 xl:px-12">
        <div
          className="mx-auto w-full max-w-(--doc-shell-max) animate-pulse space-y-6"
          aria-hidden
        >
          {/* breadcrumbs */}
          <div className="h-4 w-40 rounded bg-surface-2" />
          {/* title + description */}
          <div className="h-9 w-3/4 rounded-lg bg-surface-2" />
          <div className="h-5 w-1/2 rounded bg-surface-2" />
          {/* body */}
          <div className="space-y-3 pt-4">
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-11/12 rounded bg-surface-2" />
            <div className="h-4 w-4/5 rounded bg-surface-2" />
            <div className="h-40 w-full rounded-lg bg-surface-2" />
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-3/4 rounded bg-surface-2" />
          </div>
        </div>
        <span className="sr-only" role="status">
          {t("chrome.loading", "en")}
        </span>
      </div>
    </div>
  );
}
