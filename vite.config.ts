import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['src/**/*.test.{ts,tsx}'] },
  build: { rollupOptions: { output: { manualChunks: { katex: ['katex'] } } } },
});
