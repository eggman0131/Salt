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
            'modules/*/logic/*',
            'modules/*/data/*',
            'modules/*/ui/*',
            'modules/*/internal/*',
          ],
        },
      ],
    },
  },
  {
    files: ['modules/**/ui/**/*.{ts,tsx}'],
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
    files: ['modules/**/logic/**/*.{ts,tsx}'],
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
