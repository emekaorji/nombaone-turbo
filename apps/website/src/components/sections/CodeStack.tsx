"use client";

import { useState } from "react";
import { Check, Copy, FileArchive, Github } from "lucide-react";

import { BrandIcon } from "@/components/brand-icons";
import { cn } from "@/lib/utils";
import { type Line, type Seg, segColor } from "./code-tokens";

// ── Lightweight multi-language highlighter ─────────────────────────────────
const KEYWORDS = new Set([
  "import", "from", "export", "default", "const", "let", "var", "new", "await",
  "async", "function", "return", "class", "public", "private", "protected",
  "static", "void", "use", "require", "func", "package", "fn", "def", "val",
  "this", "self", "type", "interface", "struct", "enum", "impl", "mut", "pub",
  "module", "end", "render", "namespace", "using",
]);
const TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/\/[^\n]*)|([A-Za-z_$][\w$]*)|(\s+|[^\sA-Za-z_$"']+)/g;

function highlight(code: string): Line[] {
  return code.split("\n").map((raw) => {
    if (raw.trim() === "") return null;
    const segs: Seg[] = [];
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(raw))) {
      if (m[1]) segs.push({ t: m[1], c: "str" });
      else if (m[2]) segs.push({ t: m[2], c: "com" });
      else if (m[3]) segs.push({ t: m[3], c: KEYWORDS.has(m[3]) ? "kw" : undefined });
      else segs.push({ t: m[4]! });
    }
    return segs;
  });
}

// ── Snippets ───────────────────────────────────────────────────────────────
type FW = { label: string; icon: string; code: string };
type Lang = { label: string; icon: string; frameworks: FW[] };

const LANGS: Lang[] = [
  {
    label: "Node.js",
    icon: "nodedotjs",
    frameworks: [
      {
        label: "Node.js",
        icon: "nodedotjs",
        code: `import { Nomba } from 'nomba-one';

const nomba = new Nomba(process.env.NOMBA_KEY);

await nomba.subscriptions.create({
  customer: 'cus_8821',
  plan: 'plan_pro',
  rail: 'auto',
});`,
      },
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
        label: "NestJS",
        icon: "nestjs",
        code: `import { Injectable } from '@nestjs/common';
import { Nomba } from 'nomba-one';

@Injectable()
export class BillingService {
  private nomba = new Nomba(process.env.NOMBA_KEY);

  subscribe(customer: string) {
    return this.nomba.subscriptions.create({
      customer, plan: 'plan_pro', rail: 'auto',
    });
  }
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
    ],
  },
  {
    label: "Python",
    icon: "python",
    frameworks: [
      {
        label: "Python",
        icon: "python",
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
    label: "Ruby",
    icon: "ruby",
    frameworks: [
      {
        label: "Ruby",
        icon: "ruby",
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
    label: ".NET",
    icon: "dotnet",
    frameworks: [
      {
        label: "C#",
        icon: "dotnet",
        code: `var nomba = new NombaOne.Client(
    Environment.GetEnvironmentVariable("NOMBA_KEY"));

await nomba.Subscriptions.CreateAsync(new SubscriptionParams {
    Customer = "cus_8821",
    Plan = "plan_pro",
    Rail = "auto",
});`,
      },
    ],
  },
  {
    label: "cURL",
    icon: "curl",
    frameworks: [
      {
        label: "cURL",
        icon: "curl",
        code: `curl https://api.nombaone.xyz/v1/subscriptions \\
  -H "Authorization: Bearer $NOMBA_KEY" \\
  -d customer=cus_8821 \\
  -d plan=plan_pro \\
  -d rail=auto`,
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
  const lines = highlight(fw.code);

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
                  "flex size-[52px] items-center justify-center rounded-[14px] border transition-colors",
                  on
                    ? "border-border-strong bg-surface-2 text-foreground"
                    : "border-border bg-surface-1 text-muted-foreground group-hover:text-foreground"
                )}
              >
                <BrandIcon slug={l.icon} className="size-5" />
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
                <BrandIcon slug={f.icon} className="size-3.5" />
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
                  : " "}
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
