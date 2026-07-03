import Link from "next/link";
import { CheckCheck } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/primitives/PageHeader";
import { CTABand } from "@/components/sections/CTABand";
import { CodeBlock } from "@/components/sections/CodeBlock";
import { com, kw, str, w, type Line } from "@/components/sections/code-tokens";
import { GuaranteeBand } from "@/components/sections/GuaranteeBand";
import { LifecycleRail } from "@/components/sections/LifecycleRail";
import { cn } from "@/lib/utils";

export const metadata = { title: "Product" };

// ── Stage 01 visual: tabbed code (.pen KAOgf) ──────────────────────────────
const NODE_LINES: Line[] = [
  [kw("import "), w("{ Nomba } "), kw("from "), str("'nomba-one';")],
  null,
  [kw("const "), w("nomba = "), kw("new "), w("Nomba(process.env.NOMBA_KEY);")],
  null,
  [com("// charge a saved rail on the billing cycle")],
  [kw("await "), w("nomba.subscriptions.charge({")],
  [w("  subscription: "), str("'sub_8821',")],
  [w("  idempotencyKey: "), str("'sub_8821_2026_03',")],
  [w("});")],
];
const PY_LINES: Line[] = [
  [kw("from "), w("nomba_one "), kw("import "), w("Nomba")],
  null,
  [w("nomba = Nomba(os.environ["), str("'NOMBA_KEY'"), w("])")],
  null,
  [com("# charge a saved rail on the billing cycle")],
  [w("nomba.subscriptions.charge(")],
  [w("    subscription="), str("'sub_8821',")],
  [w("    idempotency_key="), str("'sub_8821_2026_03',")],
  [w(")")],
];
const CURL_LINES: Line[] = [
  [w("curl https://api.nombaone.xyz/v1/subscriptions/charge \\")],
  [w("  -H "), str("'Authorization: Bearer $NOMBA_KEY'"), w(" \\")],
  [w("  -H "), str("'Idempotency-Key: sub_8821_2026_03'"), w(" \\")],
  [w("  -d "), str("subscription=sub_8821")],
];
const STAGE1_TABS = [
  { label: "Node.js", lines: NODE_LINES },
  { label: "Python", lines: PY_LINES },
  { label: "cURL", lines: CURL_LINES },
];

// ── Small visual primitives ────────────────────────────────────────────────
const visualShell = "w-full rounded-[14px] border border-border bg-surface-1 lg:w-[480px]";

function IdempotencyPanel() {
  return (
    <div className={cn(visualShell, "overflow-hidden")}>
      <div className="border-b border-border px-[18px] py-[14px]">
        <span className="font-mono text-[13px] text-foreground">POST /v1/subscriptions/charge</span>
      </div>
      <div className="flex flex-col gap-3 p-[18px]">
        <span className="font-mono text-[13px] text-muted-foreground">
          Idempotency-Key: sub_8821_2026_03
        </span>
        <span className="h-px w-full bg-border" />
        <p className="text-[15px] leading-[1.55] text-muted-foreground">
          A unique constraint on (subscription, period) makes a duplicate invoice structurally
          impossible. Replay the job anywhere and it resolves to exactly one charge.
        </p>
      </div>
    </div>
  );
}

function DunningTimeline() {
  const events = [
    { dot: "bg-danger", text: "text-danger", label: "payment_failed · insufficient_funds" },
    { dot: "bg-warning", text: "text-warning", label: "retry_scheduled · payday+1" },
    { dot: "bg-info", text: "text-info", label: "action_required · checkout link" },
    { dot: "bg-success", text: "text-success", label: "payment_recovered" },
  ];
  return (
    <div className={cn(visualShell, "flex flex-col gap-2.5 p-[22px]")}>
      <span className="font-mono text-[12px] text-subtle-foreground">dunning · invoice inv_2291</span>
      {events.map((e) => (
        <div
          key={e.label}
          className="flex items-center gap-2.5 rounded-[8px] bg-surface-2 px-3 py-[9px]"
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", e.dot)} />
          <span className={cn("font-mono text-[12.5px]", e.text)}>{e.label}</span>
        </div>
      ))}
    </div>
  );
}

function MatchPanel() {
  const row =
    "flex items-center justify-between rounded-[8px] border border-border bg-surface-2 px-4 py-[13px]";
  return (
    <div className={cn(visualShell, "flex flex-col items-center gap-3.5 p-6")}>
      <div className={cn(row, "w-full")}>
        <span className="font-mono text-[13px] text-foreground">transfer · ₦12,500</span>
        <span className="font-mono text-[12.5px] text-subtle-foreground">from GTBank</span>
      </div>
      <span className="text-base text-subtle-foreground">↓</span>
      <div className={cn(row, "w-full")}>
        <span className="font-mono text-[13px] text-foreground">invoice · inv_2291</span>
        <span className="font-mono text-[12.5px] text-subtle-foreground">₦12,500</span>
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        <CheckCheck className="size-[15px] shrink-0 text-success" />
        <span className="text-[13px] text-success">matched by reference, verified against Nomba</span>
      </div>
    </div>
  );
}

