import Link from "next/link";
import {
  Braces,
  LayoutTemplate,
  type LucideIcon,
  Smartphone,
  Terminal,
  Webhook,
  Workflow,
} from "lucide-react";

import { Container } from "@/components/layout/Container";
import { Callout } from "@/components/primitives/Callout";
import { GuideCard } from "@/components/primitives/GuideCard";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { Tag } from "@/components/primitives/Tag";
import { CTABand } from "@/components/sections/CTABand";
import { CodeStack } from "@/components/sections/CodeStack";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Integrations",
  description:
    "One REST API and real SDKs in every language you ship. The same create-subscription call in Next.js, Laravel, Django, or a curl one-liner — across card, direct debit, bank transfer, and crypto.",
};

const APP_URL = "https://console.nombaone.xyz";

// ── 01 Reach anywhere: labelled tile groups (.pen b6UR2 MatrixTile) ─────────
const REACH: { label: string; tiles: { name: string; icon: LucideIcon }[] }[] = [
  {
    label: "SDKs",
    tiles: ["Node.js", "Python", "Go", "PHP", "Ruby", ".NET", "Java"].map((name) => ({
      name,
      icon: Braces,
    })),
  },
  {
    label: "Frameworks",
    tiles: ["Next.js", "Laravel", "Django"].map((name) => ({ name, icon: LayoutTemplate })),
  },
  {
    label: "Mobile",
    tiles: ["React Native", "Flutter"].map((name) => ({ name, icon: Smartphone })),
  },
  {
    label: "No-code",
    tiles: ["Zapier", "Make", "n8n"].map((name) => ({ name, icon: Workflow })),
  },
  {
    label: "API and CLI",
    tiles: [
      { name: "REST + OpenAPI", icon: Webhook },
      { name: "CLI", icon: Terminal },
    ],
  },
];

function MatrixTile({ name, icon: Icon }: { name: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-border bg-surface-1 p-3.5">
      <Icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="flex-1 text-sm font-medium text-foreground">{name}</span>
      <span className="text-[13px] text-subtle-foreground">→</span>
    </div>
  );
}

// ── 04 Drop-in media cards (.pen x8Snj Card) ────────────────────────────────
function MediaCard({ media, title, desc }: { media: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface-1">
      <div className="flex h-[120px] items-center justify-center border-b border-border bg-accent-muted">
        <span className="font-mono text-[12px] text-accent">{media}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-[18px]">
        <p className="text-[16px] font-semibold text-foreground">{title}</p>
        <p className="text-[13.5px] leading-[1.5] text-muted-foreground">{desc}</p>
        <span className="flex items-center gap-[5px] pt-2 text-[13.5px] font-medium text-accent">
          Learn more →
        </span>
      </div>
    </div>
  );
}

const RAILS = ["Card", "Bank transfer", "Direct debit", "Crypto"];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrate anywhere."
        deck="One REST API and a real SDK in every language you ship. The same create-subscription call in Next.js, Laravel, Django, or a curl one-liner."
      >
        <div className="mt-2 flex flex-wrap items-center gap-[14px]">
          <a
            href={APP_URL}
            className="rounded-[8px] bg-accent px-4 py-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Get an API key
          </a>
          <Link
            href="/guides"
            className="rounded-[8px] border border-border bg-surface-2 px-4 py-[9px] text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
          >
            Read the quickstart
          </Link>
        </div>
      </PageHeader>

      {/* 01 Reach anywhere */}
      <Container className="pb-14 md:pb-[88px] pt-10">
        <SectionHeader
          title="Reach us from anywhere in your stack."
          deck="SDKs in seven languages, framework quickstarts, mobile, no-code, a CLI, and a REST API with an always-accurate OpenAPI spec."
        />
        <div className="mt-11 flex flex-col gap-8">
          {REACH.map((group) => (
            <div key={group.label} className="flex flex-col gap-3.5">
              <span className="font-mono text-[12.5px] tracking-[0.5px] text-subtle-foreground">
                {group.label}
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.tiles.map((t) => (
                  <MatrixTile key={t.name} name={t.name} icon={t.icon} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* 02 Code */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="The same call, in your framework."
          deck="One create-subscription request, shown in the stack you actually ship. Copy it and run."
        />
        <div className="mt-10">
          <CodeStack />
        </div>
      </Container>

      {/* 03 Rails */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="Every rail your customers use."
          deck="Card, bank transfer, direct debit, and crypto, behind one subscription object."
        />
        <div className="mt-8 flex flex-wrap gap-2.5">
          {RAILS.map((r) => (
            <Tag key={r}>{r}</Tag>
          ))}
        </div>
        <div className="mt-5">
          <Callout title="Crypto is a first-class rail, but distinct.">
            It has its own settlement and compliance path, so it does not settle identically to the
            Nomba rails. We label it clearly wherever it appears.
          </Callout>
        </div>
      </Container>

      {/* 04 Drop-in */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="Drop in, or go deep."
          deck="Embed a checkout in minutes, or wire the full API. Either way, the money layer stays on Nomba's hosted, PCI-compliant surface."
        />
        <div className="mt-9 grid grid-cols-1 gap-6 md:grid-cols-2">
          <MediaCard
            media="drop-in · checkout"
            title="Checkout embed"
            desc="Add a script tag or an iframe and take card, transfer, or mandate payments on your own page."
          />
          <MediaCard
            media="data · exports"
            title="Accounting exports"
            desc="Every invoice, payment, and payout as a clean export your finance team can reconcile."
          />
        </div>
      </Container>

      {/* 05 Migrate */}
      <Container className="py-14 md:py-[88px]">
        <SectionHeader
          title="Moving off something else?"
          deck="Bring your plans and customers over, and pick up dunning, reconciliation, and multi-rail billing on the way in."
        />
        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2">
          <GuideCard
            href="/guides/moving-off-stripe-billing"
            group="MIGRATION GUIDE"
            title="Moving off Stripe Billing"
            problem="Port plans, prices, and subscriptions to a rail-agnostic model built for how Nigeria pays."
          />
          <GuideCard
            href="/guides/moving-off-paystack-subscriptions"
            group="MIGRATION GUIDE"
            title="Moving off Paystack subscriptions"
            problem="Keep your customers and gain dunning, reconciliation, and multi-rail billing."
          />
        </div>
      </Container>

      {/* 06 CTA */}
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
