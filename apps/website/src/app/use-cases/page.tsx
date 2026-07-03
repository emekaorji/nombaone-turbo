import { Banknote, Dumbbell, GraduationCap, LayoutGrid, Network } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";
import { UseCaseCard } from "@/components/primitives/UseCaseCard";
import { CTABand } from "@/components/sections/CTABand";

export const metadata = {
  title: "Use cases",
  description:
    "Built for how your business bills: SaaS, school fees, gyms and memberships, lending repayment, and platforms — one subscriptions engine tuned to how each business collects.",
};

const APP_URL = "https://app.nombaone.xyz";

const USE_CASES = [
  {
    href: "/use-cases/saas",
    icon: <LayoutGrid className="size-[22px]" strokeWidth={1.75} />,
    label: "SaaS",
    pain: "Seat-based plans, upgrades, and proration without the rebuild.",
  },
  {
    href: "/use-cases/school-fees",
    icon: <GraduationCap className="size-[22px]" strokeWidth={1.75} />,
    label: "School fees",
    pain: "Termly fees in installments, chased and reconciled automatically.",
  },
  {
    href: "/use-cases/gyms",
    icon: <Dumbbell className="size-[22px]" strokeWidth={1.75} />,
    label: "Gyms & memberships",
    pain: "Monthly plans that survive a failed card with payday retries.",
  },
  {
    href: "/use-cases/lending",
    icon: <Banknote className="size-[22px]" strokeWidth={1.75} />,
    label: "Lending repayment",
    pain: "Scheduled repayments over mandates and transfers, not just cards.",
  },
  {
    href: "/use-cases/platforms",
    icon: <Network className="size-[22px]" strokeWidth={1.75} />,
    label: "Platforms",
    pain: "Bill for many tenants and settle to each sub-account.",
  },
];

export default function UseCasesPage() {
  return (
    <>
      <PageHeader
        title="Built for how your business bills."
        deck="The same engine, tuned to how each business actually collects. Find yourself here."
      />

      <Container className="pb-14 md:pb-[88px] pt-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <UseCaseCard key={u.label} href={u.href} icon={u.icon} label={u.label} pain={u.pain} />
          ))}
        </div>
      </Container>

      <Container className="pb-20 md:pb-[120px]">
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
