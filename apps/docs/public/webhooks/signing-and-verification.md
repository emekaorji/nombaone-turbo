---
title: "Signing & verification"
type: reference
summary: "Every delivery is signed HMAC-SHA256 over the timestamp and the raw body. Verify before you parse, compare in constant time, and reject stale timestamps."
canonical: https://docs.nombaone.xyz/webhooks/signing-and-verification
---

# Signing & verification

Never trust a webhook you haven't verified: the URL is public, so anyone could
`POST` to it. Every genuine delivery carries an `X-Nombaone-Signature` header you
check against your endpoint's signing secret.

## The signature

The header is `t=<unix>,v1=<hex>`, where `v1` is:

```
key = SHA256( whsec )                       // hex — derive once from your secret
v1  = HMAC_SHA256( `${t}.${rawBody}`, key ) // hex
```

The HMAC key is the **SHA-256 of your plaintext signing secret** (the
`nbo_whsec_…` shown once at endpoint creation), hex-encoded — derive it once and
cache it. `t` is the delivery timestamp and `rawBody` is the **exact bytes** of
the request body. Verify by recomputing `v1` and comparing. (The official SDKs
do the hashing internally: pass them the plaintext secret.)

> **Sign the raw bytes: never re-serialize**
>
> Compute the HMAC over the body exactly as received. `JSON.parse` then
> `JSON.stringify` can reorder keys and change the bytes, so the signature won't
> match. Capture the raw body before any framework parses it.

## Reference implementation

**TypeScript**

```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const { t, v1 } = parts;

  // Reject stale deliveries (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 300) throw new Error("timestamp too old");

  // The HMAC key is the sha256 (hex) of your plaintext whsec.
  const key = createHash("sha256").update(secret).digest("hex");
  const expected = createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex");
  const ok =
    v1.length === expected.length &&
    timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  if (!ok) throw new Error("invalid signature");
}
```

**Python**

```python
import hmac, hashlib, time

def verify(raw_body: bytes, header: str, secret: str) -> None:
    parts = dict(kv.split("=") for kv in header.split(","))
    t, v1 = parts["t"], parts["v1"]

    if abs(time.time() - int(t)) > 300:
        raise ValueError("timestamp too old")

    # The HMAC key is the sha256 (hex) of your plaintext whsec.
    key = hashlib.sha256(secret.encode()).hexdigest()
    expected = hmac.new(
        key.encode(), f"{t}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(v1, expected):
        raise ValueError("invalid signature")
```

## Two rules that matter

- **Constant-time compare.** Use `timingSafeEqual` / `compare_digest`, never
`===`. A plain compare leaks the secret one byte at a time under timing
attack.
- **Reject stale timestamps.** Bound `t` to a few minutes so a captured delivery
can't be replayed against you later.

## Try it in-browser

Paste a body, timestamp, and secret and watch the exact signature compute, the
real recipe, in your browser with Web Crypto:

> **Interactive: `<WebhookVerifier>`.** View and run it live at https://docs.nombaone.xyz/webhooks/signing-and-verification

> **Rotate without downtime**
>
> `POST /v1/webhooks/{id}/rotate-secret` issues a new secret while briefly
> honoring the old one, so you can roll it without dropping in-flight deliveries.

- **[Delivery guarantee](/webhooks/delivery-guarantee)**: 
At-least-once: why you dedupe after you verify.
- **[Verify us in your devtools](/getting-started/verify-in-your-devtools)**: 
Fire a real signed event and watch it verify.
