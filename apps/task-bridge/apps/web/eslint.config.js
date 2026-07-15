import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const BANNED_EVERYWHERE = [
  {
    selector: "SpreadElement",
    message: "Spread (...) is banned.",
  },
  {
    selector: "RestElement",
    message: "Rest (...) is banned.",
  },
  {
    selector: "JSXSpreadAttribute",
    message: "JSX spread {...props} is banned.",
  },
  {
    selector: "BinaryExpression[operator=/^(===|!==)$/] > UnaryExpression[operator='void']",
    message: "void 0 is banned. Use null.",
  },
  {
    selector: "TSUnknownKeyword",
    message: "unknown is banned. Use a concrete type.",
  },
  {
    selector: "TSTypeReference[typeName.name='JsonValue']",
    message: "JsonValue is banned.",
  },
  {
    selector: "TSTypeReference[typeName.name='JsonObject']",
    message: "JsonObject is banned.",
  },
  {
    selector: "Identifier[name='parseJsonValue']",
    message: "parseJsonValue is banned.",
  },
  {
    selector: "LineComment",
    message: "Comments are banned.",
  },
  {
    selector: "BlockComment",
    message: "Comments are banned.",
  },
  {
    selector: "LogicalExpression[operator='??']",
    message: "?? is banned. Use explicit if/else.",
  },
  {
    selector: "AssignmentExpression[operator='??=']",
    message: "??= is banned.",
  },
  {
    selector: "Identifier[name='undefined']",
    message: "undefined is banned. Use null for missing values.",
  },
  {
    selector: "TSUndefinedKeyword",
    message: "undefined in types is banned. Use null.",
  },
  {
    selector: "MemberExpression[optional=true]",
    message: "?. optional chaining is banned. Guard with an explicit null check.",
  },
  {
    selector: "CallExpression[optional=true]",
    message: "?. optional call is banned. Guard with an explicit null check.",
  },
  {
    selector: "TSPropertySignature[optional=true]",
    message: "Optional property (?:) is banned. Use 'T | null' in the property type.",
  },
  {
    selector: "TSMethodSignature[optional=true]",
    message: "Optional method (?:) is banned. Use '(() => R) | null'.",
  },
  {
    selector: "PropertyDefinition[optional=true]",
    message: "Optional class field (?:) is banned. Use 'T | null'.",
  },
  {
    selector: "Identifier[optional=true]",
    message: "Optional parameter (?) is banned. Use 'T | null' in the parameter type.",
  },
];

const BANNED_TERNARY = [
  {
    selector: "ConditionalExpression",
    message: "Ternary (? :) is banned in .ts files. Use explicit if/else.",
  },
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    ignores: ["dist/**", "**/*.config.js"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-undefined": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      eqeqeq: ["error", "always"],
      "no-restricted-syntax": ["error", ...BANNED_EVERYWHERE],
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...BANNED_EVERYWHERE, ...BANNED_TERNARY],
    },
  },
);
