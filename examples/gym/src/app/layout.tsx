import Link from 'next/link';

import { Geist, Geist_Mono } from 'next/font/google';

import type { Metadata } from 'next';

import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Iron Republic — powered by NombaOne',
  description:
    'The NombaOne reference merchant: a gym whose memberships are billed by the engine through the public SDK.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-coal font-sans text-chalk antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-bold tracking-[0.3em] uppercase">
              Iron<span className="text-ember">·</span>Republic
            </Link>
            <nav className="flex items-center gap-6 text-xs text-fog">
              <Link href="/" className="transition-colors hover:text-chalk">
                Memberships
              </Link>
              <Link href="/events" className="transition-colors hover:text-chalk">
                Events
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-dim">
            Reference merchant for the NombaOne billing engine — every read and write on this site goes
            through the public <span className="font-mono">@nombaone/node</span> SDK.
          </div>
        </footer>
      </body>
    </html>
  );
}
