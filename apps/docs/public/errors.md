---
title: "Error reference"
type: reference
summary: "Every error code, what it means, and exactly how to fix it — complete and always current, generated from the same registry the API answers with."
canonical: https://docs.nombaone.xyz/errors
---

# Error reference

When a request fails, Nomba One returns a machine-readable `code`, a plain-English
`hint`, and a `docUrl` that deep-links to the exact entry on this page. Branch on
`error.code` — never on the message, which is for humans and may change.

Every entry below is generated straight from the API's error registry, so this page can
never omit or invent a code. The `docUrl` the API sends you (`…/errors#CODE`) lands right
on the matching entry.

> **Errors are a feature**
>
> A good error tells you exactly what went wrong and what to do next. Every code here has
> a `hint` written to be actioned — read it, branch on the code, and move on.

Got an error response in hand? Paste it here to jump straight to the fix:

> **Interactive — `<ErrorReference>`.** View and run it live at https://docs.nombaone.xyz/errors
