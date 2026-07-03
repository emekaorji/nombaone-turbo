---
title: "The end-of-month billing trap (the Jan 31 problem)"
type: explanation
summary: "A subscription that starts on the 31st must not silently become a 28th-of-the-month subscription."
canonical: https://docs.nombaone.xyz/concepts/hard-parts/the-end-of-month-billing-trap
---

# The end-of-month billing trap (the Jan 31 problem)

> Draft. On the roster, not yet written.

A subscription that starts on the 31st must not silently become a 28th-of-the-month subscription. Period math
anchors on the original day: a Jan 31 anchor bills Feb 28 or 29, then Mar 31 again, never the clamped 28.
