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

// Real, published SDK usage. Every snippet reads NOMBAONE_API_KEY and creates a
// subscription with { customerId, priceId, paymentMethodId } — the same call the
// SDK READMEs ship. Package names, client classes, and namespaces are exact.
const NODE_SDK = `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

await nombaone.subscriptions.create({
  customerId: 'cus_8821',
  priceId: 'price_pro',
  paymentMethodId: 'pm_4d9f',
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
        code: `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

export async function POST(req: Request) {
  const { customerId, priceId, paymentMethodId } = await req.json();
  const sub = await nombaone.subscriptions.create({
    customerId, priceId, paymentMethodId,
  });
  return Response.json(sub);
}`,
      },
      {
        label: "Remix",
        icon: "remix",
        code: `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

export async function action({ request }) {
  const form = await request.formData();
  return nombaone.subscriptions.create({
    customerId: form.get('customerId'),
    priceId: form.get('priceId'),
    paymentMethodId: form.get('paymentMethodId'),
  });
}`,
      },
      {
        label: "Nuxt",
        icon: "nuxtdotjs",
        code: `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

export default defineEventHandler(async (event) => {
  const { customerId, priceId, paymentMethodId } = await readBody(event);
  return nombaone.subscriptions.create({
    customerId, priceId, paymentMethodId,
  });
});`,
      },
      {
        label: "Express",
        icon: "express",
        code: `const Nombaone = require('@nombaone/node').default;

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

app.post('/subscribe', async (req, res) => {
  const sub = await nombaone.subscriptions.create({
    customerId: req.body.customerId,
    priceId: req.body.priceId,
    paymentMethodId: req.body.paymentMethodId,
  });
  res.json(sub);
});`,
      },
      {
        label: "Hono",
        icon: "hono",
        code: `import { Hono } from 'hono';
import Nombaone from '@nombaone/node';

const app = new Hono();
const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

app.post('/subscribe', async (c) => {
  const { customerId, priceId, paymentMethodId } = await c.req.json();
  return c.json(await nombaone.subscriptions.create({
    customerId, priceId, paymentMethodId,
  }));
});`,
      },
      {
        label: "Redwood",
        icon: "redwoodjs",
        code: `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

export const handler = async (event) => {
  const { customerId, priceId, paymentMethodId } = JSON.parse(event.body);
  const sub = await nombaone.subscriptions.create({
    customerId, priceId, paymentMethodId,
  });
  return { statusCode: 200, body: JSON.stringify(sub) };
};`,
      },
      {
        label: "Bun",
        icon: "bun",
        code: `import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(process.env.NOMBAONE_API_KEY);

Bun.serve({
  port: 3000,
  async fetch(req) {
    const { customerId, priceId, paymentMethodId } = await req.json();
    return Response.json(await nombaone.subscriptions.create({
      customerId, priceId, paymentMethodId,
    }));
  },
});`,
      },
      {
        label: "Astro",
        icon: "astro",
        code: `import type { APIRoute } from 'astro';
import Nombaone from '@nombaone/node';

