---
title: "Command-line interface"
type: reference
summary: "The nombaone CLI — tail webhooks, scaffold a project, and drive the sandbox from your terminal. In development; use an SDK or the raw API in the meantime."
canonical: https://docs.nombaone.xyz/sdks/cli
---

# Command-line interface

The `nombaone` CLI will let you work with Nomba One straight from your terminal —
tail live webhook deliveries while you build a handler, scaffold a project, and
drive the sandbox without writing a line of application code.

> **In development**
>
> The CLI is not released yet. This page describes what it will do; it will fill
> in with real commands when the tool ships. To build today, reach for one of the
> [SDKs](/sdks) or the raw API.

## What it will do

- **Tail webhooks.** Stream deliveries to your endpoint as they happen, so you can
watch an event land while you write the handler.
- **Scaffold locally.** Start a project preconfigured for the sandbox, so your
first real subscription is a command away.
- **Drive the sandbox.** Advance a billing cycle, mint a deterministic test
method, and simulate an event — the same [sandbox toolkit](/sandbox-toolkit/overview)
the SDKs expose, from the shell.

## In the meantime

- **[Pick an SDK](/sdks)**: 
Nine official libraries, one for your language.
- **[Quickstart](/getting-started/quickstart)**: 
Reach a real subscription with nothing but your standard library.
