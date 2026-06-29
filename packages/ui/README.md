# `@nombaone/ui`

`@nombaone/ui` is the shared web primitive layer.

Current exports are intentionally small:

- `Button`
- `Card` and its subcomponents
- `cn`
- `globals.css`

This package is for reusable web components that more than one app can consume without app-specific logic.

Implementation notes:

- React-only
- Tailwind utility classes
- `Button` uses Radix `Slot` and `class-variance-authority`
- `cn` combines `clsx` and `tailwind-merge`
- `react` and `react-dom` are peer dependencies

Typical usage:

```tsx
import '@nombaone/ui/globals.css';
import { Button, Card } from '@nombaone/ui';
```

Good fits:

- presentational primitives
- form shells
- badges, modals, shared surface components

Keep these out:

- page sections
- data-fetching components
- components with app routes or server actions
- mobile-specific UI

Workflow for adding a component:

1. add it under `src/components`
2. export it from `src/index.ts`
3. keep props generic
4. avoid app-owned imports
5. promote it only after a second app actually needs it

`@nombaone/ui` is not a full design system yet. Keep it primitive and reusable.