const nombaone = new Nombaone(import.meta.env.NOMBAONE_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const { customerId, priceId, paymentMethodId } = await request.json();
  const sub = await nombaone.subscriptions.create({
    customerId, priceId, paymentMethodId,
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
        code: `const NOMBAONE_API_KEY = process.env.NOMBAONE_API_KEY;

export async function POST(req) {
  const { customerId, priceId, paymentMethodId } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${NOMBAONE_API_KEY}\`,
    },
    body: JSON.stringify({ customerId, priceId, paymentMethodId }),
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

const NOMBAONE_API_KEY = Deno.env.get('NOMBAONE_API_KEY');

serve(async (req: Request): Promise<Response> => {
  const { customerId, priceId, paymentMethodId } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBAONE_API_KEY}\`,
    },
    body: JSON.stringify({ customerId, priceId, paymentMethodId }),
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

const NOMBAONE_API_KEY = Deno.env.get('NOMBAONE_API_KEY');

serve(async (req: Request): Promise<Response> => {
  const { customerId, priceId, paymentMethodId } = await req.json();
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBAONE_API_KEY}\`,
    },
    body: JSON.stringify({ customerId, priceId, paymentMethodId }),
  });

  return new Response(await res.text(), {
    headers: { 'Content-Type': 'application/json' },
  });
});`,
      },
      {
        label: "Cloudflare Workers",
        icon: "cloudflareworkers",
        code: `import Nombaone from '@nombaone/node';

export default {
  async fetch(request, env) {
    const nombaone = new Nombaone(env.NOMBAONE_API_KEY);
    const { customerId, priceId, paymentMethodId } = await request.json();
    const sub = await nombaone.subscriptions.create({
      customerId, priceId, paymentMethodId,
    });
    return Response.json(sub);
  },
};`,
      },
      {
        label: "AWS Lambda",
        icon: "awslambda",
        code: `const NOMBAONE_API_KEY = process.env.NOMBAONE_API_KEY;

export const handler = async (event) => {
  const { customerId, priceId, paymentMethodId } = JSON.parse(event.body);
  const res = await fetch('https://api.nombaone.xyz/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${NOMBAONE_API_KEY}\`,
    },
    body: JSON.stringify({ customerId, priceId, paymentMethodId }),
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
        code: `require 'nombaone'

nombaone = Nombaone.new(ENV['NOMBAONE_API_KEY'])

nombaone.subscriptions.create(
  customer_id: 'cus_8821',
  price_id: 'price_pro',
  payment_method_id: 'pm_4d9f',
)`,
      },
      {
        label: "Rails",
        icon: "rubyonrails",
        hash: true,
        code: `class BillingController < ApplicationController
  def subscribe
    nombaone = Nombaone.new(ENV['NOMBAONE_API_KEY'])
    render json: nombaone.subscriptions.create(
      customer_id: params[:customer_id],
      price_id: params[:price_id],
      payment_method_id: params[:payment_method_id],
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
        code: `from nombaone import Nombaone

nombaone = Nombaone(os.environ['NOMBAONE_API_KEY'])

nombaone.subscriptions.create(
    customer_id='cus_8821',
    price_id='price_pro',
    payment_method_id='pm_4d9f',
)`,
      },
      {
        label: "Django",
        icon: "django",
        hash: true,
        code: `from django.http import JsonResponse
from nombaone import Nombaone

nombaone = Nombaone(os.environ['NOMBAONE_API_KEY'])

def subscribe(request):
    sub = nombaone.subscriptions.create(
        customer_id=request.POST['customer_id'],
        price_id=request.POST['price_id'],
        payment_method_id=request.POST['payment_method_id'],
    )
    return JsonResponse(sub)`,
      },
      {
        label: "Flask",
        icon: "flask",
        hash: true,
        code: `from flask import Flask, request, jsonify
from nombaone import Nombaone

nombaone = Nombaone(os.environ['NOMBAONE_API_KEY'])

@app.post('/subscribe')
def subscribe():
    return jsonify(nombaone.subscriptions.create(
        customer_id=request.json['customer_id'],
        price_id=request.json['price_id'],
        payment_method_id=request.json['payment_method_id'],
    ))`,
      },
      {
        label: "FastAPI",
        icon: "fastapi",
        hash: true,
        code: `from fastapi import FastAPI
from nombaone import Nombaone

app = FastAPI()
nombaone = Nombaone(os.environ['NOMBAONE_API_KEY'])

@app.post('/subscribe')
async def subscribe(customer_id: str, price_id: str, payment_method_id: str):
    return nombaone.subscriptions.create(
        customer_id=customer_id,
        price_id=price_id,
        payment_method_id=payment_method_id,
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
        code: `$nombaone = new NombaOne\\Nombaone(getenv('NOMBAONE_API_KEY'));

$nombaone->subscriptions->create([
    'customerId' => 'cus_8821',
    'priceId' => 'price_pro',
    'paymentMethodId' => 'pm_4d9f',
]);`,
      },
      {
        label: "Laravel",
        icon: "laravel",
        code: `use NombaOne\\Nombaone;

Route::post('/subscribe', function (Request $request) {
    $nombaone = new Nombaone(env('NOMBAONE_API_KEY'));
    return $nombaone->subscriptions->create([
        'customerId' => $request->customerId,
        'priceId' => $request->priceId,
        'paymentMethodId' => $request->paymentMethodId,
    ]);
});`,
      },
      {
        label: "Symfony",
        icon: "symfony",
        code: `use NombaOne\\Nombaone;

#[Route('/subscribe', methods: ['POST'])]
public function subscribe(Request $request): JsonResponse
{
    $nombaone = new Nombaone($_ENV['NOMBAONE_API_KEY']);
    return $this->json($nombaone->subscriptions->create([
        'customerId' => $request->get('customerId'),
        'priceId' => $request->get('priceId'),
        'paymentMethodId' => $request->get('paymentMethodId'),
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
        code: `nombaone subscriptions create \\
  --customer-id cus_8821 \\
  --price-id price_pro \\
  --payment-method-id pm_4d9f`,
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

import (
    "context"
    "github.com/nombaone/nombaone-go"
)

func main() {
    client, _ := nombaone.New() // reads NOMBAONE_API_KEY
    client.Subscriptions.Create(context.Background(), nombaone.SubscriptionCreateParams{
        CustomerID:      "cus_8821",
        PriceID:         "price_pro",
        PaymentMethodID: nombaone.String("pm_4d9f"),
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
        code: `use nombaone::{Nombaone, SubscriptionCreateParams};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let nombaone = Nombaone::from_env()?; // reads NOMBAONE_API_KEY
    nombaone.subscriptions().create(SubscriptionCreateParams {
        customer_id: "cus_8821".into(),
        price_id: "price_pro".into(),
        ..Default::default()
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
  private final Nombaone nombaone = new Nombaone(System.getenv("NOMBAONE_API_KEY"));

  @PostMapping("/subscribe")
  public Subscription subscribe(@RequestParam String customerId, @RequestParam String priceId) {
    return nombaone.subscriptions().create(
      SubscriptionCreateParams.builder()
        .customerId(customerId)
        .priceId(priceId)
        .build());
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
        code: `client = Nombaone.new() # reads NOMBAONE_API_KEY

Nombaone.Subscriptions.create(client, %{
  customer_id: "cus_8821",
  price_id: "price_pro",
  payment_method_id: "pm_4d9f"
})`,
      },
      {
        label: "Phoenix",
        icon: "phoenixframework",
        hash: true,
        code: `defmodule MyAppWeb.BillingController do
  use MyAppWeb, :controller

  def subscribe(conn, %{"customer_id" => customer_id, "price_id" => price_id}) do
    client = Nombaone.new()
    {:ok, sub} = Nombaone.Subscriptions.create(client, %{
      customer_id: customer_id, price_id: price_id
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
        code: `using NombaOne;

var nombaone = new Nombaone(); // reads NOMBAONE_API_KEY

await nombaone.Subscriptions.CreateAsync(new SubscriptionCreateParams
{
    CustomerId = "cus_8821",
    PriceId = "price_pro",
    PaymentMethodId = "pm_4d9f",
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
  -H "Authorization: Bearer $NOMBAONE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"customerId":"cus_8821","priceId":"price_pro","paymentMethodId":"pm_4d9f"}'`,
      },
      {
        label: "wget",
        icon: Download,
        hash: true,
        code: `wget https://api.nombaone.xyz/v1/subscriptions \\
  --header "Authorization: Bearer $NOMBAONE_API_KEY" \\
  --header "Content-Type: application/json" \\
  --post-data '{"customerId":"cus_8821","priceId":"price_pro","paymentMethodId":"pm_4d9f"}'`,
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
            href="https://docs.nombaone.xyz/sdks"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileArchive className="size-4" /> Read the SDK docs
          </a>
        </div>
      </div>
    </div>
  );
}
