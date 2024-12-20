import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  test: {
    globals: true,
    css: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        ...(configDefaults.coverage.exclude as string[]),
        '*.config.js',
      ],
      all: true,
    },
  },
  plugins: [react()],
  build: {
    target: 'esnext',
  },
});
