import { Geist, Geist_Mono } from 'next/font/google';

import { SearchProvider } from '@/components/chrome/search-provider';
import { SidebarNav } from '@/components/chrome/sidebar-nav';
import { ThemeProvider } from '@/components/chrome/theme-provider';
import { Topbar } from '@/components/chrome/topbar';

import './globals.css';

import type { Metadata, Viewport } from 'next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.nombaone.xyz'),
  title: {
    default: 'Nombaone Infra: Developer Docs',
    template: '%s - Nombaone Docs',
  },
  description:
    'Build money movement on Nombaone Infra: wallets, a double-entry ledger, and Nigerian rails. The developer documentation for the Nombaone public API.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121518' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <SearchProvider>
            <Topbar />
            <div className="mx-auto flex w-full max-w-[100rem]">
              {/* Desktop sidebar rail, sticky under the topbar. */}
              <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border lg:block">
                <SidebarNav />
              </aside>
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
