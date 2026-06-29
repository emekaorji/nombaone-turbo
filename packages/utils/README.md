# `@nombaone/utils`

`@nombaone/utils` is the shared shelf for small runtime helpers that do not need framework context.

Current helpers:

- `crc16Ccitt`
- `date`
- `money`
- `pagination`
- `random`
- `runInBackground`
- `sanitize`
- `scripts`

Typical usage:

```ts
import { sanitizeString, toKobo } from '@nombaone/utils';
```

A few important nuances:

- `pagination` returns the shared `PaginationMeta` shape from `@nombaone/contracts/types`
- `runInBackground` only cancels waiting unless the underlying operation respects `AbortSignal`
- `runScript` exits the process and is for CLI entrypoints only

Good fits:

- pure data helpers
- formatting/sanitization helpers
- async helpers with no app context
- script helpers for one-off CLI flows

Keep these out:

- Express/request helpers
- logger or outbound HTTP setup
- Redis/email/SMS helpers
- validators
- business logic disguised as utilities

Rule of thumb: if the helper still makes sense in a plain TypeScript file with no app context, it may belong here. If it needs request state, service wiring, or product rules, it does not.
