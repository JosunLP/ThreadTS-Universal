import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        AbortSignal: 'readonly',
        Blob: 'readonly',
        Buffer: 'readonly',
        Bun: 'readonly',
        ErrorEvent: 'readonly',
        EventTarget: 'readonly',
        ImageBitmap: 'readonly',
        MessageChannel: 'readonly',
        MessageEvent: 'readonly',
        MessagePort: 'readonly',
        NodeJS: 'readonly',
        NodeRequire: 'readonly',
        OffscreenCanvas: 'readonly',
        PermissionDescriptor: 'readonly',
        PermissionStatus: 'readonly',
        ReadableStream: 'readonly',
        Transferable: 'readonly',
        Worker: 'readonly',
        WorkerOptions: 'readonly',
        URL: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-restricted-types': [
        'warn',
        {
          types: {
            Function: {
              message:
                'Use a specific function signature instead of the broad `Function` type.',
            },
            '{}': {
              message:
                'Use an explicit object shape or `Record<string, unknown>` instead of `{}`.',
            },
          },
        },
      ],
      'no-useless-catch': 'warn',
      'no-case-declarations': 'warn',
    },
  },
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      '**/*.js',
      '**/*.d.ts',
      '**/*.cjs',
    ],
  }
);
