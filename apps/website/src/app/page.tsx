import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  Check,
  CheckCheck,
  CreditCard,
  Dumbbell,
  GraduationCap,
  Landmark,
  Layers,
  LayoutGrid,
  Network,
  Shield,
  ShieldCheck,
  TrendingUp,
  Webhook,
} from "lucide-react";

import { HomeSection } from "@/components/layout/Container";
import { Callout } from "@/components/primitives/Callout";
import { GuideCard } from "@/components/primitives/GuideCard";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { UseCaseCard } from "@/components/primitives/UseCaseCard";
import { CTABand } from "@/components/sections/CTABand";
import { CodeStack } from "@/components/sections/CodeStack";
import { Hero } from "@/components/sections/Hero";
import { LifecycleRail } from "@/components/sections/LifecycleRail";
import { SimulatorStage } from "@/components/sections/SimulatorStage";

const NOMBA_PERKS = [
  {
    icon: ShieldCheck,
    title: "Licensed and regulated",
    desc: "CBN-licensed payment rails, so the money layer is compliant by default.",
  },
  {
    icon: Layers,
    title: "One provider, every rail",
    desc: "Card, transfer, virtual accounts, and payout from a single integration.",
  },
  {
    icon: Landmark,
    title: "Nationwide bank coverage",
    desc: "Every major Nigerian bank reachable through one connection.",
  },
  {
    icon: TrendingUp,
    title: "Proven at scale",
    desc: "The rails hundreds of thousands of businesses already run on.",
  },
];

const GUARANTEES = [
  { icon: Check, label: "Never double-charge" },
  { icon: Shield, label: "Tenant isolation by design" },
  { icon: Check, label: "Reconciled to the kobo" },
  { icon: Layers, label: "Integer-kobo ledger" },
  { icon: Webhook, label: "Signed, replayable webhooks" },
  { icon: ShieldCheck, label: "Two-step verified" },
];

const LEDGER: { entry: string; account: string; amount: string; header?: boolean }[] = [
  { entry: "ENTRY", account: "ACCOUNT", amount: "AMOUNT", header: true },
  { entry: "debit", account: "Customer receivable", amount: "₦12,500" },
  { entry: "credit", account: "Revenue", amount: "₦12,500" },
];

const RAILS = [
  {
    icon: CreditCard,
    name: "Card",
    desc: "Tokenized and recharged each cycle. When a bank forces OTP, we send a one-tap link, and the renewal still lands.",
    chip: "pull · OTP-safe",
  },
  {
    icon: Landmark,
    name: "Direct debit",
    desc: "A NIBSS mandate pulls straight from the account. No card, no per-cycle action. The silent rail.",
    chip: "pull · silent",
  },
  {
    icon: ArrowLeftRight,
    name: "Bank transfer",
    desc: "A dedicated account per customer. Inbound transfers reconcile themselves to the right invoice.",
    chip: "push · auto-reconciled",
  },
];

