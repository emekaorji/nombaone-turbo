"use client";

import { useState } from "react";
import { Check, Copy, Download, FileArchive, Github, type LucideIcon, Terminal } from "lucide-react";

import { BrandIcon } from "@/components/brand-icons";
import { cn } from "@/lib/utils";
import { type Line, type Seg, segColor } from "./code-tokens";

// ── Lightweight multi-language highlighter ─────────────────────────────────
const KEYWORDS = new Set([
  "import", "from", "export", "default", "const", "let", "var", "new", "await",
  "async", "function", "return", "class", "public", "private", "protected",
  "static", "void", "use", "require", "func", "package", "fn", "def", "val",
  "this", "self", "type", "interface", "struct", "enum", "impl", "mut", "pub",
  "module", "end", "defmodule", "do", "render", "namespace", "using", "serve",
]);
const TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|#[^\n]*)|([A-Za-z_$][\w$]*)|(\s+|[^\sA-Za-z_$"'`]+)/g;

function highlight(code: string, hashComments: boolean): Line[] {
  return code.split("\n").map((raw) => {
    if (raw.trim() === "") return null;
    const segs: Seg[] = [];
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(raw))) {
      if (m[1]) segs.push({ t: m[1], c: "str" });
      else if (m[2]) {
        // Only treat # as a comment for shell/ruby/python/elixir contexts.
        if (m[2].startsWith("#") && !hashComments) segs.push({ t: m[2] });
        else segs.push({ t: m[2], c: "com" });
      } else if (m[3]) segs.push({ t: m[3], c: KEYWORDS.has(m[3]) ? "kw" : undefined });
      else segs.push({ t: m[4]! });
    }
    return segs;
  });
}

// ── Data model ─────────────────────────────────────────────────────────────
type IconRef = string | LucideIcon; // brand-icon slug OR a lucide component
type FW = { label: string; icon: IconRef; code: string; hash?: boolean };
type Lang = { label: string; icon: IconRef; frameworks: FW[] };

function Glyph({ icon, className }: { icon: IconRef; className?: string }) {
  if (typeof icon === "string") return <BrandIcon slug={icon} className={className} />;
  const Ic = icon;
  return <Ic className={className} strokeWidth={1.75} />;
}

// Shared SDK snippets keep the file readable.
const NODE_SDK = `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

await nomba.subscriptions.create({
  customer: 'cus_8821',
  plan: 'plan_pro',
  rail: 'auto',
});`;

