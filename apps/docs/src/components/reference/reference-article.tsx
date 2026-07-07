import Link from "next/link";

import { API_INFO, getApiResources, type ApiOperation, type ApiResource } from "@/lib/api-ref/model";
import type { ApiRefMatch } from "@/lib/api-ref/routing";

import { ApiOperationView } from "./api-operation";

/**
 * Renders the three shapes of the disintegrated reference — the index, a
 * resource overview, and a single operation — inside the docs content column.
 * Every resource gets an overview plus a page per operation, so no page ever
 * packs a whole module's requests together.
 */

const METHOD_CHIP: Record<string, string> = {
  get: "text-sky-500 dark:text-sky-400",
  post: "text-emerald-500 dark:text-emerald-400",
  patch: "text-amber-500 dark:text-amber-400",
  put: "text-amber-500 dark:text-amber-400",
  delete: "text-red-500 dark:text-red-400",
};

function MethodChip({ method }: { method: string }) {
  return (
    <span className={`w-14 shrink-0 font-mono text-[11px] font-bold uppercase ${METHOD_CHIP[method] ?? "text-muted-foreground"}`}>
      {method}
    </span>
  );
}

function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="not-prose mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {trail.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-muted-foreground/50">/</span>}
          {c.href ? (
            <Link href={c.href} className="transition-colors hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function OperationList({ resource }: { resource: ApiResource }) {
  return (
    <ul className="not-prose mt-6 divide-y divide-border/60 rounded-lg border border-border">
      {resource.operations.map((op) => (
        <li key={op.slug}>
          <Link
            href={`/reference/${resource.slug}/${op.slug}`}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <MethodChip method={op.method} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{op.title}</span>
              <code className="block truncate font-mono text-xs text-muted-foreground">{op.path}</code>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function IndexView() {
  const resources = getApiResources();
  return (
    <>
      <header className="mb-2">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-tight text-foreground">API reference</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          The {API_INFO.title} ({API_INFO.version}). Every resource and operation, with copy-runnable
          samples in cURL and all nine SDKs. Money is always integer kobo.
        </p>
      </header>
      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
        {resources.map((r) => (
          <Link
            key={r.slug}
            href={`/reference/${r.slug}`}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-[--accent]/40"
          >
            <span className="text-sm font-semibold text-foreground">{r.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {r.operations.length} operation{r.operations.length === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

function ResourceView({ resource }: { resource: ApiResource }) {
  return (
    <>
      <Crumbs trail={[{ label: "API reference", href: "/reference" }, { label: resource.title }]} />
      <header className="mb-2">
        <h1 className="text-[32px] font-bold leading-[40px] tracking-tight text-foreground">{resource.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Every operation on the {resource.title.toLowerCase()} resource. Pick one for its request and
          response shapes and a copy-runnable sample in every SDK.
        </p>
      </header>
      <OperationList resource={resource} />
    </>
  );
}

function OperationPage({ resource, operation }: { resource: ApiResource; operation: ApiOperation }) {
  return (
    <>
      <Crumbs
        trail={[
          { label: "API reference", href: "/reference" },
          { label: resource.title, href: `/reference/${resource.slug}` },
          { label: operation.title },
        ]}
      />
      <header className="mb-2">
        <h1 className="text-[30px] font-bold leading-[38px] tracking-tight text-foreground">{operation.title}</h1>
      </header>
      <ApiOperationView op={operation} />
    </>
  );
}

export function ReferenceArticle({ match }: { match: ApiRefMatch }) {
  return (
    <main id="content" tabIndex={-1} className="min-w-0 flex-1 px-5 py-8 outline-none lg:px-10 xl:px-12">
      <article className="mx-auto w-full max-w-(--doc-shell-max)">
        {match.kind === "index" && <IndexView />}
        {match.kind === "resource" && <ResourceView resource={match.resource} />}
        {match.kind === "operation" && (
          <OperationPage resource={match.resource} operation={match.operation} />
        )}
      </article>
    </main>
  );
}
