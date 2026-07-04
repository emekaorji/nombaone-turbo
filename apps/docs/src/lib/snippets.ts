/**
 * The buffet snippet engine (Phase 03). Given an API call — method, path, and an
 * optional JSON body — it emits idiomatic request code in several languages, so
 * the docs can answer "can I use this with X?" in X, from one source of truth
 * instead of hand-maintained per-language strings that drift.
 *
 * Pure and dependency-free. The base URL and key placeholder are the sandbox
 * defaults used across the docs.
 */

export const SNIPPET_LANGS = ["curl", "node", "python", "go", "php", "ruby"] as const;
export type SnippetLang = (typeof SNIPPET_LANGS)[number];

export const LANG_LABEL: Record<SnippetLang, string> = {
  curl: "cURL",
  node: "Node.js",
  python: "Python",
  go: "Go",
  php: "PHP",
  ruby: "Ruby",
};

const BASE = "https://sandbox.api.nombaone.xyz";
const KEY = "nbo_sandbox_…";

export interface SnippetInput {
  method: string;
  /** Path beginning with `/v1/…`. */
  path: string;
  /** Optional request body (rendered as JSON). */
  body?: Record<string, unknown>;
  /** Whether this call takes an Idempotency-Key (money-moving POSTs). */
  idempotent?: boolean;
}

function jsonLines(body: Record<string, unknown>, indent: string): string {
  return JSON.stringify(body, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : indent + l))
    .join("\n");
}

function curl({ method, path, body, idempotent }: SnippetInput): string {
  const m = method.toUpperCase();
  const lines = [`curl -X ${m} ${BASE}${path} \\`, `  -H "Authorization: Bearer ${KEY}"`];
  if (body) lines[lines.length - 1] += ` \\`, lines.push(`  -H "Content-Type: application/json"`);
  if (idempotent) lines[lines.length - 1] += ` \\`, lines.push(`  -H "Idempotency-Key: $(uuidgen)"`);
  if (body) {
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }
  return lines.join("\n");
}

function node({ method, path, body, idempotent }: SnippetInput): string {
  const headers = [`    Authorization: \`Bearer \${process.env.NOMBAONE_SECRET_KEY}\`,`];
  if (body) headers.push(`    "Content-Type": "application/json",`);
  if (idempotent) headers.push(`    "Idempotency-Key": crypto.randomUUID(),`);
  const init = [
    `  method: "${method.toUpperCase()}",`,
    `  headers: {`,
    ...headers,
    `  },`,
  ];
  if (body) init.push(`  body: JSON.stringify(${jsonLines(body, "  ")}),`);
  return [
    `const res = await fetch("${BASE}${path}", {`,
    ...init,
    `});`,
    `const data = await res.json();`,
  ].join("\n");
}

function python({ method, path, body, idempotent }: SnippetInput): string {
  const headers = [`    "Authorization": f"Bearer {NOMBAONE_SECRET_KEY}",`];
  if (idempotent) headers.push(`    "Idempotency-Key": str(uuid.uuid4()),`);
  const args = [`    headers={`, ...headers, `    },`];
  if (body) args.push(`    json=${jsonLines(body, "    ").replace(/"([^"]+)":/g, '"$1":')},`);
  return [
    `import requests`,
    ``,
    `res = requests.${method.toLowerCase()}(`,
    `    "${BASE}${path}",`,
    ...args,
    `)`,
    `data = res.json()`,
  ].join("\n");
}

function go({ method, path, body, idempotent }: SnippetInput): string {
  const m = method.toUpperCase();
  const lines: string[] = [];
  if (body) {
    lines.push(`payload := []byte(\`${JSON.stringify(body)}\`)`);
    lines.push(`req, _ := http.NewRequest("${m}", "${BASE}${path}", bytes.NewBuffer(payload))`);
  } else {
    lines.push(`req, _ := http.NewRequest("${m}", "${BASE}${path}", nil)`);
  }
  lines.push(`req.Header.Set("Authorization", "Bearer "+os.Getenv("NOMBAONE_SECRET_KEY"))`);
  if (body) lines.push(`req.Header.Set("Content-Type", "application/json")`);
  if (idempotent) lines.push(`req.Header.Set("Idempotency-Key", uuid.NewString())`);
  lines.push(`res, _ := http.DefaultClient.Do(req)`);
  return lines.join("\n");
}

function php({ method, path, body, idempotent }: SnippetInput): string {
  const headers = [`  "Authorization: Bearer " . getenv("NOMBAONE_SECRET_KEY"),`];
  if (body) headers.push(`  "Content-Type: application/json",`);
  if (idempotent) headers.push(`  "Idempotency-Key: " . bin2hex(random_bytes(16)),`);
  const lines = [
    `<?php`,
    `$ch = curl_init("${BASE}${path}");`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method.toUpperCase()}");`,
    `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
    `curl_setopt($ch, CURLOPT_HTTPHEADER, [`,
    ...headers,
    `]);`,
  ];
  if (body) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, '${JSON.stringify(body)}');`);
  lines.push(`$data = json_decode(curl_exec($ch), true);`);
  return lines.join("\n");
}

function ruby({ method, path, body, idempotent }: SnippetInput): string {
  const m = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  const lines = [
    `require "net/http"`,
    `require "json"`,
    ``,
    `uri = URI("${BASE}${path}")`,
    `req = Net::HTTP::${m}.new(uri)`,
    `req["Authorization"] = "Bearer #{ENV['NOMBAONE_SECRET_KEY']}"`,
  ];
  if (body) {
    lines.push(`req["Content-Type"] = "application/json"`);
    if (idempotent) lines.push(`req["Idempotency-Key"] = SecureRandom.uuid`);
    lines.push(`req.body = ${JSON.stringify(JSON.stringify(body))}`);
  } else if (idempotent) {
    lines.push(`req["Idempotency-Key"] = SecureRandom.uuid`);
  }
  lines.push(`res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }`);
  lines.push(`data = JSON.parse(res.body)`);
  return lines.join("\n");
}

const GENERATORS: Record<SnippetLang, (i: SnippetInput) => string> = {
  curl,
  node,
  python,
  go,
  php,
  ruby,
};

/** Build every language's snippet for one call. */
export function buildSnippets(input: SnippetInput): Record<SnippetLang, string> {
  return {
    curl: GENERATORS.curl(input),
    node: GENERATORS.node(input),
    python: GENERATORS.python(input),
    go: GENERATORS.go(input),
    php: GENERATORS.php(input),
    ruby: GENERATORS.ruby(input),
  };
}

/** The Shiki language id for a snippet tab. */
export const LANG_GRAMMAR: Record<SnippetLang, string> = {
  curl: "bash",
  node: "ts",
  python: "python",
  go: "go",
  php: "php",
  ruby: "ruby",
};
