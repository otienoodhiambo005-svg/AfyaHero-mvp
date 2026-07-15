import nextVitals from 'eslint-config-next/core-web-vitals';

const jsxA11yPlugin = nextVitals.find((entry) => entry.plugins?.['jsx-a11y'])?.plugins?.['jsx-a11y'];
const typescriptPlugin = nextVitals.find((entry) => entry.plugins?.['@typescript-eslint'])?.plugins?.['@typescript-eslint'];

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'server/**',
      'static/**',
      'out/**',
      'build/**',
      '.open-next/**',
    ],
  },
  ...nextVitals,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
    },
  },
  {
    files: [
      'src/lib/logger.ts',
      'src/lib/observability.ts',
      'src/components/ai/apply-jsx-*.js',
      'src/**/__tests__/**/*.{ts,tsx,js,jsx}',
      'tests/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];

export default config;
