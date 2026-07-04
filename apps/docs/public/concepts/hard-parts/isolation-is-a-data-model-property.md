---
title: "Isolation as a property of the data model, not a middleware check"
type: explanation
summary: "If one forgotten route can leak another tenant's data, your isolation is a hope, not a guarantee."
canonical: https://docs.nombaone.xyz/concepts/hard-parts/isolation-is-a-data-model-property
---

# Isolation as a property of the data model, not a middleware check

> Draft. On the roster, not yet written.

If one forgotten route can leak another tenant's data, your isolation is a hope, not a guarantee. Isolation is
organization and environment columns on every row, scoped on every query from a trusted key.
