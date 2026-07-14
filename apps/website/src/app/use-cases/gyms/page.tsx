import { CreditCard, HeartPulse, Receipt, RefreshCw, type LucideIcon } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { CTABand } from "@/components/sections/CTABand";
import { CodeBlock } from "@/components/sections/CodeBlock";
import { com, kw, str, w, type Line } from "@/components/sections/code-tokens";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Gyms & memberships",
  description:
    "Monthly plans that survive a failed card. Members join through hosted checkout, cards renew silently with an OTP fallback when a bank demands one, transfer payers get invoice links, and failed debits retry around payday.",
};

const APP_URL = "https://console.nombaone.xyz";

// Renewal timeline card.
const RENEWALS: { cycle: string; amount: string; status: string; tone: string }[] = [
  { cycle: "June", amount: "₦25,000", status: "paid", tone: "text-success" },
  { cycle: "July", amount: "₦25,000", status: "retrying · payday", tone: "text-warning" },
  { cycle: "August", amount: "₦25,000", status: "scheduled", tone: "text-subtle-foreground" },
];

// Solution points.
const POINTS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: CreditCard,
    title: "Join by paying",
    desc: "Members pay a hosted checkout page — card or transfer. No card details in your stack.",
  },
  {
    icon: RefreshCw,
    title: "Silent card renewals",
    desc: "The card captured at checkout renews on its own. When a bank insists on an OTP, the member gets a link to finish it.",
  },
  {
    icon: HeartPulse,
    title: "Payday retries",
    desc: "A failed debit usually means “not yet.” Retries lean toward payday instead of hammering a thin balance.",
  },
  {
    icon: Receipt,
    title: "Transfer memberships",
    desc: "Transfer payers get each cycle's invoice with a payment link and its own account number, auto-reconciled.",
  },
];

// Code panel: the no-payment-method create that returns a checkoutLink.
const NODE_LINES: Line[] = [
  [kw("const "), w("sub = "), kw("await "), w("nombaone.subscriptions.create({")],
  [w("  customerId: "), str("'cus_8802',")],
  [w("  priceId: "), str("'price_monthly',"), com(" // no card on file")],
  [w("});")],
  [w("redirect(sub.checkoutLink);"), com(" // Nomba-hosted: card or transfer")],
];
const CURL_LINES: Line[] = [
  [w("curl https://api.nombaone.xyz/v1/subscriptions \\")],
  [w("  -H "), str("'Authorization: Bearer $NOMBAONE_API_KEY'"), w(" \\")],
  [w("  -d "), str('\'{"customerId":"cus_8802","priceId":"price_monthly"}\'')],
  [com('# → { "status": "incomplete", "checkoutLink": "https://…" }')],
];
const CODE_TABS = [
  { label: "Node.js", lines: NODE_LINES },
  { label: "cURL", lines: CURL_LINES },
];

export default function GymsPage() {
  return (
    <>
      <PageHeader
        kicker="Gyms & memberships"
        title="Monthly plans that survive a failed card."
        deck="Members join by paying — card or transfer — and renewals collect themselves. When a debit fails, Nomba One retries around payday instead of churning the member."
      />

      {/* 01 Problem */}
      <Container className="py-16">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-[18px]">
            <h2 className="text-[36px] font-semibold tracking-[-1.2px] text-foreground">
              The front-desk way.
            </h2>
            <p className="text-[19px] leading-[1.6] text-muted-foreground">
              A card that declines on the 28th usually works on the 1st, but most gyms treat the
              first failure as a lapse: chase the member at the desk, take cash, lose the record.
              The members who quietly drop off are mostly members who would have paid.
            </p>
          </div>
          {/* Renewal card */}
          <div className="flex w-full flex-col gap-2.5 rounded-[14px] border border-border bg-surface-1 p-6 lg:w-[460px]">
            <span className="font-mono text-[12px] text-subtle-foreground">
              subscription · member_8802
            </span>
            {RENEWALS.map((r) => (
              <div
                key={r.cycle}
                className="flex items-center justify-between rounded-[8px] bg-surface-2 px-3.5 py-3"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-foreground">{r.cycle}</span>
                  <span className="font-mono text-[12.5px] text-subtle-foreground">{r.amount}</span>
                </span>
                <span className={cn("font-mono text-[11.5px]", r.tone)}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* 02 Solution */}
      <Container className="py-16">
        <SectionHeader
          title="One subscription per member."
          deck="Joining is paying a link. Cards renew silently — and when a bank demands an OTP, the member gets a link, not a lapse. Transfer payers live on invoice links."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-6"
            >
              <p.icon className="size-[22px] text-accent" strokeWidth={1.75} />
              <p className="text-[18px] font-semibold text-foreground">{p.title}</p>
              <p className="text-sm leading-[1.5] text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* 03 Code */}
      <Container className="py-16">
        <SectionHeader
          title="In code."
          deck="Create the membership with no payment method — the response's checkoutLink is where the member pays."
        />
        <div className="mt-9">
          <CodeBlock tabs={CODE_TABS} />
        </div>
      </Container>

      {/* 04 CTA */}
      <Container className="pb-20 md:pb-[120px] pt-14 md:pt-[88px]">
        <CTABand
          title="Start with a request, not a sales call."
          primary={{ label: "Get an API key", href: APP_URL }}
          secondary={{ label: "Read the quickstart", href: "/guides" }}
          npm="npm i @nombaone/node"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </Container>
    </>
  );
}
