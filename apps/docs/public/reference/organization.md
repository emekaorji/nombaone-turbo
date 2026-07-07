---
title: "Organization"
type: reference
summary: "Your organization's configuration and billing settings: read and update the account that owns your data and keys. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/organization
---

# Organization

An **organization** is the account that owns your customers, subscriptions, keys,
and money. Everything in the API is scoped to one organization, and your secret
key pins every request to it. See [authentication](/getting-started/authentication).
This resource reads and updates the organization's own configuration and billing
settings.

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/organization

> **Isolation is a data-model property**
>
> One integration can run many organizations, each with fully isolated data and
> its own sub-account. See
> [isolation is a data-model property](/concepts/hard-parts/isolation-is-a-data-model-property).
