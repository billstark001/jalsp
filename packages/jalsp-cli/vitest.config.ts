import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Give CLI integration tests more time (bundle invokes rollup)
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
});
