import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // Workspace packages are TS source consumed directly; bundle them in.
  noExternal: [/@nombaone\//],
  // Bundled CommonJS deps (e.g. pg via @nombaone/core-db) use dynamic
  // `require()` for Node builtins. ESM output has no `require`, so esbuild's
  // shim throws at runtime. Recreate a real `require` so those calls resolve.
  banner: {
    js: "import { createRequire as __nombaoneCreateRequire } from 'module'; const require = __nombaoneCreateRequire(import.meta.url);",
  },
});
