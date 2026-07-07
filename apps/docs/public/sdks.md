---
title: "SDKs and libraries"
type: reference
summary: "Nine official, idiomatic SDKs — Node, Python, Go, PHP, Ruby, Java, .NET, Rust, and Elixir — plus a CLI. Each one wraps the same API with typed errors, automatic retries that never double-charge, cursor pagination, and a webhook verifier."
canonical: https://docs.nombaone.xyz/sdks
---

# SDKs and libraries

Every Nomba One SDK is official, hand-written for its language, and generated from
the same API — so a subscription you create in Go behaves exactly like one you
create in Ruby. Pick your language, install one package, and you get typed errors
with a `hint` and a `docUrl`, automatic retries that reuse the idempotency key so a
blip never double-charges, cursor pagination you can loop over, and a keyless
webhook verifier. Money is always integer kobo.

If you would rather hold the raw HTTP surface — no dependency at all — the
[quickstart](/getting-started/quickstart) gets you to a real `201` with nothing but
your language's standard library.

## The libraries

Versions above are the current releases; the API contract is the same across all of
them. Each SDK reads your secret key from `NOMBAONE_API_KEY` and derives the host
from the key prefix — `nbo_sandbox_…` talks to the sandbox, `nbo_live_…` to live —
so the same code moves to production by swapping one key.

## Pick your language

- **[Node.js & TypeScript](/sdks/node)**: 
One library for Node, Next.js, and every JS runtime, fully typed.
- **[Python](/sdks/python)**: 
Sync and async clients, on httpx and pydantic.
- **[Go](/sdks/go)**: 
Context-first, zero dependencies, range-over-func pagination.
- **[PHP](/sdks/php)**: 
Typed models for PHP, Laravel, and Symfony.
- **[Ruby](/sdks/ruby)**: 
A zero-dependency gem for Ruby and Rails.
- **[Java](/sdks/java)**: 
Thread-safe, synchronous, for Java, Kotlin, and Spring.
- **[.NET](/sdks/dotnet)**: 
Async from top to bottom, for C# on .NET 8 and beyond.
- **[Rust](/sdks/rust)**: 
Async-first on tokio, with an optional blocking API.
- **[Elixir](/sdks/elixir)**: 
A functional client for Elixir and Phoenix.

## The CLI

- **[Command-line tool](/sdks/cli)**: 
Tail webhooks, scaffold a project, and drive the sandbox from your terminal.

## What every SDK guarantees

- **The money is never wrong.** Amounts are integer kobo end to end, and every
money-moving `POST` is idempotent by construction — a retry resolves to exactly
one movement.
- **Errors resolve themselves.** A failure carries a machine-readable `code`, a
human `hint`, and a `docUrl` that points at the fix. Branch on the code, never on
the message.
- **Webhooks verify without a key.** The webhook helper needs only your signing
secret, so a receiver never has to hold your API key.
- **One vocabulary.** Plans, prices, subscriptions, mandates, settlements — a word
means the same thing in every SDK, the API, and the console.
