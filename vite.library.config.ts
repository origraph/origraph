import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      // rollupTypes: true, // wait for https://github.com/qmhc/vite-plugin-dts/issues/395 to be resolved before re-enabling
      include: ['src'],
      tsconfigPath: 'tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry: 'src/entryPoints/library.ts',
      formats: ['es'],
    },
    outDir: 'builds/library',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
    },
  },
});
