import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';
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
        '*.config.[tj]s',
        'builds',
        'src/entryPoints',
        'src/scripts',
      ],
      all: true,
    },
  },
  plugins: [
    react(),
    createHtmlPlugin({
      template: 'src/entryPoints/index.html',
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'builds/website',
    emptyOutDir: true,
  },
});
