# `@nombaone/prettier-config`

`@nombaone/prettier-config` is the repo-wide formatting source of truth.

The root `prettier.config.mjs` re-exports this package, so changing it affects formatting everywhere in the monorepo.

Current settings:

- `semi: true`
- `singleQuote: false`
- `trailingComma: "es5"`
- `printWidth: 100`
- `tabWidth: 2`

Direct usage looks like this:

```mjs
import config from '@nombaone/prettier-config';

export default config;
```

Change this package only for repo-level formatting decisions. Do not use it to solve lint issues or one-package style preferences.

If a formatting change would cause huge churn, it is probably the wrong time to make it.
