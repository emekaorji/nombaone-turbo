import Link from "next/link";
import { Check, Plus } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { AskModal } from "@/components/sections/AskModal";
import { CTABand } from "@/components/sections/CTABand";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pricing" };

const APP_URL = "https://app.nombaone.xyz";

interface Tier {
  name: string;
  price: string;
  unit: string;
  desc: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Sandbox",
    price: "Free",
    unit: "everything to build",
    desc: "The full API in a test environment. Build the whole lifecycle before you pay anything.",
    features: [
      "All rails, in sandbox",
      "Dunning + recovery",
      "Webhooks + event catalog",
      "No card required",
    ],
    cta: { label: "Start building", href: APP_URL },
  },
  {
    name: "Self-serve",
    price: "1.4%",
    unit: "/ successful charge",
    desc: "Usage-based, and illustrative. Final pricing is still being set.",
    features: [
      "Everything in Sandbox, live",
      "Card, transfer, mandate rails",
      "Split settlement",
      "Email support",
    ],
    cta: { label: "Get an API key", href: APP_URL },
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "volume and compliance",
    desc: "For platforms and high volume that need dedicated terms.",
    features: ["Volume pricing", "Dedicated sub-accounts", "SLA and support", "Compliance review"],
    cta: { label: "Talk to us", href: "/trust" },
  },
];

const FAQS: [string, string][] = [
  [
    "What counts as a successful charge?",
    "A charge that settles. Failed attempts and retries are free, so you only pay when money actually moves.",
  ],
  ["What currency is this in?", "Everything is in NGN, handled as integer kobo from end to end."],
  [
    "How do settlement and payout fees work?",
    "Payouts to a bank account carry the standard transfer fee. There is no markup on settlement itself.",
  ],
  [
    "Is the sandbox really free?",
    "Yes. It is free and complete, so you can build and test the whole lifecycle before you pay anything.",
  ],
];

export default function PricingPage() {
  return (
    <>
      {/* PageHeader (centered, 64px) */}
      <Container className="pb-16 pt-24 text-center md:pt-[120px]">
        <h1 className="mx-auto max-w-[900px] text-[40px] font-semibold leading-[1.05] tracking-[-1.3px] text-foreground md:text-[64px] md:tracking-[-2.6px]">
          Pricing you can read without a sales call.
        </h1>
        <p className="mx-auto mt-[22px] max-w-[620px] text-lg leading-[1.5] text-muted-foreground md:text-[22px]">
          A free, complete sandbox to build against. Usage-based pricing when you go live. You never
          pay to talk to us.
        </p>
      </Container>

      {/* Tiers */}
      <Container className="pt-4">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-5 rounded-[14px] bg-surface-1 p-7",
                tier.featured
                  ? "border-[1.5px] border-accent-border"
                  : "border border-border"
              )}
            >
              <div className="flex flex-col gap-2">
                <span
                  className={cn(
                    "text-[16px] font-semibold",
                    tier.featured ? "text-accent" : "text-foreground"
                  )}
                >
                  {tier.name}
                </span>
                <div className="flex items-end gap-1.5">
                  <span className="text-[36px] font-semibold leading-none tracking-[-1px] text-foreground">
                    {tier.price}
                  </span>
                  <span className="pb-1 text-[13px] text-muted-foreground">{tier.unit}</span>
                </div>
              </div>
              <p className="text-[13px] leading-[1.5] text-muted-foreground">{tier.desc}</p>
              <div className="flex flex-col gap-2.5">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="size-[15px] shrink-0 text-accent" strokeWidth={2} />
                    <span className="text-[13px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href={tier.cta.href}
                className={cn(
                  "mt-1 w-full rounded-[8px] px-4 py-[9px] text-center text-sm font-medium transition-colors",
                  tier.featured
                    ? "bg-accent text-accent-foreground hover:bg-accent-hover"
                    : "border border-border bg-surface-2 text-foreground hover:bg-surface-3"
                )}
              >
                {tier.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </Container>

      {/* FAQ */}
      <Container className="pt-24">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-[32px] font-semibold tracking-[-1.4px] text-foreground md:text-[40px]">
              Questions, answered.
            </h2>
            <Link
              href="/hall"
              aria-label="See the Hall"
              className="bg-[linear-gradient(45deg,#7deabd,#0bdfa3,#007e57)] bg-clip-text text-[40px] font-medium leading-none text-transparent"
            >
              ↗
            </Link>
          </div>
          <div className="mt-9 flex w-full max-w-[780px] flex-col">
            {FAQS.map(([q, a]) => (
              <div key={q} className="flex flex-col gap-2 border-b border-border py-5">
                <p className="text-[15px] font-semibold text-foreground">{q}</p>
                <p className="text-[14px] leading-[1.55] text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3.5 pt-12">
            <p className="text-base text-subtle-foreground">
              Not here? Ask us. We answer in the open, in the Hall.
            </p>
            <AskModal>
              <button className="inline-flex items-center gap-2 rounded-[10px] border border-border-strong bg-surface-2 px-[22px] py-[13px] text-[15px] font-medium text-foreground transition-colors hover:bg-surface-3">
                <Plus className="size-4" /> Add your question
              </button>
            </AskModal>
          </div>
        </div>
      </Container>

      {/* CTA */}
      <Container className="pb-[120px] pt-24">
        <CTABand
          title="Start with a request, not a sales call."
          primary={{ label: "Get an API key", href: APP_URL }}
          secondary={{ label: "Read the quickstart", href: "/guides" }}
          npm="npm i nomba-one"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </Container>
    </>
  );
}
