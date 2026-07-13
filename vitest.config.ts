import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
  },
  resolve: {
    alias: { '@rtp/schema': new URL('./packages/schema/src/index.ts', import.meta.url).pathname },
  },
});
