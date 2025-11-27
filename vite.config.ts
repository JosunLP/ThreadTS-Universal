import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      rollupTypes: true,
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ThreadTSUniversal',
      formats: ['es', 'cjs'],
      fileName: (format) => {
        if (format === 'es') return 'esm/index.mjs';
        return 'index.cjs';
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: [
        'worker_threads',
        'os',
        'path',
        'url',
        'perf_hooks',
        'fs',
        'crypto',
      ],
      output: {
        preserveModules: false,
        exports: 'named',
      },
    },
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
