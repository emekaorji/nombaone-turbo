import { CheckCheck, ImageIcon, Plus } from "lucide-react";

import { AskModal } from "@/components/sections/AskModal";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "The Hall",
  description:
    "Every hard question builders have hit on Nomba One, answered in the open by the team — real questions, real code, real answers.",
};

const FILTERS = ["All", "Rails", "Dunning", "Reconciliation", "Multi-tenant", "Migration"];

interface QA {
  handle: string;
  initials: string;
  tag: string;
  question: string;
  code?: string[];
  image?: string;
  answer: string;
}

// 1:1 with the .pen Hall gallery (bhynr) — three masonry columns.
const CARDS: QA[] = [
  {
    handle: "@midnight_debugger",
    initials: "MD",
    tag: "Rails",
    question:
      "My tokenized card recharge keeps returning an OTP challenge. How do I complete a recurring charge when the bank forces 3-D Secure?",
    code: ['{ "event": "invoice.action_required",', '  "link": "checkout.nombaone.xyz/…" }'],
    answer:
      "You don't force it headless. Dunning emits invoice.action_required with a one-tap checkout link, the customer completes OTP, and that settles the same invoice. Card is best-effort; direct debit is the silent rail.",
  },
  {
    handle: "vibecheck_vic",
    initials: "VV",
    tag: "Multi-tenant",
    question: "Can one tenant ever read another tenant's subscriptions?",
    answer:
      "No. Isolation is a property of the schema: every row carries organization_id and every query is scoped. It is not a middleware check you can forget to add.",
  },
  {
    handle: "naira_nerd",
    initials: "NN",
    tag: "Reconciliation",
    question: "How do I know a webhook is real before I move any money?",
    answer:
      "Two-step verify. The signature is checked, then the event is re-queried against Nomba by transaction id before a single ledger entry is written.",
  },
  {
    handle: "ships_at_3am",
    initials: "SA",
    tag: "Dunning",
    question: "What retry schedule actually recovers charges in Nigeria?",
    answer:
      "Payday-timed, reason-branched retries. A fixed schedule misses payday, which is exactly when a thin balance refills.",
  },
  {
    handle: "404_bestie",
    initials: "4B",
    tag: "Migration",
    question: "Coming from Stripe Billing. Which concepts break?",
    code: [
      "price = immutable, versioned",
      "proration = ledger, not formula",
      "rail = 'card' | 'mandate' | 'transfer'",
    ],
    answer:
      "Prices are immutable and versioned, proration is a ledger not a formula, and rails are plural. The migration guide maps each concept one to one.",
  },
  {
    handle: "prod_goblin",
    initials: "PG",
    tag: "Dunning",
    question: "A customer's card expired mid-subscription. Do I retry?",
    answer:
      "No blind retry, that wastes the window. We emit card.update_requested and route a one-tap link. The renewal lands once they update the card.",
  },
  {
    handle: "kudi_gremlin",
    initials: "KG",
    tag: "Reconciliation",
    question: "A parent paid ₦140k against a ₦150k invoice. What happens to the difference?",
    image: "transfer_receipt.png",
    answer:
      "The transfer is matched by reference and the invoice moves to partially_collected. A reminder nudges the balance. Nothing is lost, nothing double-counts.",
  },
  {
    handle: "sudo_sana",
    initials: "SS",
    tag: "Rails",
    question: "Direct debit or card for a monthly gym membership?",
    answer:
      "Direct debit. It is the silent rail: a NIBSS mandate pulls monthly with no OTP and no per-cycle action from the member.",
  },
];

function QACard({ card }: { card: QA }) {
  return (
    <div className="mb-5 flex break-inside-avoid flex-col gap-3.5 rounded-[14px] border border-border bg-surface-1 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-[26px] items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] font-semibold text-muted-foreground">
          {card.initials}
        </span>
        <span className="font-mono text-[13px] text-foreground">{card.handle}</span>
        <span className="ml-auto rounded-full border border-border bg-surface-2 px-[9px] py-1 font-mono text-[10.5px] text-subtle-foreground">
          {card.tag}
        </span>
      </div>

      <p className="text-[16.5px] leading-[1.5] text-foreground">{card.question}</p>

      {card.code ? (
        <div className="overflow-x-auto rounded-[8px] border border-border bg-surface-2 p-3.5">
          {card.code.map((line, i) => (
            <pre key={i} className="whitespace-pre font-mono text-[12px] text-muted-foreground">
              {line}
            </pre>
          ))}
        </div>
      ) : null}

      {card.image ? (
        <div className="flex h-[132px] items-center justify-center gap-2 rounded-[8px] border border-border bg-surface-2">
          <ImageIcon className="size-5 text-subtle-foreground" />
          <span className="font-mono text-[12px] text-subtle-foreground">{card.image}</span>
        </div>
      ) : null}

      <div className="h-px bg-border" />

      <div className="flex items-center gap-[7px]">
        <CheckCheck className="size-[15px] text-accent" />
        <span className="text-[13px] font-medium text-accent">Nomba One team</span>
      </div>
      <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{card.answer}</p>
    </div>
  );
}

export default function HallPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-5">
      {/* Masthead */}
      <div className="flex flex-col items-center pb-12 pt-24 text-center md:pt-[120px]">
        <h1 className="text-[56px] font-semibold leading-none tracking-[-2.5px] text-foreground md:text-[108px] md:tracking-[-5px]">
          The Hall.
        </h1>
        <p className="mt-6 max-w-[720px] text-lg leading-[1.5] text-muted-foreground md:text-[23px]">
          Every hard question builders have hit on Nomba One, answered in the open. Real questions,
          real code, real answers. Curated, never careless.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-[15px] py-[9px]">
            <span className="size-[7px] rounded-full bg-accent" />
            <span className="font-mono text-[13px] text-muted-foreground">1,204 answered, in public</span>
          </span>
          <AskModal>
            <button className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-[11px] text-[15px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
              <Plus className="size-4" /> Add your question
            </button>
          </AskModal>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-2.5 pb-11">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium",
              i === 0
                ? "border border-accent-border bg-accent-muted text-accent"
                : "border border-border bg-surface-1 text-muted-foreground"
            )}
          >
            {f}
          </span>
        ))}
      </div>

      {/* Gallery masonry */}
      <div className="columns-1 gap-5 pb-[100px] md:columns-2 lg:columns-3">
        {CARDS.map((card) => (
          <QACard key={card.handle} card={card} />
        ))}
      </div>
    </div>
  );
}
