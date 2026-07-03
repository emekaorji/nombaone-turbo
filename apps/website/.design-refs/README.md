# .design-refs

Verification workspace.

- `actual/{desktop,mobile}/*.png` — screenshots captured by `pnpm test:e2e` (gitignored; regenerated).
- The reference is the `.pen` itself, fetched on demand via the Pencil MCP `get_screenshot(nodeId)` using the
  route -> node-id map in `../VERIFY.md`.
