# The deletable `example` slice

`example` is a **placeholder resource** wired through every layer to demonstrate the boilerplate's
money-path paradigms (it is NOT part of the product). When you start modelling your real domain
(plans, subscriptions, invoices…), delete it in one pass:

- `packages/core-contracts/src/types/example.ts` + `…/validations/example.ts` (remove from the barrels)
- `packages/core-db/src/schema/examples.ts` (remove from `schema/index.ts`, regenerate a migration)
- `packages/sara/src/example/**` (remove the `./example` export from `packages/sara/package.json`)
- `apps/api/src/modules/example/**` (unmount its routes)
- `apps/console/src/app/(app)/examples/**`
- `apps/admin` example operator view
- `apps/docs/content/reference/examples.mdx` (remove from the nav manifest)
- `apps/checkout/src/app/[reference]/**` reference-keyed page (rewire to your real resource)
- the `EXAMPLE_*` codes in `packages/errors/src/codes.ts`
- the example queue in `packages/queue/src/queues/example.ts`
- the mock rails in `packages/sara/src/rails/mock.ts` (replace with your real adapters)

What each example file teaches (the paradigm) is in its doc-comment header — read before deleting.
