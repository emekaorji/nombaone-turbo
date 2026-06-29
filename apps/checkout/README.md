# @nombaone/checkout

Hosted checkout (`checkout.nombaone.xyz`) — the public, UNAUTHENTICATED
end-subscriber surface. A payer opens `/[reference]` (the resource's public
`nbo…exa` id) and completes payment.

The reference-keyed RSC page resolves the resource through `@nombaone/sara/example`
(`getExampleByReference`) with **no API layer** — it derives the org +
environment FROM the resource row, never from a caller. Status is **derived from
the ledger, never assumed**: a returning payer sees `pending` until the money has
actually moved and been confirmed (webhook → re-verify → settlement). The lone
mutation is the `payAction` server action.

Seams documented in the source: subscriber session-auth within a tenant
(`lib/payment.ts`), the Nomba hosted-checkout redirect/iframe handoff and the
"confirmed by webhook THEN re-verified, never assumed" settle path
(`lib/actions.ts`).
