import { RootShell } from "@/components/chrome/root-shell";
import NotFound from "./(en)/not-found";

import type { Metadata } from "next";

/**
 * The 404 document.
 *
 * With three root layouts — `(en)`, `(yo)`, `(ha)` — an unmatched URL belongs to
 * no route group, so Next cannot pick a layout to wrap it in and needs a page
 * that renders its own `<html>`. That is what this is. It requires
 * `experimental.globalNotFound` (see `next.config.ts`); without the flag Next
 * silently ignores this file and falls back to its built-in bare 404.
 *
 * It renders in English on purpose: a reader who has landed on a URL we do not
 * recognise has given us no reliable signal about what language they read, and
 * English is the authoritative language of these docs.
 */
export const metadata: Metadata = {
  // Its own root, so it inherits no `metadataBase` from any layout.
  metadataBase: new URL("https://docs.nombaone.xyz"),
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <RootShell locale="en">
      <NotFound />
    </RootShell>
  );
}
