import openapi from "@/generated/openapi.json";

/**
 * Per-resource API reference (Phase 08), rendered directly from the committed
 * OpenAPI snapshot (`src/generated/openapi.json`, produced by the API's
 * `gen:openapi` script). Like the error and event catalogs, this is drift-proof:
 * every operation shown is one the API actually serves, and a schema change
 * regenerates the snapshot and updates the page. Nothing here is hand-typed.
 *
 * Usage in MDX: `<ApiReference resource="customers" />` renders every operation
 * whose path segment after `/v1/` is `customers`. Pure server component.
 */

type Schema = {
  type?: string;
  $ref?: string;
  enum?: string[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
};
type Operation = {
  summary?: string;
  description?: string;
  parameters?: { name: string; in: string; required?: boolean; schema?: Schema }[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, unknown>;
  security?: unknown;
};

const spec = openapi as unknown as {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

const METHOD_ORDER = ["get", "post", "patch", "put", "delete"];
const METHOD_COLOR: Record<string, string> = {
  get: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  post: "text-[--accent] border-[--accent]/30 bg-[--accent]/10",
  patch: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  put: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  delete: "text-red-400 border-red-400/30 bg-red-400/10",
};

/** The resource a path belongs to = its first segment after `/v1/`. */
function pathResource(path: string): string {
  return path.replace(/^\/v1\//, "").split("/")[0] ?? "";
}

function resolve(schema?: Schema): Schema | undefined {
  if (!schema) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop()!;
    return spec.components?.schemas?.[name] ?? schema;
  }
  return schema;
}

function typeLabel(schema?: Schema): string {
  const s = resolve(schema);
  if (!s) return "—";
  if (s.enum) return s.enum.map((e) => `"${e}"`).join(" | ");
  if (s.type === "array") return `${typeLabel(s.items)}[]`;
  return s.type ?? "object";
}

function anchor(method: string, path: string): string {
  return `${method}-${path.replace(/^\/v1\//, "").replace(/[^a-z0-9]+/gi, "-")}`.toLowerCase();
}

function FieldRow({
  name,
  type,
  required,
  note,
}: {
  name: string;
  type: string;
  required?: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-border/60 py-1.5 first:border-t-0">
      <code className="font-mono text-sm text-foreground">{name}</code>
      <code className="font-mono text-xs text-muted-foreground">{type}</code>
      {required ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[--accent]">required</span>
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">optional</span>
      )}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

function OperationBlock({ method, path, op }: { method: string; path: string; op: Operation }) {
  const params = op.parameters ?? [];
  const body = resolve(op.requestBody?.content?.["application/json"]?.schema);
  const bodyRequired = new Set(body?.required ?? []);
  const responses = Object.keys(op.responses ?? {});

  return (
    <section id={anchor(method, path)} className="scroll-mt-24 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold uppercase ${METHOD_COLOR[method] ?? ""}`}
        >
          {method}
        </span>
        <code className="font-mono text-sm text-foreground">{path}</code>
        {op.security ? (
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
            🔒 secret key
          </span>
        ) : null}
      </div>

      {params.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parameters</p>
          <div className="mt-1">
            {params.map((p) => (
              <FieldRow
                key={`${p.in}-${p.name}`}
                name={p.name}
                type={typeLabel(p.schema)}
                required={p.required}
                note={`in ${p.in}`}
              />
            ))}
          </div>
        </div>
      )}

      {body?.properties && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request body</p>
          <div className="mt-1">
            {Object.entries(body.properties).map(([name, schema]) => (
              <FieldRow
                key={name}
                name={name}
                type={typeLabel(schema)}
                required={bodyRequired.has(name)}
              />
            ))}
          </div>
        </div>
      )}

      {responses.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responses</p>
          {responses.map((code) => (
            <code key={code} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {code}
            </code>
          ))}
        </div>
      )}
    </section>
  );
}

export function ApiReference({ resource }: { resource: string }) {
  const ops: { method: string; path: string; op: Operation }[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    if (pathResource(path) !== resource) continue;
    for (const [method, op] of Object.entries(methods)) {
      ops.push({ method, path, op });
    }
  }

  ops.sort((a, b) => {
    if (a.path !== b.path) return a.path.length - b.path.length || a.path.localeCompare(b.path);
    return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
  });

  if (ops.length === 0) {
    return (
      <p className="not-prose my-6 text-sm text-muted-foreground">
        No operations found for <code className="font-mono">{resource}</code>.
      </p>
    );
  }

  return (
    <div className="not-prose my-8 space-y-4">
      {ops.map(({ method, path, op }) => (
        <OperationBlock key={`${method} ${path}`} method={method} path={path} op={op} />
      ))}
    </div>
  );
}
