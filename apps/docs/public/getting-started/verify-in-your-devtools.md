---
title: "Verify us in your devtools"
type: tutorial
summary: "The sandbox sends no organic webhooks, so we hand you a real signed event: register an endpoint, fire it, and watch the signature verify in your own logs."
canonical: https://docs.nombaone.xyz/getting-started/verify-in-your-devtools
---

# Verify us in your devtools

Here is the honest truth most payment docs won't tell you: the Nomba sandbox
does **not** push webhooks on its own. So instead of pretending, we hand you a
**real, signed event**, byte-for-byte identical to production, that you fire on
demand and watch land in your own tunnel. This page proves the pipe end to end:
register → fire → verify.

> **Real and signed, not mocked**
>
> The event you fire below is a genuine signed payload from the sandbox instrument,
> the same shape and the same signature scheme as a live event. Nothing here is
> faked or `setTimeout`-ed. `simulate` is the honest substitute for organic
> sandbox delivery. It is sandbox-mode-only and at-least-once (dedupe on the
> event id).

## 1 · Register an endpoint

Point a webhook at a URL you control. In development, expose your local server
with a tunnel (ngrok, Cloudflare Tunnel) and register the public URL:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/webhooks \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-tunnel.ngrok.app/webhooks/nomba",
    "enabledEvents": ["invoice.paid", "invoice.action_required"]
  }'
```

The response includes the endpoint's **signing secret** (`whsec_…`), shown once.
Store it server-side. You need it to verify every delivery.

## 2 · Fire a real signed event

Ask the sandbox instrument to emit a signed event to your registered endpoint. Fire
a happy path and an unhappy one:

**invoice.paid**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "type": "invoice.paid" }'
```

**invoice.action_required**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "type": "invoice.action_required" }'
```

Watch your tunnel or your server logs: a real `POST` arrives at your endpoint,
carrying the event body and the signature header. That is the exact traffic
production sends.

## 3 · Verify the signature

Never trust a webhook you haven't verified. Every delivery is signed
`HMAC_SHA256(` `${timestamp}.${rawBody}` `, secret)` over the **raw** request
body. Verify before you parse. Compare in constant time.

> **Verify the raw bytes, before parsing**
>
> Compute the HMAC over the exact bytes you received, not over a re-serialized
> object: `JSON.parse` then `JSON.stringify` can reorder keys and change the
> bytes, and the signature will no longer match. Read the raw body first.

Here is the verifier, running the real recipe in your browser with Web Crypto.
Paste a body, timestamp, and secret and watch it compute the signature the
server expects:

> **Interactive: `<WebhookVerifier>`.** View and run it live at https://docs.nombaone.xyz/getting-started/verify-in-your-devtools

The reference implementation for your server:

**TypeScript**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody: string, header: string, secret: string) {
  const [ts, sig] = parseHeader(header); // "t=…,v1=…"
  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const ok =
    sig.length === expected.length &&
    timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw new Error("bad signature");
}
```

**Python**

```python
import hmac, hashlib

def verify(raw_body: bytes, header: str, secret: str) -> None:
    ts, sig = parse_header(header)  # "t=…,v1=…"
    expected = hmac.new(
        secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("bad signature")
```

## Then respond fast, and dedupe

Return `2xx` quickly and do the work asynchronously. A slow handler looks like a
failure and gets retried. Because delivery is at-least-once, **dedupe on the
event id**: the same event may arrive twice, and
[retrying the webhook is not retrying the charge](/concepts/hard-parts/retry-the-webhook-is-not-retry-the-charge).

- **[Handle webhooks (guide)](/guides/handle-webhooks)**: 
The full receive → verify → dedupe → act pattern for one correct balance.
- **[Event catalog](/webhooks/event-catalog)**: 
Every event type, when it fires, and its payload shape.
