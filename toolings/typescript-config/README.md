# `@nombaone/typescript-config`

`@nombaone/typescript-config` contains the shared TypeScript presets for the repo.

Available presets:

- `base`: strict shared baseline for internal packages
- `node`: backend/runtime packages
- `nextjs`: Next apps
- `react-library`: shared web React packages
- `expo`: Expo apps

`base` carries the core repo defaults, including `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, source maps, declaration settings, and modern module defaults.

Typical usage:

```json
{
  "extends": "@nombaone/typescript-config/node"
}
```

Choose by runtime:

- `node` for APIs and runtime libraries
- `nextjs` for Next apps
- `react-library` for packages like `@nombaone/ui`
- `expo` for mobile apps
- `base` when you only need the shared baseline

Keep these local to each workspace unless multiple packages need them:

- path aliases
- include/exclude globs
- `noEmit`
- app-specific module overrides
- one-off interop fixes

Shared presets should describe runtime families, not one-package exceptions.