function SplitDiagram() {
  return (
    <div className={cn(visualShell, "flex flex-col items-center gap-2.5 p-6")}>
      <span className="rounded-[8px] border border-border bg-surface-2 px-4 py-2.5 font-mono text-[12.5px] text-muted-foreground">
        1 charge · ₦12,500
      </span>
      <span className="text-base text-subtle-foreground">↓</span>
      <span className="rounded-[8px] border border-accent-border bg-accent-muted px-4 py-2.5 font-mono text-[12.5px] text-accent">
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
  );
}

// ── Stage row (.pen 01–05 Rows) ────────────────────────────────────────────
interface Stage {
  n: string;
  title: string;
  problem: string;
  solution: string;
  guide: { label: string; href: string };
  visual: React.ReactNode;
  flip?: boolean; // visual on the left (even stages)
}

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Subscribe.",
    problem:
      "The first question is always which rail. Cards get an OTP, transfers can't be pulled, mandates take a day to activate.",
    solution:
      "One subscription object holds them all. Nomba One charges the rail your customer can actually use, and falls back automatically when one can't.",
    guide: { label: "One subscription, three rails", href: "/integrations" },
    visual: <CodeBlock tabs={STAGE1_TABS} />,
  },
  {
    n: "02",
    title: "Bill.",
    problem:
      "A billing job that crashes two-thirds of the way through, then restarts, will charge some customers twice.",
    solution:
      "The scheduler is replay-safe. A unique key on the subscription and period means a crash resolves to exactly one charge, every time.",
    guide: { label: "The double-charge bug", href: "/guides/the-double-charge-bug" },
    visual: <IdempotencyPanel />,
    flip: true,
  },
  {
    n: "03",
    title: "Recover.",
    problem:
      "Thin balances and bank OTP step-ups sink the naive retry-then-cancel. Most of the churn here is involuntary.",
    solution:
      "Dunning branches on why a charge failed, biases retries toward payday, and when a bank forces OTP it sends the customer a one-tap link to finish. The renewal still lands.",
    guide: { label: "Dunning for thin balances", href: "/guides/dunning-for-thin-balances" },
    visual: <DunningTimeline />,
  },
  {
    n: "04",
    title: "Reconcile.",
    problem:
      "Bank transfers can't be pulled. The money arrives on its own schedule, and it still has to find the right invoice.",
    solution:
      "Every inbound transfer is verified, re-queried against Nomba, and matched by reference to the invoice it settles. Drift is surfaced, never silent.",
    guide: {
      label: "Push vs pull: transfers",
      href: "/guides/bank-transfer-is-not-just-another-method",
    },
    visual: <MatchPanel />,
    flip: true,
  },
  {
    n: "05",
    title: "Settle.",
    problem:
      "A platform collects one charge that belongs to many tenants, and each of them needs paying out.",
    solution:
      "Funds split at the point of collection and settle into each tenant's own sub-account. No spreadsheets, no manual payouts.",
    guide: {
      label: "Settlement without spreadsheets",
      href: "/guides/settlement-without-spreadsheets",
    },
    visual: <SplitDiagram />,
  },
];

function StageRow({ stage }: { stage: Stage }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-16 lg:items-center",
        stage.flip ? "lg:flex-row-reverse" : "lg:flex-row"
      )}
    >
      <div className="flex flex-1 flex-col gap-4">
        <span className="font-mono text-[15px] text-accent">{stage.n}</span>
        <h2 className="text-[36px] font-semibold tracking-[-1.2px] text-foreground">{stage.title}</h2>
        <p className="text-[19px] leading-[1.6] text-muted-foreground">{stage.problem}</p>
        <p className="text-[19px] leading-[1.6] text-foreground">{stage.solution}</p>
        <Link
          href={stage.guide.href}
          className="inline-flex items-center gap-1.5 pt-2 text-[15px] font-medium text-accent hover:underline"
        >
          {stage.guide.label} →
        </Link>
      </div>
      <div className="flex w-full justify-center lg:w-auto">{stage.visual}</div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <>
      <PageHeader
        title="Every renewal, from signup to settlement."
        deck="One subscription object runs the whole recurring-billing lifecycle. Here is each stage, the hard problem inside it, and how Nomba One handles it."
      />

      {/* Lifecycle overview */}
      <Container className="pb-14 md:pb-[88px] pt-10">
        <LifecycleRail />
      </Container>

      {/* Five stages */}
      {STAGES.map((stage) => (
        <Container key={stage.n} className="py-14 md:py-[88px]">
          <StageRow stage={stage} />
        </Container>
      ))}

      {/* Trust */}
      <Container className="py-14 md:py-[88px]">
        <GuaranteeBand />
      </Container>

      {/* CTA */}
      <Container className="pb-20 md:pb-[120px] pt-14 md:pt-[88px]">
        <CTABand
          title="Start with a request, not a sales call."
          primary={{ label: "Get an API key", href: "https://app.nombaone.xyz" }}
          secondary={{ label: "Read the quickstart", href: "/guides" }}
          npm="npm i nomba-one"
          talk={{ label: "or talk to us →", href: "/trust" }}
        />
      </Container>
    </>
  );
}
