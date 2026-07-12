---
title: "Customers"
type: reference
summary: "Customers — every operation on the resource."
canonical: https://docs.nombaone.xyz/reference/customers
---

# Customers

Every operation on the customers resource.

- [`POST /v1/customers`](https://docs.nombaone.xyz/reference/customers/create.md) — Create a customer
- [`GET /v1/customers`](https://docs.nombaone.xyz/reference/customers/list.md) — List customers
- [`GET /v1/customers/{id}`](https://docs.nombaone.xyz/reference/customers/retrieve.md) — Retrieve a customer
- [`PATCH /v1/customers/{id}`](https://docs.nombaone.xyz/reference/customers/update.md) — Update a customer
- [`GET /v1/customers/{id}/credit`](https://docs.nombaone.xyz/reference/customers/credit-balance.md) — Retrieve credit balance
- [`POST /v1/customers/{id}/credit`](https://docs.nombaone.xyz/reference/customers/grant-credit.md) — Grant credit
- [`DELETE /v1/customers/{id}/discount`](https://docs.nombaone.xyz/reference/customers/remove-discount.md) — Remove a discount
- [`POST /v1/customers/{id}/discount`](https://docs.nombaone.xyz/reference/customers/apply-discount.md) — Apply a discount
- [`DELETE /v1/customers/{id}/credit/{grantId}`](https://docs.nombaone.xyz/reference/customers/void-credit-grant.md) — Void a credit grant