/**
 * Home. Rebuilt section-by-section against NOMBAONE.pen (frame vrJWr).
 * Sections are appended here only after each is pixel-verified against its
 * .pen reference frame. Order matches the .pen Content children.
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      {/* §02 Rails & DX (J7Mmfu) */}
      <HomeSection id="rails-dx">
        <SectionHeader
          title={
            <>
              <span className="rainbow-text rainbow-text--animate">Integrate</span> any stack. Any
              language. Any way.
            </>
          }
          deck="The same create-subscription call in your framework, plus a drop-in checkout and a CLI that tails webhooks locally."
        />
        <div className="mt-[52px]">
          <CodeStack />
        </div>
        <div className="mt-6">
          <Callout title="Drop-in, either way.">
            Embed checkout with a script tag, or scaffold your integration and tail webhooks locally
            with the CLI.
          </Callout>
        </div>
      </HomeSection>

      {/* §03 Built on Nomba (Qb532) — self-contained panel, no top divider */}
      <HomeSection id="built-on-nomba" divider={false}>
        <div className="relative overflow-hidden rounded-[21px] bg-border p-px">
          {/* Animated emerald light travelling around the border */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_9s_linear_infinite] bg-[conic-gradient(from_0deg,#7ef0c8cc_0deg,#0bdfa300_20deg,transparent_340deg,#0bdfa300_346deg,#7ef0c8cc_360deg)] motion-reduce:hidden"
          />
          <div className="relative flex flex-col gap-9 rounded-[20px] bg-surface-1 p-8 md:p-14">
          {/* Top: eyebrow pill + heading + paragraph */}
          <div className="flex flex-col gap-[18px]">
            <span className="inline-flex w-fit items-center gap-2.5 rounded-full border border-border bg-surface-2 py-1.5 pl-1.5 pr-3.5">
              <Image
                src="/nomba-mark.png"
                alt="Nomba"
                width={22}
                height={22}
                className="rounded-[6px]"
              />
              <span className="text-[13px] font-medium text-muted-foreground">Powered by Nomba</span>
            </span>
            <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-1.4px] text-foreground md:text-[54px] md:tracking-[-2.2px]">
              Built on the Nomba infrastructure.
            </h2>
            <p className="max-w-[740px] text-lg leading-[1.55] text-muted-foreground md:text-[22px]">
              Nomba One runs on Nomba, the licensed payment infrastructure hundreds of thousands of
              Nigerian businesses already trust to move money. We run the subscriptions; Nomba moves
              the naira.
            </p>
          </div>

          {/* Perks: 4-column row */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {NOMBA_PERKS.map((perk) => (
              <div key={perk.title} className="flex flex-col gap-3">
                <perk.icon className="size-[22px] text-foreground" strokeWidth={1.75} />
                <p className="text-[19px] font-semibold text-foreground">{perk.title}</p>
                <p className="text-[16px] leading-[1.5] text-muted-foreground">{perk.desc}</p>
              </div>
            ))}
          </div>
          </div>
        </div>
      </HomeSection>

      {/* §04 Rails showcase (S57CtQ) */}
      <HomeSection id="rails-showcase">
        <SectionHeader
          title="One subscription. Every rail your customer can actually use."
          deck="Card, direct debit, or bank transfer. The same lifecycle runs on whichever rail works, and falls back automatically when one can't."
        />
        <div className="mt-16 flex flex-col items-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-muted px-[18px] py-2.5">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[12.5px] text-accent">subscription · sub_8821</span>
          </span>
          <div className="h-9 w-px bg-border-strong" />
          <div className="grid w-full grid-cols-1 items-start gap-5 md:grid-cols-3">
            {RAILS.map((rail) => (
              <div
                key={rail.name}
                className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface-1 p-[26px]"
              >
                <div className="flex size-11 items-center justify-center rounded-[8px] border border-accent-border bg-accent-muted">
                  <rail.icon className="size-5 text-accent" strokeWidth={1.75} />
                </div>
                <p className="text-[26px] font-semibold tracking-[-0.3px] text-foreground">
                  {rail.name}
                </p>
                <p className="text-[18px] leading-[1.55] text-muted-foreground">{rail.desc}</p>
                <span className="w-fit rounded-[6px] border border-border bg-surface-2 px-2.5 py-[5px] font-mono text-[11px] text-subtle-foreground">
                  {rail.chip}
                </span>
              </div>
            ))}
          </div>
        </div>
      </HomeSection>

      {/* §05 DIY (v1s7ik) */}
      <HomeSection id="diy">
        <SectionHeader
          title="Why not just build this on Nomba yourself?"
          deck="Nomba ships the rails. The managed billing layer on top is the part that takes a team a year."
        />
        <div className="mt-14 flex flex-col gap-16 lg:flex-row">
          {/* Left: argument + stat */}
          <div className="flex flex-1 flex-col gap-[22px]">
            <p className="text-[24px] leading-[1.5] text-foreground">
              Nomba moves money. It charges a card, debits a mandate, receives a transfer, and pays
              out.
            </p>
            <p className="text-[20px] leading-[1.6] text-muted-foreground">
              Everything that turns one charge into a running subscription, you build yourself. And
              the card-on-file playbook assumes a country most people don&apos;t have a card in.
              Nigeria isn&apos;t that country.
            </p>
            <div className="flex items-end gap-3.5 pt-3">
              <span className="text-[76px] font-semibold leading-none tracking-[-3px] text-accent">
                {"< 2%"}
              </span>
              <span className="max-w-[150px] text-[18px] leading-[1.35] text-muted-foreground">
                of Nigerians
                <br />
                carry a card.
              </span>
            </div>
          </div>

          {/* Right: the DIY stack over the Nomba base */}
          <div className="flex w-full flex-col gap-2.5 lg:w-[440px]">
            <span className="text-[13px] text-muted-foreground">You build this</span>
            <div className="flex flex-col gap-1.5">
              {[
                "The state machines",
                "Reconciliation",
                "A correct ledger",
                "Dunning & recovery",
                "Proration",
                "Plans & prices",
              ].map((block) => (
                <div
                  key={block}
                  className="rounded-[8px] border border-border bg-surface-2 px-4 py-[13px] text-[17px] font-medium text-foreground"
                >
                  {block}
                </div>
              ))}
            </div>
            <div className="h-1" />
            <div className="rounded-[8px] border border-accent-border bg-accent-muted px-4 py-[15px]">
              <span className="font-mono text-[12.5px] text-accent">
                Nomba · charge · transfer · mandate · VA
              </span>
            </div>
            <span className="text-[13px] text-subtle-foreground">You get this</span>
          </div>
        </div>
      </HomeSection>

      {/* §06 Simulator (T6mX2) */}
      <HomeSection id="simulator">
        <SectionHeader
          title="See a subscription survive."
          deck="Pick a rail, run it, then break it. Watch dunning recover the charge, with the webhooks streaming to your endpoint exactly as they will in production."
        />
        <div className="mt-[52px]">
          <SimulatorStage />
        </div>
      </HomeSection>

      {/* §07 Lifecycle (g5Uinc) */}
      <HomeSection id="lifecycle">
        <SectionHeader
          title="From signup to settlement, one object."
          deck="Five stages, each a doorway to the hard problem behind it."
        />
        <div className="mt-[52px]">
          <LifecycleRail />
        </div>
      </HomeSection>

      {/* §08 Hard parts (BFCzk) */}
      <HomeSection id="hard-parts">
        <SectionHeader
          title="The hard parts of recurring billing, written down."
          deck="Proof we know the domain cold, and the standing argument against building it yourself."
        />
        <div className="mt-[52px] grid grid-cols-1 gap-4 md:grid-cols-3">
          <GuideCard
            href="/guides/the-double-charge-bug"
            group="RELIABILITY & CORRECTNESS"
            title="The double-charge bug"
            problem="A retry or a crash turns one payment into two, and your customer notices before you do."
          />
          <GuideCard
            href="/guides/dunning-for-thin-balances"
            group="THE NIGERIAN PAYMENT REALITY"
            title="Dunning for thin balances"
            problem="Fixed retry schedules miss payday. Payday-timed retries win back charges a fixed schedule writes off."
          />
          <GuideCard
            href="/guides/bank-transfer-is-not-just-another-method"
            group="THE NIGERIAN PAYMENT REALITY"
            title="Push vs pull: transfers"
            problem="You can't pull a bank transfer. The engine issues the invoice and reconciles the money that arrives."
          />
        </div>
        <div className="mt-5">
          <Link
            href="/guides"
            className="inline-flex items-center gap-[5px] text-sm font-medium text-accent hover:underline"
          >
            All guides →
          </Link>
        </div>
      </HomeSection>

      {/* §09 Platforms (X6Fbl) */}
      <HomeSection id="platforms">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          {/* Left: header + link */}
          <div className="flex flex-1 flex-col gap-4">
            <SectionHeader
              title="Run billing for a thousand tenants."
              deck="Per-tenant isolation, sub-account settlement, and automatic splits, without their data ever touching."
            />
            <Link
              href="/use-cases/platforms"
              className="inline-flex items-center gap-[5px] text-sm font-medium text-accent hover:underline"
            >
              See the platform use case →
            </Link>
          </div>

          {/* Right: settlement-split diagram */}
          <div className="flex w-full flex-col items-center gap-2.5 rounded-[14px] border border-border bg-surface-1 p-7 lg:w-[420px]">
            <span className="rounded-[8px] border border-border bg-surface-2 px-[18px] py-2.5 font-mono text-[12.5px] text-muted-foreground">
              1 charge · ₦12,500
            </span>
            <span className="text-base text-subtle-foreground">↓</span>
            <span className="rounded-[8px] border border-accent-border bg-accent-muted px-[18px] py-2.5 font-mono text-[12.5px] text-accent">
              split settlement
            </span>
            <span className="text-base text-subtle-foreground">↓</span>
            <div className="flex gap-2">
              {["Tenant A", "Tenant B", "Tenant C"].map((t) => (
                <span
                  key={t}
                  className="rounded-[6px] border border-border bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </HomeSection>

      {/* §10 Trust (N6bry) */}
      <HomeSection id="trust">
        <SectionHeader
          title="Built so it can't quietly lose your money."
          deck="An integer-kobo double-entry ledger, idempotent by construction, reconciled to the processor. The guarantees that matter when you hand a system your revenue."
        />

        {/* Ledger card */}
        <div className="mt-[52px] flex justify-center">
          <div className="w-full max-w-[640px] overflow-hidden rounded-[14px] border border-border bg-surface-1">
            <div className="flex items-center justify-between border-b border-border px-[22px] py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] text-foreground">invoice · inv_2291</span>
                <span className="font-mono text-[13px] text-muted-foreground">₦12,500</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-success" />
                <span className="font-mono text-[10.5px] tracking-[0.5px] text-success">PAID</span>
              </span>
            </div>
            <div className="flex flex-col px-[22px] pb-3.5 pt-1.5">
              {LEDGER.map((row, i) => (
                <div
                  key={row.account}
                  className={cnRow(i)}
                >
                  <span
                    className={
                      "w-[110px] font-mono text-[12px] " +
                      (row.header ? "text-subtle-foreground" : "text-muted-foreground")
                    }
                  >
                    {row.entry}
                  </span>
                  <span
                    className={
                      "flex-1 text-[13px] " +
                      (row.header ? "text-subtle-foreground" : "text-foreground")
                    }
                  >
                    {row.account}
                  </span>
                  <span
                    className={
                      "w-[120px] text-right font-mono text-[12.5px] " +
                      (row.header ? "text-subtle-foreground" : "text-foreground")
                    }
                  >
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-[22px] py-[13px]">
              <CheckCheck className="size-[15px] shrink-0 text-success" />
              <span className="text-[13px] text-success">
                Balanced, and reconciled to Nomba to the kobo.
              </span>
            </div>
          </div>
        </div>

        {/* Guarantees band */}
        <div className="mt-11 grid grid-cols-1 gap-x-4 gap-y-[18px] rounded-[14px] border border-border bg-surface-1 p-8 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g.label} className="flex items-center gap-2.5">
              <g.icon className="size-4 shrink-0 text-accent" strokeWidth={2} />
              <span className="text-[18px] font-medium text-foreground">{g.label}</span>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="text-[12.5px] font-medium text-success">
              99.9% · All systems operational
            </span>
          </span>
          <Link href="/trust" className="text-sm font-medium text-accent hover:underline">
            Read the trust page →
          </Link>
        </div>
      </HomeSection>

      {/* §11 Use cases (Boehf) */}
      <HomeSection id="use-cases">
        <SectionHeader
          title="Find yourself here."
          deck="The same engine, tuned to how each business actually bills."
        />
        <div className="mt-[52px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <UseCaseCard
            href="/use-cases"
            icon={<LayoutGrid className="size-[22px]" strokeWidth={1.75} />}
            label="SaaS"
            pain="Seat-based plans, upgrades, and proration without the rebuild."
          />
          <UseCaseCard
            href="/use-cases/school-fees"
            icon={<GraduationCap className="size-[22px]" strokeWidth={1.75} />}
            label="School fees"
            pain="Termly fees in installments, chased and reconciled automatically."
          />
          <UseCaseCard
            href="/use-cases"
            icon={<Dumbbell className="size-[22px]" strokeWidth={1.75} />}
            label="Gyms & memberships"
            pain="Monthly plans that survive a failed card with payday retries."
          />
          <UseCaseCard
            href="/use-cases"
            icon={<Banknote className="size-[22px]" strokeWidth={1.75} />}
            label="Lending repayment"
            pain="Scheduled repayments over mandates and transfers, not just cards."
          />
          <UseCaseCard
            href="/use-cases/platforms"
            icon={<Network className="size-[22px]" strokeWidth={1.75} />}
            label="Platforms"
            pain="Bill for many tenants and settle to each sub-account."
          />
        </div>
      </HomeSection>

      {/* §12 CTA (bMLOQ) */}
      <HomeSection id="cta">
        <CTABand
          title="Start with a request, not a sales call."
          primary={{ label: "Get an API key", href: "https://console.nombaone.xyz" }}
          secondary={{ label: "Read the quickstart", href: "/guides" }}
          npm="npm i @nombaone/node"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </HomeSection>
    </>
  );
}

/** Ledger table row classes: header row has no top border; data rows do. */
function cnRow(i: number) {
  return i === 0
    ? "flex items-center py-2.5"
    : "flex items-center border-t border-border py-2.5";
}
