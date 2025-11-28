import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/browser/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Important for worker thread tests
      },
    },
  },
});
