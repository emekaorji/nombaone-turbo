import Link from 'next/link';

import { Geist, Geist_Mono } from 'next/font/google';

import { currentMember } from '@/lib/auth';
import { signOutAction } from '@/lib/actions';

import type { Metadata } from 'next';

import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Iron Republic — a strength gym in Lekki',
  description:
    'Barbells, platforms, and coaches who know what they are doing. Memberships from ₦20,000 a month. Cancel any time, from your phone.',
};

/**
 * The shell.
 *
 * Note what is NOT here any more. The old footer told members this was a "reference
 * merchant for the NombaOne billing engine" and named the SDK. A member does not know what
 * an engine is, and telling them is a large part of why the product stopped making sense.
 * This reads like a gym, because it is one.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-coal font-sans text-chalk antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-bold uppercase tracking-[0.3em]">
              Iron<span className="text-ember">·</span>Republic
            </Link>

            <nav className="flex items-center gap-5 text-xs text-fog">
              <Link href="/memberships" className="transition-colors hover:text-chalk">
                Memberships
              </Link>

              {member ? (
                <>
                  <Link
                    href="/account"
                    className="font-medium text-chalk transition-colors hover:text-ember"
                  >
                    My account
                  </Link>
                  <form action={signOutAction}>
                    <button type="submit" className="transition-colors hover:text-chalk">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/signin" className="transition-colors hover:text-chalk">
                    Sign in
                  </Link>
                  <Link
                    href="/memberships"
                    className="rounded bg-ember px-3 py-1.5 text-[11px] font-semibold text-coal transition-opacity hover:opacity-90"
                  >
                    Join
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-dim">
            <span>Iron Republic · Lekki Phase 1, Lagos · Open 5am – 11pm, 7 days</span>
            <span>Cancel any time, from your phone. No sign-up fee.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
