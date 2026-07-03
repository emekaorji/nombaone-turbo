import { Calendar, CheckCheck, HeartPulse, Landmark, type LucideIcon } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { CTABand } from "@/components/sections/CTABand";
import { CodeBlock } from "@/components/sections/CodeBlock";
import { com, kw, str, w, type Line } from "@/components/sections/code-tokens";
import { cn } from "@/lib/utils";

export const metadata = { title: "School fees" };

const APP_URL = "https://app.nombaone.xyz";

// Term schedule card (.pen CApZP).
const TERMS: { term: string; amount: string; status: string; tone: string }[] = [
  { term: "Term 1", amount: "₦150,000", status: "paid", tone: "text-success" },
  { term: "Term 2", amount: "₦150,000", status: "due · nudged", tone: "text-warning" },
  { term: "Term 3", amount: "₦150,000", status: "scheduled", tone: "text-subtle-foreground" },
];

// Solution points (.pen MEHSy).
const POINTS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Landmark, title: "Any rail", desc: "Mandate or transfer, whichever the family can use." },
  { icon: Calendar, title: "Installments", desc: "Split the term into scheduled charges." },
  { icon: HeartPulse, title: "Payday dunning", desc: "Nudge and retry around payday, not blindly." },
  { icon: CheckCheck, title: "Auto-reconciled", desc: "Every transfer matched to the right student." },
];

// Code panel (.pen OxT62).
const NODE_LINES: Line[] = [
  [kw("const "), w("sub = "), kw("await "), w("nomba.subscriptions.create({")],
  [w("  customer: "), str("'student_4821',")],
  [w("  plan: "), str("'termly_fees',")],
  [w("  rail: "), str("'auto',"), com("          // mandate, transfer, or card")],
  [w("  schedule: "), str("'installments',")],
  [w("  installments: "), w("3,")],
  [w("});")],
];
const PY_LINES: Line[] = [
  [w("sub = nomba.subscriptions.create(")],
  [w("    customer="), str("'student_4821',")],
  [w("    plan="), str("'termly_fees',")],
  [w("    rail="), str("'auto',"), com("  # mandate, transfer, or card")],
  [w("    schedule="), str("'installments',")],
  [w("    installments="), w("3,")],
  [w(")")],
];
const CURL_LINES: Line[] = [
  [w("curl https://api.nombaone.xyz/v1/subscriptions \\")],
  [w("  -d customer=student_4821 \\")],
  [w("  -d plan=termly_fees \\")],
  [w("  -d rail=auto -d schedule=installments \\")],
  [w("  -d installments=3")],
];
const CODE_TABS = [
  { label: "Node.js", lines: NODE_LINES },
  { label: "Python", lines: PY_LINES },
  { label: "cURL", lines: CURL_LINES },
];

export default function SchoolFeesPage() {
  return (
    <>
      <PageHeader
        kicker="School fees"
        title="Termly fees, collected and reconciled."
        deck="Schools bill in installments and chase payments by hand. Nomba One turns each term into a subscription that collects itself."
      />

      {/* 01 Problem */}
      <Container className="py-16">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-col gap-[18px]">
            <h2 className="text-[36px] font-semibold tracking-[-1.2px] text-foreground">
              The manual way.
            </h2>
            <p className="text-[19px] leading-[1.6] text-muted-foreground">
              Fees come in parts, across a term, mostly by transfer, and often late. Someone in the
              bursary chases each parent by hand and reconciles it against a spreadsheet. It does not
              scale past a few hundred students.
            </p>
          </div>
          {/* Schedule card */}
          <div className="flex w-full flex-col gap-2.5 rounded-[14px] border border-border bg-surface-1 p-6 lg:w-[460px]">
            <span className="font-mono text-[12px] text-subtle-foreground">
              subscription · student_4821
            </span>
            {TERMS.map((t) => (
              <div
                key={t.term}
                className="flex items-center justify-between rounded-[8px] bg-surface-2 px-3.5 py-3"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-foreground">{t.term}</span>
                  <span className="font-mono text-[12.5px] text-subtle-foreground">{t.amount}</span>
                </span>
                <span className={cn("font-mono text-[11.5px]", t.tone)}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* 02 Solution */}
      <Container className="py-16">
        <SectionHeader
          title="One subscription per student."
          deck="Pick the rail the family can use, split the term into installments, nudge on payday, and reconcile every transfer automatically."
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
          deck="Create a school-fees subscription with installments in a single call."
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
          npm="npm i nomba-one"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </Container>
    </>
  );
}
