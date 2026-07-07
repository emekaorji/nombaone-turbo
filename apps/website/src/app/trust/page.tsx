import { Check, CheckCheck, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { CTABand } from "@/components/sections/CTABand";
import { GuaranteeBand } from "@/components/sections/GuaranteeBand";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Trust & security",
  description:
    "Built so it can't quietly lose your money: an integer-kobo double-entry ledger, idempotent by construction, reconciled to the processor, with tenant isolation enforced at the schema level.",
};

const APP_URL = "https://console.nombaone.xyz";

const LEDGER: { entry: string; account: string; amount: string; header?: boolean }[] = [
  { entry: "ENTRY", account: "ACCOUNT", amount: "AMOUNT", header: true },
  { entry: "debit", account: "Customer receivable", amount: "₦12,500" },
  { entry: "credit", account: "Revenue", amount: "₦12,500" },
];

const TRUST_ITEMS = [
  "Amounts stored as integer kobo, never floats.",
  "Immutable invoices. A paid invoice is corrected by a reversal, not an edit.",
  "Idempotent by construction. A retry can never double-charge.",
  "Signature-verified webhooks over HMAC-SHA256.",
  "Two-step verify: webhook first, then a server-side requery before money moves.",
];

const VAULTS = [
  { name: "Tenant A", org: "org_a · 12,403 subs" },
  { name: "Tenant B", org: "org_b · 3,981 subs" },
  { name: "Tenant C", org: "org_c · 27,655 subs" },
];

const FLOW = ["webhook in", "verify signature", "requery Nomba", "match by reference", "post ledger"];

const FAQS: [string, string][] = [
  [
    "Do you touch raw card data?",
    "No. Card entry stays on Nomba's hosted, PCI-compliant page. No raw card number ever reaches our servers, and there is no publishable key to leak.",
  ],
  [
    "How is customer data protected?",
    "Data protection follows NDPR. Tenant data is isolated at the schema level, and every access is scoped to one organization.",
  ],
  [
    "What is your uptime posture?",
    "The status page publishes real uptime. Incidents are posted openly, with a plainly-worded postmortem.",
  ],
  [
    "What about direct debit, payouts, and escrow?",
    "Those rails are built and are being brought live. We describe them as capabilities, not as proven-at-scale, until each has run in production.",
  ],
];

export default function TrustPage() {
  return (
    <>
      <PageHeader
        title="Built so it can't quietly lose your money."
        deck="An integer-kobo double-entry ledger, idempotent by construction, and reconciled to the processor. Here is exactly how the money is handled."
      />

      {/* 01 Money */}
      <Container className="pb-14 md:pb-[88px] pt-14">
        <SectionHeader
          title="Every kobo, accounted for twice."
          deck="A real double-entry ledger under every charge, so the books always balance and always reconcile to Nomba."
        />
        <div className="mt-11 flex flex-col gap-14 lg:flex-row lg:items-center">
          {/* Ledger card */}
          <div className="w-full overflow-hidden rounded-[14px] border border-border bg-surface-1 lg:w-[520px]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] text-foreground">invoice · inv_2291</span>
                <span className="font-mono text-[13px] text-muted-foreground">₦12,500</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-success" />
                <span className="font-mono text-[10.5px] tracking-[0.5px] text-success">PAID</span>
              </span>
            </div>
            <div className="flex flex-col px-5 pb-3 pt-1.5">
              {LEDGER.map((row, i) => (
                <div
                  key={row.account}
                  className={cn("flex items-center py-2.5", i > 0 && "border-t border-border")}
                >
                  <span
                    className={cn(
                      "w-[90px] font-mono text-[12px]",
                      row.header ? "text-subtle-foreground" : "text-muted-foreground"
                    )}
                  >
                    {row.entry}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-[13px]",
                      row.header ? "text-subtle-foreground" : "text-foreground"
                    )}
                  >
                    {row.account}
                  </span>
                  <span
                    className={cn(
                      "w-[110px] text-right font-mono text-[12.5px]",
                      row.header ? "text-subtle-foreground" : "text-foreground"
                    )}
                  >
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-5 py-[13px]">
              <CheckCheck className="size-[15px] shrink-0 text-success" />
              <span className="text-[13px] text-success">
                Balanced, and reconciled to Nomba to the kobo.
              </span>
            </div>
          </div>

          {/* Trust items */}
          <div className="flex flex-1 flex-col gap-[18px]">
            {TRUST_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Check className="mt-0.5 size-[18px] shrink-0 text-accent" strokeWidth={2} />
                <span className="text-[15px] leading-[1.5] text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* 02 Isolation */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="Isolation is a property of the schema."
          deck="Not a middleware check you can forget to add. Every row carries an org_id, so one tenant can never read another's data."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {VAULTS.map((v) => (
            <div
              key={v.name}
              className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface-1 p-6"
            >
              <ShieldCheck className="size-[22px] text-accent" strokeWidth={1.75} />
              <span className="text-[18px] font-semibold text-foreground">{v.name}</span>
              <span className="font-mono text-[12.5px] text-subtle-foreground">{v.org}</span>
            </div>
          ))}
        </div>
        <div className="mt-[18px] inline-flex rounded-[8px] border border-border bg-surface-2 px-4 py-2.5">
          <span className="font-mono text-[13px] text-muted-foreground">
            every query is scoped:&nbsp;&nbsp;WHERE organization_id = $tenant
          </span>
        </div>
      </Container>

      {/* 03 Reconciliation */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="Money that arrives is verified, not trusted."
          deck="Every inbound event is checked and independently re-queried against Nomba before a single ledger entry is written."
        />
        <div className="mt-10 flex flex-wrap items-center gap-2.5">
          {FLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "rounded-full border px-[15px] py-[9px] font-mono text-[12.5px]",
                  i === FLOW.length - 1
                    ? "border-accent-border bg-accent-muted text-accent"
                    : "border-border bg-surface-2 text-muted-foreground"
                )}
              >
                {step}
              </span>
              {i < FLOW.length - 1 ? <span className="text-[15px] text-subtle-foreground">→</span> : null}
            </span>
          ))}
        </div>
      </Container>

      {/* 04 Guarantees */}
      <Container className="py-14 md:py-[88px]">
        <GuaranteeBand />
      </Container>

      {/* 05 FAQ */}
      <Container className="pt-14 md:pt-[88px]">
        <h2 className="text-[32px] font-semibold tracking-[-1.4px] text-foreground md:text-[40px]">
          Compliance, plainly.
        </h2>
        <div className="mt-9 flex max-w-[820px] flex-col">
          {FAQS.map(([q, a]) => (
            <div key={q} className="flex flex-col gap-2 border-b border-border py-5">
              <p className="text-[15px] font-semibold text-foreground">{q}</p>
              <p className="text-[14px] leading-[1.55] text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* 06 CTA */}
      <Container className="pb-20 md:pb-[120px] pt-24">
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
