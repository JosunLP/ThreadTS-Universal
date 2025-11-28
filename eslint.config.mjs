import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
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
    ignores: ['dist/**/*', 'node_modules/**/*', '**/*.js', '**/*.d.ts', '**/*.cjs'],
  }
);
