import Link from "next/link";

import { Logo } from "./Logo";

const DOCS_URL = "https://docs.nombaone.xyz";
const STATUS_URL = "https://status.nombaone.xyz";

type FooterLink = { label: string; href: string; arrow?: boolean; external?: boolean };
type FooterColumn = { heading: string; links: FooterLink[] };

// Columns, headings, and link labels are 1:1 with the .pen Footer (oAlcJ).
const COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "The lifecycle", href: "/product" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "Trust & security", href: "/trust" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "Docs", href: DOCS_URL, arrow: true, external: true },
      { label: "API reference", href: `${DOCS_URL}/api`, arrow: true, external: true },
      { label: "SDKs", href: `${DOCS_URL}/sdks`, external: true },
      { label: "CLI", href: `${DOCS_URL}/cli`, external: true },
      { label: "Status", href: STATUS_URL, arrow: true, external: true },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { label: "SaaS", href: "/use-cases" },
      { label: "School fees", href: "/use-cases/school-fees" },
      { label: "Gyms & memberships", href: "/use-cases" },
      { label: "Lending repayment", href: "/use-cases" },
      { label: "Platforms", href: "/use-cases" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/trust" },
      { label: "Guides", href: "/guides" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy · NDPR", href: "#" },
      { label: "DPA", href: "#" },
      { label: "Security", href: "/trust" },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className = "text-[13.5px] text-muted-foreground transition-colors hover:text-foreground";
  const label = link.arrow ? `${link.label} ↗` : link.label;
  return link.external ? (
    <a href={link.href} target="_blank" rel="noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      {/* Columns */}
      <div className="flex flex-col gap-12 px-6 py-12 md:flex-row md:justify-between md:px-[60px]">
        {/* Brand column */}
        <div className="flex w-full flex-col gap-3.5 md:w-60">
          <Logo />
          <p className="max-w-[210px] text-[13.5px] leading-[1.5] text-muted-foreground">
            The subscriptions layer for Nomba, built for how Nigeria pays.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading} className="flex flex-col gap-3.5">
            <span className="font-mono text-[11.5px] tracking-[0.5px] text-subtle-foreground">
              {col.heading}
            </span>
            <div className="flex flex-col gap-2.5">
              {col.links.map((link) => (
                <FooterLinkItem key={link.label} link={link} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col gap-4 border-t border-border px-6 py-5 md:flex-row md:items-center md:justify-between md:px-[60px]">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-[7px] rounded-full bg-[var(--success-bg)] px-[11px] py-1">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="text-[12.5px] font-medium text-success">All systems operational</span>
          </span>
          <span className="text-[12.5px] text-subtle-foreground">© 2026 Nomba One</span>
        </div>
        <span className="font-mono text-[12px] text-subtle-foreground">
          Built for how Nigeria pays.
        </span>
      </div>
    </footer>
  );
}
