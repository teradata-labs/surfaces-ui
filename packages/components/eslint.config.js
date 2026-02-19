import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Too many false positives with React array indexing and dynamic object access
      'security/detect-object-injection': 'off',
      // Allow underscore-prefixed unused vars (standard convention for intentionally unused)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow require() in config files and dynamic imports
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  // Relax rules for test files where mocks legitimately use `any`
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
