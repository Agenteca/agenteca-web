import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.astro', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Les caractères de contrôle sont le sujet même du scan de sécurité.
      'no-control-regex': 'off',
      'no-misleading-character-class': 'off',
      'no-irregular-whitespace': [
        'error',
        { skipRegExps: true, skipStrings: true, skipTemplates: true, skipComments: true },
      ],
    },
  },
  { files: ['test/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
