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
});
