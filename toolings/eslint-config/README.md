# `@nombaone/eslint-config`

`@nombaone/eslint-config` exports the flat ESLint presets used across the repo.

Available presets:

- `base`: JS + `typescript-eslint` + Prettier + Turbo defaults
- `node`: `base` plus Node globals
- `next`: `base` plus Next, React, and hooks rules
- `react-internal`: `base` plus React and hooks rules for shared packages

Repo-specific choices already baked into `base`:

- `turbo/no-undeclared-env-vars` is a warning
- `@typescript-eslint/no-unused-vars` is a warning and ignores `_` args
- `@typescript-eslint/no-explicit-any` is a warning
- `@typescript-eslint/consistent-type-imports` is an error
- ignores include `dist`, `.next`, `build`, `node_modules`, and `*.config.*`

Usage:

```js
import { config } from '@nombaone/eslint-config/node';

export default [...config];
```

Use `next` for Next apps, `node` for backend services/runtime packages, and `react-internal` for shared React packages like `@nombaone/ui`.

Change this package only when the rule should apply broadly. If the need is local to one workspace, override locally instead of pushing the exception into the shared preset.