const LANGS: Lang[] = [
  {
    label: "Node.js",
    icon: "nodedotjs",
    frameworks: [
      { label: "Node.js", icon: "nodedotjs", code: NODE_SDK },
      {
        label: "Next.js",
        icon: "nextdotjs",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

export async function POST(req: Request) {
  const { customer } = await req.json();
  const sub = await nomba.subscriptions.create({
    customer, plan: 'plan_pro', rail: 'auto',
  });
  return Response.json(sub);
}`,
      },
      {
        label: "Remix",
        icon: "remix",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

export async function action({ request }) {
  const form = await request.formData();
  return nomba.subscriptions.create({
    customer: form.get('customer'), plan: 'plan_pro', rail: 'auto',
  });
}`,
      },
      {
        label: "Nuxt",
        icon: "nuxtdotjs",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

export default defineEventHandler(async (event) => {
  const { customer } = await readBody(event);
  return nomba.subscriptions.create({
    customer, plan: 'plan_pro', rail: 'auto',
  });
});`,
      },
      {
        label: "Express",
        icon: "express",
        code: `const { Nomba } = require('nomba-one');

const nomba = new Nomba(process.env.NOMBA_KEY);

app.post('/subscribe', async (req, res) => {
  const sub = await nomba.subscriptions.create({
    customer: req.body.customer, plan: 'plan_pro', rail: 'auto',
  });
  res.json(sub);
});`,
      },
      {
        label: "Hono",
        icon: "hono",
        code: `import { Hono } from 'hono';
import { Nomba } from 'nomba-one';

const app = new Hono();
const nomba = new Nomba(process.env.NOMBA_KEY);

app.post('/subscribe', async (c) => {
  const { customer } = await c.req.json();
  return c.json(await nomba.subscriptions.create({
    customer, plan: 'plan_pro', rail: 'auto',
  }));
});`,
      },
      {
        label: "Redwood",
        icon: "redwoodjs",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

export const handler = async (event) => {
  const { customer } = JSON.parse(event.body);
  const sub = await nomba.subscriptions.create({
    customer, plan: 'plan_pro', rail: 'auto',
  });
  return { statusCode: 200, body: JSON.stringify(sub) };
};`,
      },
      {
        label: "Bun",
        icon: "bun",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

Bun.serve({
  port: 3000,
  async fetch(req) {
    const { customer } = await req.json();
    return Response.json(await nomba.subscriptions.create({
      customer, plan: 'plan_pro', rail: 'auto',
    }));
  },
});`,
      },
      {
        label: "Astro",
        icon: "astro",
        code: `import type { APIRoute } from 'astro';
import { Nomba } from 'nomba-one';

const nomba = new Nomba(import.meta.env.NOMBA_KEY);

export const POST: APIRoute = async ({ request }) => {
  const { customer } = await request.json();
  const sub = await nomba.subscriptions.create({
    customer, plan: 'plan_pro', rail: 'auto',
  });
  return new Response(JSON.stringify(sub));
};`,
      },
    ],
  },
  {
    label: "Serverless",
    icon: "serverless",
    frameworks: [
      {
        label: "Vercel Functions",
        icon: "vercel",
        code: `const NOMBA_KEY = process.env.NOMBA_KEY;

export async function POST(req) {
  const { customer } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${NOMBA_KEY}\`,
    },
    body: JSON.stringify({ customer, plan: 'plan_pro', rail: 'auto' }),
  });

  if (res.ok) {
    return Response.json(await res.json());
  }
}`,
      },
      {
        label: "Supabase Edge Functions",
        icon: "supabase",
        code: `import { serve } from 'https://deno.land/std/http/server.ts';

const NOMBA_KEY = Deno.env.get('NOMBA_KEY');

serve(async (req: Request): Promise<Response> => {
  const { customer } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBA_KEY}\`,
    },
    body: JSON.stringify({ customer, plan: 'plan_pro', rail: 'auto' }),
  });

  return new Response(await res.text(), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});`,
      },
      {
        label: "Deno",
        icon: "deno",
        code: `import { serve } from 'https://deno.land/std/http/server.ts';

const NOMBA_KEY = Deno.env.get('NOMBA_KEY');

serve(async (req: Request): Promise<Response> => {
  const { customer } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBA_KEY}\`,
    },
    body: JSON.stringify({ customer, plan: 'plan_pro', rail: 'auto' }),
  });

  return new Response(await res.text(), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
      },
      {
        label: "Cloudflare Workers",
        icon: "cloudflareworkers",
        code: `import { Nomba } from 'nomba-one';

export default {
  async fetch(request, env) {
    const nomba = new Nomba(env.NOMBA_KEY);
    const { customer } = await request.json();
    const sub = await nomba.subscriptions.create({
      customer, plan: 'plan_pro', rail: 'auto',
    });
    return Response.json(sub);
  },
};`,
      },
      {
        label: "AWS Lambda",
        icon: "awslambda",
        code: `const NOMBA_KEY = process.env.NOMBA_KEY;

export const handler = async (event) => {
  const { customer } = JSON.parse(event.body);
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBA_KEY}\`,
    },
    body: JSON.stringify({ customer, plan: 'plan_pro', rail: 'auto' }),
  });

  if (res.ok) {
    return { statusCode: 200, body: await res.text() };
  }
};`,
      },
    ],
  },
  {
    label: "Ruby",
    icon: "ruby",
    frameworks: [
      {
        label: "Ruby",
        icon: "ruby",
        hash: true,
        code: `require 'nomba_one'

nomba = NombaOne::Client.new(ENV['NOMBA_KEY'])

nomba.subscriptions.create(
  customer: 'cus_8821',
  plan: 'plan_pro',
  rail: 'auto',
)`,
      },
      {
        label: "Rails",
        icon: "rubyonrails",
        hash: true,
        code: `class BillingController < ApplicationController
  def subscribe
    nomba = NombaOne::Client.new(ENV['NOMBA_KEY'])
    render json: nomba.subscriptions.create(
      customer: params[:customer],
      plan: 'plan_pro', rail: 'auto',
    )
  end
end`,
      },
    ],
  },
  {
    label: "Python",
    icon: "python",
    frameworks: [
      {
        label: "Python",
        icon: "python",
        hash: true,
        code: `from nomba_one import Nomba

nomba = Nomba(os.environ['NOMBA_KEY'])

nomba.subscriptions.create(
    customer='cus_8821',
    plan='plan_pro',
    rail='auto',
)`,
      },
      {
        label: "Django",
        icon: "django",
        hash: true,
        code: `from django.http import JsonResponse
from nomba_one import Nomba

nomba = Nomba(os.environ['NOMBA_KEY'])

def subscribe(request):
    sub = nomba.subscriptions.create(
        customer=request.POST['customer'],
        plan='plan_pro', rail='auto',
    )
    return JsonResponse(sub)`,
      },
      {
        label: "Flask",
        icon: "flask",
        hash: true,
        code: `from flask import Flask, request, jsonify
from nomba_one import Nomba

nomba = Nomba(os.environ['NOMBA_KEY'])

@app.post('/subscribe')
def subscribe():
    return jsonify(nomba.subscriptions.create(
        customer=request.json['customer'],
        plan='plan_pro', rail='auto',
    ))`,
      },
      {
        label: "FastAPI",
        icon: "fastapi",
        hash: true,
        code: `from fastapi import FastAPI
from nomba_one import Nomba

app = FastAPI()
nomba = Nomba(os.environ['NOMBA_KEY'])

@app.post('/subscribe')
async def subscribe(customer: str):
    return nomba.subscriptions.create(
        customer=customer, plan='plan_pro', rail='auto',
    )`,
      },
    ],
  },
  {
    label: "PHP",
    icon: "php",
    frameworks: [
      {
        label: "PHP",
        icon: "php",
        code: `$nomba = new NombaOne\\Nomba(getenv('NOMBA_KEY'));

$nomba->subscriptions->create([
    'customer' => 'cus_8821',
    'plan' => 'plan_pro',
    'rail' => 'auto',
]);`,
      },
      {
        label: "Laravel",
        icon: "laravel",
        code: `use NombaOne\\Nomba;

Route::post('/subscribe', function (Request $request) {
    $nomba = new Nomba(env('NOMBA_KEY'));
    return $nomba->subscriptions->create([
        'customer' => $request->customer,
        'plan' => 'plan_pro', 'rail' => 'auto',
    ]);
});`,
      },
      {
        label: "Symfony",
        icon: "symfony",
        code: `use NombaOne\\Nomba;

#[Route('/subscribe', methods: ['POST'])]
public function subscribe(Request $request): JsonResponse
{
    $nomba = new Nomba($_ENV['NOMBA_KEY']);
    return $this->json($nomba->subscriptions->create([
        'customer' => $request->get('customer'),
        'plan' => 'plan_pro', 'rail' => 'auto',
    ]));
}`,
      },
    ],
  },
  {
    label: "CLI",
    icon: Terminal,
    frameworks: [
      {
        label: "CLI",
        icon: Terminal,
        hash: true,
        code: `nomba subscriptions create \\
  --customer cus_8821 \\
  --plan plan_pro \\
  --rail auto`,
      },
    ],
  },
  {
    label: "Go",
    icon: "go",
    frameworks: [
      {
        label: "Go",
        icon: "go",
        code: `package main

import "github.com/nombaone/nomba-go"

func main() {
    nomba := nombaone.New(os.Getenv("NOMBA_KEY"))
    nomba.Subscriptions.Create(&nombaone.SubscriptionParams{
        Customer: "cus_8821",
        Plan:     "plan_pro",
        Rail:     "auto",
    })
}`,
      },
    ],
  },
  {
    label: "Rust",
    icon: "rust",
    frameworks: [
      {
        label: "Rust",
        icon: "rust",
        code: `use nomba_one::{Nomba, SubscriptionParams};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let nomba = Nomba::new(std::env::var("NOMBA_KEY")?);
    nomba.subscriptions().create(SubscriptionParams {
        customer: "cus_8821",
        plan: "plan_pro",
        rail: "auto",
    }).await?;
    Ok(())
}`,
      },
    ],
  },
  {
    label: "Java",
    icon: "openjdk",
    frameworks: [
      {
        label: "Spring",
        icon: "spring",
        code: `@RestController
public class BillingController {
  private final Nomba nomba = new Nomba(System.getenv("NOMBA_KEY"));

  @PostMapping("/subscribe")
  public Subscription subscribe(@RequestParam String customer) {
    return nomba.subscriptions().create(
      SubscriptionParams.builder()
        .customer(customer).plan("plan_pro").rail("auto").build());
  }
}`,
      },
    ],
  },
  {
    label: "Elixir",
    icon: "elixir",
    frameworks: [
      {
        label: "Elixir",
        icon: "elixir",
        hash: true,
        code: `nomba = NombaOne.new(System.get_env("NOMBA_KEY"))

NombaOne.Subscriptions.create(nomba, %{
  customer: "cus_8821",
  plan: "plan_pro",
  rail: "auto"
})`,
      },
      {
        label: "Phoenix",
        icon: "phoenixframework",
        hash: true,
        code: `defmodule MyAppWeb.BillingController do
  use MyAppWeb, :controller

  def subscribe(conn, %{"customer" => customer}) do
    nomba = NombaOne.new(System.get_env("NOMBA_KEY"))
    {:ok, sub} = NombaOne.Subscriptions.create(nomba, %{
      customer: customer, plan: "plan_pro", rail: "auto"
    })
    json(conn, sub)
  end
end`,
      },
    ],
  },
  {
    label: ".NET",
    icon: "dotnet",
    frameworks: [
      {
        label: "C#",
        icon: "dotnet",
        code: `var nomba = new NombaOne.Client(
    Mode.GetEnvironmentVariable("NOMBA_KEY"));

await nomba.Subscriptions.CreateAsync(new SubscriptionParams {
    Customer = "cus_8821",
    Plan = "plan_pro",
    Rail = "auto",
});`,
      },
    ],
  },
  {
    label: "REST",
    icon: "curl",
    frameworks: [
      {
        label: "cURL",
        icon: "curl",
        hash: true,
        code: `curl https://api.nombaone.xyz/v1/subscriptions \\
  -H "Authorization: Bearer $NOMBA_KEY" \\
  -d customer=cus_8821 \\
  -d plan=plan_pro \\
  -d rail=auto`,
      },
      {
        label: "wget",
        icon: Download,
        hash: true,
        code: `wget https://api.nombaone.xyz/v1/subscriptions \\
  --header "Authorization: Bearer $NOMBA_KEY" \\
  --post-data 'customer=cus_8821&plan=plan_pro&rail=auto'`,
      },
    ],
  },
];

/** Resend-style code explorer: language icon tabs → framework sub-tabs → snippet. */
export function CodeStack({ className }: { className?: string }) {
  const [langIdx, setLangIdx] = useState(0);
  const [fwIdx, setFwIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const lang = LANGS[langIdx]!;
  const fw = lang.frameworks[fwIdx] ?? lang.frameworks[0]!;
  const lines = highlight(fw.code, fw.hash ?? false);

  function selectLang(i: number) {
    setLangIdx(i);
    setFwIdx(0);
  }
  async function copy() {
    await navigator.clipboard.writeText(fw.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* Language icon tabs */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {LANGS.map((l, i) => {
          const on = i === langIdx;
          return (
            <button
              key={l.label}
              type="button"
              onClick={() => selectLang(i)}
              className="group flex w-[68px] flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-[14px] border transition-all",
                  on
                    ? "border-accent-border bg-surface-2 text-foreground shadow-[0_0_24px_-2px_rgba(11,223,163,0.45)]"
                    : "border-border bg-surface-1 text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Glyph icon={l.icon} className="size-5" />
              </span>
              <span
                className={cn(
                  "text-[13px] transition-colors",
                  on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {l.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Code panel */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface-1">
        {/* Framework sub-tabs + copy */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <div className="flex gap-1 overflow-x-auto">
            {lang.frameworks.map((f, i) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFwIdx(i)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  i === fwIdx
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Glyph icon={f.icon} className="size-3.5" />
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy code"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
          </button>
        </div>

        {/* Code body with line numbers */}
        <div className="overflow-x-auto py-4 font-mono text-[13px] leading-[1.55]">
          {lines.map((line, i) => (
            <div key={i} className="flex px-4">
              <span className="w-8 shrink-0 select-none pr-4 text-right text-subtle-foreground">
                {i + 1}
              </span>
              <div className="whitespace-pre">
                {line
                  ? line.map((seg, j) => (
                      <span key={j} className={segColor(seg.c)}>
                        {seg.t}
                      </span>
                    ))
                  : " "}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-5 border-t border-border px-4 py-3">
          <a
            href="https://github.com/nombaone"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="size-4" /> View on GitHub
          </a>
          <a
            href="https://github.com/nombaone"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileArchive className="size-4" /> Download ZIP
          </a>
        </div>
      </div>
    </div>
  );
}
