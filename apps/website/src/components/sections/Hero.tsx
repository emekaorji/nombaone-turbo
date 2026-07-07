"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Container } from "@/components/layout/Container";

// The rotating audience word (line 2 of the H1). The audiences line at the
// bottom of the hero enumerates this exact set.
const AUDIENCES = ["developer", "founder", "merchant", "team"];

const APP_URL = "https://console.nombaone.xyz";

export function Hero() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIndex((n) => (n + 1) % AUDIENCES.length), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <section id="hero" className="relative overflow-hidden">
      {/* Dark-emerald radial glow — full-bleed, blooming off the left edge of the
          viewport (not boxed by the content column). Dark mode only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(55%_70%_at_26%_32%,#0b3527_0%,transparent_72%)] dark:block"
      />
      <Container className="relative">
        <div className="flex flex-col pb-16 pt-[76px] md:pb-[130px] md:pt-[150px]">
          {/* H1 — two lines: white statement + gradient rotating word */}
          <h1 className="flex flex-col text-[44px] font-semibold leading-[1.05] tracking-[-1.9px] text-foreground md:text-[96px] md:leading-[1.02] md:tracking-[-4.4px]">
            <span>Subscriptions for every</span>
            <span className="relative inline-block">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={AUDIENCES[index]}
                  initial={reduce ? false : { y: "0.4em", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: "-0.4em", opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block bg-[linear-gradient(120deg,#7deabd_0%,#0bdfa3_50%,#00c38b_100%)] bg-clip-text pr-[0.08em] text-transparent"
                >
                  {AUDIENCES[index]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>

          {/* Sub — 18px mobile / 27px desktop, muted, max 720 */}
          <p className="mt-[22px] max-w-[720px] text-lg leading-[1.5] text-muted-foreground md:mt-[34px] md:text-[27px]">
            One managed subscriptions layer over every rail. Dunning that recovers, reconciliation that
            settles itself, and a ledger that never loses a kobo. Ship recurring revenue instead of
            rebuilding billing.
          </p>

          {/* CTAs — full-width stacked on mobile; padding [15,30], radius 10 */}
          <div className="mt-[30px] flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center md:mt-[44px] md:gap-[14px]">
            <a
              href={APP_URL}
              className="w-full rounded-[10px] bg-accent px-[30px] py-[14px] text-center text-[16px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover sm:w-auto md:py-[15px] md:text-[16.5px]"
            >
              Start building
            </a>
            <Link
              href="/guides"
              className="w-full rounded-[10px] border border-border-strong bg-surface-2 px-[30px] py-[14px] text-center text-[16px] font-medium text-foreground transition-colors hover:bg-surface-3 sm:w-auto md:py-[15px] md:text-[16.5px]"
            >
              Read the docs
            </Link>
          </div>

          {/* Audiences — 15px mobile / 18px desktop, subtle, max 640 */}
          <p className="mt-[20px] max-w-[640px] text-[15px] leading-[1.5] text-subtle-foreground md:mt-[26px] md:text-lg">
            For the developers, founders, merchants, and teams switching off billing they never wanted
            to maintain.
          </p>
        </div>
      </Container>
    </section>
  );
}
