import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jalspSrc = resolve(__dirname, '..', 'jalsp', 'src', 'index.ts');

export default defineConfig({
  resolve: {
    alias: {
      jalsp: jalspSrc,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Give CLI integration tests more time (bundle invokes rollup)
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
});
