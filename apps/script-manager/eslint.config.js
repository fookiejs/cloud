import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const restrictedSyntax = [
  {
    selector: 'ConditionalExpression',
    message: 'Ternary (?:) yasak. if/else statement veya yardimci fonksiyon kullan.',
  },
  {
    selector: "LogicalExpression[operator='??']",
    message: 'Nullish coalescing (??) yasak. Acik if/else veya || kullan.',
  },
  {
    selector: 'ChainExpression',
    message: 'Optional chaining (?.) yasak. Acik null/undefined kontrolu yap.',
  },
  {
    selector: 'TSNonNullExpression',
    message: 'Non-null assertion (!) yasak. Acik kontrol yap.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.test.ts',
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': ['error', ...restrictedSyntax],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: false },
      ],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
);
