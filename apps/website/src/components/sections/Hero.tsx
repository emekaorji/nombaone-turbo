"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Container } from "@/components/layout/Container";

// The rotating audience word (line 2 of the H1). The audiences line at the
// bottom of the hero enumerates this exact set.
const AUDIENCES = ["developer", "founder", "merchant", "team"];

const APP_URL = "https://app.nombaone.xyz";

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
      {/* Dark-emerald radial glow, confined to the 1080 column, centered at
          (0.35, 0.36) per the .pen (#0b3527 -> #050505). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-[1080px] -translate-x-1/2 bg-[radial-gradient(100%_90%_at_35%_36%,#0b3527_0%,#050505_72%)]"
      />
      <Container className="relative">
        <div className="flex flex-col pb-[130px] pt-[110px] md:pt-[150px]">
          {/* H1 — two lines: white statement + gradient rotating word */}
          <h1 className="flex flex-col text-[52px] font-semibold leading-[1.03] tracking-[-2.4px] text-foreground md:text-[96px] md:leading-[1.02] md:tracking-[-4.4px]">
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

          {/* Sub — 27px, muted, max 720 */}
          <p className="mt-[34px] max-w-[720px] text-lg leading-[1.5] text-muted-foreground md:text-[27px]">
            One managed subscriptions layer over every rail. Dunning that recovers, reconciliation that
            settles itself, and a ledger that never loses a kobo. Ship recurring revenue instead of
            rebuilding billing.
          </p>

          {/* CTAs — padding [15,30], radius 10, 16.5px */}
          <div className="mt-[44px] flex flex-wrap items-center gap-[14px]">
            <a
              href={APP_URL}
              className="rounded-[10px] bg-accent px-[30px] py-[15px] text-[16.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Start building
            </a>
            <Link
              href="/guides"
              className="rounded-[10px] border border-border-strong bg-surface-2 px-[30px] py-[15px] text-[16.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
            >
              Read the docs
            </Link>
          </div>

          {/* Audiences — 18px, subtle, max 640 */}
          <p className="mt-[26px] max-w-[640px] text-lg leading-[1.5] text-subtle-foreground">
            For the developers, founders, merchants, and teams switching off billing they never wanted
            to maintain.
          </p>
        </div>
      </Container>
    </section>
  );
}
