import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createHtmlPlugin({
      template: 'src/entryPoints/extension.html',
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'builds/chrome-extension',
    emptyOutDir: true,
  },
});
