module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
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
  ignorePatterns: ['dist/**/*', 'node_modules/**/*', '*.js', '*.d.ts', '*.cjs'],
};
