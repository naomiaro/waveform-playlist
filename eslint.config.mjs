import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintReact from '@eslint-react/eslint-plugin';
import globals from 'globals';

// React lets `use()` be called in a condition or a loop, so
// `react-hooks/rules-of-hooks` does not report it there. Every context read in
// the React packages stays at the top level of its component or hook (#771): a
// component that reads a context only sometimes subscribes only sometimes.
// The first selector finds a `use()` somewhere inside a branch, a loop, a
// `switch`, a `try`, or a statement that follows, in the same block, a `return`
// or an `if` that contains one; the second finds one that IS the branch
// (`on ? use(X) : 0`, `on && use(X)`). A `use()` in the test of an `if` or a
// ternary always runs and is allowed.
//
// Not reported (review these by hand): a `use()` in a callback (`rows.map(() =>
// use(X))`, which `rules-of-hooks` does not report either), in `a ||= use(X)`,
// as an argument of an optional call, as a default value, after a `throw` or a
// return inside a preceding loop or `switch`, `React.use()`, and an alias.
// Reported although it may be fine: any function named `use`; a component
// defined inside a branch or a loop; a `use()` after an `if` whose only
// `return` is inside a callback; `for (const x of use(X))`.
const CONDITIONAL_USE_MESSAGE =
  'use() must be called at the top level of the component or hook, before any early return: ' +
  'a context read in a condition or a loop subscribes only sometimes (#771).';
const noConditionalUse = [
  'error',
  {
    selector:
      ':matches(IfStatement > :not(.test), ConditionalExpression > :not(.test), ' +
      'LogicalExpression > .right, ForStatement, ForInStatement, ForOfStatement, WhileStatement, ' +
      'DoWhileStatement, SwitchStatement, TryStatement, ' +
      'BlockStatement > :matches(ReturnStatement, IfStatement:has(ReturnStatement)) ~ *) ' +
      "CallExpression[callee.name='use']",
    message: CONDITIONAL_USE_MESSAGE,
  },
  {
    selector:
      ':matches(ConditionalExpression > CallExpression:not(.test), ' +
      "LogicalExpression > CallExpression.right)[callee.name='use']",
    message: CONDITIONAL_USE_MESSAGE,
  },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.docusaurus/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['packages/**/src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'website/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['packages/**/src/**/*.{ts,tsx}'],
    // React 19 spellings (#771): `use(Context)`, `<Context value>`, `ref` as a
    // prop. Of the plugin only these three rules are on. `no-context-provider`
    // reports `<FooContext.Provider>` in JSX, for a name ending in `Context`: not
    // a provider held in a variable or passed to `createElement`, and not
    // `<X.Consumer>`. The aliases `AnnotationIntegrationProvider` and
    // `SpectrogramIntegrationProvider` are public names and stay.
    plugins: {
      '@eslint-react': eslintReact,
    },
    rules: {
      'no-restricted-syntax': noConditionalUse,
      '@eslint-react/no-use-context': 'error',
      '@eslint-react/no-context-provider': 'error',
      '@eslint-react/no-forward-ref': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.stories.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
