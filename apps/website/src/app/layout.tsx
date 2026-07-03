import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/chrome/ThemeProvider";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { JsonLd } from "@/components/JsonLd";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION =
  "Nomba One is the managed subscriptions layer for Nigeria: one API for recurring billing with dunning that recovers, reconciliation that settles itself, and an integer-kobo ledger — across card, direct debit, bank transfer, and crypto.";

export const metadata: Metadata = {
  metadataBase: new URL("https://nombaone.xyz"),
  title: {
    default: "Nomba One — Recurring billing for Nigeria",
    template: "%s · Nomba One",
  },
  description: DESCRIPTION,
  applicationName: "Nomba One",
  keywords: [
    "recurring billing Nigeria",
    "subscriptions API",
    "dunning",
    "reconciliation",
    "NIBSS direct debit",
    "bank transfer billing",
    "settlement",
    "kobo ledger",
    "Nomba",
    "Nomba One",
    "payments Nigeria",
    "SaaS billing Nigeria",
  ],
  authors: [{ name: "Nomba One" }],
  creator: "Nomba One",
  publisher: "Nomba One",
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://nombaone.xyz",
    siteName: "Nomba One",
    title: "Nomba One — Recurring billing for Nigeria",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nomba One — Recurring billing for Nigeria",
    description: DESCRIPTION,
    creator: "@nomba",
    site: "@nomba",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: "Nomba One",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#040404",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-NG"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <JsonLd />
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
