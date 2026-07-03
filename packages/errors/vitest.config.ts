import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Workspace packages export TypeScript source — let vitest transform them.
    server: { deps: { inline: [/@nombaone\//] } },
  },
});
