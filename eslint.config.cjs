const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['dist/**', 'lib/**', 'node_modules/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'modules_new/*/logic/*',
            'modules_new/*/data/*',
            'modules_new/*/ui/*',
            'modules_new/*/internal/*',
          ],
        },
      ],
    },
  },
  {
    files: ['modules_new/**/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['../logic/*', '../data/*', '../../*/logic/*', '../../*/data/*'],
        },
      ],
    },
  },
  {
    files: ['modules_new/**/logic/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '../data/*',
            'firebase',
            'firebase/*',
            'shared/backend/firebase',
            '../../shared/backend/firebase',
            '../../../shared/backend/firebase',
          ],
        },
      ],
    },
  },
];
