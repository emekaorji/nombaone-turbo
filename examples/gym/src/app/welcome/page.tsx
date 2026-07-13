import Link from 'next/link';

import { lookupMember } from '@/lib/actions';

/**
 * Post-checkout landing — where the hosted checkout returns members
 * (`callbackUrl`). Honest by design: the redirect back is NOT proof of
 * payment; activation happens when the engine confirms the money, and the
 * membership flips to `active` on its own.
 */
export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-20">
      <section className="py-16">
        <p className="text-xs font-semibold tracking-[0.35em] text-mint uppercase">
          Welcome to the Republic
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight">
          Payment received — or still settling.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-fog">
          Your membership activates automatically the moment the engine confirms your payment.
          Cards confirm in seconds; bank transfers activate when the transfer settles. Nothing else
          to do — check your membership below.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">Check your membership</h2>
        <form action={lookupMember} className="mt-4 flex max-w-md gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="the email you joined with"
            className="flex-1 rounded-md border border-line bg-panel-2 px-3 py-2 text-sm placeholder:text-dim focus:border-ember focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-coal transition-opacity hover:opacity-90"
          >
            View
          </button>
        </form>
        <p className="mt-4 text-xs text-dim">
          Or head <Link href="/" className="text-fog underline underline-offset-2 hover:text-chalk">back to memberships</Link>.
        </p>
      </section>
    </main>
  );
}
