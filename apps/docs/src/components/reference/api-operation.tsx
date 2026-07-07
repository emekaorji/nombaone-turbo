import { HighlightedCode } from "@/components/mdx/highlighted-code";
import { typeLabel, type ApiField, type ApiOperation, type ApiParam, type Schema } from "@/lib/api-ref/model";
import { requestExample, responseExample } from "@/lib/api-ref/samples";
import { buildOperationSnippets, LANG_GRAMMAR, LANG_LABEL, SNIPPET_LANGS } from "@/lib/api-ref/snippets";

import { CodeTabs, type CodeSample } from "./code-tabs";

/**
 * A single API operation, rendered from the OpenAPI model: the method + path,
 * auth, path/query params, request-body fields, code samples in every SDK, and
 * responses with a generated example body. Nothing hand-typed — a schema change
 * regenerates the snapshot and this page.
 */

const METHOD_COLOR: Record<string, string> = {
  get: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  post: "text-[--accent] border-[--accent]/30 bg-[--accent]/10",
  patch: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  put: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  delete: "text-red-400 border-red-400/30 bg-red-400/10",
};

function MethodPath({ op }: { op: ApiOperation }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span
        className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold uppercase ${METHOD_COLOR[op.method] ?? ""}`}
      >
        {op.method}
      </span>
      <code className="font-mono text-sm text-foreground">{op.path}</code>
      {op.requiresAuth && (
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          🔒 Secret key
        </span>
      )}
    </div>
  );
}

function FieldTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; type: string; required: boolean; note?: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="not-prose mt-6">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="mt-2 divide-y divide-border/60 rounded-lg border border-border">
        {rows.map((r) => (
          <div key={r.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2">
            <code className="font-mono text-sm text-foreground">{r.name}</code>
            <code className="font-mono text-xs text-muted-foreground">{r.type}</code>
            {r.required ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[--accent]">required</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">optional</span>
            )}
            {r.note && <span className="w-full text-xs text-muted-foreground">{r.note}</span>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function paramRows(params: ApiParam[]) {
  return params.map((p) => ({ name: p.name, type: p.type, required: p.required, note: p.description }));
}
function fieldRows(fields: ApiField[]) {
  return fields.map((f) => ({ name: f.name, type: f.type, required: f.required, note: f.description }));
}

function successResponse(op: ApiOperation): { status: string; schema?: Schema } | undefined {
  const ok = op.responses.find((r) => /^2/.test(r.status));
  return ok ? { status: ok.status, schema: ok.schema } : undefined;
}

export function ApiOperationView({ op }: { op: ApiOperation }) {
  const snippets = buildOperationSnippets(op);
  const samples: CodeSample[] = SNIPPET_LANGS.map((lang) => ({
    lang,
    label: LANG_LABEL[lang],
    grammar: LANG_GRAMMAR[lang],
    code: snippets[lang],
  }));

  const reqExample = requestExample(op.bodySchema);
  const ok = successResponse(op);
  const okExample = ok ? responseExample(ok.schema) : undefined;

  return (
    <div className="not-prose">
      <MethodPath op={op} />

      <CodeTabs samples={samples} />

      <FieldTable title="Path parameters" rows={paramRows(op.pathParams)} />
      <FieldTable title="Query parameters" rows={paramRows(op.queryParams)} />
      <FieldTable title="Request body" rows={fieldRows(op.bodyFields)} />

      {reqExample && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">Example request body</h3>
          <HighlightedCode code={JSON.stringify(reqExample, null, 2)} lang="json" />
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">Responses</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {op.responses.map((r) => (
            <span
              key={r.status}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1"
            >
              <code className="font-mono text-xs font-semibold text-foreground">
                {r.status === "default" ? "4xx / 5xx" : r.status}
              </code>
              {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
            </span>
          ))}
        </div>
        {okExample !== undefined && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Example response{ok ? ` (${ok.status})` : ""}
            </p>
            <HighlightedCode code={JSON.stringify(okExample, null, 2)} lang="json" />
          </div>
        )}
      </section>
    </div>
  );
}

/** Re-export so pages can label the type column consistently. */
export { typeLabel };
