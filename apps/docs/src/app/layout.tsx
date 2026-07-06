import { Geist, Martian_Mono } from 'next/font/google';

import { SearchProvider } from '@/components/chrome/search-provider';
import { SidebarNav } from '@/components/chrome/sidebar-nav';
import { ThemeProvider } from '@/components/chrome/theme-provider';
import { AskAI } from '@/components/chrome/ask-ai';
import { Topbar } from '@/components/chrome/topbar';
import { JsonLd } from '@/components/json-ld';

import './globals.css';

import type { Metadata, Viewport } from 'next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Code-face trial #2: Martian Mono (Google Fonts, variable).
// Swap this block per round; `--font-mono-loaded` is the stable hook in globals.css.
const mono = Martian_Mono({
  variable: '--font-mono-loaded',
  subsets: ['latin'],
  display: 'swap',
});

const DESCRIPTION =
  'Developer documentation for Nomba One — a subscription-billing engine on Nomba (Nigerian payments): plans, cycles, proration, dunning, and settlement over card, direct debit, bank transfer, and crypto. Integer-kobo money on a double-entry ledger.';

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.nombaone.xyz'),
  title: {
    default: 'Nomba One — Developer Docs',
    template: '%s - Nomba One Docs',
  },
  description: DESCRIPTION,
  applicationName: 'Nomba One Docs',
  keywords: [
    'Nomba One',
    'Nomba API',
    'developer documentation',
    'subscription billing',
    'recurring billing Nigeria',
    'dunning',
    'proration',
    'double-entry ledger',
    'direct debit',
    'bank transfer',
    'webhooks',
    'REST API',
  ],
  authors: [{ name: 'Nomba One' }],
  creator: 'Nomba One',
  publisher: 'Nomba One',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://docs.nombaone.xyz',
    siteName: 'Nomba One Docs',
    title: 'Nomba One — Developer Docs',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nomba One — Developer Docs',
    description: DESCRIPTION,
    creator: '@nomba',
    site: '@nomba',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Nomba One Docs',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
    { media: '(prefers-color-scheme: dark)', color: '#040404' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${mono.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <JsonLd />
        <a
          href="#content"
          className="sr-only rounded-md focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-md"
        >
          Skip to content
        </a>
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
            <AskAI />
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
